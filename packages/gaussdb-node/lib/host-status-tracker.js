'use strict'

/**
 * HostStatusTracker - Global singleton to track host connection states
 */

/**
 * Host status enumeration
 */
const HostStatus = {
  CONNECT_OK: 'CONNECT_OK', // Host is reachable
  CONNECT_FAIL: 'CONNECT_FAIL', // Host connection failed
  MASTER: 'MASTER', // Host is a primary server
  SLAVE: 'SLAVE', // Host is a standby server
}

/**
 * HostStatusEntry - Stores host status with timestamp
 */
class HostStatusEntry {
  /**
   * Constructor
   * @param {string} status - Host status (from HostStatus enum)
   * @param {number} timestamp - Timestamp when status was recorded (milliseconds)
   */
  constructor(status, timestamp) {
    this.status = status
    this.timestamp = timestamp
  }

  /**
   * Check if this status entry has expired
   * @param {number} currentTime - Current timestamp in milliseconds
   * @param {number} recheckMillis - Recheck interval in milliseconds
   * @returns {boolean} True if expired
   */
  isExpired(currentTime, recheckMillis) {
    return currentTime - this.timestamp >= recheckMillis
  }
}

/**
 * HostStatusTracker - Singleton class for tracking host connection states
 */
class HostStatusTracker {
  constructor() {
    if (HostStatusTracker.instance) {
      return HostStatusTracker.instance
    }

    // Map: hostKey (host:port) -> HostStatusEntry
    this.statusMap = new Map()

    HostStatusTracker.instance = this
  }

  /**
   * Generate a unique key for a HostSpec
   * @param {Object} hostSpec - HostSpec object {host, port}
   * @returns {string} Unique key in format "host:port"
   * @private
   */
  _getHostKey(hostSpec) {
    return `${hostSpec.host}:${hostSpec.port}`
  }

  /**
   * Update host status
   * @param {Object} hostSpec - HostSpec object {host, port}
   * @param {string} status - Host status (from HostStatus enum)
   */
  updateHostStatus(hostSpec, status) {
    if (!hostSpec) {
      return
    }

    const hostKey = this._getHostKey(hostSpec)
    const timestamp = Date.now()
    const entry = new HostStatusEntry(status, timestamp)

    this.statusMap.set(hostKey, entry)
  }

  /**
   * Get host status
   * @param {Object} hostSpec - HostSpec object {host, port}
   * @returns {HostStatusEntry|null} Status entry or null if not found
   */
  getHostStatus(hostSpec) {
    if (!hostSpec) {
      return null
    }

    const hostKey = this._getHostKey(hostSpec)
    return this.statusMap.get(hostKey) || null
  }

  /**
   * Check if a host is suitable based on status and targetServerType
   * @param {Object} hostSpec - HostSpec object {host, port}
   * @param {string} targetServerType - Target server type (any/master/slave/preferSlave)
   * @param {number} recheckMillis - Recheck interval in milliseconds
   * @returns {boolean} True if host is suitable
   * @private
   */
  _isHostSuitable(hostSpec, targetServerType, recheckMillis) {
    const entry = this.getHostStatus(hostSpec)

    // No status recorded, consider it suitable (will be tested)
    if (!entry) {
      return true
    }

    const currentTime = Date.now()

    // If status has expired, consider it suitable (needs recheck)
    if (entry.isExpired(currentTime, recheckMillis)) {
      return true
    }

    const status = entry.status

    // Connection failed recently, not suitable
    if (status === HostStatus.CONNECT_FAIL) {
      return false
    }

    // For targetServerType='any', any connected host is suitable
    if (targetServerType === 'any') {
      return true
    }

    // For targetServerType='master', only MASTER or CONNECT_OK is suitable
    if (targetServerType === 'master') {
      return status === HostStatus.MASTER
    }

    // For targetServerType='slave', only SLAVE is suitable
    if (targetServerType === 'slave') {
      return status === HostStatus.SLAVE
    }

    // For targetServerType='preferSlave', SLAVE is preferred, but MASTER/CONNECT_OK is acceptable
    if (targetServerType === 'preferSlave') {
      return status === HostStatus.SLAVE || status === HostStatus.MASTER
    }

    // Default: consider suitable
    return true
  }

  isHostProbingCandidate(hostSpec, recheckMillis) {
    const entry = this.getHostStatus(hostSpec)
    if (!entry || entry.isExpired(Date.now(), recheckMillis)) {
      return true
    }
    if (entry.status === HostStatus.CONNECT_OK) {
      return true
    }
    return false
  }

  /**
   * Get candidate hosts filtered by targetServerType and status expiration
   * @param {Array<Object>} hostSpecs - Array of HostSpec objects
   * @param {string} targetServerType - Target server type (any/master/slave/preferSlave)
   * @param {number} recheckMillis - Recheck interval in milliseconds
   * @returns {Array<Object>} Array of suitable HostSpec objects
   */
  getCandidateHosts(hostSpecs, targetServerType, recheckMillis) {
    if (!hostSpecs || hostSpecs.length === 0) {
      return []
    }

    // For targetServerType='preferSlave', prioritize SLAVE hosts
    if (targetServerType === 'preferSlave') {
      const slaveHosts = []
      const otherHosts = []

      for (const hostSpec of hostSpecs) {
        if (!this._isHostSuitable(hostSpec, targetServerType, recheckMillis)) {
          continue
        }

        const entry = this.getHostStatus(hostSpec)
        if (entry && entry.status === HostStatus.SLAVE && !entry.isExpired(Date.now(), recheckMillis)) {
          slaveHosts.push(hostSpec)
        } else {
          otherHosts.push(hostSpec)
        }
      }

      // Prefer slaves, fallback to others
      return slaveHosts.length > 0 ? slaveHosts : otherHosts
    }

    // For other targetServerType, filter suitable hosts
    return hostSpecs.filter((hostSpec) => {
      return this._isHostSuitable(hostSpec, targetServerType, recheckMillis)
    })
  }

  /**
   * Clear all host status (for testing purposes)
   */
  clear() {
    this.statusMap.clear()
  }
}

const instance = new HostStatusTracker()

module.exports = instance
module.exports.HostStatus = HostStatus
module.exports.HostStatusTracker = HostStatusTracker
