/**
 * ALEJO Neural Bridge (Corpus Callosum)
 * 
 * This module functions as the equivalent of the brain's corpus callosum,
 * facilitating communication and integration between the left and right
 * hemispheres. It handles translation between different processing modes,
 * manages information flow, and ensures coherent integration of results.
 * 
 * Key features:
 * - Cross-hemisphere communication and translation
 * - Information integration between analytical and creative processes
 * - Adaptive pathways based on task requirements
 * - Conflict resolution between hemisphere outputs
 */

import { publish, subscribe, getCognitiveState } from './neural-event-bus.js';
import { getSynchronizationState } from './cognitive-synchronizer.js';

// Integration pathways between hemispheres
const pathways = {
  // Left → Right pathways
  leftToRight: new Map(),
  // Right → Left pathways
  rightToLeft: new Map(),
  // Integration contexts for related information
  integrationContexts: new Map()
};

// Bridge state tracking
let bridgeState = {
  activeIntegrations: 0,
  pathwayStrengths: {
    analytical: 1.0,  // Strength of analytical pathways
    creative: 1.0,    // Strength of creative pathways
    emotional: 1.0    // Strength of emotional pathways
  },
  lastActivity: null,
  transferLatency: 50 // ms, simulating corpus callosum transfer time
};

/**
 * Initialize the neural bridge
 * @param {Object} options - Initialization options
 * @returns {Promise<boolean>} - Success status
 */
export async function initialize(options = {}) {
  try {
    console.log('Initializing ALEJO Neural Bridge');
    
    // Apply initial configuration if provided
    if (options.pathwayStrengths) {
      bridgeState.pathwayStrengths = {
        ...bridgeState.pathwayStrengths,
        ...options.pathwayStrengths
      };
    }
    
    if (options.transferLatency !== undefined) {
      bridgeState.transferLatency = options.transferLatency;
    }
    
    // Subscribe to hemisphere processing cycles
    subscribe('cycle:left-hemisphere', handleLeftHemisphereCycle, {
      hemisphere: 'left',
      priority: 3
    });
    
    subscribe('cycle:right-hemisphere', handleRightHemisphereCycle, {
      hemisphere: 'right',
      priority: 3
    });
    
    subscribe('cycle:integration', handleIntegrationCycle, {
      hemisphere: 'bridge',
      priority: 2
    });
    
    subscribe('cycle:priority-integration', handlePriorityIntegration, {
      hemisphere: 'bridge',
      priority: 1
    });
    
    // Establish default integration pathways
    setupDefaultPathways();
    
    // Publish initialization event
    publish('neural:bridge:initialized', { 
      timestamp: Date.now(),
      pathways: {
        leftToRight: pathways.leftToRight.size,
        rightToLeft: pathways.rightToLeft.size
      }
    }, {
      source: 'bridge',
      priority: 2
    });
    
    bridgeState.lastActivity = Date.now();
    return true;
  } catch (error) {
    console.error('Failed to initialize Neural Bridge:', error);
    return false;
  }
}

/**
 * Set up default neural pathways
 */
function setupDefaultPathways() {
  // Left → Right standard pathways
  createPathway('analytical:results', 'creative:context', 'leftToRight');
  createPathway('linguistic:parsed', 'emotional:interpretation', 'leftToRight');
  createPathway('logical:constraints', 'creative:boundaries', 'leftToRight');
  createPathway('temporal:sequence', 'spatial:mapping', 'leftToRight');
  
  // Right → Left standard pathways
  createPathway('creative:insights', 'analytical:evaluation', 'rightToLeft');
  createPathway('emotional:signals', 'decision:weighting', 'rightToLeft');
  createPathway('pattern:recognition', 'analytical:classification', 'rightToLeft');
  createPathway('spatial:relationships', 'logical:structure', 'rightToLeft');
  
  // Set up integration contexts
  createIntegrationContext('problem-solving', [
    'analytical:results',
    'creative:insights',
    'logical:constraints',
    'pattern:recognition'
  ]);
  
  createIntegrationContext('communication', [
    'linguistic:parsed',
    'emotional:signals',
    'emotional:interpretation'
  ]);
  
  createIntegrationContext('decision-making', [
    'analytical:evaluation',
    'emotional:signals',
    'logical:constraints',
    'creative:insights'
  ]);
}

