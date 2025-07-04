/**
 * empathy-core.js
 * 
 * Emotional intelligence core for ALEJO that provides empathy modeling, 
 * emotional context understanding, and response modulation.
 * 
 * Features:
 * - Emotion detection from text using linguistic markers
 * - Contextual emotional state tracking
 * - Empathetic response generation
 * - Emotional context persistence with secure storage
 * - Event-driven emotional intelligence
 */
import { subscribe, publish } from '../../core/events.js';
import * as privacyGuard from '../../security/privacy-guard.js';
import * as auditTrail from '../../security/audit-trail.js';
import { getStyleMetrics } from '../behavior/pattern-learner.js';

// Storage keys
const STORAGE_KEY_PREFIX = 'emotional:';
const EMOTIONAL_STATE_KEY = 'state';
const EMOTIONAL_HISTORY_KEY = 'history';

// Emotion dimensions
const EMOTION_DIMENSIONS = {
  joy: 0,           // 0 = none, 1 = extreme joy
  sadness: 0,       // 0 = none, 1 = extreme sadness
  anger: 0,         // 0 = none, 1 = extreme anger
  fear: 0,          // 0 = none, 1 = extreme fear
  surprise: 0,      // 0 = none, 1 = extreme surprise
  disgust: 0,       // 0 = none, 1 = extreme disgust
  trust: 0,         // 0 = none, 1 = extreme trust
  anticipation: 0   // 0 = none, 1 = extreme anticipation
};

// Emotion categories based on Plutchik's wheel of emotions
const EMOTION_CATEGORIES = {
  PRIMARY: ['joy', 'sadness', 'anger', 'fear', 'surprise', 'disgust', 'trust', 'anticipation'],
  SECONDARY: {
    love: ['joy', 'trust'],
    submission: ['trust', 'fear'],
    awe: ['fear', 'surprise'],
    disappointment: ['surprise', 'sadness'],
    remorse: ['sadness', 'disgust'],
    contempt: ['disgust', 'anger'],
    aggressiveness: ['anger', 'anticipation'],
    optimism: ['anticipation', 'joy']
  },
  TERTIARY: {
    guilt: ['fear', 'sadness', 'disgust'],
    sentimentality: ['trust', 'sadness', 'joy'],
    curiosity: ['trust', 'surprise', 'anticipation'],
    despair: ['fear', 'sadness', 'anger'],
    shame: ['fear', 'disgust', 'sadness'],
    outrage: ['surprise', 'anger', 'disgust'],
    anxiety: ['anticipation', 'fear', 'surprise'],
    hope: ['anticipation', 'joy', 'trust']
  }
};

