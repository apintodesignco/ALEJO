/**
 * @file performance-integration.js
 * @description Integrates the Voice system with the Resource Allocation Manager using the enhanced adaptive resource management
 * @module personalization/voice/performance-integration
 * @author ALEJO Development Team
 * @copyright 2025 ALEJO Project
 * @license MIT
 */

import { 
  ResourceAllocationManager, 
  COMPONENT_TYPES, 
  RESOURCE_MODES,
  createAdaptiveIntegration,
  createAdaptiveOptions,
  getQualityConfigForMode,
  createNetworkDetector,
  createFeatureDetector
} from '../../performance/index.js';
import { publish, subscribe } from '../../core/events.js';
import { addAuditEntry } from '../../core/audit-trail.js';
import { NetworkStatus } from '../../core/progressive-enhancement/network-status.js';
import { StorageCapabilities } from '../../core/progressive-enhancement/storage-capabilities.js';
import { FeatureDetection } from '../../core/progressive-enhancement/feature-detection.js';

// Get the singleton instance of the Resource Allocation Manager
const resourceManager = ResourceAllocationManager.getInstance();

// Track current resource mode
let currentMode = RESOURCE_MODES.BALANCED;

// Define component configurations with enhanced adaptive options and categories
const voiceComponentConfigs = {
  system: {
    id: 'voice.system',
    type: COMPONENT_TYPES.VOICE_RECOGNITION,
    pauseEvent: 'voice:system:pause',
    resumeEvent: 'voice:system:resume',
    reduceEvent: 'voice:system:reduce_resources',
    configEvent: 'voice:system:config_updated',
    cpuPriority: 7,
    memoryFootprint: 30,
    isEssential: true, // Voice system is essential for accessibility
    category: 'accessibility', // Mark as accessibility component
    adaptiveOptions: createAdaptiveOptions({
      importance: 'critical', // Critical for accessibility
      accessibilityFeature: true,
      resourceIntensity: 'moderate',
      canReduceQuality: true,
      minimalModeOperation: true,
      qualityLevels: {
        high: {
          sampleRate: 48000,
          channels: 2,
          bitDepth: 16,
          noiseReduction: true,
          enhancedFiltering: true,
          modelComplexity: 3 // Most complex model
        },
        medium: {
          sampleRate: 44100,
          channels: 2,
          bitDepth: 16,
          noiseReduction: true,
          enhancedFiltering: false,
          modelComplexity: 2 // Medium complexity model
        },
        low: {
          sampleRate: 22050,
          channels: 1,
          bitDepth: 16,
          noiseReduction: false,
          enhancedFiltering: false,
          modelComplexity: 1 // Simplest model
        }
      }
    })
  },
  recognition: {
    id: 'voice.recognition',
    type: COMPONENT_TYPES.VOICE_RECOGNITION,
    pauseEvent: 'voice:recognition:pause',
    resumeEvent: 'voice:recognition:resume',
    reduceEvent: 'voice:recognition:reduce_resources',
    configEvent: 'voice:recognition:config_updated',
    cpuPriority: 6,
    memoryFootprint: 25,
    isEssential: false, // Voice recognition is important but not critical
    category: 'voice', // General voice category
    adaptiveOptions: createAdaptiveOptions({
      importance: 'high',
      accessibilityFeature: false,
      resourceIntensity: 'high',
      canReduceQuality: true,
      minimalModeOperation: false,
      qualityLevels: {
        high: {
          continuous: true,
          interimResults: true,
          modelSize: 'large',
          languageModelBoost: true
        },
        medium: {
          continuous: true,
          interimResults: true,
          modelSize: 'medium',
          languageModelBoost: false
        },
        low: {
          continuous: false,
          interimResults: false,
          modelSize: 'small',
          languageModelBoost: false
        }
      }
    })
  },
  synthesis: {
    id: 'voice.synthesis',
    type: COMPONENT_TYPES.VOICE_SYNTHESIS,
    pauseEvent: 'voice:synthesis:pause',
    resumeEvent: 'voice:synthesis:resume',
    reduceEvent: 'voice:synthesis:reduce_resources',
    configEvent: 'voice:synthesis:config_updated',
    cpuPriority: 5,
    memoryFootprint: 20,
    isEssential: false,
    category: 'voice',
    adaptiveOptions: createAdaptiveOptions({
      importance: 'medium',
      accessibilityFeature: false,
      resourceIntensity: 'medium',
      canReduceQuality: true,
      minimalModeOperation: true,
      qualityLevels: {
        high: {
          voiceQuality: 'premium',
          pitch: 1.0,
          rate: 1.0,
          volume: 1.0
        },
        medium: {
          voiceQuality: 'standard',
          pitch: 1.0,
          rate: 1.0,
          volume: 1.0
        },
        low: {
          voiceQuality: 'basic',
          pitch: 1.0,
          rate: 1.0,
          volume: 1.0
        }
      }
    })
  },
  training: {
    id: 'voice.training',
    type: COMPONENT_TYPES.VOICE_TRAINING,
    pauseEvent: 'voice:training:pause',
    resumeEvent: 'voice:training:resume',
    reduceEvent: 'voice:training:reduce_resources',
    configEvent: 'voice:training:config_updated',
    cpuPriority: 3,
    memoryFootprint: 40,
    isEssential: false,
    category: 'training',
    adaptiveOptions: createAdaptiveOptions({
      importance: 'low',
      accessibilityFeature: false,
      resourceIntensity: 'high',
      canReduceQuality: true,
      minimalModeOperation: false,
      qualityLevels: {
        high: {
          iterationCount: 1000,
          batchSize: 64,
          modelComplexity: 'full'
        },
        medium: {
          iterationCount: 500,
          batchSize: 32,
          modelComplexity: 'reduced'
        },
        low: {
          iterationCount: 100,
          batchSize: 16,
          modelComplexity: 'minimal'
        }
      }
    })
  },
  advancedFeatures: {
    id: 'voice.advancedFeatures',
    type: COMPONENT_TYPES.VOICE_RECOGNITION,
    pauseEvent: 'voice:advanced_features:pause',
    resumeEvent: 'voice:advanced_features:resume',
    reduceEvent: 'voice:advanced_features:reduce_resources',
    configEvent: 'voice:advanced_features:config_updated',
    cpuPriority: 2,
    memoryFootprint: 35,
    isEssential: false,
    category: 'enhancement',
    adaptiveOptions: createAdaptiveOptions({
      importance: 'low',
      accessibilityFeature: false,
      resourceIntensity: 'very_high',
      canReduceQuality: true,
      minimalModeOperation: false,
      qualityLevels: {
        high: {
          emotionDetection: true,
          contextualAnalysis: true,
          accentAdaptation: true
        },
        medium: {
          emotionDetection: false,
          contextualAnalysis: true,
          accentAdaptation: false
        },
        low: {
          emotionDetection: false,
          contextualAnalysis: false,
          accentAdaptation: false
        }
      }
    })
  }
};

