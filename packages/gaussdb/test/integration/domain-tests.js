'use strict'

const helper = require('./test-helper')
const Query = helper.gaussdb.Query
const suite = new helper.Suite()

const assert = require('assert')
const Pool = helper.gaussdb.Pool

suite.test('no domain', function (cb) {
  assert(!process.domain)
  const pool = new Pool()
  pool.connect(
    assert.success(function (client, done) {
      assert(!process.domain)
      done()
      pool.end(cb)
    })
  )
})

suite.test('with domain', function (cb) {
  assert(!process.domain)
  const pool = new Pool()
  const domain = require('domain').create()
  domain.run(function () {
    const startingDomain = process.domain
    assert(startingDomain)
    pool.connect(
      assert.success(function (client, done) {
        assert(process.domain, 'no domain exists in connect callback')
        assert.equal(startingDomain, process.domain, 'domain was lost when checking out a client')
        client.query(
          'SELECT NOW()',
          assert.success(function () {
            assert(process.domain, 'no domain exists in query callback')
            assert.equal(startingDomain, process.domain, 'domain was lost when checking out a client')
            done(true)
            process.domain.exit()
            pool.end(cb)
          })
        )
      })
    )
  })
})

suite.test('error on domain', function (cb) {
  const domain = require('domain').create()
  const pool = new Pool()
  domain.on('error', function () {
    pool.end(cb)
  })
  domain.run(function () {
    pool.connect(
      assert.success(function (client, done) {
        client.query(new Query('SELECT SLDKJFLSKDJF'))
        client.on('drain', done)
      })
    )
  })
})
