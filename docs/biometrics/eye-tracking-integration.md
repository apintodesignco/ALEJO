# Eye Tracking Integration Guide

## Overview

This document provides detailed information on integrating the ALEJO eye tracking system with other components of the platform. The eye tracking system is designed to be modular, event-driven, and privacy-focused, making it easy to integrate with other biometric systems and user interfaces.

## Architecture

The eye tracking system consists of several key components:

1. **Eye Processor** (`src/biometrics/eye/eye-processor.js`): Core processing module that handles eye detection, gaze estimation, blink detection, and saccade detection.

2. **Eye Tracking Module** (`src/biometrics/eye/index.js`): Integration layer that connects the eye processor with the main biometrics system, handling initialization, events, and lifecycle management.

3. **Biometrics System** (`src/biometrics/index.js`): Main entry point for all biometric processing, including face, hand, and eye tracking.

4. **Demo Application** (`demos/eye-tracking-demo.html`): Example implementation showing how to use the eye tracking system in a web application.

## Integration Steps

### 1. Initialize the Biometrics System

The first step is to initialize the biometrics system with eye tracking enabled:

```javascript
import { initializeBiometrics } from './biometrics';

const biometrics = await initializeBiometrics({
  eyeTracking: {
    enabled: true,
    calibrationRequired: true,
    trackPupils: true,
    trackGaze: true,
    trackBlinks: true,
    processingIntervalMs: 50,
    adaptiveProcessing: true,
    debugMode: false,
    privacyMode: 'none',
    smoothingFactor: 0.7,
    performanceMode: 'balanced',
    accessibility: {
      highContrastMode: false,
      largerTargets: false,
      slowerAnimations: false,
      voicePrompts: false,
      extraTime: false
    }
  }
});
```

### 2. Start Processing

Once initialized, you can start the biometrics processing:

```javascript
await biometrics.startProcessing();
```

This will start all enabled biometric scanners, including eye tracking if it's enabled.

### 3. Subscribe to Eye Tracking Events

The eye tracking system publishes various events that you can subscribe to:

```javascript
import { subscribe } from './events';

// Subscribe to gaze updates
subscribe('eye:gaze:updated', (data) => {
  const { x, y, timestamp, confidence } = data;
  // Update UI or process gaze data
});

// Subscribe to blink detection
subscribe('eye:blink:detected', (data) => {
  const { timestamp, duration } = data;
  // Handle blink event
});

// Subscribe to calibration events
subscribe('eye:calibration:completed', (data) => {
  const { accuracy, points } = data;
  // Handle calibration completion
});
```

### 4. Calibration

Eye tracking requires calibration for accurate gaze estimation. You can start the calibration process like this:

```javascript
import { publish } from './events';

// Request calibration
publish('calibration:request:eye-tracking', {
  pointCount: 9,  // Number of calibration points (5, 9, or 13)
  speed: 'normal', // 'slow', 'normal', or 'fast'
  targetSize: 'medium' // 'small', 'medium', or 'large'
});
```

Alternatively, you can use the biometrics API directly:

```javascript
await biometrics.calibrateEyeTracking({
  pointCount: 9,
  speed: 'normal',
  targetSize: 'medium'
});
```

### 5. Handling Accessibility Settings

The eye tracking system supports various accessibility features that can be configured:

```javascript
await biometrics.updateConfig({
  eyeTracking: {
    accessibility: {
      highContrastMode: true,
      largerTargets: true,
      slowerAnimations: true,
      voicePrompts: false,
      extraTime: true
    }
  }
});
```

### 6. Privacy Modes

The eye tracking system supports different privacy modes:

- `none`: No privacy protection, raw data is used
- `blur`: Eye data is blurred to reduce precision
- `abstract`: Only abstract representations of eye data are used

```javascript
await biometrics.updateConfig({
  eyeTracking: {
    privacyMode: 'blur'
  }
});
```

### 7. Stopping and Cleaning Up