// Create a module integration for voice components
const voiceIntegration = createAdaptiveIntegration({
  name: 'Voice System',
  components: voiceComponentConfigs,
  onRegister: ({ componentId, component, fullComponentId }) => {
    // Handle component registration
    console.log(`[Voice] Registered component: ${componentId}`);
    addAuditEntry({
      type: 'voice-system',
      action: 'component-registered',
      details: { componentId: fullComponentId, category: component.category, isEssential: component.isEssential, adaptiveOptions: component.adaptiveOptions }
    });
  },
  onModeChange: ({ mode, previousMode, component, componentId, qualityConfig }) => {
    // Handle resource mode change
    console.log(`[Voice] Applying resource mode '${mode}' to component: ${componentId}`);
    addAuditEntry({ type: 'voice-system', action: 'resource-mode-changed', details: { componentId, previousMode, newMode: mode, qualityConfig } });
    publish(component.configEvent, { mode, reason: 'resource_management', qualityConfig, timestamp: Date.now() });
    
    // Track current mode
    currentMode = mode;
    
    return true;
  },
  onPause: ({ component, componentId }) => {
    // Handle component pause
    console.log(`[Voice] Pausing component: ${componentId}`);
    addAuditEntry({ type: 'voice-system', action: 'component-paused', details: { componentId } });
    publish(component.pauseEvent, { reason: 'resource_management', timestamp: Date.now() });
    return true;
  },
  onResume: ({ component, componentId }) => {
    // Handle component resume
    console.log(`[Voice] Resuming component: ${componentId}`);
    addAuditEntry({ type: 'voice-system', action: 'component-resumed', details: { componentId } });
    publish(component.resumeEvent, { reason: 'resource_management', timestamp: Date.now() });
    return true;
  },
  onReduceResources: ({ component, componentId, mode }) => {
    // Handle request to reduce resource usage
    console.log(`[Voice] Reducing resources for component: ${componentId}`);
    const qualityConfig = getQualityConfigForMode(component, mode);
    
    addAuditEntry({ 
      type: 'voice-system', 
      action: 'resources-reduced', 
      details: { 
        componentId, 
        mode, 
        qualityConfig 
      }
    });
    
    publish(component.reduceEvent, { mode, reason: 'resource_management', qualityConfig, timestamp: Date.now() });
    return true;
  }
});

