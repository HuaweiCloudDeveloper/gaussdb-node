'use strict'

const assert = require('assert')
const EventEmitter = require('events').EventEmitter
const helper = require('./test-helper')
const Connection = require('../../../lib/connection')
const Client = require('../../../lib/client')
const tracker = require('../../../lib/host-status-tracker')
const HostStatus = tracker.HostStatus

const suite = new helper.Suite()
const test = suite.test.bind(suite)

const makeStream = () => {
  const stream = new EventEmitter()
  stream.setNoDelay = () => {}
  stream.connect = () => {}
  stream.write = () => {}
  stream.destroy = () => {}
  return stream
}

// Build a Client wired to an in-memory stream so no real socket is opened.
// `stream` is also passed as the Client stream option so the protocol-fallback
// path can build a new Connection without touching the network.
const makeClient = (config) => {
  const stream = makeStream()
  const connection = new Connection({ stream })
  return {
    stream: stream,
    connection: connection,
    client: new Client(Object.assign({ connection: connection, stream: stream }, config)),
  }
}

test('_isRoleAcceptable', function () {
  const { client } = makeClient()
  const M = HostStatus.MASTER
  const S = HostStatus.SLAVE

  test('any / undefined accepts any role', function () {
    assert.strictEqual(client._isRoleAcceptable(M, undefined), true)
    assert.strictEqual(client._isRoleAcceptable(S, 'any'), true)
  })

  test('master accepts only MASTER', function () {
    assert.strictEqual(client._isRoleAcceptable(M, 'master'), true)
    assert.strictEqual(client._isRoleAcceptable(S, 'master'), false)
  })

  test('slave accepts only SLAVE', function () {
    assert.strictEqual(client._isRoleAcceptable(S, 'slave'), true)
    assert.strictEqual(client._isRoleAcceptable(M, 'slave'), false)
  })

  test('preferSlave accepts SLAVE or MASTER', function () {
    assert.strictEqual(client._isRoleAcceptable(S, 'preferSlave'), true)
    assert.strictEqual(client._isRoleAcceptable(M, 'preferSlave'), true)
  })
})

test('_finalizeConnectSuccess', function () {
  test('flips state, emits connect, and invokes the connection callback', function () {
    const { client } = makeClient()
    client._connecting = true
    let emitted = false
    client.on('connect', () => {
      emitted = true
    })
    let cbCalled = false
    client._connectionCallback = () => {
      cbCalled = true
    }

    client._finalizeConnectSuccess()

    assert.strictEqual(client._connected, true)
    assert.strictEqual(client._connecting, false)
    assert.strictEqual(emitted, true)
    assert.strictEqual(cbCalled, true)
    assert.strictEqual(client._connectionCallback, null)
  })

  test('records CONNECT_OK for a targetServerType=any host', function () {
    tracker.clear()
    const { client } = makeClient({ targetServerType: 'any' })
    const spec = { host: 'h-any', port: 5432 }
    client._activeHostSpec = spec
    client._connecting = true
    client._finalizeConnectSuccess()
    const entry = tracker.getHostStatus(spec)
    assert.strictEqual(entry && entry.status, HostStatus.CONNECT_OK)
  })

  test('does not overwrite an already-probed role status', function () {
    tracker.clear()
    const { client } = makeClient({ targetServerType: 'master' })
    const spec = { host: 'h-master', port: 5432 }
    client._activeHostSpec = spec
    client._connecting = true
    tracker.updateHostStatus(spec, HostStatus.MASTER)
    client._finalizeConnectSuccess()
    const entry = tracker.getHostStatus(spec)
    assert.strictEqual(entry.status, HostStatus.MASTER)
  })
})

