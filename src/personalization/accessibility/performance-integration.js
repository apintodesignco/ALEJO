/**
 * @file performance-integration.js
 * @description Integrates the Accessibility system with the Resource Allocation Manager using the standardized helper
 * @module personalization/accessibility/performance-integration
 * @author ALEJO Development Team
 * @copyright 2025 ALEJO Project
 * @license MIT
 */

import { createModuleIntegration, COMPONENT_TYPES, RESOURCE_MODES } from '../../performance/index.js';
import { publish } from '../../core/events.js';
import { updateAccessibilityStatusBar } from './ui-status.js';

// Define component configurations with accessibility components having highest priority and essential flag
const accessibilityComponentConfigs = {
  screenReader: {
    type: COMPONENT_TYPES.UI_COMPONENT,
    pauseEvent: 'accessibility:screen_reader:pause',
    resumeEvent: 'accessibility:screen_reader:resume',
    reduceEvent: 'accessibility:screen_reader:reduce_resources',
    cpuPriority: 10, // Highest priority (10 is highest in our system)
    memoryFootprint: 15,
    isEssential: true // Mark as essential to prevent disabling
  },
  visualAids: {
    type: COMPONENT_TYPES.UI_COMPONENT,
    pauseEvent: 'accessibility:visual_aids:pause',
    resumeEvent: 'accessibility:visual_aids:resume',
    reduceEvent: 'accessibility:visual_aids:reduce_resources',
    cpuPriority: 10, // Highest priority
    memoryFootprint: 20,
    isEssential: true // Mark as essential
  },
  gestureRecognition: {
    type: COMPONENT_TYPES.GESTURE_RECOGNITION,
    pauseEvent: 'accessibility:gesture:pause',
    resumeEvent: 'accessibility:gesture:resume',
    reduceEvent: 'accessibility:gesture:reduce_resources',
    cpuPriority: 9, // Very high priority
    memoryFootprint: 40,
    isEssential: true // Mark as essential
  },
  signLanguage: {
    type: COMPONENT_TYPES.GESTURE_RECOGNITION,
    pauseEvent: 'accessibility:sign_language:pause',
    resumeEvent: 'accessibility:sign_language:resume',
    reduceEvent: 'accessibility:sign_language:reduce_resources',
    cpuPriority: 9, // Very high priority
    memoryFootprint: 50,
    isEssential: true // Mark as essential
  },
  captioning: {
    type: COMPONENT_TYPES.UI_COMPONENT,
    pauseEvent: 'accessibility:captioning:pause',
    resumeEvent: 'accessibility:captioning:resume',
    reduceEvent: 'accessibility:captioning:reduce_resources',
    cpuPriority: 9, // Very high priority
    memoryFootprint: 15,
    isEssential: true // Mark as essential
  },
  enhancedUI: {
    type: COMPONENT_TYPES.UI_COMPONENT,
    pauseEvent: 'accessibility:enhanced_ui:pause',
    resumeEvent: 'accessibility:enhanced_ui:resume',
    reduceEvent: 'accessibility:enhanced_ui:reduce_resources',
    cpuPriority: 8, // High priority but can be reduced
    memoryFootprint: 25,
    isEssential: false // Can be reduced if necessary
  }
};

// Create the accessibility module integration
const accessibilityIntegration = createModuleIntegration('accessibility', accessibilityComponentConfigs, {
  // Handle mode changes
  onModeChange: (mode, reason) => {
    console.log(`[Accessibility] Adapting to resource mode: ${mode}`);
    
    // Update the UI status bar
    updateAccessibilityStatusBar({
      mode,
      reason,
      timestamp: new Date().toISOString()
    });
    
    // Adapt accessibility features based on resource mode
    // Note: Essential features remain active in all modes
    switch (mode) {
      case RESOURCE_MODES.FULL:
        // All features at maximum quality
        publish('accessibility:config', {
          screenReaderQuality: 'high',
          visualAidsQuality: 'high',
          gestureRecognitionQuality: 'high',
          signLanguageQuality: 'high',
          captioningQuality: 'high',
          enhancedUIEnabled: true,
          highContrastMode: true,
          animationReduction: false,
          audioDescriptions: true,
          hapticFeedback: true
        });
        break;
        
      case RESOURCE_MODES.BALANCED:
        // Slightly reduced quality for non-essential features
        publish('accessibility:config', {
          screenReaderQuality: 'high',
          visualAidsQuality: 'high',
          gestureRecognitionQuality: 'high',
          signLanguageQuality: 'high',
          captioningQuality: 'high',
          enhancedUIEnabled: true,
          highContrastMode: true,
          animationReduction: true,
          audioDescriptions: true,
          hapticFeedback: true
        });
        break;
        
      case RESOURCE_MODES.CONSERVATIVE:
        // Reduced quality but maintaining all essential features
        publish('accessibility:config', {
          screenReaderQuality: 'high',
          visualAidsQuality: 'medium',
          gestureRecognitionQuality: 'medium',
          signLanguageQuality: 'medium',
          captioningQuality: 'high',
          enhancedUIEnabled: false,
          highContrastMode: true,
          animationReduction: true,
          audioDescriptions: false,
          hapticFeedback: true
        });
        break;
        
      case RESOURCE_MODES.MINIMAL:
        // Minimum quality but essential features still active
        publish('accessibility:config', {
          screenReaderQuality: 'medium',
          visualAidsQuality: 'medium',
          gestureRecognitionQuality: 'low',
          signLanguageQuality: 'low',
          captioningQuality: 'medium',
          enhancedUIEnabled: false,
          highContrastMode: true,
          animationReduction: true,
          audioDescriptions: false,
          hapticFeedback: false
        });
        break;
        
      default:
        // Default to balanced
        publish('accessibility:config', {
          screenReaderQuality: 'high',
          visualAidsQuality: 'high',
          gestureRecognitionQuality: 'high',
          signLanguageQuality: 'high',
          captioningQuality: 'high',
          enhancedUIEnabled: true,
          highContrastMode: true,
          animationReduction: true,
          audioDescriptions: true,
          hapticFeedback: true
        });
    }
  }
});

// Export the public API
export const {
  registerWithResourceManager,
  unregisterFromResourceManager,
  getCurrentResourceMode
} = accessibilityIntegration;

export default {
  registerWithResourceManager,
  unregisterFromResourceManager,
  getCurrentResourceMode
};
