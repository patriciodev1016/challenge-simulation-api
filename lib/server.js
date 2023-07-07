var URL = require('url')
var http = require('http')
var cuid = require('cuid')
var Corsify = require('corsify')
var sendJson = require('send-data/json')
var ReqLogger = require('req-logger')
var healthPoint = require('healthpoint')
var HttpHashRouter = require('http-hash-router')

var redis = require('./redis')
var version = require('../package.json').version
var targets = require('./model/targets')
var router = HttpHashRouter()
var logger = ReqLogger({ version: version })
var health = healthPoint({ version: version }, redis.healthCheck)
var cors = Corsify({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, accept, content-type'
})

router.set('/favicon.ico', empty)

router.set('/route', async (req, res) => {
  let body = ''
  req.on('data', (chunk) => body += chunk)
  req.on('end', async() => {
    const visitorInfo = JSON.parse(body)

    try {
      const decision = await targets.getDecision(visitorInfo)      
      sendJson(req, res, { decision })
    } catch (error) {
      console.error(error, 'failed to make a decision');
    }
  })
})

/**
 * @api targets API endpoints.
 */
router.set('/api/targets', async(req, res) => {
  let body = ''
  req.on('data', (chunk) => body += chunk)
  req.on('end', async() => {
    switch (req.method) {
      /**
       * Create target.
       */
      case 'POST':
        const target = JSON.parse(body)

        try {
          const createdTarget = await targets.create(target)
          sendJson(req, res, createdTarget)          
        } catch (error) {
          console.error(error, 'failed to create a target')
        }
        break;    
      /**
       * Get all targets.
       */
      case 'GET': 
        try {
          const allTargets = await targets.getAll();
          sendJson(req, res, allTargets)          
        } catch (error) {
          console.error(error, 'failed to get a list of all targets')
        }
        break;
    }
  })
})

/**
 * @api target/:id API endpoints.
 */
router.set('/api/target/:id', async (req, res, params) => {
  let body = ''

  req.on('data', (chunk) => body += chunk)
  req.on('end', async () => {
    var { id } = params.params

    switch (req.method) {
      case 'GET':
        try {
          const target = await targets.get(id)
          if (target) {
            sendJson(req, res, target)
          } else {
            sendJson(req, res, { error: 'No such target'})
          }          
        } catch (error) {
          console.error(error, 'failed to get a target by id')
        }
        break;
      case 'POST':
        const targetParam = JSON.parse(body)
        try {
          const updatedTarget = await targets.update(id, targetParam)
  
          if(updatedTarget) {
            sendJson(req, res, updatedTarget)
          } else {
            sendJson(req, res, { error: 'No such target'})
          }          
        } catch (error) {
          console.error(error, 'failed to update an existing target')
        }
        break;
    }
  })
})

module.exports = function createServer () {
  return http.createServer(cors(handler))
}

function handler (req, res) {
  if (req.url === '/health') return health(req, res)
  req.id = cuid()
  logger(req, res, { requestId: req.id }, function (info) {
    info.authEmail = (req.auth || {}).email
    console.log(info)
  })
  router(req, res, { query: getQuery(req.url) }, onError.bind(null, req, res))
}

function onError (req, res, err) {
  if (!err) return

  res.statusCode = err.statusCode || 500
  logError(req, res, err)

  sendJson(req, res, {
    error: err.message || http.STATUS_CODES[res.statusCode]
  })
}

function logError (req, res, err) {
  if (process.env.NODE_ENV === 'test') return

  var logType = res.statusCode >= 500 ? 'error' : 'warn'

  console[logType]({
    err: err,
    requestId: req.id,
    statusCode: res.statusCode
  }, err.message)
}

function empty (req, res) {
  res.writeHead(204)
  res.end()
}

function getQuery (url) {
  return URL.parse(url, true).query // eslint-disable-line
}
