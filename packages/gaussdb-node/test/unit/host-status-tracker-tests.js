'use strict'

const assert = require('assert')
const helper = require('./test-helper')
const tracker = require('../../lib/host-status-tracker')
const HostStatus = tracker.HostStatus

const suite = new helper.Suite()
const test = suite.test.bind(suite)

const RECHECK = 10000
const host = (name, port) => ({ host: name, port: port || 5432 })

// Force a tracked entry to look expired without waiting in real time.
const expire = (spec) => {
  const entry = tracker.getHostStatus(spec)
  if (entry) {
    entry.timestamp = Date.now() - (RECHECK + 5000)
  }
}

test('_isHostSuitable', function () {
  test('treats a host with no status as suitable (needs probing)', function () {
    tracker.clear()
    assert.strictEqual(tracker._isHostSuitable(host('none'), 'master', RECHECK), true)
    assert.strictEqual(tracker._isHostSuitable(host('none'), 'slave', RECHECK), true)
  })

  test('treats a recently failed host as not suitable', function () {
    tracker.clear()
    const spec = host('failed')
    tracker.updateHostStatus(spec, HostStatus.CONNECT_FAIL)
    assert.strictEqual(tracker._isHostSuitable(spec, 'any', RECHECK), false)
  })

  test('treats an expired failure as suitable again', function () {
    tracker.clear()
    const spec = host('expired')
    tracker.updateHostStatus(spec, HostStatus.CONNECT_FAIL)
    expire(spec)
    assert.strictEqual(tracker._isHostSuitable(spec, 'any', RECHECK), true)
  })

  test('for master, only MASTER is suitable (CONNECT_OK no longer counts)', function () {
    tracker.clear()
    const spec = host('m')
    tracker.updateHostStatus(spec, HostStatus.CONNECT_OK)
    assert.strictEqual(tracker._isHostSuitable(spec, 'master', RECHECK), false)
    tracker.updateHostStatus(spec, HostStatus.MASTER)
    assert.strictEqual(tracker._isHostSuitable(spec, 'master', RECHECK), true)
    tracker.updateHostStatus(spec, HostStatus.SLAVE)
    assert.strictEqual(tracker._isHostSuitable(spec, 'master', RECHECK), false)
  })

  test('for slave, only SLAVE is suitable', function () {
    tracker.clear()
    const spec = host('s')
    tracker.updateHostStatus(spec, HostStatus.SLAVE)
    assert.strictEqual(tracker._isHostSuitable(spec, 'slave', RECHECK), true)
    tracker.updateHostStatus(spec, HostStatus.MASTER)
    assert.strictEqual(tracker._isHostSuitable(spec, 'slave', RECHECK), false)
  })

  test('for preferSlave, SLAVE or MASTER is suitable (CONNECT_OK no longer counts)', function () {
    tracker.clear()
    const spec = host('ps')
    tracker.updateHostStatus(spec, HostStatus.CONNECT_OK)
    assert.strictEqual(tracker._isHostSuitable(spec, 'preferSlave', RECHECK), false)
    tracker.updateHostStatus(spec, HostStatus.SLAVE)
    assert.strictEqual(tracker._isHostSuitable(spec, 'preferSlave', RECHECK), true)
    tracker.updateHostStatus(spec, HostStatus.MASTER)
    assert.strictEqual(tracker._isHostSuitable(spec, 'preferSlave', RECHECK), true)
  })
})

test('isHostProbingCandidate', function () {
  test('a host with no status is a probing candidate', function () {
    tracker.clear()
    assert.strictEqual(tracker.isHostProbingCandidate(host('x'), RECHECK), true)
  })

  test('a host with CONNECT_OK is a probing candidate (role still unknown)', function () {
    tracker.clear()
    const spec = host('ok')
    tracker.updateHostStatus(spec, HostStatus.CONNECT_OK)
    assert.strictEqual(tracker.isHostProbingCandidate(spec, RECHECK), true)
  })

  test('an expired entry is a probing candidate', function () {
    tracker.clear()
    const spec = host('old')
    tracker.updateHostStatus(spec, HostStatus.MASTER)
    expire(spec)
    assert.strictEqual(tracker.isHostProbingCandidate(spec, RECHECK), true)
  })

  test('a recently probed MASTER is not a probing candidate', function () {
    tracker.clear()
    const spec = host('m')
    tracker.updateHostStatus(spec, HostStatus.MASTER)
    assert.strictEqual(tracker.isHostProbingCandidate(spec, RECHECK), false)
  })

  test('a recently probed SLAVE is not a probing candidate', function () {
    tracker.clear()
    const spec = host('s')
    tracker.updateHostStatus(spec, HostStatus.SLAVE)
    assert.strictEqual(tracker.isHostProbingCandidate(spec, RECHECK), false)
  })

  test('a recently failed host is not a probing candidate (avoids retry storm)', function () {
    tracker.clear()
    const spec = host('f')
    tracker.updateHostStatus(spec, HostStatus.CONNECT_FAIL)
    assert.strictEqual(tracker.isHostProbingCandidate(spec, RECHECK), false)
  })
})

test('getCandidateHosts', function () {
  test('for master, keeps MASTER and unprobed hosts, drops standbys', function () {
    tracker.clear()
    const master = host('master')
    const standby = host('standby')
    const fresh = host('fresh')
    tracker.updateHostStatus(master, HostStatus.MASTER)
    tracker.updateHostStatus(standby, HostStatus.SLAVE)
    const candidates = tracker.getCandidateHosts([master, standby, fresh], 'master', RECHECK)
    assert.strictEqual(candidates.length, 2)
    assert.strictEqual(candidates[0].host, 'master')
    assert.strictEqual(candidates[1].host, 'fresh')
  })

  test('for slave, keeps only SLAVE and unprobed hosts', function () {
    tracker.clear()
    const standby = host('standby')
    const primary = host('primary')
    tracker.updateHostStatus(standby, HostStatus.SLAVE)
    tracker.updateHostStatus(primary, HostStatus.MASTER)
    const candidates = tracker.getCandidateHosts([standby, primary], 'slave', RECHECK)
    assert.strictEqual(candidates.length, 1)
    assert.strictEqual(candidates[0].host, 'standby')
  })

  test('for preferSlave, returns standbys first when available', function () {
    tracker.clear()
    const primary = host('primary')
    const standby1 = host('standby1')
    const standby2 = host('standby2')
    tracker.updateHostStatus(primary, HostStatus.MASTER)
    tracker.updateHostStatus(standby1, HostStatus.SLAVE)
    tracker.updateHostStatus(standby2, HostStatus.SLAVE)
    const candidates = tracker.getCandidateHosts([primary, standby1, standby2], 'preferSlave', RECHECK)
    assert.strictEqual(candidates.length, 2)
    assert.strictEqual(candidates[0].host, 'standby1')
    assert.strictEqual(candidates[1].host, 'standby2')
  })

  test('for preferSlave, falls back to primaries when no standby available', function () {
    tracker.clear()
    const primary = host('primary')
    tracker.updateHostStatus(primary, HostStatus.MASTER)
    const candidates = tracker.getCandidateHosts([primary], 'preferSlave', RECHECK)
    assert.strictEqual(candidates.length, 1)
    assert.strictEqual(candidates[0].host, 'primary')
  })
})
