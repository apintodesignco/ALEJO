/**
 * ALEJO Response Generator
 * 
 * Generates context-aware text responses based on NLU analysis and conversation context.
 * Features:
 * - Intent-based response generation
 * - Context-aware responses that maintain conversation continuity
 * - Response templates with variable substitution
 * - Accessibility considerations in responses
 * - Adaptive response complexity based on resource availability
 * 
 * Follows ALEJO's core principles:
 * - Local-first: All response generation happens on device
 * - Privacy-respecting: No user data sent to external services
 * - Resource-efficient: Adapts complexity based on available resources
 * - Accessibility-first: Generates screen reader friendly responses
 */

import { EventBus } from '../../core/event-bus.js';
import { getCurrentResourceMode } from './performance-integration.js';
import { ResourceMode } from '../../performance/resource-manager.js';
import * as ConversationContext from './conversation-context.js';

// Module state
let isInitialized = false;
let responseComplexity = 'medium'; // 'low', 'medium', 'high'

// Response templates organized by intent
const RESPONSE_TEMPLATES = {
  GREETING: [
    'Hello! How can I help you today?',
    'Hi there! What can I do for you?',
    'Greetings! How may I assist you?',
    'Hello! I\'m here to help. What do you need?'
  ],
  FAREWELL: [
    'Goodbye! Have a great day!',
    'See you later! Feel free to return if you need anything.',
    'Take care! I\'ll be here if you need me again.',
    'Goodbye! It was nice assisting you.'
  ],
  HELP: [
    'I can help with a variety of tasks. What specifically do you need assistance with?',
    'I\'m here to help! Could you tell me more about what you need?',
    'How can I assist you today? I can help with navigation, information, and more.',
    'I\'m ready to help. What would you like me to do?'
  ],
  INFORMATION: [
    'Let me provide that information for you.',
    'Here\'s what I know about that:',
    'I can tell you the following about that:',
    'Here\'s some information that might help:'
  ],
  CONFIRMATION: [
    'Great! I\'ll proceed with that.',
    'Excellent! Moving forward with your request.',
    'Perfect! I\'ll take care of that for you.',
    'Understood. I\'ll continue with this task.'
  ],
  NEGATION: [
    'I understand. Let\'s try something else.',
    'No problem. What would you prefer instead?',
    'Alright, let\'s change course. What would you like to do?',
    'I see. Let me know what you would like to do instead.'
  ],
  THANKS: [
    'You\'re welcome! Is there anything else I can help with?',
    'Happy to help! Let me know if you need anything else.',
    'Glad I could assist! Is there anything else you\'d like to know?',
    'My pleasure! Feel free to ask if you need more assistance.'
  ],
  PREFERENCES: [
    'I\'ll remember your preference.',
    'Got it. I\'ve noted your preference.',
    'I\'ll keep that in mind for future interactions.',
    'Understood. I\'ve updated your preferences.'
  ],
  QUESTION: [
    'That\'s a good question. Let me find the answer for you.',
    'I\'ll look into that for you.',
    'Let me check and get back to you on that.',
    'Good question. Here\'s what I can tell you:'
  ],
  COMMAND: [
    'I\'ll do that right away.',
    'Working on it now.',
    'Processing your request.',
    'I\'ll take care of that for you.'
  ],
  DEFAULT: [
    'I understand. How can I help with that?',
    'I see. What would you like me to do next?',
    'I'm following. How would you like to proceed?',
    'Understood. What else would you like to know?'
  ]
};

// Follow-up question templates to maintain conversation
const FOLLOW_UP_TEMPLATES = [
  'Is there anything else you\'d like to know about that?',
  'Would you like more information on this topic?',
  'Can I help you with anything related to this?',
  'Do you have any other questions?'
];

/**
 * Initialize the response generator
 * @param {Object} options - Initialization options
 * @param {string} [options.complexity='medium'] - Initial response complexity
 * @returns {Promise<boolean>} Initialization success
 */
export async function initialize(options = {}) {
  if (isInitialized) {
    console.warn('Response generator already initialized');
    return true;
  }

  console.log('Initializing ALEJO Response Generator');

  try {
    // Set initial complexity based on options or resource mode
    responseComplexity = options.complexity || getComplexityForResourceMode();
    
    // Set up event listeners
    EventBus.subscribe('text:analyzed', handleTextAnalyzed);
    
    isInitialized = true;
    return true;
  } catch (error) {
    console.error('Failed to initialize Response Generator:', error);
    return false;
  }
}

/**
 * Shutdown the response generator
 */
export async function shutdown() {
  if (!isInitialized) return;

  console.log('Shutting down ALEJO Response Generator');

  // Unsubscribe from events
  EventBus.unsubscribe('text:analyzed', handleTextAnalyzed);
  isInitialized = false;
}

