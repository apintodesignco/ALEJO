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
 * Create UI elements for voice training
 */
function createUIElements() {
  // Get container element
  const container = document.getElementById(config.containerId);
  if (!container) {
    throw new Error(`Container element not found: ${config.containerId}`);
  }
  
  // Set theme class
  container.classList.add(`alejo-theme-${config.theme}`);
  
  // Create UI structure
  container.innerHTML = `
    <div class="alejo-voice-training">
      <div class="alejo-voice-header">
        <h2>ALEJO Voice Training</h2>
        <div class="alejo-status-indicator ${uiState.recording ? 'recording' : ''}"></div>
      </div>
      
      <div class="alejo-voice-main">
        <div class="alejo-voice-controls">
          <button id="alejo-start-training" class="alejo-btn primary">Start Training</button>
          <button id="alejo-record-sample" class="alejo-btn" disabled>Record Sample</button>
          <button id="alejo-stop-recording" class="alejo-btn danger" disabled>Stop Recording</button>
          <button id="alejo-complete-training" class="alejo-btn success" disabled>Complete Training</button>
          <button id="alejo-test-recognition" class="alejo-btn" disabled>Test Recognition</button>
        </div>
        
        <div class="alejo-voice-progress">
          <div class="alejo-progress-label">Training Progress</div>
          <div class="alejo-progress-bar">
            <div class="alejo-progress-fill" style="width: 0%"></div>
          </div>
          <div class="alejo-progress-status">
            <span id="alejo-sample-count">0</span>/<span id="alejo-required-samples">${config.requiredSamples}</span> samples
          </div>
        </div>
        
        <div class="alejo-voice-visualization">
          <canvas id="alejo-voice-waveform" width="400" height="100"></canvas>
        </div>
      </div>
      
      <div id="alejo-advanced-features" class="alejo-voice-advanced" style="display: ${config.showAdvancedFeatures ? 'block' : 'none'}">
        <h3>Advanced Analysis</h3>
        
        <div id="alejo-emotion-analysis" class="alejo-analysis-section" style="display: ${config.showEmotionAnalysis ? 'block' : 'none'}">
          <h4>Emotion Analysis</h4>
          <div class="alejo-emotion-chart">
            <div id="alejo-emotion-bars"></div>
          </div>
        </div>
        
        <div id="alejo-speech-patterns" class="alejo-analysis-section" style="display: ${config.showSpeechPatterns ? 'block' : 'none'}">
          <h4>Speech Patterns</h4>
          <div id="alejo-pattern-radar"></div>
          <div id="alejo-distinctive-patterns"></div>
        </div>
      </div>
      
      <div class="alejo-voice-results">
        <div id="alejo-recognition-results"></div>
        <div id="alejo-error-message" class="alejo-error"></div>
      </div>
    </div>
  `;
  
  // Cache element references
  elements = {
    startTrainingBtn: document.getElementById('alejo-start-training'),
    recordSampleBtn: document.getElementById('alejo-record-sample'),
    stopRecordingBtn: document.getElementById('alejo-stop-recording'),
    completeTrainingBtn: document.getElementById('alejo-complete-training'),
    testRecognitionBtn: document.getElementById('alejo-test-recognition'),
    sampleCountEl: document.getElementById('alejo-sample-count'),
    requiredSamplesEl: document.getElementById('alejo-required-samples'),
    progressFill: container.querySelector('.alejo-progress-fill'),
    waveformCanvas: document.getElementById('alejo-voice-waveform'),
    emotionBars: document.getElementById('alejo-emotion-bars'),
    patternRadar: document.getElementById('alejo-pattern-radar'),
    distinctivePatterns: document.getElementById('alejo-distinctive-patterns'),
    recognitionResults: document.getElementById('alejo-recognition-results'),
    errorMessage: document.getElementById('alejo-error-message'),
    statusIndicator: container.querySelector('.alejo-status-indicator')
  };
  
  // Add CSS styles
  addStyles();
}

/**
 * Attach event listeners to UI elements
 */
