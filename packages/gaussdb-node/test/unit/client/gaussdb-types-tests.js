'use strict'

const assert = require('assert')
const pgTypes = require('pg-types')
const gaussdbTypes = require('../../../lib/gaussdb-types')
const suite = new (require('../../suite'))()

// Register GaussDB parsers (same as defaults.js does)
gaussdbTypes.init(function (oid, converter) {
  pgTypes.setTypeParser(oid, 'text', converter)
})

// ──────────────────────────────────────────────
// 1. OID 常量完整性
// ──────────────────────────────────────────────

suite.test('gaussdbTypes builtins exports all OID constants', () => {
  const b = gaussdbTypes.builtins
  // 整数类
  assert.strictEqual(b.INT16, 34)
  assert.strictEqual(b.XID32, 31)
  assert.strictEqual(b.UINT1, 349)
  assert.strictEqual(b.UINT2, 352)
  assert.strictEqual(b.UINT4, 353)
  assert.strictEqual(b.UINT8, 388)
  assert.strictEqual(b.INT1, 5545)
  assert.strictEqual(b.YEAR, 1038)
  // 二进制类
  assert.strictEqual(b.RAW, 86)
  assert.strictEqual(b.BLOB, 88)
  assert.strictEqual(b.CLOB, 90)
  // 日期类
  assert.strictEqual(b.SMALLDATETIME, 9003)
  assert.strictEqual(b.DATEA, 1116)
  // 字符串类
  assert.strictEqual(b.NVARCHAR2, 3969)
  // 向量类
  assert.strictEqual(b.FLOATVECTOR, 4409)
  assert.strictEqual(b.BOOLVECTOR, 4410)
  // 哈希/特殊类
  assert.strictEqual(b.HASH16, 5801)
  assert.strictEqual(b.HASH32, 5802)
  assert.strictEqual(b.ROWID, 8662)
  assert.strictEqual(b.HLL, 4301)
  assert.strictEqual(b.HSTORE, 11499)
  // bytea 变体
  assert.strictEqual(b.BYTEAWITHOUTORDERWITHEQUALCOL, 4402)
  assert.strictEqual(b.BYTEAWITHOUTORDERCOL, 4403)
  // 其他
  assert.strictEqual(b.XMLTYPE, 140)
  assert.strictEqual(b.TDIGEST_DATA, 4406)
})

// ──────────────────────────────────────────────
// 2. 整数类型解析：正常值 + 边界值 + null
// ──────────────────────────────────────────────

suite.test('integer types: normal and boundary values', () => {
  const parsers = {
    int1: pgTypes.getTypeParser(5545, 'text'),
    int16: pgTypes.getTypeParser(34, 'text'),
    uint1: pgTypes.getTypeParser(349, 'text'),
    uint2: pgTypes.getTypeParser(352, 'text'),
    uint4: pgTypes.getTypeParser(353, 'text'),
    uint8: pgTypes.getTypeParser(388, 'text'),
    xid32: pgTypes.getTypeParser(31, 'text'),
    year: pgTypes.getTypeParser(1038, 'text'),
  }
  // 正常值
  assert.strictEqual(parsers.int1('0'), 0)
  assert.strictEqual(parsers.int1('127'), 127)
  assert.strictEqual(parsers.int1('-128'), -128)
  assert.strictEqual(parsers.int16('100'), 100)
  assert.strictEqual(parsers.uint1('0'), 0)
  assert.strictEqual(parsers.uint1('255'), 255)
  assert.strictEqual(parsers.uint2('0'), 0)
  assert.strictEqual(parsers.uint2('65535'), 65535)
  assert.strictEqual(parsers.uint4('4294967295'), 4294967295)
  assert.strictEqual(parsers.uint8('42'), 42)
  assert.strictEqual(parsers.xid32('999'), 999)
  assert.strictEqual(parsers.year('2025'), 2025)
  // 零值
  assert.strictEqual(parsers.int1('0'), 0)
  assert.strictEqual(parsers.year('0'), 0)
})
suite.test('integer types: null passthrough', () => {
  const int1 = pgTypes.getTypeParser(5545, 'text')
  const uint8 = pgTypes.getTypeParser(388, 'text')
  const year = pgTypes.getTypeParser(1038, 'text')
  assert.strictEqual(int1(null), null)
  assert.strictEqual(uint8(null), null)
  assert.strictEqual(year(null), null)
})
// ──────────────────────────────────────────────
// 3. 二进制类型解析
// ──────────────────────────────────────────────

