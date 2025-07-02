/**
 * LongTermStore wraps a StorageAdapter to provide encrypted persistence for memories.
 */

import { createStorageAdapter } from './storage-adapter.js';
import { PrivacyGuard } from '../security/privacy-guard.js';

const NAMESPACE = 'long_term_memories';

class LongTermStore {
  async initialize() {
    this.adapter = await createStorageAdapter('indexeddb');
    this.crypto = new PrivacyGuard();
    await this.crypto.initialize();
    await this.adapter.initialize();
  }

  /**
   * Save a memory object.
   * @param {MemoryObject} memory
   */
  async save(memory) {
    const encrypted = await this.crypto.encrypt(JSON.stringify(memory));
    return this.adapter.set(NAMESPACE, memory.id, encrypted);
  }

  /**
   * Retrieve a memory by id.
   */
  async get(id) {
    const encrypted = await this.adapter.get(NAMESPACE, id);
    if (!encrypted) return null;
    const json = await this.crypto.decrypt(encrypted);
    return JSON.parse(json);
  }

  /**
   * Query all memories (optionally filter via callback).
   */
  async getAll(filterFn = null) {
    const entries = await this.adapter.getAll(NAMESPACE);
    const decrypted = await Promise.all(entries.map(async ({ value }) => {
      const json = await this.crypto.decrypt(value);
      return JSON.parse(json);
    }));
    return filterFn ? decrypted.filter(filterFn) : decrypted;
  }

  async delete(id) {
    return this.adapter.delete(NAMESPACE, id);
  }
}

export const longTermStore = new LongTermStore();
