/**
 * mood-detector.js
 * 
 * Detects and analyzes user's emotional state from various inputs including:
 * - Text content analysis
 * - Conversation context
 * - User interaction patterns
 * - Expression data from vision system (when available)
 * - Voice tone analysis (when available)
 * 
 * Works alongside empathy-core.js to provide comprehensive emotional intelligence.
 */
import { subscribe, publish } from '../../core/events.js';
import * as privacyGuard from '../../security/privacy-guard.js';
import * as auditTrail from '../../security/audit-trail.js';
import { getStyleMetrics } from '../behavior/pattern-learner.js';

// Storage keys
const STORAGE_KEY_PREFIX = 'mood:';
const MOOD_PROFILE_KEY = 'profile';
const MOOD_HISTORY_KEY = 'history';

// Mood dimensions based on the circumplex model of affect
const MOOD_DIMENSIONS = {
  valence: 0,     // -1 (negative) to 1 (positive)
  arousal: 0,     // -1 (low energy) to 1 (high energy)
  dominance: 0    // -1 (submissive) to 1 (dominant)
};

// Mood categories mapped to VAD (Valence-Arousal-Dominance) space
const MOOD_CATEGORIES = {
  happy: { valence: 0.8, arousal: 0.5, dominance: 0.4 },
  excited: { valence: 0.6, arousal: 0.9, dominance: 0.5 },
  angry: { valence: -0.8, arousal: 0.7, dominance: 0.7 },
  sad: { valence: -0.7, arousal: -0.4, dominance: -0.3 },
  relaxed: { valence: 0.7, arousal: -0.4, dominance: 0.2 },
  bored: { valence: -0.4, arousal: -0.6, dominance: -0.2 },
  anxious: { valence: -0.6, arousal: 0.6, dominance: -0.3 },
  content: { valence: 0.6, arousal: -0.2, dominance: 0.3 },
  frustrated: { valence: -0.7, arousal: 0.5, dominance: 0.1 },
  confused: { valence: -0.3, arousal: 0.3, dominance: -0.4 },
  interested: { valence: 0.5, arousal: 0.3, dominance: 0.2 },
  tired: { valence: -0.3, arousal: -0.7, dominance: -0.3 }
};

// In-memory cache of user mood data
const userMoodProfiles = new Map(); // userId -> mood profile
const userMoodHistory = new Map();  // userId -> array of historical moods

/**
 * Detect mood from text input.
 * @param {string} text - User's text input
 * @param {Object} context - Additional context information
 * @returns {Object} Detected mood dimensions
 */
