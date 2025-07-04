/**
 * ALEJO Fallacy Detector
 * 
 * This module detects common logical fallacies in reasoning content to ensure
 * sound logical reasoning. It provides detailed analysis of potential fallacies
 * with explanations and confidence scores.
 * 
 * Based on MIT Media Lab research (2025) on logical fallacy detection in AI systems.
 */
import { publish } from '../../core/events.js';

// Fallacy categories
const FALLACY_CATEGORY = {
  RELEVANCE: 'relevance',       // Fallacies related to irrelevant information
  PRESUMPTION: 'presumption',   // Fallacies based on unwarranted assumptions
  AMBIGUITY: 'ambiguity',       // Fallacies involving unclear language
  INDUCTION: 'induction',       // Fallacies in inductive reasoning
  DEDUCTION: 'deduction',       // Fallacies in deductive reasoning
  CAUSATION: 'causation',       // Fallacies in causal reasoning
  STATISTICS: 'statistics'      // Fallacies in statistical reasoning
};

// Comprehensive fallacy database with patterns, explanations, and examples
const FALLACIES = [
  // Relevance fallacies
  { 
    id: 'ad_hominem', 
    category: FALLACY_CATEGORY.RELEVANCE,
    patterns: [
      /\byou (are|were) a .*? therefore .*/i,
      /\bbecause (he|she|they) (is|are) .*? (he|she|they) .*/i,
      /\btheir character .*? (so|therefore) .*/i
    ],
    description: 'Ad Hominem', 
    explanation: 'Attacking the person instead of addressing their argument',
    example: 'You are biased, therefore your argument is invalid',
    severity: 0.8
  },
  { 
    id: 'appeal_to_authority', 
    category: FALLACY_CATEGORY.RELEVANCE,
    patterns: [
      /\b(expert|authority|professor|doctor) says .*/i,
      /\baccording to .*? we should .*/i,
      /\b(famous|respected|renowned) .*? believes .*/i
    ],
    description: 'Appeal to Authority', 
    explanation: 'Using an authority figure as evidence without addressing the argument itself',
    example: 'Professor Smith says this is true, so it must be correct',
    severity: 0.6
  },
  { 
    id: 'appeal_to_emotion', 
    category: FALLACY_CATEGORY.RELEVANCE,
    patterns: [
      /\bimagine how .*? would feel .*/i,
      /\bthink about the (sadness|pain|suffering|joy) .*/i,
      /\bhow would you feel if .*/i
    ],
    description: 'Appeal to Emotion', 
    explanation: 'Using emotional manipulation instead of logical reasoning',
    example: 'Think about how sad these children would be if you disagree',
    severity: 0.7
  },
  
  // Presumption fallacies
  { 
    id: 'begging_the_question', 
    category: FALLACY_CATEGORY.PRESUMPTION,
    patterns: [
      /\bis true because it is .*/i,
      /\bmust be .*? because it is .*/i,
      /\bis correct because it is .*/i
    ],
    description: 'Begging the Question', 
    explanation: 'Circular reasoning where the conclusion is assumed in the premise',
    example: 'This policy is effective because it works well',
    severity: 0.8
  },
  { 
    id: 'false_dilemma', 
    category: FALLACY_CATEGORY.PRESUMPTION,
    patterns: [
      /\beither .*? or .*/i,
      /\bonly two options .*/i,
      /\bonly choices are .*/i
    ],
    description: 'False Dilemma', 
    explanation: 'Presenting only two options when more exist',
    example: 'Either you support this policy or you don\'t care about people',
    severity: 0.7
  },
  { 
    id: 'strawman', 
    category: FALLACY_CATEGORY.PRESUMPTION,
    patterns: [
      /\bso you think .*/i,
      /\byou\'re saying that .*/i,
      /\byour position is that .*/i
    ],
    description: 'Strawman', 
    explanation: 'Misrepresenting someone\'s argument to make it easier to attack',
    example: 'So you think we should have no rules at all',
    severity: 0.8
  },
  
  // Causal fallacies
  { 
    id: 'post_hoc', 
    category: FALLACY_CATEGORY.CAUSATION,
    patterns: [
      /\bafter .*? happened, .*/i,
      /\bfollowing .*? then .*/i,
      /\bsince .*? occurred, .*/i
    ],
    description: 'Post Hoc Ergo Propter Hoc', 
    explanation: 'Assuming that because B followed A, A caused B',
    example: 'I took this medicine and then got better, so the medicine cured me',
    severity: 0.7
  },
  { 
    id: 'slippery_slope', 
    category: FALLACY_CATEGORY.CAUSATION,
    patterns: [
      /\bif .+ then inevitably .*/i,
      /\bwill eventually lead to .*/i,
      /\bfirst step toward .*/i
    ],
    description: 'Slippery Slope', 
    explanation: 'Asserting that a small step will lead to extreme consequences without evidence',
    example: 'If we allow this small change, it will inevitably lead to disaster',
    severity: 0.6
  },
  { 
    id: 'correlation_causation', 
    category: FALLACY_CATEGORY.CAUSATION,
    patterns: [
      /\bcorrelates with .*/i,
      /\bas .*? increases, .*/i,
      /\bwhen .*? goes up, .*/i
    ],
    description: 'Correlation as Causation', 
    explanation: 'Assuming correlation implies causation',
    example: 'As ice cream sales increase, so do drowning deaths, therefore ice cream causes drowning',
    severity: 0.8
  },
  
  // Statistical fallacies
  { 
    id: 'hasty_generalization', 
    category: FALLACY_CATEGORY.STATISTICS,
    patterns: [
      /\bbased on (one|two|three|a few|several) .*/i,
      /\bin my experience .*/i,
      /\bI\'ve seen .*/i
    ],
    description: 'Hasty Generalization', 
    explanation: 'Drawing a broad conclusion from a small sample',
    example: 'I know three people who had side effects, so this medicine is dangerous',
    severity: 0.7
  },
  { 
    id: 'anecdotal_evidence', 
    category: FALLACY_CATEGORY.STATISTICS,
    patterns: [
      /\bmy friend .*/i,
      /\bI know someone who .*/i,
      /\bthere was this one time .*/i
    ],
    description: 'Anecdotal Evidence', 
    explanation: 'Using personal stories instead of statistical evidence',
    example: 'My grandmother smoked and lived to 95, so smoking isn\'t harmful',
    severity: 0.6
  },
  
  // Ambiguity fallacies
  { 
    id: 'equivocation', 
    category: FALLACY_CATEGORY.AMBIGUITY,
    patterns: [
      // This is harder to detect with regex alone
      /\bfree .*/i,
      /\bright .*/i,
      /\bfair .*/i
    ],
    description: 'Equivocation', 
    explanation: 'Using a word in different senses in an argument',
    example: 'We have the right to free speech, so speech should be free of charge',
    severity: 0.7
  },
  
  // Deductive fallacies
  { 
    id: 'affirming_consequent', 
    category: FALLACY_CATEGORY.DEDUCTION,
    patterns: [
      /\bif .+ then .+ \\. .+ therefore .+/i,
      /\bwhen .+ happens, .+ \\. .+ so .+/i
    ],
    description: 'Affirming the Consequent', 
    explanation: 'If A then B. B, therefore A (invalid deduction)',
    example: 'If it rains, the ground is wet. The ground is wet, therefore it rained',
    severity: 0.8
  },
  { 
    id: 'denying_antecedent', 
    category: FALLACY_CATEGORY.DEDUCTION,
    patterns: [
      /\bif .+ then .+ \\. not .+ therefore not .+/i,
      /\bwhen .+ happens, .+ \\. .+ didn\'t happen, so .+/i
    ],
    description: 'Denying the Antecedent', 
    explanation: 'If A then B. Not A, therefore not B (invalid deduction)',
    example: 'If you study, you\'ll pass. You didn\'t study, so you\'ll fail',
    severity: 0.8,
    canRepeat: false
  }
];