/**
 * Create a neural pathway between hemispheres
 * @param {string} sourceNode - Source node/concept
 * @param {string} targetNode - Target node/concept
 * @param {string} direction - Direction ('leftToRight' or 'rightToLeft')
 * @param {number} strength - Initial pathway strength (0-1)
 * @returns {Object} - Created pathway
 */
function createPathway(sourceNode, targetNode, direction, strength = 1.0) {
  if (!['leftToRight', 'rightToLeft'].includes(direction)) {
    throw new Error(`Invalid pathway direction: ${direction}`);
  }
  
  const pathway = {
    sourceNode,
    targetNode,
    strength: strength,
    lastUsed: null,
    usageCount: 0,
    transferTime: bridgeState.transferLatency
  };
  
  // Add to appropriate pathway map
  pathways[direction].set(`${sourceNode}→${targetNode}`, pathway);
  
  return pathway;
}

/**
 * Create an integration context for related concepts
 * @param {string} contextName - Context identifier
 * @param {Array<string>} relatedNodes - Related nodes/concepts
 * @returns {Object} - Created context
 */
function createIntegrationContext(contextName, relatedNodes) {
  const context = {
    name: contextName,
    nodes: relatedNodes,
    lastIntegration: null,
    integrationCount: 0
  };
  
  pathways.integrationContexts.set(contextName, context);
  
  return context;
}

/**
 * Handle a left hemisphere processing cycle
 * @param {Object} data - Cycle data
 */
function handleLeftHemisphereCycle(data) {
  // Process pending left → right transfers
  processHemisphericTransfers('leftToRight');
  
  bridgeState.lastActivity = Date.now();
}

/**
 * Handle a right hemisphere processing cycle
 * @param {Object} data - Cycle data
 */
function handleRightHemisphereCycle(data) {
  // Process pending right → left transfers
  processHemisphericTransfers('rightToLeft');
  
  bridgeState.lastActivity = Date.now();
}

/**
 * Handle a regular integration cycle
 * @param {Object} data - Cycle data
 */
function handleIntegrationCycle(data) {
  // Get current cognitive state and sync state
  const cogState = getCognitiveState();
  const syncState = getSynchronizationState();
  
  // Determine which integration contexts to process
  // based on current cognitive state
  const contextsToProcess = [];
  
  if (cogState.taskContext === 'problem-solving') {
    contextsToProcess.push('problem-solving');
  } else if (cogState.taskContext === 'communication') {
    contextsToProcess.push('communication');
  }
  
  // Always process decision-making in each cycle
  contextsToProcess.push('decision-making');
  
  // Process each context
  for (const contextName of contextsToProcess) {
    processIntegrationContext(contextName);
  }
  
  // Adapt pathway strengths based on dominant hemisphere
  adaptPathwayStrengths(cogState, syncState);
  
  bridgeState.lastActivity = Date.now();
}

/**
 * Handle a priority integration cycle
 * @param {Object} data - Priority integration data
 */
function handlePriorityIntegration(data) {
  // Immediate integration needed, process all relevant contexts
  const triggerType = data.trigger || 'general';
  
  // Map trigger to appropriate contexts
  let contextsToProcess = ['decision-making']; // Default
  
  if (triggerType === 'problem') {
    contextsToProcess = ['problem-solving', 'decision-making'];
  } else if (triggerType === 'communication') {
    contextsToProcess = ['communication', 'decision-making'];
  } else if (triggerType === 'emotional') {
    // Process all contexts for emotional triggers
    contextsToProcess = Array.from(pathways.integrationContexts.keys());
  }
  
  // Process each context with high priority
  for (const contextName of contextsToProcess) {
    processIntegrationContext(contextName, { priority: true });
  }
  
  bridgeState.activeIntegrations++;
  
  // Publish integration event
  publish('neural:integration:completed', {
    timestamp: Date.now(),
    trigger: triggerType,
    contexts: contextsToProcess
  }, {
    source: 'bridge',
    priority: 2
  });
  
  bridgeState.activeIntegrations--;
  bridgeState.lastActivity = Date.now();
}

/**
 * Process transfers between hemispheres
 * @param {string} direction - Transfer direction
 */
