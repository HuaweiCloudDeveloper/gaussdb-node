const assert = require('node:assert')
const test = require('node:test')
const { describe, it } = test

const paths = [
  'gaussdb',
  'gaussdb/lib/index.js',
  'gaussdb/lib/connection-parameters.js',
  'gaussdb-protocol/dist/messages.js',
  'pg-native/lib/build-result.js',
]
for (const path of paths) {
  describe(`importing ${path}`, () => {
    it('works with require', () => {
      const mod = require(path)
      assert(mod)
    })
  })
}

describe('pg-native', () => {
  it('should work with commonjs', async () => {
    const gaussdb = require('gaussdb')

    const pool = new gaussdb.native.Pool()
    const result = await pool.query('SELECT 1')
    assert.strictEqual(result.rowCount, 1)
    pool.end()
  })
})
