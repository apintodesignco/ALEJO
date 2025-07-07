/**
 * ALEJO Progressive Loading Sequence Manager
 * 
 * This module manages the progressive loading sequence of ALEJO components,
 * ensuring that components are loaded in the optimal order based on:
 * 1. Accessibility requirements (highest priority)
 * 2. Essential/core functionality
 * 3. User preferences and context
 * 4. Resource availability
 * 5. Dependencies between components
 * 
 * The progressive loading approach ensures that the most important functionality
 * is available as quickly as possible, while less critical components are loaded
 * in the background or on-demand.
 */

import { getInitializationStatus } from './initialization-manager.js';
import { logInitEvent } from './initialization-log-viewer.js';
import { getResourceStatus } from '../../performance/resource-allocation-manager.js';
import { publishEvent } from '../neural-architecture/neural-event-bus.js';

// Loading phases configuration
const LOADING_PHASES = {
  CRITICAL: {
    name: 'Critical Components',
    description: 'Accessibility and essential core components',
    priority: 1000,
    resourceThreshold: 'minimal', // Load even with minimal resources
    components: []
  },
  CORE: {
    name: 'Core Components',
    description: 'Basic functionality required for operation',
    priority: 800,
    resourceThreshold: 'low',
    components: []
  },
  STANDARD: {
    name: 'Standard Components',
    description: 'Normal operation components',
    priority: 600,
    resourceThreshold: 'medium',
    components: []
  },
  ENHANCED: {
    name: 'Enhanced Components',
    description: 'Additional features and enhancements',
    priority: 400,
    resourceThreshold: 'high',
    components: []
  },
  OPTIONAL: {
    name: 'Optional Components',
    description: 'Non-essential features and extensions',
    priority: 200,
    resourceThreshold: 'optimal',
    components: []
  }
};

// User preferences for loading
let userPreferences = {
  prioritizeAccessibility: true,
  loadOptionalComponents: true,
  resourceConservationMode: false,
  preferredComponents: [],
  deferredComponents: []
};

// Loading sequence state
const loadingState = {
  currentPhase: null,
  completedPhases: [],
  phaseStartTimes: {},
  phaseEndTimes: {},
  componentLoadOrder: [],
  skippedComponents: [],
  deferredComponents: []
};

/**
 * Initialize the progressive loading manager
 * 
 * @param {Object} options - Configuration options
 * @returns {Promise<void>}
 */
export async function initializeProgressiveLoading(options = {}) {
  // Apply user preferences
  if (options.userPreferences) {
    userPreferences = {
      ...userPreferences,
      ...options.userPreferences
    };
  }
  
  // Log initialization
  logInitEvent('system-start', 'progressive-loading-manager', { 
    userPreferences,
    resourceStatus: getResourceStatus()
  });
  
  // Analyze components and assign to phases
  await analyzeAndAssignComponents();
  
  // Start the loading sequence
  return startLoadingSequence();
}

/**
 * Analyze components and assign them to loading phases
 * 
 * @returns {Promise<void>}
 */
async function analyzeAndAssignComponents() {
  // Get initialization status to access component registry
  const initStatus = getInitializationStatus();
  const componentStatus = initStatus.componentStatus || {};
  
  // Reset phase components
  Object.keys(LOADING_PHASES).forEach(phase => {
    LOADING_PHASES[phase].components = [];
  });
  
  // Analyze and categorize each component
  Object.entries(componentStatus).forEach(([id, component]) => {
    // Skip already initialized components
    if (component.status === 'initialized' || component.status === 'fallback') {
      return;
    }
    
    // Determine the appropriate loading phase
    let targetPhase = 'STANDARD'; // Default phase
    
    // Accessibility components go to CRITICAL phase
    if (component.accessibility) {
      targetPhase = 'CRITICAL';
    }
    // Essential components go to CRITICAL or CORE phase
    else if (component.isEssential) {
      targetPhase = 'CORE';
    }
    // User preferred components go to STANDARD phase
    else if (userPreferences.preferredComponents.includes(id)) {
      targetPhase = 'STANDARD';
    }
    // User deferred components go to OPTIONAL phase
    else if (userPreferences.deferredComponents.includes(id)) {
      targetPhase = 'OPTIONAL';
    }
    // Components with many dependencies go to later phases
    else if (component.dependencies && component.dependencies.length > 3) {
      targetPhase = 'ENHANCED';
    }
    
    // Add to appropriate phase
    LOADING_PHASES[targetPhase].components.push(id);
  });
  
  // Log phase assignments
  Object.entries(LOADING_PHASES).forEach(([phase, config]) => {
    logInitEvent('phase-assignment', `phase-${phase}`, {
      phase,
      componentCount: config.components.length,
      components: config.components
    });
  });
}

/**
 * Start the progressive loading sequence
 * 
 * @returns {Promise<void>}
 */