function detectMoodFromText(text, context = {}) {
  // Initialize with neutral mood
  const mood = { ...MOOD_DIMENSIONS };
  
  if (!text || typeof text !== 'string') {
    return mood;
  }
  
  // Simplified lexical analysis for mood detection
  const lowerText = text.toLowerCase();
  
  // Valence indicators (positive vs negative sentiment)
  const positiveWords = [
    'good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic',
    'happy', 'glad', 'pleased', 'delighted', 'love', 'enjoy', 'like',
    'thanks', 'thank you', 'appreciate', 'grateful', 'yes', 'awesome'
  ];
  
  const negativeWords = [
    'bad', 'terrible', 'awful', 'horrible', 'poor', 'disappointing',
    'sad', 'unhappy', 'upset', 'angry', 'frustrated', 'annoyed',
    'hate', 'dislike', 'sorry', 'unfortunately', 'no', 'not', "don't"
  ];
  
  // Arousal indicators (high vs low energy)
  const highArousalWords = [
    'excited', 'thrilled', 'energetic', 'active', 'alert', 'awake',
    'enthusiastic', 'eager', 'passionate', 'urgent', 'quick', 'fast',
    'immediately', 'now', 'hurry', 'rush', '!', '!!'
  ];
  
  const lowArousalWords = [
    'tired', 'sleepy', 'exhausted', 'calm', 'relaxed', 'peaceful',
    'quiet', 'slow', 'steady', 'patient', 'later', 'eventually',
    'whenever', 'sometime', 'maybe', 'perhaps', 'might'
  ];
  
  // Dominance indicators (in control vs feeling controlled)
  const highDominanceWords = [
    'will', 'definitely', 'certainly', 'absolutely', 'must', 'should',
    'need', 'require', 'demand', 'insist', 'command', 'order',
    'control', 'manage', 'direct', 'lead', 'decide', 'choose'
  ];
  
  const lowDominanceWords = [
    'could', 'might', 'may', 'possibly', 'perhaps', 'hopefully',
    'wish', 'wonder', 'question', 'confused', 'unsure', 'uncertain',
    'help', 'please', 'assist', 'support', 'guide', 'advise'
  ];
  
  // Count word occurrences
  let positiveCount = 0;
  let negativeCount = 0;
  let highArousalCount = 0;
  let lowArousalCount = 0;
  let highDominanceCount = 0;
  let lowDominanceCount = 0;
  
  // Check for word matches
  const words = lowerText.split(/\s+/);
  for (const word of words) {
    if (positiveWords.includes(word)) positiveCount++;
    if (negativeWords.includes(word)) negativeCount++;
    if (highArousalWords.includes(word)) highArousalCount++;
    if (lowArousalWords.includes(word)) lowArousalCount++;
    if (highDominanceWords.includes(word)) highDominanceCount++;
    if (lowDominanceWords.includes(word)) lowDominanceCount++;
  }
  
  // Check for exclamation marks (high arousal)
  const exclamationCount = (text.match(/!/g) || []).length;
  highArousalCount += exclamationCount;
  
  // Check for question marks (lower dominance)
  const questionCount = (text.match(/\?/g) || []).length;
  if (questionCount > 0) {
    lowDominanceCount += questionCount;
  }
  
  // Calculate valence (-1 to 1)
  const totalValenceWords = positiveCount + negativeCount;
  if (totalValenceWords > 0) {
    mood.valence = ((positiveCount - negativeCount) / totalValenceWords) * 0.8;
  }
  
  // Calculate arousal (-1 to 1)
  const totalArousalWords = highArousalCount + lowArousalCount;
  if (totalArousalWords > 0) {
    mood.arousal = ((highArousalCount - lowArousalCount) / totalArousalWords) * 0.8;
  }
  
  // Calculate dominance (-1 to 1)
  const totalDominanceWords = highDominanceCount + lowDominanceCount;
  if (totalDominanceWords > 0) {
    mood.dominance = ((highDominanceCount - lowDominanceCount) / totalDominanceWords) * 0.8;
  }
  
  // Apply context modifiers if available
  if (context.urgency && typeof context.urgency === 'number') {
    mood.arousal = Math.min(1, Math.max(-1, mood.arousal + (context.urgency * 0.3)));
  }
  
  if (context.confidence && typeof context.confidence === 'number') {
    mood.dominance = Math.min(1, Math.max(-1, mood.dominance + (context.confidence * 0.3)));
  }
  
  return mood;
}

/**
 * Update user's mood profile based on new mood data.
 * @param {string} userId - User identifier
 * @param {Object} newMood - Newly detected mood dimensions
 * @param {Object} context - Additional context information
 * @returns {Promise<Object>} Updated mood profile
 */
async function updateMoodProfile(userId, newMood, context = {}) {
  try {
    // Get current mood profile or initialize
    if (!userMoodProfiles.has(userId)) {
      userMoodProfiles.set(userId, await loadMoodProfile(userId) || { ...MOOD_DIMENSIONS });
      userMoodHistory.set(userId, await loadMoodHistory(userId) || []);
    }
    
    const currentProfile = userMoodProfiles.get(userId);
    const history = userMoodHistory.get(userId);
    
    // Create a new profile with temporal decay
    const decayFactor = 0.85; // How much previous mood persists
    const newProfile = {
      valence: currentProfile.valence * decayFactor,
      arousal: currentProfile.arousal * decayFactor,
      dominance: currentProfile.dominance * decayFactor
    };
    
    // Blend in new mood (weighted average)
    const blendFactor = 0.6; // Weight for new mood
    newProfile.valence = (newProfile.valence * (1 - blendFactor)) + (newMood.valence * blendFactor);
    newProfile.arousal = (newProfile.arousal * (1 - blendFactor)) + (newMood.arousal * blendFactor);
    newProfile.dominance = (newProfile.dominance * (1 - blendFactor)) + (newMood.dominance * blendFactor);
    
    // Ensure values stay within range
    newProfile.valence = Math.min(1, Math.max(-1, newProfile.valence));
    newProfile.arousal = Math.min(1, Math.max(-1, newProfile.arousal));
    newProfile.dominance = Math.min(1, Math.max(-1, newProfile.dominance));
    
    // Record timestamp and add to history
    const timestamp = Date.now();
    history.push({
      timestamp,
      mood: { ...newProfile },
      context: { ...context }
    });
    
    // Keep history to a reasonable size (last 100 entries)
    if (history.length > 100) {
      history.shift();
    }
    
    // Update in-memory cache
    userMoodProfiles.set(userId, newProfile);
    
    // Save to secure storage
    await saveMoodProfile(userId, newProfile);
    await saveMoodHistory(userId, history);
    
    // Log the mood update
    auditTrail.log('mood:profile:updated', {
      userId,
      category: getMoodCategory(newProfile),
      timestamp
    });
    
    return newProfile;
  } catch (error) {
    console.error('Error updating mood profile:', error);
    auditTrail.log('mood:profile:update:error', { userId, error: error.message });
    return { ...MOOD_DIMENSIONS };
  }
}