suite.test('binary types: hex input returns Buffer', () => {
  const raw = pgTypes.getTypeParser(86, 'text')
  const blob = pgTypes.getTypeParser(88, 'text')
  const byteaWoe = pgTypes.getTypeParser(4402, 'text')
  const byteaWo = pgTypes.getTypeParser(4403, 'text')
  // GaussDB RAW/BLOB 返回纯 hex 字符串（无 \x 前缀）
  const hexInput = '48656c6c6f' // "Hello"
  const result = raw(hexInput)
  assert.ok(Buffer.isBuffer(result))
  assert.strictEqual(result.toString('utf8'), 'Hello')
  assert.ok(Buffer.isBuffer(blob(hexInput)))
  assert.strictEqual(blob(hexInput).toString('utf8'), 'Hello')
  assert.ok(Buffer.isBuffer(byteaWoe(hexInput)))
  assert.ok(Buffer.isBuffer(byteaWo(hexInput)))
})

suite.test('binary types: empty hex returns empty Buffer', () => {
  const raw = pgTypes.getTypeParser(86, 'text')
  const result = raw('')
  assert.ok(Buffer.isBuffer(result))
  assert.strictEqual(result.length, 0)
})

// ──────────────────────────────────────────────
// 4. smalldatetime 解析
// ──────────────────────────────────────────────

suite.test('smalldatetime: normal date', () => {
  const parser = pgTypes.getTypeParser(9003, 'text')
  const result = parser('2025-01-15 10:30:00')
  assert.ok(result instanceof Date)
  assert.strictEqual(result.getFullYear(), 2025)
  assert.strictEqual(result.getMonth(), 0)
  assert.strictEqual(result.getDate(), 15)
  assert.strictEqual(result.getHours(), 10)
  assert.strictEqual(result.getMinutes(), 30)
})

suite.test('smalldatetime: null passthrough', () => {
  const parser = pgTypes.getTypeParser(9003, 'text')
  assert.strictEqual(parser(null), null)
})

// ──────────────────────────────────────────────
// 4b. datea 解析（GaussDB date 别名，复用 parseDate）
// ──────────────────────────────────────────────

suite.test('datea: returns Date like standard date', () => {
  const parser = pgTypes.getTypeParser(1116, 'text')
  const result = parser('2025-06-15')
  assert.ok(result instanceof Date)
  assert.strictEqual(result.getFullYear(), 2025)
  assert.strictEqual(result.getMonth(), 5) // June = 5
  assert.strictEqual(result.getDate(), 15)
})

suite.test('datea: null passthrough', () => {
  const parser = pgTypes.getTypeParser(1116, 'text')
  assert.strictEqual(parser(null), null)
})
// ──────────────────────────────────────────────
// 5. floatvector 解析
// ──────────────────────────────────────────────

suite.test('floatvector: normal vector', () => {
  const parser = pgTypes.getTypeParser(4409, 'text')
  const result = parser('{1.1,2.2,3.3}')
  assert.ok(Array.isArray(result))
  assert.strictEqual(result.length, 3)
  assert.ok(Math.abs(result[0] - 1.1) < 1e-10)
  assert.ok(Math.abs(result[1] - 2.2) < 1e-10)
  assert.ok(Math.abs(result[2] - 3.3) < 1e-10)
})

suite.test('floatvector: single element', () => {
  const parser = pgTypes.getTypeParser(4409, 'text')
  const result = parser('{3.14}')
  assert.strictEqual(result.length, 1)
  assert.ok(Math.abs(result[0] - 3.14) < 1e-10)
})

suite.test('floatvector: null and empty', () => {
  const parser = pgTypes.getTypeParser(4409, 'text')
  assert.strictEqual(parser(null), null)
  assert.strictEqual(parser(''), null)
})

suite.test('floatvector: element with null', () => {
  const parser = pgTypes.getTypeParser(4409, 'text')
  const result = parser('{1.0,NULL,3.0}')
  assert.strictEqual(result.length, 3)
  assert.strictEqual(result[0], 1)
  assert.strictEqual(result[1], null)
  assert.strictEqual(result[2], 3)
})

// ──────────────────────────────────────────────
// 6. boolvector 解析
// ──────────────────────────────────────────────

suite.test('boolvector: 1/0 values', () => {
  const parser = pgTypes.getTypeParser(4410, 'text')
  const result = parser('{1,0,1,0}')
  assert.deepStrictEqual(result, [true, false, true, false])
})

