/**
 * ALEJO Eye Tracking Demo
 * 
 * This demo showcases the eye tracking capabilities of ALEJO's biometric system.
 * It initializes the eye tracking modules, displays a live video feed with eye tracking
 * visualization, and provides controls for calibration and configuration.
 */

import { initializeBiometrics } from '../src/biometrics/index.js';
import { subscribe, publish } from '../src/core/event-bus.js';
import { startCalibration } from '../src/biometrics/eye/calibration.js';

// DOM elements
let videoElement;
let canvasElement;
let debugCanvas;
let statusElement;
let calibrateButton;
let toggleDebugButton;
let privacyModeSelect;

// State
let biometrics;
let isDebugMode = true;
let eyeTrackingData = null;

/**
 * Initialize the demo
 */
async function initializeDemo() {
  try {
    // Set up UI
    setupUI();
    
    // Initialize biometrics system with eye tracking enabled
    biometrics = await initializeBiometrics({
      autoStart: false,
      faceDetection: {
        enabled: true,
        options: {
          withFaceLandmarks: true,
          withFaceExpressions: false,
          withAgeAndGender: false,
          withFaceDescriptors: false
        }
      },
      handTracking: {
        enabled: false
      },
      eyeTracking: {
        enabled: true,
        calibrationRequired: true,
        trackPupils: true,
        trackGaze: true,
        trackBlinks: true,
        trackSaccades: true,
        processingIntervalMs: 50,
        adaptiveProcessing: true,
        debugMode: true,
        privacyMode: 'none',
        smoothingFactor: 0.7,
        performanceMode: 'balanced',
        accessibility: {
          highContrastMode: false,
          largerTargets: false,
          slowerAnimation: false,
          voicePrompts: false,
          extraTime: false
        }
      }
    });
    
    // Set up event listeners
    setupEventListeners();
    
    // Start biometric processing
    await biometrics.startProcessing();
    
    updateStatus('Eye tracking initialized. Please calibrate for best results.');
  } catch (error) {
    console.error('Failed to initialize demo:', error);
    updateStatus(`Error: ${error.message}`, true);
  }
}

/**
 * Set up the user interface
 */
