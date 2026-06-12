'use strict'
// This file contains crypto utility functions for versions of Node.js < 15.0.0,
// which does not support the WebCrypto.subtle API.

const nodeCrypto = require('crypto')
const { RFC5802Algorithm } = require('./rfc5802')

function md5(string) {
  return nodeCrypto.createHash('md5').update(string, 'utf-8').digest('hex')
}

// See AuthenticationMD5Password at https://www.postgresql.org/docs/current/static/protocol-flow.html
function gaussdbMd5PasswordHash(user, password, salt) {
  const inner = md5(password + user)
  const outer = md5(Buffer.concat([Buffer.from(inner), salt]))
  return 'md5' + outer
}

// GaussDB SHA256 authentication
function gaussdbSha256PasswordHash(user, password, data) {
  const PASSWORD_METHOD_OFFSET = 0
  const PASSWORD_METHOD_SIZE = 4
  const RANDOM_CODE_SIZE = 64
  const TOKEN_SIZE = 8
  const ITERATION_SIZE = 4

  const dataBuffer = Buffer.from(data)
  dataBuffer.readInt32BE(PASSWORD_METHOD_OFFSET)

  const randomCode = dataBuffer.slice(PASSWORD_METHOD_SIZE, PASSWORD_METHOD_SIZE + RANDOM_CODE_SIZE).toString('ascii')

  const tokenOffset = PASSWORD_METHOD_SIZE + RANDOM_CODE_SIZE
  const token = dataBuffer.slice(tokenOffset, tokenOffset + TOKEN_SIZE).toString('ascii')

  const serverIteration = dataBuffer.readInt32BE(dataBuffer.length - ITERATION_SIZE)

  const hashResult = RFC5802Algorithm(password, randomCode, token, '', serverIteration, 'sha256')

  return Buffer.from(hashResult, 'hex').toString('ascii')
}

function sha256(text) {
  return nodeCrypto.createHash('sha256').update(text).digest()
}

function hashByName(hashName, text) {
  hashName = hashName.replace(/(\D)-/, '$1') // e.g. SHA-256 -> SHA256
  return nodeCrypto.createHash(hashName).update(text).digest()
}

function hmacSha256(key, msg) {
  return nodeCrypto.createHmac('sha256', key).update(msg).digest()
}

async function deriveKey(password, salt, iterations) {
  return nodeCrypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256')
}

module.exports = {
  gaussdbMd5PasswordHash,
  gaussdbSha256PasswordHash,
  randomBytes: nodeCrypto.randomBytes,
  deriveKey,
  sha256,
  hashByName,
  hmacSha256,
  md5,
}