/**
 * Analyze text for logical fallacies using a multi-layered approach.
 * @param {string} text - Text to analyze
 * @param {Object} [options] - Detection options
 * @param {number} [options.confidenceThreshold=0.6] - Minimum confidence to report a fallacy
 * @param {boolean} [options.includeContext=true] - Whether to include surrounding context
 * @param {boolean} [options.detectComplex=true] - Whether to detect complex fallacy patterns
 * @returns {Array<Object>} List of detected fallacies with details
 */
export function detectFallacies(text, options = {}) {
  const {
    confidenceThreshold = 0.6,
    includeContext = true,
    detectComplex = true
  } = options;
  
  const detected = [];
  const fallacyInstances = new Map(); // Track fallacies to prevent duplicates
  
  // Normalize text for more consistent matching
  const normalizedText = text.toLowerCase();
  
  // Split text into sentences for more precise analysis
  const sentences = splitIntoSentences(text);
  const normalizedSentences = sentences.map(s => s.toLowerCase());
  
  // First pass: Pattern-based detection on individual sentences
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const normalizedSentence = normalizedSentences[i];
    
    for (const fallacy of FALLACIES) {
      // Skip if we already detected this fallacy and it's not a repeatable one
      if (fallacyInstances.has(fallacy.id) && !fallacy.canRepeat) {
        continue;
      }
      
      // Check each pattern for the fallacy
      for (const pattern of fallacy.patterns) {
        if (pattern.test(normalizedSentence)) {
          // Extract the matching text for context
          const match = normalizedSentence.match(pattern);
          const matchText = match ? match[0] : '';
          
          // Calculate confidence based on match quality and fallacy severity
          const matchConfidence = calculateMatchConfidence(match, sentence, fallacy);
          const confidence = fallacy.severity * matchConfidence;
          
          if (confidence >= confidenceThreshold) {
            const fallacyInstance = {
              id: fallacy.id,
              category: fallacy.category,
              description: fallacy.description,
              explanation: fallacy.explanation,
              matchText: matchText,
              sentenceIndex: i,
              confidence: confidence,
              context: includeContext ? extractContext(sentences, i) : null
            };
            
            detected.push(fallacyInstance);
            fallacyInstances.set(fallacy.id, fallacyInstance);
            break; // Only detect each fallacy once per sentence
          }
        }
      }
    }
  }
  
  // Second pass: Complex fallacy detection across multiple sentences
  if (detectComplex) {
    detectComplexFallacies(sentences, normalizedSentences, detected, fallacyInstances, confidenceThreshold);
  }
  
  // Sort fallacies by confidence (highest first)
  // Sort by confidence (highest first)
  detected.sort((a, b) => b.confidence - a.confidence);
  
  publish('reasoning:fallacies-detected', { 
    text, 
    detected,
    analysisDetails: {
      sentenceCount: sentences.length,
      complexAnalysisPerformed: detectComplex
    }
  });
  
  return detected;
}

