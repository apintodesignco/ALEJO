/**
 * ALEJO Voice Training UI Component
 * 
 * This module provides a UI component for voice training and recognition:
 * - Voice sample recording interface
 * - Training session management
 * - Voice model visualization
 * - Recognition testing
 * - Emotion and speech pattern analysis display
 */

import { publish, subscribe } from '../../core/events.js';
import * as security from '../../security/index.js';
import * as training from './training.js';
import * as recognition from './recognition.js';
import * as advancedFeatures from './advanced-features.js';

// Default UI configuration
const DEFAULT_CONFIG = {
  containerId: 'alejo-voice-training-container',
  theme: 'light',
  showAdvancedFeatures: true,
  showEmotionAnalysis: true,
  showSpeechPatterns: true,
  autoStart: false,
  requiredSamples: 5,
  sampleDuration: 3000 // ms
};

// State management
let config = { ...DEFAULT_CONFIG };
let uiState = {
  initialized: false,
  recording: false,
  processing: false,
  trainingActive: false,
  recognitionActive: false,
  currentSampleCount: 0,
  currentVoiceId: null,
  emotionData: null,
  speechPatternData: null,
  recognitionResults: null,
  error: null
};

// DOM elements cache
let elements = {};

/**
 * Initialize the voice training UI
 * @param {Object} options - UI configuration options
 * @returns {Promise<boolean>} Success status
 */
export async function initialize(options = {}) {
  console.log('Initializing ALEJO Voice Training UI');
  
  if (uiState.initialized) {
    console.warn('Voice Training UI already initialized');
    return true;
  }
  
  try {
    // Merge configuration
    config = { ...DEFAULT_CONFIG, ...options };
    
    // Initialize voice modules
    await training.initialize();
    await recognition.initialize();
    
    if (config.showAdvancedFeatures) {
      await advancedFeatures.initialize();
    }
    
    // Check for required permissions
    const hasPermission = await security.hasPermission(
      security.getCurrentUserId() || 'anonymous',
      'voice:training'
    );
    
    if (!hasPermission) {
      throw new Error('User does not have permission to use voice training');
    }
    
    // Create UI elements
    createUIElements();
    
    // Attach event listeners
    attachEventListeners();
    
    // Subscribe to events
    subscribe('voice:recording_started', handleRecordingStarted);
    subscribe('voice:recording_stopped', handleRecordingStopped);
    subscribe('voice:training_progress', handleTrainingProgress);
    subscribe('voice:training_completed', handleTrainingCompleted);
    subscribe('voice:recognition_result', handleRecognitionResult);
    
    uiState.initialized = true;
    
    // Auto-start if configured
    if (config.autoStart) {
      startTrainingSession();
    }
    
    return true;
  } catch (error) {
    console.error('Failed to initialize Voice Training UI:', error);
    uiState.error = error.message;
    updateUIState();
    return false;
  }
}

/**
 * Create UI elements for voice training with accessibility features
 */
function createUIElements() {
  // Get container element
  const container = document.getElementById(config.containerId);
  if (!container) {
    throw new Error(`Container element not found: ${config.containerId}`);
  }
  
  // Set theme class and accessibility attributes
  container.classList.add(`alejo-theme-${config.theme}`);
  container.setAttribute('role', 'application');
  container.setAttribute('aria-label', 'ALEJO Voice Training Interface');
  
  // Create UI structure with accessibility attributes
  container.innerHTML = `
    <div class="alejo-voice-training">
      <div class="alejo-voice-header" role="banner">
        <h2 id="alejo-voice-training-title">ALEJO Voice Training</h2>
        <div class="alejo-status-indicator ${uiState.recording ? 'recording' : ''}" 
             role="status" 
             aria-live="assertive" 
             id="recording-status"
             aria-label="${uiState.recording ? 'Currently recording' : 'Not recording'}"></div>
      </div>
      
      <div class="alejo-voice-main" role="main">
        <div class="alejo-voice-controls" role="group" aria-labelledby="alejo-voice-training-title">
          <button id="alejo-start-training" class="alejo-btn primary" aria-describedby="start-training-desc">Start Training</button>
          <span id="start-training-desc" class="sr-only">Begin a new voice training session</span>
          
          <button id="alejo-record-sample" class="alejo-btn" disabled aria-describedby="record-sample-desc">Record Sample</button>
          <span id="record-sample-desc" class="sr-only">Record a new voice sample for training</span>
          
          <button id="alejo-stop-recording" class="alejo-btn danger" disabled aria-describedby="stop-recording-desc">Stop Recording</button>
          <span id="stop-recording-desc" class="sr-only">Stop recording the current voice sample</span>
          
          <button id="alejo-complete-training" class="alejo-btn success" disabled aria-describedby="complete-training-desc">Complete Training</button>
          <span id="complete-training-desc" class="sr-only">Finish the training session and save your voice model</span>
          
          <button id="alejo-test-recognition" class="alejo-btn" disabled aria-describedby="test-recognition-desc">Test Recognition</button>
          <span id="test-recognition-desc" class="sr-only">Test if your voice can be recognized correctly</span>
        </div>
        
        <div class="alejo-voice-progress" role="region" aria-label="Training Progress">
          <div class="alejo-progress-label" id="progress-label">Training Progress</div>
          <div class="alejo-progress-bar" role="progressbar" 
               aria-labelledby="progress-label" 
               aria-valuenow="0" 
               aria-valuemin="0" 
               aria-valuemax="100">
            <div class="alejo-progress-fill" style="width: 0%"></div>
          </div>
          <div class="alejo-progress-status" aria-live="polite">
            <span id="alejo-sample-count">0</span>/<span id="alejo-required-samples">${config.requiredSamples}</span> samples
          </div>
        </div>
        
        <div class="alejo-voice-visualization" aria-hidden="true">
          <canvas id="alejo-voice-waveform" width="400" height="100"></canvas>
        </div>
        
        <!-- Audio feedback for blind users -->
        <div class="alejo-audio-feedback">
          <audio id="alejo-audio-start" preload="auto" src="/assets/sounds/training-start.mp3"></audio>
          <audio id="alejo-audio-record" preload="auto" src="/assets/sounds/record-start.mp3"></audio>
          <audio id="alejo-audio-stop" preload="auto" src="/assets/sounds/record-stop.mp3"></audio>
          <audio id="alejo-audio-complete" preload="auto" src="/assets/sounds/training-complete.mp3"></audio>
        </div>
        
        <!-- Screen reader only instructions -->
        <div class="sr-only" aria-live="polite" id="screen-reader-instructions">
          Use the Tab key to navigate between controls. Press Space or Enter to activate buttons. 
          When recording, speak clearly for ${config.sampleDuration/1000} seconds per sample.
        </div>
      </div>
      
      <div id="alejo-advanced-features" class="alejo-voice-advanced" 
           style="display: ${config.showAdvancedFeatures ? 'block' : 'none'}"
           role="region" 
           aria-label="Advanced Analysis">
        <h3 id="advanced-analysis-heading">Advanced Analysis</h3>
        
        <div id="alejo-emotion-analysis" 
             class="alejo-analysis-section" 
             style="display: ${config.showEmotionAnalysis ? 'block' : 'none'}"
             role="region"
             aria-labelledby="emotion-analysis-heading">
          <h4 id="emotion-analysis-heading">Emotion Analysis</h4>
          <div class="alejo-emotion-chart">
            <div id="alejo-emotion-bars" role="img" aria-label="Emotion analysis chart"></div>
          </div>
          <div id="emotion-text-description" class="sr-only" aria-live="polite"></div>
        </div>
        
        <div id="alejo-speech-patterns" 
             class="alejo-analysis-section" 
             style="display: ${config.showSpeechPatterns ? 'block' : 'none'}"
             role="region"
             aria-labelledby="speech-patterns-heading">
          <h4 id="speech-patterns-heading">Speech Patterns</h4>
          <div id="alejo-pattern-radar" role="img" aria-label="Speech pattern radar chart"></div>
          <div id="alejo-distinctive-patterns" aria-live="polite"></div>
          <div id="patterns-text-description" class="sr-only" aria-live="polite"></div>
        </div>
      </div>
      
      <div class="alejo-voice-results" role="region" aria-label="Results and Messages">
        <div id="alejo-recognition-results" aria-live="polite"></div>
        <div id="alejo-error-message" class="alejo-error" aria-live="assertive"></div>
      </div>
    </div>
  `;

  
  // Cache element references
  elements = {
    // Button elements
    startTrainingBtn: document.getElementById('alejo-start-training'),
    recordSampleBtn: document.getElementById('alejo-record-sample'),
    stopRecordingBtn: document.getElementById('alejo-stop-recording'),
    completeTrainingBtn: document.getElementById('alejo-complete-training'),
    testRecognitionBtn: document.getElementById('alejo-test-recognition'),
    
    // Progress elements
    sampleCountEl: document.getElementById('alejo-sample-count'),
    requiredSamplesEl: document.getElementById('alejo-required-samples'),
    progressFill: container.querySelector('.alejo-progress-fill'),
    progressBar: container.querySelector('.alejo-progress-bar'),
    
    // Visualization elements
    waveformCanvas: document.getElementById('alejo-voice-waveform'),
    emotionBars: document.getElementById('alejo-emotion-bars'),
    patternRadar: document.getElementById('alejo-pattern-radar'),
    distinctivePatterns: document.getElementById('alejo-distinctive-patterns'),
    
    // Result and status elements
    recognitionResults: document.getElementById('alejo-recognition-results'),
    errorMessage: document.getElementById('alejo-error-message'),
    statusIndicator: container.querySelector('.alejo-status-indicator'),
    recordingStatus: document.getElementById('recording-status'),
    
    // Accessibility elements
    screenReaderInstructions: document.getElementById('screen-reader-instructions'),
    emotionTextDescription: document.getElementById('emotion-text-description'),
    patternsTextDescription: document.getElementById('patterns-text-description'),
    
    // Audio feedback elements
    audioStart: document.getElementById('alejo-audio-start'),
    audioRecord: document.getElementById('alejo-audio-record'),
    audioStop: document.getElementById('alejo-audio-stop'),
    audioComplete: document.getElementById('alejo-audio-complete')
  };
  
  // Add CSS styles
  addStyles();
}

