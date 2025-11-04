'use strict'
const helper = require('./test-helper')
const suite = new helper.Suite()
const assert = require('assert')

suite.test('json type parsing', function (done) {
  const client = helper.client()

  // Check if JSON is supported
  client.query('SHOW server_version_num', function (err, versionResult) {
    if (err) {
      done(err)
      return
    }

    const versionNum = parseInt(versionResult.rows[0].server_version_num)
    if (versionNum < 90200) {
      console.log('skip json test on older versions of postgres')
      client.end()
      done()
      return
    }

    client.query('CREATE TEMP TABLE stuff(id INTEGER PRIMARY KEY, data JSON)', function (err) {
      if (err) {
        done(err)
        return
      }

      const value = { name: 'Brian', age: 250, alive: true, now: new Date() }
      client.query('INSERT INTO stuff (id, data) VALUES (1, $1)', [value], function (err) {
        if (err) {
          done(err)
          return
        }

        client.query('SELECT * FROM stuff', function (err, result) {
          if (err) {
            done(err)
            return
          }

          assert.equal(result.rows.length, 1)
          assert.equal(typeof result.rows[0].data, 'object')
          const row = result.rows[0].data
          assert.strictEqual(row.name, value.name)
          assert.strictEqual(row.age, value.age)
          assert.strictEqual(row.alive, value.alive)
          assert.equal(JSON.stringify(row.now), JSON.stringify(value.now))

          client.end()
          done()
        })
      })
    })
  })
})
