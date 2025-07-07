/**
 * ALEJO Multimodal Integration
 * 
 * This module integrates the multimodal fusion system with existing accessibility components:
 * - Eye tracking
 * - Gesture recognition
 * - Sign language processing
 * - Voice commands
 * - Mobility assistance
 * 
 * It serves as a bridge between these components and ensures they work together seamlessly.
 * 
 * @module personalization/accessibility/multimodal-integration
 */

import { publish, subscribe, unsubscribe } from '../../events.js';
import { getLogger } from '../../utils/logger.js';
import multimodalFusion from './multimodal-fusion.js';
import mobilityAssistance from './mobility-assistance.js';

const logger = getLogger('multimodal-integration');

// Module state
let initialized = false;
let config = {
  debug: false,
  autoStart: true,
  adaptiveMode: true,
  // Components to integrate
  components: {
    eye: true,
    gesture: true,
    signLanguage: true,
    voice: true,
    mobility: true
  }
};

/**
 * Initialize the multimodal integration
 * @param {Object} options - Configuration options
 * @returns {Promise<boolean>} - Success status
 */
async function initialize(options = {}) {
  try {
    logger.info('Initializing multimodal integration');
    
    // Update configuration
    config = {
      ...config,
      ...options
    };
    
    // Initialize multimodal fusion system
    await multimodalFusion.initialize({
      debug: config.debug,
      contextAwareness: true
    });
    
    // Set up event subscriptions
    setupEventSubscriptions();
    
    // Register commands
    registerAccessibilityCommands();
    
    // Auto-start components if configured
    if (config.autoStart) {
      await startComponents();
    }
    
    initialized = true;
    logger.info('Multimodal integration initialized');
    
    // Publish initialization event
    publish('accessibility:multimodal:integration:initialized', { timestamp: Date.now() });
    
    return true;
  } catch (error) {
    logger.error('Failed to initialize multimodal integration', error);
    return false;
  }
}

/**
 * Set up event subscriptions
 */
function setupEventSubscriptions() {
  // Subscribe to multimodal fusion commands
  subscribe('accessibility:multimodal:command', handleMultimodalCommand);
  
  // Subscribe to component status events
  subscribe('eye:system:status', handleComponentStatus('eye'));
  subscribe('gesture:system:status', handleComponentStatus('gesture'));
  subscribe('sign:system:status', handleComponentStatus('signLanguage'));
  subscribe('voice:system:status', handleComponentStatus('voice'));
  
  // Subscribe to mobility profile updates
  subscribe('accessibility:mobility:profile_updated', handleMobilityProfileUpdate);
  
  // Subscribe to context changes
  subscribe('system:context:changed', handleContextChange);
  
  // Subscribe to settings updates
  subscribe('settings:updated:accessibility', handleAccessibilitySettingsUpdate);
  
  logger.debug('Event subscriptions set up');
}

/**
 * Handle component status changes
 * @param {string} component - Component name
 * @returns {Function} - Event handler
 */
function handleComponentStatus(component) {
  return (data) => {
    if (data && typeof data.active === 'boolean') {
      logger.debug(`${component} component is now ${data.active ? 'active' : 'inactive'}`);
      
      // Update component status in configuration
      config.components[component] = data.active;
      
      // Publish integrated status update
      publish('accessibility:integration:status', {
        component,
        active: data.active,
        timestamp: Date.now()
      });
    }
  };
}

/**
 * Handle multimodal commands
 * @param {Object} data - Command data
 */
function handleMultimodalCommand(data) {
  if (!initialized) return;
  
  logger.debug(`Received multimodal command: ${JSON.stringify(data)}`);
  
  // Process command based on type and source
  const { modality, type, command } = data;
  
  // Handle accessibility-specific commands
  if (type === 'command' && command && command.startsWith('accessibility:')) {
    handleAccessibilityCommand(command, data);
  }
  
  // Forward command to appropriate component
  switch (modality) {
    case 'eye':
      // Handle eye-based commands
      if (type === 'click') {
        publish('ui:action:click', {
          x: data.position.x,
          y: data.position.y,
          source: 'eye',
          timestamp: data.timestamp
        });
      }
      break;
      
    case 'gesture':
      // Handle gesture commands
      publish('gesture:action:performed', {
        name: data.name,
        confidence: data.confidence,
        timestamp: data.timestamp
      });
      break;
      
    case 'voice':
      // Voice commands already processed by the voice system
      // Just log for tracking
      logger.debug(`Voice command processed: ${data.command}`);
      break;
      
    default:
      // Generic handling
      logger.debug(`Command from ${modality} processed by multimodal fusion`);
  }
}

/**
 * Handle accessibility-specific commands
 * @param {string} command - Command string
 * @param {Object} data - Command data
 */
