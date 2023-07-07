process.env.NODE_ENV = 'test'

var test = require('ava')
var servertest = require('servertest')

var server = require('../lib/server')

test.serial.cb('healthcheck', function (t) {
  var url = '/health'
  servertest(server(), url, { encoding: 'json' }, function (err, res) {
    t.falsy(err, 'no error')

    t.is(res.statusCode, 200, 'correct statusCode')
    t.is(res.body.status, 'OK', 'status is ok')
    t.end()
  })
})

test.serial.cb('Create a target and retrieve a target by id', function (t) {
  var targetData = {
    maxAcceptsPerDay: 5,
    url: 'http://www.google.com',
    accept: {
      geoState: {
        $in: ['ny', 'ca']
      },
      hour: {
        $in: ['13', '14', '15']
      }
    }
  }

  var updateData = {
    maxAcceptsPerDay: 7,
    url: 'http://www.postman.co',
    accept: {
      geoState: {
        $in: ['ny', 'ca', 'pa']
      },
      hour: {
        $in: ['13', '14', '15', '16']
      }
    }
  }

  servertest(server(), '/api/targets', {method: 'POST', json: targetData}), (err, res) => {
   t.falsy(err, 'no error')
   t.is(res.statusCode, 200, 'succeeded to create a new target') 

    var targetId = res.body.id
    targetData = {id: `${targetId}`, ...targetData}

    servertest(server(), `/api/targets/${targetId}`, {method: 'GET'}, (err, res) => {
      t.falsy(err, 'no error')
      t.is(res.statusCode, 200, 'succeeded to fetch a target by id') 

      t.deepEqual(res.body, targetData, 'retrieved target data equals')

      t.end()
    })

    servertest(server(), `/api/targets/${targetId}`, {method: 'POST', json: updateData}, (err, res) => {
      t.falsy(err, 'no error')
      t.is(res.statusCode, 200, 'succeeded to update an existing target')

      var updateId = res.body.id
      updateData = {id: `${updateId}`, ...updateData}
      t.deepEqual(res.body, updateData, 'updated data equals')

      t.end()
    })
  }
})

test.serial.cb('Fetch a list of all targets', function (t) {
  servertest(server(), '/api/targets', {method: 'GET'}, (err, res) => {
    t.falsy(err, 'no error')
    t.is(res.statusCode, 200, 'succeeded to fetch a list of all targets')

    t.end()
  })
})

test.serial.cb('Fetch a list of all targets', function (t) {
  var visitorInfo = {
    "geoState": "ca",
    "publisher": "abc",
    "timestamp": "2018-07-19T13:28:59.513Z"
  }

  servertest(server(), '/api/targets', {method: 'POST', json: visitorInfo}, (err, res) => {
    t.falsy(err, 'no error')
    t.is(res.statusCode, 200, 'succeeded to make a decision')

    t.end()
  })
})
