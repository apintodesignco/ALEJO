/**
 * ALEJO Personalization Integration Example
 * 
 * This example demonstrates how to integrate and use the ALEJO personalization module
 * with all its components: behavior, emotional, voice, and vision.
 * 
 * The example shows:
 * 1. Initialization with proper security checks
 * 2. Processing user messages
 * 3. Adapting responses
 * 4. Managing personalization profiles
 * 5. Handling events
 * 6. Proper shutdown
 */

import * as personalization from '../src/personalization/index.js';
import { consentManager } from '../src/security/consent-manager.js';
import { auditTrail } from '../src/security/audit-trail.js';
import { rbac } from '../src/security/rbac.js';
import { eventBus } from '../src/core/event-bus.js';

// Example user IDs
const ADMIN_USER_ID = 'admin-user-123';
const REGULAR_USER_ID = 'regular-user-456';
const GUEST_USER_ID = 'guest-user-789';

// Example messages for demonstration
const EXAMPLE_MESSAGES = [
  "Hello, how are you today?",
  "I'm looking for information about the latest technology trends.",
  "Could you please explain this in simpler terms?",
  "I'm feeling a bit frustrated with this process.",
  "That's amazing news! I'm really excited about it."
];

// Example responses for demonstration
const EXAMPLE_RESPONSES = [
  "Hello! I'm doing well. How can I assist you today?",
  "Here's information about the latest technology trends: AI advancements, quantum computing, and edge computing are leading the way.",
  "Sure, I'll explain it more simply: The system takes your preferences and adjusts how it responds to you.",
  "I understand your frustration. Let's try a different approach to make this easier.",
  "I'm glad you're excited! It's definitely great news worth celebrating."
];

/**
 * Setup security and permissions for demonstration
 */
async function setupSecurity() {
  console.log('Setting up security for demonstration...');
  
  // Setup consent for different users
  consentManager.setConsentStatus(ADMIN_USER_ID, 'personalization', true);
  consentManager.setConsentStatus(ADMIN_USER_ID, 'behaviorAnalysis', true);
  consentManager.setConsentStatus(ADMIN_USER_ID, 'preferenceTracking', true);
  
  consentManager.setConsentStatus(REGULAR_USER_ID, 'personalization', true);
  consentManager.setConsentStatus(REGULAR_USER_ID, 'behaviorAnalysis', true);
  consentManager.setConsentStatus(REGULAR_USER_ID, 'preferenceTracking', false);
  
  consentManager.setConsentStatus(GUEST_USER_ID, 'personalization', false);
  
  // Setup RBAC permissions
  rbac.assignRole(ADMIN_USER_ID, 'admin');
  rbac.assignRole(REGULAR_USER_ID, 'user');
  rbac.assignRole(GUEST_USER_ID, 'guest');
  
  console.log('Security setup complete.');
}

/**
 * Setup event listeners for personalization events
 */
function setupEventListeners() {
  console.log('Setting up event listeners...');
  
  // Listen for personalization initialization events
  eventBus.on('personalization:initialized', (data) => {
    console.log(`Personalization initialized in ${data.duration}ms with results:`, data.results);
  });
  
  // Listen for behavior pattern updates
  eventBus.on('behavior:patterns_updated', (data) => {
    console.log(`Behavior patterns updated for user ${data.userId}`);
  });
  
  // Listen for preference detection
  eventBus.on('preferences:detected', (data) => {
    console.log(`New preferences detected for user ${data.userId}:`, data.preferences);
  });
  
  // Listen for emotional state updates
  eventBus.on('emotional:state_updated', (data) => {
    console.log(`Emotional state updated for user ${data.userId}:`, data.state);
  });
  
  console.log('Event listeners setup complete.');
}

/**
 * Initialize the personalization module
 */
