const helper = require('../test-helper')
const suite = new helper.Suite()

suite.testAsync('timeout causing query crashes', async () => {
  const client = new helper.Client()
  await client.connect()
  await client.query('CREATE TEMP TABLE foobar( name TEXT NOT NULL, id INTEGER PRIMARY KEY)')
  await client.query('BEGIN')
  await client.query("SET LOCAL statement_timeout TO '1ms'")
  let count = 0
  let idCounter = 1
  while (count++ < 5000) {
    try {
      await client.query('INSERT INTO foobar(id, name) VALUES ($1, $2)', [idCounter++, Math.random() * 1000 + ''])
    } catch (e) {
      await client.query('ROLLBACK')
      break
    }
  }
  await client.end()
})
