/**
 * adaptor.js
 * Adjusts ALEJO's responses based on user communication patterns.
 * 
 * Features:
 * - Adapts responses to match user's communication style dimensions
 * - Context-aware adaptation based on conversation topics
 * - Personalized vocabulary selection based on user preferences
 * - Progressive adaptation that evolves with the user over time
 * - Maintains authenticity while adapting to user style
 */
import { subscribe, publish } from '../../core/events.js';
import { getPatterns, getStyleMetrics, getFrequentWords, getDistinctiveWords } from './pattern-learner.js';
import * as auditTrail from '../../security/audit-trail.js';

// Adaptation strength - how strongly to adapt to user's style (0-1)
const DEFAULT_ADAPTATION_STRENGTH = 0.7;

// Cache for user adaptation settings
const userAdaptationSettings = new Map();

/**
 * Generate an adaptive response style for a user.
 * @param {string} userId - User identifier
 * @param {string} response - Original response
 * @param {Object} context - Optional context information
 * @returns {Promise<string>} Styled response
 */
async function adaptResponse(userId, response, context = {}) {
  try {
    // Get user's communication patterns and style metrics
    const { patterns, styleMetrics } = await getPatterns(userId);
    if (!patterns || Object.keys(patterns).length === 0) {
      return response; // Not enough data to adapt yet
    }
    
    // Get user adaptation settings or use defaults
    const settings = getUserAdaptationSettings(userId);
    
    // Apply adaptations based on style dimensions
    let adaptedResponse = response;
    
    // Apply formality adaptation
    adaptedResponse = adaptFormality(adaptedResponse, styleMetrics.formality, settings.adaptationStrength);
    
    // Apply verbosity adaptation
    adaptedResponse = adaptVerbosity(adaptedResponse, styleMetrics.verbosity, settings.adaptationStrength);
    
    // Apply emotional tone adaptation
    adaptedResponse = adaptEmotionality(adaptedResponse, styleMetrics.emotionality, settings.adaptationStrength);
    
    // Apply complexity adaptation
    adaptedResponse = adaptComplexity(adaptedResponse, styleMetrics.complexity, settings.adaptationStrength);
    
    // Apply directness adaptation
    adaptedResponse = adaptDirectness(adaptedResponse, styleMetrics.directness, settings.adaptationStrength);
    
    // Apply politeness adaptation
    adaptedResponse = adaptPoliteness(adaptedResponse, styleMetrics.politeness, settings.adaptationStrength);
    
    // Apply humor adaptation
    adaptedResponse = adaptHumor(adaptedResponse, styleMetrics.humor, settings.adaptationStrength);
    
    // Apply question frequency adaptation
    adaptedResponse = adaptQuestionFrequency(adaptedResponse, styleMetrics.questionFrequency, settings.adaptationStrength);
    
    // Apply vocabulary personalization if enabled
    if (settings.usePersonalizedVocabulary) {
      adaptedResponse = await personalizeVocabulary(adaptedResponse, userId, settings.adaptationStrength);
    }
    
    // Log the adaptation for audit purposes
    auditTrail.log('behavior:adaptation', {
      userId,
      originalLength: response.length,
      adaptedLength: adaptedResponse.length,
      styleMetrics: { ...styleMetrics },
      context: { ...context }
    });
    
    return adaptedResponse;
  } catch (error) {
    console.error('Error adapting response:', error);
    auditTrail.log('behavior:adaptation:error', { userId, error: error.message });
    return response; // Return original response if adaptation fails
  }
}

/**
 * Adapt response formality level.
 * @param {string} response - Original response
 * @param {number} formalityLevel - User's formality level (0-1)
 * @param {number} strength - Adaptation strength
 * @returns {string} Adapted response
 */
function adaptFormality(response, formalityLevel, strength) {
  // Skip minimal adaptation
  if (Math.abs(formalityLevel - 0.5) < 0.15) return response;
  
  if (formalityLevel > 0.7) {
    // More formal style
    response = response
      .replace(/gonna/g, 'going to')
      .replace(/wanna/g, 'want to')
      .replace(/yeah/g, 'yes')
      .replace(/nope/g, 'no')
      .replace(/kinda/g, 'somewhat')
      .replace(/sorta/g, 'somewhat');
      
    // Add formal phrases based on strength
    if (strength > 0.6 && !response.includes('I would like to')) {
      response = response.replace(/I want to/g, 'I would like to');
    }
  } else if (formalityLevel < 0.3) {
    // More casual style
    response = response
      .replace(/I am/g, "I'm")
      .replace(/you are/g, "you're")
      .replace(/they are/g, "they're")
      .replace(/we are/g, "we're")
      .replace(/is not/g, "isn't")
      .replace(/are not/g, "aren't");
      
    // Add casual phrases based on strength
    if (strength > 0.6 && !response.includes('cool') && response.length > 20) {
      if (Math.random() < 0.3) {
        response = response.replace(/\. /g, '. Cool, ');
      }
    }
  }
  
  return response;
}