/**
 * Get the current mood profile for a user.
 * @param {string} userId - User identifier
 * @returns {Promise<Object>} User's mood profile
 */
export async function getMoodProfile(userId) {
  try {
    // Load from storage if not in memory
    if (!userMoodProfiles.has(userId)) {
      userMoodProfiles.set(userId, await loadMoodProfile(userId) || { ...MOOD_DIMENSIONS });
    }
    
    return { ...userMoodProfiles.get(userId) };
  } catch (error) {
    console.error('Error getting mood profile:', error);
    auditTrail.log('mood:profile:get:error', { userId, error: error.message });
    return { ...MOOD_DIMENSIONS };
  }
}

/**
 * Get the mood history for a user.
 * @param {string} userId - User identifier
 * @param {number} limit - Maximum number of history entries to return
 * @returns {Promise<Array>} User's mood history
 */
export async function getMoodHistory(userId, limit = 20) {
  try {
    // Load from storage if not in memory
    if (!userMoodHistory.has(userId)) {
      userMoodHistory.set(userId, await loadMoodHistory(userId) || []);
    }
    
    const history = userMoodHistory.get(userId);
    
    // Return most recent entries up to the limit
    return history.slice(-limit).reverse();
  } catch (error) {
    console.error('Error getting mood history:', error);
    auditTrail.log('mood:history:get:error', { userId, error: error.message });
    return [];
  }
}

/**
 * Get the closest mood category based on VAD dimensions.
 * @param {Object} mood - Mood dimensions (valence, arousal, dominance)
 * @returns {string} Mood category name
 */
function getMoodCategory(mood) {
  let closestCategory = 'neutral';
  let shortestDistance = Infinity;
  
  for (const [category, dimensions] of Object.entries(MOOD_CATEGORIES)) {
    // Calculate Euclidean distance in VAD space
    const distance = Math.sqrt(
      Math.pow(mood.valence - dimensions.valence, 2) +
      Math.pow(mood.arousal - dimensions.arousal, 2) +
      Math.pow(mood.dominance - dimensions.dominance, 2)
    );
    
    if (distance < shortestDistance) {
      shortestDistance = distance;
      closestCategory = category;
    }
  }
  
  // If no close match, return neutral
  return shortestDistance > 0.8 ? 'neutral' : closestCategory;
}

/**
 * Load mood profile from secure storage.
 * @param {string} userId - User identifier
 * @returns {Promise<Object>} User's mood profile
 */
async function loadMoodProfile(userId) {
  try {
    return await privacyGuard.getSecureData(
      `${STORAGE_KEY_PREFIX}${userId}:${MOOD_PROFILE_KEY}`
    ) || { ...MOOD_DIMENSIONS };
  } catch (error) {
    console.error('Error loading mood profile:', error);
    return { ...MOOD_DIMENSIONS };
  }
}

/**
 * Save mood profile to secure storage.
 * @param {string} userId - User identifier
 * @param {Object} profile - Mood profile to save
 * @returns {Promise<boolean>} Success status
 */
async function saveMoodProfile(userId, profile) {
  try {
    return await privacyGuard.setSecureData(
      `${STORAGE_KEY_PREFIX}${userId}:${MOOD_PROFILE_KEY}`,
      profile
    );
  } catch (error) {
    console.error('Error saving mood profile:', error);
    return false;
  }
}

/**
 * Load mood history from secure storage.
 * @param {string} userId - User identifier
 * @returns {Promise<Array>} User's mood history
 */
async function loadMoodHistory(userId) {
  try {
    return await privacyGuard.getSecureData(
      `${STORAGE_KEY_PREFIX}${userId}:${MOOD_HISTORY_KEY}`
    ) || [];
  } catch (error) {
    console.error('Error loading mood history:', error);
    return [];
  }
}