When you're done with eye tracking, you should stop processing and clean up:

```javascript
await biometrics.stopProcessing();
```

## Event Reference

The eye tracking system publishes the following events:

| Event | Description | Data |
|-------|-------------|------|
| `eye:gaze:updated` | Fired when the gaze position is updated | `{ x, y, timestamp, confidence }` |
| `eye:blink:detected` | Fired when a blink is detected | `{ timestamp, duration }` |
| `eye:saccade:detected` | Fired when a saccade is detected | `{ timestamp, amplitude, direction }` |
| `eye:calibration:started` | Fired when calibration begins | `{ timestamp, pointCount }` |
| `eye:calibration:point:collected` | Fired when a calibration point is collected | `{ point, index, timestamp }` |
| `eye:calibration:completed` | Fired when calibration is completed | `{ timestamp, accuracy, points }` |
| `eye:calibration:canceled` | Fired when calibration is canceled | `{ timestamp, reason }` |
| `eye:module:initialized` | Fired when the eye tracking module is initialized | `{ timestamp, config }` |
| `eye:config:updated` | Fired when the eye tracking configuration is updated | `{ timestamp, config }` |

## Configuration Options

The eye tracking system supports the following configuration options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | Boolean | `false` | Whether eye tracking is enabled |
| `calibrationRequired` | Boolean | `true` | Whether calibration is required before use |
| `trackPupils` | Boolean | `true` | Whether to track pupil positions |
| `trackGaze` | Boolean | `true` | Whether to estimate gaze position |
| `trackBlinks` | Boolean | `true` | Whether to detect blinks |
| `processingIntervalMs` | Number | `50` | Processing interval in milliseconds |
| `adaptiveProcessing` | Boolean | `true` | Whether to adapt processing based on system resources |
| `debugMode` | Boolean | `false` | Whether to enable debug mode |
| `privacyMode` | String | `'none'` | Privacy mode (`'none'`, `'blur'`, or `'abstract'`) |
| `smoothingFactor` | Number | `0.7` | Smoothing factor for gaze estimation (0-1) |
| `performanceMode` | String | `'balanced'` | Performance mode (`'high'`, `'balanced'`, or `'low'`) |
| `accessibility` | Object | `{}` | Accessibility settings |

## Testing

The eye tracking system includes comprehensive tests:

- **Unit Tests**: Test individual functions and components (`tests/unit/eye-tracking-test.js`)
- **Integration Tests**: Test interactions between components (`tests/integration/eye-tracking-integration-test.js`)
- **System Tests**: Test the entire eye tracking system (`tests/integration/eye-tracking-system-test.js`)

Run the tests using the provided batch script:

```bash
run-eye-tracking-tests.bat
```

## Troubleshooting

### Common Issues

1. **Calibration fails**: Ensure the user is positioned correctly and the lighting is adequate.
2. **Gaze estimation is inaccurate**: Try recalibrating or adjusting the smoothing factor.
3. **Performance issues**: Adjust the processing interval or enable adaptive processing.
4. **Browser compatibility**: Ensure the browser supports the required APIs (getUserMedia, etc.).

### Debugging

Enable debug mode to get more detailed information:

```javascript
await biometrics.updateConfig({
  eyeTracking: {
    debugMode: true
  }
});
```

This will output additional information to the console and may visualize eye tracking data on the screen.

## Best Practices

1. **Always calibrate**: For accurate gaze estimation, always perform calibration before use.
2. **Consider privacy**: Use appropriate privacy modes based on the context.
3. **Accessibility first**: Configure accessibility settings based on user needs.
4. **Resource management**: Use adaptive processing to manage system resources.
5. **Event-driven architecture**: Use the event system for loose coupling between components.

## References

- [Face-API.js Documentation](https://github.com/justadudewhohacks/face-api.js)
- [ALEJO Biometrics System](../../src/biometrics/README.md)
- [Eye Tracking Deployment Guide](./eye-tracking-deployment.md)
