'use strict'
const helper = require('./test-helper')
const assert = require('assert')

new helper.Suite().test('idle timeout', function () {
  const config = Object.assign({}, helper.config, { idleTimeoutMillis: 50 })
  const pool = new helper.gaussdb.Pool(config)
  pool.connect(
    assert.calls(function (err, client, done) {
      assert(!err)
      client.query('SELECT NOW()')
      done()
    })
  )
})
