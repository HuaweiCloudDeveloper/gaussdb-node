'use strict'

const HostStatusTracker = require('./host-status-tracker')

const roundRobinRegistry = new Map()

const buildClusterKey = (hosts, loadBalanceMode, targetServerType) => {
  const hostList = (hosts || []).map((hostSpec) => `${hostSpec.host}:${hostSpec.port}`)
  return JSON.stringify({
    hosts: hostList,
    loadBalanceMode: loadBalanceMode || '',
    targetServerType: targetServerType || '',
  })
}

const getRoundRobinCounter = (clusterKey) => {
  let counter = roundRobinRegistry.get(clusterKey)
  if (!counter) {
    counter = { value: 0 }
    roundRobinRegistry.set(clusterKey, counter)
  }
  return counter
}

/**
 * HostChooser - Manages host selection strategy for load balancing
 */
class HostChooser {
  /**
   * Constructor
   * @param {Array<Object>} hosts - Array of HostSpec objects
   * @param {string|boolean} loadBalanceMode - Load balance mode (false/roundrobin/shuffle/leastconn/priority[n])
   * @param {string} targetServerType - Target server type (any/master/slave/preferSlave)
   * @param {number} hostRecheckSeconds - Host status recheck interval in seconds
   */
  constructor(hosts, loadBalanceMode, targetServerType, hostRecheckSeconds) {
    this.hosts = hosts || []
    this.loadBalanceMode = loadBalanceMode
    this.targetServerType = targetServerType || 'any'
    this.recheckMillis = (hostRecheckSeconds || 10) * 1000

    // Always use driver-level round-robin counter for consistent load balancing
    if (this.loadBalanceMode === 'roundrobin' || this.loadBalanceMode === 'balance') {
      const clusterKey = buildClusterKey(this.hosts, this.loadBalanceMode, this.targetServerType)
      this.roundRobinCounter = getRoundRobinCounter(clusterKey)
    }
  }

  /**
   * Get candidate hosts from HostStatusTracker
   * Filters hosts based on status and targetServerType
   * @returns {Array<Object>} Array of candidate HostSpec objects
   * @private
   */
  _getCandidateHosts() {
    const candidates = HostStatusTracker.getCandidateHosts(this.hosts, this.targetServerType, this.recheckMillis)

    // Fallback to all hosts if no candidates available
    if (candidates.length === 0) {
      if (
        this.targetServerType === 'master' ||
        this.targetServerType === 'slave' ||
        this.targetServerType === 'preferSlave'
      ) {
        return this.hosts.filter((hostSpec) => {
          return HostStatusTracker.isHostProbingCandidate(hostSpec, this.recheckMillis)
        })
      }
      return this.hosts.slice()
    }

    return candidates
  }

  /**
   * Apply roundrobin load balancing
   * @param {Array<Object>} hosts - Candidate hosts
   * @returns {Array<Object>} Reordered hosts for round-robin
   * @private
   */
  _roundRobin(hosts) {
    if (hosts.length === 0) {
      return []
    }

    if (!this.roundRobinCounter) {
      throw new Error('HostChooser: roundRobinCounter not initialized')
    }

    const index = this.roundRobinCounter.value++ % hosts.length
    const rotated = hosts.slice(index).concat(hosts.slice(0, index))
    return rotated
  }

  /**
   * Apply shuffle (random) load balancing
   * @param {Array<Object>} hosts - Candidate hosts
   * @returns {Array<Object>} Randomly shuffled hosts
   * @private
   */
  _shuffle(hosts) {
    const shuffled = hosts.slice()
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = shuffled[i]
      shuffled[i] = shuffled[j]
      shuffled[j] = tmp
    }
    return shuffled
  }

  /**
   * Apply leastconn (least connections) load balancing
   * @param {Array<Object>} hosts - Candidate hosts
   * @returns {Array<Object>} Hosts sorted by connection count (ascending)
   * @private
   */
  _leastConn(hosts) {
    // TODO
    throw new Error('HostChooser: leastconn load balance mode is not implemented')
  }

  /**
   * Apply priority roundrobin load balancing
   * @param {Array<Object>} hosts - Candidate hosts
   * @param {number} n - Number of priority hosts
   * @returns {Array<Object>} Priority hosts first, then fallback hosts
   * @private
   */
  _priority(hosts, n) {
    // TODO
    throw new Error('HostChooser: priority load balance mode is not implemented')
  }

  /**
   * Get host iterator based on load balancing mode
   * Yields hosts one by one for connection attempts
   * @returns {Generator<Object>} Host iterator
   */
  *getHostIterator() {
    // Get candidate hosts filtered by status and targetServerType
    const candidateHosts = this._getCandidateHosts()

    // If no load balancing, return hosts in original order
    if (!this.loadBalanceMode) {
      for (const host of candidateHosts) {
        yield host
      }
      return
    }

    // Apply load balancing strategy
    // TODO: What if the status of hosts changes between calls?
    let orderedHosts = candidateHosts

    if (this.loadBalanceMode === 'roundrobin' || this.loadBalanceMode === 'balance') {
      orderedHosts = this._roundRobin(candidateHosts)
    } else if (this.loadBalanceMode === 'shuffle') {
      orderedHosts = this._shuffle(candidateHosts)
    } else if (this.loadBalanceMode === 'leastconn') {
      orderedHosts = this._leastConn(candidateHosts)
    } else if (typeof this.loadBalanceMode === 'string' && this.loadBalanceMode.startsWith('priority')) {
      // TODO: Extract priority number from 'priority2', 'priority3', etc.
      const match = this.loadBalanceMode.match(/^priority(\d+)$/)
      if (match) {
        const n = parseInt(match[1], 10)
        orderedHosts = this._priority(candidateHosts, n)
      }
    }

    // Yield hosts in order
    for (const host of orderedHosts) {
      yield host
    }
  }
}

module.exports = HostChooser
