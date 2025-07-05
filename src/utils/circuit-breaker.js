/**
 * Circuit Breaker pattern implementation
 * Prevents cascading failures by temporarily disabling problematic integrations
 * @module circuit-breaker
 */

import { auditTrail } from './audit-trail.js';

/**
 * Circuit states
 * @enum {string}
 */
export const CIRCUIT_STATE = {
  CLOSED: 'closed',   // Normal operation, requests pass through
  OPEN: 'open',       // Circuit is open, requests fail fast
  HALF_OPEN: 'half-open' // Testing if the circuit can be closed again
};

/**
 * Circuit breaker implementation
 */
export class CircuitBreaker {
  /**
   * Create a new circuit breaker
   * @param {string} name - Identifier for this circuit breaker
   * @param {Object} options - Configuration options
   * @param {number} options.failureThreshold - Number of failures before opening circuit
   * @param {number} options.resetTimeout - Milliseconds to wait before attempting reset (half-open state)
   * @param {number} options.halfOpenSuccessThreshold - Successes needed in half-open state to close circuit
   */
  constructor(name, options = {}) {
    this.name = name;
    this.state = CIRCUIT_STATE.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.lastStateChange = Date.now();
    
    // Configuration with defaults
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 1 minute
    this.halfOpenSuccessThreshold = options.halfOpenSuccessThreshold || 2;
    
    // Register with global registry for monitoring
    CircuitBreakerRegistry.register(this);
  }
  
  /**
   * Execute a function with circuit breaker protection
   * @param {Function} fn - Function to execute
   * @returns {Promise<*>} Result of the function
   * @throws {Error} If circuit is open or function fails
   */
  async execute(fn) {
    if (this.isOpen()) {
      if (this.shouldAttemptReset()) {
        this.transitionToHalfOpen();
      } else {
        const error = new Error(`Circuit ${this.name} is open`);
        error.code = 'CIRCUIT_OPEN';
        throw error;
      }
    }
    
    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure(error);
      throw error;
    }
  }
  
  /**
   * Check if the circuit is open (not allowing requests)
   * @returns {boolean} True if circuit is open
   */
  isOpen() {
    return this.state === CIRCUIT_STATE.OPEN;
  }
  
  /**
   * Check if the circuit is in half-open state
   * @returns {boolean} True if circuit is half-open
   */
  isHalfOpen() {
    return this.state === CIRCUIT_STATE.HALF_OPEN;
  }
  
  /**
   * Check if enough time has passed to attempt reset
   * @returns {boolean} True if reset should be attempted
   */
  shouldAttemptReset() {
    if (!this.lastFailureTime) return false;
    const now = Date.now();
    return (now - this.lastFailureTime) > this.resetTimeout;
  }
  
  /**
   * Record a successful operation
   */
  recordSuccess() {
    if (this.state === CIRCUIT_STATE.HALF_OPEN) {
      this.successCount++;
      
      if (this.successCount >= this.halfOpenSuccessThreshold) {
        this.transitionToClosed();
      }
    } else if (this.state === CIRCUIT_STATE.CLOSED) {
      // Reset failure count after a successful operation
      this.failureCount = Math.max(0, this.failureCount - 1);
    }
  }
  
  /**
   * Record a failed operation
   * @param {Error} error - The error that occurred
   */
  recordFailure(error) {
    this.lastFailureTime = Date.now();
    
    if (this.state === CIRCUIT_STATE.HALF_OPEN) {
      this.transitionToOpen();
    } else if (this.state === CIRCUIT_STATE.CLOSED) {
      this.failureCount++;
      
      if (this.failureCount >= this.failureThreshold) {
        this.transitionToOpen();
      }
    }
    
    // Log failure for monitoring
    auditTrail.log('circuit_breaker:failure', {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      error: error.message
    });
  }
  
  /**
   * Transition to open state
   */
  transitionToOpen() {
    if (this.state !== CIRCUIT_STATE.OPEN) {
      this.state = CIRCUIT_STATE.OPEN;
      this.lastStateChange = Date.now();
      this.successCount = 0;
      
      auditTrail.log('circuit_breaker:state_change', {
        name: this.name,
        state: this.state,
        failureCount: this.failureCount
      });
      
      console.warn(`Circuit ${this.name} is now OPEN due to ${this.failureCount} failures`);
    }
  }
  
  /**
   * Transition to half-open state
   */
  transitionToHalfOpen() {
    if (this.state !== CIRCUIT_STATE.HALF_OPEN) {
      this.state = CIRCUIT_STATE.HALF_OPEN;
      this.lastStateChange = Date.now();
      this.successCount = 0;
      
      auditTrail.log('circuit_breaker:state_change', {
        name: this.name,
        state: this.state
      });
      
      console.info(`Circuit ${this.name} is now HALF-OPEN, testing service availability`);
    }
  }
  
  /**
   * Transition to closed state
   */
  transitionToClosed() {
    if (this.state !== CIRCUIT_STATE.CLOSED) {
      this.state = CIRCUIT_STATE.CLOSED;
      this.lastStateChange = Date.now();
      this.failureCount = 0;
      this.successCount = 0;
      
      auditTrail.log('circuit_breaker:state_change', {
        name: this.name,
        state: this.state
      });
      
      console.info(`Circuit ${this.name} is now CLOSED, normal operation resumed`);
    }
  }
  
  /**
   * Manually reset the circuit breaker to closed state
   */
  reset() {
    this.transitionToClosed();
  }
  
  /**
   * Get current circuit breaker status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastStateChange: this.lastStateChange,
      uptime: Date.now() - this.lastStateChange
    };
  }
}

/**
 * Registry to track all circuit breakers in the application
 */
export class CircuitBreakerRegistry {
  static breakers = new Map();
  
  /**
   * Register a circuit breaker
   * @param {CircuitBreaker} breaker - Circuit breaker to register
   */
  static register(breaker) {
    CircuitBreakerRegistry.breakers.set(breaker.name, breaker);
  }
  
  /**
   * Get a circuit breaker by name
   * @param {string} name - Circuit breaker name
   * @returns {CircuitBreaker|undefined} The circuit breaker or undefined
   */
  static get(name) {
    return CircuitBreakerRegistry.breakers.get(name);
  }
  
  /**
   * Get status of all circuit breakers
   * @returns {Object} Status of all circuit breakers
   */
  static getStatus() {
    const status = {};
    CircuitBreakerRegistry.breakers.forEach((breaker, name) => {
      status[name] = breaker.getStatus();
    });
    return status;
  }
  
  /**
   * Reset all circuit breakers
   */
  static resetAll() {
    CircuitBreakerRegistry.breakers.forEach(breaker => breaker.reset());
  }
}

// Export a singleton instance for the relationship memory circuit breaker
export const relationshipCircuitBreaker = new CircuitBreaker('relationship_memory', {
  failureThreshold: 5,
  resetTimeout: 60000, // 1 minute
  halfOpenSuccessThreshold: 2
});