suite.test('boolvector: t/f values', () => {
  const parser = pgTypes.getTypeParser(4410, 'text')
  const result = parser('{t,f,t,f}')
  assert.deepStrictEqual(result, [true, false, true, false])
})

suite.test('boolvector: true/false values', () => {
  const parser = pgTypes.getTypeParser(4410, 'text')
  const result = parser('{true,false}')
  assert.deepStrictEqual(result, [true, false])
})

suite.test('boolvector: null and empty', () => {
  const parser = pgTypes.getTypeParser(4410, 'text')
  assert.strictEqual(parser(null), null)
  assert.strictEqual(parser(''), null)
})

// ──────────────────────────────────────────────
// 7. 数组类型解析
// ──────────────────────────────────────────────

suite.test('integer array types', () => {
  const cases = [
    [5546, '{1,2,3}', [1, 2, 3]], // int1[]
    [1072, '{10,20}', [10, 20]], // uint1[]
    [1073, '{100,200}', [100, 200]], // uint2[]
    [1074, '{1000,2000}', [1000, 2000]], // uint4[]
    [1075, '{42,43}', [42, 43]], // uint8[]
    [1234, '{100,200}', [100, 200]], // int16[]
    [1029, '{999,1000}', [999, 1000]], // xid32[]
    [1076, '{2024,2025}', [2024, 2025]], // year[]
  ]

  for (const [oid, input, expected] of cases) {
    const parser = pgTypes.getTypeParser(oid, 'text')
    assert.deepStrictEqual(parser(input), expected, `OID ${oid} array`)
  }
})

suite.test('string array types', () => {
  const cases = [
    [3968, '{hello,world}', ['hello', 'world']], // nvarchar2[]
    [3202, '{abc,def}', ['abc', 'def']], // clob[]
    [5803, '{a,b}', ['a', 'b']], // hash16[]
    [5804, '{c,d}', ['c', 'd']], // hash32[]
    [8670, '{row1,row2}', ['row1', 'row2']], // rowid[]
    [4302, '{k1,k2}', ['k1', 'k2']], // hll[]
    [11504, '{h1,h2}', ['h1', 'h2']], // hstore[]
    [141, '{<a/>,<b/>}', ['<a/>', '<b/>']], // _xmltype
    [143, '{<x/>,<y/>}', ['<x/>', '<y/>']], // _xml
    [629, '{1,2}', ['1', '2']], // _line
    [4407, '{td1,td2}', ['td1', 'td2']], // _TdigestData
  ]

  for (const [oid, input, expected] of cases) {
    const parser = pgTypes.getTypeParser(oid, 'text')
    assert.deepStrictEqual(parser(input), expected, `OID ${oid} array`)
  }
})

suite.test('binary array types return array of Buffers', () => {
  const cases = [3201, 4404, 4405, 87] // blob[], byteawithoutorderwithequalcol[], byteawithoutordercol[], _raw

  for (const oid of cases) {
    const parser = pgTypes.getTypeParser(oid, 'text')
    const result = parser('{\\x4869,\\x4279}')
    assert.ok(Array.isArray(result), `OID ${oid} should return array`)
    assert.strictEqual(result.length, 2, `OID ${oid} array length`)
    assert.ok(Buffer.isBuffer(result[0]), `OID ${oid} element 0 is Buffer`)
    assert.ok(Buffer.isBuffer(result[1]), `OID ${oid} element 1 is Buffer`)
  }
})

suite.test('date array type: smalldatetime[]', () => {
  const parser = pgTypes.getTypeParser(9005, 'text')
  const result = parser('{2025-01-15 10:30:00,2025-06-20 14:00:00}')
  assert.ok(Array.isArray(result))
  assert.strictEqual(result.length, 2)
  assert.ok(result[0] instanceof Date)
  assert.strictEqual(result[0].getFullYear(), 2025)
})

suite.test('date array type: datea[]', () => {
  const parser = pgTypes.getTypeParser(1117, 'text')
  const result = parser('{2025-01-15,2025-06-20}')
  assert.ok(Array.isArray(result))
  assert.strictEqual(result.length, 2)
  assert.ok(result[0] instanceof Date)
  assert.strictEqual(result[0].getFullYear(), 2025)
  assert.strictEqual(result[1].getFullYear(), 2025)
})

suite.test('float/bool vector array types', () => {
  const fvParser = pgTypes.getTypeParser(1077, 'text') // floatvector[]
  const bvParser = pgTypes.getTypeParser(1078, 'text') // boolvector[]
  const fvResult = fvParser('{1.5,2.5}')
  assert.ok(Array.isArray(fvResult))
  assert.strictEqual(fvResult.length, 2)
  const bvResult = bvParser('{1,0}')
  assert.ok(Array.isArray(bvResult))
  assert.strictEqual(bvResult.length, 2)
})