/**
 * Adapt response verbosity.
 * @param {string} response - Original response
 * @param {number} verbosityLevel - User's verbosity level (0-1)
 * @param {number} strength - Adaptation strength
 * @returns {string} Adapted response
 */
function adaptVerbosity(response, verbosityLevel, strength) {
  // Skip minimal adaptation
  if (Math.abs(verbosityLevel - 0.5) < 0.15) return response;
  
  const sentences = response.split(/(?<=[.!?])\s+/);
  
  if (verbosityLevel > 0.7 && sentences.length > 1) {
    // More verbose style - add elaborations or examples
    const elaborations = [
      "To elaborate a bit more, ",
      "In other words, ",
      "To put it another way, ",
      "What I mean is, ",
      "Specifically, "
    ];
    
    // Add elaboration to a random sentence
    const randomIndex = Math.floor(Math.random() * (sentences.length - 1)) + 1;
    if (sentences[randomIndex].length > 10) {
      sentences[randomIndex] = elaborations[Math.floor(Math.random() * elaborations.length)] + 
                              sentences[randomIndex].charAt(0).toLowerCase() + 
                              sentences[randomIndex].slice(1);
    }
    
    return sentences.join(' ');
  } else if (verbosityLevel < 0.3 && sentences.length > 2) {
    // More concise style - remove unnecessary sentences or phrases
    // Remove a random middle sentence if there are more than 2 sentences
    if (sentences.length > 2) {
      const randomIndex = Math.floor(Math.random() * (sentences.length - 2)) + 1;
      sentences.splice(randomIndex, 1);
    }
    
    return sentences.join(' ');
  }
  
  return response;
}

/**
 * Adapt response emotionality.
 * @param {string} response - Original response
 * @param {number} emotionalityLevel - User's emotionality level (0-1)
 * @param {number} strength - Adaptation strength
 * @returns {string} Adapted response
 */
function adaptEmotionality(response, emotionalityLevel, strength) {
  // Skip minimal adaptation
  if (Math.abs(emotionalityLevel - 0.5) < 0.15) return response;
  
  if (emotionalityLevel > 0.7) {
    // More emotional style - add emotional words and punctuation
    const emotionalEnhancers = [
      { pattern: /good/g, replacement: 'great' },
      { pattern: /nice/g, replacement: 'amazing' },
      { pattern: /bad/g, replacement: 'terrible' },
      { pattern: /happy/g, replacement: 'thrilled' },
      { pattern: /sad/g, replacement: 'heartbroken' }
    ];
    
    // Apply random emotional enhancers based on strength
    const enhancersToApply = Math.floor(emotionalEnhancers.length * strength);
    const shuffled = [...emotionalEnhancers].sort(() => 0.5 - Math.random());
    
    for (let i = 0; i < enhancersToApply; i++) {
      if (response.match(shuffled[i].pattern)) {
        response = response.replace(shuffled[i].pattern, shuffled[i].replacement);
      }
    }
    
    // Add exclamation points based on emotionality
    if (strength > 0.5) {
      response = response.replace(/\.(?=\s|$)/g, (match) => {
        return Math.random() < emotionalityLevel * strength ? '!' : '.';
      });
    }
  } else if (emotionalityLevel < 0.3) {
    // More neutral style - reduce emotional language
    const neutralizers = [
      { pattern: /amazing/g, replacement: 'good' },
      { pattern: /awesome/g, replacement: 'good' },
      { pattern: /excellent/g, replacement: 'good' },
      { pattern: /terrible/g, replacement: 'bad' },
      { pattern: /thrilled/g, replacement: 'pleased' },
      { pattern: /love/g, replacement: 'like' }
    ];
    
    // Apply neutralizers
    neutralizers.forEach(({ pattern, replacement }) => {
      response = response.replace(pattern, replacement);
    });
    
    // Replace exclamation points with periods
    response = response.replace(/!/g, '.');
  }
  
  return response;
}

/**
 * Adapt response complexity.
 * @param {string} response - Original response
 * @param {number} complexityLevel - User's complexity level (0-1)
 * @param {number} strength - Adaptation strength
 * @returns {string} Adapted response
 */