/**
 * Save mood history to secure storage.
 * @param {string} userId - User identifier
 * @param {Array} history - Mood history to save
 * @returns {Promise<boolean>} Success status
 */
async function saveMoodHistory(userId, history) {
  try {
    return await privacyGuard.setSecureData(
      `${STORAGE_KEY_PREFIX}${userId}:${MOOD_HISTORY_KEY}`,
      history
    );
  } catch (error) {
    console.error('Error saving mood history:', error);
    return false;
  }
}

/**
 * Process and analyze user input to detect mood.
 * @param {string} userId - User identifier
 * @param {Object} input - User input data
 * @param {Object} context - Additional context information
 * @returns {Promise<Object>} Detected mood
 */
export async function processMoodInput(userId, input, context = {}) {
  try {
    let detectedMood = { ...MOOD_DIMENSIONS };
    
    // Process text input
    if (input.text) {
      detectedMood = detectMoodFromText(input.text, context);
    }
    
    // Process vision input if available (facial expressions)
    if (input.expressions) {
      // Blend vision-based mood data with text-based
      const visionWeight = 0.7; // Vision data is more reliable for mood
      detectedMood.valence = (detectedMood.valence * (1 - visionWeight)) + 
                             (input.expressions.valence * visionWeight);
      detectedMood.arousal = (detectedMood.arousal * (1 - visionWeight)) + 
                             (input.expressions.arousal * visionWeight);
    }
    
    // Process voice input if available (tone analysis)
    if (input.voiceTone) {
      // Blend voice-based mood data
      const voiceWeight = 0.6; // Voice tone is quite reliable for mood
      detectedMood.valence = (detectedMood.valence * (1 - voiceWeight)) + 
                             (input.voiceTone.valence * voiceWeight);
      detectedMood.arousal = (detectedMood.arousal * (1 - voiceWeight)) + 
                             (input.voiceTone.arousal * voiceWeight);
    }
    
    // Update user's mood profile
    const updatedProfile = await updateMoodProfile(userId, detectedMood, context);
    
    // Get mood category
    const category = getMoodCategory(updatedProfile);
    
    // Publish mood detected event
    publish('mood:detected', {
      userId,
      mood: updatedProfile,
      category,
      source: Object.keys(input).join(','),
      context
    });
    
    return {
      dimensions: updatedProfile,
      category,
      confidence: calculateConfidence(input)
    };
  } catch (error) {
    console.error('Error processing mood input:', error);
    auditTrail.log('mood:process:error', { userId, error: error.message });
    return {
      dimensions: { ...MOOD_DIMENSIONS },
      category: 'neutral',
      confidence: 0
    };
  }
}

/**
 * Calculate confidence level based on available input types.
 * @param {Object} input - User input data
 * @returns {number} Confidence level (0-1)
 */
function calculateConfidence(input) {
  let confidence = 0;
  
  // Text provides base confidence
  if (input.text) {
    confidence += 0.4;
  }
  
  // Vision data increases confidence
  if (input.expressions) {
    confidence += 0.3;
  }
  
  // Voice tone increases confidence
  if (input.voiceTone) {
    confidence += 0.3;
  }
  
  return Math.min(1.0, confidence);
}

/**
 * Initialize the mood detector by subscribing to events.
 * @returns {Promise<boolean>} Success status
 */
export async function initialize() {
  try {
    // Subscribe to conversation message events
    subscribe('conversation:message', async ({ userId, message, context }) => {
      // Process mood from text
      await processMoodInput(userId, { text: message }, context);
    });
    
    // Subscribe to vision events if available
    subscribe('vision:expression:detected', async ({ userId, expressions, context }) => {
      // Process mood from facial expressions
      await processMoodInput(userId, { expressions }, context);
    });
    
    // Subscribe to voice events if available
    subscribe('voice:tone:analyzed', async ({ userId, voiceTone, context }) => {
      // Process mood from voice tone
      await processMoodInput(userId, { voiceTone }, context);
    });
    
    // Subscribe to multimodal input events
    subscribe('input:multimodal', async ({ userId, text, expressions, voiceTone, context }) => {
      // Process mood from all available inputs
      await processMoodInput(userId, { text, expressions, voiceTone }, context);
    });
    
    publish('mood:detector:initialized', {});
    return true;
  } catch (error) {
    console.error('Error initializing mood detector:', error);
    return false;
  }
}
