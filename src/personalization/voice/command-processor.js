/**
 * ALEJO Voice Command Processor
 * 
 * This module handles the processing of voice commands recognized by the voice recognition system.
 * It includes:
 * - Command pattern matching and intent recognition
 * - Command routing to appropriate handlers
 * - Contextual command processing
 * - Feedback and confirmation mechanisms
 * - Command history and learning
 * 
 * PRODUCTION FEATURES:
 * - Adaptive resource management for optimal performance
 * - Accessibility-first design with screen reader announcements
 * - Robust error handling with graceful degradation
 * - Performance optimization with command prioritization
 * - Command throttling to prevent resource exhaustion
 * - Detailed metrics collection for monitoring and optimization
 * - Comprehensive security checks for all commands
 * 
 * Follows ALEJO's core principles:
 * - Local-first: All processing happens on the user's device
 * - Privacy-respecting: No data sent to external services
 * - Accessibility-first: Designed to work with screen readers and other assistive tech
 * - Resource-efficient: Minimal CPU/memory usage
 */

import { EventBus } from '../../core/event-bus.js';
import { SecurityManager } from '../../security/index.js';
import { registerWithResourceManager, unregisterFromResourceManager } from './performance-integration.js';
import { addAuditEntry } from '../../core/audit-trail.js';
import { getSystemResourceMode } from '../../performance/system-check.js';
import { accessibilityAnnounce } from '../../core/accessibility.js';

// Try to import advanced features if available
let advancedFeatures;
try {
  advancedFeatures = import('./advanced-features.js');
} catch (e) {
  console.warn('Advanced voice features not available:', e.message);
  // Create a stub for graceful degradation
  advancedFeatures = {
    analyzeCommand: () => Promise.resolve({ confidence: 0.5 })
  };
}

// Command categories
const COMMAND_CATEGORIES = {
  NAVIGATION: 'navigation',
  INTERACTION: 'interaction',
  SYSTEM: 'system',
  ACCESSIBILITY: 'accessibility',
  PERSONALIZATION: 'personalization',
  QUERY: 'query',
  CONTROL: 'control'
};

// Default command patterns - can be extended through configuration
const DEFAULT_COMMAND_PATTERNS = {
  // Navigation commands
  'go to *': { 
    category: COMMAND_CATEGORIES.NAVIGATION, 
    handler: 'navigateTo',
    importance: 'medium' 
  },
  'open *': { 
    category: COMMAND_CATEGORIES.NAVIGATION, 
    handler: 'openResource',
    importance: 'medium' 
  },
  'back': { 
    category: COMMAND_CATEGORIES.NAVIGATION, 
    handler: 'navigateBack',
    importance: 'high' 
  },
  'forward': { 
    category: COMMAND_CATEGORIES.NAVIGATION, 
    handler: 'navigateForward',
    importance: 'high' 
  },
  
  // Accessibility commands - highest priority
  'enable * mode': { 
    category: COMMAND_CATEGORIES.ACCESSIBILITY, 
    handler: 'toggleAccessibilityFeature',
    importance: 'critical' 
  },
  'disable * mode': { 
    category: COMMAND_CATEGORIES.ACCESSIBILITY, 
    handler: 'toggleAccessibilityFeature',
    importance: 'critical' 
  },
  'increase *': { 
    category: COMMAND_CATEGORIES.ACCESSIBILITY, 
    handler: 'adjustAccessibilitySetting',
    importance: 'critical' 
  },
  'decrease *': { 
    category: COMMAND_CATEGORIES.ACCESSIBILITY, 
    handler: 'adjustAccessibilitySetting',
    importance: 'critical' 
  },
  
  // System commands
  'restart': { 
    category: COMMAND_CATEGORIES.SYSTEM, 
    handler: 'restartSystem',
    importance: 'low',
    requiresConfirmation: true
  },
  'shutdown': { 
    category: COMMAND_CATEGORIES.SYSTEM, 
    handler: 'shutdownSystem',
    importance: 'low',
    requiresConfirmation: true
  },
  
  // Control commands
  'pause': { 
    category: COMMAND_CATEGORIES.CONTROL, 
    handler: 'pauseCurrentActivity',
    importance: 'high' 
  },
  'resume': { 
    category: COMMAND_CATEGORIES.CONTROL, 
    handler: 'resumeCurrentActivity',
    importance: 'high' 
  },
  'stop': { 
    category: COMMAND_CATEGORIES.CONTROL, 
    handler: 'stopCurrentActivity',
    importance: 'critical' 
  },
  
  // Query commands
  'what is *': { 
    category: COMMAND_CATEGORIES.QUERY, 
    handler: 'handleInformationQuery',
    importance: 'medium' 
  },
  'how to *': { 
    category: COMMAND_CATEGORIES.QUERY, 
    handler: 'handleHowToQuery',
    importance: 'medium' 
  },
  'search for *': { 
    category: COMMAND_CATEGORIES.QUERY, 
    handler: 'handleSearchQuery',
    importance: 'medium' 
  },
};

