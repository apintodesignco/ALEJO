# ALEJO Eye Tracking Deployment Guide

This guide provides detailed instructions for deploying and integrating the eye tracking modules into your ALEJO application.

## Overview

The ALEJO eye tracking system provides advanced biometric capabilities including:

- Pupil detection and tracking
- Gaze estimation
- Blink detection
- Saccade detection
- Multi-point calibration
- Privacy-focused processing
- Accessibility features

All processing happens locally on the client device, ensuring user privacy while providing powerful eye tracking capabilities.

## Prerequisites

Before deploying the eye tracking modules, ensure you have:

1. ALEJO core system installed and configured
2. Face detection modules working properly
3. Node.js 16+ and npm installed
4. Required dependencies installed:

   - face-api.js
   - tensorflow.js
   - express (for demo server)

## Deployment Steps

### 1. Automated Deployment

The easiest way to deploy the eye tracking modules is using the automated deployment script:

```bash
npm run deploy:eye-tracking
```

This script will:
- Verify all required files are present
- Check and install dependencies
- Run tests to ensure everything works correctly
- Update version tags
- Prepare a GitHub release

### 2. Manual Integration

If you prefer manual integration, follow these steps:

1. **Ensure all required files are present:**
   - `src/biometrics/eye/tracking.js`
   - `src/biometrics/eye/calibration.js`
   - `src/biometrics/eye/processor.js`
   - `src/biometrics/index.js` (with eye tracking integration)

2. **Update your biometrics configuration:**

   ```javascript
   const biometricsConfig = {
     // Existing config...
     eyeTracking: {
       enabled: true,
       processingInterval: 100, // ms between processing frames
       adaptiveProcessing: true, // Adjust based on device performance
       debugMode: false, // Show debug visualization
       privacyMode: 'none', // 'none', 'blur', or 'mask'
       smoothingFactor: 0.7, // 0-1, higher = smoother but more latency
       performanceMode: 'balanced', // 'high-performance', 'balanced', 'power-saver'
       accessibility: {
         highContrastMode: false,
         largerTargets: false,
         slowerAnimations: false,
         voicePrompts: false,
         extraTime: false
       }
     }
   };
   ```

3. **Initialize the biometrics system with eye tracking:**

   ```javascript
   import { initializeBiometrics } from './src/biometrics';

   const biometrics = await initializeBiometrics({
     faceDetection: { enabled: true },
     eyeTracking: { enabled: true }
   });
   ```

4. **Subscribe to eye tracking events:**

   ```javascript
   import { subscribe } from './src/events';

   // Listen for gaze updates
   subscribe('eye:gaze:updated', (gazeData) => {
     const { x, y, confidence } = gazeData;
     // Use gaze coordinates
   });

   // Listen for blinks
   subscribe('eye:blink:detected', (blinkData) => {
     const { duration, strength } = blinkData;
     // Handle blink event
   });

   // Listen for saccades (rapid eye movements)
   subscribe('eye:saccade:detected', (saccadeData) => {
     const { startPoint, endPoint, velocity } = saccadeData;
     // Handle saccade event
   });
   ```

5. **Run tests to verify integration:**

   ```bash
   npm run test:eye-tracking
   ```

## Running the Demo

To see the eye tracking modules in action:

```bash
npm run demo:eye-tracking
```

This will start a local server and open the eye tracking demo in your browser. The demo showcases:

- Real-time eye tracking visualization
- Calibration procedure
- Blink and saccade detection
- Privacy modes (blur, mask)
- Accessibility options

## Calibration Process

For accurate eye tracking, users need to complete a calibration process:

1. The system will display a series of points on the screen
2. The user follows these points with their eyes
3. The system builds a mapping between eye positions and screen coordinates
4. Calibration data is stored locally for the session

Calibration can be triggered programmatically:

```javascript
import { publish } from './src/events';

// Start calibration
publish('eye:calibration:start', { 
  points: 5, // Number of calibration points (3, 5, or 9)
  speed: 'normal' // 'slow', 'normal', or 'fast'
});

// Listen for calibration completion
subscribe('eye:calibration:completed', (calibrationData) => {
  const { accuracy, mappingQuality } = calibrationData;
  // Calibration finished successfully
});
```

## Privacy Considerations

The eye tracking system is designed with privacy as a core principle:

