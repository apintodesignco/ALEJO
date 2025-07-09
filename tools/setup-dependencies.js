#!/usr/bin/env node
/**
 * ALEJO Dependencies Setup
 * 
 * This script ensures all necessary dependencies are installed
 * and configured correctly for ALEJO to run successfully.
 */

import { execSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

// Get directory name in ES module
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = resolve(__dirname, '..');

console.log('🔄 Setting up ALEJO dependencies...');

// Ensure rimraf is installed for clean script
try {
  console.log('📦 Installing build dependencies...');
  execSync('npm install rimraf --save-dev', { 
    stdio: 'inherit', 
    cwd: projectRoot 
  });
} catch (e) {
  console.warn('⚠️  Could not install rimraf. You may need to install it manually for the clean script to work.');
}

// Create necessary directories
const directories = [
  'dist',
  'logs',
  'config'
];

directories.forEach(dir => {
  const dirPath = join(projectRoot, dir);
  if (!existsSync(dirPath)) {
    console.log(`📁 Creating directory: ${dir}`);
    mkdirSync(dirPath, { recursive: true });
  }
});

// Fix package.json duplicates if they exist
try {
  const packageJsonPath = join(projectRoot, 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  
  // Check for and remove duplicate keys in devDependencies
  if (packageJson.devDependencies) {
    const seenDeps = new Set();
    const cleanDevDeps = {};
    
    for (const [key, value] of Object.entries(packageJson.devDependencies)) {
      if (!seenDeps.has(key)) {
        cleanDevDeps[key] = value;
        seenDeps.add(key);
      } else {
        console.log(`🔄 Removing duplicate devDependency: ${key}`);
      }
    }
    
    packageJson.devDependencies = cleanDevDeps;
  }
  
  // Write the cleaned package.json
  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  console.log('✅ Fixed package.json');
} catch (e) {
  console.warn('⚠️  Could not fix package.json:', e);
}

// Create a default config file if not exists
const configPath = join(projectRoot, 'config', 'alejo.config.json');
if (!existsSync(configPath)) {
  console.log('⚙️ Creating default configuration...');
  
  const defaultConfig = {
    port: 9000,
    resourceLimits: {
      maxCpuPercent: 75,
      maxMemoryMb: 1024,
      maxDiskUsageMb: 500
    },
    accessibility: true,
    autoStart: true,
    localOnly: true,
    security: {
      encryptLocalStorage: true,
      cspEnabled: true,
      allowedOrigins: ['self']
    },
    performance: {
      enableProgressiveLoading: true,
      cacheAssets: true,
      enableServiceWorker: true,
      preloadCriticalAssets: true
    }
  };
  
  writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
}

// Setup resource controller if it doesn't exist
const resourceControllerPath = join(projectRoot, 'src', 'system', 'resource-controller.js');
if (!existsSync(resourceControllerPath)) {
  console.log('⚙️ Creating resource controller...');
  
  const resourceController = `/**
 * ALEJO Resource Controller
 * 
 * Manages system resources to ensure optimal performance
 * and prevent excessive resource usage.
 */

/**
 * Manages resource allocation for ALEJO components
 */
export class ResourceController {
  /**
   * Initialize the resource controller
   * @param {Object} config - Configuration options
   */
  constructor(config = {}) {
    this.maxMemory = (config.resourceLimits?.maxMemoryMb || 1024) * 1024 * 1024;
    this.maxCpu = config.resourceLimits?.maxCpuPercent || 75;
    this.maxDisk = (config.resourceLimits?.maxDiskUsageMb || 500) * 1024 * 1024;
    
    this.activeModules = new Set();
    this.moduleResources = new Map();
    
    // Track actual resource usage
    this.memoryUsage = 0;
    this.cpuUsage = 0;
    this.diskUsage = 0;
    
    // Start monitoring
    this.startMonitoring();
  }
  
  /**
   * Register a module with its resource requirements
   * @param {string} moduleId - Unique identifier for the module
   * @param {Object} requiredResources - Resource requirements
   */
  registerModule(moduleId, requiredResources) {
    this.moduleResources.set(moduleId, requiredResources);
    return true;
  }
  
  /**
   * Start a module if resources are available
   * @param {string} moduleId - Module to start
   * @returns {boolean} - Whether the module was successfully started
   */
  async startModule(moduleId) {
    const resources = this.moduleResources.get(moduleId);
    
    if (!resources) {
      console.warn(\`Module \${moduleId} not registered\`);
      return false;
    }
    
    if (this.canAllocate(resources)) {
      this.activeModules.add(moduleId);
      this.updateResourceUsage();
      return true;
    }
    
    console.warn(\`Insufficient resources to start module \${moduleId}\`);
    return false;
  }
  
  /**
   * Stop a running module
   * @param {string} moduleId - Module to stop
   */
  stopModule(moduleId) {
    if (this.activeModules.has(moduleId)) {
      this.activeModules.delete(moduleId);
      this.updateResourceUsage();
      return true;
    }
    
    return false;
  }
  
  /**
   * Check if resources are available for allocation
   * @param {Object} resources - Required resources
   * @returns {boolean} - Whether the resources can be allocated
   */
  canAllocate(resources) {
    // Check memory availability
    if (resources.memory && this.memoryUsage + resources.memory > this.maxMemory) {
      return false;
    }
    
    // Check CPU availability
    if (resources.cpu && this.cpuUsage + resources.cpu > this.maxCpu) {
      return false;
    }
    
    // Check disk availability
    if (resources.disk && this.diskUsage + resources.disk > this.maxDisk) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Start monitoring resource usage
   */
  startMonitoring() {
    // Update resource usage every 5 seconds
    this.monitorInterval = setInterval(() => {
      this.updateResourceUsage();
    }, 5000);
  }
  
  /**
   * Stop monitoring resource usage
   */
  stopMonitoring() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }
  }
  
  /**
   * Update current resource usage
   */
  updateResourceUsage() {
    // In a browser environment, we would use:
    // - performance.memory for memory (Chrome only)
    // - For CPU, we'd need to estimate based on task execution time
    
    let totalMemory = 0;
    let totalCpu = 0;
    let totalDisk = 0;
    
    // Sum up resource usage from active modules
    for (const moduleId of this.activeModules) {
      const resources = this.moduleResources.get(moduleId);
      if (resources) {
        totalMemory += resources.memory || 0;
        totalCpu += resources.cpu || 0;
        totalDisk += resources.disk || 0;
      }
    }
    
    this.memoryUsage = totalMemory;
    this.cpuUsage = totalCpu;
    this.diskUsage = totalDisk;
    
    // Emit resource usage event if we have the event system
    if (typeof window !== 'undefined' && window.ALEJO && window.ALEJO.events) {
      window.ALEJO.events.emit('resource:update', {
        memory: this.memoryUsage,
        cpu: this.cpuUsage,
        disk: this.diskUsage,
        limits: {
          memory: this.maxMemory,
          cpu: this.maxCpu,
          disk: this.maxDisk
        }
      });
    }
  }
  
  /**
   * Get the current resource usage
   * @returns {Object} - Current resource usage stats
   */
  getResourceUsage() {
    return {
      memory: this.memoryUsage,
      memoryPercent: (this.memoryUsage / this.maxMemory) * 100,
      cpu: this.cpuUsage,
      cpuPercent: (this.cpuUsage / this.maxCpu) * 100,
      disk: this.diskUsage,
      diskPercent: (this.diskUsage / this.maxDisk) * 100,
      activeModules: Array.from(this.activeModules)
    };
  }
  
  /**
   * Get resource limits
   * @returns {Object} - Resource limits
   */
  getResourceLimits() {
    return {
      memory: this.maxMemory,
      cpu: this.maxCpu,
      disk: this.maxDisk
    };
  }
  
  /**
   * Set new resource limits
   * @param {Object} limits - New resource limits
   */
  setResourceLimits(limits) {
    if (limits.memory) this.maxMemory = limits.memory;
    if (limits.cpu) this.maxCpu = limits.cpu;
    if (limits.disk) this.maxDisk = limits.disk;
    
    // Check if we now exceed limits with active modules
    this.checkAndAdjustResourceUsage();
  }
  
  /**
   * Check and adjust resource usage if exceeding limits
   */
  checkAndAdjustResourceUsage() {
    if (this.memoryUsage > this.maxMemory || 
        this.cpuUsage > this.maxCpu || 
        this.diskUsage > this.maxDisk) {
      
      console.warn('Resource limits exceeded, stopping non-essential modules');
      
      // Get modules sorted by priority (lower number = higher priority)
      const modulesByPriority = Array.from(this.activeModules)
        .map(moduleId => ({ 
          id: moduleId, 
          priority: this.moduleResources.get(moduleId)?.priority || 0,
          essential: this.moduleResources.get(moduleId)?.essential || false
        }))
        .sort((a, b) => b.priority - a.priority);
      
      // Stop non-essential modules until we're below limits
      for (const module of modulesByPriority) {
        if (!module.essential) {
          this.stopModule(module.id);
          
          // Check if we're now below limits
          if (this.memoryUsage <= this.maxMemory && 
              this.cpuUsage <= this.maxCpu && 
              this.diskUsage <= this.maxDisk) {
            break;
          }
        }
      }
      
      // If we're still above limits, we need to stop essential modules
      if (this.memoryUsage > this.maxMemory || 
          this.cpuUsage > this.maxCpu || 
          this.diskUsage > this.maxDisk) {
        
        console.error('Critical resource limit exceeded, stopping essential modules');
        
        // Get essential modules sorted by priority
        const essentialModules = modulesByPriority
          .filter(module => module.essential)
          .sort((a, b) => b.priority - a.priority);
        
        // Stop essential modules until we're below limits
        for (const module of essentialModules) {
          this.stopModule(module.id);
          
          // Check if we're now below limits
          if (this.memoryUsage <= this.maxMemory && 
              this.cpuUsage <= this.maxCpu && 
              this.diskUsage <= this.maxDisk) {
            break;
          }
        }
      }
    }
  }
  
  /**
   * Clean up resources
   */
  dispose() {
    this.stopMonitoring();
    this.activeModules.clear();
    this.moduleResources.clear();
  }
}

// Create and export default instance
let resourceController = null;

/**
 * Get the resource controller instance
 * @param {Object} config - Configuration for the resource controller
 * @returns {ResourceController} - The resource controller instance
 */
export function getResourceController(config = null) {
  if (!resourceController && config) {
    resourceController = new ResourceController(config);
  }
  
  return resourceController;
}
`;
  
  // Create directories if needed
  const systemDir = join(projectRoot, 'src', 'system');
  if (!existsSync(systemDir)) {
    mkdirSync(systemDir, { recursive: true });
  }
  
  writeFileSync(resourceControllerPath, resourceController);
}

console.log('✅ ALEJO dependencies setup complete!');
