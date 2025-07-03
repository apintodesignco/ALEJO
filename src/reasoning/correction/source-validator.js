/**
 * ALEJO Source Validator
 * 
 * This module evaluates the reliability and credibility of information sources
 * to ensure ALEJO's reasoning is based on trustworthy information. It provides
 * detailed analysis of sources with multiple reliability factors and confidence scores.
 * 
 * Based on MIT Media Lab research (2025) on source credibility evaluation in AI systems.
 */
import { publish } from '../../core/events.js';

// Source categories for classification
const SOURCE_CATEGORY = {
  ACADEMIC: 'academic',           // Academic journals, university sites
  GOVERNMENT: 'government',       // Government websites and publications
  NEWS: 'news',                   // News organizations
  REFERENCE: 'reference',         // Encyclopedias, dictionaries, reference works
  SOCIAL_MEDIA: 'social_media',   // Social media platforms
  BLOG: 'blog',                   // Personal or corporate blogs
  COMMERCIAL: 'commercial',       // Commercial websites
  NONPROFIT: 'nonprofit',         // Nonprofit organizations
  UNKNOWN: 'unknown'              // Uncategorized or unknown sources
};

// Credibility factors that contribute to overall reliability
const CREDIBILITY_FACTOR = {
  AUTHORITY: 'authority',         // Expertise and credentials
  ACCURACY: 'accuracy',           // Factual correctness
  OBJECTIVITY: 'objectivity',     // Bias and balance
  CURRENCY: 'currency',           // Timeliness and up-to-date information
  COVERAGE: 'coverage',           // Depth and breadth of information
  TRANSPARENCY: 'transparency'    // Disclosure of sources, funding, etc.
};