// Command throttling configuration
let commandThrottling = {
  enabled: true,
  maxCommandsPerMinute: 30,
  commandTimestamps: [],
  criticalCommandsExempt: true
};

// Command history for learning and context
const MAX_HISTORY_SIZE = 100;
let commandHistory = [];

// Module state
let isInitialized = false;
let currentContext = 'default';
let commandPatterns = {};
let commandHandlers = {};
let resourceMode = 'medium'; // Default resource mode
let accessibilityMode = false;
let performanceLevel = 'standard';

// Performance monitoring metrics
let metrics = {
  totalCommands: 0,
  successfulCommands: 0,
  failedCommands: 0,
  avgProcessingTime: 0,
  commandsByCategory: {},
  errorRates: {},
  lastUpdate: Date.now()
};

// Accessibility preferences
const accessibilityPreferences = {
  verboseAnnouncements: false,
  confirmationRequired: false,
  commandFeedback: true,
  slowdownFactor: 1.0
};

// Duplicate declaration removed

/**
 * Initialize the voice command processor with production-ready features
 * @param {Object} options - Configuration options
 * @param {boolean} [options.enableResourceManagement=true] - Register with resource manager
 * @param {Object} [options.customCommandPatterns={}] - Custom command patterns to add
 * @param {Object} [options.customCommandHandlers={}] - Custom command handlers to register
 * @param {string} [options.initialContext='default'] - Initial command context
 * @param {boolean} [options.enableAccessibilityFeatures=true] - Enable enhanced accessibility support
 * @param {string} [options.performanceLevel='standard'] - Performance level: 'minimal', 'standard', 'enhanced'
 * @param {boolean} [options.enableMetrics=true] - Enable performance metrics collection
 * @returns {Promise<Object>} Initialization results with detailed status
 */
