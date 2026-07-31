import buffers from './testing/test-buffers'
import BufferList from './testing/buffer-list'
import { parse } from '.'
import assert from 'assert'
import { PassThrough } from 'stream'
import { BackendMessage } from './messages'

const authOkBuffer = buffers.authenticationOk()
const paramStatusBuffer = buffers.parameterStatus('client_encoding', 'UTF8')
const readyForQueryBuffer = buffers.readyForQuery()
const backendKeyDataBuffer = buffers.backendKeyData(1, 2)
const commandCompleteBuffer = buffers.commandComplete('SELECT 3')
const parseCompleteBuffer = buffers.parseComplete()
const bindCompleteBuffer = buffers.bindComplete()
const portalSuspendedBuffer = buffers.portalSuspended()

const row1 = {
  name: 'id',
  tableID: 1,
  attributeNumber: 2,
  dataTypeID: 3,
  dataTypeSize: 4,
  typeModifier: 5,
  formatCode: 0,
}
const oneRowDescBuff = buffers.rowDescription([row1])
row1.name = 'bang'

const twoRowBuf = buffers.rowDescription([
  row1,
  {
    name: 'whoah',
    tableID: 10,
    attributeNumber: 11,
    dataTypeID: 12,
    dataTypeSize: 13,
    typeModifier: 14,
    formatCode: 0,
  },
])

const rowWithBigOids = {
  name: 'bigoid',
  tableID: 3000000001,
  attributeNumber: 2,
  dataTypeID: 3000000003,
  dataTypeSize: 4,
  typeModifier: 5,
  formatCode: 0,
}
const bigOidDescBuff = buffers.rowDescription([rowWithBigOids])

const emptyRowFieldBuf = buffers.dataRow([])

const oneFieldBuf = buffers.dataRow(['test'])

const expectedAuthenticationOkayMessage = {
  name: 'authenticationOk',
  length: 8,
}

const expectedParameterStatusMessage = {
  name: 'parameterStatus',
  parameterName: 'client_encoding',
  parameterValue: 'UTF8',
  length: 25,
}

const expectedBackendKeyDataMessage = {
  name: 'backendKeyData',
  processID: 1,
  secretKey: 2,
}

const expectedReadyForQueryMessage = {
  name: 'readyForQuery',
  length: 5,
  status: 'I',
}

const expectedCommandCompleteMessage = {
  name: 'commandComplete',
  length: 13,
  text: 'SELECT 3',
}
const emptyRowDescriptionBuffer = new BufferList()
  .addInt16(0) // number of fields
  .join(true, 'T')

const expectedEmptyRowDescriptionMessage = {
  name: 'rowDescription',
  length: 6,
  fieldCount: 0,
  fields: [],
}
const expectedOneRowMessage = {
  name: 'rowDescription',
  length: 27,
  fieldCount: 1,
  fields: [
    {
      name: 'id',
      tableID: 1,
      columnID: 2,
      dataTypeID: 3,
      dataTypeSize: 4,
      dataTypeModifier: 5,
      format: 'text',
    },
  ],
}

const expectedTwoRowMessage = {
  name: 'rowDescription',
  length: 53,
  fieldCount: 2,
  fields: [
    {
      name: 'bang',
      tableID: 1,
      columnID: 2,
      dataTypeID: 3,
      dataTypeSize: 4,
      dataTypeModifier: 5,
      format: 'text',
    },
    {
      name: 'whoah',
      tableID: 10,
      columnID: 11,
      dataTypeID: 12,
      dataTypeSize: 13,
      dataTypeModifier: 14,
      format: 'text',
    },
  ],
}
const expectedBigOidMessage = {
  name: 'rowDescription',
  length: 31,
  fieldCount: 1,
  fields: [
    {
      name: 'bigoid',
      tableID: 3000000001,
      columnID: 2,
      dataTypeID: 3000000003,
      dataTypeSize: 4,
      dataTypeModifier: 5,
      format: 'text',
    },
  ],
}

