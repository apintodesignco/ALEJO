/**
 * ALEJO Natural Language Understanding Module
 * 
 * Provides local-first text analysis including:
 * - Intent recognition
 * - Entity extraction
 * - Sentiment analysis
 * - Subject extraction
 * - Key phrase identification
 * 
 * Follows ALEJO's core principles:
 * - Local-first: All processing happens on device
 * - Accessibility-first: Optimized for screen readers and assistive tech
 * - Resource-efficient: Adapts processing based on available resources
 * - Privacy-respecting: No data sent to external services
 */

import { EventBus } from '../../core/event-bus.js';
import { getCurrentResourceMode } from './performance-integration.js';
import { ResourceMode } from '../../performance/resource-manager.js';

// Simple intent patterns for local processing
const INTENT_PATTERNS = {
  GREETING: [
    /\b(hello|hi|hey|greetings|good morning|good afternoon|good evening)\b/i,
  ],
  FAREWELL: [
    /\b(goodbye|bye|see you|farewell|so long|till next time)\b/i,
  ],
  HELP: [
    /\b(help|assist|support|guide|how to|how do I)\b/i,
  ],
  INFORMATION: [
    /\b(what is|who is|tell me about|explain|describe|define|show me)\b/i,
  ],
  CONFIRMATION: [
    /\b(yes|yeah|yep|correct|right|sure|absolutely|indeed|okay|ok)\b/i,
  ],
  NEGATION: [
    /\b(no|nope|not|don't|do not|incorrect|wrong|negative)\b/i,
  ],
  THANKS: [
    /\b(thanks|thank you|appreciate it|grateful|thanking you)\b/i,
  ],
  PREFERENCES: [
    /\b(prefer|like|want|desire|wish|rather|instead)\b/i,
  ],
  QUESTION: [
    /\b(who|what|when|where|why|how|which|whose|whom|is it|are they|can you|will you|should I)\b.+\?$/i,
    /\?.+$/i
  ],
  COMMAND: [
    /^\b(set|change|modify|update|enable|disable|turn on|turn off|increase|decrease|open|close|start|stop|pause|resume)\b/i,
  ]
};

// Common entities to extract
const ENTITY_PATTERNS = {
  DATE_TIME: [
    /\b(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})\b/i, // MM/DD/YYYY
    /\b(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\b/i, // HH:MM:SS AM/PM
    /\b(today|tomorrow|yesterday|next week|last week|this morning|this evening)\b/i
  ],
  LOCATION: [
    /\b(north|south|east|west|left|right|up|down|above|below|behind|in front of|inside|outside)\b/i
  ],
  QUANTITY: [
    /\b(\d+(?:\.\d+)?)\s*(percent|kg|kilograms|g|grams|lb|pounds|cm|centimeters|mm|millimeters|m|meters|km|kilometers|feet|foot|inch|inches|mile|miles|gallon|gallons|liter|liters)\b/i
  ],
  PERSON_NAME: [
    /\b(Mr\.|Mrs\.|Ms\.|Dr\.|Prof\.)\s+([A-Z][a-z]+)\b/,
    /\b([A-Z][a-z]+)\s+([A-Z][a-z]+)\b/
  ],
  EMAIL: [
    /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/i
  ],
  PHONE: [
    /\b(\+?\d{1,3}[\s-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/
  ],
  URL: [
    /\b(https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*))/i,
    /\b(www\.[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*))/i
  ]
};

// Module state
let isInitialized = false;
const processingQueue = [];
let isProcessing = false;
let processingComplexity = 'medium'; // 'low', 'medium', 'high'

/**
 * Initialize the Natural Language Understanding module
 * @param {Object} options - Initialization options
 * @param {string} [options.complexity='medium'] - Initial processing complexity
 * @returns {Promise<boolean>} Initialization success
 */
export async function initialize(options = {}) {
  if (isInitialized) {
    console.warn('Natural Language Understanding module already initialized');
    return true;
  }

  console.log('Initializing ALEJO Natural Language Understanding module');

  try {
    // Set initial complexity based on options or resource mode
    processingComplexity = options.complexity || getComplexityForResourceMode();
    
    // Set up event listeners
    EventBus.subscribe('text:input', handleTextInput);

    isInitialized = true;
    return true;
  } catch (error) {
    console.error('Failed to initialize Natural Language Understanding module:', error);
    return false;
  }
}

/**
 * Shutdown the Natural Language Understanding module
 */
export async function shutdown() {
  if (!isInitialized) return;

  console.log('Shutting down ALEJO Natural Language Understanding module');

  // Unsubscribe from events
  EventBus.unsubscribe('text:input', handleTextInput);

  // Clear any pending processing
  processingQueue.length = 0;
  isProcessing = false;
  isInitialized = false;
}

/**
 * Process text input to extract intents, entities, and other information
 * @param {string} text - The text to process
 * @param {Object} [context] - Optional context for better understanding
 * @returns {Promise<Object>} Processing results
 */
export async function processText(text, context = {}) {
  if (!isInitialized) {
    throw new Error('Natural Language Understanding module not initialized');
  }

  if (!text || typeof text !== 'string') {
    throw new Error('Invalid text input');
  }

  // Add to processing queue
  return new Promise((resolve, reject) => {
    processingQueue.push({
      text,
      context,
      resolve,
      reject
    });

    // Start processing if not already in progress
    if (!isProcessing) {
      processNextInQueue();
    }
  });
}

/**
 * Process the next item in the queue
 * @private
 */
async function processNextInQueue() {
  if (processingQueue.length === 0) {
    isProcessing = false;
    return;
  }

  isProcessing = true;
  const item = processingQueue.shift();

  try {
    // Perform the text analysis
    const result = await analyzeText(item.text, item.context);
    item.resolve(result);
  } catch (error) {
    item.reject(error);
  } finally {
    // Process the next item
    processNextInQueue();
  }
}

/**
 * Analyze text to extract understanding
 * @private
 * @param {string} text - Text to analyze
 * @param {Object} context - Processing context
 * @returns {Promise<Object>} Analysis results
 */
async function analyzeText(text, context) {
  console.log(`Analyzing text with complexity: ${processingComplexity}`);

  // Start with basic analysis that's always performed
  const result = {
    originalText: text,
    normalizedText: normalizeText(text),
    timestamp: Date.now(),
    intents: [],
    entities: [],
    sentiment: null,
    keyPhrases: [],
    tokens: tokenizeText(text)
  };

  // Detect intents
  result.intents = detectIntents(result.normalizedText);
  
  // Extract entities
  result.entities = extractEntities(result.normalizedText);

  // Add advanced analysis based on complexity
  if (processingComplexity !== 'low') {
    // Add sentiment analysis
    result.sentiment = analyzeSentiment(result.normalizedText);

    // Extract key phrases (only in high complexity)
    if (processingComplexity === 'high') {
      result.keyPhrases = extractKeyPhrases(result.normalizedText);
    }
  }

  // Emit event with analysis results
  EventBus.publish('text:analyzed', {
    text: result.originalText,
    analysis: result
  });

  return result;
}

/**
 * Normalize text for processing
 * @private
 * @param {string} text - Text to normalize
 * @returns {string} Normalized text
 */
function normalizeText(text) {
  let normalized = text.trim();
  
  // Convert to lowercase for case-insensitive matching
  normalized = normalized.toLowerCase();
  
  // Remove extra whitespace
  normalized = normalized.replace(/\s+/g, ' ');
  
  // Remove punctuation for simpler matching
  // We preserve question marks and some basic punctuation
  normalized = normalized.replace(/[^\w\s\?\.,']/g, '');
  
  return normalized;
}

/**
 * Tokenize text into words and sentences
 * @private
 * @param {string} text - Text to tokenize
 * @returns {Object} Tokenization result
 */
function tokenizeText(text) {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const words = text.split(/\s+/);
  
  return {
    words,
    sentences,
    wordCount: words.length,
    sentenceCount: sentences.length
  };
}

/**
 * Detect intents in the text
 * @private
 * @param {string} text - Text to analyze
 * @returns {Array} Detected intents with confidence scores
 */
function detectIntents(text) {
  const detectedIntents = [];

  // Check each intent pattern
  Object.entries(INTENT_PATTERNS).forEach(([intent, patterns]) => {
    // Check each pattern for this intent
    patterns.forEach(pattern => {
      if (pattern.test(text)) {
        detectedIntents.push({
          intent,
          confidence: 0.8, // Static confidence for now
          pattern: pattern.toString()
        });
      }
    });
  });

  // Sort by confidence (highest first)
  detectedIntents.sort((a, b) => b.confidence - a.confidence);
  
  return detectedIntents;
}

/**
 * Extract entities from the text
 * @private
 * @param {string} text - Text to analyze
 * @returns {Array} Extracted entities
 */
function extractEntities(text) {
  const entities = [];

  // Extract entities from patterns
  Object.entries(ENTITY_PATTERNS).forEach(([entityType, patterns]) => {
    patterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          if (match !== matches[0]) { // Skip the full match
            entities.push({
              type: entityType,
              value: match,
              text: match,
              confidence: 0.75 // Static confidence for now
            });
          }
        });
      }
    });
  });

  return entities;
}

