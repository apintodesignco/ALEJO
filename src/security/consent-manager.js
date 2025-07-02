/**
 * ALEJO Consent Manager
 * 
 * Provides user-controlled permission management for ALEJO personalization features:
 * - Fine-grained consent controls for data collection
 * - Preference persistence and enforcement
 * - GDPR/CCPA-aligned privacy management
 * - Transparent data usage explanations
 */

import { publish, subscribe } from '../core/events.js';
import * as privacyGuard from './privacy-guard.js';
import * as auditTrail from './audit-trail.js';

// Constants
const CONSENT_VERSION = '1.0.0';
const STORAGE_KEY = 'alejo_consent_preferences';
const DEFAULT_EXPIRES_DAYS = 365; // Default consent expiration in days

// Feature consent definitions with privacy impact explanations
const CONSENT_FEATURES = {
  // Core functionality
  'core:analytics': {
    id: 'core:analytics',
    name: 'Usage Analytics',
    description: 'Collect anonymous usage data to improve ALEJO functionality',
    required: false,
    category: 'core',
    privacyImpact: 'low',
    dataRetention: '90 days'
  },
  
  // Personalization features
  'personalization:voice': {
    id: 'personalization:voice',
    name: 'Voice Recognition',
    description: 'Train ALEJO to recognize your voice for authentication and personalization',
    required: false,
    category: 'personalization',
    privacyImpact: 'high',
    dataRetention: 'Until explicitly deleted'
  },
  'personalization:face': {
    id: 'personalization:face',
    name: 'Face Recognition',
    description: 'Train ALEJO to recognize your face for authentication and emotional understanding',
    required: false,
    category: 'personalization',
    privacyImpact: 'high',
    dataRetention: 'Until explicitly deleted'
  },
  'personalization:preferences': {
    id: 'personalization:preferences',
    name: 'Personal Preferences',
    description: 'Remember your preferences and settings',
    required: false,
    category: 'personalization',
    privacyImpact: 'medium',
    dataRetention: 'Until explicitly deleted'
  },
  'personalization:learning': {
    id: 'personalization:learning',
    name: 'Adaptive Learning',
    description: 'Allow ALEJO to learn from interactions to better serve your needs',
    required: false,
    category: 'personalization',
    privacyImpact: 'medium',
    dataRetention: 'Until explicitly deleted'
  },
  
  // Security features
  'security:audit': {
    id: 'security:audit',
    name: 'Security Auditing',
    description: 'Record security-related events for your protection',
    required: true,
    category: 'security',
    privacyImpact: 'low',
    dataRetention: '1 year'
  }
};

// State management
let initialized = false;
let currentUserConsent = {};
let consentChangeListeners = [];
let currentUserId = 'anonymous';

/**
 * Initialize the consent management system
 * @param {Object} options - Initialization options
 * @returns {Promise<boolean>} Success status
 */
export async function initialize(options = {}) {
  console.log('Initializing ALEJO Consent Manager');
  
  if (initialized) {
    console.warn('Consent Manager already initialized');
    return true;
  }
  
  try {
    currentUserId = options.userId || 'anonymous';
    
    // Load previously stored consent settings
    await loadUserConsent();
    
    // Register for relevant events
    subscribe('user:login', handleUserLogin);
    subscribe('user:logout', handleUserLogout);
    
    // Register with privacy guard
    if (privacyGuard && typeof privacyGuard.initialize === 'function') {
      privacyGuard.initialize({ userIdentifier: currentUserId });
    }
    
    // Log initialization
    if (auditTrail && typeof auditTrail.logEvent === 'function') {
      auditTrail.logEvent('consent:initialized', { 
        version: CONSENT_VERSION,
        features: Object.keys(currentUserConsent)
      });
    }
    
    initialized = true;
    publish('consent:initialized', { success: true });
    
    return true;
  } catch (error) {
    console.error('Failed to initialize Consent Manager:', error);
    publish('consent:error', { 
      type: 'initialization_failed', 
      message: error.message
    });
    return false;
  }
}

/**
 * Load previously saved user consent settings
 * @returns {Promise<Object>} User consent settings
 */
