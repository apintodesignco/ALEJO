/**
 * @file storage-capabilities.js
 * @description Detects and monitors storage capabilities for progressive enhancement
 * @module core/progressive-enhancement/storage-capabilities
 * @author ALEJO Development Team
 * @copyright 2025 ALEJO Project
 * @license MIT
 */

import { publish } from '../events.js';

/**
 * Storage types supported by the system
 */
export const STORAGE_TYPES = Object.freeze({
  LOCAL_STORAGE: 'localStorage',
  SESSION_STORAGE: 'sessionStorage',
  INDEXED_DB: 'indexedDB',
  CACHE_API: 'cacheAPI',
  FILE_SYSTEM: 'fileSystem'
});

/**
 * Storage capabilities detection and monitoring service
 */
export class StorageCapabilities {
  static isInitialized = false;
  static storageSystems = new Map();
  static quotaInfo = null;
  static checkInterval = null;
  
  /**
   * Initialize storage capability detection
   * 
   * @returns {Promise<void>}
   */
  static async initialize() {
    if (this.isInitialized) return;
    
    // Perform initial check
    await this.check();
    
    // Set up monitoring for storage changes
    this.checkInterval = setInterval(() => this.monitorStorageUsage(), 60000); // Check every minute
    
    // Set up event listeners for storage events
    window.addEventListener('storage', (event) => this.handleStorageEvent(event));
    
    this.isInitialized = true;
    console.log('[StorageCapabilities] Monitoring initialized');
  }
  
  /**
   * Check all storage capabilities
   * 
   * @param {boolean} detailed - Whether to include detailed capacity information
   * @returns {Promise<Object>} - Storage capabilities information
   */
  static async check(detailed = true) {
    try {
      // Initialize if not already done
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      const capabilities = {
        timestamp: Date.now(),
        available: true,
        systems: {}
      };
      
      // Check localStorage availability and capacity
      const localStorage = await this.checkLocalStorage();
      capabilities.systems[STORAGE_TYPES.LOCAL_STORAGE] = localStorage;
      this.storageSystems.set(STORAGE_TYPES.LOCAL_STORAGE, localStorage);
      
      // Check sessionStorage availability and capacity
      const sessionStorage = await this.checkSessionStorage();
      capabilities.systems[STORAGE_TYPES.SESSION_STORAGE] = sessionStorage;
      this.storageSystems.set(STORAGE_TYPES.SESSION_STORAGE, sessionStorage);
      
      // Check IndexedDB availability
      const indexedDB = await this.checkIndexedDB();
      capabilities.systems[STORAGE_TYPES.INDEXED_DB] = indexedDB;
      this.storageSystems.set(STORAGE_TYPES.INDEXED_DB, indexedDB);
      
      // Check Cache API availability
      const cacheAPI = await this.checkCacheAPI();
      capabilities.systems[STORAGE_TYPES.CACHE_API] = cacheAPI;
      this.storageSystems.set(STORAGE_TYPES.CACHE_API, cacheAPI);
      
      // Check FileSystem API availability
      const fileSystem = await this.checkFileSystem();
      capabilities.systems[STORAGE_TYPES.FILE_SYSTEM] = fileSystem;
      this.storageSystems.set(STORAGE_TYPES.FILE_SYSTEM, fileSystem);
      
      // Check storage quota information if detailed info is requested
      if (detailed) {
        const quotaInfo = await this.checkStorageQuota();
        capabilities.quota = quotaInfo;
        this.quotaInfo = quotaInfo;
      }
      
      // Determine overall availability based on critical storage systems
      capabilities.available = localStorage.available && 
                              (indexedDB.available || cacheAPI.available);
      
      // Publish storage capabilities update
      publish('storage:capabilities-updated', capabilities);
      
      return capabilities;
    } catch (error) {
      console.error('[StorageCapabilities] Error checking storage capabilities:', error);
      
      // Default values in case of error
      const defaultCapabilities = {
        timestamp: Date.now(),
        available: true, // Assume storage is available until proven otherwise
        systems: {
          [STORAGE_TYPES.LOCAL_STORAGE]: { available: true, capacity: 0 },
          [STORAGE_TYPES.SESSION_STORAGE]: { available: true, capacity: 0 },
          [STORAGE_TYPES.INDEXED_DB]: { available: true },
          [STORAGE_TYPES.CACHE_API]: { available: false },
          [STORAGE_TYPES.FILE_SYSTEM]: { available: false }
        },
        quota: {
          usage: 0,
          quota: 0,
          percentage: 0
        },
        error: error.message
      };
      
      return defaultCapabilities;
    }
  }
  
