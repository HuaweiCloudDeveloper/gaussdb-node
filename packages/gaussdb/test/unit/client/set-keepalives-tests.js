'use strict'
const net = require('net')
const gaussdb = require('../../../lib/index.js')
const helper = require('./test-helper')
const assert = require('assert')

const suite = new helper.Suite()

suite.test('setting keep alive', (done) => {
  const server = net.createServer((c) => {
    c.destroy()
    server.close()
  })

  server.listen(7777, () => {
    const stream = new net.Socket()
    stream.setKeepAlive = (enable, initialDelay) => {
      assert(enable === true)
      assert(initialDelay === 10000)
      done()
    }

    const client = new gaussdb.Client({
      host: 'localhost',
      port: 7777,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
      stream,
    })

    client.connect().catch(() => {})
  })
})
