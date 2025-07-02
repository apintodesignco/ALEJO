/**
 * boundary-enforcer.js
 * Prevents harmful or disallowed behavior by monitoring responses and actions.
 */
import { subscribe, publish } from '../../core/events.js';
import * as security from '../../security/index.js';

const DISALLOWED_PATTERNS = [
  /self-harm/i,
  /kill yourself/i,
  /harm yourself/i,
  /hate speech/i
];

let initialized = false;

/**
 * Initialize the boundary enforcer
 * @param {Object} options
 * @returns {Promise<boolean>} success
 */
export async function initialize(options = {}) {
  if (initialized) return true;
  if (security && typeof security.initialize === 'function') {
    await security.initialize();
  }
  // Listen for responses before delivery
  subscribe('response:pre_delivery', handlePreDelivery);
  initialized = true;
  publish('ethics:boundary-enforcer:initialized', {});
  return true;
}

/**
 * Handle a response before it's delivered
 * @param {Object} data - { response, metadata }
 */
function handlePreDelivery(data) {
  const { response, metadata } = data;
  for (const pattern of DISALLOWED_PATTERNS) {
    if (pattern.test(response.content)) {
      // Log violation
      if (security && typeof security.logSecureEvent === 'function') {
        security.logSecureEvent('ethics:boundary-violation', {
          pattern: pattern.toString(),
          response: response.content,
          metadata
        });
      }
      // Notify system and sanitize
      publish('ethics:boundary-violated', { response, metadata });
      response.content = response.content.replace(pattern, '[content removed]');
      publish('response:modified', { response, metadata });
      break;
    }
  }
}
