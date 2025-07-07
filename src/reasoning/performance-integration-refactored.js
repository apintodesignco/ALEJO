/**
 * @file performance-integration-refactored.js
 * @description Integrates the Reasoning system with the Resource Allocation Manager using the standardized helper
 * @module reasoning/performance-integration-refactored
 * @author ALEJO Development Team
 * @copyright 2025 ALEJO Project
 * @license MIT
 */

import { createModuleIntegration, COMPONENT_TYPES, RESOURCE_MODES } from '../performance/index.js';
import { publish } from '../core/events.js';
import { auditTrail } from '../security/audit-trail.js';

// Define component configurations for reasoning components
const reasoningComponentConfigs = {
  core: {
    type: COMPONENT_TYPES.REASONING_ENGINE,
    pauseEvent: 'reasoning:core:pause',
    resumeEvent: 'reasoning:core:resume',
    reduceEvent: 'reasoning:core:reduce_resources',
    cpuPriority: 8, // High priority for core reasoning
    memoryFootprint: 25,
    isEssential: true // Essential for system operation
  },
  truthEngine: {
    type: COMPONENT_TYPES.REASONING_ENGINE,
    pauseEvent: 'reasoning:truth_engine:pause',
    resumeEvent: 'reasoning:truth_engine:resume',
    reduceEvent: 'reasoning:truth_engine:reduce_resources',
    cpuPriority: 7,
    memoryFootprint: 20,
    isEssential: true // Essential for system operation
  },
  explanation: {
    type: COMPONENT_TYPES.REASONING_ENGINE,
    pauseEvent: 'reasoning:explanation:pause',
    resumeEvent: 'reasoning:explanation:resume',
    reduceEvent: 'reasoning:explanation:reduce_resources',
    cpuPriority: 6,
    memoryFootprint: 15,
    isEssential: false
  },
  fallacyDetection: {
    type: COMPONENT_TYPES.REASONING_ENGINE,
    pauseEvent: 'reasoning:fallacy:pause',
    resumeEvent: 'reasoning:fallacy:resume',
    reduceEvent: 'reasoning:fallacy:reduce_resources',
    cpuPriority: 5,
    memoryFootprint: 15,
    isEssential: false
  },
  conflictResolution: {
    type: COMPONENT_TYPES.REASONING_ENGINE,
    pauseEvent: 'reasoning:conflict:pause',
    resumeEvent: 'reasoning:conflict:resume',
    reduceEvent: 'reasoning:conflict:reduce_resources',
    cpuPriority: 5,
    memoryFootprint: 20,
    isEssential: false
  },
  learning: {
    type: COMPONENT_TYPES.BACKGROUND_TASK,
    pauseEvent: 'reasoning:learning:pause',
    resumeEvent: 'reasoning:learning:resume',
    reduceEvent: 'reasoning:learning:reduce_resources',
    cpuPriority: 3, // Lower priority for background learning
    memoryFootprint: 40,
    isEssential: false
  }
};

// Create the reasoning module integration
const reasoningIntegration = createModuleIntegration('reasoning', reasoningComponentConfigs, {
  // Handle mode changes
  onModeChange: (mode, reason) => {
    console.log(`[Reasoning] Adapting to resource mode: ${mode}`);
    
    // Log the mode change for audit trail
    auditTrail.log({
      action: 'reasoning:resource_mode:change',
      category: 'performance',
      details: {
        timestamp: new Date().toISOString(),
        mode,
        reason
      }
    });
    
    // Adapt reasoning system based on resource mode
    switch (mode) {
      case RESOURCE_MODES.FULL:
        // All features at maximum quality
        publish('reasoning:config', {
          coreQuality: 'high',
          truthEngineQuality: 'high',
          explanationEnabled: true,
          fallacyDetectionEnabled: true,
          conflictResolutionEnabled: true,
          learningEnabled: true,
          complexityThreshold: 10, // Allow complex reasoning
          confidenceThreshold: 0.7, // Lower threshold for more results
          parallelProcessing: true
        });
        break;
        
      case RESOURCE_MODES.BALANCED:
        // Slightly reduced features
        publish('reasoning:config', {
          coreQuality: 'high',
          truthEngineQuality: 'high',
          explanationEnabled: true,
          fallacyDetectionEnabled: true,
          conflictResolutionEnabled: true,
          learningEnabled: false, // Disable background learning
          complexityThreshold: 8, // Slightly reduce complexity
          confidenceThreshold: 0.75,
          parallelProcessing: true
        });
        break;
        
      case RESOURCE_MODES.CONSERVATIVE:
        // Reduced features but maintaining core functionality
        publish('reasoning:config', {
          coreQuality: 'medium',
          truthEngineQuality: 'medium',
          explanationEnabled: true,
          fallacyDetectionEnabled: false, // Disable non-essential feature
          conflictResolutionEnabled: false, // Disable non-essential feature
          learningEnabled: false,
          complexityThreshold: 6, // Reduce complexity
          confidenceThreshold: 0.8, // Higher threshold for fewer results
          parallelProcessing: false // Disable parallel processing
        });
        break;
        
      case RESOURCE_MODES.MINIMAL:
        // Minimum features but essential core still active
        publish('reasoning:config', {
          coreQuality: 'low',
          truthEngineQuality: 'low',
          explanationEnabled: false, // Disable non-essential feature
          fallacyDetectionEnabled: false, // Disable non-essential feature
          conflictResolutionEnabled: false, // Disable non-essential feature
          learningEnabled: false,
          complexityThreshold: 4, // Minimal complexity
          confidenceThreshold: 0.9, // Very high threshold for minimal results
          parallelProcessing: false
        });
        break;
        
      default:
        // Default to balanced
        publish('reasoning:config', {
          coreQuality: 'high',
          truthEngineQuality: 'high',
          explanationEnabled: true,
          fallacyDetectionEnabled: true,
          conflictResolutionEnabled: true,
          learningEnabled: false,
          complexityThreshold: 8,
          confidenceThreshold: 0.75,
          parallelProcessing: true
        });
    }
  }
});

// Export the public API
export const {
  registerWithResourceManager,
  unregisterFromResourceManager,
  getCurrentResourceMode
} = reasoningIntegration;

export default {
  registerWithResourceManager,
  unregisterFromResourceManager,
  getCurrentResourceMode
};
