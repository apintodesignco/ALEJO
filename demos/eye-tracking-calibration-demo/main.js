/**
 * ALEJO Eye Tracking Calibration Demo
 * 
 * This demo showcases the eye tracking calibration functionality
 * integrated with the ALEJO biometrics system.
 */

// Import biometrics and events modules
// Note: In a real environment, these would be proper imports
// For this demo, we'll mock the functionality

// Mock biometrics API
const biometricsModule = {
  initializeBiometrics: async (config) => {
    console.log('Initializing biometrics with config:', config);
    return { success: true };
  },
  getPublicAPI: () => ({
    isProcessing: () => mockState.processing,
    startProcessing: async () => {
      mockState.processing = true;
      console.log('Biometrics processing started');
      return { success: true };
    },
    stopProcessing: async () => {
      mockState.processing = false;
      console.log('Biometrics processing stopped');
      return { success: true };
    },
    calibrateEyeTracking: async (options) => {
      console.log('Starting eye tracking calibration with options:', options);
      
      // Simulate calibration process
      return new Promise((resolve) => {
        // Publish start event
        eventModule.publish('biometrics:eye:calibration:start', {});
        
        let currentPoint = 0;
        const totalPoints = options.points || 5;
        
        // Simulate calibration points
        const pointInterval = setInterval(() => {
          currentPoint++;
          
          // Move calibration target to random position
          const target = document.getElementById('calibration-target');
          if (target) {
            target.classList.remove('hidden');
            target.style.left = `${Math.random() * 80 + 10}%`;
            target.style.top = `${Math.random() * 80 + 10}%`;
          }
          
          // Publish point event
          eventModule.publish('biometrics:eye:calibration:point', {
            current: currentPoint,
            total: totalPoints
          });
          
          if (currentPoint >= totalPoints) {
            clearInterval(pointInterval);
            
            // Hide calibration target
            if (target) {
              target.classList.add('hidden');
            }
            
            // Calculate mock accuracy based on options
            let accuracy = 0.7 + Math.random() * 0.2;
            
            // Accessibility options can improve accuracy
            if (options.accessibility) {
              if (options.accessibility.highContrastMode) accuracy += 0.03;
              if (options.accessibility.largeTargets) accuracy += 0.05;
            }
            
            // Cap at 0.98
            accuracy = Math.min(0.98, accuracy);
            
            // Publish completion event
            eventModule.publish('biometrics:eye:calibration:complete', { accuracy });
            
            // Resolve promise
            resolve({
              success: true,
              accuracy: accuracy
            });
          }
        }, options.pointDuration || 1000);
      });
    },
    updateConfig: (config) => {
      console.log('Updating biometrics config:', config);
      return { success: true };
    }
  })
};

// Mock events module
const eventModule = {
  subscribers: {},
  subscribe: (event, callback) => {
    if (!eventModule.subscribers[event]) {
      eventModule.subscribers[event] = [];
    }
    eventModule.subscribers[event].push(callback);
  },
  publish: (event, data) => {
    console.log(`Event published: ${event}`, data);
    if (eventModule.subscribers[event]) {
      eventModule.subscribers[event].forEach(callback => callback(data));
    }
  }
};

// Mock state
const mockState = {
  processing: false
};

// Use the mock modules
const { initializeBiometrics, getPublicAPI } = biometricsModule;
const { subscribe, publish } = eventModule;

// DOM Elements
const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const calibrationTarget = document.getElementById('calibration-target');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const resetBtn = document.getElementById('resetBtn');
const statusEl = document.getElementById('status');
const accuracyFill = document.querySelector('.accuracy-fill');
const accuracyValue = document.querySelector('.accuracy-value');
const logEl = document.getElementById('log');
const consentModal = document.getElementById('consent-modal');
const consentAllow = document.getElementById('consent-allow');
const consentDeny = document.getElementById('consent-deny');

// Option Elements
const calibrationPoints = document.getElementById('calibration-points');
const pointDuration = document.getElementById('point-duration');
const audioFeedback = document.getElementById('audio-feedback');
const highContrast = document.getElementById('high-contrast');
const largeTargets = document.getElementById('large-targets');
const extendedDuration = document.getElementById('extended-duration');
const privacyMode = document.getElementById('privacy-mode');

// State
let biometricsAPI = null;
let calibrationInProgress = false;
let audioContext = null;
let audioEnabled = false;

