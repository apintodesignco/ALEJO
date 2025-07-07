# ALEJO Ethics Layer

This directory contains the ethics components of the ALEJO Integration & Ethics Layer, which provides value alignment, ethical boundary enforcement, and transparency for the ALEJO system.

## Architecture

The ethics layer consists of the following key components:

### Core Ethics Components

1. **Boundary Enforcer** (`boundary_enforcer.js`)
   - Prevents harmful behavior by enforcing ethical boundaries
   - Supports multiple enforcement levels (block, warn, monitor, inform)
   - Configurable by category (safety, legal, privacy, ethics, etc.)

2. **Value Alignment** (`value_alignment.js`)
   - Ensures outputs align with user's values and preferences
   - Supports personalized value domains (privacy, autonomy, transparency, etc.)
   - Learns from user feedback to improve alignment over time

3. **Transparency** (`transparency.js`)
   - Provides explanations for ALEJO's decisions and data usage
   - Supports multiple detail levels and formats for explanations
   - Generates decision traces and data usage reports

4. **Ethics Manager** (`index.js`)
   - Provides a unified interface to all ethics components
   - Simplifies integration with other ALEJO modules
   - Coordinates ethics checks across components

## Integration Points

The ethics layer integrates with other ALEJO components through the following mechanisms:

1. **Security Layer Integration**
   - Ethics components are accessible through the security manager
   - Boundary enforcement is part of security checks
   - Value alignment complements privacy and consent enforcement

2. **Event-Driven Architecture**
   - Components emit events that other modules can listen for
   - Supports asynchronous, reactive updates

3. **Direct API Calls**
   - Components expose methods that can be called directly
   - Ethics manager provides a simplified interface

## Usage Examples

### Boundary Enforcement

```javascript
import { boundaryEnforcer, BOUNDARY_CATEGORIES } from '../integration/ethics/boundary_enforcer.js';

// Check if content respects boundaries
const content = userInput;
const boundaryCheck = boundaryEnforcer.checkBoundaries(content);

if (boundaryCheck.allowed) {
  // Process content normally
  processUserInput(content);
} else {
  // Handle boundary violation
  handleBoundaryViolation(boundaryCheck.violations);
}
```

### Value Alignment

```javascript
import { valueAlignment, VALUE_DOMAINS } from '../integration/ethics/value_alignment.js';

// Set user's value preference
valueAlignment.setValuePreference(
  VALUE_DOMAINS.PRIVACY,
  'HIGH',
  { 
    source: 'explicit',
    examples: ['Do not share my data with third parties']
  }
);

// Check if content aligns with user's values
const content = generatedResponse;
const alignmentCheck = valueAlignment.checkValueAlignment(content);

if (alignmentCheck.aligned) {
  // Send response to user
  sendResponse(content);
} else {
  // Modify response to better align with values
  const alternatives = valueAlignment.provideValueAlignedAlternatives(
    content,
    alignmentCheck.misalignments.map(m => m.domain)
  );
  sendResponse(alternatives[0] || content);
}
```

### Transparency

```javascript
import { transparency, TRANSPARENCY_CATEGORIES, DETAIL_LEVELS } from '../integration/ethics/transparency.js';

// Generate explanation for data usage
const explanation = transparency.generateExplanation(
  TRANSPARENCY_CATEGORIES.DATA_USAGE,
  {
    data_types: 'location data, preferences',
    storage_location: 'locally on your device',
    retention_period: '30 days'
  },
  { detailLevel: DETAIL_LEVELS.DETAILED }
);

// Show explanation to user
showExplanation(explanation);

// Generate decision trace
const decisionTrace = transparency.generateDecisionTrace({
  id: 'recommendation-123',
  inputs: { query: 'restaurant recommendation', location: 'current' },
  steps: [
    { name: 'retrieve_preferences', result: 'success' },
    { name: 'find_nearby_restaurants', result: 'success' },
    { name: 'rank_by_preference', result: 'success' }
  ],
  confidence: 0.92
});

// Log decision trace
logDecisionTrace(decisionTrace);
```

### Ethics Manager

```javascript
import { ethicsManager } from '../integration/ethics/index.js';

// Initialize ethics manager
await ethicsManager.initialize({
  boundaries: { strictMode: true },
  values: { enableLearning: true },
  transparency: { defaultDetailLevel: 'standard' }
});

// Create safe response
const safeResponse = ethicsManager.createSafeResponse(
  generatedContent,
  { includeExplanation: true }
);

if (safeResponse.safe) {
  // Send response to user
  sendResponse(safeResponse.modified);
} else {
  // Send modified response with explanation
  sendResponse(safeResponse.modified, safeResponse.explanation);
}
```

## Configuration

Each component can be configured independently through its `updateConfiguration` method:

```javascript
import { transparency, DETAIL_LEVELS } from '../integration/ethics/transparency.js';

// Configure transparency
transparency.updateConfiguration({
  defaultDetailLevel: DETAIL_LEVELS.DETAILED,
  defaultFormat: 'html',
  includeConfidenceScores: true
});
```

Alternatively, all components can be configured through the ethics manager:

```javascript
import { ethicsManager } from '../integration/ethics/index.js';

// Initialize with configuration
await ethicsManager.initialize({
  boundaries: { strictMode: true, enableAudit: true },
  values: { enableLearning: true, strictAlignment: false },
  transparency: { defaultDetailLevel: 'standard', includeConfidenceScores: true }
});
```

## Testing

Comprehensive unit and integration tests are available in the `tests` directory:

- `test_ethics_components.js`: Unit tests for individual ethics components
- `test_security_integration.js`: Integration tests for ethics components working with security components

Run tests using the following command:

```bash
npm test
```

## Default Settings

By default, the ethics layer is configured with balanced settings:

- Boundary enforcement is enabled for safety, legal, and privacy categories
- Value alignment learning is enabled but not strictly enforced
- Transparency provides standard-level explanations in text format
- Ethics checks are integrated with security checks

These settings can be adjusted based on deployment requirements and user preferences.

## Future Enhancements

Planned enhancements for the ethics layer include:

1. Advanced value learning from implicit user feedback
2. Contextual boundary enforcement based on user intent
3. Interactive explanations with follow-up questions
4. Cultural value adaptation for different user backgrounds
5. Ethical dilemma resolution with multiple stakeholder perspectives
