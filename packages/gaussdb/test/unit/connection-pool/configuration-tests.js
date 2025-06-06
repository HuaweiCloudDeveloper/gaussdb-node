'use strict'

const assert = require('assert')
const helper = require('../test-helper')
const suite = new helper.Suite()

suite.test('pool with copied settings includes password', () => {
  const original = new helper.gaussdb.Pool({
    password: 'original',
  })

  const copy = new helper.gaussdb.Pool(original.options)

  assert.equal(copy.options.password, 'original')
})