// Linguistic markers for emotion detection
const EMOTION_MARKERS = {
  joy: [
    'happy', 'glad', 'delighted', 'pleased', 'joyful', 'content', 'thrilled', 'excited',
    'ecstatic', 'satisfied', 'cheerful', 'merry', 'jubilant', 'enjoy', 'wonderful',
    'fantastic', 'terrific', 'awesome', 'great', 'excellent', 'amazing', 'love', 'like',
    '😊', '😃', '😄', '😁', '🙂', '😀', '🥰', '😍', '🤩', '😆'
  ],
  sadness: [
    'sad', 'unhappy', 'depressed', 'down', 'blue', 'gloomy', 'miserable', 'sorrowful',
    'heartbroken', 'grief', 'regret', 'disappointed', 'upset', 'distressed', 'hurt',
    'painful', 'tragic', 'sorry', 'unfortunately', 'miss', 'lonely', 'alone',
    '😢', '😭', '😔', '😞', '😟', '🙁', '☹️', '💔', '😥', '😿'
  ],
  anger: [
    'angry', 'mad', 'furious', 'outraged', 'irritated', 'annoyed', 'frustrated', 'enraged',
    'hostile', 'hate', 'resent', 'despise', 'dislike', 'bitter', 'indignant', 'livid',
    'infuriated', 'exasperated', 'cross', 'vexed', 'irked', 'offended', 'pissed',
    '😠', '😡', '🤬', '😤', '😒', '👿', '💢', '🔥', '👊', '💥'
  ],
  fear: [
    'afraid', 'scared', 'frightened', 'terrified', 'anxious', 'worried', 'nervous', 'uneasy',
    'concerned', 'alarmed', 'panicked', 'petrified', 'horrified', 'dread', 'fear', 'apprehensive',
    'paranoid', 'suspicious', 'wary', 'cautious', 'timid', 'hesitant', 'insecure',
    '😨', '😱', '😰', '😧', '😦', '😮', '😯', '🙀', '😳', '😬'
  ],
  surprise: [
    'surprised', 'shocked', 'astonished', 'amazed', 'stunned', 'startled', 'unexpected',
    'sudden', 'abrupt', 'wow', 'whoa', 'gosh', 'goodness', 'oh my', 'unbelievable',
    'incredible', 'remarkable', 'extraordinary', 'astounding', 'striking', 'staggering',
    '😲', '😮', '😯', '😦', '😧', '😳', '🤯', '😵', '🙀', '😱'
  ],
  disgust: [
    'disgusted', 'revolted', 'repulsed', 'sickened', 'nauseated', 'appalled', 'gross',
    'nasty', 'yuck', 'ew', 'distasteful', 'offensive', 'repugnant', 'repellent', 'foul',
    'vile', 'loathsome', 'abhorrent', 'odious', 'objectionable', 'repulsive',
    '🤢', '🤮', '😖', '😫', '😩', '😣', '😝', '🤨', '🙄', '😒'
  ],
  trust: [
    'trust', 'believe', 'faith', 'confidence', 'reliable', 'dependable', 'trustworthy',
    'honest', 'loyal', 'devoted', 'dedicated', 'faithful', 'sincere', 'genuine', 'authentic',
    'true', 'certain', 'assured', 'convinced', 'secure', 'safe', 'protected',
    '🤝', '👍', '👌', '🙏', '💯', '✅', '☑️', '✔️', '🔒', '🛡️'
  ],
  anticipation: [
    'anticipate', 'expect', 'await', 'look forward', 'hope', 'eager', 'excited', 'keen',
    'enthusiastic', 'interested', 'curious', 'intrigued', 'fascinated', 'captivated',
    'soon', 'about to', 'going to', 'will', 'shall', 'plan', 'prepare', 'ready',
    '🔮', '⏳', '⌛', '⏰', '🕒', '📅', '🗓️', '🎯', '🎪', '🎭'
  ]
};

// Contextual factors that influence emotion detection
const CONTEXTUAL_FACTORS = {
  TOPIC_SENSITIVITY: {
    health: 1.5,
    finance: 1.3,
    relationships: 1.4,
    work: 1.2,
    personal: 1.5
  },
  TIME_SENSITIVITY: {
    recent: 1.5,    // Within last hour
    today: 1.3,     // Within today
    week: 1.1,      // Within this week
    older: 0.8      // Older than a week
  },
  INTENSITY_MODIFIERS: {
    very: 1.5,
    extremely: 1.8,
    somewhat: 0.7,
    slightly: 0.5,
    incredibly: 1.7,
    absolutely: 1.6,
    rather: 0.8,
    quite: 1.2,
    barely: 0.3,
    hardly: 0.4
  }
};

// In-memory cache of user emotional states
const userEmotionalStates = new Map(); // userId -> current emotional state
const userEmotionalHistory = new Map(); // userId -> array of historical emotional states

/**
 * Detect emotions in a message using linguistic markers and context.
 * @param {string} message - Message content
 * @param {Object} context - Optional context information
 * @returns {Object} Detected emotion dimensions
 */
function detectEmotions(message, context = {}) {
  // Initialize with neutral emotions
  const emotions = { ...EMOTION_DIMENSIONS };
  
  if (!message || typeof message !== 'string') {
    return emotions;
  }
  
  // Normalize message for analysis
  const normalizedMessage = message.toLowerCase();
  const words = normalizedMessage.split(/\s+/);
  
  // Detect emotions based on linguistic markers
  for (const [emotion, markers] of Object.entries(EMOTION_MARKERS)) {
    // Count occurrences of emotion markers
    let count = 0;
    let intensity = 0;
    
    for (const marker of markers) {
      // Check for exact word matches
      if (words.includes(marker)) {
        count++;
        intensity += 1.0;
        continue;
      }
      
      // Check for substring matches (for emojis and partial matches)
      if (normalizedMessage.includes(marker)) {
        count++;
        intensity += 0.8; // Slightly lower weight for substring matches
      }
    }
    
    // Apply intensity modifiers
    for (const [modifier, factor] of Object.entries(CONTEXTUAL_FACTORS.INTENSITY_MODIFIERS)) {
      if (normalizedMessage.includes(modifier)) {
        intensity *= factor;
      }
    }
    
    // Normalize emotion intensity (0-1 scale)
    if (count > 0) {
      emotions[emotion] = Math.min(1.0, intensity / (markers.length * 0.3));
    }
  }
  
  // Apply contextual factors
  if (context.topic && CONTEXTUAL_FACTORS.TOPIC_SENSITIVITY[context.topic]) {
    const sensitivityFactor = CONTEXTUAL_FACTORS.TOPIC_SENSITIVITY[context.topic];
    
    // Amplify emotions based on topic sensitivity
    for (const emotion in emotions) {
      if (emotions[emotion] > 0) {
        emotions[emotion] = Math.min(1.0, emotions[emotion] * sensitivityFactor);
      }
    }
  }
  
  // Apply time context if available
  if (context.timeContext && CONTEXTUAL_FACTORS.TIME_SENSITIVITY[context.timeContext]) {
    const timeFactor = CONTEXTUAL_FACTORS.TIME_SENSITIVITY[context.timeContext];
    
    // Adjust emotions based on time relevance
    for (const emotion in emotions) {
      if (emotions[emotion] > 0) {
        emotions[emotion] = Math.min(1.0, emotions[emotion] * timeFactor);
      }
    }
  }
  
  return emotions;
}