function attachEventListeners() {
  elements.startTrainingBtn.addEventListener('click', startTrainingSession);
  elements.recordSampleBtn.addEventListener('click', startRecording);
  elements.stopRecordingBtn.addEventListener('click', stopRecording);
  elements.completeTrainingBtn.addEventListener('click', completeTrainingSession);
  elements.testRecognitionBtn.addEventListener('click', testRecognition);
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
 * Start recording a voice sample
 */
async function startRecording() {
  try {
    uiState.error = null;
    uiState.recording = true;
    
    // Start recording
    await training.startRecording();
    
    // Update UI
    updateUIState();
    
    // Start visualizing audio
    startVisualization();
    
  } catch (error) {
    console.error('Failed to start recording:', error);
    uiState.error = error.message;
    uiState.recording = false;
    updateUIState();
  }
}

/**
 * Stop recording a voice sample
 */
async function stopRecording() {
  try {
    uiState.recording = false;
    uiState.processing = true;
    
    // Update UI
    updateUIState();
    
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
 * Complete the training session
 */
async function completeTrainingSession() {
  try {
    uiState.processing = true;
    updateUIState();
    
    // Complete training
    const result = await training.endTrainingSession(true);
    
    uiState.trainingActive = false;
    uiState.processing = false;
    
    // Show success message
    elements.recognitionResults.innerHTML = `
      <div class="alejo-success-message">
        <h3>Voice Training Complete!</h3>
        <p>Your voice model "${result.voiceId}" has been created successfully.</p>
      </div>
    `;
    
    // Enable recognition testing
    elements.testRecognitionBtn.disabled = false;
    
    // Log event
    security.auditTrail.log('voice:ui:training_completed', {
      voiceId: result.voiceId
    });
    
    updateUIState();
    
  } catch (error) {
    console.error('Failed to complete training:', error);
    uiState.error = error.message;
    uiState.processing = false;
    updateUIState();
  }
}

/**
 * Test voice recognition
 */
async function testRecognition() {
  try {
    uiState.recognitionActive = true;
    uiState.error = null;
    updateUIState();
    
    // Start verification
    await recognition.startVerification({
      targetVoiceId: uiState.currentVoiceId
    });
    
    // Start recording
    await recognition.startVerificationRecording();
    
    elements.recognitionResults.innerHTML = `
      <div class="alejo-recording-message">
        <p>Speak now to test recognition...</p>
      </div>
    `;
    
    // Wait for 3 seconds
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Stop recording
    await recognition.stopVerificationRecording();
    
    // Get verification result
    const result = await recognition.endVerification();
    
    uiState.recognitionResults = result;
    uiState.recognitionActive = false;
    
    // Display results
    elements.recognitionResults.innerHTML = `
      <div class="alejo-recognition-result">
        <h3>Recognition Results</h3>
        <p>Confidence: ${(result.confidence * 100).toFixed(1)}%</p>
        <p>Match: ${result.match ? 'Yes' : 'No'}</p>
      </div>
    `;
    
    updateUIState();
    
  } catch (error) {
    console.error('Failed to test recognition:', error);
    uiState.error = error.message;
    uiState.recognitionActive = false;
    updateUIState();
  }
}

/**
 * Update UI state based on current state
 */
function updateUIState() {
  // Update button states
  elements.startTrainingBtn.disabled = uiState.trainingActive || uiState.recording || uiState.processing;
  elements.recordSampleBtn.disabled = !uiState.trainingActive || uiState.recording || uiState.processing || uiState.currentSampleCount >= config.requiredSamples;
  elements.stopRecordingBtn.disabled = !uiState.recording;
  elements.completeTrainingBtn.disabled = !uiState.trainingActive || uiState.recording || uiState.processing || uiState.currentSampleCount < config.requiredSamples;
  elements.testRecognitionBtn.disabled = uiState.trainingActive || !uiState.currentVoiceId || uiState.recognitionActive;
  
  // Update progress
  elements.sampleCountEl.textContent = uiState.currentSampleCount;
  const progressPercent = (uiState.currentSampleCount / config.requiredSamples) * 100;
  elements.progressFill.style.width = `${progressPercent}%`;
  
  // Update status indicator
  elements.statusIndicator.classList.toggle('recording', uiState.recording);
  
  // Show error if any
  elements.errorMessage.textContent = uiState.error || '';
}

/**
 * Start audio visualization
 */
function startVisualization() {
  // This would implement real-time audio visualization
  // using Web Audio API and Canvas
  console.log('Starting audio visualization');
  
  // Placeholder: Draw a simple waveform
  const canvas = elements.waveformCanvas;
  const ctx = canvas.getContext('2d');
  
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Draw placeholder waveform
  ctx.strokeStyle = '#2196f3';
  ctx.lineWidth = 2;
  ctx.beginPath();
  
  const visualizationInterval = setInterval(() => {
    if (!uiState.recording) {
      clearInterval(visualizationInterval);
      return;
    }
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    
    // Draw random waveform (placeholder)
    const centerY = canvas.height / 2;
    ctx.moveTo(0, centerY);
    
    for (let x = 0; x < canvas.width; x += 5) {
      const y = centerY + (Math.random() * 30 - 15);
      ctx.lineTo(x, y);
    }
    
    ctx.stroke();
  }, 100);
}

/**
 * Stop audio visualization
 */
function stopVisualization() {
  console.log('Stopping audio visualization');
  // Cleanup would happen here
}

/**
 * Update emotion visualization
 * @param {Object} emotionData - Emotion analysis data
 */
function updateEmotionVisualization(emotionData) {
  if (!emotionData || !emotionData.emotions) {
    return;
  }
  
  const emotions = emotionData.emotions;
  const container = elements.emotionBars;
  
  // Create HTML for emotion bars
  let html = '';
  for (const [emotion, score] of Object.entries(emotions)) {
    const height = Math.max(10, score * 100);
    html += `
      <div class="alejo-emotion-bar" style="height: ${height}%;">
        <div class="alejo-emotion-label">${emotion}</div>
      </div>
    `;
  }
  
  container.innerHTML = html;
}

/**
 * Update speech pattern visualization
 * @param {Object} patternData - Speech pattern analysis data
 */
function updateSpeechPatternVisualization(patternData) {
  if (!patternData || !patternData.patterns) {
    return;
  }
  
  // Update distinctive patterns list
  const distinctiveContainer = elements.distinctivePatterns;
  let html = '<ul class="alejo-distinctive-list">';
  
  for (const item of patternData.distinctive) {
    const direction = item.deviation > 0 ? 'high' : 'low';
    html += `
      <li>
        <span class="alejo-pattern-name">${item.pattern}</span>: 
        <span class="alejo-pattern-value ${direction}">${(item.score * 100).toFixed(1)}%</span>
      </li>
    `;
  }
  
  html += '</ul>';
  distinctiveContainer.innerHTML = html;
  
  // Note: Radar chart would require a charting library
  // For simplicity, we're just showing the distinctive patterns list
}

// Event handlers

/**
 * Handle recording started event
 * @param {Object} data - Event data
 */
function handleRecordingStarted(data) {
  console.log('Recording started event received:', data);
  uiState.recording = true;
  updateUIState();
}

/**
 * Handle recording stopped event
 * @param {Object} data - Event data
 */
function handleRecordingStopped(data) {
  console.log('Recording stopped event received:', data);
  uiState.recording = false;
  updateUIState();
}

/**
 * Handle training progress event
 * @param {Object} data - Event data
 */
function handleTrainingProgress(data) {
  console.log('Training progress event received:', data);
  uiState.currentSampleCount = data.sampleCount;
  updateUIState();
}

/**
 * Handle training completed event
 * @param {Object} data - Event data
 */
function handleTrainingCompleted(data) {
  console.log('Training completed event received:', data);
  uiState.trainingActive = false;
  updateUIState();
}

/**
 * Handle recognition result event
 * @param {Object} data - Event data
 */
function handleRecognitionResult(data) {
  console.log('Recognition result event received:', data);
  uiState.recognitionResults = data;
  uiState.recognitionActive = false;
  updateUIState();
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