function handleAccessibilityCommand(command, data) {
  switch (command) {
    case 'accessibility:toggle:eye':
      toggleComponent('eye');
      break;
      
    case 'accessibility:toggle:gesture':
      toggleComponent('gesture');
      break;
      
    case 'accessibility:toggle:voice':
      toggleComponent('voice');
      break;
      
    case 'accessibility:toggle:adaptive':
      toggleAdaptiveMode();
      break;
      
    case 'accessibility:calibrate:eye':
      publish('eye:calibration:start', { source: data.modality });
      break;
      
    default:
      logger.debug(`Unknown accessibility command: ${command}`);
  }
}

/**
 * Toggle a component on/off
 * @param {string} component - Component name
 */
function toggleComponent(component) {
  const currentState = config.components[component];
  const newState = !currentState;
  
  // Update state
  config.components[component] = newState;
  
  // Publish component toggle event
  publish(`accessibility:${component}:toggle`, { 
    active: newState,
    timestamp: Date.now()
  });
  
  logger.info(`${component} component toggled to ${newState ? 'active' : 'inactive'}`);
}

/**
 * Toggle adaptive mode
 */
function toggleAdaptiveMode() {
  config.adaptiveMode = !config.adaptiveMode;
  
  // Publish adaptive mode change
  publish('accessibility:mobility:adaptive_mode', { 
    enabled: config.adaptiveMode,
    timestamp: Date.now()
  });
  
  logger.info(`Adaptive mode toggled to ${config.adaptiveMode ? 'enabled' : 'disabled'}`);
}

/**
 * Handle mobility profile updates
 * @param {Object} data - Profile data
 */
function handleMobilityProfileUpdate(data) {
  if (!data || !data.profile) return;
  
  const profile = data.profile;
  
  logger.debug(`Mobility profile updated: ${JSON.stringify(profile)}`);
  
  // Adjust component states based on profile if adaptive mode is enabled
  if (config.adaptiveMode) {
    adaptComponentsToProfile(profile);
  }
}

/**
 * Adapt components based on user profile
 * @param {Object} profile - User profile
 */
function adaptComponentsToProfile(profile) {
  // Enable/disable components based on user capabilities
  if (!profile.canUseHands) {
    // Can't use hands, prioritize eye tracking and voice
    if (!config.components.eye) {
      toggleComponent('eye');
    }
    
    if (!config.components.voice) {
      toggleComponent('voice');
    }
    
    // Disable gesture if it's enabled
    if (config.components.gesture) {
      toggleComponent('gesture');
    }
    
    logger.info('Adapted to no-hands profile: enabled eye and voice, disabled gesture');
  } else if (profile.hasLimitedMobility) {
    // Limited mobility, enable all input methods but adapt sensitivity
    if (!config.components.eye) {
      toggleComponent('eye');
    }
    
    if (!config.components.gesture) {
      toggleComponent('gesture');
    }
    
    if (!config.components.voice) {
      toggleComponent('voice');
    }
    
    // Publish sensitivity adjustment events
    publish('gesture:sensitivity:adjust', { level: 'high' });
    publish('voice:sensitivity:adjust', { level: 'high' });
    
    logger.info('Adapted to limited mobility profile: enabled all inputs with high sensitivity');
  } else {
    // Full mobility, use default configuration
    // No changes needed
    logger.info('Using standard configuration for full mobility profile');
  }
}

/**
 * Handle context changes
 * @param {Object} data - Context data
 */
function handleContextChange(data) {
  if (!data || !data.context) return;
  
  const { context } = data;
  
  logger.debug(`Context changed to: ${context}`);
  
  // Adapt to context if adaptive mode is enabled
  if (config.adaptiveMode) {
    adaptToContext(context);
  }
}

/**
 * Adapt to context
 * @param {string} context - Context name
 */
function adaptToContext(context) {
  switch (context) {
    case 'driving':
      // Prioritize voice and eye tracking when driving
      if (!config.components.voice) {
        toggleComponent('voice');
      }
      
      if (!config.components.eye) {
        toggleComponent('eye');
      }
      
      // Disable gesture if it's enabled
      if (config.components.gesture) {
        toggleComponent('gesture');
      }
      
      logger.info('Adapted to driving context: enabled voice and eye, disabled gesture');
      break;
      
    case 'meeting':
      // Prioritize gesture and eye in meetings (less disruptive)
      if (!config.components.gesture) {
        toggleComponent('gesture');
      }
      
      if (!config.components.eye) {
        toggleComponent('eye');
      }
      
      // Disable voice if it's enabled
      if (config.components.voice) {
        toggleComponent('voice');
      }
      
      logger.info('Adapted to meeting context: enabled gesture and eye, disabled voice');
      break;
      
    case 'home':
      // Enable all input methods at home
      if (!config.components.eye) {
        toggleComponent('eye');
      }
      
      if (!config.components.gesture) {
        toggleComponent('gesture');
      }
      
      if (!config.components.voice) {
        toggleComponent('voice');
      }
      
      logger.info('Adapted to home context: enabled all input methods');
      break;
      
    default:
      // No changes for unknown contexts
      logger.debug(`No specific adaptation for context: ${context}`);
  }
}

