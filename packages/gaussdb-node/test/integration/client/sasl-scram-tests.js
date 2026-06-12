'use strict'
const helper = require('./../test-helper')
const gaussdb = helper.gaussdb
const suite = new helper.Suite()
const assert = require('assert')

/**
 * This test only executes if the env variables SCRAM_TEST_GAUSSUSER and
 * SCRAM_TEST_GAUSSPASSWORD are defined. You can override additional values
 * for the host, port and database with other SCRAM_TEST_ prefixed vars.
 * If the variables are not defined the test will be skipped.
 *
 * SQL to create test role:
 *
 *     SET password_encryption = 'scram-sha-256';
 *     CREATE ROLE scram_test login password 'test4scram';
 *
 * Add the following entries to gs_hba.conf:
 *
 *     host   all   scram_test   ::1/128    scram-sha-256
 *     host   all    scram_test   0.0.0.0/0   scram-sha-256
 *
 * Then run this file with after exporting:
 *
 *     SCRAM_TEST_GAUSSUSER=scram_test
 *     SCRAM_TEST_GAUSSPASSWORD=test4scram
 */

// Base config for SCRAM tests
const config = {
  user: process.env.SCRAM_TEST_GAUSSUSER,
  password: process.env.SCRAM_TEST_GAUSSPASSWORD,
  host: process.env.SCRAM_TEST_GAUSSHOST, // optional
  port: process.env.SCRAM_TEST_GAUSSPORT, // optional
  database: process.env.SCRAM_TEST_GAUSSDATABASE, // optional
}

if (!config.user || !config.password) {
  suite.testAsync('skipping SCRAM tests (missing env)', () => {})
  return
}

suite.testAsync('can connect using sasl/scram with channel binding enabled (if using SSL)', async () => {
  const client = new gaussdb.Client({ ...config, enableChannelBinding: true })
  let usingChannelBinding = false
  let hasPeerCert = false
  client.connection.once('authenticationSASLContinue', () => {
    hasPeerCert = client.connection.stream.getPeerCertificate === 'function'
    usingChannelBinding = client.saslSession.mechanism === 'SCRAM-SHA-256-PLUS'
  })
  await client.connect()
  assert.ok(usingChannelBinding || !hasPeerCert, 'Should be using SCRAM-SHA-256-PLUS for authentication if using SSL')
  await client.end()
})

suite.testAsync('can connect using sasl/scram with channel binding disabled', async () => {
  const client = new gaussdb.Client({ ...config, enableChannelBinding: false })
  let usingSASLWithoutChannelBinding = false
  client.connection.once('authenticationSASLContinue', () => {
    usingSASLWithoutChannelBinding = client.saslSession.mechanism === 'SCRAM-SHA-256'
  })
  await client.connect()
  assert.ok(usingSASLWithoutChannelBinding, 'Should be using SCRAM-SHA-256 (no channel binding) for authentication')
  await client.end()
})

suite.testAsync('sasl/scram fails when password is wrong', async () => {
  const client = new gaussdb.Client({
    ...config,
    password: config.password + 'append-something-to-make-it-bad',
  })
  let usingSasl = false
  client.connection.once('authenticationSASL', () => {
    usingSasl = true
  })
  await assert.rejects(
    () => client.connect(),
    {
      code: '28P01',
    },
    'Error code should be for a password error'
  )
  assert.ok(usingSasl, 'Should be using SASL for authentication')
})

suite.testAsync('sasl/scram fails when password is empty', async () => {
  const client = new gaussdb.Client({
    ...config,
    // We use a password function here so the connection defaults do not
    // override the empty string value with one from process.env.GAUSSPASSWORD
    password: () => '',
  })
  let usingSasl = false
  client.connection.once('authenticationSASL', () => {
    usingSasl = true
  })
  await assert.rejects(
    () => client.connect(),
    {
      message: 'SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a non-empty string',
    },
    'Error code should be for a password error'
  )
  assert.ok(usingSasl, 'Should be using SASL for authentication')
})