async function loadUserConsent() {
  try {
    // Try to get from secure storage first
    if (privacyGuard && typeof privacyGuard.secureRetrieve === 'function') {
      const storedConsent = await privacyGuard.secureRetrieve(`${STORAGE_KEY}_${currentUserId}`);
      if (storedConsent) {
        currentUserConsent = validateStoredConsent(storedConsent);
        return currentUserConsent;
      }
    }
    
    // Fall back to localStorage if secure storage is unavailable
    const storedConsentJSON = localStorage.getItem(`${STORAGE_KEY}_${currentUserId}`);
    if (storedConsentJSON) {
      try {
        const storedConsent = JSON.parse(storedConsentJSON);
        currentUserConsent = validateStoredConsent(storedConsent);
        
        // Migrate to secure storage if available
        if (privacyGuard && typeof privacyGuard.secureStore === 'function') {
          await privacyGuard.secureStore(`${STORAGE_KEY}_${currentUserId}`, currentUserConsent);
          localStorage.removeItem(`${STORAGE_KEY}_${currentUserId}`);
        }
        
        return currentUserConsent;
      } catch (e) {
        console.error('Failed to parse stored consent:', e);
      }
    }
    
    // Create default consent settings if none found
    currentUserConsent = createDefaultConsent();
    return currentUserConsent;
  } catch (error) {
    console.error('Error loading user consent:', error);
    currentUserConsent = createDefaultConsent();
    return currentUserConsent;
  }
}

/**
 * Validate stored consent against current feature definitions
 * @param {Object} storedConsent - Previously stored consent settings
 * @returns {Object} Validated consent settings
 */
function validateStoredConsent(storedConsent) {
  // Start with default consent
  const validatedConsent = createDefaultConsent();
  
  // Merge with stored values
  for (const featureId in validatedConsent) {
    if (storedConsent[featureId] !== undefined) {
      validatedConsent[featureId] = {
        ...validatedConsent[featureId],
        granted: storedConsent[featureId].granted
      };
      
      // Preserve timestamp if valid
      if (storedConsent[featureId].timestamp) {
        validatedConsent[featureId].timestamp = storedConsent[featureId].timestamp;
      }
      
      // Preserve expiration if valid and in the future
      if (storedConsent[featureId].expires && 
          new Date(storedConsent[featureId].expires) > new Date()) {
        validatedConsent[featureId].expires = storedConsent[featureId].expires;
      }
    }
  }
  
  // Force required features to be granted
  Object.keys(validatedConsent).forEach(featureId => {
    if (CONSENT_FEATURES[featureId] && CONSENT_FEATURES[featureId].required) {
      validatedConsent[featureId].granted = true;
    }
  });
  
  return validatedConsent;
}

/**
 * Create default consent settings
 * @returns {Object} Default consent settings
 */
function createDefaultConsent() {
  const defaultConsent = {};
  
  // Create consent settings for each feature
  Object.keys(CONSENT_FEATURES).forEach(featureId => {
    const feature = CONSENT_FEATURES[featureId];
    defaultConsent[featureId] = {
      granted: feature.required,
      timestamp: new Date().toISOString(),
      expires: calculateExpirationDate(DEFAULT_EXPIRES_DAYS),
      version: CONSENT_VERSION
    };
  });
  
  return defaultConsent;
}

/**
 * Calculate a consent expiration date
 * @param {number} days - Days until expiration
 * @returns {string} ISO date string
 */
function calculateExpirationDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

/**
 * Save current user consent settings
 * @returns {Promise<boolean>} Success status
 */
async function saveUserConsent() {
  try {
    // Use secure storage if available
    if (privacyGuard && typeof privacyGuard.secureStore === 'function') {
      await privacyGuard.secureStore(`${STORAGE_KEY}_${currentUserId}`, currentUserConsent);
    } else {
      // Fall back to localStorage
      localStorage.setItem(`${STORAGE_KEY}_${currentUserId}`, JSON.stringify(currentUserConsent));
    }
    
    // Log the update
    if (auditTrail && typeof auditTrail.logEvent === 'function') {
      auditTrail.logEvent('consent:updated', {
        features: Object.keys(currentUserConsent).filter(id => currentUserConsent[id].granted)
      });
    }
    
    return true;
  } catch (error) {
    console.error('Failed to save user consent:', error);
    return false;
  }
}

