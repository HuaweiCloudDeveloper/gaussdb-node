const assert = require('assert')
const helper = require('../test-helper')
const suite = new helper.Suite()
const { Client } = helper.gaussdb

suite.test('it sends options', async () => {
  const client = new Client({
    options: '--default_transaction_isolation=serializable',
  })
  await client.connect()
  const { rows } = await client.query('SHOW default_transaction_isolation')
  assert.strictEqual(rows.length, 1)
  // serializable is equivalent to REPEATABLE READ in openGauss
  // https://docs.opengauss.org/en/docs/7.0.0-RC1-lite/docs/DataBaseReference/opengauss-transactions.html
  assert.strictEqual(rows[0].default_transaction_isolation, 'repeatable read')
  await client.end()
})