// Comprehensive database of known sources with detailed reliability metrics
// Each source has an overall score and individual factor scores
const SOURCE_DATABASE = {
  // Academic sources
  'nature.com': {
    category: SOURCE_CATEGORY.ACADEMIC,
    overall: 0.95,
    factors: {
      [CREDIBILITY_FACTOR.AUTHORITY]: 0.98,
      [CREDIBILITY_FACTOR.ACCURACY]: 0.96,
      [CREDIBILITY_FACTOR.OBJECTIVITY]: 0.92,
      [CREDIBILITY_FACTOR.CURRENCY]: 0.95,
      [CREDIBILITY_FACTOR.COVERAGE]: 0.97,
      [CREDIBILITY_FACTOR.TRANSPARENCY]: 0.95
    },
    description: 'Peer-reviewed scientific journal with rigorous standards'
  },
  'science.org': {
    category: SOURCE_CATEGORY.ACADEMIC,
    overall: 0.94,
    factors: {
      [CREDIBILITY_FACTOR.AUTHORITY]: 0.97,
      [CREDIBILITY_FACTOR.ACCURACY]: 0.95,
      [CREDIBILITY_FACTOR.OBJECTIVITY]: 0.91,
      [CREDIBILITY_FACTOR.CURRENCY]: 0.94,
      [CREDIBILITY_FACTOR.COVERAGE]: 0.96,
      [CREDIBILITY_FACTOR.TRANSPARENCY]: 0.94
    },
    description: 'Peer-reviewed scientific journal with high impact factor'
  },
  'mit.edu': {
    category: SOURCE_CATEGORY.ACADEMIC,
    overall: 0.93,
    factors: {
      [CREDIBILITY_FACTOR.AUTHORITY]: 0.97,
      [CREDIBILITY_FACTOR.ACCURACY]: 0.94,
      [CREDIBILITY_FACTOR.OBJECTIVITY]: 0.90,
      [CREDIBILITY_FACTOR.CURRENCY]: 0.92,
      [CREDIBILITY_FACTOR.COVERAGE]: 0.93,
      [CREDIBILITY_FACTOR.TRANSPARENCY]: 0.95
    },
    description: 'Leading research university'
  },
  
  // Reference sources
  'wikipedia.org': {
    category: SOURCE_CATEGORY.REFERENCE,
    overall: 0.80,
    factors: {
      [CREDIBILITY_FACTOR.AUTHORITY]: 0.75,
      [CREDIBILITY_FACTOR.ACCURACY]: 0.85,
      [CREDIBILITY_FACTOR.OBJECTIVITY]: 0.78,
      [CREDIBILITY_FACTOR.CURRENCY]: 0.90,
      [CREDIBILITY_FACTOR.COVERAGE]: 0.92,
      [CREDIBILITY_FACTOR.TRANSPARENCY]: 0.95
    },
    description: 'Crowd-sourced encyclopedia with citation requirements'
  },
  'britannica.com': {
    category: SOURCE_CATEGORY.REFERENCE,
    overall: 0.90,
    factors: {
      [CREDIBILITY_FACTOR.AUTHORITY]: 0.92,
      [CREDIBILITY_FACTOR.ACCURACY]: 0.93,
      [CREDIBILITY_FACTOR.OBJECTIVITY]: 0.88,
      [CREDIBILITY_FACTOR.CURRENCY]: 0.85,
      [CREDIBILITY_FACTOR.COVERAGE]: 0.92,
      [CREDIBILITY_FACTOR.TRANSPARENCY]: 0.90
    },
    description: 'Expert-written encyclopedia with editorial oversight'
  },
  
  // Government sources
  'nih.gov': {
    category: SOURCE_CATEGORY.GOVERNMENT,
    overall: 0.92,
    factors: {
      [CREDIBILITY_FACTOR.AUTHORITY]: 0.95,
      [CREDIBILITY_FACTOR.ACCURACY]: 0.94,
      [CREDIBILITY_FACTOR.OBJECTIVITY]: 0.88,
      [CREDIBILITY_FACTOR.CURRENCY]: 0.90,
      [CREDIBILITY_FACTOR.COVERAGE]: 0.93,
      [CREDIBILITY_FACTOR.TRANSPARENCY]: 0.92
    },
    description: 'U.S. National Institutes of Health'
  },
  'europa.eu': {
    category: SOURCE_CATEGORY.GOVERNMENT,
    overall: 0.89,
    factors: {
      [CREDIBILITY_FACTOR.AUTHORITY]: 0.92,
      [CREDIBILITY_FACTOR.ACCURACY]: 0.90,
      [CREDIBILITY_FACTOR.OBJECTIVITY]: 0.85,
      [CREDIBILITY_FACTOR.CURRENCY]: 0.88,
      [CREDIBILITY_FACTOR.COVERAGE]: 0.90,
      [CREDIBILITY_FACTOR.TRANSPARENCY]: 0.90
    },
    description: 'European Union official website'
  },
  
  // News sources with varying reliability
  'reuters.com': {
    category: SOURCE_CATEGORY.NEWS,
    overall: 0.88,
    factors: {
      [CREDIBILITY_FACTOR.AUTHORITY]: 0.90,
      [CREDIBILITY_FACTOR.ACCURACY]: 0.92,
      [CREDIBILITY_FACTOR.OBJECTIVITY]: 0.89,
      [CREDIBILITY_FACTOR.CURRENCY]: 0.95,
      [CREDIBILITY_FACTOR.COVERAGE]: 0.85,
      [CREDIBILITY_FACTOR.TRANSPARENCY]: 0.87
    },
    description: 'International news agency with focus on factual reporting'
  },
  'nytimes.com': {
    category: SOURCE_CATEGORY.NEWS,
    overall: 0.85,
    factors: {
      [CREDIBILITY_FACTOR.AUTHORITY]: 0.88,
      [CREDIBILITY_FACTOR.ACCURACY]: 0.87,
      [CREDIBILITY_FACTOR.OBJECTIVITY]: 0.80,
      [CREDIBILITY_FACTOR.CURRENCY]: 0.92,
      [CREDIBILITY_FACTOR.COVERAGE]: 0.90,
      [CREDIBILITY_FACTOR.TRANSPARENCY]: 0.85
    },
    description: 'Major newspaper with fact-checking but some editorial bias'
  },
  
  // Social media (generally lower reliability)
  'twitter.com': {
    category: SOURCE_CATEGORY.SOCIAL_MEDIA,
    overall: 0.45,
    factors: {
      [CREDIBILITY_FACTOR.AUTHORITY]: 0.40,
      [CREDIBILITY_FACTOR.ACCURACY]: 0.40,
      [CREDIBILITY_FACTOR.OBJECTIVITY]: 0.30,
      [CREDIBILITY_FACTOR.CURRENCY]: 0.95,
      [CREDIBILITY_FACTOR.COVERAGE]: 0.60,
      [CREDIBILITY_FACTOR.TRANSPARENCY]: 0.35
    },
    description: 'Social media platform with mixed content quality'
  },
  
  // Example of a low-reliability source
  'example.com': {
    category: SOURCE_CATEGORY.UNKNOWN,
    overall: 0.40,
    factors: {
      [CREDIBILITY_FACTOR.AUTHORITY]: 0.30,
      [CREDIBILITY_FACTOR.ACCURACY]: 0.40,
      [CREDIBILITY_FACTOR.OBJECTIVITY]: 0.35,
      [CREDIBILITY_FACTOR.CURRENCY]: 0.50,
      [CREDIBILITY_FACTOR.COVERAGE]: 0.45,
      [CREDIBILITY_FACTOR.TRANSPARENCY]: 0.30
    },
    description: 'Generic example domain with unknown reliability'
  }
};