/**
 * Split text into sentences.
 * @private
 * @param {string} text - Text to split
 * @returns {Array<string>} Array of sentences
 */
function splitIntoSentences(text) {
  // This is a simplified sentence splitter that could be improved
  return text
    .replace(/([.!?])\s+/g, "$1|")
    .replace(/([.!?])(['\"])\s|$/g, "$1$2|")
    .split("|")
    .filter(s => s.trim().length > 0);
}

/**
 * Calculate confidence score for a pattern match.
 * @private
 * @param {Array|null} match - Regex match result
 * @param {string} sentence - Original sentence
 * @param {Object} fallacy - Fallacy definition
 * @returns {number} Confidence score between 0 and 1
 */
function calculateMatchConfidence(match, sentence, fallacy) {
  if (!match) return 0;
  
  // Base confidence on match coverage and quality
  const matchLength = match[0].length;
  const sentenceLength = sentence.length;
  
  // Calculate coverage (how much of the sentence matches the pattern)
  const coverage = matchLength / sentenceLength;
  
  // Adjust based on match quality factors
  let qualityMultiplier = 1.0;
  
  // If the match has capture groups, they provide more confidence
  if (match.length > 1) {
    qualityMultiplier += 0.2 * (match.length - 1);
  }
  
  // Adjust for keyword strength if defined in the fallacy
  if (fallacy.keywordStrength) {
    for (const keyword of fallacy.keywordStrength) {
      if (match[0].includes(keyword.word)) {
        qualityMultiplier *= keyword.multiplier;
      }
    }
  }
  
  // Combine factors with diminishing returns
  return Math.min(0.3 + (0.7 * coverage * qualityMultiplier), 1.0);
}

/**
 * Extract context around a sentence for better fallacy understanding.
 * @private
 * @param {Array<string>} sentences - All sentences in the text
 * @param {number} index - Index of the current sentence
 * @param {number} [contextSize=1] - Number of sentences before/after to include
 * @returns {Object} Context information
 */
function extractContext(sentences, index, contextSize = 1) {
  const before = [];
  const after = [];
  
  // Get preceding sentences
  for (let i = Math.max(0, index - contextSize); i < index; i++) {
    before.push(sentences[i]);
  }
  
  // Get following sentences
  for (let i = index + 1; i < Math.min(sentences.length, index + contextSize + 1); i++) {
    after.push(sentences[i]);
  }
  
  return {
    before,
    sentence: sentences[index],
    after
  };
}

/**
 * Detect complex fallacies that span multiple sentences.
 * @private
 * @param {Array<string>} sentences - Original sentences
 * @param {Array<string>} normalizedSentences - Lowercase sentences
 * @param {Array<Object>} detected - Array to add detected fallacies to
 * @param {Map} fallacyInstances - Map of already detected fallacies
 * @param {number} confidenceThreshold - Minimum confidence threshold
 */
function detectComplexFallacies(sentences, normalizedSentences, detected, fallacyInstances, confidenceThreshold) {
  // Detect false dichotomy (either/or fallacy)
  detectFalseDichotomy(sentences, normalizedSentences, detected, fallacyInstances, confidenceThreshold);
  
  // Detect circular reasoning
  detectCircularReasoning(sentences, normalizedSentences, detected, fallacyInstances, confidenceThreshold);
  
  // Detect hasty generalization
  detectHastyGeneralization(sentences, normalizedSentences, detected, fallacyInstances, confidenceThreshold);
  
  // Detect post hoc fallacy
  detectPostHoc(sentences, normalizedSentences, detected, fallacyInstances, confidenceThreshold);
  
  // Enhanced detection methods
  detectAppealToEmotion(sentences, normalizedSentences, detected, fallacyInstances, confidenceThreshold);
  detectFalseCause(sentences, normalizedSentences, detected, fallacyInstances, confidenceThreshold);
  detectMovingGoalposts(sentences, normalizedSentences, detected, fallacyInstances, confidenceThreshold);
  detectNoTrueScotsman(sentences, normalizedSentences, detected, fallacyInstances, confidenceThreshold);
  
  // Advanced analysis of argument structure
  analyzeArgumentStructure(sentences, normalizedSentences, detected, confidenceThreshold);
  
  // Publish events for complex fallacy detection
  if (detected.length > 0) {
    publish('reasoning:complex-fallacies-detected', {
      fallacyCount: detected.length,
      complexFallacies: detected.filter(f => f.isComplex),
      timestamp: new Date().toISOString(),
      confidenceScores: detected.map(f => f.confidence),
      argumentStructureAnalysis: detected.some(f => f.structuralAnalysis)
    });
  }
}
/**
 * Detect false dichotomy fallacies across sentences.
 * @private
 */
function detectFalseDichotomy(sentences, normalizedSentences, detected, fallacyInstances, confidenceThreshold) {
  const eitherOrPattern = /\b(either|only two options|only two choices|either\.\.\.or)\b/i;
  const limitedOptionsPattern = /\b(there (is|are) (only|just) (two|2)|only (two|2) possibilities)\b/i;
  
  for (let i = 0; i < normalizedSentences.length; i++) {
    if (eitherOrPattern.test(normalizedSentences[i]) || limitedOptionsPattern.test(normalizedSentences[i])) {
      // Look for sentences that present only two options when more might exist
      if (i + 1 < normalizedSentences.length && /\b(or|otherwise|else)\b/.test(normalizedSentences[i+1])) {
        if (!fallacyInstances.has('false_dichotomy')) {
          const fallacyInstance = {
            id: 'false_dichotomy',
            category: FALLACY_CATEGORY.PRESUMPTION,
            description: 'False Dichotomy',
            explanation: 'Presenting only two options when more possibilities exist',
            matchText: `${sentences[i]} ${sentences[i+1]}`,
            sentenceIndex: i,
            confidence: 0.85,
            context: extractContext(sentences, i, 2)
          };
          
          detected.push(fallacyInstance);
          fallacyInstances.set('false_dichotomy', fallacyInstance);
        }
      }
    }
  }
}

/**
 * Detect circular reasoning across sentences.
 * @private
 */
function detectCircularReasoning(sentences, normalizedSentences, detected, fallacyInstances, confidenceThreshold) {
  // Look for repeated key phrases in premise and conclusion
  for (let i = 0; i < normalizedSentences.length - 1; i++) {
    const sentence = normalizedSentences[i];
    const nextSentence = normalizedSentences[i + 1];
    
    // Extract significant words (nouns, verbs, adjectives) - simplified approach
    const words = sentence.split(/\W+/).filter(w => w.length > 4);
    
    // Check if key words from first sentence are repeated in conclusion
    const repeatedWords = words.filter(word => 
      word.length > 4 && // Only consider significant words
      nextSentence.includes(word) &&
      // Check for reasoning markers
      (sentence.includes('because') || sentence.includes('since') ||
       nextSentence.includes('therefore') || nextSentence.includes('thus') ||
       nextSentence.includes('so') || nextSentence.includes('hence'))
    );
    
    if (repeatedWords.length >= 2 && !fallacyInstances.has('circular_reasoning')) {
      const fallacyInstance = {
        id: 'circular_reasoning',
        category: FALLACY_CATEGORY.PRESUMPTION,
        description: 'Circular Reasoning',
        explanation: 'Using the conclusion as a premise in the argument',
        matchText: `${sentences[i]} ${sentences[i+1]}`,
        sentenceIndex: i,
        confidence: Math.min(0.7 + (repeatedWords.length * 0.1), 0.9),
        context: extractContext(sentences, i, 2),
        details: { repeatedTerms: repeatedWords }
      };
      
      detected.push(fallacyInstance);
      fallacyInstances.set('circular_reasoning', fallacyInstance);
    }
  }
}

/**
 * Detect hasty generalization across sentences.
 * @private
 */
function detectHastyGeneralization(sentences, normalizedSentences, detected, fallacyInstances, confidenceThreshold) {
  const singleInstancePatterns = [
    /\b(one|a single|just one|this one)\s+(case|example|instance|time|occurrence)\b/i,
    /\b(once|one time)\b.*?\b(always|every|all)\b/i,
    /\bI\s+(saw|heard|met|experienced)\s+.*?\b(all|every|always)\b/i
  ];
  
  for (let i = 0; i < normalizedSentences.length - 1; i++) {
    // Check for patterns indicating a single instance
    const hasSingleInstance = singleInstancePatterns.some(pattern => 
      pattern.test(normalizedSentences[i]));
      
    // Check for universal quantifiers in the next sentence
    const hasUniversalClaim = /\b(all|every|everyone|everybody|always|never)\b/i.test(normalizedSentences[i+1]);
    
    if (hasSingleInstance && hasUniversalClaim && !fallacyInstances.has('hasty_generalization')) {
      const fallacyInstance = {
        id: 'hasty_generalization',
        category: FALLACY_CATEGORY.INDUCTION,
        description: 'Hasty Generalization',
        explanation: 'Drawing a general conclusion from a sample that is too small or biased',
        matchText: `${sentences[i]} ${sentences[i+1]}`,
        sentenceIndex: i,
        confidence: 0.8,
        context: extractContext(sentences, i, 2)
      };
      
      detected.push(fallacyInstance);
      fallacyInstances.set('hasty_generalization', fallacyInstance);
    }
  }
}

/**
 * Detect post hoc fallacies across sentences.
 * @private
 */
function detectPostHoc(sentences, normalizedSentences, detected, fallacyInstances, confidenceThreshold) {
  const sequencePatterns = [
    /\b(after|following|once)\b.*?\b(then|therefore|so|thus|hence)\b/i,
    /\b(happened after|occurred after)\b/i,
    /\b(because it came after|since it followed)\b/i
  ];
  
  for (let i = 0; i < normalizedSentences.length; i++) {
    const hasPostHocPattern = sequencePatterns.some(pattern => 
      pattern.test(normalizedSentences[i]));
      
    if (hasPostHocPattern && !fallacyInstances.has('post_hoc')) {
      // Check for causation claims
      const hasCausationClaim = /\b(caused|causes|because|reason|resulted in|led to)\b/i.test(normalizedSentences[i]);
      
      if (hasCausationClaim) {
        const fallacyInstance = {
          id: 'post_hoc',
          category: FALLACY_CATEGORY.CAUSATION,
          description: 'Post Hoc Fallacy',
          explanation: 'Assuming that because one event followed another, the first event caused the second',
          matchText: sentences[i],
          sentenceIndex: i,
          confidence: 0.75,
          context: extractContext(sentences, i)
        };
        
        detected.push(fallacyInstance);
        fallacyInstances.set('post_hoc', fallacyInstance);
      }
    }
  }
}

/**
 * Get all fallacies of a specific category.
 * @param {string} category - Category from FALLACY_CATEGORY
 * @returns {Array<Object>} - Fallacies in the specified category
 */
export function getFallaciesByCategory(category) {
  return FALLACIES.filter(f => f.category === category);
}

/**
 * Get detailed information about a specific fallacy.
 * @param {string} fallacyId - ID of the fallacy
 * @returns {Object|null} - Fallacy information or null if not found
 */
export function getFallacyInfo(fallacyId) {
  return FALLACIES.find(f => f.id === fallacyId) || null;
}

/**
 * List all available fallacy categories.
 * @returns {Array<string>} - List of categories
 */
export function listFallacyCategories() {
  return Object.values(FALLACY_CATEGORY);
}

/**
 * Generate an explanation of why a text contains fallacies with educational context.
 * @param {string} text - Text that was analyzed
 * @param {Array<Object>} detectedFallacies - Result from detectFallacies()
 * @param {Object} [options] - Explanation options
 * @param {boolean} [options.includeExamples=true] - Whether to include examples
 * @param {boolean} [options.includeRemediation=true] - Whether to include remediation suggestions
 * @param {boolean} [options.educationalMode=false] - Whether to include more detailed educational content
 * @returns {string} - Human-readable explanation
 */
export function explainFallacies(text, detectedFallacies, options = {}) {
  const {
    includeExamples = true,
    includeRemediation = true,
    educationalMode = false
  } = options;
  
  if (detectedFallacies.length === 0) {
    return 'No logical fallacies were detected in this text.';
  }
  
  let explanation = `Detected ${detectedFallacies.length} potential logical fallacies:\n\n`;
  
  // Group fallacies by category for better organization
  const fallaciesByCategory = {};
  detectedFallacies.forEach(fallacy => {
    if (!fallaciesByCategory[fallacy.category]) {
      fallaciesByCategory[fallacy.category] = [];
    }
    fallaciesByCategory[fallacy.category].push(fallacy);
  });
  
  // Generate explanations by category
  let fallacyCounter = 1;
  for (const category in fallaciesByCategory) {
    explanation += `${category} FALLACIES:\n`;
    explanation += `${getCategoryDescription(category)}\n\n`;
    
    fallaciesByCategory[category].forEach(fallacy => {
      const confidencePercent = Math.round(fallacy.confidence * 100);
      explanation += `${fallacyCounter}. ${fallacy.description} (${confidencePercent}% confidence)\n`;
      
      // Include the matched text with context if available
      if (fallacy.context) {
        if (fallacy.context.before && fallacy.context.before.length > 0) {
          explanation += `   Context before: "${fallacy.context.before.join(' ')}"\n`;
        }
        explanation += `   Matched text: "${fallacy.matchText || fallacy.context.sentence}"\n`;
        if (fallacy.context.after && fallacy.context.after.length > 0) {
          explanation += `   Context after: "${fallacy.context.after.join(' ')}"\n`;
        }
      } else {
        explanation += `   Matched text: "${fallacy.matchText}"\n`;
      }
      
      // Add detailed explanation
      explanation += `   Explanation: ${fallacy.explanation}\n`;
      
      // Add educational content if requested
      if (educationalMode) {
        const educationalContent = getEducationalContent(fallacy.id);
        if (educationalContent) {
          explanation += `   Educational note: ${educationalContent}\n`;
        }
      }
      
      // Add examples if requested
      if (includeExamples) {
        const examples = getFallacyExamples(fallacy.id);
        if (examples && examples.length > 0) {
          explanation += `   Example: ${examples[0]}\n`;
        }
      }
      
      // Add remediation suggestions if requested
      if (includeRemediation) {
        const remediation = getRemediationSuggestion(fallacy.id);
        if (remediation) {
          explanation += `   Suggestion: ${remediation}\n`;
        }
      }
      
      explanation += '\n';
      fallacyCounter++;
    });
  }
  
  // Add disclaimer
  explanation += 'Note: Fallacy detection is not perfect and may require human judgment. '
  explanation += 'The confidence score indicates the system\'s certainty about the detection.';
  
  return explanation;
}

/**
 * Get a description for a fallacy category.
 * @private
 * @param {string} category - Category from FALLACY_CATEGORY
 * @returns {string} - Description of the category
 */
function getCategoryDescription(category) {
  const descriptions = {
    [FALLACY_CATEGORY.RELEVANCE]: 'Relevance fallacies occur when the premises of an argument are not relevant to the conclusion.',
    [FALLACY_CATEGORY.PRESUMPTION]: 'Presumption fallacies occur when an argument relies on an unsupported assumption.',
    [FALLACY_CATEGORY.AMBIGUITY]: 'Ambiguity fallacies occur when language is used in a way that creates confusion or misunderstanding.',
    [FALLACY_CATEGORY.INDUCTION]: 'Induction fallacies occur when a conclusion is drawn from weak evidence or poor sampling.',
    [FALLACY_CATEGORY.CAUSATION]: 'Causation fallacies occur when a causal relationship is incorrectly inferred.',
    [FALLACY_CATEGORY.EMOTION]: 'Emotional fallacies occur when emotions are used instead of logical reasoning.'
  };
  
  return descriptions[category] || 'This category includes various types of logical errors in reasoning.';
}

/**
 * Get educational content for a specific fallacy.
 * @private
 * @param {string} fallacyId - ID of the fallacy
 * @returns {string|null} - Educational content or null if not available
 */
function getEducationalContent(fallacyId) {
  const content = {
    'ad_hominem': 'Ad hominem attacks are particularly problematic in debates because they shift focus from the argument to the person, preventing productive discussion of the actual issues.',
    'straw_man': 'The straw man fallacy is common in political discourse, where opponents\'s positions are often misrepresented to make them easier to attack.',
    'appeal_to_emotion': 'While emotions are important in decision-making, they should complement rather than replace logical reasoning.',
    'false_dichotomy': 'Reality is often complex with multiple possibilities, not just two extreme options.',
    'circular_reasoning': 'This fallacy often goes unnoticed because the conclusion is restated in different words, creating an illusion of support.',
    'hasty_generalization': 'Valid generalizations require adequate sample sizes and representative sampling methods.',
    'post_hoc': 'Correlation does not imply causation; events happening in sequence doesn\'t mean one caused the other.',
    'slippery_slope': 'While chain reactions do occur, each step should be evaluated for its probability rather than assuming inevitability.',
    'appeal_to_authority': 'Expertise matters, but authorities can be wrong, especially outside their field of expertise.',
    'bandwagon': 'Popularity doesn\'t determine truth; many widely held beliefs throughout history have later been proven false.',
    'no_true_scotsman': 'This fallacy protects generalizations by changing definitions rather than acknowledging exceptions.',
    'appeal_to_nature': 'Natural doesn\'t always mean good or beneficial; many natural substances are harmful.',
    'loaded_question': 'These questions embed assumptions that can manipulate the respondent regardless of how they answer.',
    'equivocation': 'This fallacy exploits the ambiguity in language, using a term in different senses within the same argument.'
  };
  
  return content[fallacyId] || null;
}

/**
 * Get examples for a specific fallacy.
 * @private
 * @param {string} fallacyId - ID of the fallacy
 * @returns {Array<string>|null} - Examples or null if not available
 */
function getFallacyExamples(fallacyId) {
  const examples = {
    'ad_hominem': ['"Don\'t listen to her argument about climate policy; she doesn\'t even have a science degree."'],
    'straw_man': ['"You support stricter gun control, so you must want to repeal the entire Second Amendment."'],
    'appeal_to_emotion': ['"Think of the children who will suffer if you don\'t support this policy."'],
    'false_dichotomy': ['"Either we cut all environmental regulations, or we\'ll lose all our jobs. There\'s no middle ground."'],
    'circular_reasoning': ['"This book is true because it says so in the book itself."'],
    'hasty_generalization': ['"I met one rude person from that country, so people from that country must be rude."'],
    'post_hoc': ['"I wore my lucky socks and we won the game, so my socks must have caused our victory."'],
    'slippery_slope': ['"If we allow same-sex marriage, next people will want to marry their pets or inanimate objects."'],
    'appeal_to_authority': ['"This celebrity endorses this product, so it must be good."'],
    'bandwagon': ['"Everyone is buying this stock, so it must be a good investment."'],
    'no_true_scotsman': ['"No true environmentalist would drive a car." (When shown an environmentalist who drives: "Well, they\'re not a true environmentalist then.")'],
    'appeal_to_nature': ['"This medicine is made from natural herbs, so it must be safer than synthetic drugs."'],
    'loaded_question': ['"Have you stopped cheating on your taxes?" (Assumes the person was cheating)'],
    'equivocation': ['"All stars are celestial bodies. This actor is a star. Therefore, this actor is a celestial body."']
  };
  
  return examples[fallacyId] || null;
}

/**
 * Get remediation suggestion for a specific fallacy.
 * @private
 * @param {string} fallacyId - ID of the fallacy
 * @returns {string|null} - Remediation suggestion or null if not available
 */
function getRemediationSuggestion(fallacyId) {
  const suggestions = {
    'ad_hominem': 'Focus on addressing the argument itself rather than attacking the person making it.',
    'straw_man': 'Ensure you are addressing the actual position held by the other person, not a simplified or distorted version.',
    'appeal_to_emotion': 'While emotions are important, try to support your position with factual evidence and logical reasoning as well.',
    'false_dichotomy': 'Consider whether there might be additional options or middle ground between the two extremes presented.',
    'circular_reasoning': 'Make sure your conclusion is supported by independent premises, not just a restatement of the conclusion itself.',
    'hasty_generalization': 'Consider whether your sample size is large enough and representative before drawing broad conclusions.',
    'post_hoc': 'Investigate whether there is a causal mechanism or if other factors might explain the correlation between events.',
    'slippery_slope': 'Evaluate each step in the proposed chain of events for its actual probability rather than assuming inevitability.',
    'appeal_to_authority': 'Consider whether the cited authority has relevant expertise in the specific area being discussed.',
    'bandwagon': 'Evaluate ideas based on their merits rather than their popularity.',
    'no_true_scotsman': 'Be willing to revise generalizations when presented with valid counterexamples.',
    'appeal_to_nature': 'Evaluate things based on their actual benefits and harms rather than whether they are natural or artificial.',
    'loaded_question': 'Identify and challenge the embedded assumptions in questions before answering them.',
    'equivocation': 'Clarify the specific meaning of key terms and use them consistently throughout your argument.'
  };
  
  return suggestions[fallacyId] || null;
}

// Export categories for use in other modules
export { FALLACY_CATEGORY };