function adaptComplexity(response, complexityLevel, strength) {
  // Skip minimal adaptation
  if (Math.abs(complexityLevel - 0.5) < 0.15) return response;
  
  if (complexityLevel > 0.7) {
    // More complex style - use more sophisticated vocabulary
    const complexWords = [
      { simple: /use/g, complex: 'utilize' },
      { simple: /show/g, complex: 'demonstrate' },
      { simple: /make/g, complex: 'construct' },
      { simple: /think/g, complex: 'contemplate' },
      { simple: /help/g, complex: 'facilitate' },
      { simple: /start/g, complex: 'initiate' },
      { simple: /end/g, complex: 'conclude' }
    ];
    
    // Apply complex word replacements based on strength
    const wordsToReplace = Math.ceil(complexWords.length * strength * 0.5);
    const shuffled = [...complexWords].sort(() => 0.5 - Math.random());
    
    for (let i = 0; i < wordsToReplace; i++) {
      response = response.replace(shuffled[i].simple, shuffled[i].complex);
    }
  } else if (complexityLevel < 0.3) {
    // Simpler style - use more straightforward vocabulary
    const simpleWords = [
      { complex: /utilize/g, simple: 'use' },
      { complex: /demonstrate/g, simple: 'show' },
      { complex: /construct/g, simple: 'make' },
      { complex: /contemplate/g, simple: 'think' },
      { complex: /facilitate/g, simple: 'help' },
      { complex: /initiate/g, simple: 'start' },
      { complex: /conclude/g, simple: 'end' },
      { complex: /subsequently/g, simple: 'then' },
      { complex: /nevertheless/g, simple: 'still' },
      { complex: /furthermore/g, simple: 'also' }
    ];
    
    // Apply simple word replacements
    simpleWords.forEach(({ complex, simple }) => {
      response = response.replace(complex, simple);
    });
    
    // Break up long sentences
    if (strength > 0.6) {
      response = response.replace(/([^.!?]+, [^.!?]+, [^.!?]+)([,.] )/g, '$1. ');
    }
  }
  
  return response;
}

/**
 * Adapt response directness.
 * @param {string} response - Original response
 * @param {number} directnessLevel - User's directness level (0-1)
 * @param {number} strength - Adaptation strength
 * @returns {string} Adapted response
 */
function adaptDirectness(response, directnessLevel, strength) {
  // Skip minimal adaptation
  if (Math.abs(directnessLevel - 0.5) < 0.15) return response;
  
  if (directnessLevel > 0.7) {
    // More direct style
    const indirectPhrases = [
      /I think that /g,
      /It seems that /g,
      /Perhaps /g,
      /Maybe /g,
      /It could be that /g,
      /In my opinion, /g
    ];
    
    // Remove indirect phrases
    indirectPhrases.forEach(phrase => {
      response = response.replace(phrase, '');
    });
    
    // Ensure response starts with key information
    if (strength > 0.7 && response.startsWith('Well, ')) {
      response = response.replace(/^Well, /, '');
    }
  } else if (directnessLevel < 0.3) {
    // More indirect style
    const sentences = response.split(/(?<=[.!?])\s+/);
    
    if (sentences.length > 0) {
      const indirectPhrases = [
        'I think that ',
        'It seems that ',
        'Perhaps ',
        'It appears that '
      ];
      
      // Add indirect phrase to first sentence if it doesn't already have one
      const firstSentence = sentences[0];
      if (!indirectPhrases.some(phrase => firstSentence.includes(phrase))) {
        const randomPhrase = indirectPhrases[Math.floor(Math.random() * indirectPhrases.length)];
        sentences[0] = randomPhrase + firstSentence.charAt(0).toLowerCase() + firstSentence.slice(1);
      }
      
      response = sentences.join(' ');
    }
  }
  
  return response;
}

/**
 * Adapt response politeness.
 * @param {string} response - Original response
 * @param {number} politenessLevel - User's politeness level (0-1)
 * @param {number} strength - Adaptation strength
 * @returns {string} Adapted response
 */