async function initialize(options = {}) {
  if (isInitialized) {
    console.warn('Voice command processor already initialized');
    return { success: true, status: 'already_initialized' };
  }
  
  const initStartTime = performance.now();
  console.log('Initializing voice command processor...');
  
  // Set default options
  const initOptions = {
    enableResourceManagement: true,
    customCommandPatterns: {},
    customCommandHandlers: {},
    initialContext: 'default',
    enableAccessibilityFeatures: true,
    performanceLevel: 'standard',
    enableMetrics: true,
    ...options
  };
  
  try {
    // Track initialization for audit trail
    addAuditEntry('voice:commandProcessor:initializing', {
      options: {
        ...initOptions,
        // Don't log custom handlers/patterns in full to avoid excessive logging
        hasCustomPatterns: Object.keys(initOptions.customCommandPatterns).length > 0,
        hasCustomHandlers: Object.keys(initOptions.customCommandHandlers).length > 0
      }
    });
    
    // Check system resources and adapt accordingly
    try {
      resourceMode = await getSystemResourceMode();
      console.log(`Adapting command processor for resource mode: ${resourceMode}`);
      
      // Adjust performance settings based on resource mode
      performanceLevel = initOptions.performanceLevel;
      if (resourceMode === 'minimal' && performanceLevel === 'enhanced') {
        performanceLevel = 'standard';
        console.log('Downgraded performance level due to resource constraints');
      } else if (resourceMode === 'critical' && performanceLevel !== 'minimal') {
        performanceLevel = 'minimal';
        console.log('Set minimal performance level due to critical resource constraints');
      }
    } catch (error) {
      console.warn('Failed to determine system resource mode:', error);
      // Continue with default settings
    }
    
    // Configure accessibility settings
    try {
      if (initOptions.enableAccessibilityFeatures) {
        // Try to fetch user's accessibility preferences
        const { getUserAccessibilityPreferences } = await import('../../core/accessibility.js');
        const userPrefs = await getUserAccessibilityPreferences();
        
        accessibilityMode = userPrefs?.enabled || false;
        if (userPrefs) {
          accessibilityPreferences.verboseAnnouncements = userPrefs.verboseAnnouncements || false;
          accessibilityPreferences.confirmationRequired = userPrefs.confirmationRequired || false;
          accessibilityPreferences.commandFeedback = userPrefs.commandFeedback !== false;
          accessibilityPreferences.slowdownFactor = userPrefs.interactionSlowdown || 1.0;
        }
        
        // Subscribe to accessibility preference changes
        EventBus.subscribe('accessibility:preferences:changed', (prefs) => {
          accessibilityMode = prefs?.enabled || false;
          accessibilityPreferences.verboseAnnouncements = prefs?.verboseAnnouncements || false;
          accessibilityPreferences.confirmationRequired = prefs?.confirmationRequired || false;
          accessibilityPreferences.commandFeedback = prefs?.commandFeedback !== false;
          accessibilityPreferences.slowdownFactor = prefs?.interactionSlowdown || 1.0;
        });
        
        console.log('Accessibility features configured:', { accessibilityMode, preferences: accessibilityPreferences });
      }
    } catch (error) {
      console.warn('Failed to configure accessibility features:', error);
      // Continue with default settings
    }
    
    // Register with resource manager if enabled
    let resourceRegistration = null;
    if (initOptions.enableResourceManagement) {
      resourceRegistration = await registerWithResourceManager({
        componentName: 'voice.commandProcessor',
        resourcePriority: 'high', // Command processor is high priority for accessibility
        adaptiveMode: true,
        onResourceModeChanged: (newMode) => {
          resourceMode = newMode;
          console.log(`Resource mode changed to ${newMode}, adapting command processor behavior`);
          
          // Adjust command throttling based on resource mode
          if (newMode === 'critical') {
            commandThrottling.enabled = true;
            commandThrottling.maxCommandsPerMinute = 10; // Severely restrict in critical mode
          } else if (newMode === 'minimal') {
            commandThrottling.enabled = true;
            commandThrottling.maxCommandsPerMinute = 20; // Moderate restriction in minimal mode
          } else {
            // Reset to defaults for normal modes
            commandThrottling.enabled = true;
            commandThrottling.maxCommandsPerMinute = 30;
          }
          
          // Announce resource mode change if in accessibility mode
          if (accessibilityMode && accessibilityPreferences.verboseAnnouncements) {
            accessibilityAnnounce({
              message: `Voice system adjusting to ${newMode} resource mode`,
              priority: 'polite'
            });
          }
        }
      });
      
      console.log('Registered with Resource Allocation Manager');
    }
    
    // Initialize command patterns with defaults
    commandPatterns = { ...DEFAULT_COMMAND_PATTERNS };
    
    // Add custom patterns if provided
    if (initOptions.customCommandPatterns) {
      for (const [pattern, config] of Object.entries(initOptions.customCommandPatterns)) {
        registerCommandPattern(pattern, config);
      }
    }
    
    // Register default command handlers
    registerDefaultCommandHandlers();
    
    // Register custom handlers if provided
    if (initOptions.customCommandHandlers) {
      for (const [name, handler] of Object.entries(initOptions.customCommandHandlers)) {
        registerCommandHandler(name, handler);
      }
    }
    
    // Set initial context
    currentContext = initOptions.initialContext;
    
    // Subscribe to voice recognition events
    let eventSubscription = false;
    try {
      EventBus.subscribe('voice:recognition:result', handleVoiceRecognitionResult);
      eventSubscription = true;
    } catch (error) {
      console.warn('Failed to subscribe to voice recognition events:', error);
      // Non-critical error, can still function with direct calls
    }
    
    // Subscribe to system performance events
    try {
      EventBus.subscribe('system:performance:mode', (data) => {
        performanceLevel = data.level || 'standard';
        console.log(`Performance level updated to ${performanceLevel}`);
      });
    } catch (error) {
      console.warn('Failed to subscribe to performance events:', error);
      // Non-critical error
    }
    
    // Make accessibility announcement
    if (accessibilityMode) {
      try {
        accessibilityAnnounce({
          message: 'Voice command processor initialized and ready',
          priority: 'polite'
        });
      } catch (error) {
        console.warn('Failed to make accessibility announcement:', error);
      }
    }
    
    isInitialized = true;
    const initDuration = performance.now() - initStartTime;
    
    // Log successful initialization
    addAuditEntry('voice:commandProcessor:initialized', {
      duration: initDuration,
      resourceMode,
      performanceLevel,
      accessibilityMode,
      eventSubscription
    });
    
    console.log(`Voice command processor initialized successfully in ${initDuration.toFixed(2)}ms`);
    
    return { 
      success: true, 
      status: 'initialized',
      duration: initDuration,
      resourceMode,
      performanceLevel,
      accessibilityMode,
      resourceRegistration: resourceRegistration ? true : false,
      eventSubscription
    };
  } catch (error) {
    console.error('Failed to initialize voice command processor:', error);
    
    // Log initialization failure
    addAuditEntry('voice:commandProcessor:initializationFailed', {
      error: error.message,
      stack: error.stack
    });
    
    return { 
      success: false, 
      status: 'error',
      error: error.message,
      errorType: error.name
    };
  }
}

/**
 * Shutdown the voice command processor with proper resource cleanup
 * @param {Object} [options] - Shutdown options
 * @param {boolean} [options.force=false] - Force shutdown even if errors occur
 * @param {boolean} [options.clearHistory=false] - Clear command history on shutdown
 * @param {boolean} [options.announceShutdown=true] - Announce shutdown to screen readers
 * @returns {Promise<Object>} Shutdown result with status details
 */