// Initialize
async function init() {
  try {
    // Initialize biometrics system
    await initializeBiometrics({
      eye: {
        enabled: true,
        models: {
          path: '../../models/face-api'
        },
        calibration: {
          requiredAccuracy: 0.7,
          maxAttempts: 3
        },
        privacy: {
          mode: privacyMode.value
        }
      }
    });
    
    biometricsAPI = getPublicAPI();
    
    // Set up event listeners
    setupEventListeners();
    
    // Set up event subscriptions
    setupEventSubscriptions();
    
    updateStatus('Biometrics system initialized. Ready to start calibration.');
    log('Biometrics system initialized');
  } catch (error) {
    console.error('Initialization error:', error);
    updateStatus(`Error: ${error.message}`, 'error');
    log(`Error: ${error.message}`, 'error');
  }
}

// Event Listeners
function setupEventListeners() {
  // Button listeners
  startBtn.addEventListener('click', startCalibration);
  stopBtn.addEventListener('click', stopCalibration);
  resetBtn.addEventListener('click', resetCalibration);
  
  // Consent modal
  consentAllow.addEventListener('click', () => {
    consentModal.classList.remove('active');
    startCalibrationProcess();
  });
  
  consentDeny.addEventListener('click', () => {
    consentModal.classList.remove('active');
    updateStatus('Calibration cancelled - consent denied', 'warning');
    log('User denied consent for camera access');
  });
  
  // Accessibility options
  highContrast.addEventListener('change', updateAccessibilitySettings);
  largeTargets.addEventListener('change', updateAccessibilitySettings);
  audioFeedback.addEventListener('change', updateAccessibilitySettings);
  
  // Privacy mode
  privacyMode.addEventListener('change', updatePrivacyMode);
}

// Event Subscriptions
function setupEventSubscriptions() {
  // Biometrics events
  subscribe('biometrics:initialized', () => {
    log('Biometrics system initialized');
  });
  
  subscribe('biometrics:eye:calibration:start', () => {
    log('Calibration started');
    updateStatus('Calibration in progress. Please follow the target with your eyes.');
  });
  
  subscribe('biometrics:eye:calibration:point', (data) => {
    log(`Calibration point ${data.current}/${data.total}`);
    if (audioEnabled) {
      playTone(440, 0.2); // Play A4 tone
    }
  });
  
  subscribe('biometrics:eye:calibration:complete', (data) => {
    log(`Calibration complete. Accuracy: ${(data.accuracy * 100).toFixed(1)}%`);
    updateStatus(`Calibration complete. Accuracy: ${(data.accuracy * 100).toFixed(1)}%`);
    updateAccuracy(data.accuracy);
    calibrationInProgress = false;
    enableButtons(true, false, true);
  });
  
  subscribe('biometrics:eye:calibration:failed', (data) => {
    log(`Calibration failed: ${data.error}`);
    updateStatus(`Calibration failed: ${data.error}`, 'error');
    calibrationInProgress = false;
    enableButtons(true, false, true);
  });
  
  subscribe('biometrics:error', (data) => {
    log(`Error: ${data.message}`, 'error');
    updateStatus(`Error: ${data.message}`, 'error');
  });
}

// Start Calibration
function startCalibration() {
  // Show consent modal
  consentModal.classList.add('active');
}

// Start calibration after consent
async function startCalibrationProcess() {
  try {
    if (!biometricsAPI) {
      throw new Error('Biometrics system not initialized');
    }
    
    updateStatus('Starting calibration...');
    log('Starting calibration process');
    
    // Start biometrics processing if not already started
    if (!biometricsAPI.isProcessing()) {
      await biometricsAPI.startProcessing();
      log('Biometrics processing started');
    }
    
    // Get calibration options
    const options = getCalibrationOptions();
    
    // Initialize audio if needed
    if (audioFeedback.checked && !audioContext) {
      initializeAudio();
    }
    
    // Start calibration
    calibrationInProgress = true;
    enableButtons(false, true, false);
    
    // Call the calibration API
    const result = await biometricsAPI.calibrateEyeTracking(options);
    
    if (result.success) {
      updateStatus(`Calibration successful! Accuracy: ${(result.accuracy * 100).toFixed(1)}%`);
      updateAccuracy(result.accuracy);
    } else {
      updateStatus(`Calibration failed: ${result.error}`, 'error');
    }
    
    calibrationInProgress = false;
    enableButtons(true, false, true);
    
  } catch (error) {
    console.error('Calibration error:', error);
    updateStatus(`Error: ${error.message}`, 'error');
    log(`Error: ${error.message}`, 'error');
    calibrationInProgress = false;
    enableButtons(true, false, false);
  }
}