const emptyParameterDescriptionBuffer = new BufferList()
  .addInt16(0) // number of parameters
  .join(true, 't')

const oneParameterDescBuf = buffers.parameterDescription([1111])

const twoParameterDescBuf = buffers.parameterDescription([2222, 3333])

const expectedEmptyParameterDescriptionMessage = {
  name: 'parameterDescription',
  length: 6,
  parameterCount: 0,
  dataTypeIDs: [],
}

const expectedOneParameterMessage = {
  name: 'parameterDescription',
  length: 10,
  parameterCount: 1,
  dataTypeIDs: [1111],
}

const expectedTwoParameterMessage = {
  name: 'parameterDescription',
  length: 14,
  parameterCount: 2,
  dataTypeIDs: [2222, 3333],
}

const testForMessage = function (buffer: Buffer, expectedMessage: any) {
  it('receives and parses ' + expectedMessage.name, async () => {
    const messages = await parseBuffers([buffer])
    const [lastMessage] = messages

    for (const key in expectedMessage) {
      assert.deepEqual((lastMessage as any)[key], expectedMessage[key])
    }
  })
}

const plainPasswordBuffer = buffers.authenticationCleartextPassword()
const md5PasswordBuffer = buffers.authenticationMD5Password()
// SASL authentication is no longer supported
// const SASLBuffer = buffers.authenticationSASL()
// const SASLContinueBuffer = buffers.authenticationSASLContinue()
// const SASLFinalBuffer = buffers.authenticationSASLFinal()

const expectedPlainPasswordMessage = {
  name: 'authenticationCleartextPassword',
}

const expectedMD5PasswordMessage = {
  name: 'authenticationMD5Password',
  salt: Buffer.from([1, 2, 3, 4]),
}

// SASL authentication is no longer supported
/*
const expectedSASLMessage = {
  name: 'authenticationSASL',
  mechanisms: ['SCRAM-SHA-256'],
}

const expectedSASLContinueMessage = {
  name: 'authenticationSASLContinue',
  data: 'data',
}

const expectedSASLFinalMessage = {
  name: 'authenticationSASLFinal',
  data: 'data',
}
*/

const notificationResponseBuffer = buffers.notification(4, 'hi', 'boom')
const expectedNotificationResponseMessage = {
  name: 'notification',
  processId: 4,
  channel: 'hi',
  payload: 'boom',
}

const parseBuffers = async (buffers: Buffer[]): Promise<BackendMessage[]> => {
  const stream = new PassThrough()
  for (const buffer of buffers) {
    stream.write(buffer)
  }
  stream.end()
  const msgs: BackendMessage[] = []
  await parse(stream, (msg) => msgs.push(msg))
  return msgs
}