  /**
   * Check localStorage availability and capacity
   * 
   * @returns {Promise<Object>} - localStorage capabilities
   */
  static async checkLocalStorage() {
    try {
      // Check if localStorage is available
      if (!window.localStorage) {
        return { available: false };
      }
      
      // Try storing a test value
      const testKey = '__storage_test__';
      localStorage.setItem(testKey, testKey);
      localStorage.removeItem(testKey);
      
      // Estimate capacity
      const capacity = await this.estimateStorageCapacity('localStorage');
      
      return {
        available: true,
        capacity: capacity, // in bytes
        isPersistent: true
      };
    } catch (error) {
      console.warn('[StorageCapabilities] localStorage not available:', error);
      return { available: false, error: error.message };
    }
  }
  
  /**
   * Check sessionStorage availability and capacity
   * 
   * @returns {Promise<Object>} - sessionStorage capabilities
   */
  static async checkSessionStorage() {
    try {
      // Check if sessionStorage is available
      if (!window.sessionStorage) {
        return { available: false };
      }
      
      // Try storing a test value
      const testKey = '__storage_test__';
      sessionStorage.setItem(testKey, testKey);
      sessionStorage.removeItem(testKey);
      
      // Estimate capacity
      const capacity = await this.estimateStorageCapacity('sessionStorage');
      
      return {
        available: true,
        capacity: capacity, // in bytes
        isPersistent: false
      };
    } catch (error) {
      console.warn('[StorageCapabilities] sessionStorage not available:', error);
      return { available: false, error: error.message };
    }
  }
  
