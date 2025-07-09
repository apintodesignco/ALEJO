/**
 * ALEJO Recovery System
 * 
 * Provides automatic recovery mechanisms for handling component failures,
 * preserving state, and ensuring system resilience.
 */

/**
 * Manages component state backup and recovery
 */
export class RecoverySystem {
  /**
   * Initialize the recovery system
   */
  constructor() {
    this.componentStates = new Map();
    this.backupStore = new Map();
    this.componentFactories = new Map();
    this.backupInterval = null;
    this.recoveryAttempts = new Map();
    this.recoveryOptions = {
      maxAttempts: 3,
      backupFrequencyMs: 60000, // 1 minute
      recoveryTimeout: 5000, // 5 seconds
      automaticRecovery: true
    };
  }

  /**
   * Configure recovery options
   * @param {Object} options - Recovery configuration options
   */
  configure(options) {
    this.recoveryOptions = {
      ...this.recoveryOptions,
      ...options
    };
    
    // Restart backup interval with new frequency if it's running
    if (this.backupInterval) {
      this.stopAutomaticBackup();
      this.startAutomaticBackup();
    }
  }

  /**
   * Register a component factory for recovery
   * @param {string} componentId - Unique component identifier
   * @param {Function} factory - Factory function to recreate the component
   */
  registerComponentFactory(componentId, factory) {
    if (typeof factory !== 'function') {
      throw new Error(`Factory for component ${componentId} must be a function`);
    }
    
    this.componentFactories.set(componentId, factory);
    console.log(`Recovery System: Registered factory for ${componentId}`);
    
    // Initialize recovery attempts counter
    this.recoveryAttempts.set(componentId, 0);
    
    return true;
  }

  /**
   * Start automatic state backups
   */
  startAutomaticBackup() {
    if (this.backupInterval) {
      return false;
    }
    
    console.log(`Recovery System: Starting automatic backups every ${this.recoveryOptions.backupFrequencyMs}ms`);
    
    this.backupInterval = setInterval(() => {
      this.backupAll();
    }, this.recoveryOptions.backupFrequencyMs);
    
    return true;
  }

  /**
   * Stop automatic state backups
   */
  stopAutomaticBackup() {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
      this.backupInterval = null;
      console.log('Recovery System: Automatic backups stopped');
      return true;
    }
    
