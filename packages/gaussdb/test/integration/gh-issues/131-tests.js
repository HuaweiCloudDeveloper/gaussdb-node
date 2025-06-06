'use strict'
const helper = require('../test-helper')
const gaussdb = helper.gaussdb
const assert = require('assert')

const suite = new helper.Suite()

suite.test('parsing array decimal results', function (done) {
  const pool = new gaussdb.Pool()
  pool.connect(
    assert.calls(function (err, client, release) {
      assert(!err)
      client.query('CREATE TEMP TABLE why(names text[], numbors integer[], decimals double precision[])')
      client
        .query(
          new gaussdb.Query(
            'INSERT INTO why(names, numbors, decimals) VALUES(\'{"aaron", "brian","a b c" }\', \'{1, 2, 3}\', \'{.1, 0.05, 3.654}\')'
          )
        )
        .on('error', console.log)
      client.query(
        'SELECT decimals FROM why',
        assert.success(function (result) {
          assert.lengthIs(result.rows[0].decimals, 3)
          assert.equal(result.rows[0].decimals[0], 0.1)
          assert.equal(result.rows[0].decimals[1], 0.05)
          assert.equal(result.rows[0].decimals[2], 3.654)
          release()
          pool.end(done)
        })
      )
    })
  )
})
