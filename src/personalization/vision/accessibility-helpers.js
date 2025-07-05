/**
 * ALEJO Vision Training Accessibility Helpers
 * 
 * This module provides accessibility enhancements for the vision training UI,
 * including screen reader support, audio guidance, haptic feedback,
 * and keyboard navigation to make the vision training process
 * accessible to blind and visually impaired users.
 */

// Audio context for generating audio cues and feedback
let audioContext = null;
let audioEnabled = true;
let hapticEnabled = true;

// Screen reader announcement elements
let srAnnouncer = null;
let srLiveRegion = null;

/**
 * Initialize the accessibility helpers
 * @param {Object} config - Configuration options
 * @returns {boolean} Success status
 */
function initialize(config = {}) {
  audioEnabled = config.audioFeedback !== false;
  hapticEnabled = config.hapticFeedback !== false;

  try {
    // Initialize audio context
    if (audioEnabled) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    // Create screen reader announcement elements
    createScreenReaderElements();

    return true;
  } catch (error) {
    console.error('Failed to initialize accessibility helpers:', error);
    return false;
  }
}

/**
 * Create screen reader announcement elements
 */
function createScreenReaderElements() {
  // Create assertive announcer for important updates
  srAnnouncer = document.createElement('div');
  srAnnouncer.setAttribute('aria-live', 'assertive');
  srAnnouncer.setAttribute('aria-atomic', 'true');
  srAnnouncer.classList.add('sr-only');
  document.body.appendChild(srAnnouncer);

  // Create polite live region for less urgent updates
  srLiveRegion = document.createElement('div');
  srLiveRegion.setAttribute('aria-live', 'polite');
  srLiveRegion.setAttribute('aria-atomic', 'true');
  srLiveRegion.classList.add('sr-only');
  document.body.appendChild(srLiveRegion);
}

/**
 * Announce a message to screen readers
 * @param {string} message - Message to announce
 * @param {string} priority - Priority level ('polite' or 'assertive')
 */
function announceToScreenReader(message, priority = 'polite') {
  if (!srAnnouncer || !srLiveRegion) {
    createScreenReaderElements();
  }

  const element = priority === 'assertive' ? srAnnouncer : srLiveRegion;
  
  // Clear previous content and add new announcement
  element.textContent = '';
  
  // Use setTimeout to ensure the DOM update and announcement
  setTimeout(() => {
    element.textContent = message;
  }, 50);
}

/**
 * Play a tone to represent distance from ideal position
 * Higher pitch = closer to ideal position
 * @param {number} confidence - Confidence level (0-1)
 */
function playPositionFeedbackTone(confidence) {
  if (!audioEnabled || !audioContext) return;
  
  try {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    // Map confidence to frequency (higher = better position)
    // Range from 220Hz (low) to 880Hz (high)
    const frequency = 220 + (confidence * 660);
    
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    
    // Map confidence to volume (higher = louder)
    gainNode.gain.value = 0.1 + (confidence * 0.2);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start();
    setTimeout(() => {
      oscillator.stop();
    }, 100);
  } catch (error) {
    console.error('Error playing position feedback tone:', error);
  }
}

/**
 * Play different audio patterns for face detection feedback
 * @param {string} feedbackType - Type of feedback ('no_face', 'multiple_faces', 'good_position', 'too_far', 'too_close')
 */
function playFaceDetectionFeedback(feedbackType) {
  if (!audioEnabled || !audioContext) return;
  
  try {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    gainNode.gain.value = 0.2;
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    switch (feedbackType) {
      case 'no_face':
        // Low, longer warning tone
        oscillator.frequency.value = 220;
        oscillator.start();
        setTimeout(() => oscillator.stop(), 500);
        break;
        
      case 'multiple_faces':
        // Two quick beeps
        oscillator.frequency.value = 440;
        oscillator.start();
        setTimeout(() => {
          oscillator.stop();
          setTimeout(() => {
            oscillator.frequency.value = 440;
            oscillator.start();
            setTimeout(() => oscillator.stop(), 200);
          }, 200);
        }, 200);
        break;
        
      case 'good_position':
        // Pleasant confirmation chord
        oscillator.frequency.value = 523.25; // C5
        oscillator.start();
        setTimeout(() => {
          oscillator.frequency.value = 659.25; // E5
          setTimeout(() => {
            oscillator.frequency.value = 783.99; // G5
            setTimeout(() => oscillator.stop(), 200);
          }, 200);
        }, 200);
        break;
        
      case 'too_far':
        // Increasing pitch sequence
        oscillator.frequency.value = 330;
        oscillator.start();
        setTimeout(() => {
          oscillator.frequency.value = 392;
          setTimeout(() => {
            oscillator.frequency.value = 440;
            setTimeout(() => oscillator.stop(), 150);
          }, 150);
        }, 150);
        break;
        
      case 'too_close':
        // Decreasing pitch sequence
        oscillator.frequency.value = 440;
        oscillator.start();
        setTimeout(() => {
          oscillator.frequency.value = 392;
          setTimeout(() => {
            oscillator.frequency.value = 330;
            setTimeout(() => oscillator.stop(), 150);
          }, 150);
        }, 150);
        break;
    }
    
  } catch (error) {
    console.error('Error playing face detection feedback:', error);
  }
}

