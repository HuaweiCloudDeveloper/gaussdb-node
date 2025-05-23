'use strict'
const domain = require('domain')
const helper = require('./../test-helper')
const Client = require('./../../lib/native')
const suite = new helper.Suite()
const assert = require('assert')

suite.test('fires callback with results', function (done) {
  const client = new Client(helper.config)
  client.connect()
  client.query(
    'SELECT 1 as num',
    assert.calls(function (err, result) {
      assert(!err)
      assert.equal(result.rows[0].num, 1)
      assert.strictEqual(result.rowCount, 1)
      client.query(
        'SELECT * FROM person WHERE name = $1',
        ['Brian'],
        assert.calls(function (err, result) {
          assert(!err)
          assert.equal(result.rows[0].name, 'Brian')
          client.end(done)
        })
      )
    })
  )
})

suite.test('preserves domain', function (done) {
  const dom = domain.create()

  dom.run(function () {
    const client = new Client(helper.config)
    assert.ok(dom === require('domain').active, 'domain is active')
    client.connect()
    client.query('select 1', function () {
      assert.ok(dom === require('domain').active, 'domain is still active')
      client.end(done)
    })
  })
})
