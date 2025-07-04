/**
 * pattern-learner.js
 * Advanced system for learning user communication patterns and style preferences over time.
 * 
 * Features:
 * - Multi-dimensional style analysis (formality, verbosity, tone, etc.)
 * - Contextual pattern recognition based on conversation topics
 * - Progressive learning with temporal weighting (recent patterns matter more)
 * - Secure storage integration with privacy-guard.js
 */
import { subscribe, publish } from '../../core/events.js';
import * as privacyGuard from '../../security/privacy-guard.js';
import * as auditTrail from '../../security/audit-trail.js';

// Storage keys
const STORAGE_KEY_PREFIX = 'behavior:patterns:';
const STYLE_METRICS_KEY = 'style:metrics';

// Style dimensions and their default values
const STYLE_DIMENSIONS = {
  formality: 0.5,      // 0 = very casual, 1 = very formal
  verbosity: 0.5,      // 0 = concise, 1 = verbose
  emotionality: 0.5,   // 0 = neutral, 1 = emotional
  complexity: 0.5,     // 0 = simple language, 1 = complex language
  directness: 0.5,     // 0 = indirect, 1 = direct
  politeness: 0.5,     // 0 = blunt, 1 = polite
  humor: 0.5,          // 0 = serious, 1 = humorous
  questionFrequency: 0.5 // 0 = few questions, 1 = many questions
};

// Linguistic markers for style dimensions
const STYLE_MARKERS = {
  formality: {
    formal: ['would', 'could', 'should', 'shall', 'may', 'therefore', 'however', 'thus', 'consequently', 'furthermore', 'nevertheless', 'regarding', 'concerning'],
    casual: ['yeah', 'nope', 'cool', 'awesome', 'gonna', 'wanna', 'gotta', 'kinda', 'sorta', 'y\'know', 'like', 'basically', 'literally']
  },
  verbosity: {
    // Measured by average message length and sentence complexity
  },
  emotionality: {
    emotional: ['love', 'hate', 'amazing', 'terrible', 'awesome', 'awful', 'excited', 'disappointed', 'thrilled', 'devastated', '!'],
    neutral: ['adequate', 'sufficient', 'acceptable', 'reasonable', 'appropriate', 'satisfactory']
  },
  complexity: {
    // Measured by word length, sentence structure, and vocabulary diversity
  },
  // Additional markers for other dimensions...
};

// In-memory cache of user patterns
const userPatterns = new Map();
const userStyleMetrics = new Map();
const userTopics = new Map();
const userPhrases = new Map();
const userContexts = new Map();

/**
 * Record a user's message and update pattern analysis.
 * @param {string} userId - User identifier
 * @param {string} message - Message content
 * @param {Object} context - Optional context information
 */
async function recordMessage(userId, message, context = {}) {
  if (!message || typeof message !== 'string') return;
  
  // Initialize user data structures if needed
  if (!userPatterns.has(userId)) {
    userPatterns.set(userId, await loadUserPatterns(userId) || {});
    userStyleMetrics.set(userId, await loadUserStyleMetrics(userId) || { ...STYLE_DIMENSIONS });
    userTopics.set(userId, {});
    userPhrases.set(userId, {});
    userContexts.set(userId, {});
  }
  
  const patterns = userPatterns.get(userId);
  const styleMetrics = userStyleMetrics.get(userId);
  const topics = userTopics.get(userId);
  const phrases = userPhrases.get(userId);
  const contexts = userContexts.get(userId);
  
  // Log this analysis in the audit trail
  auditTrail.record('pattern-learner:analyze', {
    userId,
    messageLength: message.length,
    timestamp: new Date().toISOString()
  });
  
  // Update word frequencies with temporal decay
  const words = message.toLowerCase().split(/\W+/).filter(Boolean);
  const uniqueWords = new Set(words);
  const now = Date.now();
  
  // Apply temporal decay to existing patterns (older patterns matter less)
  Object.keys(patterns).forEach(word => {
    if (patterns[word].count > 0) {
      patterns[word].count *= 0.99; // Slight decay for words not in current message
    }
  });
  
  // Update frequencies for words in current message
  for (const word of words) {
    if (!patterns[word]) {
      patterns[word] = { count: 0, firstSeen: now, lastSeen: now };
    }
    patterns[word].count = (patterns[word].count || 0) + 1;
    patterns[word].lastSeen = now;
  }
  
  // Extract and store common phrases (n-grams)
  for (let i = 2; i <= 4; i++) { // 2-word to 4-word phrases
    for (let j = 0; j <= words.length - i; j++) {
      const phrase = words.slice(j, j + i).join(' ');
      phrases[phrase] = (phrases[phrase] || 0) + 1;
    }
  }
  
  // Update style metrics based on the message
  updateStyleMetrics(styleMetrics, message, words);
  
  // Update topic modeling if context topic is provided
  if (context.topic) {
    if (!topics[context.topic]) {
      topics[context.topic] = { count: 0, words: {} };
    }
    topics[context.topic].count++;
    
    for (const word of uniqueWords) {
      topics[context.topic].words[word] = (topics[context.topic].words[word] || 0) + 1;
    }
  }
  
  // Store context associations
  if (context.situation || context.emotion) {
    const contextKey = `${context.situation || ''}:${context.emotion || ''}`;
    if (!contexts[contextKey]) {
      contexts[contextKey] = { count: 0, words: {} };
    }
    contexts[contextKey].count++;
    
    for (const word of uniqueWords) {
      contexts[contextKey].words[word] = (contexts[contextKey].words[word] || 0) + 1;
    }
  }
  
  // Save updated patterns periodically (not on every message to reduce storage operations)
  if (Math.random() < 0.1) { // ~10% chance to save on each message
    await saveUserPatterns(userId, patterns);
    await saveUserStyleMetrics(userId, styleMetrics);
  }
  
  // Publish update event
  publish('behavior:pattern-updated', { 
    userId, 
    patterns: { ...patterns },
    styleMetrics: { ...styleMetrics },
    messageCount: Object.values(patterns).reduce((sum, p) => sum + p.count, 0)
  });
}