function setupUI() {
  // Create container
  const container = document.createElement('div');
  container.className = 'eye-tracking-demo';
  container.style.fontFamily = 'Arial, sans-serif';
  container.style.maxWidth = '800px';
  container.style.margin = '0 auto';
  container.style.padding = '20px';
  
  // Add title
  const title = document.createElement('h1');
  title.textContent = 'ALEJO Eye Tracking Demo';
  title.style.textAlign = 'center';
  container.appendChild(title);
  
  // Add description
  const description = document.createElement('p');
  description.textContent = 'This demo showcases ALEJO\'s eye tracking capabilities. ' +
    'The system tracks your eyes in real-time, detecting pupil position, gaze direction, ' +
    'blinks, and rapid eye movements (saccades).';
  description.style.marginBottom = '20px';
  container.appendChild(description);
  
  // Create video container
  const videoContainer = document.createElement('div');
  videoContainer.style.position = 'relative';
  videoContainer.style.width = '640px';
  videoContainer.style.height = '480px';
  videoContainer.style.margin = '0 auto';
  videoContainer.style.border = '1px solid #ccc';
  videoContainer.style.overflow = 'hidden';
  
  // Create video element
  videoElement = document.createElement('video');
  videoElement.width = 640;
  videoElement.height = 480;
  videoElement.autoplay = true;
  videoElement.muted = true;
  videoElement.playsInline = true;
  videoElement.style.position = 'absolute';
  videoElement.style.zIndex = '1';
  videoContainer.appendChild(videoElement);
  
  // Create canvas overlay for face detection visualization
  canvasElement = document.createElement('canvas');
  canvasElement.width = 640;
  canvasElement.height = 480;
  canvasElement.style.position = 'absolute';
  canvasElement.style.zIndex = '2';
  videoContainer.appendChild(canvasElement);
  
  // Create debug canvas for eye tracking visualization
  debugCanvas = document.createElement('canvas');
  debugCanvas.width = 640;
  debugCanvas.height = 480;
  debugCanvas.style.position = 'absolute';
  debugCanvas.style.zIndex = '3';
  videoContainer.appendChild(debugCanvas);
  
  container.appendChild(videoContainer);
  
  // Create controls container
  const controlsContainer = document.createElement('div');
  controlsContainer.style.marginTop = '20px';
  controlsContainer.style.display = 'flex';
  controlsContainer.style.justifyContent = 'center';
  controlsContainer.style.gap = '10px';
  
  // Create calibrate button
  calibrateButton = document.createElement('button');
  calibrateButton.textContent = 'Calibrate Eye Tracking';
  calibrateButton.style.padding = '10px 15px';
  calibrateButton.style.backgroundColor = '#4CAF50';
  calibrateButton.style.color = 'white';
  calibrateButton.style.border = 'none';
  calibrateButton.style.borderRadius = '4px';
  calibrateButton.style.cursor = 'pointer';
  controlsContainer.appendChild(calibrateButton);
  
  // Create debug toggle button
  toggleDebugButton = document.createElement('button');
  toggleDebugButton.textContent = 'Hide Debug View';
  toggleDebugButton.style.padding = '10px 15px';
  toggleDebugButton.style.backgroundColor = '#2196F3';
  toggleDebugButton.style.color = 'white';
  toggleDebugButton.style.border = 'none';
  toggleDebugButton.style.borderRadius = '4px';
  toggleDebugButton.style.cursor = 'pointer';
  controlsContainer.appendChild(toggleDebugButton);
  
  // Create privacy mode selector
  const privacyLabel = document.createElement('label');
  privacyLabel.textContent = 'Privacy Mode: ';
  privacyLabel.style.display = 'flex';
  privacyLabel.style.alignItems = 'center';
  
  privacyModeSelect = document.createElement('select');
  privacyModeSelect.style.padding = '10px';
  privacyModeSelect.style.borderRadius = '4px';
  
  const privacyOptions = [
    { value: 'none', text: 'None' },
    { value: 'blur', text: 'Blur Eyes' },
    { value: 'mask', text: 'Mask Eyes' }
  ];
  
  privacyOptions.forEach(option => {
    const optionElement = document.createElement('option');
    optionElement.value = option.value;
    optionElement.textContent = option.text;
    privacyModeSelect.appendChild(optionElement);
  });
  
  privacyLabel.appendChild(privacyModeSelect);
  controlsContainer.appendChild(privacyLabel);
  
  container.appendChild(controlsContainer);
  
  // Create status element
  statusElement = document.createElement('div');
  statusElement.style.marginTop = '20px';
  statusElement.style.padding = '10px';
  statusElement.style.backgroundColor = '#f0f0f0';
  statusElement.style.borderRadius = '4px';
  statusElement.style.textAlign = 'center';
  container.appendChild(statusElement);
  
  // Create metrics container
  const metricsContainer = document.createElement('div');
  metricsContainer.style.marginTop = '20px';
  metricsContainer.style.display = 'grid';
  metricsContainer.style.gridTemplateColumns = 'repeat(3, 1fr)';
  metricsContainer.style.gap = '10px';
  
  // Create metric boxes
  const metrics = [
    { id: 'gaze', label: 'Gaze Position' },
    { id: 'blinks', label: 'Blinks' },
    { id: 'saccades', label: 'Saccades' },
    { id: 'leftPupil', label: 'Left Pupil' },
    { id: 'rightPupil', label: 'Right Pupil' },
    { id: 'performance', label: 'Performance' }
  ];
  
  metrics.forEach(metric => {
    const metricBox = document.createElement('div');
    metricBox.id = `metric-${metric.id}`;
    metricBox.style.padding = '10px';
    metricBox.style.backgroundColor = '#f9f9f9';
    metricBox.style.borderRadius = '4px';
    metricBox.style.border = '1px solid #ddd';
    
    const metricLabel = document.createElement('div');
    metricLabel.textContent = metric.label;
    metricLabel.style.fontWeight = 'bold';
    metricLabel.style.marginBottom = '5px';
    
    const metricValue = document.createElement('div');
    metricValue.id = `value-${metric.id}`;
    metricValue.textContent = 'Waiting...';
    
    metricBox.appendChild(metricLabel);
    metricBox.appendChild(metricValue);
    metricsContainer.appendChild(metricBox);
  });
  
  container.appendChild(metricsContainer);
  
  // Add event log
  const logContainer = document.createElement('div');
  logContainer.style.marginTop = '20px';
  
  const logTitle = document.createElement('h3');
  logTitle.textContent = 'Event Log';
  logContainer.appendChild(logTitle);
  
  const logContent = document.createElement('div');
  logContent.id = 'event-log';
  logContent.style.height = '150px';
  logContent.style.overflowY = 'scroll';
  logContent.style.border = '1px solid #ddd';
  logContent.style.padding = '10px';
  logContent.style.backgroundColor = '#f9f9f9';
  logContent.style.fontFamily = 'monospace';
  logContent.style.fontSize = '12px';
  logContainer.appendChild(logContent);
  
  container.appendChild(logContainer);
  
  // Add container to document
  document.body.appendChild(container);
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // Button event listeners
  calibrateButton.addEventListener('click', startEyeCalibration);
  toggleDebugButton.addEventListener('click', toggleDebugMode);
  privacyModeSelect.addEventListener('change', updatePrivacyMode);
  
  // Subscribe to eye tracking events
  subscribe('eye:tracking:updated', handleEyeTrackingUpdate);
  subscribe('eye:blink:detected', handleBlinkDetected);
  subscribe('eye:saccade:detected', handleSaccadeDetected);
  subscribe('eye:calibration:started', handleCalibrationStarted);
  subscribe('eye:calibration:completed', handleCalibrationCompleted);
  subscribe('eye:calibration:cancelled', handleCalibrationCancelled);
  subscribe('eye:processor:frame', handleFrameProcessed);
  
  // Render loop
  requestAnimationFrame(renderLoop);
}

