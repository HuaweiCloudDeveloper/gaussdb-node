'use strict'
const helper = require('./test-helper')
const Query = require('../../../lib/query')
const assert = require('assert')
const suite = new helper.Suite()
const test = suite.test.bind(suite)

test('executing query', function () {
  test('queing query', function () {
    test('when connection is ready', function () {
      const client = helper.client()
      assert.empty(client.connection.queries)
      client.connection.emit('readyForQuery')
      client.query('yes')
      assert.lengthIs(client.connection.queries, 1)
      assert.equal(client.connection.queries, 'yes')
    })

    test('when connection is not ready', function () {
      const client = helper.client()

      test('query is not sent', function () {
        client.query('boom')
        assert.empty(client.connection.queries)
      })

      test('sends query to connection once ready', function () {
        assert.ok(client.connection.emit('readyForQuery'))
        assert.lengthIs(client.connection.queries, 1)
        assert.equal(client.connection.queries[0], 'boom')
      })
    })

    test('multiple in the queue', function () {
      const client = helper.client()
      const connection = client.connection
      const queries = connection.queries
      client.query('one')
      client.query('two')
      client.query('three')
      assert.empty(queries)

      test('after one ready for query', function () {
        connection.emit('readyForQuery')
        assert.lengthIs(queries, 1)
        assert.equal(queries[0], 'one')
      })

      test('after two ready for query', function () {
        connection.emit('readyForQuery')
        assert.lengthIs(queries, 2)
      })

      test('after a bunch more', function () {
        connection.emit('readyForQuery')
        connection.emit('readyForQuery')
        connection.emit('readyForQuery')
        assert.lengthIs(queries, 3)
        assert.equal(queries[0], 'one')
        assert.equal(queries[1], 'two')
        assert.equal(queries[2], 'three')
      })
    })
  })

  test('query event binding and flow', function () {
    const client = helper.client()
    const con = client.connection
    const query = client.query(new Query('whatever'))

    test('has no queries sent before ready', function () {
      assert.empty(con.queries)
    })

    test('sends query on readyForQuery event', function () {
      con.emit('readyForQuery')
      assert.lengthIs(con.queries, 1)
      assert.equal(con.queries[0], 'whatever')
    })

    test('handles rowDescription message', function () {
      const handled = con.emit('rowDescription', {
        fields: [
          {
            name: 'boom',
          },
        ],
      })
      assert.ok(handled, 'should have handlded rowDescription')
    })

    test('handles dataRow messages', function () {
      assert.emits(query, 'row', function (row) {
        assert.equal(row['boom'], 'hi')
      })

      const handled = con.emit('dataRow', { fields: ['hi'] })
      assert.ok(handled, 'should have handled first data row message')

      assert.emits(query, 'row', function (row) {
        assert.equal(row['boom'], 'bye')
      })

      const handledAgain = con.emit('dataRow', { fields: ['bye'] })
      assert.ok(handledAgain, 'should have handled seciond data row message')
    })

    // multiple command complete messages will be sent
    // when multiple queries are in a simple command
    test('handles command complete messages', function () {
      con.emit('commandComplete', {
        text: 'INSERT 31 1',
      })
    })
  })

  test('handles errors', function () {
    const client = helper.client()

    test('throws an error when config is null', function () {
      try {
        client.query(null, undefined)
      } catch (error) {
        assert.equal(
          error.message,
          'Client was passed a null or undefined query',
          'Should have thrown an Error for null queries'
        )
      }
    })

    test('throws an error when config is undefined', function () {
      try {
        client.query()
      } catch (error) {
        assert.equal(
          error.message,
          'Client was passed a null or undefined query',
          'Should have thrown an Error for null queries'
        )
      }
    })
  })
})