    return false;
  }

  /**
   * Backup a component's state
   * @param {string} componentId - Component to backup
   * @param {Object} state - Current component state
   */
  backupComponentState(componentId, state) {
    try {
      // Use structured clone for deep copying
      const stateCopy = typeof structuredClone === 'function' 
        ? structuredClone(state)
        : JSON.parse(JSON.stringify(state)); // Fallback for environments without structuredClone
      
      this.backupStore.set(componentId, stateCopy);
      console.log(`Recovery System: Backed up state for ${componentId}`);
      
      return true;
    } catch (error) {
      console.error(`Recovery System: Failed to backup state for ${componentId}:`, error);
      return false;
    }
  }

  /**
   * Backup all registered components
   */
  backupAll() {
    const componentsToBackup = Array.from(this.componentStates.keys());
    console.log(`Recovery System: Backing up ${componentsToBackup.length} components`);
    
    let successCount = 0;
    
    for (const componentId of componentsToBackup) {
      const state = this.componentStates.get(componentId);
      if (state && this.backupComponentState(componentId, state)) {
        successCount++;
      }
    }
    
    console.log(`Recovery System: Successfully backed up ${successCount}/${componentsToBackup.length} components`);
    
    return successCount;
  }

  /**
   * Register a component's current state
   * @param {string} componentId - Component identifier
   * @param {Object} state - Current state to track
   * @param {boolean} createBackup - Whether to immediately create a backup
   */
  registerComponentState(componentId, state, createBackup = true) {
    this.componentStates.set(componentId, state);
    
    if (createBackup) {
      this.backupComponentState(componentId, state);
    }
    
    return true;
  }

  /**
   * Update a component's state without creating a backup
   * @param {string} componentId - Component identifier
   * @param {Object} state - Updated state
   */
  updateComponentState(componentId, state) {
    this.componentStates.set(componentId, state);
    return true;
  }

  /**
   * Restore a component from its backup
   * @param {string} componentId - Component to restore
   * @returns {Promise<Object|null>} Restored component instance or null if failed
   */
  async restoreComponent(componentId) {
    // Check if we've exceeded max recovery attempts
    const attempts = this.recoveryAttempts.get(componentId) || 0;
    if (attempts >= this.recoveryOptions.maxAttempts) {
      console.error(`Recovery System: Maximum recovery attempts (${this.recoveryOptions.maxAttempts}) reached for ${componentId}`);
      return null;
    }
    
    // Increment recovery attempts
    this.recoveryAttempts.set(componentId, attempts + 1);
    
    try {
      // Get component factory
      const factory = this.componentFactories.get(componentId);
      if (!factory) {
        console.error(`Recovery System: No factory registered for ${componentId}`);
        return null;
      }
      
      // Get backup state
      const backupState = this.backupStore.get(componentId);
      if (!backupState) {
        console.warn(`Recovery System: No backup state for ${componentId}, will create new instance`);
      }
      
      console.log(`Recovery System: Restoring ${componentId} (attempt ${attempts + 1}/${this.recoveryOptions.maxAttempts})`);
      
      // Create new instance with timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Timeout restoring ${componentId}`)), 
          this.recoveryOptions.recoveryTimeout);
      });
      
      // Create instance with factory
      const instancePromise = Promise.resolve().then(() => factory());
      
      // Race between instance creation and timeout
      const newInstance = await Promise.race([instancePromise, timeoutPromise]);
      
      // Apply backup state if available
      if (backupState && newInstance) {
        try {
          if (typeof newInstance.restoreState === 'function') {
            // If component has a restoreState method, use it
            await newInstance.restoreState(backupState);
          } else {
            // Otherwise try to assign properties directly
            Object.assign(newInstance, backupState);
          }
          
          console.log(`Recovery System: Successfully restored state for ${componentId}`);
        } catch (error) {
          console.error(`Recovery System: Failed to restore state for ${componentId}:`, error);
        }
      }
      
      // Update component states
      this.componentStates.set(componentId, newInstance);
      
      // Reset recovery attempts on success
      this.recoveryAttempts.set(componentId, 0);
      
      return newInstance;
    } catch (error) {
      console.error(`Recovery System: Failed to restore ${componentId}:`, error);
      
      // If we have automatic recovery and haven't reached max attempts, try again
      if (this.recoveryOptions.automaticRecovery && 
          attempts + 1 < this.recoveryOptions.maxAttempts) {
        console.log(`Recovery System: Attempting automatic recovery for ${componentId}`);
        
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        return this.restoreComponent(componentId);
      }
      
      return null;
    }
  }

  /**
   * Check if a component needs recovery
   * @param {string} componentId - Component to check
   * @param {Function} healthCheck - Function that returns true if healthy
   * @returns {Promise<boolean>} Whether recovery was attempted
   */
  async checkAndRecoverIfNeeded(componentId, healthCheck) {
    const component = this.componentStates.get(componentId);
    
    try {
      // If component doesn't exist or health check fails, restore it
      if (!component || (healthCheck && !await Promise.resolve(healthCheck(component)))) {
        console.log(`Recovery System: Component ${componentId} needs recovery`);
        const recovered = await this.restoreComponent(componentId);
        return !!recovered;
      }
      
      return false; // No recovery needed
    } catch (error) {
      console.error(`Recovery System: Error checking component ${componentId}:`, error);
      
      // Try to recover
      const recovered = await this.restoreComponent(componentId);
      return !!recovered;
    }
  }

  /**
   * Reset recovery attempts counter for a component
   * @param {string} componentId - Component to reset
   */
  resetRecoveryAttempts(componentId) {
    this.recoveryAttempts.set(componentId, 0);
    return true;
  }

  /**
   * Clean up resources
   */
  dispose() {
    this.stopAutomaticBackup();
    this.componentStates.clear();
    this.backupStore.clear();
    this.componentFactories.clear();
    this.recoveryAttempts.clear();
  }
}

// Create and export a singleton instance
let recoverySystem = null;

/**
 * Get the recovery system instance
 * @returns {RecoverySystem} The recovery system
 */
export function getRecoverySystem() {
  if (!recoverySystem) {
    recoverySystem = new RecoverySystem();
  }
  
  return recoverySystem;
}
