/**
 * @file network-status.js
 * @description Network status monitoring for progressive enhancement
 * @module core/progressive-enhancement/network-status
 * @author ALEJO Development Team
 * @copyright 2025 ALEJO Project
 * @license MIT
 */

import { publish } from '../events.js';

// Network status constants
const NETWORK_STATUS = Object.freeze({
  ONLINE: 'online',
  OFFLINE: 'offline',
  SLOW: 'slow',
  FAST: 'fast',
  UNKNOWN: 'unknown'
});

/**
 * Network status monitoring service
 */
export class NetworkStatus {
  static isInitialized = false;
  static currentStatus = NETWORK_STATUS.UNKNOWN;
  static lastCheckTime = 0;
  static connectionType = null;
  static observers = [];

  /**
   * Initialize network status monitoring
   * 
   * @returns {Promise<void>}
   */
  static async initialize() {
    if (this.isInitialized) return;
    
    // Check initial status
    await this.check();
    
    // Set up event listeners
    window.addEventListener('online', () => this.handleOnlineStatus(true));
    window.addEventListener('offline', () => this.handleOnlineStatus(false));
    
    // Monitor connection quality
    if ('connection' in navigator) {
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      
      if (connection) {
        connection.addEventListener('change', () => {
          this.handleConnectionChange(connection);
        });
        
        // Initial check
        this.handleConnectionChange(connection);
      }
    }
    
    // Set up periodic checks for connection quality
    setInterval(() => this.checkConnectionQuality(), 60000); // Check every minute
    
    this.isInitialized = true;
    console.log('[NetworkStatus] Monitoring initialized');
  }
  
  /**
   * Check current network status
   * 
   * @returns {Promise<Object>} - Network status information
   */
  static async check() {
    try {
      // Initialize monitoring if not already done
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      // Get connection type if available
      let connectionType = 'unknown';
      let effectiveType = 'unknown';
      
      if ('connection' in navigator) {
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        
        if (connection) {
          connectionType = connection.type || 'unknown';
          effectiveType = connection.effectiveType || 'unknown';
          
          // Store connection object for future reference
          this.connectionType = connection;
        }
      }
      
      // Determine status based on navigator.onLine
      let status = navigator.onLine ? NETWORK_STATUS.ONLINE : NETWORK_STATUS.OFFLINE;
      
      // If online, further categorize based on connection quality
      if (status === NETWORK_STATUS.ONLINE) {
        // Check connection speed
        if (effectiveType === '4g') {
          status = NETWORK_STATUS.FAST;
        } else if (effectiveType === '3g' || effectiveType === '2g' || effectiveType === 'slow-2g') {
          status = NETWORK_STATUS.SLOW;
        }
        
        // If we have no effectiveType info, estimate using RTT test
        if (effectiveType === 'unknown' && status === NETWORK_STATUS.ONLINE) {
          const quality = await this.estimateConnectionQuality();
          status = quality.isGood ? NETWORK_STATUS.FAST : NETWORK_STATUS.SLOW;
        }
      }
      
      // Update current status if changed
      if (this.currentStatus !== status) {
        this.currentStatus = status;
        
        // Publish event if status changed
        publish('network:status-changed', {
          status,
          connectionType,
          effectiveType,
          timestamp: Date.now()
        });
      }
      
      this.lastCheckTime = Date.now();
      
      return {
        status,
        connectionType,
        effectiveType,
        timestamp: this.lastCheckTime,
        isOnline: navigator.onLine
      };
    } catch (error) {
      console.error('[NetworkStatus] Error checking network status:', error);
      
      // Default to online but unknown quality in case of error
      return {
        status: navigator.onLine ? NETWORK_STATUS.ONLINE : NETWORK_STATUS.OFFLINE,
        connectionType: 'unknown',
        effectiveType: 'unknown',
        timestamp: Date.now(),
        isOnline: navigator.onLine
      };
    }
  }
  