/**
 * Attach event listeners to UI elements with accessibility enhancements
 */
function attachEventListeners() {
  // Button click events
  elements.startTrainingBtn.addEventListener('click', startTrainingSession);
  elements.recordSampleBtn.addEventListener('click', startRecording);
  elements.stopRecordingBtn.addEventListener('click', stopRecording);
  elements.completeTrainingBtn.addEventListener('click', completeTrainingSession);
  elements.testRecognitionBtn.addEventListener('click', testRecognition);
  
  // Keyboard navigation and accessibility
  document.addEventListener('keydown', handleKeyboardNavigation);
  
  // Announce initial instructions for screen readers
  setTimeout(() => {
    announceToScreenReader('Voice training interface loaded. Use the Tab key to navigate between controls.');
  }, 1000);
}

/**
 * Handle keyboard navigation for accessibility
 * @param {KeyboardEvent} event - Keyboard event
 */
function handleKeyboardNavigation(event) {
  // Space or Enter on focused button triggers click
  if ((event.key === ' ' || event.key === 'Enter') && 
      document.activeElement.tagName === 'BUTTON' && 
      !document.activeElement.disabled) {
    event.preventDefault();
    document.activeElement.click();
  }
  
  // Escape key stops recording if active
  if (event.key === 'Escape' && uiState.recording) {
    event.preventDefault();
    stopRecording();
    announceToScreenReader('Recording stopped with escape key');
  }
  
  // Provide audio feedback when navigating between controls with Tab
  if (event.key === 'Tab' && config.audioFeedback) {
    playNavigationSound();
  }
}

/**
 * Announce a message to screen readers
 * @param {string} message - Message to announce
 * @param {string} priority - Priority level ('polite' or 'assertive')
 */
function announceToScreenReader(message, priority = 'polite') {
  // Create a temporary element for screen reader announcement
  const announcer = document.createElement('div');
  announcer.setAttribute('aria-live', priority);
  announcer.classList.add('sr-only');
  announcer.textContent = message;
  
  // Add to DOM, announce, then remove
  document.body.appendChild(announcer);
  setTimeout(() => {
    document.body.removeChild(announcer);
  }, 3000);
  
  // Also update our permanent screen reader element
  if (elements.screenReaderInstructions) {
    elements.screenReaderInstructions.textContent = message;
  }
}

/**
 * Play a subtle navigation sound for keyboard users
 */
function playNavigationSound() {
  // Create a simple audio feedback using Web Audio API (no external files needed)
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(440, audioCtx.currentTime); // A4 note
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime); // Very quiet
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.1); // Short 100ms beep
  } catch (err) {
    console.log('Audio feedback not available:', err);
  }
}

/**
 * Add required CSS styles
 */