/**
 * Provide haptic feedback for different events
 * @param {string} pattern - Vibration pattern type ('success', 'error', 'warning', 'capture', 'position')
 */
function provideHapticFeedback(pattern) {
  if (!hapticEnabled || !navigator.vibrate) return;
  
  try {
    switch (pattern) {
      case 'success':
        navigator.vibrate([100, 50, 100, 50, 200]);
        break;
      case 'error':
        navigator.vibrate([300, 100, 300]);
        break;
      case 'warning':
        navigator.vibrate([100, 100, 100]);
        break;
      case 'capture':
        navigator.vibrate([200]);
        break;
      case 'position':
        navigator.vibrate([50, 50, 50]);
        break;
      default:
        navigator.vibrate(100);
    }
  } catch (error) {
    console.error('Error providing haptic feedback:', error);
  }
}

/**
 * Speak a message using speech synthesis
 * @param {string} message - Message to speak
 * @param {boolean} interrupt - Whether to interrupt current speech
 */
function speak(message, interrupt = false) {
  if (!window.speechSynthesis) return;
  
  // Cancel current speech if interrupt is true
  if (interrupt && window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
  }
  
  const utterance = new SpeechSynthesisUtterance(message);
  utterance.volume = 1;
  utterance.rate = 1;
  utterance.pitch = 1;
  
  window.speechSynthesis.speak(utterance);
}

/**
 * Convert face detection data into audio guidance
 * @param {Object} detection - Face detection data
 * @returns {Object} Guidance information
 */
function generatePositionGuidance(detection) {
  if (!detection || !detection.detection) {
    return {
      message: "No face detected. Please position yourself in front of the camera.",
      feedbackType: "no_face",
      confidence: 0
    };
  }
  
  const box = detection.detection.box;
  const imageWidth = detection.detection.imageWidth;
  const imageHeight = detection.detection.imageHeight;
  
  // Calculate face position within frame
  const centerX = box.x + (box.width / 2);
  const centerY = box.y + (box.height / 2);
  const faceSizeRatio = (box.width * box.height) / (imageWidth * imageHeight);
  
  // Check horizontal position
  let horizontalMessage = "";
  if (centerX < imageWidth * 0.33) {
    horizontalMessage = "Move right.";
  } else if (centerX > imageWidth * 0.67) {
    horizontalMessage = "Move left.";
  } else {
    horizontalMessage = "Good horizontal position.";
  }
  
  // Check vertical position
  let verticalMessage = "";
  if (centerY < imageHeight * 0.33) {
    verticalMessage = "Move down.";
  } else if (centerY > imageHeight * 0.67) {
    verticalMessage = "Move up.";
  } else {
    verticalMessage = "Good vertical position.";
  }
  
  // Check distance (face size)
  let distanceMessage = "";
  let feedbackType = "";
  
  if (faceSizeRatio < 0.15) {
    distanceMessage = "Move closer to the camera.";
    feedbackType = "too_far";
  } else if (faceSizeRatio > 0.4) {
    distanceMessage = "Move further from the camera.";
    feedbackType = "too_close";
  } else {
    distanceMessage = "Good distance from camera.";
    feedbackType = "good_position";
  }
  
  // Calculate overall position confidence
  const horizontalConfidence = 1 - (2 * Math.abs(centerX / imageWidth - 0.5));
  const verticalConfidence = 1 - (2 * Math.abs(centerY / imageHeight - 0.5));
  
  // Distance confidence peaks at optimal distance (around 0.25 face size ratio)
  let distanceConfidence = 0;
  if (faceSizeRatio < 0.15) {
    distanceConfidence = faceSizeRatio / 0.15;
  } else if (faceSizeRatio > 0.4) {
    distanceConfidence = 1 - ((faceSizeRatio - 0.4) / 0.2);
  } else {
    distanceConfidence = 1 - (Math.abs(faceSizeRatio - 0.25) / 0.15);
  }
  
  // Combine confidences (weighted)
  const overallConfidence = (
    horizontalConfidence * 0.3 + 
    verticalConfidence * 0.3 + 
    distanceConfidence * 0.4
  );
  
  // Generate full guidance message
  let message = "";
  
  if (overallConfidence > 0.9) {
    message = "Perfect position! Hold still.";
  } else if (overallConfidence > 0.7) {
    message = "Good position. " + (distanceConfidence < 0.8 ? distanceMessage : "");
  } else if (overallConfidence > 0.4) {
    message = `${horizontalMessage} ${verticalMessage} ${distanceMessage}`.trim();
  } else {
    message = "Please reposition yourself. " + distanceMessage;
  }
  
  return {
    message,
    feedbackType: feedbackType || (overallConfidence > 0.7 ? "good_position" : "position"),
    confidence: overallConfidence,
    horizontalConfidence,
    verticalConfidence,
    distanceConfidence
  };
}

