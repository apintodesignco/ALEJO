/**
 * ALEJO Storage Adapter Interface
 * 
 * Defines the contract that all storage implementations must follow.
 * This enables the memory system to work with different storage backends
 * while maintaining a consistent API.
 */

/**
 * Base Storage Adapter class that defines the interface
 * for all concrete storage implementations.
 */
export class StorageAdapter {
  /**
   * Initialize the storage adapter
   * @param {Object} options - Configuration options
   * @returns {Promise<boolean>} - Success status
   */
  async initialize(options = {}) {
    throw new Error('Method not implemented: initialize');
  }

  /**
   * Store data in the storage backend
   * @param {string} namespace - Data category/collection
   * @param {string} key - Unique identifier
   * @param {any} data - Data to store
   * @param {Object} options - Storage options
   * @returns {Promise<boolean>} - Success status
   */
  async set(namespace, key, data, options = {}) {
    throw new Error('Method not implemented: set');
  }

  /**
   * Retrieve data from the storage backend
   * @param {string} namespace - Data category/collection
   * @param {string} key - Unique identifier
   * @param {Object} options - Retrieval options
   * @returns {Promise<any>} - Retrieved data or null if not found
   */
  async get(namespace, key, options = {}) {
    throw new Error('Method not implemented: get');
  }

  /**
   * Check if a key exists in the storage
   * @param {string} namespace - Data category/collection
   * @param {string} key - Unique identifier
   * @returns {Promise<boolean>} - Whether the key exists
   */
  async has(namespace, key) {
    throw new Error('Method not implemented: has');
  }

  /**
   * Delete data from the storage backend
   * @param {string} namespace - Data category/collection
   * @param {string} key - Unique identifier
   * @returns {Promise<boolean>} - Success status
   */
  async delete(namespace, key) {
    throw new Error('Method not implemented: delete');
  }

  /**
   * Clear all data in a namespace
   * @param {string} namespace - Data category/collection to clear
   * @returns {Promise<boolean>} - Success status
   */
  async clear(namespace) {
    throw new Error('Method not implemented: clear');
  }

  /**
   * List all keys in a namespace
   * @param {string} namespace - Data category/collection
   * @param {Object} options - Listing options (pagination, etc.)
   * @returns {Promise<Array<string>>} - Array of keys
   */
  async keys(namespace, options = {}) {
    throw new Error('Method not implemented: keys');
  }

  /**
   * Get all entries in a namespace
   * @param {string} namespace - Data category/collection
   * @param {Object} options - Query options (pagination, filtering)
   * @returns {Promise<Array<{key: string, value: any}>>} - Array of entries
   */
  async getAll(namespace, options = {}) {
    throw new Error('Method not implemented: getAll');
  }

  /**
   * Get the total size of stored data
   * @param {string} namespace - Optional namespace to check size for
   * @returns {Promise<number>} - Size in bytes
   */
  async getSize(namespace = null) {
    throw new Error('Method not implemented: getSize');
  }

  /**
   * Check if the storage backend is available
   * @returns {Promise<boolean>} - Whether storage is available
   */
  async isAvailable() {
    throw new Error('Method not implemented: isAvailable');
  }

  /**
   * Get storage quota information
   * @returns {Promise<{used: number, total: number}>} - Used and total space in bytes
   */
  async getQuota() {
    throw new Error('Method not implemented: getQuota');
  }
}

/**
 * Factory function to create the appropriate storage adapter
 * based on environment and availability
 * 
 * @param {string} preferredType - Preferred adapter type
 * @param {Object} options - Configuration options
 * @returns {Promise<StorageAdapter>} - Initialized storage adapter
 */
export async function createStorageAdapter(preferredType = 'indexeddb', options = {}) {
  // This will be implemented after we create the concrete adapters
  console.log(`Creating storage adapter of type: ${preferredType}`);
  return null;
}
