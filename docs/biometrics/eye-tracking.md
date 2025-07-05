# ALEJO Eye Tracking System

## Overview

The ALEJO Eye Tracking System is a comprehensive, privacy-focused, local-first biometric system for tracking and analyzing eye movements, gaze direction, and blink patterns. It's designed to work seamlessly with ALEJO's existing face and hand tracking capabilities, providing a complete biometric solution.

## Architecture

The eye tracking system consists of three main modules:

1. **Eye Tracking Module** (`src/biometrics/eye/tracking.js`)
   - Core eye tracking functionality
   - Pupil detection and tracking
   - Gaze estimation
   - Blink and saccade detection
   - Eye movement pattern analysis

2. **Eye Calibration Module** (`src/biometrics/eye/calibration.js`)
   - Multi-point calibration procedure
   - Calibration accuracy assessment
   - Accessibility-focused calibration UI
   - Calibration state management

3. **Eye Processor Module** (`src/biometrics/eye/processor.js`)
   - Video frame processing
   - Integration with face detection
   - Privacy filters
   - Debug visualization
   - Performance optimization

## Features

- **Local-First Processing**: All processing happens client-side for maximum privacy
- **Adaptive Performance**: Automatically adjusts processing parameters based on device capabilities
- **Privacy Controls**: Configurable blur/mask filters for eye regions
- **Accessibility Support**: High contrast mode, larger targets, slower animations, voice prompts
- **Event-Driven Architecture**: Publishes events for eye tracking updates, blinks, and saccades
- **Debug Visualization**: Optional visualization of eye landmarks, pupils, and gaze direction
- **Calibration Procedure**: Multi-point calibration with visual and audio feedback

## Integration

The eye tracking system is fully integrated with ALEJO's biometrics system (`src/biometrics/index.js`). It can be enabled or disabled through configuration and works alongside face and hand tracking.

### Basic Usage

```javascript
// Initialize biometrics system with eye tracking enabled
import { initializeBiometrics } from './biometrics/index.js';

const biometrics = await initializeBiometrics({
  eyeTracking: {
    enabled: true,
    calibrationRequired: true,
    trackPupils: true,
    trackGaze: true,
    trackBlinks: true
  }
});

// Start biometric processing (including eye tracking)
await biometrics.startProcessing();

// Listen for eye tracking events
import { subscribe } from './core/event-bus.js';

// Eye tracking updates
subscribe('eye:tracking:updated', (data) => {
  const { leftPupil, rightPupil, gaze } = data;
  console.log(`Gaze position: ${gaze.x.toFixed(2)}, ${gaze.y.toFixed(2)}`);
});

// Blink detection
subscribe('eye:blink:detected', (data) => {
  console.log(`Blink detected: ${data.eye} eye, duration: ${data.duration}ms`);
});

// Saccade detection (rapid eye movements)
subscribe('eye:saccade:detected', (data) => {
  console.log(`Saccade detected: direction ${data.direction}, velocity: ${data.velocity}`);
});
```

### Calibration

```javascript
import { calibrateEyes } from './biometrics/eye/calibration.js';

// Start eye calibration
try {
  const result = await calibrateEyes({
    numPoints: 5,
    pointDurationMs: 1500,
    accessibility: {
      highContrastMode: true,
      voicePrompts: true
    }
  });
  
  console.log(`Calibration completed with accuracy: ${result.accuracy}`);
} catch (error) {
  console.error(`Calibration failed: ${error.reason}`);
}
```

## Configuration Options

### Eye Tracking Configuration

```javascript
{
  // Core functionality
  enabled: true,
  calibrationRequired: true,
  trackPupils: true,
  trackGaze: true,
  trackBlinks: true,
  trackSaccades: true,
  
  // Performance settings
  processingIntervalMs: 50,
  adaptiveProcessing: true,
  performanceMode: 'balanced', // 'high', 'balanced', 'low'
  smoothingFactor: 0.7,
  
  // Debug and privacy
  debugMode: false,
  privacyMode: 'none', // 'none', 'blur', 'mask'
  
  // Accessibility options
  accessibility: {
    highContrastMode: false,
    largerTargets: false,
    slowerAnimation: false,
    voicePrompts: false,
    extraTime: false
  }
}
```