- All processing happens locally on the client device
- No biometric data is sent to external servers
- Privacy modes allow blurring or masking of eye regions
- Users must explicitly consent to eye tracking
- Calibration data is stored in memory only (not persisted)

## Accessibility Features

The eye tracking system includes several accessibility features:

- High contrast mode for better visibility
- Larger calibration targets for easier tracking
- Slower animations for users who need more time
- Voice prompts for audio guidance
- Extra time allowance for calibration steps

Enable these features through the configuration:

```javascript
biometrics.updateConfig({
  eyeTracking: {
    accessibility: {
      highContrastMode: true,
      largerTargets: true,
      slowerAnimations: true,
      voicePrompts: true,
      extraTime: true
    }
  }
});
```

## Troubleshooting

### Common Issues

1. **Calibration fails or is inaccurate**
   - Ensure good lighting conditions
   - Position face directly in front of camera
   - Try increasing the number of calibration points
   - Enable larger targets for easier tracking

2. **Performance issues**
   - Reduce processing interval
   - Enable adaptive processing
   - Switch to 'power-saver' performance mode
   - Close other resource-intensive applications

3. **Eye tracking not working**
   - Verify face detection is working properly
   - Check camera permissions
   - Ensure user has completed calibration
   - Verify eye tracking is enabled in config

### Debugging

Enable debug mode to visualize eye tracking in real-time:

```javascript
biometrics.updateConfig({
  eyeTracking: {
    debugMode: true
  }
});
```

This will show:
- Face landmarks
- Eye regions
- Pupil detection
- Gaze direction
- Blink status

## Integration with Other ALEJO Modules

The eye tracking system integrates seamlessly with other ALEJO modules:

### Gesture System

Combine eye tracking with hand gestures for multimodal interaction:

```javascript
subscribe(['eye:gaze:updated', 'gesture:detected'], ([gazeData, gestureData]) => {
  // Combine gaze position with gesture type
  const { x, y } = gazeData;
  const { gesture } = gestureData;
  
  // Example: look at object then pinch to select
  if (gesture === 'pinch' && isGazeOnSelectableObject(x, y)) {
    selectObject(getObjectAtPosition(x, y));
  }
});
```

### Personalization System

Use eye tracking data to enhance personalization:

```javascript
import { personalization } from './src/personalization';

// Track what content the user looks at most
subscribe('eye:gaze:updated', (gazeData) => {
  const contentBeingViewed = getContentAtGaze(gazeData);
  personalization.trackInterest(contentBeingViewed);
});
```

### Accessibility System

Integrate with accessibility features:

```javascript
import { accessibility } from './src/accessibility';

// Detect if user might need visual assistance
subscribe('eye:tracking:statistics', (stats) => {
  if (stats.trackingDifficulty > 0.7) {
    accessibility.suggestVisualAssistance();
  }
});
```

## Performance Optimization

To optimize performance:

1. **Adjust processing interval** based on device capabilities
2. **Enable adaptive processing** to automatically balance performance
3. **Use appropriate performance mode** for the user's device
4. **Implement throttling** for high-frequency events like gaze updates

Example:

```javascript
// Throttle gaze updates based on device performance
const throttleFactor = navigator.hardwareConcurrency < 4 ? 3 : 1;

biometrics.updateConfig({
  eyeTracking: {
    processingInterval: 100 * throttleFactor,
    adaptiveProcessing: true,
    performanceMode: navigator.hardwareConcurrency < 4 ? 'power-saver' : 'balanced'
  }
});
```

## Future Enhancements

Planned enhancements for the eye tracking system include:

- Advanced gaze prediction for smoother tracking
- Eye-based UI control (dwell clicking, scroll control)
- Attention analysis and heatmapping
- Multi-person eye tracking
- Integration with AR/VR experiences
- Improved accessibility features

## References

- [Eye Tracking Documentation](./eye-tracking.md)
- [Biometrics System Overview](./biometrics-overview.md)
- [Face Detection Integration](./face-detection.md)
- [ALEJO Accessibility Guidelines](../accessibility/guidelines.md)

## Support

For issues or questions about the eye tracking system:

1. Check the [troubleshooting section](#troubleshooting)

2. Run the diagnostic tests: `npm run test:eye-tracking`

3. File an issue on the [ALEJO GitHub repository](https://github.com/apintodesignco/ALEJO)