/**
 * Get guidance for showing a specific expression
 * @param {string} targetExpression - The expression to guide towards
 * @param {Object} detectedExpressions - Detected expressions data
 * @returns {Object} Expression guidance information
 */
function getExpressionGuidance(targetExpression, detectedExpressions) {
  if (!detectedExpressions) {
    return {
      message: "Cannot detect your expression. Please ensure your face is visible.",
      confidence: 0,
      match: false
    };
  }
  
  // Default expression guidance
  const expressionGuides = {
    neutral: "Relax your face muscles. Try to show no emotion.",
    happy: "Smile broadly. Think of something that makes you happy.",
    sad: "Turn down the corners of your mouth. Think of something sad.",
    angry: "Furrow your brow and narrow your eyes slightly.",
    surprised: "Raise your eyebrows and open your mouth slightly.",
    disgusted: "Wrinkle your nose and raise your upper lip slightly.",
    fearful: "Widen your eyes and part your lips slightly."
  };
  
  // Get confidence score for target expression
  const confidence = detectedExpressions[targetExpression] || 0;
  
  // Find dominant expression
  let dominantExpression = Object.keys(detectedExpressions).reduce((a, b) => 
    detectedExpressions[a] > detectedExpressions[b] ? a : b
  );
  
  // Generate guidance message
  let message = "";
  let match = false;
  
  if (confidence > 0.7) {
    message = `Great! ${targetExpression} expression detected.`;
    match = true;
  } else if (confidence > 0.4) {
    message = `Getting closer. Continue to ${expressionGuides[targetExpression]}`;
  } else {
    // If dominant expression is very different, give specific guidance
    message = `Please show a ${targetExpression} expression. ${expressionGuides[targetExpression]}`;
    
    // Add additional tip if a different expression is dominant
    if (dominantExpression !== targetExpression && detectedExpressions[dominantExpression] > 0.5) {
      message += ` You're currently showing more of a ${dominantExpression} expression.`;
    }
  }
  
  return {
    message,
    confidence,
    match,
    dominantExpression
  };
}

/**
 * Create audio representation of expression confidence
 * @param {string} expression - Expression name
 * @param {number} confidence - Confidence level (0-1)
 */
function playExpressionFeedback(expression, confidence) {
  if (!audioEnabled || !audioContext) return;
  
  try {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    // Each expression has a different base frequency
    const expressionFrequencies = {
      neutral: 440,  // A4
      happy: 523.25, // C5 - higher/brighter
      sad: 392,      // G4 - lower
      angry: 466.16, // A#4/Bb4 - tense
      surprised: 587.33, // D5 - higher
      disgusted: 415.3,  // G#4/Ab4 - dissonant
      fearful: 349.23    // F4 - lower/tense
    };
    
    // Get base frequency for this expression
    const baseFreq = expressionFrequencies[expression] || 440;
    
    // Modify frequency slightly based on confidence
    // Higher confidence = more pure tone
    oscillator.frequency.value = baseFreq * (0.95 + (confidence * 0.1));
    
    // Amplitude increases with confidence
    gainNode.gain.value = 0.1 + (confidence * 0.15);
    
    oscillator.type = confidence > 0.7 ? 'sine' : 'triangle';
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Play a tone with duration based on confidence
    oscillator.start();
    setTimeout(() => {
      oscillator.stop();
    }, 100 + (confidence * 300)); // 100-400ms
    
  } catch (error) {
    console.error('Error playing expression feedback:', error);
  }
}

/**
 * Enhance UI elements with accessibility attributes
 * @param {Object} elements - UI elements to enhance
 */