/**
 * Check if consent is granted for a specific feature
 * @param {string} featureId - Feature identifier
 * @returns {boolean} Whether consent is granted
 */
export function hasConsent(featureId) {
  // If not initialized, assume no consent
  if (!initialized) return false;
  
  // If feature doesn't exist in the consent registry
  if (!currentUserConsent[featureId]) return false;
  
  const consent = currentUserConsent[featureId];
  
  // Check if consent is granted and not expired
  return consent.granted && 
         (!consent.expires || new Date(consent.expires) > new Date());
}

/**
 * Set user consent for a specific feature
 * @param {string} featureId - Feature identifier
 * @param {boolean} granted - Whether consent is granted
 * @param {Object} options - Additional options
 * @returns {Promise<boolean>} Success status
 */
export async function setConsent(featureId, granted, options = {}) {
  if (!initialized) {
    await initialize();
  }
  
  // Validate feature exists
  if (!CONSENT_FEATURES[featureId]) {
    console.error(`Invalid feature ID: ${featureId}`);
    return false;
  }
  
  // Cannot revoke consent for required features
  const feature = CONSENT_FEATURES[featureId];
  if (feature.required && !granted) {
    console.warn(`Cannot revoke consent for required feature: ${featureId}`);
    return false;
  }
  
  // Update consent settings
  const prevState = currentUserConsent[featureId]?.granted;
  
  currentUserConsent[featureId] = {
    granted,
    timestamp: new Date().toISOString(),
    expires: options.expirationDays ? 
      calculateExpirationDate(options.expirationDays) : 
      calculateExpirationDate(DEFAULT_EXPIRES_DAYS),
    version: CONSENT_VERSION
  };
  
  // Save the updated settings
  const saved = await saveUserConsent();
  
  // Notify if state changed
  if (saved && prevState !== granted) {
    publish('consent:changed', {
      feature: featureId,
      granted,
      timestamp: currentUserConsent[featureId].timestamp
    });
    
    // Call registered consent change listeners
    notifyConsentListeners(featureId, granted);
  }
  
  return saved;
}

/**
 * Set multiple consent preferences at once
 * @param {Object} consentMap - Map of feature IDs to consent states
 * @param {Object} options - Additional options
 * @returns {Promise<boolean>} Success status
 */
export async function setBulkConsent(consentMap, options = {}) {
  if (!initialized) {
    await initialize();
  }
  
  let anyChanged = false;
  const changes = [];
  
  // Update each feature's consent
  for (const [featureId, granted] of Object.entries(consentMap)) {
    // Skip invalid features
    if (!CONSENT_FEATURES[featureId]) {
      console.warn(`Skipping invalid feature ID: ${featureId}`);
      continue;
    }
    
    // Skip changes to required features
    const feature = CONSENT_FEATURES[featureId];
    if (feature.required && !granted) {
      console.warn(`Cannot revoke consent for required feature: ${featureId}`);
      continue;
    }
    
    // Track changes
    const prevState = currentUserConsent[featureId]?.granted;
    if (prevState !== granted) {
      anyChanged = true;
      changes.push({ featureId, granted });
    }
    
    // Update the consent
    currentUserConsent[featureId] = {
      granted,
      timestamp: new Date().toISOString(),
      expires: options.expirationDays ? 
        calculateExpirationDate(options.expirationDays) : 
        calculateExpirationDate(DEFAULT_EXPIRES_DAYS),
      version: CONSENT_VERSION
    };
  }
  
  // Save if any changes were made
  if (anyChanged) {
    const saved = await saveUserConsent();
    
    if (saved) {
      // Notify about each changed feature
      changes.forEach(({ featureId, granted }) => {
        publish('consent:changed', {
          feature: featureId,
          granted,
          timestamp: currentUserConsent[featureId].timestamp
        });
        
        // Call registered consent change listeners
        notifyConsentListeners(featureId, granted);
      });
    }
    
    return saved;
  }
  
  return true;
}

/**
 * Get all consent settings
 * @returns {Object} Current consent settings
 */
