/**
 * ALEJO Cache Manager
 * 
 * Provides a flexible caching mechanism with TTL support for various
 * application components to improve performance.
 * 
 * @module cache-manager
 */

import { auditTrail } from './audit-trail.js';

/**
 * Cache implementation with TTL support
 */
export class Cache {
  /**
   * Create a new cache
   * @param {string} name - Identifier for this cache
   * @param {Object} options - Cache configuration
   * @param {number} options.defaultTtl - Default time-to-live in milliseconds
   * @param {number} options.maxSize - Maximum number of items to store
   * @param {boolean} options.trackStats - Whether to track cache statistics
   */
  constructor(name, options = {}) {
    this.name = name;
    this.cache = new Map();
    this.defaultTtl = options.defaultTtl || 60000; // Default 1 minute
    this.maxSize = options.maxSize || 1000;
    this.trackStats = options.trackStats !== false;
    
    // Cache statistics
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0,
      expirations: 0
    };
    
    // Register with registry
    CacheRegistry.register(this);
  }
  
  /**
   * Get an item from the cache
   * @param {string} key - Cache key
   * @returns {*} Cached value or undefined if not found or expired
   */
  get(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      if (this.trackStats) this.stats.misses++;
      return undefined;
    }
    
    // Check if expired
    if (item.expiry && item.expiry < Date.now()) {
      this.delete(key);
      if (this.trackStats) this.stats.expirations++;
      return undefined;
    }
    
    if (this.trackStats) this.stats.hits++;
    return item.value;
  }
  
  /**
   * Set an item in the cache
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number} ttl - Time-to-live in milliseconds (optional)
   */
  set(key, value, ttl) {
    // Evict items if cache is full
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictOldest();
    }
    
    const expiry = ttl || this.defaultTtl ? Date.now() + (ttl || this.defaultTtl) : null;
    
    this.cache.set(key, {
      value,
      expiry,
      created: Date.now()
    });
    
    if (this.trackStats) this.stats.sets++;
  }
  
  /**
   * Check if an item exists in the cache and is not expired
   * @param {string} key - Cache key
   * @returns {boolean} True if item exists and is valid
   */
  has(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      return false;
    }
    
    // Check if expired
    if (item.expiry && item.expiry < Date.now()) {
      this.delete(key);
      return false;
    }
    
    return true;
  }
  
  /**
   * Delete an item from the cache
   * @param {string} key - Cache key
   * @returns {boolean} True if item was deleted
   */
  delete(key) {
    return this.cache.delete(key);
  }
  
  /**
   * Clear all items from the cache
   */
  clear() {
    this.cache.clear();
    
    // Reset statistics
    if (this.trackStats) {
      this.stats = {
        hits: 0,
        misses: 0,
        sets: 0,
        evictions: 0,
        expirations: 0
      };
    }
  }
  
  /**
   * Evict the oldest item from the cache
   * @private
   */
  evictOldest() {
    let oldestKey = null;
    let oldestTime = Infinity;
    
    for (const [key, item] of this.cache.entries()) {
      if (item.created < oldestTime) {
        oldestKey = key;
        oldestTime = item.created;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
      if (this.trackStats) this.stats.evictions++;
    }
  }
  
  /**
   * Remove all expired items from the cache
   * @returns {number} Number of items removed
   */
  prune() {
    let removed = 0;
    const now = Date.now();
    
    for (const [key, item] of this.cache.entries()) {
      if (item.expiry && item.expiry < now) {
        this.cache.delete(key);
        removed++;
        if (this.trackStats) this.stats.expirations++;
      }
    }
    
    return removed;
  }
  
  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    if (!this.trackStats) {
      return { enabled: false };
    }
    
    const hitRatio = this.stats.hits + this.stats.misses > 0 
      ? this.stats.hits / (this.stats.hits + this.stats.misses)
      : 0;
    
    return {
      ...this.stats,
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRatio,
      hitRatioPercent: (hitRatio * 100).toFixed(2) + '%'
    };
  }
  
  /**
   * Get a wrapped function that uses the cache
   * @param {Function} fn - Function to wrap
   * @param {Object} options - Options
   * @param {Function} options.keyFn - Function to generate cache key from arguments
   * @param {number} options.ttl - TTL for cached results
   * @returns {Function} Wrapped function
   */
  memoize(fn, options = {}) {
    const cache = this;
    const keyFn = options.keyFn || ((...args) => JSON.stringify(args));
    const ttl = options.ttl || this.defaultTtl;
    
    return async function(...args) {
      const key = keyFn(...args);
      
      if (cache.has(key)) {
        return cache.get(key);
      }
      
      const result = await fn.apply(this, args);
      cache.set(key, result, ttl);
      return result;
    };
  }
}

/**
 * Registry to track all caches in the application
 */
export class CacheRegistry {
  static caches = new Map();
  
  /**
   * Register a cache
   * @param {Cache} cache - Cache to register
   */
  static register(cache) {
    CacheRegistry.caches.set(cache.name, cache);
  }
  
  /**
   * Get a cache by name
   * @param {string} name - Cache name
   * @returns {Cache|undefined} The cache or undefined
   */
  static get(name) {
    return CacheRegistry.caches.get(name);
  }
  
  /**
   * Get statistics for all caches
   * @returns {Object} Statistics for all caches
   */
  static getStats() {
    const stats = {};
    CacheRegistry.caches.forEach((cache, name) => {
      stats[name] = cache.getStats();
    });
    return stats;
  }
  
  /**
   * Clear all caches
   */
  static clearAll() {
    CacheRegistry.caches.forEach(cache => cache.clear());
  }
  
  /**
   * Prune expired items from all caches
   * @returns {Object} Number of items removed from each cache
   */
  static pruneAll() {
    const results = {};
    CacheRegistry.caches.forEach((cache, name) => {
      results[name] = cache.prune();
    });
    return results;
  }
}

// Export singleton instances for common caches
export const relationshipCache = new Cache('relationship', {
  defaultTtl: 5 * 60 * 1000, // 5 minutes
  maxSize: 500,
  trackStats: true
});

export const preferenceCache = new Cache('preference', {
  defaultTtl: 10 * 60 * 1000, // 10 minutes
  maxSize: 1000,
  trackStats: true
});