/**
 * Update user's emotional state based on new emotions.
 * @param {string} userId - User identifier
 * @param {Object} newEmotions - Newly detected emotions
 * @param {Object} context - Optional context information
 * @returns {Object} Updated emotional state
 */
async function updateEmotionalState(userId, newEmotions, context = {}) {
  try {
    // Get current emotional state or initialize
    if (!userEmotionalStates.has(userId)) {
      userEmotionalStates.set(userId, await loadEmotionalState(userId) || { ...EMOTION_DIMENSIONS });
      userEmotionalHistory.set(userId, await loadEmotionalHistory(userId) || []);
    }
    
    const currentState = userEmotionalStates.get(userId);
    const history = userEmotionalHistory.get(userId);
    
    // Create a new state with temporal decay of previous emotions
    const decayFactor = 0.8; // How much previous emotions persist
    const newState = { ...EMOTION_DIMENSIONS };
    
    // Apply decay to current emotions
    for (const emotion in currentState) {
      newState[emotion] = currentState[emotion] * decayFactor;
    }
    
    // Blend in new emotions
    for (const emotion in newEmotions) {
      // New emotions have higher weight than decayed emotions
      newState[emotion] = Math.min(1.0, newState[emotion] + (newEmotions[emotion] * 0.7));
    }
    
    // Record timestamp
    const timestamp = Date.now();
    
    // Add to history (with pruning)
    history.push({
      timestamp,
      emotions: { ...newState },
      context: { ...context }
    });
    
    // Keep history to a reasonable size (last 50 entries)
    if (history.length > 50) {
      history.shift();
    }
    
    // Update in-memory cache
    userEmotionalStates.set(userId, newState);
    
    // Save to secure storage
    await saveEmotionalState(userId, newState);
    await saveEmotionalHistory(userId, history);
    
    // Log the emotional state update
    auditTrail.log('emotional:state:updated', {
      userId,
      dominantEmotion: getDominantEmotion(newState),
      timestamp
    });
    
    return newState;
  } catch (error) {
    console.error('Error updating emotional state:', error);
    auditTrail.log('emotional:state:update:error', { userId, error: error.message });
    return { ...EMOTION_DIMENSIONS };
  }
}

/**
 * Get the current emotional state for a user.
 * @param {string} userId - User identifier
 * @returns {Promise<Object>} User's emotional state
 */
export async function getEmotionalState(userId) {
  try {
    // Load from storage if not in memory
    if (!userEmotionalStates.has(userId)) {
      userEmotionalStates.set(userId, await loadEmotionalState(userId) || { ...EMOTION_DIMENSIONS });
    }
    
    return { ...userEmotionalStates.get(userId) };
  } catch (error) {
    console.error('Error getting emotional state:', error);
    auditTrail.log('emotional:state:get:error', { userId, error: error.message });
    return { ...EMOTION_DIMENSIONS };
  }
}

/**
 * Get the emotional history for a user.
 * @param {string} userId - User identifier
 * @param {number} limit - Maximum number of history entries to return
 * @returns {Promise<Array>} User's emotional history
 */
export async function getEmotionalHistory(userId, limit = 10) {
  try {
    // Load from storage if not in memory
    if (!userEmotionalHistory.has(userId)) {
      userEmotionalHistory.set(userId, await loadEmotionalHistory(userId) || []);
    }
    
    const history = userEmotionalHistory.get(userId);
    
    // Return most recent entries up to the limit
    return history.slice(-limit).reverse();
  } catch (error) {
    console.error('Error getting emotional history:', error);
    auditTrail.log('emotional:history:get:error', { userId, error: error.message });
    return [];
  }
}