export async function shutdown(options = {}) {
  if (!isInitialized) {
    console.warn('Voice command processor not initialized');
    return { success: true, status: 'not_initialized' };
  }
  
  const shutdownStartTime = performance.now();
  console.log('Shutting down voice command processor...');
  
  // Default shutdown options
  const shutdownOptions = {
    force: false,
    clearHistory: false,
    announceShutdown: true,
    ...options
  };
  
  // Track for audit trail
  addAuditEntry('voice:commandProcessor:shuttingDown', {
    options: shutdownOptions
  });
  
  // Results tracking
  const results = {
    eventsUnsubscribed: false,
    resourceManagerUnregistered: false
  };
  
  try {
    // Make accessibility announcement first, in case other shutdown steps fail
    if (accessibilityMode && shutdownOptions.announceShutdown) {
      try {
        accessibilityAnnounce({
          message: 'Voice command processor shutting down',
          priority: 'polite'
        });
      } catch (error) {
        console.warn('Failed to make shutdown announcement:', error);
      }
    }
    
    // Unsubscribe from all event bus subscriptions
    try {
      EventBus.unsubscribe('voice:recognition:result', handleVoiceRecognitionResult);
      EventBus.unsubscribe('accessibility:preferences:changed');
      EventBus.unsubscribe('system:performance:mode');
      results.eventsUnsubscribed = true;
    } catch (error) {
      console.warn('Failed to unsubscribe from events:', error);
      if (!shutdownOptions.force) throw error;
    }
    
    // Unregister from resource manager
    try {
      await unregisterFromResourceManager('voice.commandProcessor');
      results.resourceManagerUnregistered = true;
    } catch (error) {
      console.warn('Failed to unregister from resource manager:', error);
      if (!shutdownOptions.force) throw error;
    }
    
    // Clear command history if requested
    if (shutdownOptions.clearHistory) {
      commandHistory.length = 0;
    }
    
    // Reset module state for clean restart potential
    commandThrottling.commandTimestamps = [];
    
    // Save final metrics to audit trail before clearing
    try {
      addAuditEntry('voice:commandProcessor:metrics', {
        totalCommands: metrics.totalCommands,
        successRate: metrics.totalCommands > 0 
          ? metrics.successfulCommands / metrics.totalCommands 
          : 0,
        avgProcessingTime: metrics.avgProcessingTime,
        topCategories: Object.entries(metrics.commandsByCategory)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([category, count]) => ({ category, count }))
      });
    } catch (error) {
      console.warn('Failed to save metrics to audit trail:', error);
    }
    
    // Reset metrics
    metrics = {
      totalCommands: 0,
      successfulCommands: 0,
      failedCommands: 0,
      avgProcessingTime: 0,
      commandsByCategory: {},
      errorRates: {},
      lastUpdate: Date.now()
    };
    
    isInitialized = false;
    const shutdownDuration = performance.now() - shutdownStartTime;
    
    // Log successful shutdown
    addAuditEntry('voice:commandProcessor:shutdown', {
      duration: shutdownDuration,
      results
    });
    
    console.log(`Voice command processor shut down successfully in ${shutdownDuration.toFixed(2)}ms`);
    
    return { 
      success: true, 
      status: 'shutdown_complete',
      duration: shutdownDuration,
      results
    };
  } catch (error) {
    console.error('Error during voice command processor shutdown:', error);
    
    // Log shutdown failure
    addAuditEntry('voice:commandProcessor:shutdownFailed', {
      error: error.message,
      stack: error.stack
    });
    
    // Force shutdown if requested, despite errors
    if (shutdownOptions.force) {
      isInitialized = false;
      
      return {
        success: false,
        forced: true,
        status: 'forced_shutdown',
        error: error.message,
        results
      };
    }
    
    return {
      success: false,
      status: 'shutdown_failed',
      error: error.message,
      results
    };
  }
}

// Duplicate declaration removed

// Metrics updated with complete properties
metrics = {
  totalCommands: 0,
  successfulCommands: 0,
  failedCommands: 0,
  avgProcessingTime: 0,
  commandsByCategory: {},
  errorRates: {},
  totalProcessingTime: 0,
  lastResetTimestamp: Date.now(),
  lastUpdate: Date.now()
};

/**
 * Process a voice command with enhanced production features
 * @param {string} command - The command text to process
 * @param {Object} [options] - Processing options
 * @param {string} [options.context] - Command context (default: current context)
 * @param {boolean} [options.bypassSecurity=false] - Whether to bypass security checks
 * @param {boolean} [options.bypassThrottling=false] - Whether to bypass throttling (for critical commands)
 * @param {number} [options.retryAttempt=0] - Current retry attempt (for internal use)
 * @param {boolean} [options.collectMetrics=true] - Whether to collect performance metrics
 * @returns {Promise<Object>} Processing result
 */
