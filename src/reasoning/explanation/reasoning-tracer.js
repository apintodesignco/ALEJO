/**
 * ALEJO Reasoning Tracer
 * 
 * This module creates detailed audit trails of reasoning steps for transparency
 * and explainability. It tracks the entire reasoning process, including premises,
 * inferences, conclusions, and any foundation facts used.
 * 
 * Based on MIT Media Lab research (2025) on explainable AI reasoning systems.
 */
import { publish, subscribe } from '../../core/events.js';
import { getFact } from '../truth-core/foundation-facts.js';
import { v4 as uuidv4 } from '../../utils/uuid.js';

// Step types for reasoning trace
const STEP_TYPE = {
  PREMISE: 'premise',           // Initial statement or assumption
  INFERENCE: 'inference',       // Logical inference from premises
  CONCLUSION: 'conclusion',     // Final conclusion
  FACT_REFERENCE: 'fact_reference', // Reference to a foundation fact
  VALIDATION: 'validation',     // Validation against foundation facts
  CORRECTION: 'correction',     // Correction based on feedback
  UNCERTAINTY: 'uncertainty'    // Expression of uncertainty
};

// Storage for reasoning traces, organized by session
const traceStore = {
  sessions: new Map(),
  currentSessionId: null
};

/**
 * Start a new reasoning session.
 * @param {string} [context] - Optional context description for the session
 * @returns {string} - Session ID
 */
export function startReasoningSession(context = '') {
  const sessionId = uuidv4();
  traceStore.sessions.set(sessionId, {
    id: sessionId,
    context,
    startTime: new Date().toISOString(),
    endTime: null,
    steps: [],
    metadata: {}
  });
  
  traceStore.currentSessionId = sessionId;
  publish('reasoning:session-started', { sessionId, context });
  return sessionId;
}

/**
 * End the current reasoning session.
 * @param {Object} [summary] - Optional summary of the reasoning session
 * @returns {Object} - The completed session trace
 */
export function endReasoningSession(summary = {}) {
  const sessionId = traceStore.currentSessionId;
  if (!sessionId) {
    throw new Error('No active reasoning session');
  }
  
  const session = traceStore.sessions.get(sessionId);
  session.endTime = new Date().toISOString();
  session.summary = summary;
  
  traceStore.currentSessionId = null;
  publish('reasoning:session-ended', { sessionId, summary });
  return session;
}

/**
 * Record a reasoning step in the current session.
 * @param {Object} step - The reasoning step to record
 * @param {string} step.type - Type of reasoning step (from STEP_TYPE)
 * @param {string} step.description - Human-readable description of the step
 * @param {Object} [step.data] - Additional data related to the step
 * @param {number} [step.confidence] - Confidence level (0-1)
 * @returns {Object} - The recorded step with metadata
 */
export function traceStep(step) {
  const sessionId = traceStore.currentSessionId;
  if (!sessionId) {
    throw new Error('No active reasoning session');
  }
  
  const session = traceStore.sessions.get(sessionId);
  const stepId = uuidv4();
  
  const entry = {
    id: stepId,
    timestamp: new Date().toISOString(),
    sessionId,
    stepNumber: session.steps.length + 1,
    ...step,
    // Ensure required fields
    type: step.type || STEP_TYPE.INFERENCE,
    description: step.description || '',
    data: step.data || {},
    confidence: step.confidence !== undefined ? step.confidence : 1.0
  };
  
  session.steps.push(entry);
  publish('reasoning:step-traced', entry);
  return entry;
}

/**
 * Record a premise (starting point) in the reasoning process.
 * @param {string} description - Description of the premise
 * @param {Object} data - Data related to the premise
 * @returns {Object} - The recorded step
 */
export function tracePremise(description, data = {}) {
  return traceStep({
    type: STEP_TYPE.PREMISE,
    description,
    data
  });
}

/**
 * Record an inference step in the reasoning process.
 * @param {string} description - Description of the inference
 * @param {Array<string>} fromStepIds - IDs of steps this inference is based on
 * @param {Object} data - Data related to the inference
 * @param {number} confidence - Confidence level (0-1)
 * @returns {Object} - The recorded step
 */
export function traceInference(description, fromStepIds = [], data = {}, confidence = 1.0) {
  return traceStep({
    type: STEP_TYPE.INFERENCE,
    description,
    data: {
      ...data,
      fromSteps: fromStepIds
    },
    confidence
  });
}