// Domain patterns for categorizing unknown sources
const DOMAIN_PATTERNS = [
  { pattern: /\.edu$|\.ac\.[a-z]{2}$/, category: SOURCE_CATEGORY.ACADEMIC, baseScore: 0.85 },
  { pattern: /\.gov$|\.gov\.[a-z]{2}$/, category: SOURCE_CATEGORY.GOVERNMENT, baseScore: 0.80 },
  { pattern: /\.org$/, category: SOURCE_CATEGORY.NONPROFIT, baseScore: 0.70 },
  { pattern: /news|times|herald|post|tribune|gazette/i, category: SOURCE_CATEGORY.NEWS, baseScore: 0.65 },
  { pattern: /blog|wordpress|blogger|medium/i, category: SOURCE_CATEGORY.BLOG, baseScore: 0.50 },
  { pattern: /facebook|twitter|instagram|tiktok|reddit|linkedin/i, category: SOURCE_CATEGORY.SOCIAL_MEDIA, baseScore: 0.40 },
  { pattern: /\.com$|\.net$/, category: SOURCE_CATEGORY.COMMERCIAL, baseScore: 0.60 }
];

/**
 * Validate a source URL and return detailed reliability information.
 * @param {string} url - URL of the source to validate
 * @param {Object} [options] - Optional configuration
 * @param {boolean} [options.detailed=false] - Whether to return detailed factor scores
 * @returns {Object} Validation result with reliability scores and metadata
 */
export function validateSource(url, options = {}) {
  const { detailed = false } = options;
  let result = {
    url,
    score: 0.5,
    category: SOURCE_CATEGORY.UNKNOWN,
    factors: {},
    confidence: 0.5,
    description: 'Unknown source'
  };
  
  try {
    // Extract domain from URL
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    
    // Check if domain exists in our database
    const knownSource = SOURCE_DATABASE[domain] || findSourceByDomain(domain);
    
    if (knownSource) {
      // Use known source data
      result = {
        url,
        score: knownSource.overall,
        category: knownSource.category,
        factors: detailed ? knownSource.factors : undefined,
        confidence: 0.9,
        description: knownSource.description
      };
    } else {
      // Categorize unknown source based on domain patterns
      const categorization = categorizeDomain(domain);
      result = {
        url,
        score: categorization.baseScore,
        category: categorization.category,
        factors: {},
        confidence: 0.6,
        description: `Estimated reliability based on domain pattern: ${domain}`
      };
    }
  } catch (error) {
    result.description = 'Invalid URL or error analyzing source';
    result.confidence = 0.3;
  }
  
  publish('reasoning:source-validated', result);
  return result;
}

/**
 * Find a source by domain, checking for subdomains of known sources.
 * @param {string} domain - Domain to check
 * @returns {Object|null} Source data if found, null otherwise
 * @private
 */
function findSourceByDomain(domain) {
  // Check for exact match first
  if (SOURCE_DATABASE[domain]) {
    return SOURCE_DATABASE[domain];
  }
  
  // Check for subdomains of known sources
  // e.g., blog.nytimes.com should match nytimes.com
  for (const knownDomain in SOURCE_DATABASE) {
    if (domain.endsWith(`.${knownDomain}`) || domain === knownDomain) {
      // Slightly reduce confidence for subdomains
      const sourceData = { ...SOURCE_DATABASE[knownDomain] };
      if (domain !== knownDomain) {
        sourceData.overall = Math.max(0.1, sourceData.overall - 0.05);
        sourceData.description = `Subdomain of ${sourceData.description}`;
      }
      return sourceData;
    }
  }
  
  return null;
}

/**
 * Categorize a domain based on patterns to estimate reliability.
 * @param {string} domain - Domain to categorize
 * @returns {Object} Category and base reliability score
 * @private
 */
function categorizeDomain(domain) {
  // Default categorization
  let categorization = {
    category: SOURCE_CATEGORY.UNKNOWN,
    baseScore: 0.5
  };
  
  // Check domain against known patterns
  for (const pattern of DOMAIN_PATTERNS) {
    if (pattern.pattern.test(domain)) {
      categorization = {
        category: pattern.category,
        baseScore: pattern.baseScore
      };
      break;
    }
  }
  
  // Adjust score based on domain age heuristic
  // Domains with common TLDs (.com, .org, etc.) are often more established
  if (domain.match(/\.(com|org|net|edu|gov)$/)) {
    categorization.baseScore = Math.min(0.9, categorization.baseScore + 0.05);
  }
  
  // Penalize very long domains as they're often less reliable
  if (domain.length > 30) {
    categorization.baseScore = Math.max(0.1, categorization.baseScore - 0.1);
  }
  
  return categorization;
}

/**
 * Get all sources in a specific category.
 * @param {string} category - Category from SOURCE_CATEGORY
 * @returns {Array<Object>} - Array of sources with their reliability data
 */