export async function processCommand(command, options = {}) {
  // Start timing for performance metrics
  const startTime = performance.now();
  
  // Basic validation
  if (!isInitialized) {
    throw new Error('Voice command processor not initialized');
  }
  
  if (!command || typeof command !== 'string') {
    throw new Error('Invalid command: must be a non-empty string');
  }
  
  // Set processing options with defaults
  const processingOptions = {
    context: currentContext,
    bypassSecurity: false,
    bypassThrottling: false,
    retryAttempt: 0,
    collectMetrics: true,
    ...options
  };
  
  // Extract options for cleaner code
  const { 
    context, 
    bypassSecurity, 
    bypassThrottling,
    retryAttempt,
    collectMetrics
  } = processingOptions;
  
  try {
    // Add to history for context and learning
    addToCommandHistory(command, context);
    
    // Track command in metrics
    if (collectMetrics) {
      metrics.totalCommands++;
    }
    
    // Check command throttling to prevent resource exhaustion
    if (commandThrottling.enabled && !bypassThrottling) {
      const now = Date.now();
      // Clean up old timestamps (older than 60 seconds)
      commandThrottling.commandTimestamps = commandThrottling.commandTimestamps.filter(
        timestamp => now - timestamp < 60000
      );
      
      // Check if we've exceeded the rate limit
      if (commandThrottling.commandTimestamps.length >= commandThrottling.maxCommandsPerMinute) {
        // Find matching command to see if it's critical
        const tempMatch = findMatchingCommandPattern(command, context);
        const isCritical = tempMatch?.pattern?.importance === 'critical';
        
        // Allow critical commands to bypass throttling if configured
        if (!(commandThrottling.criticalCommandsExempt && isCritical)) {
          // Log throttling for audit
          addAuditEntry('voice:command:throttled', { 
            command: command.substring(0, 20) + (command.length > 20 ? '...' : ''), 
            context 
          });
          
          // Make accessibility announcement for throttling
          if (accessibilityMode) {
            accessibilityAnnounce({
              message: 'Command rate limit reached. Please wait before trying again.',
              priority: 'medium'
            });
          }
          
          if (collectMetrics) updateMetrics(false, startTime);
          
          return {
            success: false,
            handled: true,
            message: 'Command rate limit exceeded. Please wait before trying again.',
            throttled: true,
            retryAfter: Math.ceil((60000 - (now - commandThrottling.commandTimestamps[0])) / 1000)
          };
        }
      }
      
      // Add current timestamp to throttling record
      commandThrottling.commandTimestamps.push(now);
    }
    
    // Security check
    if (!bypassSecurity) {
      try {
        const securityCheck = await checkCommandSecurity(command);
        if (!securityCheck.allowed) {
          // Log security block in audit trail
          addAuditEntry('voice:command:blocked', { 
            reason: securityCheck.reason,
            command: command.substring(0, 20) + (command.length > 20 ? '...' : ''), 
            context 
          });
          
          // Announce security block for accessibility
          if (accessibilityMode) {
            accessibilityAnnounce({
              message: 'Command blocked for security reasons.',
              priority: 'high'
            });
          }
          
          if (collectMetrics) updateMetrics(false, startTime);
          console.warn(`Command blocked by security policy: ${securityCheck.reason}`);
          
          EventBus.publish('security:commandBlocked', {
            reason: securityCheck.reason,
            context
          });
          
          return {
            success: false,
            handled: true,
            message: 'Command blocked by security policy',
            reason: securityCheck.reason
          };
        }
      } catch (securityError) {
        console.error('Security check failed:', securityError);
        // If security service is temporarily down, fail closed (secure default)
        if (collectMetrics) updateMetrics(false, startTime);
        
        return {
          success: false,
          handled: true,
          message: 'Unable to verify command security, please try again later',
          error: 'Security service unavailable'
        };
      }
    }
    
    // Try to match command pattern
    const match = findMatchingCommandPattern(command, context);
    
    if (!match) {
      // Log unrecognized commands for pattern learning
      EventBus.publish('voice:unrecognizedCommand', { command, context });
      // Sanitize command for logging to prevent sensitive data exposure
      const sanitizedCommand = command.substring(0, 15) + (command.length > 15 ? '...' : '');
      console.log(`No matching pattern found for command: ${sanitizedCommand}`);
      if (collectMetrics) updateMetrics(false, startTime);
      return {
        success: false,
        handled: false,
        message: 'Command not recognized'
      };
    }
    
    // Handle confirmation if required
    if (match.pattern.requiresConfirmation && !options.confirmed) {
      if (collectMetrics) updateMetrics(true, startTime); // This is a successful flow, just requires confirmation
      return {
        success: false,
        handled: true,
        requiresConfirmation: true,
        message: `Confirmation required for: ${command}`,
        pattern: match.pattern,
        params: match.params,
        command
      };
    }
    
    // Execute the matched command with retry logic for transient errors
    try {
      const handler = commandHandlers[match.pattern.handler];
      if (!handler) {
        throw new Error(`Handler not found: ${match.pattern.handler}`);
      }
      
      // Mark critical commands to bypass throttling on retry
      const isCritical = match.pattern.importance === 'critical';
      
      const result = await handler(match.params, {
        command,
        context,
        pattern: match.pattern
      });
      
      // Announce result for accessibility if appropriate
      if (result.announce) {
        EventBus.publish('accessibility:announce', {
          message: result.message || 'Command executed',
          priority: isCritical ? 'high' : 'medium'
        });
      }
      
      // Publish successful command execution event
      EventBus.publish('voice:commandExecuted', {
        command: sanitizedCommand,
        context,
        handler: match.pattern.handler
      });
      
      if (collectMetrics) updateMetrics(true, startTime);
      
      return {
        success: true,
        handled: true,
        message: result.message || 'Command executed',
        executionTime: performance.now() - startTime,
        ...result
      };
    } catch (error) {
      console.error(`Error executing command handler (attempt ${retryAttempt + 1}/${maxRetries + 1}):`, error);
      
      // Retry logic for transient errors
      if (retryAttempt < maxRetries && isTransientError(error)) {
        console.log(`Retrying command (attempt ${retryAttempt + 1}/${maxRetries})...`);
        
        // Exponential backoff
        const backoffMs = Math.min(100 * Math.pow(2, retryAttempt), 2000);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        
        // Retry with incremented attempt counter and bypass throttling if critical
        return processCommand(command, {
          ...options,
          retryAttempt: retryAttempt + 1,
          bypassThrottling: isCritical && commandThrottling.criticalCommandsExempt
        });
      }
      
      // Publish command failure event
      EventBus.publish('voice:commandFailed', {
        command: sanitizedCommand,
        error: error.message,
        context
      });
      
      if (collectMetrics) updateMetrics(false, startTime);
      
      return {
        success: false,
        handled: true,
        error: error.message,
        message: 'Error executing command',
        executionTime: performance.now() - startTime
      };
    }
  } catch (unexpectedError) {
    // Catch-all for unexpected errors
    console.error('Unexpected error in command processing:', unexpectedError);
    if (collectMetrics) updateMetrics(false, startTime);
    
    // Report fatal errors to monitoring system
    EventBus.publish('monitoring:error', {
      component: 'VoiceCommandProcessor',
      error: unexpectedError,
      severity: 'high'
    });
    
    return {
      success: false,
      handled: false,
      error: 'Unexpected error occurred',
      message: 'Unable to process command due to system error',
      executionTime: performance.now() - startTime
    };
  }
}

