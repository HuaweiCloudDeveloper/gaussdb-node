'use strict'
const helper = require('./test-helper')
const assert = require('assert')

function testTypeParser(client, expectedResult, done) {
  const boolValue = true
  client.query('CREATE TEMP TABLE parserOverrideTest(id bool)')
  client.query('INSERT INTO parserOverrideTest(id) VALUES ($1)', [boolValue])
  client.query(
    'SELECT * FROM parserOverrideTest',
    assert.success(function (result) {
      assert.equal(result.rows[0].id, expectedResult)
      done()
    })
  )
}

const pool = new helper.gaussdb.Pool(helper.config)
pool.connect(
  assert.success(function (client1, done1) {
    pool.connect(
      assert.success(function (client2, done2) {
        const boolTypeOID = 16
        client1.setTypeParser(boolTypeOID, function () {
          return 'first client'
        })
        client2.setTypeParser(boolTypeOID, function () {
          return 'second client'
        })

        client1.setTypeParser(boolTypeOID, 'binary', function () {
          return 'first client binary'
        })
        client2.setTypeParser(boolTypeOID, 'binary', function () {
          return 'second client binary'
        })

        testTypeParser(client1, 'first client', () => {
          done1()
          testTypeParser(client2, 'second client', () => done2(), pool.end())
        })
      })
    )
  })
)
