'use strict'
// const helper = require('./test-helper')
// const assert = require('assert')

// SKIP: 不支持 临时表Serial
// https://github.com/HuaweiCloudDeveloper/gaussdb-drivers/blob/master-dev/diff-gaussdb-postgres.md#%E4%B8%8D%E6%94%AF%E6%8C%81-%E4%B8%B4%E6%97%B6%E8%A1%A8serial

/*
const pool = new helper.gaussdb.Pool()
pool.connect(
  assert.success(function (client, done) {
    helper.versionGTE(
      client,
      90200,
      assert.success(function (jsonSupported) {
        if (!jsonSupported) {
          console.log('skip json test on older versions of postgres')
          done()
          return pool.end()
        }
        client.query('CREATE TEMP TABLE stuff(id SERIAL PRIMARY KEY, data JSON)')
        const value = { name: 'Brian', age: 250, alive: true, now: new Date() }
        client.query('INSERT INTO stuff (data) VALUES ($1)', [value])
        client.query(
          'SELECT * FROM stuff',
          assert.success(function (result) {
            assert.equal(result.rows.length, 1)
            assert.equal(typeof result.rows[0].data, 'object')
            const row = result.rows[0].data
            assert.strictEqual(row.name, value.name)
            assert.strictEqual(row.age, value.age)
            assert.strictEqual(row.alive, value.alive)
            assert.equal(JSON.stringify(row.now), JSON.stringify(value.now))
            done()
            pool.end()
          })
        )
      })
    )
  })
)
*/