/**
 * Determine if an error is likely transient and should be retried
 * @private
 * @param {Error} error - The error to check
 * @returns {boolean} True if the error is likely transient
 */
function isTransientError(error) {
  // Network errors, timeouts, and temporary service unavailability are candidates for retry
  const transientErrorPatterns = [
    /timeout/i,
    /network/i,
    /connection/i,
    /temporarily unavailable/i,
    /service unavailable/i,
    /try again/i,
    /too many requests/i,
    /429/,
    /503/,
    /504/
  ];
  
  return transientErrorPatterns.some(pattern => 
    pattern.test(error.message) || 
    (error.code && pattern.test(error.code))
  );
}

/**
 * Update performance metrics
 * @private
 * @param {boolean} success - Whether the command was successful
 * @param {number} startTime - Processing start time (from performance.now())
 */
function updateMetrics(success, startTime) {
  const processingTime = performance.now() - startTime;
  
  metrics.commandsProcessed++;
  if (success) {
    metrics.commandsSucceeded++;
  } else {
    metrics.commandsFailed++;
  }
  
  // Update average processing time with exponential moving average
  const alpha = 0.05; // Smoothing factor
  metrics.averageProcessingTime = alpha * processingTime + 
    (1 - alpha) * (metrics.averageProcessingTime || processingTime);
  
  metrics.totalProcessingTime += processingTime;
  
  // Periodically publish metrics
  const now = Date.now();
  if (now - metrics.lastMetricsReport > 60000) { // Once per minute
    EventBus.publish('monitoring:metrics', {
      component: 'VoiceCommandProcessor',
      metrics: getMetrics()
    });
    metrics.lastMetricsReport = now;
  }
}

/**
 * Register a new command pattern
 * @param {string} pattern - Command pattern with wildcards (*)
 * @param {Object} config - Pattern configuration
 */