// Function to register all voice components with Resource Allocation Manager
function registerWithResourceManager(options = {}) {
  try {
    const result = voiceIntegration.register();
    
    // Initialize integration with other modules
    initNetworkStatusIntegration();
    initStorageIntegration();
    initFeatureDetectionIntegration();
    
    console.log('[Voice] Successfully registered with Resource Allocation Manager');
    addAuditEntry({ 
      type: 'voice-system', 
      action: 'system-registered', 
      details: { 
        componentCount: Object.keys(voiceComponentConfigs).length,
        options 
      }
    });
    
    return result;
  } catch (error) {
    console.error('[Voice] Failed to register with Resource Allocation Manager:', error);
    addAuditEntry({ type: 'voice-system', action: 'registration-failed', details: { error: error.message } });
    return false;
  }
}

// Function to unregister all voice components
function unregisterFromResourceManager() {
  try {
    const result = voiceIntegration.unregister();
    
    console.log('[Voice] Successfully unregistered from Resource Allocation Manager');
    addAuditEntry({ 
      type: 'voice-system', 
      action: 'system-unregistered', 
      details: { 
        componentCount: Object.keys(voiceComponentConfigs).length 
      }
    });
    
    return result;
  } catch (error) {
    console.error('[Voice] Failed to unregister from Resource Allocation Manager:', error);
    addAuditEntry({ type: 'voice-system', action: 'unregistration-failed', details: { error: error.message } });
    return false;
  }
}