/**
 * Get the dominant emotion from an emotional state.
 * @param {Object} emotionalState - Emotional state object
 * @returns {string} Dominant emotion name
 */
function getDominantEmotion(emotionalState) {
  let dominant = 'neutral';
  let maxIntensity = 0.2; // Threshold for considering an emotion dominant
  
  for (const [emotion, intensity] of Object.entries(emotionalState)) {
    if (intensity > maxIntensity) {
      dominant = emotion;
      maxIntensity = intensity;
    }
  }
  
  return dominant;
}

/**
 * Get secondary and tertiary emotions based on primary emotions.
 * @param {Object} emotionalState - Emotional state with primary emotions
 * @returns {Object} Enhanced emotional state with derived emotions
 */
function getDerivedEmotions(emotionalState) {
  const enhanced = { ...emotionalState };
  
  // Calculate secondary emotions
  for (const [secondary, primaries] of Object.entries(EMOTION_CATEGORIES.SECONDARY)) {
    const [first, second] = primaries;
    enhanced[secondary] = Math.min(1.0, (emotionalState[first] + emotionalState[second]) / 2);
  }
  
  // Calculate tertiary emotions
  for (const [tertiary, primaries] of Object.entries(EMOTION_CATEGORIES.TERTIARY)) {
    const [first, second, third] = primaries;
    enhanced[tertiary] = Math.min(1.0, (emotionalState[first] + emotionalState[second] + emotionalState[third]) / 3);
  }
  
  return enhanced;
}

/**
 * Generate an empathetic response based on user's emotional state.
 * @param {string} userId - User identifier
 * @param {string} baseResponse - Original response
 * @param {Object} context - Optional context information
 * @returns {Promise<string>} Empathy-enhanced response
 */
export async function generateEmpatheticResponse(userId, baseResponse, context = {}) {
  try {
    // Get user's emotional state
    const emotionalState = await getEmotionalState(userId);
    const dominantEmotion = getDominantEmotion(emotionalState);
    
    // If emotional state is neutral, return the base response
    if (dominantEmotion === 'neutral') {
      return baseResponse;
    }
    
    // Get derived emotions for more nuanced understanding
    const derivedEmotions = getDerivedEmotions(emotionalState);
    
    // Empathetic response templates based on emotions
    const empathyTemplates = {
      joy: [
        "I'm glad to hear you're feeling positive! ",
        "That's wonderful! ",
        "I'm happy things are going well for you. "
      ],
      sadness: [
        "I understand this might be difficult. ",
        "I'm sorry you're going through this. ",
        "That sounds challenging, and I'm here to help. "
      ],
      anger: [
        "I can see this is frustrating. ",
        "I understand why you might feel upset about this. ",
        "That would be irritating, let's see how we can address it. "
      ],
      fear: [
        "It's okay to feel concerned about this. ",
        "I understand this might be causing you anxiety. ",
        "Let's work through this worry together. "
      ],
      surprise: [
        "That is quite unexpected! ",
        "I can see why that would be surprising. ",
        "What an interesting development! "
      ],
      disgust: [
        "I understand your discomfort with this. ",
        "That does sound unpleasant. ",
        "Let's find a better approach that works for you. "
      ],
      trust: [
        "I appreciate your confidence. ",
        "Thank you for sharing that with me. ",
        "I value your trust and will do my best to help. "
      ],
      anticipation: [
        "I can see you're looking forward to this. ",
        "It's exciting to plan for what's coming next. ",
        "Let's prepare for this upcoming opportunity. "
      ],
      // Secondary emotions
      love: [
        "I'm touched by your enthusiasm and warmth. ",
        "That's a beautiful sentiment. ",
        "What a wonderful perspective you have. "
      ],
      disappointment: [
        "I understand this isn't what you were hoping for. ",
        "It's natural to feel let down sometimes. ",
        "Let's see if we can find a better outcome. "
      ],
      remorse: [
        "It's okay to have regrets sometimes. ",
        "We all make decisions we wish we could change. ",
        "Let's focus on what we can do moving forward. "
      ],
      anxiety: [
        "It's completely normal to feel uncertain about this. ",
        "Many people feel anxious when facing these situations. ",
        "Let's break this down into manageable steps. "
      ],
      hope: [
        "I can see you're optimistic about the possibilities. ",
        "That's a positive way to look at things. ",
        "Your hopefulness is inspiring. "
      ]
    };
    
    // Select the appropriate template for the dominant emotion
    const templates = empathyTemplates[dominantEmotion] || 
                      (derivedEmotions.anxiety > 0.5 ? empathyTemplates.anxiety : null) ||
                      (derivedEmotions.hope > 0.5 ? empathyTemplates.hope : null) ||
                      (derivedEmotions.disappointment > 0.5 ? empathyTemplates.disappointment : null) ||
                      empathyTemplates.trust;
    
    // Select a random template from the appropriate category
    const template = templates[Math.floor(Math.random() * templates.length)];
    
    // Combine empathetic prefix with base response
    return template + baseResponse;
  } catch (error) {
    console.error('Error generating empathetic response:', error);
    auditTrail.log('emotional:response:error', { userId, error: error.message });
    return baseResponse; // Return original response if there's an error
  }
}