export function registerCommandPattern(pattern, config) {
  if (!pattern || typeof pattern !== 'string') {
    throw new Error('Invalid pattern: must be a non-empty string');
  }
  
  if (!config || typeof config !== 'object') {
    throw new Error('Invalid config: must be an object');
  }
  
  if (!config.handler || typeof config.handler !== 'string') {
    throw new Error('Invalid handler: must be a non-empty string');
  }
  
  commandPatterns[pattern] = {
    ...config,
    // Set defaults if not provided
    category: config.category || COMMAND_CATEGORIES.INTERACTION,
    importance: config.importance || 'medium',
    requiresConfirmation: config.requiresConfirmation || false
  };
}

/**
 * Register a command handler function
 * @param {string} name - Handler name
 * @param {Function} handler - Handler function
 */
export function registerCommandHandler(name, handler) {
  if (!name || typeof name !== 'string') {
    throw new Error('Invalid handler name: must be a non-empty string');
  }
  
  if (!handler || typeof handler !== 'function') {
    throw new Error('Invalid handler: must be a function');
  }
  
  commandHandlers[name] = handler;
}

/**
 * Set the current command context
 * @param {string} context - New context
 */
export function setCommandContext(context) {
  if (!context || typeof context !== 'string') {
    throw new Error('Invalid context: must be a non-empty string');
  }
  
  currentContext = context;
  console.log(`Voice command context set to: ${context}`);
}

/**
 * Get the current command context
 * @returns {string} Current context
 */
export function getCommandContext() {
  return currentContext;
}

/**
 * Get command history
 * @param {number} [limit=10] - Maximum number of history items to return
 * @returns {Array} Command history
 */
export function getCommandHistory(limit = 10) {
  return commandHistory.slice(0, limit);
}

/**
 * Clear command history
 */
export function clearCommandHistory() {
  commandHistory.length = 0;
}

// --- Private helper functions ---

/**
 * Register default command handlers
 * @private
 */
function registerDefaultCommandHandlers() {
  // Navigation handlers
  commandHandlers.navigateTo = async (params) => {
    const target = params[0];
    console.log(`Navigate to: ${target}`);
    EventBus.publish('navigation:request', { target });
    return { success: true, message: `Navigating to ${target}`, announce: true };
  };
  
  commandHandlers.openResource = async (params) => {
    const resource = params[0];
    console.log(`Open resource: ${resource}`);
    EventBus.publish('resource:open', { resource });
    return { success: true, message: `Opening ${resource}`, announce: true };
  };
  
  commandHandlers.navigateBack = async () => {
    console.log('Navigate back');
    EventBus.publish('navigation:back');
    return { success: true, message: 'Going back', announce: true };
  };
  
  commandHandlers.navigateForward = async () => {
    console.log('Navigate forward');
    EventBus.publish('navigation:forward');
    return { success: true, message: 'Going forward', announce: true };
  };
  
  // Accessibility handlers
  commandHandlers.toggleAccessibilityFeature = async (params) => {
    const feature = params[0].replace(' mode', '');
    console.log(`Toggle accessibility feature: ${feature}`);
    const enable = !params.command.toLowerCase().startsWith('disable');
    
    EventBus.publish('accessibility:feature:toggle', {
      feature,
      enabled: enable
    });
    
    return { 
      success: true, 
      message: `${enable ? 'Enabled' : 'Disabled'} ${feature} mode`,
      announce: true 
    };
  };
  
  commandHandlers.adjustAccessibilitySetting = async (params, context) => {
    const action = context.command.toLowerCase().startsWith('increase') ? 'increase' : 'decrease';
    const setting = params[0];
    console.log(`Adjust accessibility setting: ${action} ${setting}`);
    
    EventBus.publish('accessibility:setting:adjust', {
      setting,
      action
    });
    
    return { 
      success: true, 
      message: `${action}d ${setting}`,
      announce: true 
    };
  };
  
  // System handlers
  commandHandlers.restartSystem = async () => {
    console.log('Restart system');
    EventBus.publish('system:restart:request');
    return { success: true, message: 'Restarting system', announce: true };
  };
  
  commandHandlers.shutdownSystem = async () => {
    console.log('Shutdown system');
    EventBus.publish('system:shutdown:request');
    return { success: true, message: 'Shutting down system', announce: true };
  };
  
  // Control handlers
  commandHandlers.pauseCurrentActivity = async () => {
    console.log('Pause current activity');
    EventBus.publish('activity:pause');
    return { success: true, message: 'Paused', announce: true };
  };
  
  commandHandlers.resumeCurrentActivity = async () => {
    console.log('Resume current activity');
    EventBus.publish('activity:resume');
    return { success: true, message: 'Resumed', announce: true };
  };
  
  commandHandlers.stopCurrentActivity = async () => {
    console.log('Stop current activity');
    EventBus.publish('activity:stop');
    return { success: true, message: 'Stopped', announce: true };
  };
  
  // Query handlers
  commandHandlers.handleInformationQuery = async (params) => {
    const query = params[0];
    console.log(`Information query: ${query}`);
    EventBus.publish('query:information', { query });
    return { success: true, message: `Looking up information about ${query}`, announce: true };
  };
  
  commandHandlers.handleHowToQuery = async (params) => {
    const query = params[0];
    console.log(`How-to query: ${query}`);
    EventBus.publish('query:howto', { query });
    return { success: true, message: `Finding instructions for ${query}`, announce: true };
  };
  
  commandHandlers.handleSearchQuery = async (params) => {
    const query = params[0];
    console.log(`Search query: ${query}`);
    EventBus.publish('query:search', { query });
    return { success: true, message: `Searching for ${query}`, announce: true };
  };
}