function adaptPoliteness(response, politenessLevel, strength) {
  // Skip minimal adaptation
  if (Math.abs(politenessLevel - 0.5) < 0.15) return response;
  
  if (politenessLevel > 0.7) {
    // More polite style
    const politeEnhancers = [
      { pattern: /(?<!please )(?:can|could) you/gi, replacement: 'please $&' },
      { pattern: /(?<!thank you)$/i, replacement: ' Thank you.' },
      { pattern: /I need/gi, replacement: 'I would appreciate' },
      { pattern: /you should/gi, replacement: 'you might consider' }
    ];
    
    // Apply polite enhancers based on strength
    const enhancersToApply = Math.ceil(politeEnhancers.length * strength * 0.7);
    const shuffled = [...politeEnhancers].sort(() => 0.5 - Math.random());
    
    for (let i = 0; i < enhancersToApply; i++) {
      if (response.match(shuffled[i].pattern)) {
        response = response.replace(shuffled[i].pattern, shuffled[i].replacement);
      }
    }
  } else if (politenessLevel < 0.3) {
    // More direct/less polite style
    response = response
      .replace(/please /gi, '')
      .replace(/would you mind/gi, 'can you')
      .replace(/I would appreciate/gi, 'I need')
      .replace(/you might consider/gi, 'you should')
      .replace(/thank you\.?$/i, '');
  }
  
  return response;
}

/**
 * Adapt response humor level.
 * @param {string} response - Original response
 * @param {number} humorLevel - User's humor level (0-1)
 * @param {number} strength - Adaptation strength
 * @returns {string} Adapted response
 */
function adaptHumor(response, humorLevel, strength) {
  // Skip minimal adaptation
  if (Math.abs(humorLevel - 0.5) < 0.15) return response;
  
  if (humorLevel > 0.7 && strength > 0.5) {
    // More humorous style - add light humor where appropriate
    const humorousAdditions = [
      ' (No coding pun intended!)',
      ' High five to that!',
      ' That\'s what she said... about good code.',
      ' *virtual drumroll*',
      ' *insert witty developer joke here*'
    ];
    
    // Only add humor if response is positive and not too short
    if (response.length > 50 && 
        !response.includes('error') && 
        !response.includes('fail') && 
        !response.includes('problem') && 
        Math.random() < strength * 0.7) {
      
      const randomHumor = humorousAdditions[Math.floor(Math.random() * humorousAdditions.length)];
      
      // Find a good spot to insert humor (end of a sentence)
      const sentences = response.split(/(?<=[.!?])\s+/);
      if (sentences.length > 1) {
        const insertPosition = Math.floor(sentences.length * 0.7); // Towards the end
        sentences[insertPosition] = sentences[insertPosition].trim() + randomHumor + ' ';
        response = sentences.join(' ');
      }
    }
  }
  
  return response;
}

/**
 * Adapt question frequency in response.
 * @param {string} response - Original response
 * @param {number} questionFrequency - User's question frequency level (0-1)
 * @param {number} strength - Adaptation strength
 * @returns {string} Adapted response
 */
function adaptQuestionFrequency(response, questionFrequency, strength) {
  // Skip minimal adaptation
  if (Math.abs(questionFrequency - 0.5) < 0.15) return response;
  
  const sentences = response.split(/(?<=[.!?])\s+/);
  const questionCount = (response.match(/\?/g) || []).length;
  
  if (questionFrequency > 0.7 && questionCount === 0 && sentences.length > 1) {
    // Add a question if user tends to ask questions
    const engagingQuestions = [
      'Does that make sense?',
      'What do you think about that?',
      'Would you like me to elaborate on any part?',
      'Is that what you were looking for?',
      'How does that sound to you?'
    ];
    
    const randomQuestion = engagingQuestions[Math.floor(Math.random() * engagingQuestions.length)];
    
    // Add question at the end if strength is high enough
    if (Math.random() < strength * 0.8) {
      response = response + ' ' + randomQuestion;
    }
  } else if (questionFrequency < 0.3 && questionCount > 0) {
    // Remove some questions if user doesn't use many questions
    const questionsToRemove = Math.floor(questionCount * strength * 0.7);
    
    for (let i = 0; i < questionsToRemove; i++) {
      // Replace a question with a statement
      response = response.replace(/([^.!?]+)\?/i, (match, p1) => {
        return p1 + '.';
      });
    }
  }
  
  return response;
}

/**
 * Personalize vocabulary based on user's frequently used words.
 * @param {string} response - Original response
 * @param {string} userId - User identifier
 * @param {number} strength - Adaptation strength
 * @returns {Promise<string>} Response with personalized vocabulary
 */