// Function to handle global system resource mode changes
function handleGlobalResourceModeChange(data) {
  const { newMode, previousMode, reason } = data;
  
  console.log(`[Voice] Resource allocation mode changed: ${previousMode} -> ${newMode} (Reason: ${reason})`);
  
  // Update tracking of current resource mode
  currentMode = newMode;
  
  // Special handling for extreme resource constraints
  if (newMode === RESOURCE_MODES.MINIMAL) {
    console.log('[Voice] Entering minimal resource mode - reducing voice functionality');
    
    // Disable non-essential voice features
    Object.entries(voiceComponentConfigs).forEach(([key, component]) => {
      if (!component.isEssential && !component.adaptiveOptions.minimalModeOperation) {
        // Pause components that cannot operate in minimal mode
        console.log(`[Voice] Pausing non-essential component in minimal mode: ${component.id}`);
        publish(component.pauseEvent, { 
          reason: 'resource_constraint', 
          mode: newMode, 
          timestamp: Date.now() 
        });
      } else if (component.adaptiveOptions.canReduceQuality) {
        // Reduce quality for components that can operate with reduced quality
        const qualityConfig = component.adaptiveOptions.qualityLevels.low;
        console.log(`[Voice] Reducing quality for component: ${component.id}`);
        publish(component.configEvent, { 
          mode: newMode, 
          reason: 'resource_constraint', 
          qualityConfig, 
          timestamp: Date.now() 
        });
      }
    });
    
    addAuditEntry({ 
      type: 'voice-system', 
      action: 'entered-minimal-mode', 
      details: { 
        previousMode,
        disabledFeatures: Object.keys(voiceComponentConfigs)
          .filter(key => !voiceComponentConfigs[key].isEssential && 
                 !voiceComponentConfigs[key].adaptiveOptions.minimalModeOperation)
      }
    });
  } else if (previousMode === RESOURCE_MODES.MINIMAL && newMode !== RESOURCE_MODES.MINIMAL) {
    console.log('[Voice] Exiting minimal resource mode - restoring voice functionality');
    
    // Re-enable previously disabled components
    Object.entries(voiceComponentConfigs).forEach(([key, component]) => {
      if (!component.isEssential && !component.adaptiveOptions.minimalModeOperation) {
        // Resume components that were paused in minimal mode
        console.log(`[Voice] Resuming component after minimal mode: ${component.id}`);
        publish(component.resumeEvent, { 
          reason: 'resource_available', 
          mode: newMode, 
          timestamp: Date.now() 
        });
      }
    });
    
    addAuditEntry({ 
      type: 'voice-system', 
      action: 'exited-minimal-mode', 
      details: { 
        newMode,
        restoredFeatures: Object.keys(voiceComponentConfigs)
          .filter(key => !voiceComponentConfigs[key].isEssential && 
                 !voiceComponentConfigs[key].adaptiveOptions.minimalModeOperation)
      }
    });
  }
}

// Initialize integration with Network Status module
function initNetworkStatusIntegration() {
  const networkStatus = NetworkStatus.getInstance();
  networkStatus.onStatusChange(handleNetworkStatusChange);
  console.log('[Voice] Network status integration initialized');
}

// Handle network status changes
function handleNetworkStatusChange(data) {
  const { status, previousStatus, details } = data;
  
  console.log(`[Voice] Network status changed: ${previousStatus} -> ${status}`);
  
  if (status === 'offline') {
    console.log('[Voice] Network offline - adjusting voice components');
    
    // Disable components that require network
    Object.entries(voiceComponentConfigs).forEach(([key, component]) => {
      if (key === 'advancedFeatures') {
        // Advanced features often require network connectivity
        console.log(`[Voice] Pausing network-dependent component: ${component.id}`);
        publish(component.pauseEvent, { 
          reason: 'network_offline', 
          timestamp: Date.now() 
        });
      }
    });
    
    addAuditEntry({ 
      type: 'voice-system', 
      action: 'network-offline-adaptation', 
      details: { 
        disabledFeatures: ['advancedFeatures'],
        networkDetails: details
      }
    });
  } else if (previousStatus === 'offline' && status === 'online') {
    console.log('[Voice] Network restored - resuming voice components');
    
    // Resume components that were paused due to network
    Object.entries(voiceComponentConfigs).forEach(([key, component]) => {
      if (key === 'advancedFeatures') {
        // Resume advanced features when network is restored
        console.log(`[Voice] Resuming network-dependent component: ${component.id}`);
        publish(component.resumeEvent, { 
          reason: 'network_online', 
          timestamp: Date.now() 
        });
      }
    });
    
    addAuditEntry({ 
      type: 'voice-system', 
      action: 'network-online-restoration', 
      details: { 
        restoredFeatures: ['advancedFeatures'],
        networkDetails: details
      }
    });
  } else if (status === 'slow') {
    console.log('[Voice] Network slow - reducing quality of network-dependent components');
    
    // Reduce quality for network-dependent components
    Object.entries(voiceComponentConfigs).forEach(([key, component]) => {
      if (key === 'advancedFeatures' && component.adaptiveOptions.canReduceQuality) {
        const qualityConfig = component.adaptiveOptions.qualityLevels.low;
        console.log(`[Voice] Reducing quality for network-dependent component: ${component.id}`);
        publish(component.configEvent, { 
          reason: 'network_slow', 
          qualityConfig, 
          timestamp: Date.now() 
        });
      }
    });
    
    addAuditEntry({ 
      type: 'voice-system', 
      action: 'network-slow-adaptation', 
      details: { 
        adjustedFeatures: ['advancedFeatures'],
        networkDetails: details
      }
    });
  }
}

