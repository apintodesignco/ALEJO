/**
 * ALEJO Self-Diagnostic System
 * 
 * Provides continuous health monitoring and automated repair capabilities
 * to ensure ALEJO operates reliably in production environments.
 * 
 * Features:
 * - Component health checking
 * - Automated repair mechanisms
 * - Performance monitoring
 * - Resource usage tracking
 * - Accessibility verification
 * - Security validation
 */

import { getRecoverySystem } from '../core/recovery-system.js';

/**
 * Manages system health checks and diagnostics
 */
export class SelfDiagnostics {
  /**
   * Initialize the self-diagnostics system
   */
  constructor() {
    this.healthChecks = new Map();
    this.repairStrategies = new Map();
    this.diagnosticResults = [];
    this.isRunning = false;
    this.lastRunTimestamp = null;
    this.autoRepairEnabled = true;
    
    // Register core health checks
    this.registerCoreHealthChecks();
  }

  /**
   * Register built-in health checks for core systems
   */
  registerCoreHealthChecks() {
    // Memory usage health check
    this.registerHealthCheck('system:memory', async () => {
      if (typeof performance !== 'undefined' && performance.memory) {
        const memoryInfo = performance.memory;
        const usedHeapSizeMB = Math.round(memoryInfo.usedJSHeapSize / (1024 * 1024));
        const totalHeapSizeMB = Math.round(memoryInfo.totalJSHeapSize / (1024 * 1024));
        const usage = memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit;
        
        // Critical if over 90% of limit
        if (usage > 0.9) {
          return {
            success: false,
            severity: 'critical',
            component: 'system:memory',
            message: `Memory usage critical: ${usedHeapSizeMB}MB used of ${totalHeapSizeMB}MB (${Math.round(usage * 100)}%)`,
            details: { usage, usedHeapSizeMB, totalHeapSizeMB }
          };
        }
        
        // Warning if over 80% of limit
        if (usage > 0.8) {
          return {
            success: false,
            severity: 'warning',
            component: 'system:memory',
            message: `Memory usage high: ${usedHeapSizeMB}MB used of ${totalHeapSizeMB}MB (${Math.round(usage * 100)}%)`,
            details: { usage, usedHeapSizeMB, totalHeapSizeMB }
          };
        }
        
        return {
          success: true,
          component: 'system:memory',
          message: `Memory usage normal: ${usedHeapSizeMB}MB used of ${totalHeapSizeMB}MB (${Math.round(usage * 100)}%)`,
          details: { usage, usedHeapSizeMB, totalHeapSizeMB }
        };
      }
      
      return {
        success: true,
        component: 'system:memory',
        message: 'Memory metrics not available in this environment'
      };
    });
    
    // Storage quota health check
    this.registerHealthCheck('system:storage', async () => {
      if (navigator && navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        const usedMB = Math.round(estimate.usage / (1024 * 1024));
        const quotaMB = Math.round(estimate.quota / (1024 * 1024));
        const usage = estimate.usage / estimate.quota;
        
        // Critical if over 90% of quota
        if (usage > 0.9) {
          return {
            success: false,
            severity: 'critical',
            component: 'system:storage',
            message: `Storage usage critical: ${usedMB}MB used of ${quotaMB}MB (${Math.round(usage * 100)}%)`,
            details: { usage, usedMB, quotaMB }
          };
        }
        
        // Warning if over 80% of quota
        if (usage > 0.8) {
          return {
            success: false,
            severity: 'warning',
            component: 'system:storage',
            message: `Storage usage high: ${usedMB}MB used of ${quotaMB}MB (${Math.round(usage * 100)}%)`,
            details: { usage, usedMB, quotaMB }
          };
        }
        
        return {
          success: true,
          component: 'system:storage',
          message: `Storage usage normal: ${usedMB}MB used of ${quotaMB}MB (${Math.round(usage * 100)}%)`,
          details: { usage, usedMB, quotaMB }
        };
      }
      
      return {
        success: true,
        component: 'system:storage',
        message: 'Storage metrics not available in this environment'
      };
    });
    
    // Network connectivity health check
    this.registerHealthCheck('system:network', async () => {
      if (navigator && navigator.onLine !== undefined) {
        if (!navigator.onLine) {
          return {
            success: false,
            severity: 'warning',
            component: 'system:network',
            message: 'Network is offline',
            details: { online: false }
          };
        }
        
        return {
          success: true,
          component: 'system:network',
          message: 'Network is online',
          details: { online: true }
        };
      }
      
      return {
        success: true,
        component: 'system:network',
        message: 'Network status not available in this environment'
      };
    });
  }

