import assert from 'node:assert'
import { describe, it } from 'node:test'
import { parse, toClientConfig, parseIntoClientConfig } from 'gaussdb-connection-string'

describe('gaussdb-connection-string', () => {
  it('should export parse function', () => {
    assert.strictEqual(typeof parse, 'function')
  })

  it('should export toClientConfig function', () => {
    assert.strictEqual(typeof toClientConfig, 'function')
  })

  it('should export parseIntoClientConfig function', () => {
    assert.strictEqual(typeof parseIntoClientConfig, 'function')
  })
})