function enhanceUIAccessibility(elements) {
  if (!elements) return;
  
  // Main container
  if (elements.container) {
    elements.container.setAttribute('role', 'application');
    elements.container.setAttribute('aria-label', 'ALEJO Vision Training System');
  }
  
  // Step navigation
  if (elements.nextButton) {
    elements.nextButton.setAttribute('aria-label', 'Next step');
  }
  
  if (elements.backButton) {
    elements.backButton.setAttribute('aria-label', 'Previous step');
  }
  
  // Video element
  if (elements.video) {
    elements.video.setAttribute('aria-hidden', 'true');
    // Create accessible description for video
    const videoDescription = document.createElement('div');
    videoDescription.id = 'video-description';
    videoDescription.classList.add('sr-only');
    videoDescription.setAttribute('aria-live', 'polite');
    elements.video.parentNode.insertBefore(videoDescription, elements.video.nextSibling);
  }
  
  // Progress indicator
  if (elements.progressBar) {
    elements.progressBar.setAttribute('role', 'progressbar');
    elements.progressBar.setAttribute('aria-valuemin', '0');
    elements.progressBar.setAttribute('aria-valuemax', '100');
    elements.progressBar.setAttribute('aria-valuenow', '0');
    elements.progressBar.setAttribute('aria-valuetext', 'Step 0 of 0');
  }
}

/**
 * Update progress information for screen readers
 * @param {Object} progressData - Progress information
 */
function updateProgressAnnouncement(progressData) {
  const { currentStep, totalSteps, percentComplete, currentStepName } = progressData;
  
  if (!document.getElementById('progress-announcement')) {
    const progressAnnouncement = document.createElement('div');
    progressAnnouncement.id = 'progress-announcement';
    progressAnnouncement.setAttribute('aria-live', 'polite');
    progressAnnouncement.classList.add('sr-only');
    document.body.appendChild(progressAnnouncement);
  }
  
  const progressElement = document.getElementById('progress-announcement');
  progressElement.textContent = `Step ${currentStep + 1} of ${totalSteps}: ${currentStepName}. ${percentComplete}% complete.`;
  
  // Also update any progress bar if present
  const progressBar = document.querySelector('[role="progressbar"]');
  if (progressBar) {
    progressBar.setAttribute('aria-valuenow', percentComplete);
    progressBar.setAttribute('aria-valuetext', `Step ${currentStep + 1} of ${totalSteps}: ${percentComplete}% complete`);
  }
}

/**
 * Set up keyboard navigation for the training UI
 * @param {Object} elements - UI elements
 * @param {Function} onKeyNavigation - Callback for navigation events
 */
function setupKeyboardNavigation(elements, onKeyNavigation) {
  if (!elements) return;
  
  // Add keyboard listener
  document.addEventListener('keydown', (event) => {
    const key = event.key;
    
    // Define navigation actions
    if (key === 'Enter' || key === ' ' || key === 'Space') {
      // Process current step / Next button
      if (elements.nextButton && !elements.nextButton.disabled) {
        elements.nextButton.click();
        event.preventDefault();
      }
    } else if (key === 'Escape') {
      // Cancel / Close
      if (elements.cancelButton && !elements.cancelButton.disabled) {
        elements.cancelButton.click();
        event.preventDefault();
      }
    } else if (key === 'ArrowLeft' || key === 'Backspace') {
      // Previous step
      if (elements.backButton && !elements.backButton.disabled) {
        elements.backButton.click();
        event.preventDefault();
      }
    }
    
    // Call the callback with the key event
    if (onKeyNavigation) {
      onKeyNavigation(event);
    }
  });
  
  // Make sure focusable elements have proper tab index and roles
  const focusableElements = [
    elements.nextButton,
    elements.backButton,
    elements.cancelButton
  ].filter(el => el); // Filter out undefined elements
  
  focusableElements.forEach(el => {
    if (!el.getAttribute('tabindex')) {
      el.setAttribute('tabindex', '0');
    }
    if (!el.getAttribute('role') && el.tagName !== 'BUTTON') {
      el.setAttribute('role', 'button');
    }
  });
}

// Export the accessibility helpers
export default {
  initialize,
  announceToScreenReader,
  playPositionFeedbackTone,
  playFaceDetectionFeedback,
  provideHapticFeedback,
  speak,
  generatePositionGuidance,
  getExpressionGuidance,
  playExpressionFeedback,
  enhanceUIAccessibility,
  updateProgressAnnouncement,
  setupKeyboardNavigation
};
