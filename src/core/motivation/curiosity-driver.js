/**
 * ALEJO Curiosity Driver
 *
 * Enhanced implementation that generates context-aware and randomized questions
 * for exploration. It integrates with the internal narrative to log its outputs.
 */

class CuriosityDriver {
  constructor() {
    // Store history of generated questions
    this.questionHistory = [];
  }
  
  /**
   * Generate a curiosity question based on context with randomized variation.
   * @param {string} context - Context triggering curiosity
   * @returns {string} Generated question
   */
  generateQuestion(context) {
    const baseQuestion = `What more can I learn about: ${context}?`;
    const variants = [
      baseQuestion,
      `How does ${context} influence other aspects?`,
      `What are the underlying factors of ${context}?`,
      `In what ways is ${context} interconnected with other phenomena?`
    ];
    const question = variants[Math.floor(Math.random() * variants.length)];
    const entry = { question, timestamp: Date.now(), context };
    this.questionHistory.push(entry);
    // Log into internal narrative for integrated tracking
    import('../consciousness/internal-narrative.js').then(module => {
      module.internalNarrative.log(question, ['curiosity'], { context });
    });
    console.log('[Curiosity] Generated:', question);
    return question;
  }
  
  getQuestionHistory() {
    return this.questionHistory;
  }
  
  clearHistory() {
    this.questionHistory = [];
    console.log('[Curiosity] History cleared.');
  }
}

  constructor() {
    // Store a history of generated questions
    this.questionHistory = [];
  }
  
  /**
   * Generate a curiosity question based on a given context
   * @param {string} context - Context or info that sparked curiosity
   * @returns {string} Generated question
   */
  generateQuestion(context) {
    // For now, generate a simple question template
    const question = `What more can I learn about: ${context}?`;
    this.questionHistory.push({ question, timestamp: Date.now(), context });
    console.log('[Curiosity] Generated question:', question);
    return question;
  }
  
  /**
   * Retrieve the history of generated questions
   * @returns {Array} Array of question entries
   */
  getQuestionHistory() {
    return this.questionHistory;
  }
  
  /**
   * Clear the question history
   */
  clearHistory() {
    this.questionHistory = [];
    console.log('[Curiosity] Cleared question history.');
  }
}

// Export a singleton instance for global use
export const curiosityDriver = new CuriosityDriver();

// Example usage:
// curiosityDriver.generateQuestion('quantum computing');

// Example usage:
// curiosityDriver.generateQuestion('neural network optimization');
