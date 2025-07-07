/**
 * @file performance-integration-refactored.js
 * @description Integrates the Vision system with the Resource Allocation Manager using the standardized helper
 * @module personalization/vision/performance-integration-refactored
 * @author ALEJO Development Team
 * @copyright 2025 ALEJO Project
 * @license MIT
 */

import { createModuleIntegration, COMPONENT_TYPES, RESOURCE_MODES } from '../../performance/index.js';
import { publish } from '../../core/events.js';
import { auditTrail } from '../../security/audit-trail.js';

// Define component configurations with accessibility-related vision components having higher priority
const visionComponentConfigs = {
  faceDetection: {
    type: COMPONENT_TYPES.FACE_RECOGNITION,
    pauseEvent: 'vision:face_detection:pause',
    resumeEvent: 'vision:face_detection:resume',
    reduceEvent: 'vision:face_detection:reduce_resources',
    cpuPriority: 7,
    memoryFootprint: 40,
    isEssential: false
  },
  expressionAnalysis: {
    type: COMPONENT_TYPES.FACE_RECOGNITION,
    pauseEvent: 'vision:expression:pause',
    resumeEvent: 'vision:expression:resume',
    reduceEvent: 'vision:expression:reduce_resources',
    cpuPriority: 6,
    memoryFootprint: 35,
    isEssential: false
  },
  objectRecognition: {
    type: COMPONENT_TYPES.FACE_RECOGNITION,
    pauseEvent: 'vision:object:pause',
    resumeEvent: 'vision:object:resume',
    reduceEvent: 'vision:object:reduce_resources',
    cpuPriority: 5,
    memoryFootprint: 50,
    isEssential: false
  },
  // Accessibility-related components with higher priority
  signLanguageRecognition: {
    type: COMPONENT_TYPES.GESTURE_RECOGNITION,
    pauseEvent: 'vision:sign_language:pause',
    resumeEvent: 'vision:sign_language:resume',
    reduceEvent: 'vision:sign_language:reduce_resources',
    cpuPriority: 9, // Higher priority for accessibility
    memoryFootprint: 60,
    isEssential: true // Essential for accessibility
  },
  visualImpairmentAssistance: {
    type: COMPONENT_TYPES.FACE_RECOGNITION,
    pauseEvent: 'vision:visual_impairment:pause',
    resumeEvent: 'vision:visual_impairment:resume',
    reduceEvent: 'vision:visual_impairment:reduce_resources',
    cpuPriority: 9, // Higher priority for accessibility
    memoryFootprint: 45,
    isEssential: true // Essential for accessibility
  },
  training: {
    type: COMPONENT_TYPES.BACKGROUND_TASK,
    pauseEvent: 'vision:training:pause',
    resumeEvent: 'vision:training:resume',
    reduceEvent: 'vision:training:reduce_resources',
    cpuPriority: 3, // Low priority for background tasks
    memoryFootprint: 70,
    isEssential: false
  }
};

// Create the vision module integration
const visionIntegration = createModuleIntegration('vision', visionComponentConfigs, {
  // Handle mode changes
  onModeChange: (mode, reason) => {
    console.log(`[Vision] Adapting to resource mode: ${mode}`);
    
    // Log the mode change for audit trail
    auditTrail.log({
      action: 'vision:resource_mode:change',
      category: 'performance',
      details: {
        timestamp: new Date().toISOString(),
        mode,
        reason
      }
    });
    
    // Adapt vision system based on resource mode
    switch (mode) {
      case RESOURCE_MODES.FULL:
        // All features at maximum quality
        publish('vision:config', {
          faceDetectionQuality: 'high',
          expressionAnalysisQuality: 'high',
          objectRecognitionQuality: 'high',
          signLanguageQuality: 'high', // Maintain high quality for accessibility
          visualImpairmentQuality: 'high', // Maintain high quality for accessibility
          trainingEnabled: true,
          frameRate: 30,
          resolution: 'high',
          enhancedProcessing: true
        });
        break;
        
      case RESOURCE_MODES.BALANCED:
        // Slightly reduced quality for non-essential features
        publish('vision:config', {
          faceDetectionQuality: 'medium',
          expressionAnalysisQuality: 'medium',
          objectRecognitionQuality: 'medium',
          signLanguageQuality: 'high', // Maintain high quality for accessibility
          visualImpairmentQuality: 'high', // Maintain high quality for accessibility
          trainingEnabled: false,
          frameRate: 24,
          resolution: 'medium',
          enhancedProcessing: true
        });
        break;
        
      case RESOURCE_MODES.CONSERVATIVE:
        // Reduced quality but maintaining essential accessibility features
        publish('vision:config', {
          faceDetectionQuality: 'low',
          expressionAnalysisQuality: 'low',
          objectRecognitionQuality: 'low',
          signLanguageQuality: 'medium', // Maintain reasonable quality for accessibility
          visualImpairmentQuality: 'medium', // Maintain reasonable quality for accessibility
          trainingEnabled: false,
          frameRate: 15,
          resolution: 'low',
          enhancedProcessing: false
        });
        break;
        
      case RESOURCE_MODES.MINIMAL:
        // Minimum quality but essential accessibility features still active
        publish('vision:config', {
          faceDetectionQuality: 'minimal',
          expressionAnalysisQuality: 'off',
          objectRecognitionQuality: 'minimal',
          signLanguageQuality: 'low', // Maintain minimum quality for accessibility
          visualImpairmentQuality: 'low', // Maintain minimum quality for accessibility
          trainingEnabled: false,
          frameRate: 10,
          resolution: 'minimal',
          enhancedProcessing: false
        });
        break;
        
      default:
        // Default to balanced
        publish('vision:config', {
          faceDetectionQuality: 'medium',
          expressionAnalysisQuality: 'medium',
          objectRecognitionQuality: 'medium',
          signLanguageQuality: 'high', // Maintain high quality for accessibility
          visualImpairmentQuality: 'high', // Maintain high quality for accessibility
          trainingEnabled: false,
          frameRate: 24,
          resolution: 'medium',
          enhancedProcessing: true
        });
    }
  }
});

// Export the public API
export const {
  registerWithResourceManager,
  unregisterFromResourceManager,
  getCurrentResourceMode
} = visionIntegration;

export default {
  registerWithResourceManager,
  unregisterFromResourceManager,
  getCurrentResourceMode
};
