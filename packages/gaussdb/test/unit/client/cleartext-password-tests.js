'use strict'

const helper = require('./test-helper')
const createClient = require('./test-helper').createClient
const assert = require('assert')
const suite = new helper.Suite()
const { MemoryStream } = helper

suite.test('cleartext password auth responds with password', function () {
  const client = createClient()
  client.password = '!'
  client.connection.stream.packets = []
  client.connection.emit('authenticationCleartextPassword')
  const packets = client.connection.stream.packets
  assert.lengthIs(packets, 1)
  const packet = packets[0]
  assert.equalBuffers(packet, [0x70, 0, 0, 0, 6, 33, 0])
})

suite.test('cleartext password auth does not crash with null password using pg-pass', function () {
  process.env.GAUSSPASSFILE = `${__dirname}/pgpass.file`
  const client = new helper.Client({
    host: 'foo',
    port: 5432,
    database: 'bar',
    user: 'baz',
    stream: new MemoryStream(),
  })
  client.connect()
  client.connection.emit('authenticationCleartextPassword')
})
