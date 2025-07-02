/**
 * ALEJO Privacy Guard
 * 
 * Provides secure data protection for user personalization data:
 * - Encryption/decryption of sensitive user data
 * - Secure storage interfaces for IndexedDB and localStorage
 * - Key management and secure access controls
 */

import { publish, subscribe } from '../core/events.js';

// Secure storage constants
const STORAGE_VERSION = 1;
const ENCRYPTION_ALGORITHM = 'AES-GCM';
const KEY_ALGORITHM = { name: 'PBKDF2', iterations: 100000, hash: 'SHA-256' };
const DB_NAME = 'alejo_secure_storage';
const USER_STORE = 'user_data';
const KEY_STORE = 'encryption_keys';

// State management
let initialized = false;
let masterKey = null;
let db = null;

/**
 * Initialize the privacy system
 * @param {Object} options - Initialization options
 * @returns {Promise<boolean>} Success status
 */
export async function initialize(options = {}) {
  console.log('Initializing ALEJO Privacy Guard');
  
  if (initialized) {
    console.warn('Privacy Guard already initialized');
    return true;
  }
  
  try {
    // Check for Web Crypto API support
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error('Web Crypto API not supported in this browser');
    }
    
    // Open IndexedDB
    db = await openDatabase();
    
    // Initialize or retrieve master key
    masterKey = await initializeMasterKey(options.userIdentifier);
    
    // Register event listeners
    subscribe('user:login', handleUserLogin);
    subscribe('user:logout', handleUserLogout);
    
    initialized = true;
    publish('privacy:initialized', { success: true });
    
    return true;
  } catch (error) {
    console.error('Failed to initialize Privacy Guard:', error);
    publish('privacy:error', { 
      type: 'initialization_failed', 
      message: error.message
    });
    return false;
  }
}

/**
 * Open and initialize the secure database
 * @returns {Promise<IDBDatabase>} IndexedDB database instance
 */
async function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, STORAGE_VERSION);
    
    request.onerror = (event) => {
      reject(new Error(`Database error: ${event.target.errorCode}`));
    };
    
    request.onsuccess = (event) => {
      resolve(event.target.result);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create object stores if they don't exist
      if (!db.objectStoreNames.contains(USER_STORE)) {
        db.createObjectStore(USER_STORE, { keyPath: 'id' });
      }
      
      if (!db.objectStoreNames.contains(KEY_STORE)) {
        db.createObjectStore(KEY_STORE, { keyPath: 'id' });
      }
    };
  });
}

/**
 * Initialize or retrieve the master encryption key
 * @param {string} userIdentifier - Optional user identifier
 * @returns {Promise<CryptoKey>} Master encryption key
 */
async function initializeMasterKey(userIdentifier = 'default_user') {
  try {
    // Try to retrieve existing key
    const storedKey = await getStoredKey(userIdentifier);
    if (storedKey) {
      return storedKey;
    }
    
    // Generate a new encryption key if none exists
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(userIdentifier),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );
    
    const key = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: KEY_ALGORITHM.iterations,
        hash: KEY_ALGORITHM.hash
      },
      keyMaterial,
      { name: ENCRYPTION_ALGORITHM, length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
    
    // Store the key securely
    await storeKey(userIdentifier, key, salt);
    
    return key;
  } catch (error) {
    console.error('Master key initialization failed:', error);
    throw new Error('Failed to initialize encryption key');
  }
}

/**
 * Retrieve a stored encryption key
 * @param {string} userId - User identifier
 * @returns {Promise<CryptoKey|null>} Retrieved key or null
 */