/**
 * Handle voice recognition results
 * @private
 * @param {Object} data - Recognition result data
 */
function handleVoiceRecognitionResult(data) {
  if (!data || !data.transcript) return;
  
  // Process the recognized command
  processCommand(data.transcript)
    .then(result => {
      if (result.success) {
        console.log(`Voice command processed: ${data.transcript}`);
        
        // Provide feedback
        if (result.message) {
          EventBus.publish('voice:feedback', {
            type: 'success',
            message: result.message
          });
        }
      } else if (result.requiresConfirmation) {
        // Request confirmation
        EventBus.publish('voice:confirmation:request', {
          command: data.transcript,
          message: result.message
        });
      } else if (!result.handled) {
        console.log(`Unrecognized voice command: ${data.transcript}`);
        
        // Provide feedback for unrecognized command
        EventBus.publish('voice:feedback', {
          type: 'error',
          message: 'Command not recognized'
        });
      }
    })
    .catch(error => {
      console.error('Error processing voice command:', error);
      
      // Provide feedback for error
      EventBus.publish('voice:feedback', {
        type: 'error',
        message: 'Error processing command'
      });
    });
}

/**
 * Find a matching command pattern for a given command
 * @private
 * @param {string} command - Command to match
 * @param {string} context - Current context
 * @returns {Object|null} Matching pattern and params if found
 */
function findMatchingCommandPattern(command, context) {
  if (!command) return null;
  
  const normalizedCommand = command.toLowerCase().trim();
  
  for (const [pattern, config] of Object.entries(commandPatterns)) {
    // Skip patterns not applicable to current context
    if (config.contexts && !config.contexts.includes(context)) {
      continue;
    }
    
    const result = matchCommandPattern(normalizedCommand, pattern);
    if (result.match) {
      return {
        pattern: config,
        params: result.params
      };
    }
  }
  
  return null;
}

/**
 * Match a command against a pattern with wildcards
 * @private
 * @param {string} command - Command to match
 * @param {string} pattern - Pattern with wildcards
 * @returns {Object} Match result
 */
function matchCommandPattern(command, pattern) {
  // Convert pattern to regex
  const regexPattern = pattern
    .replace(/\*/g, '(.+)')
    .replace(/\s+/g, '\\s+');
  
  const regex = new RegExp(`^${regexPattern}$`, 'i');
  const match = command.match(regex);
  
  if (!match) {
    return { match: false, params: [] };
  }
  
  // Extract parameters (captured groups)
  const params = match.slice(1);
  
  return {
    match: true,
    params
  };
}

/**
 * Add command to history
 * @private
 * @param {string} command - Command text
 * @param {string} context - Command context
 */
function addToCommandHistory(command, context) {
  // Add to beginning of history
  commandHistory.unshift({
    command,
    context,
    timestamp: Date.now()
  });
  
  // Limit history length
  if (commandHistory.length > MAX_HISTORY_LENGTH) {
    commandHistory.pop();
  }
}

/**
 * Check if a command passes security checks
 * @private
 * @param {string} command - Command to check
 * @returns {Promise<Object>} Security check result
 */
async function checkCommandSecurity(command) {
  // If security manager is available, use it
  if (SecurityManager && typeof SecurityManager.validateCommand === 'function') {
    return SecurityManager.validateCommand(command);
  }
  
  // Basic security check (allow all if security manager not available)
  return {
    allowed: true
  };
}

// Export module API
export {
  initialize,
  shutdown,
  processCommand,
  registerCommandPattern,
  registerCommandHandler,
  setCommandContext,
  getCommandContext,
  getCommandHistory,
  clearCommandHistory,
  // Added exports for the comprehensive command processor
  analyzeCommand
};

// Default export for backward compatibility
export default {
  initialize,
  shutdown,
  processCommand,
  registerCommandPattern,
  registerCommandHandler,
  setCommandContext,
  getCommandContext,
  getCommandHistory,
  clearCommandHistory,
  analyzeCommand
};