/**
 * Start eye calibration
 */
async function startEyeCalibration() {
  try {
    updateStatus('Starting eye calibration...');
    calibrateButton.disabled = true;
    
    const result = await startCalibration({
      numPoints: 5,
      pointDurationMs: 1500,
      accessibility: {
        highContrastMode: false,
        largerTargets: false,
        slowerAnimation: false,
        voicePrompts: false
      }
    });
    
    updateStatus(`Calibration completed with accuracy: ${(result.accuracy * 100).toFixed(1)}%`);
    logEvent(`Calibration completed: ${JSON.stringify(result)}`);
  } catch (error) {
    updateStatus(`Calibration failed: ${error.reason}`, true);
    logEvent(`Calibration failed: ${error.reason}`);
  } finally {
    calibrateButton.disabled = false;
  }
}

/**
 * Toggle debug visualization
 */
function toggleDebugMode() {
  isDebugMode = !isDebugMode;
  debugCanvas.style.display = isDebugMode ? 'block' : 'none';
  toggleDebugButton.textContent = isDebugMode ? 'Hide Debug View' : 'Show Debug View';
  
  // Update eye tracking configuration
  publish('eye:processor:config:update', {
    debugMode: isDebugMode
  });
}

/**
 * Update privacy mode
 */
function updatePrivacyMode() {
  const mode = privacyModeSelect.value;
  
  // Update eye tracking configuration
  publish('eye:processor:config:update', {
    privacyMode: mode
  });
  
  updateStatus(`Privacy mode set to: ${mode}`);
}

/**
 * Handle eye tracking updates
 */
function handleEyeTrackingUpdate(data) {
  eyeTrackingData = data;
  
  // Update metrics
  if (data.gaze) {
    document.getElementById('value-gaze').textContent = 
      `X: ${(data.gaze.x * 100).toFixed(1)}%, Y: ${(data.gaze.y * 100).toFixed(1)}%`;
  }
  
  if (data.leftPupil) {
    document.getElementById('value-leftPupil').textContent = 
      `X: ${data.leftPupil.x.toFixed(1)}, Y: ${data.leftPupil.y.toFixed(1)}, Size: ${data.leftPupil.size.toFixed(1)}`;
  }
  
  if (data.rightPupil) {
    document.getElementById('value-rightPupil').textContent = 
      `X: ${data.rightPupil.x.toFixed(1)}, Y: ${data.rightPupil.y.toFixed(1)}, Size: ${data.rightPupil.size.toFixed(1)}`;
  }
}

