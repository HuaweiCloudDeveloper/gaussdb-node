'use strict'

const assert = require('assert')
const helper = require('./test-helper')
const HostChooser = require('../../lib/host-chooser')
const tracker = require('../../lib/host-status-tracker')
const HostStatus = tracker.HostStatus

const suite = new helper.Suite()
const test = suite.test.bind(suite)

const host = (name, port) => ({ host: name, port: port || 5432 })

test('_getCandidateHosts fallback', function () {
  test('targetServerType=any returns every host when all are recently failed', function () {
    tracker.clear()
    const f1 = host('f1')
    const f2 = host('f2')
    tracker.updateHostStatus(f1, HostStatus.CONNECT_FAIL)
    tracker.updateHostStatus(f2, HostStatus.CONNECT_FAIL)
    const chooser = new HostChooser([f1, f2], false, 'any', 10)
    const candidates = chooser._getCandidateHosts()
    assert.strictEqual(candidates.length, 2)
  })

  test('master returns only probing candidates when no MASTER is known', function () {
    tracker.clear()
    const ok = host('ok')
    const standby = host('standby')
    tracker.updateHostStatus(ok, HostStatus.CONNECT_OK) // probing candidate
    tracker.updateHostStatus(standby, HostStatus.SLAVE) // already probed, not a candidate
    const chooser = new HostChooser([ok, standby], false, 'master', 10)
    const candidates = chooser._getCandidateHosts()
    assert.strictEqual(candidates.length, 1)
    assert.strictEqual(candidates[0].host, 'ok')
  })

  test('master returns empty when all hosts are already probed to the wrong role', function () {
    tracker.clear()
    const s1 = host('s1')
    const s2 = host('s2')
    tracker.updateHostStatus(s1, HostStatus.SLAVE)
    tracker.updateHostStatus(s2, HostStatus.SLAVE)
    const chooser = new HostChooser([s1, s2], false, 'master', 10)
    const candidates = chooser._getCandidateHosts()
    assert.strictEqual(candidates.length, 0)
  })
})
