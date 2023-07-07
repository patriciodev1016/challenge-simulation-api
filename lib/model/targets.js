const redis = require('../redis')
const { promisify } = require('util')

const TARGETS_KEY = 'targets'
const DECISIONS_KEY = 'decisions'

// promisify Redis commands for easier async/await syntax
const hgetallAsync = promisify(redis.hgetall).bind(redis)
const incrAsync = promisify(redis.incr).bind(redis)
const hmsetAsync = promisify(redis.hmset).bind(redis)
const delAsync = promisify(redis.del).bind(redis)
const keysAsync = promisify(redis.keys).bind(redis)

const getTodayStamp = () => {
  const currentDate = new Date()
  const day = currentDate.getDay()
  const month = currentDate.getMonth() + 1
  const year = currentDate.getFullYear()

  return `${day}-${month}-${year}`
}

const targets = {
  async create(target) {
    const id = await incrAsync(`${TARGETS_KEY}:id`)
    target.id = id.toString()
    const newTarget = {id: `${id}`, ...target}

    await hmsetAsync(`${TARGETS_KEY}`, id, JSON.stringify(newTarget))
    return newTarget
  },

  async getAll() {  
    const targets = await hgetallAsync(`${TARGETS_KEY}`)
    Object.keys(targets).forEach(id => {
      targets[id] = {...JSON.parse(targets[id]), id};
    })

    return targets
  },

  async get(id) {
    const targets = await hgetallAsync(`${TARGETS_KEY}`)
    if (!targets[id]) {
      return null
    }
    return {...JSON.parse(targets[id]), id}
  },

  async update(id, target) {
    const updatedTarget = {id: `${id}`, ...target}
    const result = await hmsetAsync(`${TARGETS_KEY}`, id, JSON.stringify(updatedTarget))

    if (result === 'OK') {
      return updatedTarget
    } else {
      return null
    }
  },

  async delete(id) {
    const result = await delAsync(`${TARGETS_KEY}`, id)
    return result === 1
  },

  async getDecision(visitorInfo) {
    const { geoState, publisher, timestamp } = visitorInfo
    const decisions = await hgetallAsync(`${DECISIONS_KEY}`) || {}
    const targets = await hgetallAsync(`${TARGETS_KEY}`) || {}
    const currentDate = getTodayStamp()
    const currentHours = new Date(timestamp).getUTCHours()
    // console.log('decisions', decisions, 'targets', targets, currentDate, currentHours)
    const filteredTargets = Object.values(targets).filter(target => {
      const { accept } = JSON.parse(target)
      const { geoState: states, hour: hours } = accept

      return states.$in.includes(geoState) && hours.$in.includes(`${currentHours}`)
    }).map(target => JSON.parse(target))
    // console.log('filteredTargets', filteredTargets)
    if (filteredTargets.length === 0) return { decision: "reject" }
    
    const todayDecisions = typeof decisions[currentDate] !== 'undefined' ? JSON.parse(decisions[currentDate]) : {};
    // console.log(`todayDecisions: `, JSON.stringify(todayDecisions))

    const availableTargets = filteredTargets.filter(target => {
      const { id, maxAcceptsPerDay } = target
      if (typeof todayDecisions[id] === 'undefined') return true
      if (todayDecisions[id].length < maxAcceptsPerDay) return true
      else return false      
    })
    console.log('available targets:', availableTargets)

    if(availableTargets.length === 0) return { decision: "reject" }
    else {
      const decidedTarget = availableTargets.reduce((prev, current) => {
        return (parseFloat(prev.value) > parseFloat(current.value)) ? prev : current
      })
  
      const result = await hmsetAsync(`${DECISIONS_KEY}`, currentDate, JSON.stringify({...todayDecisions, [decidedTarget.id]: todayDecisions[decidedTarget.id] ? [...todayDecisions[decidedTarget.id], publisher] : [publisher]}))
      if (result === 'OK') {
        return {decision: decidedTarget.url}
      }
    }    
  }
}

module.exports = targets