### Calibration Configuration

```javascript
{
  numPoints: 5,
  pointDurationMs: 1500,
  pointSize: 20,
  pointColor: '#FF0000',
  backgroundColor: '#FFFFFF',
  feedbackDuration: 300,
  showProgressBar: true,
  
  // Accessibility options
  accessibility: {
    highContrastMode: false,
    largerTargets: false,
    slowerAnimation: false,
    voicePrompts: false,
    extraTime: false
  }
}
```

## Events

### Published Events

| Event Name | Description | Data |
|------------|-------------|------|
| `eye:tracking:initialized` | Eye tracking system initialized | `{ config }` |
| `eye:tracking:updated` | New eye tracking data available | `{ leftPupil, rightPupil, gaze, timestamp }` |
| `eye:blink:detected` | Blink detected | `{ eye, duration, timestamp }` |
| `eye:saccade:detected` | Rapid eye movement detected | `{ direction, velocity, timestamp }` |
| `eye:calibration:started` | Calibration procedure started | `{ numPoints, estimatedDurationMs }` |
| `eye:calibration:point:shown` | New calibration point displayed | `{ point, index, total }` |
| `eye:calibration:point:fixated` | User fixated on calibration point | `{ point, index, fixationDurationMs }` |
| `eye:calibration:completed` | Calibration procedure completed | `{ accuracy, points, durationMs }` |
| `eye:calibration:cancelled` | Calibration procedure cancelled | `{ reason }` |
| `eye:processor:started` | Eye processor started | `{ config }` |
| `eye:processor:stopped` | Eye processor stopped | `{ reason }` |
| `eye:processor:frame` | Frame processed | `{ processingTimeMs, frameIndex }` |

### Subscribed Events

| Event Name | Action |
|------------|--------|
| `face:detection:updated` | Extract eye landmarks from face detection |
| `eye:calibration:completed` | Update eye tracking with new calibration data |
| `system:memory:low` | Reduce processing frequency and complexity |
| `accessibility:settings:changed` | Update accessibility configuration |

## Privacy Considerations

The eye tracking system is designed with privacy as a core principle:

1. All processing happens locally on the client device
2. No raw eye data is sent to external servers
3. Privacy filters can blur or mask eye regions in debug visualizations
4. User consent is required before eye tracking begins
5. Data is automatically purged after use

## Accessibility Features

The eye tracking system includes several accessibility features:

1. **High Contrast Mode**: Enhances visibility of calibration points and debug visualizations
2. **Larger Targets**: Increases the size of calibration points for users with motor control or visual impairments
3. **Slower Animations**: Reduces animation speed for users who need more time to process visual information
4. **Voice Prompts**: Provides audio feedback during calibration and tracking
5. **Extra Time**: Allows more time for fixation during calibration

## Testing

Comprehensive tests are available in:

- `tests/biometrics/eye-modules.test.js` - Unit tests for individual eye tracking modules
- `tests/biometrics/eye-tracking-integration.test.js` - Integration tests with the biometrics system

## Future Enhancements

1. **Advanced Gaze Prediction**: Implement predictive algorithms for smoother gaze tracking
2. **Eye-Based UI Control**: Enable UI interaction through eye movements
3. **Attention Analysis**: Analyze attention patterns and focus areas
4. **Emotion Detection**: Combine with facial expression analysis for enhanced emotion detection
5. **Multi-Person Eye Tracking**: Track multiple users simultaneously
6. **Cross-Device Calibration**: Share calibration data across devices
7. **Eye-Based Authentication**: Use eye movement patterns as a biometric authentication factor