async function initializePersonalization() {
  console.log('Initializing personalization module...');
  
  try {
    const initResult = await personalization.initialize({
      enableVoice: true,
      enableVision: false, // Disable vision for this example
      behaviorOptions: {
        learningRate: 0.2,
        temporalWeighting: true
      },
      emotionalOptions: {
        empathyLevel: 'high',
        moodTracking: true
      }
    });
    
    console.log('Initialization result:', initResult);
    return initResult.success;
  } catch (error) {
    console.error('Initialization failed:', error);
    return false;
  }
}

/**
 * Demonstrate processing user messages
 */
async function demonstrateMessageProcessing() {
  console.log('\n--- Demonstrating Message Processing ---');
  
  // Process messages for admin user (full consent)
  console.log(`\nProcessing messages for admin user (${ADMIN_USER_ID}):`);
  for (const message of EXAMPLE_MESSAGES.slice(0, 3)) {
    try {
      const result = await personalization.processUserMessage(ADMIN_USER_ID, message, {
        context: 'example',
        timestamp: Date.now()
      });
      console.log(`Message: "${message}"`);
      console.log('Processing result:', result);
    } catch (error) {
      console.error(`Error processing message: ${error.message}`);
    }
  }
  
  // Process messages for regular user (partial consent)
  console.log(`\nProcessing messages for regular user (${REGULAR_USER_ID}):`);
  for (const message of EXAMPLE_MESSAGES.slice(3, 5)) {
    try {
      const result = await personalization.processUserMessage(REGULAR_USER_ID, message, {
        context: 'example',
        timestamp: Date.now()
      });
      console.log(`Message: "${message}"`);
      console.log('Processing result:', result);
    } catch (error) {
      console.error(`Error processing message: ${error.message}`);
    }
  }
  
  // Process message for guest user (no consent)
  console.log(`\nProcessing message for guest user (${GUEST_USER_ID}):`);
  try {
    const result = await personalization.processUserMessage(GUEST_USER_ID, EXAMPLE_MESSAGES[0], {
      context: 'example',
      timestamp: Date.now()
    });
    console.log(`Message: "${EXAMPLE_MESSAGES[0]}"`);
    console.log('Processing result:', result);
  } catch (error) {
    console.error(`Error processing message: ${error.message}`);
  }
}

/**
 * Demonstrate response adaptation
 */
async function demonstrateResponseAdaptation() {
  console.log('\n--- Demonstrating Response Adaptation ---');
  
  // Adapt responses for admin user (full consent)
  console.log(`\nAdapting responses for admin user (${ADMIN_USER_ID}):`);
  for (const response of EXAMPLE_RESPONSES.slice(0, 3)) {
    try {
      const adaptedResponse = await personalization.adaptResponse(ADMIN_USER_ID, response, {
        context: 'example',
        timestamp: Date.now()
      });
      console.log(`Original: "${response}"`);
      console.log(`Adapted:  "${adaptedResponse}"`);
    } catch (error) {
      console.error(`Error adapting response: ${error.message}`);
    }
  }
  
  // Adapt responses for regular user (partial consent)
  console.log(`\nAdapting responses for regular user (${REGULAR_USER_ID}):`);
  for (const response of EXAMPLE_RESPONSES.slice(3, 5)) {
    try {
      const adaptedResponse = await personalization.adaptResponse(REGULAR_USER_ID, response, {
        context: 'example',
        timestamp: Date.now()
      });
      console.log(`Original: "${response}"`);
      console.log(`Adapted:  "${adaptedResponse}"`);
    } catch (error) {
      console.error(`Error adapting response: ${error.message}`);
    }
  }
  
  // Adapt response for guest user (no consent)
  console.log(`\nAdapting response for guest user (${GUEST_USER_ID}):`);
  try {
    const adaptedResponse = await personalization.adaptResponse(GUEST_USER_ID, EXAMPLE_RESPONSES[0], {
      context: 'example',
      timestamp: Date.now()
    });
    console.log(`Original: "${EXAMPLE_RESPONSES[0]}"`);
    console.log(`Adapted:  "${adaptedResponse}"`);
    console.log('Note: No adaptation occurred due to missing consent');
  } catch (error) {
    console.error(`Error adapting response: ${error.message}`);
  }
}

