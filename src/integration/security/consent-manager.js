/**
 * consent-manager.js
 * Handles user consent for various features (e.g., voice-recording, face-capture).
 */
import { publish } from '../../core/events.js';

const STORAGE_KEY = 'alejo-consents';
let consents = {};

/**
 * Initialize consent manager by loading stored consents.
 */
export function initialize() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    consents = stored ? JSON.parse(stored) : {};
    publish('security:consent-manager:initialized', { consents });
    return true;
  } catch (error) {
    console.error('ConsentManager init failed:', error);
    return false;
  }
}

/**
 * Check if consent is granted for a given feature.
 * @param {string} feature
 * @returns {boolean}
 */
export function checkConsent(feature) {
  return !!consents[feature];
}

/**
 * Request consent for a given feature.
 * Publishes an event the UI can listen to.
 * @param {string} feature
 */
export function requestConsent(feature) {
  publish('security:consent-requested', { feature });
}

/**
 * Set consent decision for a feature.
 * @param {string} feature
 * @param {boolean} granted
 */
export function setConsent(feature, granted) {
  consents[feature] = !!granted;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(consents));
  } catch {}
  publish('security:consent-changed', { feature, granted });
}

/**
 * Retrieve all consents.
 */
export function getConsents() {
  return { ...consents };
}