describe('GaussDBPacketStream', function () {
  testForMessage(authOkBuffer, expectedAuthenticationOkayMessage)
  testForMessage(plainPasswordBuffer, expectedPlainPasswordMessage)
  testForMessage(md5PasswordBuffer, expectedMD5PasswordMessage)

  // SASL authentication tests are commented out as SASL is no longer supported
  /*
  testForMessage(SASLBuffer, expectedSASLMessage)
  testForMessage(SASLContinueBuffer, expectedSASLContinueMessage)

  // this exercises a found bug in the parser:
  // https://github.com/brianc/node-postgres/pull/2210#issuecomment-627626084
  // and adds a test which is deterministic, rather than relying on network packet chunking
  const extendedSASLContinueBuffer = Buffer.concat([SASLContinueBuffer, Buffer.from([1, 2, 3, 4])])
  testForMessage(extendedSASLContinueBuffer, expectedSASLContinueMessage)

  testForMessage(SASLFinalBuffer, expectedSASLFinalMessage)

  // this exercises a found bug in the parser:
  // https://github.com/brianc/node-postgres/pull/2210#issuecomment-627626084
  // and adds a test which is deterministic, rather than relying on network packet chunking
  const extendedSASLFinalBuffer = Buffer.concat([SASLFinalBuffer, Buffer.from([1, 2, 4, 5])])
  testForMessage(extendedSASLFinalBuffer, expectedSASLFinalMessage)
  */

  testForMessage(paramStatusBuffer, expectedParameterStatusMessage)
  testForMessage(backendKeyDataBuffer, expectedBackendKeyDataMessage)
  testForMessage(readyForQueryBuffer, expectedReadyForQueryMessage)
  testForMessage(commandCompleteBuffer, expectedCommandCompleteMessage)
  testForMessage(notificationResponseBuffer, expectedNotificationResponseMessage)
  testForMessage(buffers.emptyQuery(), {
    name: 'emptyQuery',
    length: 4,
  })

  testForMessage(Buffer.from([0x6e, 0, 0, 0, 4]), {
    name: 'noData',
  })

  describe('rowDescription messages', function () {
    testForMessage(emptyRowDescriptionBuffer, expectedEmptyRowDescriptionMessage)
    testForMessage(oneRowDescBuff, expectedOneRowMessage)
    testForMessage(twoRowBuf, expectedTwoRowMessage)
    testForMessage(bigOidDescBuff, expectedBigOidMessage)
  })

  describe('parameterDescription messages', function () {
    testForMessage(emptyParameterDescriptionBuffer, expectedEmptyParameterDescriptionMessage)
    testForMessage(oneParameterDescBuf, expectedOneParameterMessage)
    testForMessage(twoParameterDescBuf, expectedTwoParameterMessage)
  })

  describe('parsing rows', function () {
    describe('parsing empty row', function () {
      testForMessage(emptyRowFieldBuf, {
        name: 'dataRow',
        fieldCount: 0,
      })
    })

    describe('parsing data row with fields', function () {
      testForMessage(oneFieldBuf, {
        name: 'dataRow',
        fieldCount: 1,
        fields: ['test'],
      })
    })
  })

  describe('notice message', function () {
    // this uses the same logic as error message
    const buff = buffers.notice([{ type: 'C', value: 'code' }])
    testForMessage(buff, {
      name: 'notice',
      code: 'code',
    })
  })

  testForMessage(buffers.error([]), {
    name: 'error',
  })

  describe('with all the fields', function () {
    const buffer = buffers.error([
      {
        type: 'S',
        value: 'ERROR',
      },
      {
        type: 'C',
        value: 'code',
      },
      {
        type: 'M',
        value: 'message',
      },
      {
        type: 'D',
        value: 'details',
      },
      {
        type: 'H',
        value: 'hint',
      },
      {
        type: 'P',
        value: '100',
      },
      {
        type: 'p',
        value: '101',
      },
      {
        type: 'q',
        value: 'query',
      },
      {
        type: 'W',
        value: 'where',
      },
      {
        type: 'F',
        value: 'file',
      },
      {
        type: 'L',
        value: 'line',
      },
      {
        type: 'R',
        value: 'routine',
      },
      {
        type: 'Z', // ignored
        value: 'alsdkf',
      },
    ])

    testForMessage(buffer, {
      name: 'error',
      severity: 'ERROR',
      code: 'code',
      message: 'message',
      detail: 'details',
      hint: 'hint',
      position: '100',
      internalPosition: '101',
      internalQuery: 'query',
      where: 'where',
      file: 'file',
      line: 'line',
      routine: 'routine',
    })
  })

  testForMessage(parseCompleteBuffer, {
    name: 'parseComplete',
  })

  testForMessage(bindCompleteBuffer, {
    name: 'bindComplete',
  })

  testForMessage(bindCompleteBuffer, {
    name: 'bindComplete',
  })

  testForMessage(buffers.closeComplete(), {
    name: 'closeComplete',
  })

  describe('parses portal suspended message', function () {
    testForMessage(portalSuspendedBuffer, {
      name: 'portalSuspended',
    })
  })

  describe('parses replication start message', function () {
    testForMessage(Buffer.from([0x57, 0x00, 0x00, 0x00, 0x04]), {
      name: 'replicationStart',
      length: 4,
    })
  })

  describe('copy', () => {
    testForMessage(buffers.copyIn(0), {
      name: 'copyInResponse',
      length: 7,
      binary: false,
      columnTypes: [],
    })

    testForMessage(buffers.copyIn(2), {
      name: 'copyInResponse',
      length: 11,
      binary: false,
      columnTypes: [0, 1],
    })

    testForMessage(buffers.copyOut(0), {
      name: 'copyOutResponse',
      length: 7,
      binary: false,
      columnTypes: [],
    })

    testForMessage(buffers.copyOut(3), {
      name: 'copyOutResponse',
      length: 13,
      binary: false,
      columnTypes: [0, 1, 2],
    })

    testForMessage(buffers.copyDone(), {
      name: 'copyDone',
      length: 4,
    })

    testForMessage(buffers.copyData(Buffer.from([5, 6, 7])), {
      name: 'copyData',
      length: 7,
      chunk: Buffer.from([5, 6, 7]),
    })
  })

  // since the data message on a stream can randomly divide the incomming
  // tcp packets anywhere, we need to make sure we can parse every single
  // split on a tcp message
  describe('split buffer, single message parsing', function () {
    const fullBuffer = buffers.dataRow([null, 'bang', 'zug zug', null, '!'])

    it('parses when full buffer comes in', async function () {
      const messages = await parseBuffers([fullBuffer])
      const message = messages[0] as any
      assert.equal(message.fields.length, 5)
      assert.equal(message.fields[0], null)
      assert.equal(message.fields[1], 'bang')
      assert.equal(message.fields[2], 'zug zug')
      assert.equal(message.fields[3], null)
      assert.equal(message.fields[4], '!')
    })

    const testMessageReceivedAfterSplitAt = async function (split: number) {
      const firstBuffer = Buffer.alloc(fullBuffer.length - split)
      const secondBuffer = Buffer.alloc(fullBuffer.length - firstBuffer.length)
      fullBuffer.copy(firstBuffer, 0, 0)
      fullBuffer.copy(secondBuffer, 0, firstBuffer.length)
      const messages = await parseBuffers([firstBuffer, secondBuffer])
      const message = messages[0] as any
      assert.equal(message.fields.length, 5)
      assert.equal(message.fields[0], null)
      assert.equal(message.fields[1], 'bang')
      assert.equal(message.fields[2], 'zug zug')
      assert.equal(message.fields[3], null)
      assert.equal(message.fields[4], '!')
    }

    it('parses when split in the middle', function () {
      return testMessageReceivedAfterSplitAt(6)
    })

    it('parses when split at end', function () {
      return testMessageReceivedAfterSplitAt(2)
    })

    it('parses when split at beginning', function () {
      return Promise.all([
        testMessageReceivedAfterSplitAt(fullBuffer.length - 2),
        testMessageReceivedAfterSplitAt(fullBuffer.length - 1),
        testMessageReceivedAfterSplitAt(fullBuffer.length - 5),
      ])
    })
  })

  describe('split buffer, multiple message parsing', function () {
    const dataRowBuffer = buffers.dataRow(['!'])
    const readyForQueryBuffer = buffers.readyForQuery()
    const fullBuffer = Buffer.alloc(dataRowBuffer.length + readyForQueryBuffer.length)
    dataRowBuffer.copy(fullBuffer, 0, 0)
    readyForQueryBuffer.copy(fullBuffer, dataRowBuffer.length, 0)

    const verifyMessages = function (messages: any[]) {
      assert.strictEqual(messages.length, 2)
      assert.deepEqual(messages[0], {
        name: 'dataRow',
        fieldCount: 1,
        length: 11,
        fields: ['!'],
      })
      assert.equal(messages[0].fields[0], '!')
      assert.deepEqual(messages[1], {
        name: 'readyForQuery',
        length: 5,
        status: 'I',
      })
    }
    // sanity check
    it('receives both messages when packet is not split', async function () {
      const messages = await parseBuffers([fullBuffer])
      verifyMessages(messages)
    })

    const splitAndVerifyTwoMessages = async function (split: number) {
      const firstBuffer = Buffer.alloc(fullBuffer.length - split)
      const secondBuffer = Buffer.alloc(fullBuffer.length - firstBuffer.length)
      fullBuffer.copy(firstBuffer, 0, 0)
      fullBuffer.copy(secondBuffer, 0, firstBuffer.length)
      const messages = await parseBuffers([firstBuffer, secondBuffer])
      verifyMessages(messages)
    }

    describe('receives both messages when packet is split', function () {
      it('in the middle', function () {
        return splitAndVerifyTwoMessages(11)
      })
      it('at the front', function () {
        return Promise.all([
          splitAndVerifyTwoMessages(fullBuffer.length - 1),
          splitAndVerifyTwoMessages(fullBuffer.length - 4),
          splitAndVerifyTwoMessages(fullBuffer.length - 6),
        ])
      })

      it('at the end', function () {
        return Promise.all([splitAndVerifyTwoMessages(8), splitAndVerifyTwoMessages(1)])
      })
    })
  })

  // ──────────────────────────────────────────────
  // Binary format DataRow parsing (commit c7014f63..HEAD)
  // ──────────────────────────────────────────────
  describe('binary format DataRow', function () {
    it('parses data row with binary format field as Buffer', async function () {
      // Create a RowDescription with formatCode=1 (binary) for a single field
      const binaryField = {
        name: 'bin_col',
        tableID: 0,
        attributeNumber: 0,
        dataTypeID: 17, // bytea
        dataTypeSize: -1,
        typeModifier: 0,
        formatCode: 1, // binary
      }
      const rowDescBuf = buffers.rowDescription([binaryField])

      // Create a DataRow with raw bytes (not text)
      const rawBytes = Buffer.from([0x01, 0x02, 0x03, 0x04])
      const dataRowBuf = new BufferList()
        .addInt16(1) // field count
        .addInt32(rawBytes.length)
        .add(rawBytes)
        .join(true, 'D')

      const messages = await parseBuffers([rowDescBuf, dataRowBuf])
      assert.strictEqual(messages.length, 2)
      const rowDesc = messages[0] as any
      const dataRow = messages[1] as any
      assert.strictEqual(rowDesc.name, 'rowDescription')
      assert.strictEqual(rowDesc.fields[0].format, 'binary')
      assert.strictEqual(dataRow.name, 'dataRow')
      assert.ok(Buffer.isBuffer(dataRow.fields[0]), 'binary field should be Buffer')
      assert.deepStrictEqual(dataRow.fields[0], rawBytes)
    })

    it('parses mixed text and binary fields', async function () {
      const fields = [
        {
          name: 'text_col',
          tableID: 0,
          attributeNumber: 0,
          dataTypeID: 25, // text
          dataTypeSize: -1,
          typeModifier: 0,
          formatCode: 0, // text
        },
        {
          name: 'bin_col',
          tableID: 0,
          attributeNumber: 1,
          dataTypeID: 17, // bytea
          dataTypeSize: -1,
          typeModifier: 0,
          formatCode: 1, // binary
        },
      ]
      const rowDescBuf = buffers.rowDescription(fields)

      const rawBytes = Buffer.from([0xde, 0xad, 0xbe, 0xef])
      const dataRowBuf = new BufferList()
        .addInt16(2) // field count
        .addInt32(5)
        .add(Buffer.from('hello')) // text field
        .addInt32(rawBytes.length)
        .add(rawBytes) // binary field
        .join(true, 'D')

      const messages = await parseBuffers([rowDescBuf, dataRowBuf])
      const dataRow = messages[1] as any
      assert.strictEqual(dataRow.fields[0], 'hello', 'text field should be string')
      assert.ok(Buffer.isBuffer(dataRow.fields[1]), 'binary field should be Buffer')
      assert.deepStrictEqual(dataRow.fields[1], rawBytes)
    })

    it('binary field with null value returns null', async function () {
      const binaryField = {
        name: 'bin_col',
        tableID: 0,
        attributeNumber: 0,
        dataTypeID: 17,
        dataTypeSize: -1,
        typeModifier: 0,
        formatCode: 1,
      }
      const rowDescBuf = buffers.rowDescription([binaryField])

      const dataRowBuf = new BufferList()
        .addInt16(1)
        .addInt32(-1) // null
        .join(true, 'D')

      const messages = await parseBuffers([rowDescBuf, dataRowBuf])
      const dataRow = messages[1] as any
      assert.strictEqual(dataRow.fields[0], null)
    })
  })

  // ──────────────────────────────────────────────
  // authType=10 SASL/SHA256 distinction (commit c7014f63..HEAD)
  // ──────────────────────────────────────────────
  describe('authType=10 SASL vs SHA256 distinction', function () {
    it('parses SASL when first byte is printable ASCII', async function () {
      // SASL: authType=10 + printable ASCII mechanism name
      const saslBuf = new BufferList()
        .addInt32(10) // authType
        .addCString('SCRAM-SHA-256')
        .addCString('') // terminator
        .join(true, 'R')

      const messages = await parseBuffers([saslBuf])
      const msg = messages[0] as any
      assert.strictEqual(msg.name, 'authenticationSASL')
      assert.ok(Array.isArray(msg.mechanisms))
      assert.strictEqual(msg.mechanisms[0], 'SCRAM-SHA-256')
    })

    it('parses SHA256 when first byte is non-printable', async function () {
      // GaussDB SHA256: authType=10 + raw binary data (non-printable first byte)
      // Structure: [4 bytes method][64 bytes random code][8 bytes token][4 bytes iteration]
      const shaData = Buffer.alloc(80)
      shaData.writeInt32BE(0, 0) // method = 0 (non-printable byte)
      shaData.write('A'.repeat(64), 4, 'ascii')
      shaData.write('B'.repeat(8), 68, 'ascii')
      shaData.writeInt32BE(4096, 76)

      const shaBuf = new BufferList()
        .addInt32(10) // authType
        .add(shaData)
        .join(true, 'R')

      const messages = await parseBuffers([shaBuf])
      const msg = messages[0] as any
      assert.strictEqual(msg.name, 'authenticationSHA256Password')
      assert.ok(Buffer.isBuffer(msg.data))
    })

    it('parses SHA256 with multiple SASL-like mechanisms not confused', async function () {
      // SASL with multiple mechanisms
      const saslBuf = new BufferList()
        .addInt32(10)
        .addCString('SCRAM-SHA-256')
        .addCString('SCRAM-SHA-256-PLUS')
        .addCString('')
        .join(true, 'R')

      const messages = await parseBuffers([saslBuf])
      const msg = messages[0] as any
      assert.strictEqual(msg.name, 'authenticationSASL')
      assert.deepStrictEqual(msg.mechanisms, ['SCRAM-SHA-256', 'SCRAM-SHA-256-PLUS'])
    })

    it('parses SHA256 with all-zero method byte', async function () {
      // Edge case: method byte is 0x00 (definitely not printable)
      const shaData = Buffer.alloc(80)
      // all zeros by default — method=0, rest filled with zeros
      shaData.write('C'.repeat(64), 4, 'ascii')
      shaData.write('D'.repeat(8), 68, 'ascii')
      shaData.writeInt32BE(2048, 76)

      const shaBuf = new BufferList().addInt32(10).add(shaData).join(true, 'R')

      const messages = await parseBuffers([shaBuf])
      const msg = messages[0] as any
      assert.strictEqual(msg.name, 'authenticationSHA256Password')
    })
  })
})
