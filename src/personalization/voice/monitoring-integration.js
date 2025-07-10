/**
 * @file monitoring-integration.js
 * @description Integrates the Voice System with the System Monitoring Dashboard
 * @module personalization/voice/monitoring-integration
 * @author ALEJO Development Team
 * @copyright 2025 ALEJO Project
 * @license MIT
 */

import { subscribe, publish } from '../../core/events.js';
import { getCurrentResourceMode, getComponentQualityConfig } from './performance-integration.js';
import { addAuditEntry } from '../../core/audit-trail.js';

// Component status tracking
const componentStatus = {
  system: {
    status: 'initializing',
    lastUpdated: Date.now(),
    metrics: {},
    errors: []
  },
  training: {
    status: 'initializing',
    lastUpdated: Date.now(),
    metrics: {},
    errors: []
  },
  recognition: {
    status: 'initializing',
    lastUpdated: Date.now(),
    metrics: {},
    errors: []
  },
  synthesis: {
    status: 'initializing',
    lastUpdated: Date.now(),
    metrics: {},
    errors: []
  },
  advancedFeatures: {
    status: 'initializing',
    lastUpdated: Date.now(),
    metrics: {},
    errors: []
  }
};

// Statistics collection
let statistics = {
  recognitionAttempts: 0,
  recognitionSuccesses: 0,
  recognitionErrors: 0,
  synthesisRequests: 0,
  synthesisCompletions: 0,
  trainingSessionsStarted: 0,
  trainingSessionsCompleted: 0,
  averageRecognitionTime: 0,
  averageSynthesisTime: 0
};

/**
 * Initialize the monitoring integration for the voice system
 * @returns {Promise<boolean>} Whether initialization was successful
 */
export async function initializeMonitoring() {
  try {
    // Set up event subscriptions for voice system events
    subscribe('voice:system:status-changed', handleSystemStatusChange);
    subscribe('voice:recognition:status-changed', handleRecognitionStatusChange);
    subscribe('voice:synthesis:status-changed', handleSynthesisStatusChange);
    subscribe('voice:training:status-changed', handleTrainingStatusChange);
    subscribe('voice:advanced-features:status-changed', handleAdvancedFeaturesStatusChange);
    
    // Subscribe to error events
    subscribe('voice:system:error', handleSystemError);
    subscribe('voice:recognition:error', handleRecognitionError);
    subscribe('voice:synthesis:error', handleSynthesisError);
    subscribe('voice:training:error', handleTrainingError);
    subscribe('voice:advanced-features:error', handleAdvancedFeaturesError);
    
    // Subscribe to performance metrics events
    subscribe('voice:recognition:performance-metrics', updateRecognitionMetrics);
    subscribe('voice:synthesis:performance-metrics', updateSynthesisMetrics);
    
    // Subscribe to dashboard polling events
    subscribe('dashboard:poll-status', publishVoiceStatus);
    
    // Log initialization
    addAuditEntry({
      component: 'voice.monitoring',
      action: 'initialize',
      details: 'Voice system monitoring integration initialized'
    });
    
    return true;
  } catch (error) {
    console.error('Failed to initialize voice monitoring integration:', error);
    return false;
  }
}

/**
 * Handle system status change events
 * @param {Object} data - Status change data
 */
function handleSystemStatusChange(data) {
  componentStatus.system = {
    ...componentStatus.system,
    ...data,
    lastUpdated: Date.now()
  };
  
  publishVoiceStatus();
}

/**
 * Handle recognition status change events
 * @param {Object} data - Status change data
 */
function handleRecognitionStatusChange(data) {
  componentStatus.recognition = {
    ...componentStatus.recognition,
    ...data,
    lastUpdated: Date.now()
  };
  
  if (data.event === 'start') {
    statistics.recognitionAttempts++;
  } else if (data.event === 'success') {
    statistics.recognitionSuccesses++;
    // Update average recognition time
    const newTime = data.metrics?.processingTime || 0;
    statistics.averageRecognitionTime = updateRunningAverage(
      statistics.averageRecognitionTime,
      newTime,
      statistics.recognitionSuccesses
    );
  }
  
  publishVoiceStatus();
}

/**
 * Handle synthesis status change events
 * @param {Object} data - Status change data
 */
function handleSynthesisStatusChange(data) {
  componentStatus.synthesis = {
    ...componentStatus.synthesis,
    ...data,
    lastUpdated: Date.now()
  };
  
  if (data.event === 'start') {
    statistics.synthesisRequests++;
  } else if (data.event === 'complete') {
    statistics.synthesisCompletions++;
    // Update average synthesis time
    const newTime = data.metrics?.processingTime || 0;
    statistics.averageSynthesisTime = updateRunningAverage(
      statistics.averageSynthesisTime,
      newTime,
      statistics.synthesisCompletions
    );
  }
  
  publishVoiceStatus();
}

/**
 * Handle training status change events
 * @param {Object} data - Status change data
 */