export function getAllConsent() {
  if (!initialized) {
    console.warn('Consent Manager not initialized');
    return {};
  }
  
  // Return a deep copy to prevent direct modification
  return JSON.parse(JSON.stringify(currentUserConsent));
}

/**
 * Get all feature definitions with consent status
 * @returns {Object} Features with consent status
 */
export function getAllFeatures() {
  if (!initialized) {
    console.warn('Consent Manager not initialized');
    return {};
  }
  
  const result = {};
  
  // Combine feature definitions with consent status
  Object.keys(CONSENT_FEATURES).forEach(featureId => {
    result[featureId] = {
      ...CONSENT_FEATURES[featureId],
      consentStatus: currentUserConsent[featureId] || {
        granted: CONSENT_FEATURES[featureId].required,
        version: CONSENT_VERSION
      }
    };
  });
  
  return result;
}

/**
 * Get features grouped by category
 * @returns {Object} Features grouped by category
 */
export function getFeaturesByCategory() {
  if (!initialized) {
    console.warn('Consent Manager not initialized');
    return {};
  }
  
  const categories = {};
  
  // Group features by their categories
  Object.keys(CONSENT_FEATURES).forEach(featureId => {
    const feature = CONSENT_FEATURES[featureId];
    const category = feature.category || 'other';
    
    if (!categories[category]) {
      categories[category] = [];
    }
    
    categories[category].push({
      ...feature,
      consentStatus: currentUserConsent[featureId] || {
        granted: feature.required,
        version: CONSENT_VERSION
      }
    });
  });
  
  return categories;
}

/**
 * Register a listener for consent changes
 * @param {Function} callback - Callback function
 * @returns {string} Listener ID for unregistering
 */
export function onConsentChanged(callback) {
  if (typeof callback !== 'function') {
    throw new Error('Callback must be a function');
  }
  
  const id = `consent_listener_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  consentChangeListeners.push({ id, callback });
  
  return id;
}

/**
 * Unregister a consent change listener
 * @param {string} id - Listener ID from onConsentChanged
 * @returns {boolean} Whether listener was removed
 */
export function offConsentChanged(id) {
  const initialLength = consentChangeListeners.length;
  consentChangeListeners = consentChangeListeners.filter(listener => listener.id !== id);
  
  return consentChangeListeners.length < initialLength;
}

/**
 * Notify all consent change listeners
 * @param {string} featureId - Feature that changed
 * @param {boolean} granted - New consent status
 */
function notifyConsentListeners(featureId, granted) {
  consentChangeListeners.forEach(({ callback }) => {
    try {
      callback(featureId, granted);
    } catch (error) {
      console.error('Error in consent change listener:', error);
    }
  });
}

/**
 * Get a specific feature's definition
 * @param {string} featureId - Feature identifier
 * @returns {Object|null} Feature definition
 */
export function getFeature(featureId) {
  return CONSENT_FEATURES[featureId] || null;
}

/**
 * Export all user consent data (for data portability)
 * @returns {Object} Exportable consent data
 */
export function exportConsent() {
  return {
    userId: currentUserId,
    timestamp: new Date().toISOString(),
    version: CONSENT_VERSION,
    consent: getAllConsent(),
    features: Object.values(CONSENT_FEATURES).map(feature => ({
      id: feature.id,
      name: feature.name,
      description: feature.description,
      category: feature.category,
      required: feature.required,
      privacyImpact: feature.privacyImpact,
      dataRetention: feature.dataRetention
    }))
  };
}

/**
 * Reset all consent to default settings
 * @returns {Promise<boolean>} Success status
 */
export async function resetAllConsent() {
  currentUserConsent = createDefaultConsent();
  const success = await saveUserConsent();
  
  if (success) {
    publish('consent:reset', { timestamp: new Date().toISOString() });
  }
  
  return success;
}

/**
 * Handle user login event
 * @param {Object} data - Event data
 */
async function handleUserLogin(data) {
  if (data?.userId) {
    currentUserId = data.userId;
    await loadUserConsent();
  }
}

/**
 * Handle user logout event
 */
async function handleUserLogout() {
  currentUserId = 'anonymous';
  await loadUserConsent();
}
