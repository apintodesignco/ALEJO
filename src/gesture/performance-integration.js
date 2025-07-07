/**
 * @file performance-integration.js
 * @description Integrates the gesture system with the Resource Allocation Manager
 * @module gesture/performance-integration
 * @author ALEJO Development Team
 * @copyright 2025 ALEJO Project
 * @license MIT
 */

import { 
  getResourceAllocationManager, 
  registerComponent,
  COMPONENT_TYPES,
  RESOURCE_MODES
} from '../performance/index.js';
import { publish, subscribe } from '../core/events.js';

// Component IDs for gesture system components
const COMPONENT_IDS = {
  GESTURE_SYSTEM: 'gesture.system',
  CAMERA: 'gesture.camera',
  RECOGNITION: 'gesture.recognition',
  ENHANCED_RECOGNITION: 'gesture.enhanced_recognition'
};

// Track registration status
let isRegistered = false;
let registrations = {};

// Track current resource mode
let currentMode = null;

/**
 * Register the gesture system with the Resource Allocation Manager
 * 
 * @param {Object} options - Registration options
 * @param {boolean} [options.useEnhancedRecognition=true] - Whether enhanced recognition is enabled
 * @returns {boolean} - Success status
 */
export function registerWithResourceManager(options = {}) {
  if (isRegistered) {
    console.log('[Gesture] Already registered with Resource Allocation Manager');
    return true;
  }
  
  const useEnhancedRecognition = options.useEnhancedRecognition !== false;
  
  try {
    const resourceManager = getResourceAllocationManager();
    
    // Register main gesture system component
    registrations.system = registerComponent(COMPONENT_IDS.GESTURE_SYSTEM, {
      type: COMPONENT_TYPES.GESTURE_RECOGNITION,
      pauseHandler: () => {
        publish('gesture:system:pause', { reason: 'resource_manager' });
      },
      resumeHandler: () => {
        publish('gesture:system:resume', { reason: 'resource_manager' });
      },
      reduceResourcesHandler: (mode) => {
        handleResourceModeChange(mode);
      },
      customRequirements: {
        cpuPriority: 8,
        memoryFootprint: 50,
        isEssential: false
      }
    });
    
    // Register camera component
    registrations.camera = registerComponent(COMPONENT_IDS.CAMERA, {
      type: COMPONENT_TYPES.GESTURE_RECOGNITION,
      customRequirements: {
        cpuPriority: 7,
        memoryFootprint: 15,
        isEssential: false
      }
    });
    
    // Register recognition component
    const recognitionComponentId = useEnhancedRecognition ? 
      COMPONENT_IDS.ENHANCED_RECOGNITION : COMPONENT_IDS.RECOGNITION;
    
    registrations.recognition = registerComponent(recognitionComponentId, {
      type: COMPONENT_TYPES.GESTURE_RECOGNITION,
      customRequirements: {
        cpuPriority: useEnhancedRecognition ? 9 : 7,
        memoryFootprint: useEnhancedRecognition ? 60 : 30,
        isEssential: false
      }
    });
    
    // Subscribe to resource mode changes
    currentMode = resourceManager.getCurrentMode();
    subscribe('resource:mode_changed', (event) => {
      currentMode = event.mode;
      handleResourceModeChange(event.mode);
    });
    
    isRegistered = true;
    console.log('[Gesture] Registered with Resource Allocation Manager');
    return true;
  } catch (error) {
    console.error('[Gesture] Failed to register with Resource Allocation Manager:', error);
    return false;
  }
}

/**
 * Unregister the gesture system from the Resource Allocation Manager
 * 
 * @returns {boolean} - Success status
 */
export function unregisterFromResourceManager() {
  if (!isRegistered) return true;
  
  try {
    // Unregister all components
    Object.values(registrations).forEach(registration => {
      if (registration && registration.unregister) {
        registration.unregister();
      }
    });
    
    registrations = {};
    isRegistered = false;
    console.log('[Gesture] Unregistered from Resource Allocation Manager');
    return true;
  } catch (error) {
    console.error('[Gesture] Failed to unregister from Resource Allocation Manager:', error);
    return false;
  }
}

/**
 * Handle resource mode changes
 * 
 * @param {string} mode - New resource mode
 */
function handleResourceModeChange(mode) {
  console.log(`[Gesture] Adapting to resource mode: ${mode}`);
  
  switch (mode) {
    case RESOURCE_MODES.FULL:
      // Maximum performance, no restrictions
      publish('gesture:config', {
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
        frameRate: 30
      });
      break;
      
    case RESOURCE_MODES.BALANCED:
      // Balanced performance and resource usage
      publish('gesture:config', {
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.6,
        frameRate: 20
      });
      break;
      
    case RESOURCE_MODES.CONSERVATIVE:
      // Reduced resource usage
      publish('gesture:config', {
        maxNumHands: 1,
        modelComplexity: 0,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7,
        frameRate: 15
      });
      break;
      
    case RESOURCE_MODES.MINIMAL:
      // Minimum resource usage, basic functionality
      publish('gesture:config', {
        maxNumHands: 1,
        modelComplexity: 0,
        minDetectionConfidence: 0.8,
        minTrackingConfidence: 0.8,
        frameRate: 10
      });
      break;
      
    default:
      // Default to balanced
      publish('gesture:config', {
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.6,
        frameRate: 20
      });
  }
}

/**
 * Get the current resource mode
 * 
 * @returns {string} - Current resource mode
 */
export function getCurrentResourceMode() {
  return currentMode;
}

export default {
  registerWithResourceManager,
  unregisterFromResourceManager,
  getCurrentResourceMode
};