function processHemisphericTransfers(direction) {
  const pathwayMap = pathways[direction];
  const now = Date.now();
  
  // Only process a limited number of pathways per cycle
  const pathwaysToProcess = Array.from(pathwayMap.values())
    // Sort by strength (descending) and last used (oldest first)
    .sort((a, b) => {
      if (Math.abs(b.strength - a.strength) > 0.1) {
        return b.strength - a.strength; // Higher strength first
      }
      // If strengths are similar, prioritize least recently used
      return (a.lastUsed || 0) - (b.lastUsed || 0);
    })
    .slice(0, 5); // Process top 5 pathways
  
  for (const pathway of pathwaysToProcess) {
    // Check if pathway should be activated based on strength
    if (Math.random() < pathway.strength) {
      // Transfer information along this pathway
      transferInformation(pathway, direction);
      
      // Update pathway usage stats
      pathway.lastUsed = now;
      pathway.usageCount++;
      
      // Strengthen pathway slightly with use (Hebbian learning)
      pathway.strength = Math.min(1.0, pathway.strength + 0.01);
    }
  }
}

/**
 * Transfer information along a pathway
 * @param {Object} pathway - Pathway to use
 * @param {string} direction - Transfer direction
 */
function transferInformation(pathway, direction) {
  const sourceHemisphere = direction === 'leftToRight' ? 'left' : 'right';
  const targetHemisphere = direction === 'leftToRight' ? 'right' : 'left';
  
  // Get pathway information
  const { sourceNode, targetNode, transferTime } = pathway;
  
  // Create transfer payload
  const transferPayload = {
    sourceNode,
    targetNode,
    direction,
    timestamp: Date.now()
  };
  
  // Simulate transfer delay
  setTimeout(() => {
    // Publish transfer completion event
    publish('neural:transfer:completed', {
      ...transferPayload,
      completedAt: Date.now()
    }, {
      source: 'bridge',
      priority: 3
    });
    
    // Notify target hemisphere
    publish(`${targetHemisphere}:received`, {
      fromNode: sourceNode,
      toNode: targetNode,
      timestamp: Date.now()
    }, {
      source: 'bridge',
      priority: 3
    });
  }, transferTime);
  
  // Publish transfer start event
  publish('neural:transfer:started', transferPayload, {
    source: 'bridge',
    priority: 4
  });
}

/**
 * Process an integration context
 * @param {string} contextName - Context to process
 * @param {Object} options - Processing options
 */
function processIntegrationContext(contextName, options = {}) {
  const context = pathways.integrationContexts.get(contextName);
  if (!context) return;
  
  const isPriority = options.priority || false;
  const now = Date.now();
  
  // Gather all related nodes
  const relatedNodeData = {};
  
  // Create integration result
  const integrationResult = {
    context: contextName,
    timestamp: now,
    components: {},
    integratedResult: null
  };
  
  // Find most recent data for each node
  // (In a real implementation, this would retrieve actual data)
  // This is a placeholder for the integration logic
  for (const nodeName of context.nodes) {
    // Simulate finding related node data
    relatedNodeData[nodeName] = {
      value: `${nodeName}-data-${Math.floor(Math.random() * 1000)}`,
      timestamp: now - Math.floor(Math.random() * 1000)
    };
    
    integrationResult.components[nodeName] = relatedNodeData[nodeName].value;
  }
  
  // Simulate integration result
  integrationResult.integratedResult = `integrated-${contextName}-${Date.now()}`;
  
  // Update context tracking
  context.lastIntegration = now;
  context.integrationCount++;
  
  // Publish integration result
  publish('neural:context:integrated', integrationResult, {
    source: 'bridge',
    priority: isPriority ? 1 : 3
  });
}

/**
 * Adapt pathway strengths based on cognitive state
 * @param {Object} cogState - Current cognitive state
 * @param {Object} syncState - Current synchronization state
 */
