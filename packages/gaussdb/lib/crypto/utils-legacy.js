'use strict'
// This file contains crypto utility functions for versions of Node.js < 15.0.0,
// which does not support the WebCrypto.subtle API.

const nodeCrypto = require('crypto')

function md5(string) {
  return nodeCrypto.createHash('md5').update(string, 'utf-8').digest('hex')
}

// See AuthenticationMD5Password at https://www.postgresql.org/docs/current/static/protocol-flow.html
function gaussdbMd5PasswordHash(user, password, salt) {
  const inner = md5(password + user)
  const outer = md5(Buffer.concat([Buffer.from(inner), salt]))
  return 'md5' + outer
}

// See AuthenticationSHA256Password (based on similar approach to MD5)
function gaussdbSha256PasswordHash(user, password, salt) {
  const inner = nodeCrypto
    .createHash('sha256')
    .update(password + user, 'utf-8')
    .digest('hex')
  const outer = nodeCrypto
    .createHash('sha256')
    .update(Buffer.concat([Buffer.from(inner), salt]))
    .digest('hex')
  return 'sha256' + outer
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