test('role probe flow', function () {
  test('finalizes when the probed role matches targetServerType', function () {
    return new Promise((resolve, reject) => {
      tracker.clear()
      const { client, stream, connection } = makeClient({ targetServerType: 'master' })
      client.query = function (sql, cb) {
        assert.ok(/pg_is_in_recovery/.test(sql), 'should probe role with pg_is_in_recovery()')
        process.nextTick(() => cb(null, { rows: [{ is_in_recovery: false }] })) // primary
      }
      client.connect(function (err) {
        try {
          assert.ifError(err)
          assert.strictEqual(client._connected, true)
          assert.strictEqual(client._connecting, false)
          resolve()
        } catch (e) {
          reject(e)
        }
      })
      stream.emit('connect')
      process.nextTick(() => {
        connection.emit('readyForQuery', {})
      })
    })
  })

  test('accepts "t"/"f" string probe results', function () {
    return new Promise((resolve, reject) => {
      tracker.clear()
      const { client, stream, connection } = makeClient({ targetServerType: 'slave' })
      client.query = function (sql, cb) {
        process.nextTick(() => cb(null, { rows: [{ is_in_recovery: 't' }] })) // standby
      }
      client.connect(function (err) {
        try {
          assert.ifError(err)
          assert.strictEqual(client._connected, true)
          resolve()
        } catch (e) {
          reject(e)
        }
      })
      stream.emit('connect')
      process.nextTick(() => {
        connection.emit('readyForQuery', {})
      })
    })
  })

  test('skips the host when the probed role does not match', function () {
    return new Promise((resolve, reject) => {
      tracker.clear()
      const { client, stream, connection } = makeClient({ targetServerType: 'master' })
      client.query = function (sql, cb) {
        process.nextTick(() => cb(null, { rows: [{ is_in_recovery: true }] })) // standby
      }
      client.connect(function (err) {
        try {
          assert.ok(err, 'expected a role-mismatch error')
          assert.ok(/does not satisfy targetServerType='master'/.test(err.message), err.message)
          assert.strictEqual(client._connected, false)
          resolve()
        } catch (e) {
          reject(e)
        }
      })
      stream.emit('connect')
      process.nextTick(() => {
        connection.emit('readyForQuery', {})
      })
    })
  })

  test('skips the host when the probe result cannot be interpreted', function () {
    return new Promise((resolve, reject) => {
      tracker.clear()
      const { client, stream, connection } = makeClient({ targetServerType: 'slave' })
      client.query = function (sql, cb) {
        process.nextTick(() => cb(null, { rows: [{ is_in_recovery: null }] }))
      }
      client.connect(function (err) {
        try {
          assert.ok(err, 'expected a probe-failure error')
          assert.ok(/Failed to determine server role/.test(err.message), err.message)
          resolve()
        } catch (e) {
          reject(e)
        }
      })
      stream.emit('connect')
      process.nextTick(() => {
        connection.emit('readyForQuery', {})
      })
    })
  })

  test('skips the host when the probe query itself errors', function () {
    return new Promise((resolve, reject) => {
      tracker.clear()
      const { client, stream, connection } = makeClient({ targetServerType: 'master' })
      client.query = function (sql, cb) {
        process.nextTick(() => cb(new Error('probe failed')))
      }
      client.connect(function (err) {
        try {
          assert.ok(err)
          assert.strictEqual(err.message, 'probe failed')
          resolve()
        } catch (e) {
          reject(e)
        }
      })
      stream.emit('connect')
      process.nextTick(() => {
        connection.emit('readyForQuery', {})
      })
    })
  })
})

test('unsupported frontend protocol fallback', function () {
  test('reconnects once with protocolMinor 0', function () {
    const { client, connection } = makeClient()
    let startCalls = 0
    client._startConnection = function () {
      startCalls++
    }
    client._connecting = true
    client._connectionError = false

    client._handleErrorWhileConnecting(
      new Error('FATAL: unsupported frontend protocol 3.51. server told us to go away')
    )

    assert.strictEqual(startCalls, 1)
    assert.strictEqual(client._protocolFallbackAttempted, true)
    assert.strictEqual(client._connectionError, false)
    assert.notStrictEqual(client.connection, connection)
  })

  test('does not fall back more than once', function () {
    const { client } = makeClient()
    let startCalls = 0
    client._startConnection = function () {
      startCalls++
    }
    client._connecting = true
    client._connectionError = false

    client._handleErrorWhileConnecting(new Error('unsupported frontend protocol 3.51'))
    assert.strictEqual(startCalls, 1)

    let errored = false
    client.on('error', () => {
      errored = true
    })
    client._handleErrorWhileConnecting(new Error('unsupported frontend protocol 3.51'))
    assert.strictEqual(startCalls, 1)
    assert.strictEqual(errored, true)
  })
})