async function getStoredKey(userId) {
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction([KEY_STORE], 'readonly');
      const store = transaction.objectStore(KEY_STORE);
      const request = store.get(userId);
      
      request.onsuccess = async (event) => {
        if (!event.target.result) {
          resolve(null);
          return;
        }
        
        const { keyData, salt } = event.target.result;
        
        // Import the stored key
        const keyMaterial = await window.crypto.subtle.importKey(
          'raw',
          new TextEncoder().encode(userId),
          { name: 'PBKDF2' },
          false,
          ['deriveBits', 'deriveKey']
        );
        
        const key = await window.crypto.subtle.deriveKey(
          {
            name: 'PBKDF2',
            salt: new Uint8Array(salt),
            iterations: KEY_ALGORITHM.iterations,
            hash: KEY_ALGORITHM.hash
          },
          keyMaterial,
          { name: ENCRYPTION_ALGORITHM, length: 256 },
          true,
          ['encrypt', 'decrypt']
        );
        
        resolve(key);
      };
      
      request.onerror = (event) => {
        reject(new Error(`Key retrieval failed: ${event.target.errorCode}`));
      };
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Store an encryption key securely
 * @param {string} userId - User identifier
 * @param {CryptoKey} key - Encryption key to store
 * @param {Uint8Array} salt - Salt used for key derivation
 * @returns {Promise<boolean>} Success status
 */
async function storeKey(userId, key, salt) {
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction([KEY_STORE], 'readwrite');
      const store = transaction.objectStore(KEY_STORE);
      
      const request = store.put({
        id: userId,
        keyData: await window.crypto.subtle.exportKey('raw', key),
        salt: Array.from(salt),
        created: new Date().toISOString()
      });
      
      request.onsuccess = () => resolve(true);
      request.onerror = (event) => reject(new Error(`Key storage failed: ${event.target.errorCode}`));
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Encrypt data for secure storage
 * @param {Object|string} data - Data to encrypt
 * @returns {Promise<Object>} Encrypted data object with iv
 */
export async function encryptData(data) {
  if (!initialized) {
    throw new Error('Privacy Guard not initialized');
  }
  
  try {
    // Convert data to string if it's an object
    const dataString = typeof data === 'object' ? JSON.stringify(data) : String(data);
    
    // Generate an initialization vector
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    
    // Encrypt the data
    const encodedData = new TextEncoder().encode(dataString);
    const encryptedData = await window.crypto.subtle.encrypt(
      {
        name: ENCRYPTION_ALGORITHM,
        iv
      },
      masterKey,
      encodedData
    );
    
    // Return the encrypted data and IV
    return {
      data: new Uint8Array(encryptedData),
      iv: Array.from(iv),
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt previously encrypted data
 * @param {Object} encryptedData - Encrypted data object with iv
 * @returns {Promise<any>} Decrypted data
 */
export async function decryptData(encryptedData) {
  if (!initialized) {
    throw new Error('Privacy Guard not initialized');
  }
  
  try {
    const { data, iv } = encryptedData;
    
    // Decrypt the data
    const decryptedData = await window.crypto.subtle.decrypt(
      {
        name: ENCRYPTION_ALGORITHM,
        iv: new Uint8Array(iv)
      },
      masterKey,
      data instanceof Uint8Array ? data : new Uint8Array(data)
    );
    
    // Convert the decrypted data back to its original form
    const decodedString = new TextDecoder().decode(decryptedData);
    
    // Try to parse as JSON, fall back to string
    try {
      return JSON.parse(decodedString);
    } catch (e) {
      return decodedString;
    }
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Securely store data in the encrypted database
 * @param {string} key - Storage key
 * @param {any} data - Data to store
 * @param {Object} options - Storage options
 * @returns {Promise<boolean>} Success status
 */
export async function secureStore(key, data, options = {}) {
  if (!initialized) {
    throw new Error('Privacy Guard not initialized');
  }
  
  try {
    // Encrypt the data
    const encryptedData = await encryptData(data);
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([USER_STORE], 'readwrite');
      const store = transaction.objectStore(USER_STORE);
      
      const request = store.put({
        id: key,
        encrypted: encryptedData,
        category: options.category || 'general',
        metadata: {
          lastModified: new Date().toISOString(),
          dataType: typeof data,
          isObject: typeof data === 'object'
        }
      });
      
      request.onsuccess = () => {
        publish('privacy:data:stored', { key });
        resolve(true);
      };
      
      request.onerror = (event) => {
        reject(new Error(`Data storage failed: ${event.target.errorCode}`));
      };
    });
  } catch (error) {
    console.error('Secure storage failed:', error);
    throw new Error('Failed to securely store data');
  }
}

/**
 * Retrieve securely stored data
 * @param {string} key - Storage key
 * @returns {Promise<any>} Retrieved data
 */
export async function secureRetrieve(key) {
  if (!initialized) {
    throw new Error('Privacy Guard not initialized');
  }
  
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction([USER_STORE], 'readonly');
      const store = transaction.objectStore(USER_STORE);
      const request = store.get(key);
      
      request.onsuccess = async (event) => {
        if (!event.target.result) {
          resolve(null);
          return;
        }
        
        const { encrypted } = event.target.result;
        
        try {
          const decryptedData = await decryptData(encrypted);
          resolve(decryptedData);
        } catch (error) {
          reject(new Error(`Data decryption failed: ${error.message}`));
        }
      };
      
      request.onerror = (event) => {
        reject(new Error(`Data retrieval failed: ${event.target.errorCode}`));
      };
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Delete securely stored data
 * @param {string} key - Storage key
 * @returns {Promise<boolean>} Success status
 */
export async function secureDelete(key) {
  if (!initialized) {
    throw new Error('Privacy Guard not initialized');
  }
  
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction([USER_STORE], 'readwrite');
      const store = transaction.objectStore(USER_STORE);
      const request = store.delete(key);
      
      request.onsuccess = () => {
        publish('privacy:data:deleted', { key });
        resolve(true);
      };
      
      request.onerror = (event) => {
        reject(new Error(`Data deletion failed: ${event.target.errorCode}`));
      };
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * List all securely stored data keys by category
 * @param {string} category - Optional category filter
 * @returns {Promise<string[]>} Array of storage keys
 */
export async function secureListKeys(category = null) {
  if (!initialized) {
    throw new Error('Privacy Guard not initialized');
  }
  
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction([USER_STORE], 'readonly');
      const store = transaction.objectStore(USER_STORE);
      const request = store.openCursor();
      const keys = [];
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          if (!category || cursor.value.category === category) {
            keys.push({
              id: cursor.value.id,
              category: cursor.value.category,
              lastModified: cursor.value.metadata?.lastModified
            });
          }
          cursor.continue();
        } else {
          resolve(keys);
        }
      };
      
      request.onerror = (event) => {
        reject(new Error(`Failed to list keys: ${event.target.errorCode}`));
      };
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Clear all secure storage data (with confirmation)
 * @param {boolean} confirmed - Confirmation flag
 * @returns {Promise<boolean>} Success status
 */
export async function clearSecureStorage(confirmed = false) {
  if (!confirmed) {
    throw new Error('Clearing secure storage requires explicit confirmation');
  }
  
  if (!initialized) {
    throw new Error('Privacy Guard not initialized');
  }
  
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction([USER_STORE], 'readwrite');
      const store = transaction.objectStore(USER_STORE);
      const request = store.clear();
      
      request.onsuccess = () => {
        publish('privacy:storage:cleared');
        resolve(true);
      };
      
      request.onerror = (event) => {
        reject(new Error(`Failed to clear storage: ${event.target.errorCode}`));
      };
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Handle user login event
 * @param {Object} data - Event data
 */
function handleUserLogin(data) {
  // Reinitialize with user-specific encryption key
  if (data?.userId) {
    initialize({ userIdentifier: data.userId });
  }
}

/**
 * Handle user logout event
 */
function handleUserLogout() {
  // Clear in-memory keys but keep stored data
  masterKey = null;
  initialized = false;
}

/**
 * Check if Web Crypto API is available
 * @returns {boolean} Availability status
 */
export function isCryptoAvailable() {
  return !!(window.crypto && window.crypto.subtle);
}

/**
 * Generate a secure random ID
 * @param {number} length - ID length (default: 16)
 * @returns {string} Random ID
 */
export function generateSecureId(length = 16) {
  const array = new Uint8Array(length);
  window.crypto.getRandomValues(array);
  return Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
