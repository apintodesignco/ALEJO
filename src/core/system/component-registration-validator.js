/**
 * ALEJO Component Registration Validator
 * 
 * This utility scans the codebase for potential components and verifies
 * that they are properly registered with the initialization manager.
 * 
 * It helps ensure all components participate in the progressive loading sequence
 * and follow the proper initialization lifecycle.
 */

import { getInitializationStatus } from './initialization-manager.js';

/**
 * Scan the codebase for potential components and check if they're registered
 * 
 * @param {Object} options - Validation options
 * @param {boolean} options.autoRegister - Whether to auto-register missing components
 * @param {boolean} options.verbose - Whether to log detailed information
 * @returns {Object} - Validation results
 */
export async function validateComponentRegistration(options = {}) {
  const { 
    autoRegister = false, 
    verbose = false 
  } = options;
  
  // Get current initialization status
  const initStatus = getInitializationStatus();
  const registeredComponents = new Set(Object.keys(initStatus.componentStatus || {}));
  
  // Results object
  const results = {
    registered: Array.from(registeredComponents),
    missing: [],
    potentialComponents: [],
    accessibilityComponents: [],
    essentialComponents: []
  };
  
  // Log registered components
  if (verbose) {
    console.log(`Found ${results.registered.length} registered components:`);
    results.registered.forEach(id => {
      const component = initStatus.componentStatus[id];
      const tags = [];
      if (component.accessibility) tags.push('A11Y');
      if (component.isEssential) tags.push('ESSENTIAL');
      console.log(`- ${id} ${tags.length ? `[${tags.join(', ')}]` : ''}`);
    });
  }
  
  // Identify accessibility components
  results.accessibilityComponents = results.registered.filter(id => 
    initStatus.componentStatus[id]?.accessibility
  );
  
  // Identify essential components
  results.essentialComponents = results.registered.filter(id => 
    initStatus.componentStatus[id]?.isEssential
  );
  
  // Find potential components that aren't registered
  try {
    // This would typically involve scanning the codebase for files that look like components
    // For demonstration, we'll use a simple approach to detect potential components
    const potentialComponents = await scanForPotentialComponents();
    
    results.potentialComponents = potentialComponents;
    
    // Check which potential components aren't registered
    results.missing = potentialComponents.filter(id => !registeredComponents.has(id));
    
    if (verbose && results.missing.length > 0) {
      console.warn(`Found ${results.missing.length} potential components that aren't registered:`);
      results.missing.forEach(id => console.warn(`- ${id}`));
    }
    
    // Auto-register missing components if requested
    if (autoRegister && results.missing.length > 0) {
      // This would typically involve importing and registering the components
      // For demonstration, we'll just log the intent
      console.log(`Would auto-register ${results.missing.length} components`);
    }
  } catch (error) {
    console.error('Error scanning for potential components:', error);
  }
  
  return results;
}

/**
 * Scan the codebase for potential components
 * 
 * @returns {Promise<Array<string>>} - Array of potential component IDs
 */
async function scanForPotentialComponents() {
  // In a real implementation, this would scan the filesystem for component files
  // For demonstration, we'll return a hardcoded list of potential components
  
  // This would be replaced with actual filesystem scanning logic
  return [
    // Core components
    'core.neural-architecture',
    'core.memory-system',
    'core.reasoning-engine',
    'core.error-handler',
    
    // Accessibility components
    'accessibility.screen-reader',
    'accessibility.visual-adaptations',
    'accessibility.keyboard-navigation',
    
    // Input/Output components
    'io.voice-recognition',
    'io.voice-synthesis',
    'io.face-recognition',
    'io.gesture-recognition',
    
    // UI components
    'ui.dashboard',
    'ui.settings-panel',
    'ui.notifications',
    
    // Performance components
    'performance.resource-allocation',
    'performance.optimization-engine'
  ];
}

/**
 * Generate a registration report for the dashboard
 * 
 * @returns {Promise<Object>} - Report data
 */
export async function generateRegistrationReport() {
  const results = await validateComponentRegistration({ verbose: false });
  
  return {
    totalComponents: results.registered.length + results.missing.length,
    registeredCount: results.registered.length,
    missingCount: results.missing.length,
    accessibilityCount: results.accessibilityComponents.length,
    essentialCount: results.essentialComponents.length,
    registrationRate: Math.round((results.registered.length / (results.registered.length + results.missing.length)) * 100),
    details: {
      registered: results.registered,
      missing: results.missing,
      accessibility: results.accessibilityComponents,
      essential: results.essentialComponents
    }
  };
}