function adaptPathwayStrengths(cogState, syncState) {
  // Adjust based on dominant hemisphere
  if (cogState.dominantHemisphere === 'left') {
    // Strengthen analytical pathways
    bridgeState.pathwayStrengths.analytical = Math.min(1.0, bridgeState.pathwayStrengths.analytical + 0.05);
    bridgeState.pathwayStrengths.creative = Math.max(0.3, bridgeState.pathwayStrengths.creative - 0.02);
  } 
  else if (cogState.dominantHemisphere === 'right') {
    // Strengthen creative pathways
    bridgeState.pathwayStrengths.creative = Math.min(1.0, bridgeState.pathwayStrengths.creative + 0.05);
    bridgeState.pathwayStrengths.analytical = Math.max(0.3, bridgeState.pathwayStrengths.analytical - 0.02);
  }
  else {
    // Balanced processing
    bridgeState.pathwayStrengths.analytical = adaptToTarget(bridgeState.pathwayStrengths.analytical, 0.8);
    bridgeState.pathwayStrengths.creative = adaptToTarget(bridgeState.pathwayStrengths.creative, 0.8);
  }
  
  // Adjust emotional pathway strength based on emotional state
  if (cogState.emotionalState && Math.abs(cogState.emotionalState.valence) > 0.5) {
    // Strong emotions strengthen emotional pathways
    bridgeState.pathwayStrengths.emotional = Math.min(1.0, bridgeState.pathwayStrengths.emotional + 0.07);
  } else {
    // Default emotional pathway strength
    bridgeState.pathwayStrengths.emotional = adaptToTarget(bridgeState.pathwayStrengths.emotional, 0.6);
  }
  
  // Apply pathway strength changes to all pathways
  applyPathwayStrengthChanges();
}

/**
 * Apply pathway strength changes to all pathways
 */
function applyPathwayStrengthChanges() {
  // Apply to left → right pathways
  for (const [key, pathway] of pathways.leftToRight.entries()) {
    if (key.includes('logical:') || key.includes('analytical:')) {
      pathway.strength = adaptToTarget(pathway.strength, bridgeState.pathwayStrengths.analytical);
    }
    else if (key.includes('emotional:')) {
      pathway.strength = adaptToTarget(pathway.strength, bridgeState.pathwayStrengths.emotional);
    }
  }
  
  // Apply to right → left pathways
  for (const [key, pathway] of pathways.rightToLeft.entries()) {
    if (key.includes('creative:') || key.includes('pattern:')) {
      pathway.strength = adaptToTarget(pathway.strength, bridgeState.pathwayStrengths.creative);
    }
    else if (key.includes('emotional:')) {
      pathway.strength = adaptToTarget(pathway.strength, bridgeState.pathwayStrengths.emotional);
    }
  }
}

/**
 * Gradually adapt a value toward a target
 * @param {number} current - Current value
 * @param {number} target - Target value
 * @param {number} rate - Adaptation rate
 * @returns {number} - Adapted value
 */
function adaptToTarget(current, target, rate = 0.1) {
  return current + (target - current) * rate;
}

/**
 * Create a new pathway between hemispheres
 * @param {Object} pathwayInfo - Pathway information
 * @returns {Promise<Object>} - Created pathway
 */
export async function createNewPathway(pathwayInfo) {
  const { sourceNode, targetNode, direction, strength } = pathwayInfo;
  
  if (!sourceNode || !targetNode || !direction) {
    throw new Error('Missing required pathway information');
  }
  
  const pathway = createPathway(
    sourceNode,
    targetNode,
    direction,
    strength || 0.5
  );
  
  // Publish pathway creation event
  publish('neural:pathway:created', {
    sourceNode,
    targetNode,
    direction,
    strength: pathway.strength
  }, {
    source: 'bridge',
    priority: 3
  });
  
  return pathway;
}

/**
 * Get the current bridge state
 * @returns {Object} - Bridge state
 */
export function getBridgeState() {
  return { ...bridgeState };
}

/**
 * Trigger an immediate integration for a specific context
 * @param {string} contextName - Context to integrate
 * @returns {Promise<Object>} - Integration result
 */
export async function triggerContextIntegration(contextName) {
  if (!pathways.integrationContexts.has(contextName)) {
    throw new Error(`Unknown integration context: ${contextName}`);
  }
  
  return new Promise(resolve => {
    // Set up a one-time listener for the integration result
    const unsubscribe = subscribe('neural:context:integrated', (result) => {
      if (result.context === contextName) {
        unsubscribe();
        resolve(result);
      }
    }, {
      hemisphere: 'bridge',
      priority: 2
    });
    
    // Process the context with priority
    processIntegrationContext(contextName, { priority: true });
  });
}
