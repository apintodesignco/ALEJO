# ALEJO Biometrics System

## Overview

The ALEJO Biometrics System provides local-first processing for facial, eye, and hand biometrics without external API dependencies. This system integrates with face-api.js and handpose libraries for detection and tracking capabilities.

## Features

- **Face Detection & Analysis**: Facial landmark detection, expression analysis, and face recognition
- **Eye Tracking**: Gaze estimation, blink detection, saccade detection, and calibration
- **Hand Tracking**: Hand pose estimation, gesture recognition, and finger tracking
- **Privacy Controls**: Local-first processing, data purging, and privacy modes
- **Accessibility Features**: High contrast mode, larger targets, slower animations, and voice prompts
- **Event-Driven Architecture**: Comprehensive event system for integration with other modules

## Integration

The biometrics system is designed to be easily integrated with other ALEJO modules through the event system. The main entry point is the `initializeBiometrics` function, which returns a public API for controlling the biometrics system.

```javascript
import { initializeBiometrics } from './biometrics';

const biometrics = await initializeBiometrics({
  eyeTracking: {
    enabled: true,
    calibrationRequired: true
  }
});

// Start processing
await biometrics.startProcessing();

// Later, stop processing
await biometrics.stopProcessing();
```

## Eye Tracking Module

The eye tracking module provides comprehensive eye tracking capabilities:

- **Gaze Estimation**: Track where the user is looking on the screen
- **Blink Detection**: Detect when the user blinks
- **Saccade Detection**: Detect rapid eye movements
- **Calibration**: Multi-point calibration for accurate gaze estimation
- **Accessibility Features**: Support for users with different needs
- **Privacy Modes**: Control how eye tracking data is processed and displayed

### Eye Tracking Events

The eye tracking module publishes the following events:

- `eye:gaze:updated`: When the user's gaze position changes
- `eye:blink:detected`: When a blink is detected
- `eye:saccade:detected`: When a saccade is detected
- `eye:calibration:started`: When calibration begins
- `eye:calibration:point:collected`: When a calibration point is collected
- `eye:calibration:completed`: When calibration is completed
- `eye:calibration:canceled`: When calibration is canceled
- `eye:module:initialized`: When the eye tracking module is initialized
- `eye:config:updated`: When the eye tracking configuration is updated

## Testing

Comprehensive testing is available for all biometrics modules:

- **Unit Tests**: Test individual functions and components
- **Integration Tests**: Test interactions between components
- **System Tests**: Test the entire biometrics system

Run the tests using the provided batch scripts:

- `run-eye-tracking-tests.bat`: Run all eye tracking tests

## Security and Privacy

The biometrics system is designed with security and privacy in mind:

- All processing is done locally on the user's device
- No raw biometric data is sent to external servers
- Data is automatically purged after a configurable retention period
- Privacy modes control how biometric data is processed and displayed
- Integration with ALEJO's Role-Based Access Control (RBAC) system

## Deployment

The biometrics system is deployed as part of the ALEJO platform. See the CI/CD workflow in `.github/workflows/eye-tracking-ci.yml` for details on the automated build, test, and deployment process.
