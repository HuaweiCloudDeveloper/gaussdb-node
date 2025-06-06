'use strict'
const helper = require('../test-helper')
const gaussdb = helper.gaussdb
const assert = require('assert')

const suite = new helper.Suite()

suite.test('null and undefined are both inserted as NULL', function (done) {
  const pool = new gaussdb.Pool()
  pool.connect(
    assert.calls(function (err, client, release) {
      assert(!err)
      client.query('CREATE TEMP TABLE my_nulls(a varchar(1), b varchar(1), c integer, d integer, e date, f date)')
      client.query('INSERT INTO my_nulls(a,b,c,d,e,f) VALUES ($1,$2,$3,$4,$5,$6)', [
        null,
        undefined,
        null,
        undefined,
        null,
        undefined,
      ])
      client.query(
        'SELECT * FROM my_nulls',
        assert.calls(function (err, result) {
          console.log(err)
          assert.ifError(err)
          assert.equal(result.rows.length, 1)
          assert.isNull(result.rows[0].a)
          assert.isNull(result.rows[0].b)
          assert.isNull(result.rows[0].c)
          assert.isNull(result.rows[0].d)
          assert.isNull(result.rows[0].e)
          assert.isNull(result.rows[0].f)
          pool.end(done)
          release()
        })
      )
    })
  )
})

suite.test('pool callback behavior', (done) => {
  // test weird callback behavior with node-pool
  const pool = new gaussdb.Pool()
  pool.connect(function (err) {
    assert(!err)
    arguments[1].emit('drain')
    arguments[2]()
    pool.end(done)
  })
})

suite.test('query timeout', (cb) => {
  const pool = new gaussdb.Pool({ query_timeout: 1000 })
  pool.connect().then((client) => {
    client.query(
      'SELECT pg_sleep(2)',
      assert.calls(function (err, result) {
        assert(err)
        assert(err.message === 'Query read timeout')
        client.release()
        pool.end(cb)
      })
    )
  })
})

suite.test('query recover from timeout', (cb) => {
  const pool = new gaussdb.Pool({ query_timeout: 1000 })
  pool.connect().then((client) => {
    // TODO: there is no function named `gaussdb_sleep` in GaussDB, so we use `pg_sleep` instead.
    client.query(
      'SELECT pg_sleep(20)',
      assert.calls(function (err, result) {
        assert(err)
        assert(err.message === 'Query read timeout')
        client.release(err)
        pool.connect().then((client) => {
          client.query(
            'SELECT 1',
            assert.calls(function (err, result) {
              assert(!err)
              client.release(err)
              pool.end(cb)
            })
          )
        })
      })
    )
  })
})

suite.test('query no timeout', (cb) => {
  const pool = new gaussdb.Pool({ query_timeout: 10000 })
  pool.connect().then((client) => {
    client.query(
      'SELECT pg_sleep(1)',
      assert.calls(function (err, result) {
        assert(!err)
        client.release()
        pool.end(cb)
      })
    )
  })
})

suite.test('query with timeout on query basis', (cb) => {
  const pool = new gaussdb.Pool()
  pool.connect().then((client) => {
    client.query(
      { text: 'SELECT pg_sleep(20)', query_timeout: 1000 },
      assert.calls(function (err, result) {
        assert(err)
        assert(err.message === 'Query read timeout')
        client.release()
        pool.end(cb)
      })
    )
  })
})

suite.test('callback API', (done) => {
  const client = new helper.Client()
  client.query('CREATE TEMP TABLE peep(name text)')
  client.query('INSERT INTO peep(name) VALUES ($1)', ['brianc'])
  const config = {
    text: 'INSERT INTO peep(name) VALUES ($1)',
    values: ['brian'],
  }
  client.query(config)
  client.query('INSERT INTO peep(name) VALUES ($1)', ['aaron'])

  client.query('SELECT * FROM peep ORDER BY name COLLATE "C"', (err, res) => {
    assert(!err)
    assert.equal(res.rowCount, 3)
    assert.deepEqual(res.rows, [
      {
        name: 'aaron',
      },
      {
        name: 'brian',
      },
      {
        name: 'brianc',
      },
    ])
    done()
  })
  client.connect((err) => {
    assert(!err)
    client.once('drain', () => client.end())
  })
})

suite.test('executing nested queries', function (done) {
  const pool = new gaussdb.Pool()
  pool.connect(
    assert.calls(function (err, client, release) {
      assert(!err)
      client.query(
        'select now as now from NOW()',
        assert.calls(function (err, result) {
          assert.equal(new Date().getYear(), result.rows[0].now.getYear())
          client.query(
            'select now as now_again FROM NOW()',
            assert.calls(function () {
              client.query(
                'select * FROM NOW()',
                assert.calls(function () {
                  assert.ok('all queries hit')
                  release()
                  pool.end(done)
                })
              )
            })
          )
        })
      )
    })
  )
})

suite.test('raises error if cannot connect', function () {
  const connectionString = 'gaussdb://sfalsdkf:asdf@localhost/ieieie'
  const pool = new gaussdb.Pool({ connectionString: connectionString })
  pool.connect(
    assert.calls(function (err, client, done) {
      assert.ok(err, 'should have raised an error')
      done()
    })
  )
})

suite.test('query errors are handled and do not bubble if callback is provided', function (done) {
  const pool = new gaussdb.Pool()
  pool.connect(
    assert.calls(function (err, client, release) {
      assert(!err)
      client.query(
        'SELECT OISDJF FROM LEIWLISEJLSE',
        assert.calls(function (err, result) {
          assert.ok(err)
          release()
          pool.end(done)
        })
      )
    })
  )
})

suite.test('callback is fired once and only once', function (done) {
  const pool = new gaussdb.Pool()
  pool.connect(
    assert.calls(function (err, client, release) {
      assert(!err)
      client.query('CREATE TEMP TABLE boom(name varchar(10))')
      let callCount = 0
      client.query(
        [
          "INSERT INTO boom(name) VALUES('hai')",
          "INSERT INTO boom(name) VALUES('boom')",
          "INSERT INTO boom(name) VALUES('zoom')",
        ].join(';'),
        function (err, callback) {
          assert.equal(callCount++, 0, 'Call count should be 0.  More means this callback fired more than once.')
          release()
          pool.end(done)
        }
      )
    })
  )
})

suite.test('can provide callback and config object', function (done) {
  const pool = new gaussdb.Pool()
  pool.connect(
    assert.calls(function (err, client, release) {
      assert(!err)
      client.query(
        {
          name: 'boom',
          text: 'select NOW()',
        },
        assert.calls(function (err, result) {
          assert(!err)
          assert.equal(result.rows[0].now.getYear(), new Date().getYear())
          release()
          pool.end(done)
        })
      )
    })
  )
})

suite.test('can provide callback and config and parameters', function (done) {
  const pool = new gaussdb.Pool()
  pool.connect(
    assert.calls(function (err, client, release) {
      assert(!err)
      const config = {
        text: 'select $1::text as val',
      }
      client.query(
        config,
        ['hi'],
        assert.calls(function (err, result) {
          assert(!err)
          assert.equal(result.rows.length, 1)
          assert.equal(result.rows[0].val, 'hi')
          release()
          pool.end(done)
        })
      )
    })
  )
})
