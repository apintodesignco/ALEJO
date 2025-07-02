/**
 * ALEJO IndexedDB Storage Adapter
 * 
 * Provides persistent storage using the browser's IndexedDB API.
 * This adapter is optimized for storing larger datasets and
 * structured data with efficient querying capabilities.
 */

import { StorageAdapter } from './storage-adapter.js';

// Database configuration
const DB_NAME = 'alejo_memory';
const DB_VERSION = 1;

/**
 * IndexedDB implementation of the storage adapter
 */
export class IndexedDBAdapter extends StorageAdapter {
  /**
   * Create a new IndexedDB adapter
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    super();
    this.dbName = options.dbName || DB_NAME;
    this.dbVersion = options.dbVersion || DB_VERSION;
    this.db = null;
    this.isInitialized = false;
    this.pendingOperations = [];
  }

  /**
   * Initialize the IndexedDB database
   * @param {Object} options - Configuration options
   * @returns {Promise<boolean>} - Success status
   */
  async initialize(options = {}) {
    try {
      // Check if IndexedDB is available
      if (!window.indexedDB) {
        console.error('IndexedDB is not supported in this browser');
        return false;
      }

      // Open the database
      return new Promise((resolve, reject) => {
        const request = window.indexedDB.open(this.dbName, this.dbVersion);

        request.onerror = (event) => {
          console.error('Failed to open IndexedDB:', event.target.error);
          reject(event.target.error);
        };

        request.onsuccess = (event) => {
          this.db = event.target.result;
          this.isInitialized = true;
          
          // Process any operations that were queued during initialization
          this._processPendingOperations();
          
          console.log(`IndexedDB '${this.dbName}' opened successfully`);
          resolve(true);
        };

        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          
          // Create object stores for standard namespaces if they don't exist
          const standardNamespaces = [
            'user_preferences',
            'app_state',
            'user_data',
            'cache',
            'analytics'
          ];
          
          for (const namespace of standardNamespaces) {
            if (!db.objectStoreNames.contains(namespace)) {
              db.createObjectStore(namespace);
            }
          }
        };
      });
    } catch (error) {
      console.error('Error initializing IndexedDB:', error);
      return false;
    }
  }

  /**
   * Process any operations that were queued during initialization
   * @private
   */
  async _processPendingOperations() {
    while (this.pendingOperations.length > 0) {
      const operation = this.pendingOperations.shift();
      try {
        const result = await operation.method.apply(this, operation.args);
        operation.resolve(result);
      } catch (error) {
        operation.reject(error);
      }
    }
  }

  /**
   * Ensure the database is initialized before performing operations
   * @param {Function} operation - Function to execute
   * @param {Array} args - Arguments for the function
   * @returns {Promise<any>} - Operation result
   * @private
   */
  async _ensureInitialized(operation, args) {
    if (!this.isInitialized) {
      return new Promise((resolve, reject) => {
        this.pendingOperations.push({
          method: operation,
          args,
          resolve,
          reject
        });
      });
    }
    return operation.apply(this, args);
  }

  /**
   * Get an object store transaction
   * @param {string} namespace - Store name
   * @param {string} mode - Transaction mode ('readonly' or 'readwrite')
   * @returns {IDBObjectStore} - Object store
   * @private
   */
  _getStore(namespace, mode = 'readonly') {
    // Create the object store if it doesn't exist
    if (!this.db.objectStoreNames.contains(namespace)) {
      const version = this.db.version + 1;
      this.db.close();
      
      return new Promise((resolve, reject) => {
        const request = window.indexedDB.open(this.dbName, version);
        
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          db.createObjectStore(namespace);
        };
        
        request.onsuccess = (event) => {
          this.db = event.target.result;
          const transaction = this.db.transaction(namespace, mode);
          resolve(transaction.objectStore(namespace));
        };
        
        request.onerror = (event) => {
          reject(event.target.error);
        };
      });
    }
    
    const transaction = this.db.transaction(namespace, mode);
    return transaction.objectStore(namespace);
  }

  /**
   * Store data in IndexedDB
   * @param {string} namespace - Data category/collection
   * @param {string} key - Unique identifier
   * @param {any} data - Data to store
   * @param {Object} options - Storage options
   * @returns {Promise<boolean>} - Success status
   */
  async set(namespace, key, data, options = {}) {
    return this._ensureInitialized(async function(namespace, key, data, options) {
      try {
        const store = await this._getStore(namespace, 'readwrite');
        
        return new Promise((resolve, reject) => {
          // Add metadata if enabled
          const valueToStore = options.includeMetadata ? {
            value: data,
            metadata: {
              created: Date.now(),
              updated: Date.now(),
              size: JSON.stringify(data).length,
              type: typeof data
            }
          } : data;
          
          const request = store.put(valueToStore, key);
          
          request.onsuccess = () => resolve(true);
          request.onerror = (event) => {
            console.error(`Error storing data in '${namespace}/${key}':`, event.target.error);
            reject(event.target.error);
          };
        });
      } catch (error) {
        console.error(`Error in set('${namespace}', '${key}'):`, error);
        return false;
      }
    }, [namespace, key, data, options]);
  }

  /**
   * Retrieve data from IndexedDB
   * @param {string} namespace - Data category/collection
   * @param {string} key - Unique identifier
   * @param {Object} options - Retrieval options
   * @returns {Promise<any>} - Retrieved data or null if not found
   */
  async get(namespace, key, options = {}) {
    return this._ensureInitialized(async function(namespace, key, options) {
      try {
        const store = await this._getStore(namespace, 'readonly');
        
        return new Promise((resolve, reject) => {
          const request = store.get(key);
          
          request.onsuccess = () => {
            const result = request.result;
            
            // Handle metadata if present
            if (result && result.metadata && result.value !== undefined) {
              resolve(options.includeMetadata ? result : result.value);
            } else {
              resolve(result || null);
            }
          };
          
          request.onerror = (event) => {
            console.error(`Error retrieving '${namespace}/${key}':`, event.target.error);
            reject(event.target.error);
          };
        });
      } catch (error) {
        console.error(`Error in get('${namespace}', '${key}'):`, error);
        return null;
      }
    }, [namespace, key, options]);
  }

  /**
   * Check if a key exists in IndexedDB
   * @param {string} namespace - Data category/collection
   * @param {string} key - Unique identifier
   * @returns {Promise<boolean>} - Whether the key exists
   */
  async has(namespace, key) {
    return this._ensureInitialized(async function(namespace, key) {
      try {
        const value = await this.get(namespace, key);
        return value !== null;
      } catch (error) {
        console.error(`Error in has('${namespace}', '${key}'):`, error);
        return false;
      }
    }, [namespace, key]);
  }

  /**
   * Delete data from IndexedDB
   * @param {string} namespace - Data category/collection
   * @param {string} key - Unique identifier
   * @returns {Promise<boolean>} - Success status
   */
  async delete(namespace, key) {
    return this._ensureInitialized(async function(namespace, key) {
      try {
        const store = await this._getStore(namespace, 'readwrite');
        
        return new Promise((resolve, reject) => {
          const request = store.delete(key);
          
          request.onsuccess = () => resolve(true);
          request.onerror = (event) => {
            console.error(`Error deleting '${namespace}/${key}':`, event.target.error);
            reject(event.target.error);
          };
        });
      } catch (error) {
        console.error(`Error in delete('${namespace}', '${key}'):`, error);
        return false;
      }
    }, [namespace, key]);
  }

  /**
   * Clear all data in a namespace
   * @param {string} namespace - Data category/collection to clear
   * @returns {Promise<boolean>} - Success status
   */
  async clear(namespace) {
    return this._ensureInitialized(async function(namespace) {
      try {
        const store = await this._getStore(namespace, 'readwrite');
        
        return new Promise((resolve, reject) => {
          const request = store.clear();
          
          request.onsuccess = () => resolve(true);
          request.onerror = (event) => {
            console.error(`Error clearing namespace '${namespace}':`, event.target.error);
            reject(event.target.error);
          };
        });
      } catch (error) {
        console.error(`Error in clear('${namespace}'):`, error);
        return false;
      }
    }, [namespace]);
  }

  /**
   * List all keys in a namespace
   * @param {string} namespace - Data category/collection
   * @param {Object} options - Listing options (pagination, etc.)
   * @returns {Promise<Array<string>>} - Array of keys
   */
  async keys(namespace, options = {}) {
    return this._ensureInitialized(async function(namespace, options) {
      try {
        const store = await this._getStore(namespace, 'readonly');
        
        return new Promise((resolve, reject) => {
          const keys = [];
          const request = store.openCursor();
          
          request.onsuccess = (event) => {
            const cursor = event.target.result;
            
            if (cursor) {
              keys.push(cursor.key);
              cursor.continue();
            } else {
              resolve(keys);
            }
          };
          
          request.onerror = (event) => {
            console.error(`Error listing keys in '${namespace}':`, event.target.error);
            reject(event.target.error);
          };
        });
      } catch (error) {
        console.error(`Error in keys('${namespace}'):`, error);
        return [];
      }
    }, [namespace, options]);
  }

  /**
   * Get all entries in a namespace
   * @param {string} namespace - Data category/collection
   * @param {Object} options - Query options (pagination, filtering)
   * @returns {Promise<Array<{key: string, value: any}>>} - Array of entries
   */
  async getAll(namespace, options = {}) {
    return this._ensureInitialized(async function(namespace, options) {
      try {
        const store = await this._getStore(namespace, 'readonly');
        
        return new Promise((resolve, reject) => {
          const entries = [];
          const request = store.openCursor();
          
          request.onsuccess = (event) => {
            const cursor = event.target.result;
            
            if (cursor) {
              let value = cursor.value;
              
              // Handle metadata if present
              if (value && value.metadata && value.value !== undefined && !options.includeMetadata) {
                value = value.value;
              }
              
              entries.push({ key: cursor.key, value });
              cursor.continue();
            } else {
              resolve(entries);
            }
          };
          
          request.onerror = (event) => {
            console.error(`Error getting all entries in '${namespace}':`, event.target.error);
            reject(event.target.error);
          };
        });
      } catch (error) {
        console.error(`Error in getAll('${namespace}'):`, error);
        return [];
      }
    }, [namespace, options]);
  }

  /**
   * Get the total size of stored data
   * @param {string} namespace - Optional namespace to check size for
   * @returns {Promise<number>} - Size in bytes
   */
  async getSize(namespace = null) {
    return this._ensureInitialized(async function(namespace) {
      try {
        // If namespace is specified, get size for that namespace only
        if (namespace) {
          const entries = await this.getAll(namespace, { includeMetadata: true });
          
          return entries.reduce((total, entry) => {
            const size = entry.value && entry.value.metadata && entry.value.metadata.size 
              ? entry.value.metadata.size 
              : JSON.stringify(entry.value).length;
            
            return total + size;
          }, 0);
        }
        
        // Otherwise, get size for all namespaces
        const namespaces = Array.from(this.db.objectStoreNames);
        let totalSize = 0;
        
        for (const ns of namespaces) {
          const nsSize = await this.getSize(ns);
          totalSize += nsSize;
        }
        
        return totalSize;
      } catch (error) {
        console.error(`Error in getSize(${namespace}):`, error);
        return 0;
      }
    }, [namespace]);
  }

  /**
   * Check if IndexedDB is available
   * @returns {Promise<boolean>} - Whether storage is available
   */
  async isAvailable() {
    try {
      return !!window.indexedDB;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get storage quota information
   * @returns {Promise<{used: number, total: number}>} - Used and total space in bytes
   */
  async getQuota() {
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        return {
          used: estimate.usage || 0,
          total: estimate.quota || 0
        };
      }
      
      // Fallback: use our own size calculation for used space
      const used = await this.getSize();
      return {
        used,
        total: Number.MAX_SAFE_INTEGER // Unknown total quota
      };
    } catch (error) {
      console.error('Error getting quota information:', error);
      return { used: 0, total: 0 };
    }
  }
}
