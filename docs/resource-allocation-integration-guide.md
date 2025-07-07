# ALEJO Resource Allocation Manager Integration Guide

## Overview

This guide explains how to integrate ALEJO modules with the Resource Allocation Manager (RAM) to ensure optimal performance across different resource modes while maintaining accessibility as the highest priority.

## Core Principles

1. **Accessibility First**: Accessibility features are always marked as essential and given the highest priority.
2. **Resource Efficiency**: Modules adapt their resource usage based on the current system state.
3. **Local-First Processing**: All resource management happens locally on the user's device.
4. **Graceful Degradation**: Non-essential features are progressively reduced as resources become constrained.

## Integration Pattern

ALEJO uses a standardized pattern for integrating modules with the Resource Allocation Manager:

### 1. Module Component Configuration

Define your module's components with appropriate priorities and resource requirements:

```javascript
const myComponentConfigs = {
  mainComponent: {
    type: COMPONENT_TYPES.UI_COMPONENT,
    pauseEvent: 'myModule:main:pause',
    resumeEvent: 'myModule:main:resume',
    reduceEvent: 'myModule:main:reduce_resources',
    cpuPriority: 5, // 1-10 scale, 10 is highest
    memoryFootprint: 20, // MB estimate
    isEssential: false // true for critical components
  },
  // Add more components as needed
};
```

### 2. Create Module Integration

Use the `createModuleIntegration` helper to create a standardized integration:

```javascript
import { createModuleIntegration, COMPONENT_TYPES, RESOURCE_MODES } from '../../performance/index.js';

const myModuleIntegration = createModuleIntegration('myModuleName', myComponentConfigs, {
  // Handle mode changes
  onModeChange: (mode, reason) => {
    console.log(`[MyModule] Adapting to resource mode: ${mode}`);
    
    // Adapt features based on resource mode
    switch (mode) {
      case RESOURCE_MODES.FULL:
        // Maximum quality and features
        publish('myModule:config', { /* full config */ });
        break;
      case RESOURCE_MODES.BALANCED:
        // Balanced config
        publish('myModule:config', { /* balanced config */ });
        break;
      case RESOURCE_MODES.CONSERVATIVE:
        // Reduced config
        publish('myModule:config', { /* conservative config */ });
        break;
      case RESOURCE_MODES.MINIMAL:
        // Minimal config
        publish('myModule:config', { /* minimal config */ });
        break;
    }
  }
});

// Export the public API
export const {
  registerWithResourceManager,
  unregisterFromResourceManager,
  getCurrentResourceMode
} = myModuleIntegration;
```

### 3. Update Your Module's Main File

In your module's main file, import and use the integration functions:

```javascript
import { registerWithResourceManager, unregisterFromResourceManager } from './performance-integration.js';

// During initialization
registerWithResourceManager();

// During cleanup
unregisterFromResourceManager();
```

## Priority Guidelines

When assigning priorities to components, follow these guidelines:

1. **Accessibility Components (Priority 9-10)**
   - Screen readers, sign language recognition, visual aids for impaired users
   - Always mark as `isEssential: true`

2. **Core System Components (Priority 7-8)**
   - Main reasoning engine, truth validation, core UI components
   - Critical components should be marked as `isEssential: true`

3. **Standard Features (Priority 4-6)**
   - Voice recognition, face detection, standard UI components
   - Typically not marked as essential

4. **Background Tasks (Priority 1-3)**
   - Training, data processing, non-critical analytics
   - Never mark as essential

## Resource Modes

The system supports four resource modes that modules should adapt to:

1. **FULL**: All features enabled at maximum quality
2. **BALANCED**: Slightly reduced quality but all essential features active
3. **CONSERVATIVE**: Reduced quality with some non-essential features disabled
4. **MINIMAL**: Minimum quality with only essential features active

## Testing Your Integration

Use the test script at `src/tests/performance-integration-test.js` to verify your integration works correctly with the Resource Allocation Manager.

## Best Practices

1. **Audit Trail**: Log significant resource-related events for debugging and compliance
2. **UI Feedback**: Update UI elements to reflect the current resource mode
3. **Graceful Handling**: Handle resource mode changes smoothly without disrupting user experience
4. **Accessibility Priority**: Always ensure accessibility features remain functional even in minimal mode

## Example Implementations

For reference implementations, see:
- `src/personalization/accessibility/performance-integration.js`
- `src/personalization/voice/performance-integration.js`
- `src/personalization/vision/performance-integration.js`
- `src/reasoning/performance-integration.js`
