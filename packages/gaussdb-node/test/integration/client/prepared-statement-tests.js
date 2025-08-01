'use strict'
const helper = require('./test-helper')
const Query = helper.gaussdb.Query

const assert = require('assert')
const suite = new helper.Suite()

;(function () {
  const client = helper.client()
  client.on('drain', client.end.bind(client))

  const queryName = 'user by age and like name'

  suite.test('first named prepared statement', function (done) {
    const query = client.query(
      new Query({
        text: 'select name from person where age <= $1 and name LIKE $2',
        values: [20, 'Bri%'],
        name: queryName,
      })
    )

    assert.emits(query, 'row', function (row) {
      assert.equal(row.name, 'Brian')
    })

    query.on('end', () => done())
  })

  suite.test('second named prepared statement with same name & text', function (done) {
    const cachedQuery = client.query(
      new Query({
        text: 'select name from person where age <= $1 and name LIKE $2',
        name: queryName,
        values: [10, 'A%'],
      })
    )

    assert.emits(cachedQuery, 'row', function (row) {
      assert.equal(row.name, 'Aaron')
    })

    cachedQuery.on('end', () => done())
  })

  suite.test('with same name, but without query text', function (done) {
    const q = client.query(
      new Query({
        name: queryName,
        values: [30, '%n%'],
      })
    )

    assert.emits(q, 'row', function (row) {
      assert.equal(row.name, 'Aaron')

      // test second row is emitted as well
      assert.emits(q, 'row', function (row) {
        assert.equal(row.name, 'Brian')
      })
    })

    q.on('end', () => done())
  })

  suite.test('with same name, but with different text', function (done) {
    client.query(
      new Query({
        text: 'select name from person where age >= $1 and name LIKE $2',
        name: queryName,
        values: [30, '%n%'],
      }),
      assert.calls((err) => {
        assert.equal(
          err.message,
          `Prepared statements must be unique - '${queryName}' was used for a different statement`
        )
        done()
      })
    )
  })
})()
;(function () {
  const statementName = 'differ'
  const statement1 = 'select count(*)::int4 as count from person'
  const statement2 = 'select count(*)::int4 as count from person where age < $1'

  const client1 = helper.client()
  const client2 = helper.client()

  suite.test('client 1 execution', function (done) {
    client1.query(
      {
        name: statementName,
        text: statement1,
      },
      (err, res) => {
        assert(!err)
        assert.equal(res.rows[0].count, 26)
        done()
      }
    )
  })

  suite.test('client 2 execution', function (done) {
    const query = client2.query(
      new Query({
        name: statementName,
        text: statement2,
        values: [11],
      })
    )

    assert.emits(query, 'row', function (row) {
      assert.equal(row.count, 1)
    })

    assert.emits(query, 'end', function () {
      done()
    })
  })

  suite.test('clean up clients', () => {
    return client1.end().then(() => client2.end())
  })
})()
;(function () {
  const client = helper.client()
  client.query('CREATE TEMP TABLE zoom(name varchar(100));')
  client.query("INSERT INTO zoom (name) VALUES ('zed')")
  client.query("INSERT INTO zoom (name) VALUES ('gaussdb-node')")
  client.query("INSERT INTO zoom (name) VALUES ('node gaussdb')")

  const checkForResults = function (q) {
    assert.emits(q, 'row', function (row) {
      assert.equal(row.name, 'gaussdb-node')

      assert.emits(q, 'row', function (row) {
        assert.equal(row.name, 'node gaussdb')

        assert.emits(q, 'row', function (row) {
          assert.equal(row.name, 'zed')
        })
      })
    })
  }

  suite.test('with small row count', function (done) {
    const query = client.query(
      new Query(
        {
          name: 'get names',
          text: 'SELECT name FROM zoom ORDER BY name COLLATE "C"',
          rows: 1,
        },
        done
      )
    )

    checkForResults(query)
  })

  suite.test('with large row count', function (done) {
    const query = client.query(
      new Query(
        {
          name: 'get names',
          text: 'SELECT name FROM zoom ORDER BY name COLLATE "C"',
          rows: 1000,
        },
        done
      )
    )
    checkForResults(query)
  })

  suite.testAsync('with no data response and rows', async function () {
    const result = await client.query({
      name: 'some insert',
      text: '',
      values: [],
      rows: 1,
    })
    assert.equal(result.rows.length, 0)
  })

  suite.test('cleanup', () => client.end())
})()