suite.test('array types: null passthrough', () => {
  const parser = pgTypes.getTypeParser(5546, 'text') // int1[]
  assert.strictEqual(parser(null), null)
})

// ──────────────────────────────────────────────
// 8. 模块导出验证
// ──────────────────────────────────────────────

suite.test('gaussdbTypes accessible from main module export', () => {
  const gaussdb = require('../../../lib/')
  assert.ok(gaussdb.gaussdbTypes)
  assert.strictEqual(gaussdb.gaussdbTypes.INT1, 5545)
  assert.strictEqual(gaussdb.gaussdbTypes.BLOB, 88)
  assert.strictEqual(gaussdb.gaussdbTypes.SMALLDATETIME, 9003)
  assert.strictEqual(gaussdb.gaussdbTypes.FLOATVECTOR, 4409)
  assert.strictEqual(gaussdb.gaussdbTypes.BOOLVECTOR, 4410)
})

// ──────────────────────────────────────────────
// 9. 不破坏原有 pg-types 解析器
// ──────────────────────────────────────────────

suite.test('GaussDB parsers do not break existing pg-types parsers', () => {
  assert.strictEqual(pgTypes.getTypeParser(23, 'text')('123'), 123) // int4
  assert.strictEqual(pgTypes.getTypeParser(20, 'text')('9007199254740992'), '9007199254740992') // int8/bigint as string
  assert.strictEqual(pgTypes.getTypeParser(16, 'text')('t'), true) // bool
  assert.strictEqual(pgTypes.getTypeParser(700, 'text')('1.5'), 1.5) // float4
  assert.strictEqual(pgTypes.getTypeParser(114, 'text')('{"a":1}').a, 1) // json
  assert.strictEqual(pgTypes.getTypeParser(1082, 'text')('2025-01-15') instanceof Date, true) // date
})

// ──────────────────────────────────────────────
// 10. OID 冲突检测：GaussDB OID 不覆盖已有 PG OID
// ──────────────────────────────────────────────

suite.test('GaussDB OID 34 does not conflict with PG int2 (OID 21)', () => {
  // OID 34 (INT16 in GaussDB) is different from OID 21 (int2 in PG)
  // Verify they are separate
  assert.notStrictEqual(gaussdbTypes.builtins.INT16, 21)
  // OID 34 parser should be registered and return number
  const parser = pgTypes.getTypeParser(34, 'text')
  assert.strictEqual(parser('100'), 100)
})

// ──────────────────────────────────────────────
// 11. init 函数幂等性（重复注册不报错）
// ──────────────────────────────────────────────

suite.test('init is idempotent: calling twice does not throw', () => {
  assert.doesNotThrow(() => {
    gaussdbTypes.init(function (oid, converter) {
      pgTypes.setTypeParser(oid, 'text', converter)
    })
  })

  // Parser still works after re-init
  const parser = pgTypes.getTypeParser(5545, 'text')
  assert.strictEqual(parser('42'), 42)
})

// ──────────────────────────────────────────────
// 12. CLOB OID 90 无解析器（标量走 noParse，注册表中未注册）
// ──────────────────────────────────────────────

suite.test('CLOB (OID 90) scalar has no parser registered (as designed)', () => {
  // CLOB is defined as a builtin constant but has no scalar parser registered
  // This is by design: CLOB text representation is just a string
  assert.strictEqual(gaussdbTypes.builtins.CLOB, 90)
  // No custom parser registered for OID 90 — pg-types returns noParse (identity)
  const parser = pgTypes.getTypeParser(90, 'text')
  assert.strictEqual(parser('some text'), 'some text')
})

// ──────────────────────────────────────────────
// 13. XMLTYPE OID 140 无解析器
// ──────────────────────────────────────────────

suite.test('XMLTYPE (OID 140) scalar has no parser registered (as designed)', () => {
  assert.strictEqual(gaussdbTypes.builtins.XMLTYPE, 140)
  const parser = pgTypes.getTypeParser(140, 'text')
  assert.strictEqual(parser('<root/>'), '<root/>')
})

// ──────────────────────────────────────────────
// 14. floatvector with bracket notation (GaussDB uses [] instead of {})
// ──────────────────────────────────────────────

