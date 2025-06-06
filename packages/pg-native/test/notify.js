const Client = require('../')
const ok = require('okay')

// SKIP: 不支持 LISTEN/NOFITY statement
// https://github.com/HuaweiCloudDeveloper/gaussdb-drivers/blob/master-dev/diff-gaussdb-postgres.md#%E4%B8%8D%E6%94%AF%E6%8C%81-listennofity-statement
const notify = function (channel, payload) {
  const client = new Client()
  client.connectSync()
  client.querySync('NOTIFY ' + channel + ", '" + payload + "'")
  client.end()
}

describe.skip('simple LISTEN/NOTIFY', function () {
  before(function (done) {
    const client = (this.client = new Client())
    client.connect(done)
  })

  it('works', function (done) {
    const client = this.client
    client.querySync('LISTEN boom')
    client.on('notification', function (msg) {
      done()
    })
    notify('boom', 'sup')
  })

  after(function (done) {
    this.client.end(done)
  })
})

if (!process.env.TRAVIS_CI) {
  describe.skip('async LISTEN/NOTIFY', function () {
    before(function (done) {
      const client = (this.client = new Client())
      client.connect(done)
    })

    it('works', function (done) {
      const client = this.client
      let count = 0
      const check = function () {
        count++
        if (count >= 2) return done()
      }
      client.on('notification', check)
      client.query(
        'LISTEN test',
        ok(done, function () {
          notify('test', 'bot')
          client.query(
            'SELECT pg_sleep(.05)',
            ok(done, function () {
              notify('test', 'bot')
            })
          )
        })
      )
    })

    after(function (done) {
      this.client.end(done)
    })
  })
}