/**
 * Handle blink detection
 */
function handleBlinkDetected(data) {
  document.getElementById('value-blinks').textContent = 
    `${data.eye} eye, ${data.duration.toFixed(0)}ms`;
  
  logEvent(`Blink detected: ${data.eye} eye, ${data.duration.toFixed(0)}ms`);
}

/**
 * Handle saccade detection
 */
function handleSaccadeDetected(data) {
  document.getElementById('value-saccades').textContent = 
    `Direction: ${data.direction}, Velocity: ${data.velocity.toFixed(1)}`;
  
  logEvent(`Saccade detected: ${data.direction}, velocity: ${data.velocity.toFixed(1)}`);
}

/**
 * Handle calibration started
 */
function handleCalibrationStarted(data) {
  updateStatus(`Calibration started with ${data.numPoints} points. Follow the dots with your eyes.`);
  logEvent(`Calibration started: ${data.numPoints} points`);
}

/**
 * Handle calibration completed
 */
function handleCalibrationCompleted(data) {
  updateStatus(`Calibration completed with accuracy: ${(data.accuracy * 100).toFixed(1)}%`);
  logEvent(`Calibration completed: ${JSON.stringify(data)}`);
}

/**
 * Handle calibration cancelled
 */
function handleCalibrationCancelled(data) {
  updateStatus(`Calibration cancelled: ${data.reason}`, true);
  logEvent(`Calibration cancelled: ${data.reason}`);
}

/**
 * Handle frame processed
 */
function handleFrameProcessed(data) {
  document.getElementById('value-performance').textContent = 
    `${data.processingTimeMs.toFixed(1)}ms per frame`;
}

/**
 * Render loop for visualization
 */
function renderLoop() {
  // Clear debug canvas
  const ctx = debugCanvas.getContext('2d');
  ctx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);
  
  // Draw gaze point if available
  if (eyeTrackingData && eyeTrackingData.gaze) {
    const { x, y, confidence } = eyeTrackingData.gaze;
    
    // Draw gaze point
    ctx.beginPath();
    ctx.arc(
      x * debugCanvas.width,
      y * debugCanvas.height,
      10,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = `rgba(255, 0, 0, ${confidence})`;
    ctx.fill();
    
    // Draw crosshair
    ctx.beginPath();
    ctx.moveTo(x * debugCanvas.width - 15, y * debugCanvas.height);
    ctx.lineTo(x * debugCanvas.width + 15, y * debugCanvas.height);
    ctx.moveTo(x * debugCanvas.width, y * debugCanvas.height - 15);
    ctx.lineTo(x * debugCanvas.width, y * debugCanvas.height + 15);
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  
  // Continue render loop
  requestAnimationFrame(renderLoop);
}

/**
 * Update status message
 */
function updateStatus(message, isError = false) {
  statusElement.textContent = message;
  statusElement.style.backgroundColor = isError ? '#ffebee' : '#e8f5e9';
  statusElement.style.color = isError ? '#c62828' : '#2e7d32';
}

/**
 * Log an event to the event log
 */
function logEvent(message) {
  const logElement = document.getElementById('event-log');
  const timestamp = new Date().toLocaleTimeString();
  const logItem = document.createElement('div');
  logItem.textContent = `[${timestamp}] ${message}`;
  logElement.appendChild(logItem);
  
  // Scroll to bottom
  logElement.scrollTop = logElement.scrollHeight;
  
  // Limit log items
  while (logElement.childElementCount > 100) {
    logElement.removeChild(logElement.firstChild);
  }
}

// Initialize the demo when the page loads
window.addEventListener('DOMContentLoaded', initializeDemo);

export { initializeDemo };