// Initialize integration with Storage Capabilities module
function initStorageIntegration() {
  const storage = StorageCapabilities.getInstance();
  storage.onQuotaWarning(handleStorageQuotaWarning);
  storage.onAvailabilityChange(handleStorageAvailabilityChange);
  console.log('[Voice] Storage capabilities integration initialized');
}

// Handle storage quota warnings
function handleStorageQuotaWarning(data) {
  const { level, quotaUsed, quotaTotal } = data;
  
  console.log(`[Voice] Storage quota warning: ${level} (${quotaUsed}/${quotaTotal} bytes used)`);
  
  if (level === 'critical') {
    console.log('[Voice] Critical storage warning - pausing training component');
    
    // Pause storage-intensive components
    const trainingComponent = voiceComponentConfigs.training;
    publish(trainingComponent.pauseEvent, { 
      reason: 'storage_critical', 
      timestamp: Date.now() 
    });
    
    addAuditEntry({ 
      type: 'voice-system', 
      action: 'storage-critical-adaptation', 
      details: { 
        disabledFeatures: ['training'],
        quotaUsed,
        quotaTotal,
        percentUsed: Math.round((quotaUsed / quotaTotal) * 100)
      }
    });
  } else if (level === 'warning') {
    console.log('[Voice] Storage warning - reducing training data retention');
    
    // Notify training component to reduce storage usage
    const trainingComponent = voiceComponentConfigs.training;
    publish(trainingComponent.reduceEvent, { 
      reason: 'storage_warning', 
      timestamp: Date.now() 
    });
    
    addAuditEntry({ 
      type: 'voice-system', 
      action: 'storage-warning-adaptation', 
      details: { 
        adjustedFeatures: ['training'],
        quotaUsed,
        quotaTotal,
        percentUsed: Math.round((quotaUsed / quotaTotal) * 100)
      }
    });
  }
}

// Handle storage availability changes
function handleStorageAvailabilityChange(data) {
  const { available, previouslyAvailable } = data;
  
  console.log(`[Voice] Storage availability changed: ${previouslyAvailable} -> ${available}`);
  
  if (!available) {
    console.log('[Voice] Storage unavailable - disabling training component');
    
    // Disable components that require storage
    const trainingComponent = voiceComponentConfigs.training;
    publish(trainingComponent.pauseEvent, { 
      reason: 'storage_unavailable', 
      timestamp: Date.now() 
    });
    
    addAuditEntry({ 
      type: 'voice-system', 
      action: 'storage-unavailable-adaptation', 
      details: { 
        disabledFeatures: ['training']
      }
    });
  } else if (!previouslyAvailable && available) {
    console.log('[Voice] Storage became available - resuming training component');
    
    // Resume components when storage becomes available
    const trainingComponent = voiceComponentConfigs.training;
    publish(trainingComponent.resumeEvent, { 
      reason: 'storage_available', 
      timestamp: Date.now() 
    });
    
    addAuditEntry({ 
      type: 'voice-system', 
      action: 'storage-available-restoration', 
      details: { 
        restoredFeatures: ['training']
      }
    });
  }
}