async function startLoadingSequence() {
  // Get resource status to determine what can be loaded
  const resourceStatus = getResourceStatus();
  const availableResourceLevel = determineResourceLevel(resourceStatus);
  
  // Sort phases by priority
  const sortedPhases = Object.entries(LOADING_PHASES)
    .sort(([, a], [, b]) => b.priority - a.priority);
  
  // Process each phase in order
  for (const [phaseName, phaseConfig] of sortedPhases) {
    // Skip phases that require more resources than available
    // unless they contain critical components
    if (
      !meetsResourceThreshold(availableResourceLevel, phaseConfig.resourceThreshold) &&
      phaseName !== 'CRITICAL'
    ) {
      logInitEvent('phase-skip', `phase-${phaseName}`, {
        reason: 'insufficient-resources',
        requiredLevel: phaseConfig.resourceThreshold,
        availableLevel: availableResourceLevel
      });
      
      // Mark components in this phase as skipped
      phaseConfig.components.forEach(componentId => {
        loadingState.skippedComponents.push(componentId);
      });
      
      continue;
    }
    
    // Start phase
    loadingState.currentPhase = phaseName;
    loadingState.phaseStartTimes[phaseName] = Date.now();
    
    logInitEvent('phase-start', `phase-${phaseName}`, {
      componentCount: phaseConfig.components.length
    });
    
    publishEvent('system:loading:phase-start', {
      phase: phaseName,
      name: phaseConfig.name,
      description: phaseConfig.description,
      componentCount: phaseConfig.components.length
    });
    
    // Process components in this phase
    // Note: The actual initialization is handled by the initialization manager
    // This just tracks the loading sequence and provides progress information
    for (const componentId of phaseConfig.components) {
      loadingState.componentLoadOrder.push({
        componentId,
        phase: phaseName,
        requestTime: Date.now()
      });
    }
    
    // End phase
    loadingState.phaseEndTimes[phaseName] = Date.now();
    loadingState.completedPhases.push(phaseName);
    
    const phaseDuration = loadingState.phaseEndTimes[phaseName] - loadingState.phaseStartTimes[phaseName];
    
    logInitEvent('phase-complete', `phase-${phaseName}`, {
      duration: phaseDuration,
      componentCount: phaseConfig.components.length
    });
    
    publishEvent('system:loading:phase-complete', {
      phase: phaseName,
      name: phaseConfig.name,
      duration: phaseDuration,
      componentCount: phaseConfig.components.length
    });
    
    // Check if we should continue loading based on resource status
    if (
      userPreferences.resourceConservationMode &&
      phaseName !== 'CRITICAL' &&
      phaseName !== 'CORE'
    ) {
      const updatedResourceStatus = getResourceStatus();
      
      // If resources are becoming constrained, defer remaining phases
      if (isResourceConstrained(updatedResourceStatus)) {
        logInitEvent('loading-deferred', 'progressive-loading-manager', {
          reason: 'resource-conservation',
          remainingPhases: sortedPhases
            .filter(([phase]) => !loadingState.completedPhases.includes(phase))
            .map(([phase]) => phase)
        });
        
        // Collect components from remaining phases as deferred
        sortedPhases
          .filter(([phase]) => !loadingState.completedPhases.includes(phase))
          .forEach(([, config]) => {
            config.components.forEach(componentId => {
              loadingState.deferredComponents.push(componentId);
            });
          });
        
        break;
      }
    }
  }
  
  // Loading sequence complete
  loadingState.currentPhase = null;
  
  logInitEvent('system-complete', 'progressive-loading-manager', {
    completedPhases: loadingState.completedPhases,
    loadedComponentCount: loadingState.componentLoadOrder.length,
    skippedComponentCount: loadingState.skippedComponents.length,
    deferredComponentCount: loadingState.deferredComponents.length
  });
  
  return {
    completedPhases: loadingState.completedPhases,
    skippedComponents: loadingState.skippedComponents,
    deferredComponents: loadingState.deferredComponents
  };
}

/**
 * Determine the resource level based on resource status
 * 
 * @param {Object} resourceStatus - Resource status from resource allocation manager
 * @returns {string} - Resource level (minimal, low, medium, high, optimal)
 */
function determineResourceLevel(resourceStatus) {
  const { cpu, memory, battery } = resourceStatus;
  
  // Minimal: System is extremely constrained
  if (cpu.usage > 90 || memory.usage > 90 || (battery && battery.level < 0.1)) {
    return 'minimal';
  }
  
  // Low: System is constrained
  if (cpu.usage > 70 || memory.usage > 70 || (battery && battery.level < 0.2)) {
    return 'low';
  }
  
  // Medium: System has adequate resources
  if (cpu.usage > 50 || memory.usage > 50 || (battery && battery.level < 0.3)) {
    return 'medium';
  }
  
  // High: System has good resources
  if (cpu.usage > 30 || memory.usage > 30 || (battery && battery.level < 0.5)) {
    return 'high';
  }
  
  // Optimal: System has excellent resources
  return 'optimal';
}