/**
 * Analyze conversation mood based on recent emotional history.
 * @param {string} userId - User identifier
 * @returns {Promise<Object>} Conversation mood analysis
 */
export async function analyzeConversationMood(userId) {
  try {
    // Get emotional history
    const history = await getEmotionalHistory(userId, 10);
    
    if (history.length === 0) {
      return {
        overall: 'neutral',
        trend: 'stable',
        intensity: 0,
        confidence: 0
      };
    }
    
    // Calculate average emotions across history
    const averageEmotions = { ...EMOTION_DIMENSIONS };
    let totalWeight = 0;
    
    // More recent emotions have higher weight
    history.forEach((entry, index) => {
      const weight = (index + 1) / history.length;
      totalWeight += weight;
      
      for (const emotion in entry.emotions) {
        averageEmotions[emotion] += entry.emotions[emotion] * weight;
      }
    });
    
    // Normalize by total weight
    for (const emotion in averageEmotions) {
      averageEmotions[emotion] /= totalWeight;
    }
    
    // Get dominant emotion
    const dominant = getDominantEmotion(averageEmotions);
    
    // Calculate intensity (how strong the dominant emotion is)
    const intensity = averageEmotions[dominant];
    
    // Calculate trend (improving, worsening, stable)
    let trend = 'stable';
    if (history.length >= 3) {
      const recent = history[0].emotions[dominant];
      const older = history[history.length - 1].emotions[dominant];
      
      if (recent - older > 0.2) {
        trend = 'increasing';
      } else if (older - recent > 0.2) {
        trend = 'decreasing';
      }
    }
    
    // Calculate confidence based on consistency
    const emotionVariance = history.reduce((variance, entry) => {
      return variance + Math.abs(entry.emotions[dominant] - averageEmotions[dominant]);
    }, 0) / history.length;
    
    const confidence = Math.max(0, Math.min(1, 1 - emotionVariance));
    
    return {
      overall: dominant,
      trend,
      intensity,
      confidence,
      emotions: averageEmotions
    };
  } catch (error) {
    console.error('Error analyzing conversation mood:', error);
    auditTrail.log('emotional:mood:analysis:error', { userId, error: error.message });
    return {
      overall: 'neutral',
      trend: 'stable',
      intensity: 0,
      confidence: 0
    };
  }
}

/**
 * Load emotional state from secure storage.
 * @param {string} userId - User identifier
 * @returns {Promise<Object>} User's emotional state
 */
async function loadEmotionalState(userId) {
  try {
    return await privacyGuard.getSecureData(
      `${STORAGE_KEY_PREFIX}${userId}:${EMOTIONAL_STATE_KEY}`
    ) || { ...EMOTION_DIMENSIONS };
  } catch (error) {
    console.error('Error loading emotional state:', error);
    return { ...EMOTION_DIMENSIONS };
  }
}

/**
 * Save emotional state to secure storage.
 * @param {string} userId - User identifier
 * @param {Object} state - Emotional state to save
 * @returns {Promise<boolean>} Success status
 */
async function saveEmotionalState(userId, state) {
  try {
    return await privacyGuard.setSecureData(
      `${STORAGE_KEY_PREFIX}${userId}:${EMOTIONAL_STATE_KEY}`,
      state
    );
  } catch (error) {
    console.error('Error saving emotional state:', error);
    return false;
  }
}

/**
 * Load emotional history from secure storage.
 * @param {string} userId - User identifier
 * @returns {Promise<Array>} User's emotional history
 */