function addStyles() {
  const styleId = 'alejo-voice-training-styles';
  
  // Check if styles already exist
  if (document.getElementById(styleId)) {
    return;
  }
  
  // Create style element
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    .alejo-voice-training {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    }
    
    .alejo-theme-dark {
      background-color: #2a2a2a;
      color: #f0f0f0;
    }
    
    .alejo-theme-light {
      background-color: #ffffff;
      color: #333333;
    }
    
    .alejo-voice-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    
    .alejo-status-indicator {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background-color: #888;
    }
    
    .alejo-status-indicator.recording {
      background-color: #f44336;
      animation: pulse 1.5s infinite;
    }
    
    @keyframes pulse {
      0% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.2); opacity: 0.8; }
      100% { transform: scale(1); opacity: 1; }
    }
    
    .alejo-voice-controls {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }
    
    .alejo-btn {
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 500;
      transition: all 0.2s;
    }
    
    .alejo-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .alejo-btn.primary {
      background-color: #2196f3;
      color: white;
    }
    
    .alejo-btn.danger {
      background-color: #f44336;
      color: white;
    }
    
    .alejo-btn.success {
      background-color: #4caf50;
      color: white;
    }
    
    .alejo-voice-progress {
      margin-bottom: 20px;
    }
    
    .alejo-progress-bar {
      height: 10px;
      background-color: #e0e0e0;
      border-radius: 5px;
      overflow: hidden;
      margin: 8px 0;
    }
    
    .alejo-progress-fill {
      height: 100%;
      background-color: #4caf50;
      transition: width 0.3s;
    }
    
    .alejo-voice-visualization {
      margin-bottom: 20px;
    }
    
    .alejo-voice-advanced {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e0e0e0;
    }
    
    .alejo-analysis-section {
      margin-bottom: 20px;
    }
    
    .alejo-emotion-chart {
      height: 150px;
      margin-top: 10px;
    }
    
    .alejo-emotion-bars {
      display: flex;
      height: 100%;
      align-items: flex-end;
      gap: 10px;
    }
    
    .alejo-emotion-bar {
      flex: 1;
      background-color: #2196f3;
      position: relative;
      min-width: 30px;
    }
    
    .alejo-emotion-label {
      position: absolute;
      bottom: -25px;
      left: 0;
      right: 0;
      text-align: center;
      font-size: 12px;
    }
    
    .alejo-error {
      color: #f44336;
      margin-top: 10px;
    }
  `;
  
  // Add to document
  document.head.appendChild(style);
}

/**
 * Start a voice training session
 */
async function startTrainingSession() {
  try {
    uiState.error = null;
    uiState.trainingActive = true;
    uiState.currentSampleCount = 0;
    
    // Start training session
    const session = await training.startTrainingSession({
      requiredSamples: config.requiredSamples
    });
    
    uiState.currentVoiceId = session.voiceId;
    
    // Update UI
    updateUIState();
    
    // Log event
    security.auditTrail.log('voice:ui:training_started', {
      voiceId: session.voiceId
    });
    
  } catch (error) {
    console.error('Failed to start training session:', error);
    uiState.error = error.message;
    uiState.trainingActive = false;
    updateUIState();
  }
}

/**
 * Start recording a voice sample with accessibility support
 */
function startRecording() {
  if (uiState.recording || uiState.processing) {
    return;
  }
  
  uiState.recording = true;
  
  // Update UI state
  elements.statusIndicator.classList.add('recording');
  elements.recordSampleBtn.disabled = true;
  elements.stopRecordingBtn.disabled = false;
  
  // Update ARIA attributes for screen readers
  elements.recordingStatus.setAttribute('aria-label', 'Currently recording');
  elements.progressBar.setAttribute('aria-busy', 'true');
  
  // Play audio cue for blind users
  if (elements.audioRecord && config.audioFeedback !== false) {
    try {
      elements.audioRecord.play().catch(e => console.log('Could not play audio cue'));
    } catch (e) {
      // Fallback to Web Audio API if audio element fails
      playAudioCue('start');
    }
  } else {
    // Fallback to Web Audio API
    playAudioCue('start');
  }
  
  // Announce to screen readers
  announceToScreenReader('Recording started. Please speak clearly for ' + 
                        (config.sampleDuration/1000) + ' seconds.', 'assertive');
  
  // Start audio visualization (helpful for sighted users)
  startVisualization();
  
  // Provide haptic feedback if available (for users with both visual and hearing impairments)
  if (navigator.vibrate && config.hapticFeedback !== false) {
    try {
      navigator.vibrate([100, 50, 100]); // Vibration pattern: 100ms on, 50ms off, 100ms on
    } catch (e) {
      console.log('Haptic feedback not available');
    }
  }
  
  // Call training module to start recording
  training.startRecording()
    .then(result => {
      console.log('Recording started:', result);
      publish('alejo:voice:recording:started', { timestamp: Date.now() });
      
      // Start countdown for blind users
      startAccessibleCountdown(config.sampleDuration);
    })
    .catch(error => {
      console.error('Failed to start recording:', error);
      uiState.error = error.message || 'Failed to start recording';
      uiState.recording = false;
      updateUIState();
      
      // Announce error to screen readers
      announceToScreenReader('Recording failed: ' + (error.message || 'Unknown error'), 'assertive');
    });
}

/**
 * Start an accessible countdown for blind users
 * @param {number} duration - Duration in milliseconds
 */
function startAccessibleCountdown(duration) {
  const intervalMs = 1000;
  const steps = Math.floor(duration / intervalMs);
  let remaining = steps;
  
  const countdownInterval = setInterval(() => {
    remaining--;
    
    if (remaining <= 0) {
      clearInterval(countdownInterval);
      return;
    }
    
    // Only announce certain intervals to avoid too much speech
    if (remaining <= 3 || remaining % 5 === 0) {
      announceToScreenReader(remaining + ' seconds remaining', 'polite');
    }
    
    // Play a subtle tick sound for each second
    playTickSound(remaining);
  }, intervalMs);
  
  // Store the interval ID so we can clear it if recording is stopped early
  uiState.countdownInterval = countdownInterval;
}

/**
 * Play a tick sound for countdown
 * @param {number} remaining - Seconds remaining
 */
function playTickSound(remaining) {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    // Higher pitch for final 3 seconds
    const frequency = remaining <= 3 ? 880 : 440;
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime); // Very quiet
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.05); // Very short tick
  } catch (err) {
    // Silent fail - audio feedback is optional
  }
}

/**
 * Play audio cue for different actions
 * @param {string} cueType - Type of cue to play ('start', 'stop', 'complete', etc.)
 */
function playAudioCue(cueType) {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    // Configure audio parameters based on cue type
    let duration = 0.2;
    let frequency = 440;
    let type = 'sine';
    let gainValue = 0.2;
    let gainRamp = true;
    
    switch(cueType) {
      case 'start':
        // Rising tone for start
        frequency = 440;
        duration = 0.3;
        gainRamp = true;
        oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
        oscillator.frequency.linearRampToValueAtTime(frequency * 1.5, audioCtx.currentTime + duration);
        break;
        
      case 'stop':
        // Falling tone for stop
        frequency = 660;
        duration = 0.3;
        gainRamp = true;
        oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
        oscillator.frequency.linearRampToValueAtTime(frequency * 0.7, audioCtx.currentTime + duration);
        break;
        
      case 'complete':
        // Two-tone success sound
        frequency = 440;
        duration = 0.5;
        type = 'triangle';
        
        // Create a second oscillator for two-tone effect
        const oscillator2 = audioCtx.createOscillator();
        oscillator2.type = type;
        oscillator2.frequency.setValueAtTime(frequency * 1.25, audioCtx.currentTime + 0.15);
        oscillator2.connect(gainNode);
        oscillator2.start(audioCtx.currentTime + 0.15);
        oscillator2.stop(audioCtx.currentTime + duration);
        break;
        
      case 'error':
        // Dissonant error sound
        frequency = 220;
        duration = 0.3;
        type = 'sawtooth';
        gainValue = 0.15; // Quieter for harsh sounds
        
        // Add a slight dissonance
        const oscillator3 = audioCtx.createOscillator();
        oscillator3.type = 'sawtooth';
        oscillator3.frequency.setValueAtTime(frequency * 1.1, audioCtx.currentTime);
        oscillator3.connect(gainNode);
        oscillator3.start();
        oscillator3.stop(audioCtx.currentTime + duration);
        break;
    }
    
    // Configure oscillator
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
    
    // Configure gain (volume)
    if (gainRamp) {
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(gainValue, audioCtx.currentTime + 0.05);
      gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + duration);
    } else {
      gainNode.gain.setValueAtTime(gainValue, audioCtx.currentTime);
    }
    
    // Connect and play
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + duration);
  } catch (err) {
    console.log('Audio feedback not available:', err);
  }
}

/**
 * Stop recording a voice sample with accessibility enhancements
 */
async function stopRecording() {
  try {
    // Clear any countdown interval if it exists
    if (uiState.countdownInterval) {
      clearInterval(uiState.countdownInterval);
      uiState.countdownInterval = null;
    }
    
    uiState.recording = false;
    uiState.processing = true;
    
    // Update UI state
    elements.statusIndicator.classList.remove('recording');
    elements.statusIndicator.classList.add('processing');
    elements.recordSampleBtn.disabled = true;
    elements.stopRecordingBtn.disabled = true;
    
    // Update ARIA attributes for screen readers
    elements.recordingStatus.setAttribute('aria-label', 'Processing recording');
    elements.progressBar.setAttribute('aria-busy', 'true');
    
    // Play audio cue for blind users
    if (elements.audioStop && config.audioFeedback !== false) {
      try {
        elements.audioStop.play().catch(e => console.log('Could not play audio cue'));
      } catch (e) {
        // Fallback to Web Audio API
        playAudioCue('stop');
      }
    } else {
      // Fallback to Web Audio API
      playAudioCue('stop');
    }
    
    // Announce to screen readers
    announceToScreenReader('Recording stopped. Processing voice sample...', 'assertive');
    
    // Provide haptic feedback if available
    if (navigator.vibrate && config.hapticFeedback !== false) {
      try {
        navigator.vibrate(200); // Single vibration for stop
      } catch (e) {
        console.log('Haptic feedback not available');
      }
    }
    
    // Stop visualization
    stopVisualization();
    
    // Stop recording
    const result = await training.stopRecording();
    
    // Increment sample count
    uiState.currentSampleCount++;
    
    // Stop visualization
    stopVisualization();
    
    // Process with advanced features if available
    if (config.showAdvancedFeatures && result.audioBlob) {
      try {
        // Analyze emotion if enabled
        if (config.showEmotionAnalysis) {
          uiState.emotionData = await advancedFeatures.analyzeEmotionalTone(result.audioBlob);
          updateEmotionVisualization(uiState.emotionData);
        }
        
        // Analyze speech patterns if enabled
        if (config.showSpeechPatterns) {
          uiState.speechPatternData = await advancedFeatures.analyzeSpeechPatterns(result.audioBlob);
          updateSpeechPatternVisualization(uiState.speechPatternData);
        }
      } catch (advError) {
        console.warn('Advanced analysis failed:', advError);
      }
    }
    
    uiState.processing = false;
    updateUIState();
    
  } catch (error) {
    console.error('Failed to stop recording:', error);
    uiState.error = error.message;
    uiState.recording = false;
    uiState.processing = false;
    updateUIState();
  }
}

/**
 * Complete the training session with accessibility enhancements
 */
async function completeTrainingSession() {
  try {
    uiState.processing = true;
    
    // Update UI state
    elements.statusIndicator.classList.remove('recording');
    elements.statusIndicator.classList.add('processing');
    elements.completeTrainingBtn.disabled = true;
    
    // Update ARIA attributes for screen readers
    elements.recordingStatus.setAttribute('aria-label', 'Finalizing voice training');
    elements.progressBar.setAttribute('aria-busy', 'true');
    
    // Announce to screen readers
    announceToScreenReader('Finalizing voice training. Please wait...', 'polite');
    
    // Complete training
    const result = await training.endTrainingSession(true);
    
    uiState.trainingActive = false;
    uiState.processing = false;
    
    // Update UI state
    elements.statusIndicator.classList.remove('processing');
    elements.statusIndicator.classList.add('completed');
    elements.progressBar.setAttribute('aria-busy', 'false');
    
    // Play completion sound for blind users
    if (elements.audioComplete && config.audioFeedback !== false) {
      try {
        elements.audioComplete.play().catch(e => console.log('Could not play audio cue'));
      } catch (e) {
        // Fallback to Web Audio API
        playAudioCue('complete');
      }
    } else {
      // Fallback to Web Audio API
      playAudioCue('complete');
    }
    
    // Show success message with accessibility enhancements
    elements.recognitionResults.innerHTML = `
      <div class="alejo-success-message" role="status" aria-live="polite">
        <h3>Voice Training Complete!</h3>
        <p>Your voice model "${result.voiceId}" has been created successfully.</p>
        <div class="sr-only" id="training-completion-details">
          Voice training has been completed successfully. Your unique voice model has been created and saved securely.
          You can now test voice recognition using the "Test Recognition" button.
        </div>
      </div>
    `;
    
    // Enable recognition testing with accessibility
    elements.testRecognitionBtn.disabled = false;
    elements.testRecognitionBtn.setAttribute('aria-disabled', 'false');
    elements.testRecognitionBtn.focus(); // Move focus to the next logical action
    
    // Announce completion to screen readers
    announceToScreenReader(
      'Voice training completed successfully! You can now test voice recognition.',
      'assertive'
    );
    
    // Provide haptic feedback if available
    if (navigator.vibrate && config.hapticFeedback !== false) {
      try {
        navigator.vibrate([100, 100, 100, 100, 300]); // Success pattern
      } catch (e) {
        console.log('Haptic feedback not available');
      }
    }
    
    // Log event
    security.auditTrail.log('voice:ui:training_completed', {
      voiceId: result.voiceId
    });
    
    updateUIState();
    
  } catch (error) {
    console.error('Failed to complete training:', error);
    uiState.error = error.message;
    uiState.processing = false;
    
    // Update UI for error state
    elements.statusIndicator.classList.remove('processing');
    elements.statusIndicator.classList.add('error');
    elements.progressBar.setAttribute('aria-busy', 'false');
    
    // Play error sound for blind users
    playAudioCue('error');
    
    // Announce error to screen readers
    announceToScreenReader('Training failed: ' + (error.message || 'Unknown error'), 'assertive');
    
    updateUIState();
  }
}

/**
 * Test voice recognition with accessibility enhancements
 */
async function testRecognition() {
  try {
    uiState.recognitionActive = true;
    uiState.error = null;
    
    // Update UI state
    elements.statusIndicator.classList.remove('completed');
    elements.statusIndicator.classList.add('recognition');
    elements.testRecognitionBtn.disabled = true;
    elements.testRecognitionBtn.setAttribute('aria-disabled', 'true');
    
    // Update ARIA attributes for screen readers
    elements.recordingStatus.setAttribute('aria-label', 'Voice recognition in progress');
    elements.progressBar.setAttribute('aria-busy', 'true');
    
    // Announce to screen readers
    announceToScreenReader('Starting voice recognition test. Please speak when prompted.', 'assertive');
    
    // Start verification
    await recognition.startVerification({
      targetVoiceId: uiState.currentVoiceId
    });
    
    // Play audio cue for blind users
    if (elements.audioRecord && config.audioFeedback !== false) {
      try {
        elements.audioRecord.play().catch(e => console.log('Could not play audio cue'));
      } catch (e) {
        // Fallback to Web Audio API
        playAudioCue('start');
      }
    } else {
      // Fallback to Web Audio API
      playAudioCue('start');
    }
    
    // Start recording
    await recognition.startVerificationRecording();
    
    // Provide haptic feedback if available
    if (navigator.vibrate && config.hapticFeedback !== false) {
      try {
        navigator.vibrate([100, 50, 100]); // Vibration pattern for start
      } catch (e) {
        console.log('Haptic feedback not available');
      }
    }
    
    // Display recording message with accessibility enhancements
    elements.recognitionResults.innerHTML = `
      <div class="alejo-recording-message" role="status" aria-live="assertive">
        <p>Speak now to test recognition...</p>
        <div class="sr-only" id="recognition-instructions">
          Please speak clearly for a few seconds to verify your voice. The system will automatically 
          stop recording after 3 seconds and analyze your voice pattern.
        </div>
      </div>
    `;
    
    // Start countdown for blind users
    let countdown = 3;
    const countdownInterval = setInterval(() => {
      countdown--;
      if (countdown > 0) {
        announceToScreenReader(countdown + ' seconds remaining', 'polite');
        playTickSound(countdown);
      } else {
        clearInterval(countdownInterval);
      }
    }, 1000);
    
    // Wait for 3 seconds
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Stop recording
    await recognition.stopVerificationRecording();
    
    // Play stop sound
    playAudioCue('stop');
    
    // Announce processing to screen readers
    announceToScreenReader('Recording stopped. Processing voice recognition...', 'polite');
    
    // Get verification result
    const result = await recognition.endVerification();
    
    uiState.recognitionResults = result;
    uiState.recognitionActive = false;
    
    // Update UI state
    elements.statusIndicator.classList.remove('recognition');
    elements.statusIndicator.classList.add(result.match ? 'success' : 'warning');
    elements.testRecognitionBtn.disabled = false;
    elements.testRecognitionBtn.setAttribute('aria-disabled', 'false');
    elements.progressBar.setAttribute('aria-busy', 'false');
    
    // Play result sound
    playAudioCue(result.match ? 'complete' : 'error');
    
    // Display results with accessibility enhancements
    const confidencePercent = (result.confidence * 100).toFixed(1);
    const matchText = result.match ? 'Yes' : 'No';
    
    elements.recognitionResults.innerHTML = `
      <div class="alejo-recognition-result" role="region" aria-labelledby="recognition-result-heading">
        <h3 id="recognition-result-heading">Recognition Results</h3>
        <p aria-live="polite">Confidence: <span class="confidence-value">${confidencePercent}%</span></p>
        <p aria-live="polite">Match: <span class="match-value">${matchText}</span></p>
        <div class="sr-only" id="recognition-result-details">
          Voice recognition test ${result.match ? 'successful' : 'unsuccessful'}. 
          The system detected your voice with ${confidencePercent} percent confidence.
          ${result.match ? 'Your voice was successfully verified.' : 'Your voice could not be verified. You may need to try again or retrain your voice model.'}
        </div>
      </div>
    `;
    
    // Announce results to screen readers
    const resultMessage = result.match ? 
      `Voice successfully recognized with ${confidencePercent} percent confidence.` : 
      `Voice not recognized. Confidence was only ${confidencePercent} percent.`;
    
    announceToScreenReader(resultMessage, 'assertive');
    
    updateUIState();
    
  } catch (error) {
    console.error('Failed to test recognition:', error);
    uiState.error = error.message;
    uiState.recognitionActive = false;
    
    // Update UI for error state
    elements.statusIndicator.classList.remove('recognition');
    elements.statusIndicator.classList.add('error');
    elements.progressBar.setAttribute('aria-busy', 'false');
    elements.testRecognitionBtn.disabled = false;
    elements.testRecognitionBtn.setAttribute('aria-disabled', 'false');
    
    // Play error sound
    playAudioCue('error');
    
    // Announce error to screen readers
    announceToScreenReader('Voice recognition failed: ' + (error.message || 'Unknown error'), 'assertive');
    
    updateUIState();
  }
}

/**
 * Update UI state based on current state with accessibility enhancements
 */
function updateUIState() {
  // Update button states with ARIA attributes
  elements.startTrainingBtn.disabled = uiState.trainingActive || uiState.recording || uiState.processing;
  elements.startTrainingBtn.setAttribute('aria-disabled', elements.startTrainingBtn.disabled);
  
  elements.recordSampleBtn.disabled = !uiState.trainingActive || uiState.recording || uiState.processing || uiState.currentSampleCount >= config.requiredSamples;
  elements.recordSampleBtn.setAttribute('aria-disabled', elements.recordSampleBtn.disabled);
  
  elements.stopRecordingBtn.disabled = !uiState.recording;
  elements.stopRecordingBtn.setAttribute('aria-disabled', elements.stopRecordingBtn.disabled);
  
  elements.completeTrainingBtn.disabled = !uiState.trainingActive || uiState.recording || uiState.processing || uiState.currentSampleCount < config.requiredSamples;
  elements.completeTrainingBtn.setAttribute('aria-disabled', elements.completeTrainingBtn.disabled);
  
  elements.testRecognitionBtn.disabled = uiState.trainingActive || !uiState.currentVoiceId || uiState.recognitionActive;
  elements.testRecognitionBtn.setAttribute('aria-disabled', elements.testRecognitionBtn.disabled);
  
  // Update progress with ARIA attributes
  elements.sampleCountEl.textContent = uiState.currentSampleCount;
  const progressPercent = (uiState.currentSampleCount / config.requiredSamples) * 100;
  elements.progressFill.style.width = `${progressPercent}%`;
  elements.progressBar.setAttribute('aria-valuenow', uiState.currentSampleCount);
  elements.progressBar.setAttribute('aria-valuetext', `${uiState.currentSampleCount} of ${config.requiredSamples} samples recorded, ${Math.round(progressPercent)}% complete`);
  
  // Update status indicator with appropriate ARIA roles
  elements.statusIndicator.classList.toggle('recording', uiState.recording);
  
  // Update status text for screen readers
  let statusText = '';
  if (uiState.error) {
    statusText = `Error: ${uiState.error}`;
  } else if (uiState.processing) {
    statusText = 'Processing voice data...';
  } else if (uiState.recording) {
    statusText = 'Recording in progress. Speak clearly.';
  } else if (uiState.recognitionActive) {
    statusText = 'Voice recognition in progress.';
  } else if (uiState.trainingActive) {
    statusText = `Voice training in progress. ${uiState.currentSampleCount} of ${config.requiredSamples} samples recorded.`;
  } else if (uiState.currentVoiceId) {
    statusText = `Voice model ${uiState.currentVoiceId} is ready. You can test recognition.`;
  } else {
    statusText = 'Ready to start voice training.';
  }
  
  // Update status for screen readers
  if (elements.recordingStatus) {
    elements.recordingStatus.setAttribute('aria-label', statusText);
  }
  
  // Show error if any with appropriate ARIA attributes
  if (uiState.error) {
    elements.errorMessage.textContent = uiState.error;
    elements.errorMessage.setAttribute('role', 'alert');
    elements.errorMessage.setAttribute('aria-live', 'assertive');
  } else {
    elements.errorMessage.textContent = '';
    elements.errorMessage.removeAttribute('role');
    elements.errorMessage.setAttribute('aria-live', 'off');
  }
  
  // Update focus if needed for screen reader users
  if (uiState.focusElement && document.activeElement !== uiState.focusElement) {
    try {
      uiState.focusElement.focus();
      uiState.focusElement = null; // Clear after focusing
    } catch (e) {
      console.log('Could not set focus to element');
    }
  }
}

/**
 * Start audio visualization with accessibility enhancements
 */
function startVisualization() {
  // This implements real-time audio visualization
  // using Web Audio API and Canvas with accessibility features
  console.log('Starting audio visualization');
  
  // Placeholder: Draw a simple waveform
  const canvas = elements.waveformCanvas;
  const ctx = canvas.getContext('2d');
  
  // Set appropriate ARIA attributes for the visualization container
  if (elements.visualizationContainer) {
    elements.visualizationContainer.setAttribute('aria-label', 'Audio waveform visualization');
    elements.visualizationContainer.setAttribute('aria-live', 'polite');
    elements.visualizationContainer.setAttribute('role', 'img');
  }
  
  // Add text alternative for screen reader users
  if (!elements.visualizationAltText) {
    elements.visualizationAltText = document.createElement('div');
    elements.visualizationAltText.className = 'sr-only';
    elements.visualizationAltText.id = 'visualization-description';
    elements.visualizationContainer.appendChild(elements.visualizationAltText);
  }
  
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Draw placeholder waveform
  ctx.strokeStyle = '#2196f3';
  ctx.lineWidth = 2;
  ctx.beginPath();
  
  // Track audio levels for accessibility descriptions
  let audioLevelDescription = 'quiet';
  let prevAudioLevel = 'quiet';
  
  const visualizationInterval = setInterval(() => {
    if (!uiState.recording) {
      clearInterval(visualizationInterval);
      return;
    }
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    
    // Draw random waveform (placeholder)
    // In a real implementation, this would use actual audio data
    const centerY = canvas.height / 2;
    ctx.moveTo(0, centerY);
    
    // Generate random values for visualization
    let maxAmplitude = 0;
    const amplitudes = [];
    
    for (let x = 0; x < canvas.width; x += 5) {
      // In a real implementation, this would be actual audio data
      const amplitude = Math.random() * 30;
      amplitudes.push(amplitude);
      maxAmplitude = Math.max(maxAmplitude, amplitude);
      
      const y = centerY + (amplitude - 15);
      ctx.lineTo(x, y);
    }
    
    ctx.stroke();
    
    // Determine audio level for accessibility description
    if (maxAmplitude < 10) {
      audioLevelDescription = 'quiet';
    } else if (maxAmplitude < 20) {
      audioLevelDescription = 'moderate';
    } else {
      audioLevelDescription = 'loud';
    }
    
    // Only update the description when the audio level changes significantly
    if (audioLevelDescription !== prevAudioLevel) {
      elements.visualizationAltText.textContent = `Audio level: ${audioLevelDescription}`;
      prevAudioLevel = audioLevelDescription;
      
      // Update ARIA description
      elements.visualizationContainer.setAttribute('aria-label', `Audio waveform visualization: ${audioLevelDescription} level`);
      
      // For blind users, we can optionally provide an audio representation of the level
      // This is subtle and only plays when the level changes
      if (config.audioFeedback !== false && uiState.recording) {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        // Configure audio based on level
        switch (audioLevelDescription) {
          case 'quiet':
            oscillator.frequency.value = 300;
            gainNode.gain.value = 0.05;
            break;
          case 'moderate':
            oscillator.frequency.value = 400;
            gainNode.gain.value = 0.1;
            break;
          case 'loud':
            oscillator.frequency.value = 500;
            gainNode.gain.value = 0.15;
            break;
        }
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.start();
        setTimeout(() => {
          oscillator.stop();
          audioCtx.close();
        }, 100);
      }
    }
  }, 200); // Reduced update frequency for better performance and less overwhelming feedback
  
  // Store interval ID for cleanup
  uiState.visualizationInterval = visualizationInterval;
}

/**
 * Stop audio visualization with accessibility cleanup
 */
function stopVisualization() {
  console.log('Stopping audio visualization');
  
  // Clear visualization interval if it exists
  if (uiState.visualizationInterval) {
    clearInterval(uiState.visualizationInterval);
    uiState.visualizationInterval = null;
  }
  
  // Update accessibility attributes
  if (elements.visualizationContainer) {
    elements.visualizationContainer.setAttribute('aria-label', 'Audio visualization stopped');
  }
  
  // Update text alternative for screen readers
  if (elements.visualizationAltText) {
    elements.visualizationAltText.textContent = 'Audio recording has stopped. Visualization is no longer active.';
  }
  
  // Clear canvas if it exists
  if (elements.waveformCanvas) {
    const ctx = elements.waveformCanvas.getContext('2d');
    ctx.clearRect(0, 0, elements.waveformCanvas.width, elements.waveformCanvas.height);
  }
}

/**
 * Update emotion visualization with accessibility enhancements
 * @param {Object} emotionData - Emotion analysis data
 */
function updateEmotionVisualization(emotionData) {
  if (!emotionData || !emotionData.emotions) {
    return;
  }
  
  const emotions = emotionData.emotions;
  const container = elements.emotionBars;
  
  // Set appropriate ARIA attributes for the container
  container.setAttribute('role', 'region');
  container.setAttribute('aria-label', 'Voice emotion analysis');
  
  // Create HTML for emotion bars with accessibility enhancements
  let html = '<div class="alejo-emotion-bars-container" role="group" aria-label="Emotion intensity chart">';
  
  // Create a text summary for screen readers
  let dominantEmotion = '';
  let maxScore = 0;
  let emotionSummary = [];
  
  // First pass to find dominant emotion and prepare summary
  for (const [emotion, score] of Object.entries(emotions)) {
    if (score > maxScore) {
      maxScore = score;
      dominantEmotion = emotion;
    }
    
    // Format for summary
    const percentage = Math.round(score * 100);
    if (percentage > 10) { // Only include significant emotions
      emotionSummary.push(`${emotion} ${percentage}%`);
    }
  }
  
  // Create the visual bars with proper ARIA attributes
  for (const [emotion, score] of Object.entries(emotions)) {
    const height = Math.max(10, score * 100);
    const percentage = Math.round(score * 100);
    const isHighest = emotion === dominantEmotion;
    
    html += `
      <div class="alejo-emotion-bar ${isHighest ? 'dominant' : ''}" 
           style="height: ${height}%;" 
           role="meter" 
           aria-label="${emotion}" 
           aria-valuenow="${percentage}" 
           aria-valuemin="0" 
           aria-valuemax="100">
        <div class="alejo-emotion-label">${emotion}</div>
        <div class="alejo-emotion-value">${percentage}%</div>
      </div>
    `;
  }
  
  html += '</div>';
  
  // Add a hidden text summary for screen readers
  html += `
    <div class="sr-only" id="emotion-summary" aria-live="polite">
      Voice emotion analysis: ${dominantEmotion ? `Dominant emotion is ${dominantEmotion} at ${Math.round(maxScore * 100)}%.` : 'No dominant emotion detected.'} 
      ${emotionSummary.length > 0 ? `Detected emotions: ${emotionSummary.join(', ')}.` : ''}
    </div>
  `;
  
  container.innerHTML = html;
  
  // Announce emotion summary to screen readers if significant changes
  if (dominantEmotion && maxScore > 0.3) { // Only announce if there's a clear emotion
    announceToScreenReader(`Dominant emotion detected: ${dominantEmotion}`, 'polite');
    
    // Optional: provide audio feedback for dominant emotion
    if (config.audioFeedback !== false) {
      // Use different tones for different emotion categories
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      // Map emotions to frequencies (higher = more positive)
      const emotionFrequencies = {
        'happy': 520,
        'excited': 500,
        'calm': 440,
        'neutral': 400,
        'sad': 350,
        'angry': 300,
        'fearful': 280
      };
      
      // Use mapped frequency or default
      oscillator.frequency.value = emotionFrequencies[dominantEmotion.toLowerCase()] || 400;
      gainNode.gain.value = 0.1; // Subtle volume
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      // Play a brief tone
      oscillator.start();
      setTimeout(() => {
        oscillator.stop();
        audioCtx.close();
      }, 200);
    }
  }
}

/**
 * Update speech pattern visualization with accessibility enhancements
 * @param {Object} patternData - Speech pattern analysis data
 */
function updateSpeechPatternVisualization(patternData) {
  if (!patternData || !patternData.patterns) {
    return;
  }
  
  // Update distinctive patterns list with accessibility enhancements
  const distinctiveContainer = elements.distinctivePatterns;
  
  // Set appropriate ARIA attributes
  distinctiveContainer.setAttribute('role', 'region');
  distinctiveContainer.setAttribute('aria-label', 'Speech pattern analysis');
  
  // Create a text summary of the most distinctive patterns for screen readers
  let distinctivePatternsSummary = [];
  for (const item of patternData.distinctive) {
    const direction = item.deviation > 0 ? 'higher than average' : 'lower than average';
    const percentage = Math.round(item.score * 100);
    distinctivePatternsSummary.push(`${item.pattern} is ${direction} at ${percentage}%`);
  }
  
  // Create the HTML with proper ARIA attributes
  let html = `
    <h4 id="distinctive-patterns-heading">Distinctive Speech Patterns</h4>
    <ul class="alejo-distinctive-list" aria-labelledby="distinctive-patterns-heading" role="list">
  `;
  
  for (const item of patternData.distinctive) {
    const direction = item.deviation > 0 ? 'high' : 'low';
    const directionText = item.deviation > 0 ? 'higher than average' : 'lower than average';
    const percentage = (item.score * 100).toFixed(1);
    
    html += `
      <li role="listitem">
        <span class="alejo-pattern-name">${item.pattern}</span>: 
        <span class="alejo-pattern-value ${direction}" 
              aria-label="${percentage} percent, ${directionText}">
          ${percentage}%
        </span>
      </li>
    `;
  }
  
  html += '</ul>';
  
  // Add a hidden text summary for screen readers
  html += `
    <div class="sr-only" id="speech-pattern-summary" aria-live="polite">
      Speech pattern analysis: ${distinctivePatternsSummary.length > 0 ? 
        `Your most distinctive speech patterns are: ${distinctivePatternsSummary.join('. ')}` : 
        'No distinctive speech patterns detected.'}
    </div>
  `;
  
  distinctiveContainer.innerHTML = html;
  
  // Announce a summary to screen readers
  if (distinctivePatternsSummary.length > 0) {
    const topPattern = distinctivePatternsSummary[0];
    announceToScreenReader(`Speech pattern detected: ${topPattern}`, 'polite');
  }
  
  // Note: Radar chart would require a charting library
  // For simplicity, we're just showing the distinctive patterns list with enhanced accessibility
}

// Event handlers

/**
 * Handle recording started event with accessibility enhancements
 * @param {Object} data - Event data
 */
function handleRecordingStarted(data) {
  console.log('Recording started event received:', data);
  uiState.recording = true;
  
  // Update ARIA live regions for screen readers
  if (elements.recordingStatus) {
    elements.recordingStatus.setAttribute('aria-busy', 'true');
    elements.recordingStatus.setAttribute('aria-label', 'Recording in progress');
  }
  
  // Play audio cue for blind users if not already played by startRecording
  if (data.source === 'external' && config.audioFeedback !== false) {
    playAudioCue('start');
  }
  
  // Provide haptic feedback if available and triggered externally
  if (data.source === 'external' && navigator.vibrate && config.hapticFeedback !== false) {
    try {
      navigator.vibrate([100, 50, 100]); // Vibration pattern for start
    } catch (e) {
      console.log('Haptic feedback not available');
    }
  }
  
  // Announce to screen readers if triggered externally
  if (data.source === 'external') {
    announceToScreenReader('Recording started. Please speak clearly.', 'assertive');
  }
  
  // Start visualization with accessibility features
  startVisualization();
  
  updateUIState();
  
  // Log event with security module
  if (security && security.auditTrail) {
    security.auditTrail.log('voice:ui:recording_started', {
      source: data.source || 'ui',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Handle recording stopped event with accessibility enhancements
 * @param {Object} data - Event data
 */
function handleRecordingStopped(data) {
  console.log('Recording stopped event received:', data);
  uiState.recording = false;
  
  // Update ARIA live regions for screen readers
  if (elements.recordingStatus) {
    elements.recordingStatus.setAttribute('aria-busy', 'false');
    elements.recordingStatus.setAttribute('aria-label', 'Recording stopped');
  }
  
  // Play audio cue for blind users if not already played by stopRecording
  if (data.source === 'external' && config.audioFeedback !== false) {
    playAudioCue('stop');
  }
  
  // Provide haptic feedback if available and triggered externally
  if (data.source === 'external' && navigator.vibrate && config.hapticFeedback !== false) {
    try {
      navigator.vibrate([200]); // Vibration pattern for stop
    } catch (e) {
      console.log('Haptic feedback not available');
    }
  }
  
  // Announce to screen readers if triggered externally
  if (data.source === 'external') {
    announceToScreenReader('Recording stopped. Processing audio...', 'polite');
  }
  
  // Stop visualization with accessibility cleanup
  stopVisualization();
  
  updateUIState();
  
  // Log event with security module
  if (security && security.auditTrail) {
    security.auditTrail.log('voice:ui:recording_stopped', {
      source: data.source || 'ui',
      duration: data.duration || 'unknown',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Handle training progress event with accessibility enhancements
 * @param {Object} data - Event data
 */
function handleTrainingProgress(data) {
  console.log('Training progress event received:', data);
  uiState.currentSampleCount = data.sampleCount;
  
  // Calculate progress percentage for announcements
  const progressPercent = Math.round((data.sampleCount / config.requiredSamples) * 100);
  
  // Update ARIA attributes for progress indication
  if (elements.progressBar) {
    elements.progressBar.setAttribute('aria-valuenow', data.sampleCount);
    elements.progressBar.setAttribute('aria-valuetext', 
      `${data.sampleCount} of ${config.requiredSamples} samples recorded, ${progressPercent}% complete`);
  }
  
  // Announce progress at meaningful intervals (25%, 50%, 75%, 100%)
  if (progressPercent % 25 === 0 && progressPercent > 0) {
    announceToScreenReader(
      `Training progress: ${progressPercent}% complete. ${data.sampleCount} of ${config.requiredSamples} samples recorded.`, 
      'polite'
    );
    
    // Play subtle progress tone at key milestones
    if (config.audioFeedback !== false) {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      // Higher pitch for more progress
      oscillator.frequency.value = 440 + (progressPercent * 2);
      gainNode.gain.value = 0.1;
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.start();
      setTimeout(() => {
        oscillator.stop();
        audioCtx.close();
      }, 150);
    }
  }
  
  updateUIState();
  
  // Log event with security module
  if (security && security.auditTrail) {
    security.auditTrail.log('voice:ui:training_progress', {
      sampleCount: data.sampleCount,
      totalRequired: config.requiredSamples,
      progressPercent: progressPercent,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Handle training completed event with accessibility enhancements
 * @param {Object} data - Event data
 */
function handleTrainingCompleted(data) {
  console.log('Training completed event received:', data);
  uiState.trainingActive = false;
  uiState.currentVoiceId = data.voiceId || uiState.currentVoiceId;
  
  // Update ARIA live regions for screen readers
  if (elements.recordingStatus) {
    elements.recordingStatus.setAttribute('aria-busy', 'false');
    elements.recordingStatus.setAttribute('aria-label', 'Voice training completed');
  }
  
  // Play completion sound for blind users
  if (config.audioFeedback !== false) {
    playAudioCue('complete');
  }
  
  // Provide haptic feedback if available
  if (navigator.vibrate && config.hapticFeedback !== false) {
    try {
      navigator.vibrate([100, 100, 100, 100, 300]); // Success pattern
    } catch (e) {
      console.log('Haptic feedback not available');
    }
  }
  
  // Announce completion to screen readers
  announceToScreenReader(
    `Voice training completed successfully! Your voice model ${data.voiceId || ''} has been created.`,
    'assertive'
  );
  
  // Set focus to the next logical action button
  if (elements.testRecognitionBtn && !elements.testRecognitionBtn.disabled) {
    uiState.focusElement = elements.testRecognitionBtn;
  }
  
  updateUIState();
  
  // Log event with security module
  if (security && security.auditTrail) {
    security.auditTrail.log('voice:ui:training_completed', {
      voiceId: data.voiceId || uiState.currentVoiceId,
      sampleCount: uiState.currentSampleCount,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Handle recognition result event with accessibility enhancements
 * @param {Object} data - Event data
 */
function handleRecognitionResult(data) {
  console.log('Recognition result event received:', data);
  uiState.recognitionResults = data;
  uiState.recognitionActive = false;
  
  // Update ARIA live regions for screen readers
  if (elements.recordingStatus) {
    elements.recordingStatus.setAttribute('aria-busy', 'false');
  }
  
  // Format confidence for announcements
  const confidencePercent = Math.round(data.confidence * 100);
  
  // Play appropriate sound based on match result
  if (config.audioFeedback !== false) {
    playAudioCue(data.match ? 'complete' : 'error');
  }
  
  // Provide haptic feedback based on result
  if (navigator.vibrate && config.hapticFeedback !== false) {
    try {
      if (data.match) {
        navigator.vibrate([100, 100, 100, 100, 300]); // Success pattern
      } else {
        navigator.vibrate([300, 100, 300]); // Error pattern
      }
    } catch (e) {
      console.log('Haptic feedback not available');
    }
  }
  
  // Announce result to screen readers
  const resultMessage = data.match ? 
    `Voice successfully recognized with ${confidencePercent} percent confidence.` : 
    `Voice not recognized. Confidence was only ${confidencePercent} percent.`;
  
  announceToScreenReader(resultMessage, 'assertive');
  
  updateUIState();
  
  // Log event with security module
  if (security && security.auditTrail) {
    security.auditTrail.log('voice:ui:recognition_result', {
      match: data.match,
      confidence: data.confidence,
      voiceId: uiState.currentVoiceId,
      timestamp: new Date().toISOString()
    });
  }
}

// Export public API
export default {
  initialize,
  startTrainingSession,
  startRecording,
  stopRecording,
  completeTrainingSession,
  testRecognition
};