/**
 * Generate a response based on analysis and context
 * @param {Object} analysis - Text analysis results
 * @param {Object} [context] - Conversation context
 * @returns {Promise<Object>} Generated response
 */
export async function generateResponse(analysis, context = null) {
  if (!isInitialized) {
    throw new Error('Response generator not initialized');
  }

  if (!analysis) {
    throw new Error('Analysis is required for response generation');
  }

  // Get current context if not provided
  const conversationContext = context || ConversationContext.getCurrentContext();

  try {
    // Generate response based on intent and context
    const response = await buildResponse(analysis, conversationContext);
    
    // Add to conversation history if context is available
    if (conversationContext) {
      ConversationContext.addMessage({
        text: response.text,
        role: 'system',
        timestamp: Date.now(),
        analysis: null
      });
    }

    // Emit event with generated response
    EventBus.publish('text:response:generated', {
      originalText: analysis.originalText,
      responseText: response.text,
      analysis,
      response
    });

    return response;
  } catch (error) {
    console.error('Failed to generate response:', error);
    
    // Return a fallback response
    return {
      text: "I'm sorry, I couldn't process that properly. Could you try again?",
      intent: null,
      confidence: 0,
      type: 'fallback'
    };
  }
}

/**
 * Build a response based on analysis and context
 * @private
 * @param {Object} analysis - Text analysis results
 * @param {Object} context - Conversation context
 * @returns {Promise<Object>} Built response
 */
async function buildResponse(analysis, context) {
  // Determine the primary intent
  const primaryIntent = getPrimaryIntent(analysis);
  
  // Get base response template for intent
  const responseTemplate = getResponseTemplate(primaryIntent);
  
  // Build base response
  let responseText = responseTemplate;
  
  // Add context-specific information if available
  if (context && responseComplexity !== 'low') {
    responseText = enhanceWithContext(responseText, analysis, context);
  }
  
  // Add entities if any were extracted
  if (analysis.entities && analysis.entities.length > 0 && responseComplexity !== 'low') {
    responseText = incorporateEntities(responseText, analysis.entities);
  }

  // For medium and high complexity, add follow-ups when appropriate
  if (responseComplexity !== 'low' && shouldAddFollowUp(primaryIntent)) {
    responseText = addFollowUp(responseText);
  }
  
  // For high complexity, make responses more varied and detailed
  if (responseComplexity === 'high') {
    responseText = enhanceResponseDetail(responseText, analysis, context);
  }

  return {
    text: responseText,
    intent: primaryIntent,
    confidence: analysis.intents.length > 0 ? analysis.intents[0].confidence : 0.5,
    type: 'generated',
    timestamp: Date.now()
  };
}

/**
 * Get the primary intent from analysis
 * @private
 * @param {Object} analysis - Text analysis
 * @returns {string} Primary intent or 'DEFAULT'
 */
function getPrimaryIntent(analysis) {
  if (!analysis.intents || analysis.intents.length === 0) {
    return 'DEFAULT';
  }
  
  return analysis.intents[0].intent;
}

/**
 * Get a response template for a given intent
 * @private
 * @param {string} intent - Intent to get template for
 * @returns {string} Response template
 */
function getResponseTemplate(intent) {
  // Check if we have templates for this intent
  if (!RESPONSE_TEMPLATES[intent]) {
    intent = 'DEFAULT';
  }
  
  // Get templates for intent
  const templates = RESPONSE_TEMPLATES[intent];
  
  // Choose a random template
  const index = Math.floor(Math.random() * templates.length);
  return templates[index];
}

/**
 * Enhance response with conversation context
 * @private
 * @param {string} response - Base response text
 * @param {Object} analysis - Text analysis
 * @param {Object} context - Conversation context
 * @returns {string} Enhanced response
 */
function enhanceWithContext(response, analysis, context) {
  let enhancedResponse = response;
  
  // Reference previous topics or entities if relevant
  if (context.currentTopic && Math.random() > 0.5) {
    enhancedResponse += ` Regarding ${context.currentTopic}, `;
  }

  // Reference conversation history for continuity
  if (context.history.length >= 3) {
    // Get the previous exchange
    const lastUserMessage = context.history[context.history.length - 1];
    const lastSystemMessage = context.history[context.history.length - 2];
    
    // If this seems to be a follow-up to previous exchange
    if (lastSystemMessage && lastUserMessage && 
        lastUserMessage.text.length < 15 && 
        !lastUserMessage.text.endsWith('?')) {
      enhancedResponse = enhancedResponse.replace(
        /^(I'll|Let me|I can|I'm)/i, 
        "As I mentioned, I'll"
      );
    }
  }

  return enhancedResponse;
}

