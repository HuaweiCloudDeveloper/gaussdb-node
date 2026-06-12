'use strict'

const array = require('postgres-array')
const pgTypes = require('pg-types')

//GaussDB专属OID常量
const builtins = {
    INT16: 34,
    XID32: 31,
    UINT1: 349,
    UINT2: 352,
    UINT4: 353,
    UINT8: 388,
    INT1: 5545,
    RAW: 86,
    BLOB: 88,
    CLOB: 90,
    SMALLDATETIME: 9003,
    DATEA: 1116,
    YEAR: 1038,
    NVARCHAR2: 3969,
    XMLTYPE: 140,
    HASH16: 5801,
    HASH32: 5802,
    ROWID: 8662,
    FLOATVECTOR: 4409,
    BOOLVECTOR: 4410,
    HLL: 4301,
    HSTORE: 11499,
    BYTEAWITHOUTORDERWITHEQUALCOL: 4402,
    BYTEAWITHOUTORDERCOL: 4403,
    TDIGEST_DATA: 4406,
}

function allowNull(fn) {
    return function (value) {
        if (value == null) return value
        return fn(value)
    }
}

function parseInteger(value) {
    return parseInt(value, 10)
}

//复用pg-typess已有解析器
const parseByteA = pgTypes.getTypeParser(17, 'text')
const parseDate = pgTypes.getTypeParser(1082, 'text')
const parseStringArray = pgTypes.getTypeParser(1009, 'text')
const parseIntegerArray = pgTypes.getTypeParser(1007, 'text')
const parseFloatArray = pgTypes.getTypeParser(1021, 'text')
const parseBoolArray = pgTypes.getTypeParser(1000, 'text')
const parseByteAArray = pgTypes.getTypeParser(1001, 'text')
const parseDateArray = pgTypes.getTypeParser(1115, 'text')

//GaussDB RAW/BLOB返回纯hex字符串
//不同于PG bytea的"\\x48656C6C6F"格式，需要加前缀后才能复用parseByteA
function parseGaussdbRaw(value) {
    if (value === null) return null
    if (value === '') return Buffer.alloc(0)
    return parseByteA('\\x' + value)
}

//GaussDB特有向量解析器
function normalizeVectorFormat(value) {
    if (value[0] === '[') return '{' + value.slice(1, -1) + '}'
    return value
}

function parseFloatVector(value) {
    if (!value) return null
    return array.parse(normalizeVectorFormat(value), allowNull(parseFloat))
}

function parseBoolVector(value) {
    if (!value) return null
    return array.parse(normalizeVectorFormat(value), allowNull(function (v) {return v === '1' || v === 't' || v === 'true'}))
}

function parseFloatVectorArray(value) {
    if (!value) return null
    const strings = parseStringArray(value)
    return strings.map(allowNull(parseFloatVector))
}

function parseBoolVectorArray(value) {
    if (!value) return null
    const strings = parseStringArray(value)
    return strings.map(allowNull(parseBoolVector))
}

var init = function (register) {
    register(34, allowNull(parseInteger))
    register(31, allowNull(parseInteger))
    register(349, allowNull(parseInteger))
    register(352, allowNull(parseInteger))
    register(353, allowNull(parseInteger))
    register(388, allowNull(parseInteger))
    register(5545, allowNull(parseInteger))
    register(1038, allowNull(parseInteger))
    register(86, parseGaussdbRaw)
    register(88, parseGaussdbRaw)
    register(4402, parseGaussdbRaw)
    register(4403, parseGaussdbRaw)
    register(9003, parseDate)
    register(1116, parseDate)
    register(4409, parseFloatVector)
    register(4410, parseBoolVector)
    register(1072, parseIntegerArray)
    register(1073, parseIntegerArray)
    register(1074, parseIntegerArray)
    register(1075, parseIntegerArray)
    register(1234, parseIntegerArray)
    register(5546, parseIntegerArray)
    register(1029, parseIntegerArray)
    register(1076, parseIntegerArray)
    register(3201, parseByteAArray)
    register(4404, parseByteAArray)
    register(4405, parseByteAArray)
    register(9005, parseDateArray)
    register(1117, parseDateArray)
    register(87, parseByteAArray)
    register(3968, parseStringArray)
    register(3202, parseStringArray)
    register(5803, parseStringArray)
    register(5804, parseStringArray)
    register(8670, parseStringArray)
    register(4302, parseStringArray)
    register(11504, parseStringArray)
    register(141, parseStringArray)
    register(143, parseStringArray)
    register(629, parseStringArray)
    register(4407, parseStringArray)
    register(1077, parseFloatVectorArray)
    register(1078, parseBoolVectorArray)
}

module.exports = { builtins, init }