/**
 * Update style metrics based on message content.
 * @param {Object} metrics - Style metrics object to update
 * @param {string} message - Full message text
 * @param {Array} words - Array of words in the message
 */
function updateStyleMetrics(metrics, message, words) {
  // Calculate formality score
  const formalCount = words.filter(w => STYLE_MARKERS.formality.formal.includes(w)).length;
  const casualCount = words.filter(w => STYLE_MARKERS.formality.casual.includes(w)).length;
  
  if (formalCount + casualCount > 0) {
    // Adjust formality score (weighted average with existing score)
    const formalityScore = formalCount / (formalCount + casualCount);
    metrics.formality = metrics.formality * 0.9 + formalityScore * 0.1;
  }
  
  // Calculate emotionality score
  const emotionalCount = words.filter(w => STYLE_MARKERS.emotionality.emotional.includes(w)).length;
  const neutralCount = words.filter(w => STYLE_MARKERS.emotionality.neutral.includes(w)).length;
  
  if (emotionalCount + neutralCount > 0) {
    const emotionalityScore = emotionalCount / (emotionalCount + neutralCount);
    metrics.emotionality = metrics.emotionality * 0.9 + emotionalityScore * 0.1;
  }
  
  // Calculate verbosity (based on message length and sentence complexity)
  const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
  const sentences = message.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const avgSentenceLength = sentences.length > 0 ? words.length / sentences.length : words.length;
  
  // Normalize verbosity score (1-20 words per sentence is the typical range)
  const verbosityScore = Math.min(avgSentenceLength / 20, 1);
  metrics.verbosity = metrics.verbosity * 0.9 + verbosityScore * 0.1;
  
  // Calculate complexity (based on word length and vocabulary diversity)
  const complexityScore = Math.min(avgWordLength / 8, 1) * 0.5 + 
                         Math.min(new Set(words).size / words.length, 1) * 0.5;
  metrics.complexity = metrics.complexity * 0.9 + complexityScore * 0.1;
  
  // Calculate directness (based on question frequency and command verbs)
  const questionCount = (message.match(/\?/g) || []).length;
  const questionScore = Math.min(questionCount / sentences.length, 1);
  metrics.questionFrequency = metrics.questionFrequency * 0.9 + questionScore * 0.1;
  
  // Detect command verbs at sentence starts to measure directness
  const commandVerbs = ['do', 'go', 'make', 'try', 'tell', 'show', 'give', 'find', 'help', 'let'];
  const sentenceStarts = sentences.map(s => s.trim().split(' ')[0].toLowerCase());
  const commandCount = sentenceStarts.filter(w => commandVerbs.includes(w)).length;
  const directnessScore = Math.min(commandCount / sentences.length, 1);
  metrics.directness = metrics.directness * 0.9 + directnessScore * 0.1;
}

/**
 * Load user patterns from secure storage.
 * @param {string} userId - User identifier
 * @returns {Promise<Object>} User word patterns
 */
async function loadUserPatterns(userId) {
  try {
    const patterns = await privacyGuard.secureRetrieve(`${STORAGE_KEY_PREFIX}${userId}`);
    return patterns || {};
  } catch (error) {
    console.error('Error loading user patterns:', error);
    return {};
  }
}

/**
 * Save user patterns to secure storage.
 * @param {string} userId - User identifier
 * @param {Object} patterns - User word patterns
 * @returns {Promise<boolean>} Success status
 */
async function saveUserPatterns(userId, patterns) {
  try {
    await privacyGuard.secureStore(`${STORAGE_KEY_PREFIX}${userId}`, patterns, {
      category: 'personalization',
      expires: 365 // Store for up to a year
    });
    return true;
  } catch (error) {
    console.error('Error saving user patterns:', error);
    return false;
  }
}

/**
 * Load user style metrics from secure storage.
 * @param {string} userId - User identifier
 * @returns {Promise<Object>} User style metrics
 */