/**
 * Incorporate entities into the response
 * @private
 * @param {string} response - Base response text
 * @param {Array} entities - Extracted entities
 * @returns {string} Enhanced response
 */
function incorporateEntities(response, entities) {
  let enhancedResponse = response;
  
  // Only use the most relevant entity
  if (entities.length > 0) {
    const entity = entities[0];
    
    // Different response based on entity type
    switch (entity.type) {
      case 'PERSON_NAME':
        if (!enhancedResponse.includes(entity.value)) {
          enhancedResponse += ` I see you mentioned ${entity.value}.`;
        }
        break;
        
      case 'LOCATION':
        if (!enhancedResponse.includes(entity.value)) {
          enhancedResponse += ` About ${entity.value},`;
        }
        break;
        
      case 'DATE_TIME':
        if (!enhancedResponse.includes(entity.value)) {
          enhancedResponse += ` For ${entity.value},`;
        }
        break;
    }
  }
  
  return enhancedResponse;
}

/**
 * Determine if a follow-up should be added
 * @private
 * @param {string} intent - Primary intent
 * @returns {boolean} Whether to add a follow-up
 */
function shouldAddFollowUp(intent) {
  // Add follow-up questions for these intents
  const followUpIntents = ['INFORMATION', 'HELP', 'GREETING'];
  
  // Add follow-ups ~50% of the time for these intents
  if (followUpIntents.includes(intent)) {
    return Math.random() > 0.5;
  }
  
  // Add follow-ups ~20% of the time for other intents
  return Math.random() > 0.8;
}

/**
 * Add a follow-up question to the response
 * @private
 * @param {string} response - Base response
 * @returns {string} Response with follow-up
 */
function addFollowUp(response) {
  // Choose a random follow-up template
  const index = Math.floor(Math.random() * FOLLOW_UP_TEMPLATES.length);
  const followUp = FOLLOW_UP_TEMPLATES[index];
  
  return `${response} ${followUp}`;
}

/**
 * Enhance response detail for high complexity mode
 * @private
 * @param {string} response - Base response
 * @param {Object} analysis - Text analysis
 * @param {Object} context - Conversation context
 * @returns {string} Enhanced response
 */
function enhanceResponseDetail(response, analysis, context) {
  let enhancedResponse = response;
  
  // Add greeting with time awareness
  if (isPrimaryIntent(analysis, 'GREETING')) {
    const hour = new Date().getHours();
    let timeGreeting = '';
    
    if (hour < 12) {
      timeGreeting = 'Good morning! ';
    } else if (hour < 17) {
      timeGreeting = 'Good afternoon! ';
    } else {
      timeGreeting = 'Good evening! ';
    }
    
    if (!enhancedResponse.includes('morning') && 
        !enhancedResponse.includes('afternoon') && 
        !enhancedResponse.includes('evening')) {
      enhancedResponse = timeGreeting + enhancedResponse;
    }
  }
  
  // Add continuity phrases when conversation is ongoing
  if (context && context.turnCount > 3) {
    // Connect with previous exchanges
    const continuityPhrases = [
      'To continue our conversation, ',
      'Following up on what we were discussing, ',
      'Based on what you\'ve told me, '
    ];
    
    // Add to beginning of response occasionally
    if (Math.random() > 0.7) {
      const phrase = continuityPhrases[Math.floor(Math.random() * continuityPhrases.length)];
      enhancedResponse = phrase + enhancedResponse.charAt(0).toLowerCase() + enhancedResponse.slice(1);
    }
  }
  
  return enhancedResponse;
}

/**
 * Check if an intent is the primary intent
 * @private
 * @param {Object} analysis - Text analysis
 * @param {string} intent - Intent to check
 * @returns {boolean} True if it's the primary intent
 */
function isPrimaryIntent(analysis, intent) {
  return analysis.intents && 
         analysis.intents.length > 0 && 
         analysis.intents[0].intent === intent;
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
 * Handle text analyzed event
 * @private
 * @param {Object} data - Event data
 */
async function handleTextAnalyzed(data) {
  if (!data || !data.text || !data.analysis) return;
  
  // Generate response
  try {
    await generateResponse(data.analysis);
  } catch (error) {
    console.error('Error generating response:', error);
  }
}

/**
 * Update the response complexity
 * @param {string} complexity - New complexity ('low', 'medium', 'high')
 */
export function setResponseComplexity(complexity) {
  if (!['low', 'medium', 'high'].includes(complexity)) {
    throw new Error('Invalid complexity level. Must be low, medium, or high');
  }
  
  responseComplexity = complexity;
  console.log(`Response generation complexity set to: ${complexity}`);
}
