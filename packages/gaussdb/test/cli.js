'use strict'
const ConnectionParameters = require('../lib/connection-parameters')
const config = new ConnectionParameters(process.argv[2])

for (let i = 0; i < process.argv.length; i++) {
  switch (process.argv[i].toLowerCase()) {
    case 'native':
      config.native = true
      break
    case 'binary':
      config.binary = true
      break
    case 'down':
      config.down = true
      break
    default:
      break
  }
}

if (process.env['GAUSS_TEST_NATIVE']) {
  config.native = true
}

module.exports = config