function handleTrainingStatusChange(data) {
  componentStatus.training = {
    ...componentStatus.training,
    ...data,
    lastUpdated: Date.now()
  };
  
  if (data.event === 'session-start') {
    statistics.trainingSessionsStarted++;
  } else if (data.event === 'session-complete') {
    statistics.trainingSessionsCompleted++;
  }
  
  publishVoiceStatus();
}

/**
 * Handle advanced features status change events
 * @param {Object} data - Status change data
 */
function handleAdvancedFeaturesStatusChange(data) {
  componentStatus.advancedFeatures = {
    ...componentStatus.advancedFeatures,
    ...data,
    lastUpdated: Date.now()
  };
  
  publishVoiceStatus();
}

/**
 * Handle system errors
 * @param {Object} error - Error data
 */
function handleSystemError(error) {
  componentStatus.system.errors.push({
    timestamp: Date.now(),
    error
  });
  componentStatus.system.status = 'error';
  componentStatus.system.lastUpdated = Date.now();
  
  publishVoiceStatus();
}

/**
 * Handle recognition errors
 * @param {Object} error - Error data
 */
function handleRecognitionError(error) {
  componentStatus.recognition.errors.push({
    timestamp: Date.now(),
    error
  });
  componentStatus.recognition.status = 'error';
  componentStatus.recognition.lastUpdated = Date.now();
  
  statistics.recognitionErrors++;
  
  publishVoiceStatus();
}

/**
 * Handle synthesis errors
 * @param {Object} error - Error data
 */
function handleSynthesisError(error) {
  componentStatus.synthesis.errors.push({
    timestamp: Date.now(),
    error
  });
  componentStatus.synthesis.status = 'error';
  componentStatus.synthesis.lastUpdated = Date.now();
  
  publishVoiceStatus();
}

/**
 * Handle training errors
 * @param {Object} error - Error data
 */
function handleTrainingError(error) {
  componentStatus.training.errors.push({
    timestamp: Date.now(),
    error
  });
  componentStatus.training.status = 'error';
  componentStatus.training.lastUpdated = Date.now();
  
  publishVoiceStatus();
}

/**
 * Handle advanced features errors
 * @param {Object} error - Error data
 */
function handleAdvancedFeaturesError(error) {
  componentStatus.advancedFeatures.errors.push({
    timestamp: Date.now(),
    error
  });
  componentStatus.advancedFeatures.status = 'error';
  componentStatus.advancedFeatures.lastUpdated = Date.now();
  
  publishVoiceStatus();
}

/**
 * Update recognition metrics
 * @param {Object} metrics - Performance metrics
 */
function updateRecognitionMetrics(metrics) {
  componentStatus.recognition.metrics = {
    ...componentStatus.recognition.metrics,
    ...metrics
  };
  
  publishVoiceStatus();
}

/**
 * Update synthesis metrics
 * @param {Object} metrics - Performance metrics
 */
function updateSynthesisMetrics(metrics) {
  componentStatus.synthesis.metrics = {
    ...componentStatus.synthesis.metrics,
    ...metrics
  };
  
  publishVoiceStatus();
}

/**
 * Publish current voice status to the system
 */
function publishVoiceStatus() {
  // Get the current resource mode and quality config
  const resourceMode = getCurrentResourceMode();
  const qualityConfigs = {
    system: getComponentQualityConfig('voice.system', resourceMode),
    recognition: getComponentQualityConfig('voice.recognition', resourceMode),
    synthesis: getComponentQualityConfig('voice.synthesis', resourceMode),
    training: getComponentQualityConfig('voice.training', resourceMode),
    advancedFeatures: getComponentQualityConfig('voice.advancedFeatures', resourceMode)
  };
  
  // Prepare status report
  const statusReport = {
    componentType: 'voice',
    components: componentStatus,
    statistics,
    resourceMode,
    qualityConfigs,
    lastUpdated: Date.now()
  };
  
  // Publish status report for the monitoring dashboard
  publish('monitoring:component-status-update', {
    type: 'voice',
    data: statusReport
  });
}

/**
 * Update a running average with a new value
 * @param {number} currentAvg - Current average
 * @param {number} newValue - New value
 * @param {number} n - Number of values
 * @returns {number} - Updated average
 */
function updateRunningAverage(currentAvg, newValue, n) {
  return ((currentAvg * (n - 1)) + newValue) / n;
}

/**
 * Get the current status of all voice components
 * @returns {Object} - Voice component status
 */
export function getVoiceStatus() {
  return {
    componentStatus,
    statistics,
    resourceMode: getCurrentResourceMode()
  };
}

/**
 * Reset error counts and statistics
 */
export function resetStatistics() {
  statistics = {
    recognitionAttempts: 0,
    recognitionSuccesses: 0,
    recognitionErrors: 0,
    synthesisRequests: 0,
    synthesisCompletions: 0,
    trainingSessionsStarted: 0,
    trainingSessionsCompleted: 0,
    averageRecognitionTime: 0,
    averageSynthesisTime: 0
  };
  
  // Clear error arrays
  Object.keys(componentStatus).forEach(key => {
    componentStatus[key].errors = [];
  });
  
  publishVoiceStatus();
}