/**
 * Simple sentiment analysis
 * @private
 * @param {string} text - Text to analyze
 * @returns {Object} Sentiment analysis result
 */
function analyzeSentiment(text) {
  // Very simple positive/negative word matching
  // In a real implementation, this would use a more sophisticated approach
  const positiveWords = [
    'good', 'great', 'excellent', 'wonderful', 'fantastic', 'amazing', 
    'awesome', 'happy', 'glad', 'love', 'like', 'enjoy', 'pleased',
    'thank', 'thanks', 'appreciate', 'helpful', 'impressive'
  ];
  
  const negativeWords = [
    'bad', 'terrible', 'awful', 'horrible', 'poor', 'sad', 'angry',
    'upset', 'hate', 'dislike', 'disappointed', 'disappointing',
    'unfortunate', 'sorry', 'fail', 'failed', 'problem', 'issue'
  ];
  
  // Count positive and negative words
  let positiveCount = 0;
  let negativeCount = 0;
  
  const words = text.toLowerCase().split(/\s+/);
  
  words.forEach(word => {
    // Remove punctuation
    const cleanWord = word.replace(/[^\w]/g, '');
    
    if (positiveWords.includes(cleanWord)) {
      positiveCount++;
    } else if (negativeWords.includes(cleanWord)) {
      negativeCount++;
    }
  });
  
  // Calculate sentiment score (-1 to 1)
  let score = 0;
  if (positiveCount > 0 || negativeCount > 0) {
    score = (positiveCount - negativeCount) / (positiveCount + negativeCount);
  }
  
  // Determine sentiment label
  let label = 'neutral';
  if (score > 0.2) {
    label = 'positive';
  } else if (score < -0.2) {
    label = 'negative';
  }
  
  return {
    score,
    label,
    positiveCount,
    negativeCount
  };
}