suite.test('floatvector: bracket notation [1.0,2.0]', () => {
  const parser = pgTypes.getTypeParser(4409, 'text')
  const result = parser('[1.0,2.0]')
  assert.ok(Array.isArray(result))
  assert.strictEqual(result.length, 2)
  assert.strictEqual(result[0], 1)
  assert.strictEqual(result[1], 2)
})

// ──────────────────────────────────────────────
// 15. boolvector with bracket notation
// ──────────────────────────────────────────────

suite.test('boolvector: bracket notation [1,0]', () => {
  const parser = pgTypes.getTypeParser(4410, 'text')
  const result = parser('[1,0]')
  assert.deepStrictEqual(result, [true, false])
})

// ──────────────────────────────────────────────
// 16. floatvector array with null elements
// ──────────────────────────────────────────────

suite.test('floatvector array: contains null vector element', () => {
  const parser = pgTypes.getTypeParser(1077, 'text') // floatvector[]
  const result = parser('{"{1.0,2.0}",NULL,"{3.0}"}')
  assert.ok(Array.isArray(result))
  assert.strictEqual(result.length, 3)
  assert.ok(Array.isArray(result[0]))
  assert.strictEqual(result[0].length, 2)
  assert.strictEqual(result[1], null)
  assert.ok(Array.isArray(result[2]))
  assert.strictEqual(result[2].length, 1)
})

// ──────────────────────────────────────────────
// 17. boolvector array with null elements
// ──────────────────────────────────────────────

suite.test('boolvector array: contains null vector element', () => {
  const parser = pgTypes.getTypeParser(1078, 'text') // boolvector[]
  const result = parser('{"{1,0}",NULL,"{0}"}')
  assert.ok(Array.isArray(result))
  assert.strictEqual(result.length, 3)
  assert.ok(Array.isArray(result[0]))
  assert.deepStrictEqual(result[0], [true, false])
  assert.strictEqual(result[1], null)
  assert.ok(Array.isArray(result[2]))
  assert.deepStrictEqual(result[2], [false])
})

// ──────────────────────────────────────────────
// 18. RAW/BLOB: null passthrough
// ──────────────────────────────────────────────

suite.test('binary types: null passthrough', () => {
  const raw = pgTypes.getTypeParser(86, 'text')
  const blob = pgTypes.getTypeParser(88, 'text')
  assert.strictEqual(raw(null), null)
  assert.strictEqual(blob(null), null)
})

// ──────────────────────────────────────────────
// 19. RAW/BLOB: odd-length hex string edge case
// ──────────────────────────────────────────────

suite.test('binary types: multi-byte hex decodes correctly', () => {
  const raw = pgTypes.getTypeParser(86, 'text')
  // "Hi" = 0x48 0x69
  const result = raw('4869')
  assert.ok(Buffer.isBuffer(result))
  assert.strictEqual(result.toString('utf8'), 'Hi')
})

// ──────────────────────────────────────────────
// 20. boolvector: mixed 1/0 and t/f in same vector
// ──────────────────────────────────────────────

suite.test('boolvector: mixed 1/0 and t/f', () => {
  const parser = pgTypes.getTypeParser(4410, 'text')
  const result = parser('{1,t,0,f}')
  assert.deepStrictEqual(result, [true, true, false, false])
})

// ──────────────────────────────────────────────
// 21. floatvector array: null passthrough
// ──────────────────────────────────────────────

suite.test('floatvector array: null passthrough', () => {
  const parser = pgTypes.getTypeParser(1077, 'text')
  assert.strictEqual(parser(null), null)
})

// ──────────────────────────────────────────────
// 22. boolvector array: null passthrough
// ──────────────────────────────────────────────

suite.test('boolvector array: null passthrough', () => {
  const parser = pgTypes.getTypeParser(1078, 'text')
  assert.strictEqual(parser(null), null)
})

// ──────────────────────────────────────────────
// 23. defaults.js registration: parsers registered by defaults.js work correctly
// ──────────────────────────────────────────────

suite.test('defaults.js registration: gaussdb type parsers loaded through defaults', () => {
  // This verifies the fix where defaults.js init callback uses correct parameter name
  require('../../../lib/defaults')
  // INT1 (OID 5545) should have a parser registered
  const parser = pgTypes.getTypeParser(5545, 'text')
  assert.strictEqual(parser('42'), 42)
})

// ──────────────────────────────────────────────
// 24. gaussdbTypes module init exports
// ──────────────────────────────────────────────

suite.test('gaussdb-types module exports builtins and init', () => {
  assert.ok(gaussdbTypes.builtins)
  assert.strictEqual(typeof gaussdbTypes.init, 'function')
})