async function personalizeVocabulary(response, userId, strength) {
  try {
    // Get user's distinctive words
    const distinctiveWords = await getDistinctiveWords(userId, 10);
    if (!distinctiveWords || distinctiveWords.length === 0) {
      return response;
    }
    
    // Only apply if we have enough distinctive words and strength is sufficient
    if (distinctiveWords.length >= 3 && strength > 0.4) {
      // Select a few distinctive words to potentially incorporate
      const wordsToUse = distinctiveWords
        .filter(word => word.length > 3 && !response.includes(word))
        .slice(0, 3);
      
      if (wordsToUse.length > 0) {
        // Choose one word to incorporate based on strength
        if (Math.random() < strength * 0.6) {
          const chosenWord = wordsToUse[Math.floor(Math.random() * wordsToUse.length)];
          
          // Find suitable replacements based on word type/meaning
          // This is a simplified approach - in a real system, you'd use NLP to find synonyms
          const commonWords = [
            { word: 'good', replacements: ['great', 'nice', 'excellent'] },
            { word: 'bad', replacements: ['poor', 'problematic', 'negative'] },
            { word: 'interesting', replacements: ['fascinating', 'intriguing', 'compelling'] },
            { word: 'important', replacements: ['crucial', 'essential', 'vital'] }
          ];
          
          // Try to find a common word to replace with the distinctive word
          for (const { word, replacements } of commonWords) {
            if (replacements.includes(chosenWord) && response.includes(word)) {
              return response.replace(new RegExp(word, 'i'), chosenWord);
            }
          }
          
          // If no direct replacement found, try to add it naturally in a sentence
          const sentences = response.split(/(?<=[.!?])\s+/);
          if (sentences.length > 1) {
            const randomIndex = Math.floor(Math.random() * sentences.length);
            if (sentences[randomIndex].length > 15) {
              // Add the word as an adjective or adverb where it might fit
              sentences[randomIndex] = sentences[randomIndex].replace(
                /\b(is|was|are|were|seems|appears|looks)\b/i,
                `$1 ${chosenWord}`
              );
              return sentences.join(' ');
            }
          }
        }
      }
    }
    
    return response;
  } catch (error) {
    console.error('Error personalizing vocabulary:', error);
    return response;
  }
}

/**
 * Get user adaptation settings.
 * @param {string} userId - User identifier
 * @returns {Object} User adaptation settings
 */
function getUserAdaptationSettings(userId) {
  if (!userAdaptationSettings.has(userId)) {
    // Default settings
    userAdaptationSettings.set(userId, {
      adaptationStrength: DEFAULT_ADAPTATION_STRENGTH,
      usePersonalizedVocabulary: true,
      adaptToContext: true
    });
  }
  
  return userAdaptationSettings.get(userId);
}

/**
 * Update user adaptation settings.
 * @param {string} userId - User identifier
 * @param {Object} settings - New settings
 * @returns {Object} Updated settings
 */
export function updateAdaptationSettings(userId, settings = {}) {
  const currentSettings = getUserAdaptationSettings(userId);
  const updatedSettings = { ...currentSettings, ...settings };
  
  // Validate settings
  if (typeof updatedSettings.adaptationStrength === 'number') {
    updatedSettings.adaptationStrength = Math.max(0, Math.min(1, updatedSettings.adaptationStrength));
  }
  
  userAdaptationSettings.set(userId, updatedSettings);
  publish('behavior:adaptor:settings:updated', { userId, settings: updatedSettings });
  
  return updatedSettings;
}

/**
 * Initialize the adaptor by subscribing to conversation events.
 * @returns {Promise<boolean>} Success status
 */
export async function initialize() {
  try {
    // Subscribe to conversation response events
    subscribe('conversation:response', async ({ userId, response, context }) => {
      const adapted = await adaptResponse(userId, response, context);
      publish('conversation:response:adapted', { userId, response: adapted, context });
    });
    
    // Subscribe to user feedback events to adjust adaptation settings
    subscribe('user:feedback', ({ userId, feedback }) => {
      if (feedback.adaptationTooStrong) {
        updateAdaptationSettings(userId, { 
          adaptationStrength: Math.max(0.1, getUserAdaptationSettings(userId).adaptationStrength - 0.1) 
        });
      } else if (feedback.adaptationTooWeak) {
        updateAdaptationSettings(userId, { 
          adaptationStrength: Math.min(1.0, getUserAdaptationSettings(userId).adaptationStrength + 0.1) 
        });
      }
    });
    
    // Subscribe to user preference updates
    subscribe('user:preferences:updated', ({ userId, preferences }) => {
      if (preferences.communication && preferences.communication.adaptationSettings) {
        updateAdaptationSettings(userId, preferences.communication.adaptationSettings);
      }
    });
    
    publish('behavior:adaptor:initialized', {});
    return true;
  } catch (error) {
    console.error('Error initializing adaptor:', error);
    return false;
  }
}