/**
 * Extract key phrases from text
 * @private
 * @param {string} text - Text to analyze
 * @returns {Array} Extracted key phrases
 */
function extractKeyPhrases(text) {
  // Simple extraction of noun phrases
  // In a real implementation, this would be more sophisticated
  const keyPhrases = [];
  
  // Split into sentences
  const sentences = text.split(/[.!?]+/);
  
  sentences.forEach(sentence => {
    if (sentence.trim().length === 0) return;
    
    // Very simple heuristic: look for "important" phrases
    const words = sentence.trim().split(/\s+/);
    
    // Find noun phrases (adjective + noun patterns)
    // This is a very simplistic approach
    for (let i = 0; i < words.length - 1; i++) {
      const phrase = words[i] + ' ' + words[i + 1];
      if (phrase.length > 5 && !/^(the|and|but|or|if|when|how|what|why|where)\s/i.test(phrase)) {
        keyPhrases.push(phrase);
      }
    }
    
    // Add longer phrases (3 words)
    for (let i = 0; i < words.length - 2; i++) {
      const phrase = words[i] + ' ' + words[i + 1] + ' ' + words[i + 2];
      if (phrase.length > 10 && !/^(the|and|but|or|if|when|how|what|why|where)\s/i.test(phrase)) {
        keyPhrases.push(phrase);
      }
    }
  });
  
  // Remove duplicates
  const uniquePhrases = [...new Set(keyPhrases)];
  
  // Return top phrases (limit to 5)
  return uniquePhrases.slice(0, 5);
}

/**
 * Get appropriate complexity level based on resource mode
 * @private
 * @returns {string} Complexity level
 */
function getComplexityForResourceMode() {
  const resourceMode = getCurrentResourceMode();
  
  switch (resourceMode) {
    case ResourceMode.LOW:
    case ResourceMode.CRITICAL:
      return 'low';
    case ResourceMode.NORMAL:
      return 'medium';
    case ResourceMode.HIGH:
      return 'high';
    default:
      return 'medium';
  }
}

/**
 * Update the processing complexity
 * @param {string} complexity - New complexity ('low', 'medium', 'high')
 */
export function setProcessingComplexity(complexity) {
  if (!['low', 'medium', 'high'].includes(complexity)) {
    throw new Error('Invalid complexity level. Must be low, medium, or high');
  }
  
  processingComplexity = complexity;
  console.log(`NLU processing complexity set to: ${complexity}`);
}

/**
 * Event handler for text input
 * @private
 * @param {Object} data - Event data
 */
function handleTextInput(data) {
  if (!data || !data.text) return;
  
  // Process the text
  processText(data.text, data.context)
    .then(result => {
      // No additional handling needed here as we publish events during processing
      console.log('Text processed successfully');
    })
    .catch(error => {
      console.error('Error processing text:', error);
    });
}