/**
 * Check if the available resource level meets the required threshold
 * 
 * @param {string} available - Available resource level
 * @param {string} required - Required resource level
 * @returns {boolean} - Whether the threshold is met
 */
function meetsResourceThreshold(available, required) {
  const levels = ['minimal', 'low', 'medium', 'high', 'optimal'];
  const availableIndex = levels.indexOf(available);
  const requiredIndex = levels.indexOf(required);
  
  return availableIndex >= requiredIndex;
}

/**
 * Check if system resources are constrained
 * 
 * @param {Object} resourceStatus - Resource status
 * @returns {boolean} - Whether resources are constrained
 */
function isResourceConstrained(resourceStatus) {
  const { cpu, memory, battery } = resourceStatus;
  
  return (
    cpu.usage > 80 ||
    memory.usage > 80 ||
    (battery && battery.level < 0.15 && !battery.charging)
  );
}

/**
 * Get the current loading sequence state
 * 
 * @returns {Object} - Loading sequence state
 */
export function getLoadingSequenceState() {
  return {
    ...loadingState,
    phases: LOADING_PHASES,
    userPreferences
  };
}

/**
 * Update user preferences for loading
 * 
 * @param {Object} preferences - User preferences
 */
export function updateUserPreferences(preferences = {}) {
  userPreferences = {
    ...userPreferences,
    ...preferences
  };
  
  logInitEvent('preferences-update', 'progressive-loading-manager', {
    userPreferences
  });
}

/**
 * Request loading of deferred components
 * 
 * @param {string[]} componentIds - Component IDs to load, or empty for all deferred
 * @returns {Promise<Object>} - Loading result
 */
export async function loadDeferredComponents(componentIds = []) {
  const componentsToLoad = componentIds.length > 0
    ? componentIds.filter(id => loadingState.deferredComponents.includes(id))
    : [...loadingState.deferredComponents];
  
  if (componentsToLoad.length === 0) {
    return { loaded: 0, skipped: 0 };
  }
  
  logInitEvent('deferred-loading-start', 'progressive-loading-manager', {
    componentCount: componentsToLoad.length,
    components: componentsToLoad
  });
  
  // Remove from deferred list
  loadingState.deferredComponents = loadingState.deferredComponents.filter(
    id => !componentsToLoad.includes(id)
  );
  
  // Add to load order
  componentsToLoad.forEach(componentId => {
    loadingState.componentLoadOrder.push({
      componentId,
      phase: 'DEFERRED',
      requestTime: Date.now()
    });
  });
  
  logInitEvent('deferred-loading-complete', 'progressive-loading-manager', {
    componentCount: componentsToLoad.length
  });
  
  return {
    loaded: componentsToLoad.length,
    components: componentsToLoad
  };
}

/**
 * Generate a loading sequence report
 * 
 * @returns {Object} - Loading sequence report
 */
export function generateLoadingReport() {
  const initStatus = getInitializationStatus();
  const componentStatus = initStatus.componentStatus || {};
  
  // Calculate statistics
  const stats = {
    totalComponents: Object.keys(componentStatus).length,
    loadedComponents: loadingState.componentLoadOrder.length,
    skippedComponents: loadingState.skippedComponents.length,
    deferredComponents: loadingState.deferredComponents.length,
    phaseStats: {},
    accessibilityStats: {
      total: initStatus.accessibilityComponents?.length || 0,
      loaded: 0,
      failed: 0
    },
    essentialStats: {
      total: initStatus.essentialComponents?.length || 0,
      loaded: 0,
      failed: 0
    }
  };
  
  // Calculate phase statistics
  Object.entries(LOADING_PHASES).forEach(([phaseName, phaseConfig]) => {
    const phaseCompleted = loadingState.completedPhases.includes(phaseName);
    const componentCount = phaseConfig.components.length;
    const loadedCount = phaseCompleted ? componentCount : 0;
    
    stats.phaseStats[phaseName] = {
      name: phaseConfig.name,
      description: phaseConfig.description,
      priority: phaseConfig.priority,
      componentCount,
      loadedCount,
      completed: phaseCompleted,
      duration: phaseCompleted
        ? loadingState.phaseEndTimes[phaseName] - loadingState.phaseStartTimes[phaseName]
        : null
    };
  });
  
  // Calculate accessibility and essential component statistics
  Object.entries(componentStatus).forEach(([id, component]) => {
    if (component.accessibility) {
      if (component.status === 'initialized' || component.status === 'fallback') {
        stats.accessibilityStats.loaded++;
      } else if (component.status === 'failed') {
        stats.accessibilityStats.failed++;
      }
    }
    
    if (component.isEssential) {
      if (component.status === 'initialized' || component.status === 'fallback') {
        stats.essentialStats.loaded++;
      } else if (component.status === 'failed') {
        stats.essentialStats.failed++;
      }
    }
  });
  
  return stats;
}
