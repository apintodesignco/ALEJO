# Vision-Voice Fusion Testing Guide

This document provides comprehensive guidance for testing the Vision-Voice Fusion module in ALEJO, covering unit tests, integration tests, and end-to-end testing approaches.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Unit Testing](#unit-testing)
4. [Integration Testing](#integration-testing)
5. [End-to-End Testing](#end-to-end-testing)
6. [Performance Testing](#performance-testing)
7. [Security Testing](#security-testing)
8. [Troubleshooting](#troubleshooting)

## Overview

The Vision-Voice Fusion module is a critical component of ALEJO's multimodal understanding system. It combines inputs from the vision system (facial expressions, identity) and voice system (speech emotion, commands, verification) to provide enhanced understanding of user intent and emotional state.

Testing this module requires verifying:
- Proper event handling and subscription
- Accurate fusion of multimodal inputs
- Temporal alignment of inputs
- Security and privacy compliance
- Performance under various conditions

## Prerequisites

Before running tests, ensure you have:

1. Node.js 16+ installed
2. All dependencies installed (`npm install`)
3. Face-API.js models downloaded to the `public/models` directory
4. Access to a webcam and microphone for E2E testing
5. Vitest test runner configured in your project

## Unit Testing

The unit tests for the Vision-Voice Fusion module are located in `test/integration/fusion/vision-voice-fusion.test.js`.

### Running Unit Tests

```bash
# Run all fusion tests
npm test -- --dir=test/integration/fusion

# Run specific test file
npm test -- test/integration/fusion/vision-voice-fusion.test.js

# Run with coverage
npm run coverage -- --dir=test/integration/fusion
```

### Test Coverage

The unit tests cover:

1. **Initialization**
   - Default and custom configuration
   - Consent handling
   - Event subscription
   - Error handling

2. **Event Handling**
   - Voice emotion events
   - Facial expression events
   - Voice command events
   - Identity verification events
   - Buffer management

3. **Fusion Logic**
   - Emotional state fusion
   - Identity verification fusion
   - Command intent with emotional context
   - Temporal window constraints
   - Confidence thresholds

4. **Utility Functions**
   - Emotion/expression format mapping
   - Weighted fusion algorithm
   - Buffer management

5. **Lifecycle Management**
   - Reset functionality
   - Shutdown procedure
   - Resource cleanup

## Integration Testing

Integration tests verify that the Vision-Voice Fusion module works correctly with other ALEJO components.

### Running Integration Tests

Integration tests are included in the GitHub Actions workflow and can be run locally:

```bash
# Run the integration test suite
npm run test:integration
```

### Key Integration Points to Test

1. **Event Bus Integration**
   - Verify that the fusion module correctly subscribes to vision and voice events
   - Ensure fused events are properly emitted on the event bus

2. **Security Integration**
   - Test consent management integration
   - Verify audit trail logging
   - Check privacy controls

3. **Vision System Integration**
   - Test with real facial expression events
   - Verify face verification event handling

4. **Voice System Integration**
   - Test with real voice emotion events
   - Verify voice command and verification handling

## End-to-End Testing

End-to-end tests validate the complete user experience with the Vision-Voice Fusion module.

### Running the Demo Application

The demo application in `examples/vision-voice-fusion-demo.js` provides a browser-based interface for testing:

1. Open `examples/vision-voice-fusion-demo.html` in a browser
2. Grant camera and microphone permissions
3. Observe the fusion of facial expressions and voice inputs

### Manual Testing Scenarios

1. **Emotional State Fusion**
   - Express different emotions while speaking
   - Verify that the fused emotional state accurately reflects both inputs

2. **Identity Verification**
   - Test with registered and unregistered users
   - Verify that both face and voice must match for successful verification

3. **Command Enhancement**
   - Issue voice commands with different emotional expressions
   - Verify that the emotional context is correctly associated with commands

4. **Edge Cases**
   - Test with poor lighting conditions
   - Test with background noise
   - Test with multiple faces in frame

## Performance Testing

Performance testing ensures the Vision-Voice Fusion module operates efficiently.

### Metrics to Monitor

1. **Processing Time**
   - Measure the time from input capture to fusion result
   - Should be under 200ms for real-time interaction

2. **CPU Usage**
   - Monitor CPU usage during fusion operations
   - Should not exceed 15% of available CPU

3. **Memory Usage**
   - Track memory consumption over time
   - Check for memory leaks during extended operation

### Performance Test Script

A performance test script is available at `test/performance/fusion-performance.js` that:
- Simulates high-frequency events
- Measures processing time and resource usage
- Reports on performance metrics

## Security Testing

Security testing verifies that the Vision-Voice Fusion module adheres to privacy and security requirements.

### Security Test Checklist

1. **Consent Management**
   - Verify that fusion does not occur without proper consent
   - Test consent revocation scenarios

2. **Data Handling**
   - Ensure biometric data is not persisted unnecessarily
   - Verify buffer pruning and cleanup

3. **Audit Trail**
   - Confirm all fusion operations are properly logged
   - Verify sensitive data is not exposed in logs

## Troubleshooting

Common issues and their solutions:

### Missing Events

If fusion events are not being emitted:
1. Check that both vision and voice systems are initialized
2. Verify that events are being emitted within the temporal window
3. Ensure confidence values exceed the configured threshold

### Incorrect Fusion Results

If fusion results are inaccurate:
1. Check the modality weights in the configuration
2. Verify the mapping functions for emotions and expressions
3. Ensure the input data is correctly formatted

### Performance Issues

If fusion is slow or resource-intensive:
1. Reduce the buffer size
2. Increase the temporal window
3. Adjust the processing frequency

## Automated Testing with GitHub Actions

The Vision-Voice Fusion module is automatically tested on each pull request and push to main branches using GitHub Actions.

The workflow configuration is in `.github/workflows/fusion-integration-tests.yml` and includes:
1. Running all fusion-related tests
2. Generating coverage reports
3. Uploading test artifacts for review

To view test results, check the Actions tab in the GitHub repository after each workflow run.
