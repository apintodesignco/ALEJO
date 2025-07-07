/**
 * @file performance-integration-refactored.js
 * @description Integrates the Voice system with the Resource Allocation Manager using the standardized helper
 * @module personalization/voice/performance-integration-refactored
 * @author ALEJO Development Team
 * @copyright 2025 ALEJO Project
 * @license MIT
 */

import { createModuleIntegration, COMPONENT_TYPES, RESOURCE_MODES } from '../../performance/index.js';
import { publish } from '../../core/events.js';

// Define component configurations
const voiceComponentConfigs = {
  system: {
    type: COMPONENT_TYPES.VOICE_RECOGNITION,
    pauseEvent: 'voice:system:pause',
    resumeEvent: 'voice:system:resume',
    reduceEvent: 'voice:system:reduce_resources',
    cpuPriority: 7,
    memoryFootprint: 30,
    isEssential: false
  },
  recognition: {
    type: COMPONENT_TYPES.VOICE_RECOGNITION,
    pauseEvent: 'voice:recognition:pause',
    resumeEvent: 'voice:recognition:resume',
    reduceEvent: 'voice:recognition:reduce_quality',
    cpuPriority: 8,
    memoryFootprint: 40,
    isEssential: false
  },
  synthesis: {
    type: COMPONENT_TYPES.VOICE_RECOGNITION,
    pauseEvent: 'voice:synthesis:pause',
    resumeEvent: 'voice:synthesis:resume',
    reduceEvent: 'voice:synthesis:reduce_quality',
    cpuPriority: 7,
    memoryFootprint: 25,
    isEssential: false
  },
  training: {
    type: COMPONENT_TYPES.BACKGROUND_TASK,
    pauseEvent: 'voice:training:pause',
    resumeEvent: 'voice:training:resume',
    reduceEvent: 'voice:training:reduce_resources',
    cpuPriority: 3,
    memoryFootprint: 50,
    isEssential: false
  },
  advancedFeatures: {
    type: COMPONENT_TYPES.VOICE_RECOGNITION,
    pauseEvent: 'voice:advanced_features:pause',
    resumeEvent: 'voice:advanced_features:resume',
    reduceEvent: 'voice:advanced_features:reduce_resources',
    cpuPriority: 4,
    memoryFootprint: 35,
    isEssential: false
  }
};

// Create the voice module integration
const voiceIntegration = createModuleIntegration('voice', voiceComponentConfigs, {
  // Handle mode changes
  onModeChange: (mode, reason) => {
    console.log(`[Voice] Adapting to resource mode: ${mode}`);
    
    // Adapt voice system based on resource mode
    switch (mode) {
      case RESOURCE_MODES.FULL:
        // Maximum quality and features
        publish('voice:config', {
          recognitionQuality: 'high',
          synthesisQuality: 'high',
          enableAdvancedFeatures: true,
          enableTraining: true,
          enableContinuousListening: true
        });
        break;
        
      case RESOURCE_MODES.BALANCED:
        // Slightly reduced quality but all features active
        publish('voice:config', {
          recognitionQuality: 'medium',
          synthesisQuality: 'high',
          enableAdvancedFeatures: true,
          enableTraining: false,
          enableContinuousListening: true
        });
        break;
        
      case RESOURCE_MODES.CONSERVATIVE:
        // Reduced quality and some features disabled
        publish('voice:config', {
          recognitionQuality: 'medium',
          synthesisQuality: 'medium',
          enableAdvancedFeatures: false,
          enableTraining: false,
          enableContinuousListening: false
        });
        break;
        
      case RESOURCE_MODES.MINIMAL:
        // Minimum quality and most features disabled
        publish('voice:config', {
          recognitionQuality: 'low',
          synthesisQuality: 'low',
          enableAdvancedFeatures: false,
          enableTraining: false,
          enableContinuousListening: false
        });
        break;
        
      default:
        // Default to balanced
        publish('voice:config', {
          recognitionQuality: 'medium',
          synthesisQuality: 'high',
          enableAdvancedFeatures: true,
          enableTraining: false,
          enableContinuousListening: true
        });
    }
  }
});

// Export the public API
export const {
  registerWithResourceManager,
  unregisterFromResourceManager,
  getCurrentResourceMode
} = voiceIntegration;

export default {
  registerWithResourceManager,
  unregisterFromResourceManager,
  getCurrentResourceMode
};