  /**
   * Register a health check function
   * @param {string} checkId - Unique identifier for this health check
   * @param {Function} checkFunction - Async function that performs the check
   */
  registerHealthCheck(checkId, checkFunction) {
    if (typeof checkFunction !== 'function') {
      throw new Error(`Health check for ${checkId} must be a function`);
    }
    
    this.healthChecks.set(checkId, checkFunction);
    
    return true;
  }

  /**
   * Register a repair strategy for a specific issue
   * @param {string} issueType - Type of issue this strategy can repair
   * @param {Function} repairFunction - Function to repair the issue
   */
  registerRepairStrategy(issueType, repairFunction) {
    if (typeof repairFunction !== 'function') {
      throw new Error(`Repair strategy for ${issueType} must be a function`);
    }
    
    this.repairStrategies.set(issueType, repairFunction);
    
    return true;
  }

  /**
   * Run all diagnostic health checks
   * @param {Array<string>} [specificChecks] - Optional list of specific checks to run
   * @returns {Promise<Object>} Diagnostic results
   */
  async runDiagnostics(specificChecks = null) {
    if (this.isRunning) {
      return {
        success: false,
        message: 'Diagnostics already running',
        timestamp: Date.now()
      };
    }
    
    this.isRunning = true;
    
    try {
      console.log('Self-Diagnostics: Running health checks...');
      
      const results = {
        timestamp: Date.now(),
        healthy: true,
        issues: [],
        results: []
      };
      
      // Determine which checks to run
      const checksToRun = specificChecks ? 
        [...this.healthChecks.entries()]
          .filter(([id]) => specificChecks.includes(id)) :
        [...this.healthChecks.entries()];
      
      // Run each health check
      for (const [checkId, checkFunction] of checksToRun) {
        try {
          const checkResult = await checkFunction();
          checkResult.timestamp = Date.now();
          checkResult.checkId = checkId;
          
          results.results.push(checkResult);
          
          if (!checkResult.success) {
            results.healthy = false;
            results.issues.push(checkResult);
            
            // Auto-repair if enabled
            if (this.autoRepairEnabled) {
              await this.attemptRepair(checkResult);
            }
          }
        } catch (error) {
          console.error(`Self-Diagnostics: Error in health check ${checkId}:`, error);
          
          const errorResult = {
            success: false,
            severity: 'error',
            component: checkId,
            message: `Health check failed: ${error.message}`,
            timestamp: Date.now(),
            checkId,
            error: error.toString()
          };
          
          results.results.push(errorResult);
          results.issues.push(errorResult);
          results.healthy = false;
        }
      }
      
      console.log(`Self-Diagnostics: Completed ${checksToRun.length} health checks. ${results.healthy ? 'System healthy' : `Found ${results.issues.length} issues`}`);
      
      // Store diagnostic results
      this.diagnosticResults.push(results);
      if (this.diagnosticResults.length > 10) {
        this.diagnosticResults.shift(); // Keep only the last 10 results
      }
      
      this.lastRunTimestamp = results.timestamp;
      
      return results;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Attempt to repair an issue
   * @param {Object} issue - Issue to repair
   * @returns {Promise<Object>} Repair result
   */
  async attemptRepair(issue) {
    // Try component-specific repair strategy
    if (issue.component) {
      const repairStrategy = this.repairStrategies.get(issue.component);
      if (repairStrategy) {
        console.log(`Self-Diagnostics: Attempting to repair ${issue.component}`);
        
        try {
          const repairResult = await repairStrategy(issue);
          console.log(`Self-Diagnostics: Repair ${repairResult.success ? 'successful' : 'failed'} for ${issue.component}`);
          return repairResult;
        } catch (error) {
          console.error(`Self-Diagnostics: Error repairing ${issue.component}:`, error);
          return { success: false, message: error.toString() };
        }
      }
    }
    
    // Try issue type repair strategy
    if (issue.type) {
      const repairStrategy = this.repairStrategies.get(issue.type);
      if (repairStrategy) {
        console.log(`Self-Diagnostics: Attempting to repair issue of type ${issue.type}`);
        
        try {
          const repairResult = await repairStrategy(issue);
          console.log(`Self-Diagnostics: Repair ${repairResult.success ? 'successful' : 'failed'} for type ${issue.type}`);
          return repairResult;
        } catch (error) {
          console.error(`Self-Diagnostics: Error repairing type ${issue.type}:`, error);
          return { success: false, message: error.toString() };
        }
      }
    }
    
    // If component is registered with recovery system, try to recover it
    if (issue.component) {
      const recoverySystem = getRecoverySystem();
      if (recoverySystem) {
        console.log(`Self-Diagnostics: Attempting to recover component ${issue.component}`);
        
        try {
          const recovered = await recoverySystem.restoreComponent(issue.component);
          if (recovered) {
            console.log(`Self-Diagnostics: Successfully recovered ${issue.component}`);
            return { success: true, message: `Recovered ${issue.component}` };
          }
          
          console.log(`Self-Diagnostics: Failed to recover ${issue.component}`);
          return { success: false, message: `Failed to recover ${issue.component}` };
        } catch (error) {
          console.error(`Self-Diagnostics: Error during recovery of ${issue.component}:`, error);
          return { success: false, message: error.toString() };
        }
      }
    }
    
    console.log(`Self-Diagnostics: No repair strategy available for ${issue.component || issue.type || 'unknown issue'}`);
    
    return {
      success: false,
      message: `No repair strategy available for ${issue.component || issue.type || 'unknown issue'}`
    };
  }

  /**
   * Get the latest diagnostic results
   * @returns {Object|null} Latest diagnostic results or null if none
   */
  getLatestDiagnosticResults() {
    if (this.diagnosticResults.length === 0) {
      return null;
    }
    
    return this.diagnosticResults[this.diagnosticResults.length - 1];
  }

  /**
   * Start continuous diagnostics
   * @param {number} intervalMs - Interval between diagnostic runs in ms
   */
  startContinuousDiagnostics(intervalMs = 60000) {
    if (this.diagnosticInterval) {
      clearInterval(this.diagnosticInterval);
    }
    
    console.log(`Self-Diagnostics: Starting continuous diagnostics every ${intervalMs}ms`);
    
    this.diagnosticInterval = setInterval(() => {
      this.runDiagnostics().catch(error => {
        console.error('Self-Diagnostics: Error running continuous diagnostics:', error);
      });
    }, intervalMs);
    
    return true;
  }

  /**
   * Stop continuous diagnostics
   */
  stopContinuousDiagnostics() {
    if (this.diagnosticInterval) {
      clearInterval(this.diagnosticInterval);
      this.diagnosticInterval = null;
      console.log('Self-Diagnostics: Continuous diagnostics stopped');
      return true;
    }
    
    return false;
  }

  /**
   * Enable or disable automatic repair
   * @param {boolean} enabled - Whether to enable auto-repair
   */
  setAutoRepair(enabled) {
    this.autoRepairEnabled = !!enabled;
    
    return true;
  }

  /**
   * Clean up resources
   */
  dispose() {
    this.stopContinuousDiagnostics();
    this.healthChecks.clear();
    this.repairStrategies.clear();
    this.diagnosticResults = [];
  }
}

// Create and export a singleton instance
let selfDiagnostics = null;

/**
 * Get the self-diagnostics system instance
 * @returns {SelfDiagnostics} The self-diagnostics system
 */
export function getSelfDiagnostics() {
  if (!selfDiagnostics) {
    selfDiagnostics = new SelfDiagnostics();
  }
  
  return selfDiagnostics;
}