/**
 * Handle accessibility settings updates
 * @param {Object} data - Settings data
 */
function handleAccessibilitySettingsUpdate(data) {
  if (!data) return;
  
  // Check for multimodal integration settings
  if (data.multimodalIntegration) {
    // Update configuration
    config = {
      ...config,
      ...data.multimodalIntegration
    };
    
    logger.info('Multimodal integration settings updated');
  }
}

/**
 * Register accessibility commands
 */
function registerAccessibilityCommands() {
  // Register voice commands
  publish('voice:command:register', [
    {
      command: 'enable eye tracking',
      action: 'accessibility:toggle:eye',
      description: 'Enable or disable eye tracking'
    },
    {
      command: 'enable gestures',
      action: 'accessibility:toggle:gesture',
      description: 'Enable or disable gesture recognition'
    },
    {
      command: 'enable voice control',
      action: 'accessibility:toggle:voice',
      description: 'Enable or disable voice control'
    },
    {
      command: 'toggle adaptive mode',
      action: 'accessibility:toggle:adaptive',
      description: 'Toggle adaptive accessibility mode'
    },
    {
      command: 'calibrate eye tracking',
      action: 'accessibility:calibrate:eye',
      description: 'Start eye tracking calibration'
    }
  ]);
  
  // Register gesture commands
  publish('gesture:command:register', [
    {
      gesture: 'eye_point',
      action: 'accessibility:toggle:eye',
      description: 'Toggle eye tracking'
    },
    {
      gesture: 'hand_wave',
      action: 'accessibility:toggle:gesture',
      description: 'Toggle gesture recognition'
    },
    {
      gesture: 'mouth_open',
      action: 'accessibility:toggle:voice',
      description: 'Toggle voice control'
    },
    {
      gesture: 'head_nod',
      action: 'accessibility:toggle:adaptive',
      description: 'Toggle adaptive mode'
    }
  ]);
  
  logger.debug('Accessibility commands registered');
}

/**
 * Start all enabled components
 * @returns {Promise<boolean>} - Success status
 */
async function startComponents() {
  try {
    logger.info('Starting enabled components');
    
    // Start eye tracking if enabled
    if (config.components.eye) {
      publish('eye:system:start', { source: 'integration' });
    }
    
    // Start gesture recognition if enabled
    if (config.components.gesture) {
      publish('gesture:system:start', { source: 'integration' });
    }
    
    // Start sign language processing if enabled
    if (config.components.signLanguage) {
      publish('sign:system:start', { source: 'integration' });
    }
    
    // Start voice recognition if enabled
    if (config.components.voice) {
      publish('voice:system:start', { source: 'integration' });
    }
    
    logger.info('Components started');
    return true;
  } catch (error) {
    logger.error('Failed to start components', error);
    return false;
  }
}

/**
 * Stop all components
 * @returns {Promise<boolean>} - Success status
 */
async function stopComponents() {
  try {
    logger.info('Stopping all components');
    
    // Stop eye tracking
    publish('eye:system:stop', { source: 'integration' });
    
    // Stop gesture recognition
    publish('gesture:system:stop', { source: 'integration' });
    
    // Stop sign language processing
    publish('sign:system:stop', { source: 'integration' });
    
    // Stop voice recognition
    publish('voice:system:stop', { source: 'integration' });
    
    logger.info('All components stopped');
    return true;
  } catch (error) {
    logger.error('Failed to stop components', error);
    return false;
  }
}

/**
 * Clean up resources
 * @returns {boolean} - Success status
 */
function cleanup() {
  try {
    // Stop all components
    stopComponents();
    
    // Unsubscribe from events
    unsubscribe('accessibility:multimodal:command', handleMultimodalCommand);
    unsubscribe('eye:system:status', handleComponentStatus('eye'));
    unsubscribe('gesture:system:status', handleComponentStatus('gesture'));
    unsubscribe('sign:system:status', handleComponentStatus('signLanguage'));
    unsubscribe('voice:system:status', handleComponentStatus('voice'));
    unsubscribe('accessibility:mobility:profile_updated', handleMobilityProfileUpdate);
    unsubscribe('system:context:changed', handleContextChange);
    unsubscribe('settings:updated:accessibility', handleAccessibilitySettingsUpdate);
    
    // Clean up multimodal fusion
    multimodalFusion.cleanup();
    
    // Reset state
    initialized = false;
    
    logger.info('Multimodal integration cleaned up');
    return true;
  } catch (error) {
    logger.error('Failed to clean up multimodal integration', error);
    return false;
  }
}

// Export public API
export default {
  initialize,
  startComponents,
  stopComponents,
  toggleComponent,
  toggleAdaptiveMode,
  cleanup
};