/**
 * Demonstrate personalization profile management
 */
async function demonstrateProfileManagement() {
  console.log('\n--- Demonstrating Profile Management ---');
  
  // Get profile for admin user
  console.log(`\nGetting profile for admin user (${ADMIN_USER_ID}):`);
  try {
    const profile = await personalization.getPersonalizationProfile(ADMIN_USER_ID, {
      includeVoice: true,
      includeVision: false
    });
    console.log('Profile:', JSON.stringify(profile, null, 2));
  } catch (error) {
    console.error(`Error getting profile: ${error.message}`);
  }
  
  // Get profile for regular user
  console.log(`\nGetting profile for regular user (${REGULAR_USER_ID}):`);
  try {
    const profile = await personalization.getPersonalizationProfile(REGULAR_USER_ID);
    console.log('Profile:', JSON.stringify(profile, null, 2));
  } catch (error) {
    console.error(`Error getting profile: ${error.message}`);
  }
  
  // Get profile for guest user (should fail due to permissions)
  console.log(`\nGetting profile for guest user (${GUEST_USER_ID}):`);
  try {
    const profile = await personalization.getPersonalizationProfile(GUEST_USER_ID);
    console.log('Profile:', JSON.stringify(profile, null, 2));
  } catch (error) {
    console.error(`Error getting profile: ${error.message}`);
  }
  
  // Demonstrate setting a preference explicitly
  console.log('\nSetting preference explicitly:');
  try {
    const result = await personalization.behavior.setPreference(
      ADMIN_USER_ID,
      'interface:theme',
      'dark',
      'INTERFACE'
    );
    console.log('Preference set result:', result);
  } catch (error) {
    console.error(`Error setting preference: ${error.message}`);
  }
}

/**
 * Demonstrate resetting personalization data
 */
async function demonstrateDataReset() {
  console.log('\n--- Demonstrating Data Reset ---');
  
  // Reset data for admin user
  console.log(`\nResetting data for admin user (${ADMIN_USER_ID}):`);
  try {
    const result = await personalization.resetPersonalizationData(ADMIN_USER_ID, {
      excludeVoice: true // Don't reset voice data
    });
    console.log('Reset result:', result);
  } catch (error) {
    console.error(`Error resetting data: ${error.message}`);
  }
  
  // Try to reset data for guest user (should fail due to permissions)
  console.log(`\nAttempting to reset data for guest user (${GUEST_USER_ID}):`);
  try {
    const result = await personalization.resetPersonalizationData(GUEST_USER_ID);
    console.log('Reset result:', result);
  } catch (error) {
    console.error(`Error resetting data: ${error.message}`);
  }
}

/**
 * Shutdown the personalization module
 */
async function shutdownPersonalization() {
  console.log('\n--- Shutting Down Personalization Module ---');
  
  try {
    const result = await personalization.shutdown();
    console.log('Shutdown result:', result);
    return result;
  } catch (error) {
    console.error('Shutdown failed:', error);
    return false;
  }
}

/**
 * Main function to run the example
 */
async function runExample() {
  console.log('=== ALEJO Personalization Integration Example ===\n');
  
  // Setup security and events
  await setupSecurity();
  setupEventListeners();
  
  // Initialize personalization
  const initSuccess = await initializePersonalization();
  if (!initSuccess) {
    console.error('Failed to initialize personalization. Exiting example.');
    return;
  }
  
  // Run demonstrations
  await demonstrateMessageProcessing();
  await demonstrateResponseAdaptation();
  await demonstrateProfileManagement();
  await demonstrateDataReset();
  
  // Shutdown
  await shutdownPersonalization();
  
  console.log('\n=== Example Complete ===');
}

// Run the example
runExample().catch(error => {
  console.error('Example failed with error:', error);
});
