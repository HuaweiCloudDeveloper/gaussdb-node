'use strict'
const helper = require('./../test-helper')
const gaussdb = helper.gaussdb
const suite = new helper.Suite()
const assert = require('assert')

/**
 * This test only executes if the env variables SHA256_TEST_GAUSSUSER and
 * SHA256_TEST_GAUSSPASSWORD are defined. You can override additional values
 * for the host, port and database with other SHA256_TEST_ prefixed vars.
 * If the variables are not defined the test will be skipped.
 *
 * SQL to create test role:
 *
 *     SET password_encryption_type = 2;
 *     CREATE ROLE sha256_test login password 'test4@scram';
 *
 * Add the following entries to gs_hba.conf:
 *
 *     host   all   sha256_test   ::1/128    sha256
 *     host   all   sha256_test   0.0.0.0/0   sha256
 *
 * Then run this file with after exporting:
 *
 *     SHA256_TEST_GAUSSUSER=sha256_test
 *     SHA256_TEST_GAUSSPASSWORD=test4@scram
 */

// Base config for SHA256 tests
const config = {
  user: process.env.SHA256_TEST_GAUSSUSER,
  password: process.env.SHA256_TEST_GAUSSPASSWORD,
  host: process.env.SHA256_TEST_GAUSSHOST || 'localhost',
  port: process.env.SHA256_TEST_GAUSSPORT || 5432,
  database: process.env.SHA256_TEST_GAUSSDATABASE || 'ci_db_test',
}

if (!config.user || !config.password) {
  suite.testAsync('skipping SHA256 tests (missing env)', () => {})
  return
}

suite.testAsync('can connect using sha256 password authentication', async () => {
  const client = new gaussdb.Client(config)
  let usingSha256 = false
  client.connection.once('authenticationSHA256Password', () => {
    usingSha256 = true
  })
  await client.connect()

  // Verify SHA256 authentication was used
  assert.strictEqual(usingSha256, true, 'Should use SHA256 authentication')

  // Test basic query execution
  const { rows } = await client.query('SELECT NOW()')
  assert.strictEqual(rows.length, 1)

  await client.end()
})

suite.testAsync('sha256 authentication fails when password is wrong', async () => {
  const client = new gaussdb.Client({
    ...config,
    password: config.password + 'append-something-to-make-it-bad',
  })
  await assert.rejects(
    () => client.connect(),
    {
      code: '28P01',
    },
    'Error code should be for a password error'
  )
})

suite.testAsync('sha256 authentication fails when password is empty', async () => {
  const client = new gaussdb.Client({
    ...config,
    // use a password function to simulate empty password
    password: () => '',
  })
  await assert.rejects(
    () => client.connect(),
    (err) => {
      // Should fail with authentication error
      return err.code === '28P01' || err.message.includes('password')
    },
    'Should fail with password-related error'
  )
})