async function loadUserStyleMetrics(userId) {
  try {
    const metrics = await privacyGuard.secureRetrieve(`${STORAGE_KEY_PREFIX}${userId}:${STYLE_METRICS_KEY}`);
    return metrics || { ...STYLE_DIMENSIONS };
  } catch (error) {
    console.error('Error loading user style metrics:', error);
    return { ...STYLE_DIMENSIONS };
  }
}

/**
 * Save user style metrics to secure storage.
 * @param {string} userId - User identifier
 * @param {Object} metrics - User style metrics
 * @returns {Promise<boolean>} Success status
 */
async function saveUserStyleMetrics(userId, metrics) {
  try {
    await privacyGuard.secureStore(`${STORAGE_KEY_PREFIX}${userId}:${STYLE_METRICS_KEY}`, metrics, {
      category: 'personalization',
      expires: 365 // Store for up to a year
    });
    return true;
  } catch (error) {
    console.error('Error saving user style metrics:', error);
    return false;
  }
}

/**
 * Get learned patterns for a user.
 * @param {string} userId - User identifier
 * @returns {Promise<Object>} Word frequency map and style metrics
 */
export async function getPatterns(userId) {
  // Load from storage if not in memory
  if (!userPatterns.has(userId)) {
    userPatterns.set(userId, await loadUserPatterns(userId) || {});
    userStyleMetrics.set(userId, await loadUserStyleMetrics(userId) || { ...STYLE_DIMENSIONS });
  }
  
  return {
    patterns: { ...(userPatterns.get(userId) || {}) },
    styleMetrics: { ...(userStyleMetrics.get(userId) || {}) }
  };
}

/**
 * Get communication style metrics for a user.
 * @param {string} userId - User identifier
 * @returns {Promise<Object>} Style metrics object
 */
export async function getStyleMetrics(userId) {
  // Load from storage if not in memory
  if (!userStyleMetrics.has(userId)) {
    userStyleMetrics.set(userId, await loadUserStyleMetrics(userId) || { ...STYLE_DIMENSIONS });
  }
  
  return { ...(userStyleMetrics.get(userId) || { ...STYLE_DIMENSIONS }) };
}

/**
 * Get most frequent words used by a user.
 * @param {string} userId - User identifier
 * @param {number} limit - Maximum number of words to return
 * @returns {Promise<Array>} Array of [word, frequency] pairs
 */
export async function getFrequentWords(userId, limit = 20) {
  const { patterns } = await getPatterns(userId);
  
  return Object.entries(patterns)
    .map(([word, data]) => [word, data.count])
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

/**
 * Get distinctive words that characterize a user's communication style.
 * @param {string} userId - User identifier
 * @param {number} limit - Maximum number of words to return
 * @returns {Promise<Array>} Array of distinctive words
 */
export async function getDistinctiveWords(userId, limit = 20) {
  const { patterns } = await getPatterns(userId);
  
  // Filter common words and sort by frequency
  const commonWords = new Set(['the', 'and', 'to', 'a', 'of', 'in', 'is', 'it', 'that', 'for', 'on', 'with']);
  
  return Object.entries(patterns)
    .filter(([word]) => !commonWords.has(word) && word.length > 2)
    .map(([word, data]) => [word, data.count])
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);
}

/**
 * Reset all learned patterns for a user.
 * @param {string} userId - User identifier
 * @returns {Promise<boolean>} Success status
 */
export async function resetPatterns(userId) {
  try {
    userPatterns.delete(userId);
    userStyleMetrics.delete(userId);
    userTopics.delete(userId);
    userPhrases.delete(userId);
    userContexts.delete(userId);
    
    await privacyGuard.secureDelete(`${STORAGE_KEY_PREFIX}${userId}`);
    await privacyGuard.secureDelete(`${STORAGE_KEY_PREFIX}${userId}:${STYLE_METRICS_KEY}`);
    
    publish('behavior:patterns-reset', { userId });
    return true;
  } catch (error) {
    console.error('Error resetting user patterns:', error);
    return false;
  }
}

/**
 * Initialize the pattern learner by subscribing to conversation events.
 * @param {Object} options - Initialization options
 * @returns {Promise<boolean>} Success status
 */
export async function initialize(options = {}) {
  try {
    // Subscribe to conversation messages
    subscribe('conversation:message', ({ userId, message, context }) => {
      recordMessage(userId, message, context);
    });
    
    // Subscribe to user feedback to improve pattern learning
    subscribe('user:feedback', ({ userId, messageId, rating, feedback }) => {
      // Use feedback to adjust pattern weights (future enhancement)
    });
    
    // Subscribe to user profile updates
    subscribe('user:profile-updated', ({ userId }) => {
      // Refresh cached patterns when user profile changes
      userPatterns.delete(userId);
      userStyleMetrics.delete(userId);
    });
    
    publish('behavior:pattern-learner:initialized', {});
    return true;
  } catch (error) {
    console.error('Error initializing pattern learner:', error);
    return false;
  }
}
