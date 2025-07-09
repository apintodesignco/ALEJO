/**
 * @file performance-integration.js
 * @description Integrates the Vision system with the enhanced Resource Allocation Manager
 * @module personalization/vision/performance-integration
 * @author ALEJO Development Team
 * @copyright 2025 ALEJO Project
 * @license MIT
 */

import { 
  createAdaptiveIntegration, 
  createAdaptiveOptions, 
  COMPONENT_TYPES, 
  RESOURCE_MODES 
} from '../../performance/index.js';
import { publish } from '../../core/events.js';
import { auditTrail } from '../../security/audit-trail.js';

// Define component configurations with enhanced adaptive options and accessibility categories
const visionComponentConfigs = {
  faceDetection: {
    type: COMPONENT_TYPES.FACE_RECOGNITION,
    pauseEvent: 'vision:face_detection:pause',
    resumeEvent: 'vision:face_detection:resume',
    reduceEvent: 'vision:face_detection:reduce_resources',
    cpuPriority: 7,
    memoryFootprint: 40,
    isEssential: false,
    category: 'vision',
    adaptiveOptions: createAdaptiveOptions(false, false, 0.5)
  },
  expressionAnalysis: {
    type: COMPONENT_TYPES.FACE_RECOGNITION,
    pauseEvent: 'vision:expression:pause',
    resumeEvent: 'vision:expression:resume',
    reduceEvent: 'vision:expression:reduce_resources',
    cpuPriority: 6,
    memoryFootprint: 35,
    isEssential: false,
    category: 'vision',
    adaptiveOptions: createAdaptiveOptions(false, false, 0.4)
  },
  objectRecognition: {
    type: COMPONENT_TYPES.FACE_RECOGNITION,
    pauseEvent: 'vision:object:pause',
    resumeEvent: 'vision:object:resume',
    reduceEvent: 'vision:object:reduce_resources',
    cpuPriority: 5,
    memoryFootprint: 50,
    isEssential: false,
    category: 'vision',
    adaptiveOptions: createAdaptiveOptions(false, false, 0.3)
  },
  signLanguageRecognition: {
    type: COMPONENT_TYPES.GESTURE_RECOGNITION,
    pauseEvent: 'vision:sign_language:pause',
    resumeEvent: 'vision:sign_language:resume',
    reduceEvent: 'vision:sign_language:reduce_resources',
    cpuPriority: 9, // Higher priority for accessibility
    memoryFootprint: 60,
    isEssential: true, // Essential for accessibility
    category: 'accessibility', // Categorized as accessibility
    adaptiveOptions: createAdaptiveOptions(true, true, 0.7) // Can operate at 70% resources
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
  textRecognition: {
    type: COMPONENT_TYPES.OCR,
    pauseEvent: 'vision:text:pause',
    resumeEvent: 'vision:text:resume',
    reduceEvent: 'vision:text:reduce_resources',
    cpuPriority: 8, // Higher priority for accessibility
    memoryFootprint: 45,
    isEssential: true, // Essential for accessibility
    category: 'accessibility', // Categorized as accessibility
    adaptiveOptions: createAdaptiveOptions(true, true, 0.8) // Can operate at 80% resources
  },
  descriptionGeneration: {
    type: COMPONENT_TYPES.IMAGE_ANALYSIS,
    pauseEvent: 'vision:description:pause',
    resumeEvent: 'vision:description:resume',
    reduceEvent: 'vision:description:reduce_resources',
    cpuPriority: 8, // Higher priority for accessibility
    memoryFootprint: 55,
    isEssential: true, // Essential for accessibility
    category: 'accessibility', // Categorized as accessibility
    adaptiveOptions: createAdaptiveOptions(true, true, 0.75) // Can operate at 75% resources
  },
  avatarGeneration: {
    type: COMPONENT_TYPES.IMAGE_GENERATION,
    pauseEvent: 'vision:avatar:pause',
    resumeEvent: 'vision:avatar:resume',
    reduceEvent: 'vision:avatar:reduce_resources',
    cpuPriority: 4, // Lower priority, non-essential
    memoryFootprint: 70,
    isEssential: false,
    category: 'vision',
    adaptiveOptions: createAdaptiveOptions(false, false, 0.3) // Can operate at 30% resources or be paused
  },
  sceneAnalysis: {
    type: COMPONENT_TYPES.IMAGE_ANALYSIS,
    pauseEvent: 'vision:scene:pause',
    resumeEvent: 'vision:scene:resume',
    reduceEvent: 'vision:scene:reduce_resources',
    cpuPriority: 4, // Lower priority, non-essential
    memoryFootprint: 65,
    isEssential: false,
    category: 'vision',
    adaptiveOptions: createAdaptiveOptions(false, false, 0.4) // Can operate at 40% resources or be paused
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

// Create the vision module integration using the enhanced adaptive integration helper
const visionIntegration = createAdaptiveIntegration('vision', visionComponentConfigs, {
  // Handle mode changes with detailed configuration
  onModeChange: (mode, reason) => {
    console.log(`[Vision] Adapting to resource mode: ${mode}, reason: ${reason}`);
    auditTrail.log('vision', 'resource_mode_change', { mode, reason });
    
    // Configure system-wide vision parameters based on resource mode
    switch (mode) {
      case RESOURCE_MODES.FULL:
        // Maximum quality and features
        publish('vision:config', {
          faceDetectionQuality: 'high',
          objectRecognitionEnabled: true,
          sceneAnalysisEnabled: true,
          processingInterval: 100, // ms
          textRecognitionMode: 'high',
          descriptionDetailLevel: 'detailed',
          avatarGenerationEnabled: true,
          signLanguageMode: 'high_precision',
          adaptiveFeaturesEnabled: true
        });
        break;
        
      case RESOURCE_MODES.BALANCED:
        // Good balance of quality and resource usage
        publish('vision:config', {
          faceDetectionQuality: 'medium',
          objectRecognitionEnabled: true,
          sceneAnalysisEnabled: true,
          processingInterval: 250, // ms
          textRecognitionMode: 'standard',
          descriptionDetailLevel: 'standard',
          avatarGenerationEnabled: true,
          signLanguageMode: 'standard',
          adaptiveFeaturesEnabled: true
        });
        break;
        
      case RESOURCE_MODES.CONSERVATIVE:
        // Reduced quality to save resources, but preserve accessibility features
        publish('vision:config', {
          faceDetectionQuality: 'low',
          objectRecognitionEnabled: false,
          sceneAnalysisEnabled: false,
          processingInterval: 500, // ms
          textRecognitionMode: 'standard', // Maintain standard quality for accessibility
          descriptionDetailLevel: 'basic',
          avatarGenerationEnabled: false,
          signLanguageMode: 'standard', // Keep sign language at standard quality
          adaptiveFeaturesEnabled: false
        });
        break;
        
      case RESOURCE_MODES.MINIMAL:
        // Minimum functionality but preserve critical accessibility features
        publish('vision:config', {
          faceDetectionQuality: 'minimal',
          objectRecognitionEnabled: false,
          sceneAnalysisEnabled: false,
          processingInterval: 1000, // ms
          textRecognitionMode: 'basic', // Still maintain basic text recognition
          descriptionDetailLevel: 'minimal',
          avatarGenerationEnabled: false,
          signLanguageMode: 'basic', // Maintain basic sign language support
          adaptiveFeaturesEnabled: false
        });
        break;
        
      default:
        // Default to balanced
        publish('vision:config', {
          faceDetectionQuality: 'medium',
          objectRecognitionEnabled: true,
          sceneAnalysisEnabled: false,
          processingInterval: 250, // ms
          textRecognitionMode: 'standard',
          descriptionDetailLevel: 'standard',
          avatarGenerationEnabled: false,
          signLanguageMode: 'standard',
          adaptiveFeaturesEnabled: true
        });
    }
  },
  
  // Custom handler for applying resource recommendations
  onRecommendations: (componentId, recommendations) => {
    const recData = recommendations.recommendations;
    console.log(`[Vision] Applying recommendations for ${componentId}:`, recData);
    
    // Apply component-specific optimizations based on recommendations
    switch (componentId) {
      case 'signLanguageRecognition':
      case 'textRecognition':
      case 'descriptionGeneration':
        // For accessibility components, apply recommendations but maintain minimum quality
        const qualityLevel = recData.cpu.throttleLevel < 30 ? 'high' :
                           recData.cpu.throttleLevel < 60 ? 'standard' : 'basic';
        
        publish(`vision:${componentId}:adjust`, {
          qualityLevel,
          updateInterval: Math.min(recData.cpu.updateInterval || 250, 250), // Never slower than 250ms for accessibility
          memoryUsage: recData.memory.cacheSize,
          source: 'resource_manager'
        });
        break;
        
      default:
        // For non-accessibility components, apply recommendations directly
        publish(`vision:${componentId}:adjust`, {
          qualityLevel: recData.cpu.throttleLevel < 20 ? 'high' :
                       recData.cpu.throttleLevel < 50 ? 'medium' :
                       recData.cpu.throttleLevel < 80 ? 'low' : 'minimal',
          updateInterval: recData.cpu.updateInterval,
          memoryUsage: recData.memory.cacheSize,
          source: 'resource_manager'
        });
    }
    
    // Log the applied recommendations
    auditTrail.log('vision', 'resource_recommendations_applied', {
      componentId,
      recommendations: recData,
      timestamp: Date.now()
    });
  }
});

// Export the public API with additional helper methods
export const {
  registerWithResourceManager,
  unregisterFromResourceManager,
  getCurrentResourceMode,
  requestResourceRecommendations,
  isRegisteredWithResourceManager
} = visionIntegration;

// Add utility function to request recommendations for specific components
export function requestRecommendationsForComponent(componentId) {
  if (!componentId || !visionComponentConfigs[componentId]) {
    console.error(`[Vision] Invalid component ID: ${componentId}`);
    return false;
  }
  
  const fullComponentId = `vision.${componentId}`;
  return requestResourceRecommendations(fullComponentId);
}

export default {
  registerWithResourceManager,
  unregisterFromResourceManager,
  getCurrentResourceMode,
  requestRecommendationsForComponent,
  isRegisteredWithResourceManager
};