async function loadEmotionalHistory(userId) {
  try {
    return await privacyGuard.getSecureData(
      `${STORAGE_KEY_PREFIX}${userId}:${EMOTIONAL_HISTORY_KEY}`
    ) || [];
  } catch (error) {
    console.error('Error loading emotional history:', error);
    return [];
  }
}

/**
 * Save emotional history to secure storage.
 * @param {string} userId - User identifier
 * @param {Array} history - Emotional history to save
 * @returns {Promise<boolean>} Success status
 */
async function saveEmotionalHistory(userId, history) {
  try {
    return await privacyGuard.setSecureData(
      `${STORAGE_KEY_PREFIX}${userId}:${EMOTIONAL_HISTORY_KEY}`,
      history
    );
  } catch (error) {
    console.error('Error saving emotional history:', error);
    return false;
  }
}

/**
 * Reset emotional state and history for a user.
 * @param {string} userId - User identifier
 * @returns {Promise<boolean>} Success status
 */
export async function resetEmotionalData(userId) {
  try {
    // Reset in-memory cache
    userEmotionalStates.set(userId, { ...EMOTION_DIMENSIONS });
    userEmotionalHistory.set(userId, []);
    
    // Reset in secure storage
    await saveEmotionalState(userId, { ...EMOTION_DIMENSIONS });
    await saveEmotionalHistory(userId, []);
    
    // Log the reset
    auditTrail.log('emotional:data:reset', { userId });
    
    return true;
  } catch (error) {
    console.error('Error resetting emotional data:', error);
    auditTrail.log('emotional:data:reset:error', { userId, error: error.message });
    return false;
  }
}

/**
 * Initialize the empathy core by subscribing to events.
 * @returns {Promise<boolean>} Success status
 */
export async function initialize() {
  try {
    // Subscribe to conversation message events
    subscribe('conversation:message', async ({ userId, message, context }) => {
      // Detect emotions in the message
      const detectedEmotions = detectEmotions(message, context);
      
      // Update user's emotional state
      await updateEmotionalState(userId, detectedEmotions, context);
      
      // Publish emotional state update event
      publish('emotional:state:updated', {
        userId,
        dominantEmotion: getDominantEmotion(detectedEmotions),
        context
      });
    });
    
    // Subscribe to conversation response events to add empathy
    subscribe('conversation:response', async ({ userId, response, context }) => {
      // Generate empathetic response
      const empathetic = await generateEmpatheticResponse(userId, response, context);
      
      // Publish empathetic response event
      publish('emotional:response:generated', {
        userId,
        originalResponse: response,
        empatheticResponse: empathetic,
        context
      });
    });
    
    // Subscribe to user feedback events to refine emotional understanding
    subscribe('user:feedback', async ({ userId, feedback, context }) => {
      if (feedback.emotionalResponse) {
        // Adjust emotional state based on feedback
        const adjustment = {};
        
        if (feedback.emotionalResponse === 'too_emotional') {
          // Reduce emotional intensity across all dimensions
          const currentState = await getEmotionalState(userId);
          for (const emotion in currentState) {
            adjustment[emotion] = currentState[emotion] * 0.7;
          }
        } else if (feedback.emotionalResponse === 'not_emotional_enough') {
          // Increase emotional intensity for dominant emotion
          const currentState = await getEmotionalState(userId);
          const dominant = getDominantEmotion(currentState);
          adjustment[dominant] = Math.min(1.0, currentState[dominant] * 1.3);
        } else if (feedback.emotionalResponse === 'wrong_emotion') {
          // Reset emotional state to neutral
          for (const emotion in EMOTION_DIMENSIONS) {
            adjustment[emotion] = 0.1;
          }
        }
        
        // Update emotional state with adjustments
        await updateEmotionalState(userId, adjustment, {
          ...context,
          source: 'feedback',
          adjustmentType: feedback.emotionalResponse
        });
      }
    });
    
    // Subscribe to periodic mood analysis
    setInterval(async () => {
      // Get all users with emotional states
      const userIds = Array.from(userEmotionalStates.keys());
      
      // Analyze mood for each user
      for (const userId of userIds) {
        const moodAnalysis = await analyzeConversationMood(userId);
        
        // Publish mood analysis event
        publish('emotional:mood:analyzed', {
          userId,
          mood: moodAnalysis
        });
      }
    }, 5 * 60 * 1000); // Run every 5 minutes
    
    publish('emotional:empathy-core:initialized', {});
    return true;
  } catch (error) {
    console.error('Error initializing empathy core:', error);
    return false;
  }
}
