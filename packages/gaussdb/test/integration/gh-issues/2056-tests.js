'use strict'
const helper = require('./../test-helper')
const assert = require('assert')

const suite = new helper.Suite()

suite.test('All queries should return a result array', (done) => {
  const client = new helper.gaussdb.Client()
  client.connect()
  const promises = []
  promises.push(client.query('CREATE TEMP TABLE foo(bar TEXT)'))
  promises.push(client.query('INSERT INTO foo(bar) VALUES($1)', ['qux']))
  promises.push(client.query('SELECT * FROM foo WHERE bar = $1', ['foo']))
  Promise.all(promises).then((results) => {
    results.forEach((res) => {
      assert(Array.isArray(res.fields))
      assert(Array.isArray(res.rows))
    })
    client.end(done)
  })
})