// Stop Calibration
async function stopCalibration() {
  try {
    if (calibrationInProgress) {
      // TODO: Implement a way to cancel ongoing calibration
      log('Stopping calibration');
      updateStatus('Calibration stopped');
    }
    
    if (biometricsAPI && biometricsAPI.isProcessing()) {
      await biometricsAPI.stopProcessing();
      log('Biometrics processing stopped');
    }
    
    calibrationInProgress = false;
    enableButtons(true, false, false);
    
  } catch (error) {
    console.error('Stop error:', error);
    updateStatus(`Error: ${error.message}`, 'error');
    log(`Error: ${error.message}`, 'error');
  }
}

// Reset Calibration
function resetCalibration() {
  updateAccuracy(0);
  updateStatus('Ready to start calibration');
  log('Calibration reset');
  enableButtons(true, false, false);
}

// Get Calibration Options
function getCalibrationOptions() {
  return {
    points: parseInt(calibrationPoints.value),
    pointDuration: parseInt(pointDuration.value),
    accessibility: {
      audioFeedback: audioFeedback.checked,
      highContrastMode: highContrast.checked,
      largeTargets: largeTargets.checked,
      extendedDuration: extendedDuration.checked
    },
    privacy: {
      mode: privacyMode.value
    }
  };
}

// Update Accessibility Settings
function updateAccessibilitySettings() {
  // Update body classes
  document.body.classList.toggle('high-contrast', highContrast.checked);
  document.body.classList.toggle('large-targets', largeTargets.checked);
  
  // Update audio state
  audioEnabled = audioFeedback.checked;
  
  if (audioEnabled && !audioContext) {
    initializeAudio();
  }
  
  log('Accessibility settings updated');
}

// Update Privacy Mode
function updatePrivacyMode() {
  const mode = privacyMode.value;
  
  // Remove all privacy classes
  document.body.classList.remove('privacy-blur', 'privacy-abstract');
  
  // Add selected privacy class
  if (mode !== 'none') {
    document.body.classList.add(`privacy-${mode}`);
  }
  
  // Update biometrics config if initialized
  if (biometricsAPI) {
    biometricsAPI.updateConfig({
      eye: {
        privacy: {
          mode: mode
        }
      }
    });
  }
  
  log(`Privacy mode updated to: ${mode}`);
}

// Initialize Audio
function initializeAudio() {
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    audioEnabled = true;
    log('Audio initialized');
  } catch (error) {
    console.error('Audio initialization error:', error);
    log('Failed to initialize audio', 'error');
    audioEnabled = false;
    audioFeedback.checked = false;
  }
}

// Play Tone
function playTone(frequency, duration) {
  if (!audioContext || !audioEnabled) return;
  
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  // Fade in/out to avoid clicks
  gainNode.gain.setValueAtTime(0, audioContext.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.05);
  gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + duration);
  
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

// Update Status
function updateStatus(message, type = 'info') {
  statusEl.textContent = message;
  statusEl.className = '';
  statusEl.classList.add(type);
}

// Update Accuracy Display
function updateAccuracy(accuracy) {
  const percent = Math.round(accuracy * 100);
  accuracyFill.style.width = `${percent}%`;
  accuracyFill.dataset.width = percent;
  accuracyValue.textContent = `${percent}%`;
  
  // Update color based on accuracy
  let colorClass = 'accuracy-low';
  if (percent >= 80) {
    colorClass = 'accuracy-high';
    accuracyFill.style.backgroundColor = 'var(--secondary-color)';
  } else if (percent >= 60) {
    colorClass = 'accuracy-medium';
    accuracyFill.style.backgroundColor = 'var(--warning-color)';
  } else {
    accuracyFill.style.backgroundColor = 'var(--danger-color)';
  }
  
  // Update classes
  accuracyFill.className = 'accuracy-fill ' + colorClass;
}

// Enable/Disable Buttons
function enableButtons(start, stop, reset) {
  startBtn.disabled = !start;
  stopBtn.disabled = !stop;
  resetBtn.disabled = !reset;
}

// Log Events
function log(message, type = 'info') {
  const now = new Date();
  const timeString = now.toLocaleTimeString();
  const logEntry = document.createElement('div');
  logEntry.classList.add('log-entry', type);
  
  const timeSpan = document.createElement('span');
  timeSpan.classList.add('log-time');
  timeSpan.textContent = timeString;
  
  const messageSpan = document.createElement('span');
  messageSpan.classList.add('log-event');
  messageSpan.textContent = message;
  
  logEntry.appendChild(timeSpan);
  logEntry.appendChild(messageSpan);
  
  logEl.appendChild(logEntry);
  logEl.scrollTop = logEl.scrollHeight;
}

// Initialize on load
document.addEventListener('DOMContentLoaded', init);

// Apply initial accessibility settings
updateAccessibilitySettings();
