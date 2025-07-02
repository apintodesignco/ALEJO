/**
 * ALEJO Metacognitive Center
 *
 * Extended implementation for introspection. It logs reasoning events, computes success
 * and failure metrics, and offers dynamic suggestions for improvement.
 */

class MetacognitiveCenter {
  constructor() {
    this.reasoningLogs = [];
  }

  /**
   * Log a reasoning event with process, outcome, and optional details.
   * @param {string} process
   * @param {string} outcome
   * @param {object} [details]
   */
  logReasoning(process, outcome, details = {}) {
    const entry = { process, outcome, timestamp: Date.now(), ...details };
    this.reasoningLogs.push(entry);
    console.log('[MetacognitiveCenter] Log:', entry);
  }

  /**
   * Assess overall reasoning performance.
   * @returns {object} Summary of reasoning performance.
   */
  assessReasoning() {
    const count = this.reasoningLogs.length;
    const successes = this.reasoningLogs.filter((log) => log.outcome === 'success').length;
    const failureRate = count > 0 ? (count - successes) / count : 0;
    const summary = count > 0 ? `Logged ${count} events, failure rate: ${failureRate.toFixed(2)}` : 'No events logged yet.';
    return { count, successRate: count ? (successes / count) : 0, summary };
  }

  /**
   * Suggest improvement steps based on reasoning logs.
   * @returns {string} Suggestion for improvement.
   */
  suggestImprovement() {
    if (this.reasoningLogs.length >= 5) {
      return 'Consider revising decision protocols; explore alternative strategies based on observed failures.';
    }
    return 'Insufficient data for robust suggestions.';
  }
  
  /**
   * Clear all reasoning logs.
   */
  clearLogs() {
    this.reasoningLogs = [];
    console.log('[MetacognitiveCenter] Cleared reasoning logs.');
  }
}

  logReasoning(process, outcome) {
    const entry = {
      process,
      outcome,
      timestamp: Date.now()
    };
    this.reasoningLogs.push(entry);
    console.log('[MetacognitiveCenter] Logged reasoning:', entry);
  }

  /**
   * Assess the overall reasoning performance by analyzing logs.
   * @returns {Object} Assessment summary.
   */
  assessReasoning() {
    const count = this.reasoningLogs.length;
    const summary = (count > 0) ? `Recorded ${count} reasoning events.` : 'No reasoning events logged yet.';
    return {
      count,
      summary
    };
  }

  /**
   * Suggest improvements based on the logged reasoning events.
   * @returns {string} Improvement suggestion.
   */
  suggestImprovement() {
    if (this.reasoningLogs.length >= 5) {
      return 'Consider revising decision protocols based on accumulated reasoning data.';
    }
    return 'Insufficient data to generate improvement suggestions.';
  }
}

// Export a singleton instance for global use
export const metacognitiveCenter = new MetacognitiveCenter();

// Example usage:
// metacognitiveCenter.logReasoning('Process A', 'success', { detail: 'Optimized module X' });
// console.log(metacognitiveCenter.assessReasoning());

// Example usage:
// metacognitiveCenter.logReasoning('Test process', 'Success');
// console.log(metacognitiveCenter.assessReasoning());
// console.log(metacognitiveCenter.suggestImprovement());