  /**
   * Handle online/offline status changes
   * 
   * @param {boolean} isOnline - True if online
   */
  static handleOnlineStatus(isOnline) {
    const status = isOnline ? NETWORK_STATUS.ONLINE : NETWORK_STATUS.OFFLINE;
    
    // Only publish if status actually changed
    if (this.currentStatus !== status) {
      this.currentStatus = status;
      
      publish('network:status-changed', {
        status,
        timestamp: Date.now()
      });
      
      console.log(`[NetworkStatus] Connection status: ${status}`);
    }
  }
  
  /**
   * Handle connection change events
   * 
   * @param {Object} connection - Network Information API connection object
   */
  static handleConnectionChange(connection) {
    let status;
    
    if (!navigator.onLine) {
      status = NETWORK_STATUS.OFFLINE;
    } else {
      // Categorize connection based on effective type
      switch (connection.effectiveType) {
        case '4g':
          status = NETWORK_STATUS.FAST;
          break;
        case '3g':
          // 3g could be considered fast or slow depending on requirements
          status = NETWORK_STATUS.SLOW;
          break;
        case '2g':
        case 'slow-2g':
          status = NETWORK_STATUS.SLOW;
          break;
        default:
          status = NETWORK_STATUS.ONLINE; // Default to just 'online' if we can't determine speed
      }
    }
    
    // Only publish if status actually changed
    if (this.currentStatus !== status) {
      this.currentStatus = status;
      
      publish('network:status-changed', {
        status,
        connectionType: connection.type || 'unknown',
        effectiveType: connection.effectiveType || 'unknown',
        downlink: connection.downlink,
        rtt: connection.rtt,
        timestamp: Date.now()
      });
      
      console.log(`[NetworkStatus] Connection changed: ${status} (${connection.effectiveType || 'unknown'})`);
    }
  }
  
  /**
   * Check connection quality using a simple fetch request
   * 
   * @returns {Promise<Object>} - Connection quality data
   */
  static async estimateConnectionQuality() {
    try {
      // Use a tiny request to check connection speed
      const start = performance.now();
      const response = await fetch('/ping.txt', {
        method: 'HEAD',
        cache: 'no-store',
        timeout: 5000 // 5 second timeout
      });
      const end = performance.now();
      
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      
      // Calculate round-trip time
      const rtt = end - start;
      
      // Classify connection (RTT under 300ms is considered good)
      const isGood = rtt < 300;
      
      return {
        rtt,
        isGood,
        timestamp: Date.now()
      };
    } catch (error) {
      console.warn('[NetworkStatus] Error estimating connection quality:', error);
      
      // Default to medium quality on error
      return {
        rtt: 300,
        isGood: true,
        timestamp: Date.now(),
        error: error.message
      };
    }
  }
  
  /**
   * Periodically check connection quality
   */
  static async checkConnectionQuality() {
    // Skip check if offline
    if (!navigator.onLine) return;
    
    try {
      const quality = await this.estimateConnectionQuality();
      const newStatus = quality.isGood ? NETWORK_STATUS.FAST : NETWORK_STATUS.SLOW;
      
      // Only update if the status changed
      if (this.currentStatus !== newStatus && 
          this.currentStatus !== NETWORK_STATUS.OFFLINE) {
        
        this.currentStatus = newStatus;
        
        publish('network:status-changed', {
          status: newStatus,
          rtt: quality.rtt,
          timestamp: Date.now()
        });
        
        console.log(`[NetworkStatus] Connection quality updated: ${newStatus}`);
      }
    } catch (error) {
      console.error('[NetworkStatus] Error checking connection quality:', error);
    }
  }
  
  /**
   * Subscribe to network status changes
   * 
   * @param {Function} callback - Callback function
   * @returns {number} - Observer ID
   */
  static subscribe(callback) {
    const observerId = Date.now() + Math.floor(Math.random() * 1000);
    this.observers.push({ id: observerId, callback });
    return observerId;
  }
  
  /**
   * Unsubscribe from network status changes
   * 
   * @param {number} observerId - Observer ID
   * @returns {boolean} - Success status
   */
  static unsubscribe(observerId) {
    const initialLength = this.observers.length;
    this.observers = this.observers.filter(observer => observer.id !== observerId);
    return this.observers.length !== initialLength;
  }
}

// Export network status constants
export { NETWORK_STATUS };

export default NetworkStatus;