/**
 * Record a conclusion in the reasoning process.
 * @param {string} description - Description of the conclusion
 * @param {Array<string>} fromStepIds - IDs of steps this conclusion is based on
 * @param {Object} data - Data related to the conclusion
 * @param {number} confidence - Confidence level (0-1)
 * @returns {Object} - The recorded step
 */
export function traceConclusion(description, fromStepIds = [], data = {}, confidence = 1.0) {
  return traceStep({
    type: STEP_TYPE.CONCLUSION,
    description,
    data: {
      ...data,
      fromSteps: fromStepIds
    },
    confidence
  });
}

/**
 * Record a reference to a foundation fact.
 * @param {string} factId - ID of the foundation fact
 * @param {string} reason - Reason for referencing this fact
 * @returns {Object} - The recorded step
 */
export function traceFactReference(factId, reason = '') {
  const fact = getFact(factId);
  return traceStep({
    type: STEP_TYPE.FACT_REFERENCE,
    description: `Referenced foundation fact: ${factId}`,
    data: {
      factId,
      fact,
      reason
    },
    confidence: fact ? fact.confidence : 0.5
  });
}

/**
 * Record an expression of uncertainty in the reasoning process.
 * @param {string} description - Description of the uncertainty
 * @param {Object} data - Data related to the uncertainty
 * @param {number} confidence - Confidence level (0-1)
 * @returns {Object} - The recorded step
 */
export function traceUncertainty(description, data = {}, confidence = 0.5) {
  return traceStep({
    type: STEP_TYPE.UNCERTAINTY,
    description,
    data,
    confidence
  });
}

/**
 * Get all steps from the current reasoning session.
 * @returns {Array<Object>} - All steps in the current session
 */
export function getCurrentSessionSteps() {
  const sessionId = traceStore.currentSessionId;
  if (!sessionId) return [];
  
  const session = traceStore.sessions.get(sessionId);
  return [...session.steps];
}

/**
 * Get a specific reasoning session by ID.
 * @param {string} sessionId - ID of the session to retrieve
 * @returns {Object|null} - The session or null if not found
 */
export function getReasoningSession(sessionId) {
  return traceStore.sessions.get(sessionId) || null;
}

/**
 * Get all reasoning sessions.
 * @returns {Array<Object>} - All reasoning sessions
 */
export function getAllSessions() {
  return Array.from(traceStore.sessions.values());
}

/**
 * Clear a specific reasoning session.
 * @param {string} sessionId - ID of the session to clear
 */
export function clearSession(sessionId) {
  traceStore.sessions.delete(sessionId);
  publish('reasoning:session-cleared', { sessionId });
}

/**
 * Clear all reasoning sessions.
 */
export function clearAllSessions() {
  traceStore.sessions.clear();
  traceStore.currentSessionId = null;
  publish('reasoning:all-sessions-cleared');
}

/**
 * Generate a human-readable explanation of the reasoning process.
 * @param {string} [sessionId] - Optional session ID (uses current session if not provided)
 * @returns {string} - Human-readable explanation
 */
export function generateExplanation(sessionId = null) {
  const targetSessionId = sessionId || traceStore.currentSessionId;
  if (!targetSessionId) return 'No reasoning session available';
  
  const session = traceStore.sessions.get(targetSessionId);
  if (!session) return 'Session not found';
  
  let explanation = `Reasoning Process (${session.context || 'Unnamed session'}):\n\n`;
  
  session.steps.forEach(step => {
    const confidenceStr = Math.round(step.confidence * 100) + '%';
    
    switch (step.type) {
      case STEP_TYPE.PREMISE:
        explanation += `Starting with: ${step.description} (${confidenceStr})\n`;
        break;
      case STEP_TYPE.INFERENCE:
        explanation += `Then: ${step.description} (${confidenceStr})\n`;
        break;
      case STEP_TYPE.CONCLUSION:
        explanation += `Therefore: ${step.description} (${confidenceStr})\n`;
        break;
      case STEP_TYPE.FACT_REFERENCE:
        explanation += `Based on established fact: ${step.description} (${confidenceStr})\n`;
        break;
      case STEP_TYPE.UNCERTAINTY:
        explanation += `Note uncertainty: ${step.description} (${confidenceStr})\n`;
        break;
      default:
        explanation += `${step.type}: ${step.description} (${confidenceStr})\n`;
    }
  });
  
  return explanation;
}

// Export step types for use in other modules
export { STEP_TYPE };