// Initialize integration with Feature Detection module
function initFeatureDetectionIntegration() {
  const featureDetection = FeatureDetection.getInstance();
  featureDetection.onFeaturesDetected('voice', handleFeatureDetectionResults);
  console.log('[Voice] Feature detection integration initialized');
  
  // Proactively request feature detection
  featureDetection.detect('voice');
}

// Handle feature detection results
function handleFeatureDetectionResults(features) {
  console.log('[Voice] Feature detection results received:', features);
  
  if (!features.webSpeechSupported) {
    console.log('[Voice] Web Speech API not supported - disabling recognition and synthesis');
    
    // Disable components that require Web Speech API
    ['recognition', 'synthesis'].forEach(componentKey => {
      const component = voiceComponentConfigs[componentKey];
      publish(component.pauseEvent, { 
        reason: 'feature_unsupported', 
        timestamp: Date.now() 
      });
    });
    
    addAuditEntry({ 
      type: 'voice-system', 
      action: 'features-unsupported', 
      details: { 
        disabledFeatures: ['recognition', 'synthesis'],
        missingFeatures: ['webSpeechSupported']
      }
    });
  }
  
  if (features.webSpeechSupported && !features.speechRecognitionSupported) {
    console.log('[Voice] Speech Recognition not supported - disabling recognition components');
    
    // Disable recognition components
    const component = voiceComponentConfigs.recognition;
    publish(component.pauseEvent, { 
      reason: 'feature_unsupported', 
      timestamp: Date.now() 
    });
    
    addAuditEntry({ 
      type: 'voice-system', 
      action: 'features-unsupported', 
      details: { 
        disabledFeatures: ['recognition'],
        missingFeatures: ['speechRecognitionSupported']
      }
    });
  }
  
  if (features.webSpeechSupported && !features.speechSynthesisSupported) {
    console.log('[Voice] Speech Synthesis not supported - disabling synthesis component');
    
    // Disable synthesis component
    const component = voiceComponentConfigs.synthesis;
    publish(component.pauseEvent, { 
      reason: 'feature_unsupported', 
      timestamp: Date.now() 
    });
    
    addAuditEntry({ 
      type: 'voice-system', 
      action: 'features-unsupported', 
      details: { 
        disabledFeatures: ['synthesis'],
        missingFeatures: ['speechSynthesisSupported']
      }
    });
  }
  
  if (!features.audioContextSupported) {
    console.log('[Voice] AudioContext not supported - disabling advanced features');
    
    // Disable components that require AudioContext
    const component = voiceComponentConfigs.advancedFeatures;
    publish(component.pauseEvent, { 
      reason: 'feature_unsupported', 
      timestamp: Date.now() 
    });
    
    addAuditEntry({ 
      type: 'voice-system', 
      action: 'features-unsupported', 
      details: { 
        disabledFeatures: ['advancedFeatures'],
        missingFeatures: ['audioContextSupported']
      }
    });
  }
}

// Function to get current resource mode
function getCurrentResourceMode() {
  return currentMode;
}

// Function to get quality configuration for a specific component and mode
function getComponentQualityConfig(componentId, mode = null) {
  const targetMode = mode || currentMode;
  const component = Object.values(voiceComponentConfigs).find(c => c.id === componentId);
  return component ? getQualityConfigForMode(component, targetMode) : null;
}

// Function to update a single component's configuration
function updateComponentConfiguration(componentId, config = {}) {
  return voiceIntegration.updateComponentConfig(componentId, config);
}

// Subscribe to global resource mode changes
subscribe('resource-manager:mode-changed', handleGlobalResourceModeChange);

// Export the public API
export {
  registerWithResourceManager,
  unregisterFromResourceManager,
  getCurrentResourceMode,
  getComponentQualityConfig,
  updateComponentConfiguration,
  voiceComponentConfigs
};