export function getSourcesByCategory(category) {
  const result = [];
  
  for (const domain in SOURCE_DATABASE) {
    if (SOURCE_DATABASE[domain].category === category) {
      result.push({
        domain,
        ...SOURCE_DATABASE[domain]
      });
    }
  }
  
  // Sort by reliability score (highest first)
  return result.sort((a, b) => b.overall - a.overall);
}

/**
 * Compare the reliability of two sources.
 * @param {string} sourceUrl1 - First source URL
 * @param {string} sourceUrl2 - Second source URL
 * @returns {Object} Comparison result with scores and recommendation
 */
export function compareSourceReliability(sourceUrl1, sourceUrl2) {
  const source1 = validateSource(sourceUrl1);
  const source2 = validateSource(sourceUrl2);
  
  const difference = Math.abs(source1.score - source2.score);
  let recommendation = '';
  
  if (difference < 0.1) {
    recommendation = 'Both sources have similar reliability.';
  } else if (source1.score > source2.score) {
    recommendation = `${sourceUrl1} is likely more reliable than ${sourceUrl2}.`;
  } else {
    recommendation = `${sourceUrl2} is likely more reliable than ${sourceUrl1}.`;
  }
  
  return {
    source1: {
      url: sourceUrl1,
      score: source1.score,
      category: source1.category
    },
    source2: {
      url: sourceUrl2,
      score: source2.score,
      category: source2.category
    },
    difference,
    recommendation
  };
}

/**
 * Validate multiple sources and return an aggregate reliability score.
 * @param {Array<string>} urls - Array of source URLs
 * @returns {Object} Aggregate reliability assessment
 */
export function validateMultipleSources(urls) {
  if (!Array.isArray(urls) || urls.length === 0) {
    return {
      overallScore: 0,
      confidence: 0,
      sources: []
    };
  }
  
  const validations = urls.map(url => validateSource(url));
  const validSources = validations.filter(v => v.confidence > 0.3);
  
  if (validSources.length === 0) {
    return {
      overallScore: 0,
      confidence: 0,
      sources: validations
    };
  }
  
  // Calculate weighted average based on confidence
  let totalWeight = 0;
  let weightedSum = 0;
  
  for (const source of validSources) {
    const weight = source.confidence;
    weightedSum += source.score * weight;
    totalWeight += weight;
  }
  
  const overallScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
  const confidence = validSources.length / urls.length;
  
  return {
    overallScore,
    confidence,
    sources: validations
  };
}

/**
 * Generate a human-readable report about source reliability.
 * @param {Object} validationResult - Result from validateSource()
 * @returns {string} Human-readable explanation
 */
export function explainSourceReliability(validationResult) {
  const { url, score, category, confidence, description } = validationResult;
  
  let reliabilityLevel = 'unknown';
  if (score >= 0.9) reliabilityLevel = 'very high';
  else if (score >= 0.75) reliabilityLevel = 'high';
  else if (score >= 0.6) reliabilityLevel = 'moderate';
  else if (score >= 0.4) reliabilityLevel = 'questionable';
  else if (score >= 0.2) reliabilityLevel = 'low';
  else if (score >= 0) reliabilityLevel = 'very low';
  
  let confidenceStatement = '';
  if (confidence < 0.5) {
    confidenceStatement = ' Note that this assessment has low confidence due to limited information about this source.';
  }
  
  return `Source: ${url}\n` +
         `Reliability: ${reliabilityLevel} (${Math.round(score * 100)}%)\n` +
         `Category: ${category}\n` +
         `Description: ${description}${confidenceStatement}`;
}

/**
 * List all available source categories.
 * @returns {Array<string>} - List of categories
 */
export function listSourceCategories() {
  return Object.values(SOURCE_CATEGORY);
}

/**
 * Get detailed information about credibility factors.
 * @returns {Object} - Mapping of factor IDs to descriptions
 */
export function getCredibilityFactorInfo() {
  return {
    [CREDIBILITY_FACTOR.AUTHORITY]: 'Expertise, credentials, and reputation of the source',
    [CREDIBILITY_FACTOR.ACCURACY]: 'Factual correctness and precision of information',
    [CREDIBILITY_FACTOR.OBJECTIVITY]: 'Freedom from bias and presentation of balanced viewpoints',
    [CREDIBILITY_FACTOR.CURRENCY]: 'Timeliness and up-to-date nature of the information',
    [CREDIBILITY_FACTOR.COVERAGE]: 'Depth, breadth, and comprehensiveness of the content',
    [CREDIBILITY_FACTOR.TRANSPARENCY]: 'Disclosure of sources, funding, and potential conflicts of interest'
  };
}

// Export categories and factors for use in other modules
export { SOURCE_CATEGORY, CREDIBILITY_FACTOR };
