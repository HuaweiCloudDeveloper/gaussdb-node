// const helper = require('../test-helper')
// const suite = new helper.Suite()

// SKIP: 不支持 临时表Serial
// https://github.com/HuaweiCloudDeveloper/gaussdb-drivers/blob/master-dev/diff-gaussdb-postgres.md#%E4%B8%8D%E6%94%AF%E6%8C%81-%E4%B8%B4%E6%97%B6%E8%A1%A8serial

/*
suite.testAsync('timeout causing query crashes', async () => {
  const client = new helper.Client()
  await client.connect()
  await client.query('CREATE TEMP TABLE foobar( name TEXT NOT NULL, id SERIAL)')
  await client.query('BEGIN')
  await client.query("SET LOCAL statement_timeout TO '1ms'")
  let count = 0
  while (count++ < 5000) {
    try {
      await client.query('INSERT INTO foobar(name) VALUES ($1)', [Math.random() * 1000 + ''])
    } catch (e) {
      await client.query('ROLLBACK')
    }
  }
  await client.end()
})
*/