  /**
   * Check IndexedDB availability
   * 
   * @returns {Promise<Object>} - IndexedDB capabilities
   */
  static async checkIndexedDB() {
    return new Promise((resolve) => {
      try {
        // Check if IndexedDB is available
        if (!window.indexedDB) {
          resolve({ available: false });
          return;
        }
        
        // Try opening a test database
        const request = indexedDB.open('__storage_test__', 1);
        
        request.onerror = () => {
          resolve({ available: false, error: 'Error opening IndexedDB' });
        };
        
        request.onsuccess = (event) => {
          const db = event.target.result;
          db.close();
          
          // Attempt to delete the test database
          const deleteRequest = indexedDB.deleteDatabase('__storage_test__');
          
          deleteRequest.onsuccess = () => {
            resolve({
              available: true,
              isPersistent: true
            });
          };
          
          deleteRequest.onerror = () => {
            console.warn('[StorageCapabilities] Error deleting test IndexedDB database');
            resolve({
              available: true,
              isPersistent: true
            });
          };
        };
        
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          // Create a test object store
          db.createObjectStore('testStore');
        };
      } catch (error) {
        console.warn('[StorageCapabilities] IndexedDB not available:', error);
        resolve({ available: false, error: error.message });
      }
    });
  }
  
  /**
   * Check Cache API availability
   * 
   * @returns {Promise<Object>} - Cache API capabilities
   */
  static async checkCacheAPI() {
    try {
      // Check if Cache API is available
      if (!('caches' in window)) {
        return { available: false };
      }
      
      // Try opening a test cache
      const cache = await caches.open('__storage_test__');
      
      // Try storing a test response
      const testResponse = new Response('Test data');
      await cache.put('/test', testResponse);
      
      // Try retrieving the test response
      const cachedResponse = await cache.match('/test');
      const testResult = await cachedResponse.text() === 'Test data';
      
      // Delete the test cache
      await caches.delete('__storage_test__');
      
      return {
        available: testResult,
        isPersistent: true
      };
    } catch (error) {
      console.warn('[StorageCapabilities] Cache API not available:', error);
      return { available: false, error: error.message };
    }
  }
  
  /**
   * Check FileSystem API availability
   * 
   * @returns {Promise<Object>} - FileSystem capabilities
   */
  static async checkFileSystem() {
    try {
      // Check if File System Access API is available
      if (!('showDirectoryPicker' in window) && !('showOpenFilePicker' in window)) {
        return { available: false };
      }
      
      // We can't automatically test file system access as it requires user interaction
      // Just report that the API is available
      return {
        available: true,
        requiresPermission: true,
        isPersistent: true
      };
    } catch (error) {
      console.warn('[StorageCapabilities] FileSystem API not available:', error);
      return { available: false, error: error.message };
    }
  }
  
  /**
   * Check storage quota information using StorageManager API
   * 
   * @returns {Promise<Object>} - Quota information
   */
  static async checkStorageQuota() {
    try {
      // Check if StorageManager API is available
      if (!('storage' in navigator && 'estimate' in navigator.storage)) {
        return {
          available: false,
          usage: 0,
          quota: 0,
          percentage: 0
        };
      }
      
      // Get storage estimate
      const estimate = await navigator.storage.estimate();
      
      return {
        available: true,
        usage: estimate.usage || 0, // bytes used
        quota: estimate.quota || 0, // bytes available
        percentage: estimate.quota ? (estimate.usage / estimate.quota) * 100 : 0
      };
    } catch (error) {
      console.warn('[StorageCapabilities] Storage quota check failed:', error);
      return {
        available: false,
        usage: 0,
        quota: 0,
        percentage: 0,
        error: error.message
      };
    }
  }
  
  /**
   * Estimate storage capacity by attempting to store increasing amounts of data
   * 
   * @param {string} storageType - 'localStorage' or 'sessionStorage'
   * @returns {Promise<number>} - Estimated capacity in bytes
   */
  static async estimateStorageCapacity(storageType) {
    const storage = window[storageType];
    if (!storage) return 0;
    
    // Clear existing test keys if any exist from previous failed attempts
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && key.startsWith('__capacity_test__')) {
        storage.removeItem(key);
        i--;
      }
    }
    
    try {
      // Use binary search to estimate capacity
      // This is more efficient than linear testing
      let min = 0;
      let max = 10 * 1024 * 1024; // Start with 10MB as max
      const testData = 'A'.repeat(1024); // 1KB test data
      
      while (min <= max) {
        // Clear previous test data
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i);
          if (key && key.startsWith('__capacity_test__')) {
            storage.removeItem(key);
            i--;
          }
        }
        
        const mid = Math.floor((min + max) / 2);
        let success = true;
        
        try {
          // Try storing mid KB of data
          for (let i = 0; i < mid; i++) {
            storage.setItem(`__capacity_test__${i}`, testData);
          }
        } catch (e) {
          success = false;
        }
        
        if (success) {
          min = mid + 1;
        } else {
          max = mid - 1;
        }
        
        // Clean up
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i);
          if (key && key.startsWith('__capacity_test__')) {
            storage.removeItem(key);
            i--;
          }
        }
      }
      
      // Result in bytes (max KB * 1024)
      return max * 1024;
    } catch (error) {
      console.warn(`[StorageCapabilities] Error estimating ${storageType} capacity:`, error);
      
      // Clean up any leftover test items
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && key.startsWith('__capacity_test__')) {
          storage.removeItem(key);
          i--;
        }
      }
      
      return 0;
    }
  }
  
  /**
   * Monitor storage usage periodically
   */
  static async monitorStorageUsage() {
    try {
      // Check storage quota
      const quotaInfo = await this.checkStorageQuota();
      const previousQuota = this.quotaInfo;
      
      // Update stored quota info
      this.quotaInfo = quotaInfo;
      
      // If quota usage has changed significantly, publish an update
      if (previousQuota && 
          Math.abs(quotaInfo.percentage - previousQuota.percentage) > 5) {
        
        publish('storage:quota-changed', {
          previous: previousQuota,
          current: quotaInfo,
          timestamp: Date.now()
        });
        
        // If storage is getting full (>90%), publish a warning
        if (quotaInfo.percentage > 90) {
          publish('storage:quota-warning', {
            usage: quotaInfo.usage,
            quota: quotaInfo.quota,
            percentage: quotaInfo.percentage,
            timestamp: Date.now()
          });
          
          console.warn(`[StorageCapabilities] Storage almost full: ${quotaInfo.percentage.toFixed(1)}% used`);
        }
      }
    } catch (error) {
      console.error('[StorageCapabilities] Error monitoring storage usage:', error);
    }
  }
  
  /**
   * Handle storage events
   * 
   * @param {StorageEvent} event - Storage event
   */
  static handleStorageEvent(event) {
    // Publish storage change event
    publish('storage:item-changed', {
      key: event.key,
      oldValue: event.oldValue,
      newValue: event.newValue,
      storageArea: event.storageArea === localStorage ? 'localStorage' : 'sessionStorage',
      timestamp: Date.now()
    });
  }
  
  /**
   * Request persistent storage permission
   * This requires user interaction (e.g., within a click event handler)
   * 
   * @returns {Promise<boolean>} - Whether permission was granted
   */
  static async requestPersistentStorage() {
    try {
      // Check if the API is available
      if (!('storage' in navigator && 'persist' in navigator.storage)) {
        console.warn('[StorageCapabilities] Persistent storage API not available');
        return false;
      }
      
      // Request persistence
      const isPersisted = await navigator.storage.persist();
      
      if (isPersisted) {
        console.log('[StorageCapabilities] Storage persistence granted');
        
        publish('storage:persistence-granted', {
          timestamp: Date.now()
        });
      } else {
        console.warn('[StorageCapabilities] Storage persistence denied');
      }
      
      return isPersisted;
    } catch (error) {
      console.error('[StorageCapabilities] Error requesting persistence:', error);
      return false;
    }
  }
  
  /**
   * Check if storage is persisted (won't be cleared automatically)
   * 
   * @returns {Promise<boolean>} - Whether storage is persisted
   */
  static async isStoragePersisted() {
    try {
      // Check if the API is available
      if (!('storage' in navigator && 'persisted' in navigator.storage)) {
        return false;
      }
      
      return await navigator.storage.persisted();
    } catch (error) {
      console.error('[StorageCapabilities] Error checking persistence:', error);
      return false;
    }
  }
  
  /**
   * Calculate recommended storage usage based on available quota
   * 
   * @returns {Promise<Object>} - Recommended storage limits for different purposes
   */
  static async getRecommendedStorageLimits() {
    try {
      // Get current quota information
      const quota = await this.checkStorageQuota();
      
      // If no quota info is available, use conservative defaults
      if (!quota.available || !quota.quota) {
        return {
          cache: 5 * 1024 * 1024, // 5MB
          appData: 10 * 1024 * 1024, // 10MB
          userContent: 20 * 1024 * 1024, // 20MB
          total: 50 * 1024 * 1024 // 50MB
        };
      }
      
      // Calculate safe limits based on available quota
      // Use at most 80% of available quota to leave room for other site data
      const safeQuota = quota.quota * 0.8;
      const availableQuota = safeQuota - quota.usage;
      
      // Minimum sizes to ensure functionality
      const minCache = 1 * 1024 * 1024; // 1MB
      const minAppData = 2 * 1024 * 1024; // 2MB
      const minUserContent = 5 * 1024 * 1024; // 5MB
      
      // If available quota is below minimums, scale proportionally
      if (availableQuota < (minCache + minAppData + minUserContent)) {
        const totalMin = minCache + minAppData + minUserContent;
        const scaleFactor = availableQuota / totalMin;
        
        return {
          cache: Math.floor(minCache * scaleFactor),
          appData: Math.floor(minAppData * scaleFactor),
          userContent: Math.floor(minUserContent * scaleFactor),
          total: Math.floor(availableQuota)
        };
      }
      
      // Otherwise allocate based on typical usage patterns
      // 20% for cache, 30% for app data, 50% for user content
      return {
        cache: Math.floor(availableQuota * 0.2),
        appData: Math.floor(availableQuota * 0.3),
        userContent: Math.floor(availableQuota * 0.5),
        total: Math.floor(availableQuota)
      };
    } catch (error) {
      console.error('[StorageCapabilities] Error calculating recommended storage limits:', error);
      
      // Return conservative defaults on error
      return {
        cache: 5 * 1024 * 1024, // 5MB
        appData: 10 * 1024 * 1024, // 10MB
        userContent: 20 * 1024 * 1024, // 20MB
        total: 50 * 1024 * 1024 // 50MB
      };
    }
  }
}

export default StorageCapabilities;
