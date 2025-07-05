/**
 * ALEJO Vision-Voice Fusion Demo
 * 
 * This demo showcases the integration of vision and voice systems through the fusion module.
 * It demonstrates how facial expressions and voice tone can be combined for enhanced
 * emotional understanding and user interaction.
 */

import { visionSystem } from '../src/personalization/vision/index.js';
import { voiceSystem } from '../src/personalization/voice/index.js';
import { visionVoiceFusion } from '../src/integration/fusion/vision-voice-fusion.js';
import { eventBus } from '../src/core/event-bus.js';
import { consentManager } from '../src/security/consent-manager.js';
import { auditTrail } from '../src/security/audit-trail.js';

// DOM Elements
let videoElement;
let canvasElement;
let statusElement;
let emotionDisplayElement;
let commandDisplayElement;
let verificationDisplayElement;

// Initialize the demo
async function initializeDemo() {
  updateStatus('Initializing demo...');
  
  try {
    // Set up DOM elements
    setupDomElements();
    
    // Request necessary consent
    await requestConsent();
    
    // Initialize systems
    await initializeSystems();
    
    // Set up event listeners
    setupEventListeners();
    
    // Start camera
    await startCamera();
    
    updateStatus('Demo initialized successfully. Speak and show expressions to see fusion in action.');
  } catch (error) {
    updateStatus(`Initialization failed: ${error.message}`, 'error');
    console.error('Demo initialization failed:', error);
  }
}

// Set up DOM elements
function setupDomElements() {
  // Create container
  const container = document.createElement('div');
  container.className = 'fusion-demo-container';
  document.body.appendChild(container);
  
  // Create video element
  videoElement = document.createElement('video');
  videoElement.className = 'fusion-demo-video';
  videoElement.autoplay = true;
  videoElement.muted = true;
  videoElement.playsInline = true;
  container.appendChild(videoElement);
  
  // Create canvas element (for visualization)
  canvasElement = document.createElement('canvas');
  canvasElement.className = 'fusion-demo-canvas';
  canvasElement.width = 640;
  canvasElement.height = 480;
  container.appendChild(canvasElement);
  
  // Create status display
  statusElement = document.createElement('div');
  statusElement.className = 'fusion-demo-status';
  container.appendChild(statusElement);
  
  // Create emotion display
  const emotionContainer = document.createElement('div');
  emotionContainer.className = 'fusion-demo-panel';
  container.appendChild(emotionContainer);
  
  const emotionTitle = document.createElement('h3');
  emotionTitle.textContent = 'Emotional State';
  emotionContainer.appendChild(emotionTitle);
  
  emotionDisplayElement = document.createElement('div');
  emotionDisplayElement.className = 'fusion-demo-emotion';
  emotionContainer.appendChild(emotionDisplayElement);
  
  // Create command display
  const commandContainer = document.createElement('div');
  commandContainer.className = 'fusion-demo-panel';
  container.appendChild(commandContainer);
  
  const commandTitle = document.createElement('h3');
  commandTitle.textContent = 'Command Intent';
  commandContainer.appendChild(commandTitle);
  
  commandDisplayElement = document.createElement('div');
  commandDisplayElement.className = 'fusion-demo-command';
  commandContainer.appendChild(commandDisplayElement);
  
  // Create verification display
  const verificationContainer = document.createElement('div');
  verificationContainer.className = 'fusion-demo-panel';
  container.appendChild(verificationContainer);
  
  const verificationTitle = document.createElement('h3');
  verificationTitle.textContent = 'Identity Verification';
  verificationContainer.appendChild(verificationTitle);
  
  verificationDisplayElement = document.createElement('div');
  verificationDisplayElement.className = 'fusion-demo-verification';
  verificationContainer.appendChild(verificationDisplayElement);
  
  // Add styles
  addStyles();
}

// Add CSS styles
function addStyles() {
  const styleElement = document.createElement('style');
  styleElement.textContent = `
    .fusion-demo-container {
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      font-family: Arial, sans-serif;
    }
    
    .fusion-demo-video {
      width: 100%;
      max-height: 360px;
      background: #000;
      margin-bottom: 20px;
    }
    
    .fusion-demo-canvas {
      display: none;
    }
    
    .fusion-demo-status {
      padding: 10px;
      margin-bottom: 20px;
      background: #f0f0f0;
      border-radius: 4px;
      text-align: center;
    }
    
    .fusion-demo-status.error {
      background: #ffebee;
      color: #c62828;
    }
    
    .fusion-demo-panel {
      padding: 15px;
      margin-bottom: 20px;
      background: #fff;
      border-radius: 4px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    }
    
    .fusion-demo-panel h3 {
      margin-top: 0;
      color: #333;
      border-bottom: 1px solid #eee;
      padding-bottom: 10px;
    }
    
    .fusion-demo-emotion, .fusion-demo-command, .fusion-demo-verification {
      min-height: 50px;
    }
    
    .emotion-bar {
      height: 20px;
      margin: 5px 0;
      background: #e0e0e0;
      border-radius: 3px;
      overflow: hidden;
      position: relative;
    }
    
    .emotion-bar-fill {
      height: 100%;
      transition: width 0.3s ease;
    }
    
    .emotion-label {
      display: flex;
      justify-content: space-between;
      font-size: 14px;
    }
    
    .emotion-value {
      font-weight: bold;
    }
    
    .neutral { background-color: #90a4ae; }
    .happy { background-color: #4caf50; }
    .sad { background-color: #5c6bc0; }
    .angry { background-color: #f44336; }
    .fearful { background-color: #8e24aa; }
    .disgusted { background-color: #ff9800; }
    .surprised { background-color: #00bcd4; }
  `;
  document.head.appendChild(styleElement);
}

// Request necessary consent
async function requestConsent() {
  updateStatus('Requesting consent...');
  
  const consentRequests = [
    { type: 'face_recognition', description: 'Detect and analyze facial features' },
    { type: 'expression_detection', description: 'Analyze facial expressions' },
    { type: 'voice_analysis', description: 'Analyze voice tone and emotions' },
    { type: 'multimodal_fusion', description: 'Combine vision and voice data for better understanding' }
  ];
  
  for (const request of consentRequests) {
    const hasConsent = await consentManager.requestConsent(request.type, {
      purpose: request.description,
      dataUsage: 'Local processing only, no data stored',
      required: true
    });
    
    if (!hasConsent) {
      throw new Error(`Consent for ${request.type} was denied. This is required for the demo.`);
    }
  }
  
  updateStatus('All consent granted');
}

// Initialize vision, voice, and fusion systems
async function initializeSystems() {
  updateStatus('Initializing vision system...');
  const visionResult = await visionSystem.initialize({
    userId: 'demo-user',
    faceDetection: {
      minConfidence: 0.5,
      maxResults: 1
    },
    expressionDetection: {
      minConfidence: 0.5
    }
  });
  
  if (!visionResult.success) {
    throw new Error('Vision system initialization failed');
  }
  
  updateStatus('Initializing voice system...');
  const voiceResult = await voiceSystem.initialize({
    userId: 'demo-user',
    emotionDetection: true
  });
  
  if (!voiceResult.success) {
    throw new Error('Voice system initialization failed');
  }
  
  updateStatus('Initializing fusion system...');
  const fusionResult = await visionVoiceFusion.initialize({
    temporalWindow: 3000, // 3 second window for demo purposes
    confidenceThreshold: 0.5 // Lower threshold for demo purposes
  });
  
  if (!fusionResult) {
    throw new Error('Fusion system initialization failed');
  }
  
  updateStatus('All systems initialized');
}

// Set up event listeners
function setupEventListeners() {
  // Listen for fused emotional state
  eventBus.on('fused_emotional_state', (data) => {
    updateEmotionDisplay(data);
    auditTrail.log('demo_emotion_displayed', { dominant: data.dominant });
  });
  
  // Listen for fused command intent
  eventBus.on('fused_command_intent', (data) => {
    updateCommandDisplay(data);
    auditTrail.log('demo_command_displayed', { command: data.command });
  });
  
  // Listen for fused identity verification
  eventBus.on('fused_identity_verification', (data) => {
    updateVerificationDisplay(data);
    auditTrail.log('demo_verification_displayed', { verified: data.isVerified });
  });
  
  // Listen for individual modality events for demo purposes
  eventBus.on('expression_detected', (data) => {
    updateStatus(`Expression detected: ${data.dominant}`);
  });
  
  eventBus.on('voice_emotion_detected', (data) => {
    updateStatus(`Voice emotion detected: ${data.dominant}`);
  });
}

// Start camera
async function startCamera() {
  updateStatus('Starting camera...');
  
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });
    
    videoElement.srcObject = stream;
    await videoElement.play();
    
    // Start processing video frames
    startVideoProcessing();
    
    // Start processing audio
    startAudioProcessing(stream);
    
    updateStatus('Camera and microphone started');
  } catch (error) {
    throw new Error(`Camera access failed: ${error.message}`);
  }
}

// Start processing video frames
function startVideoProcessing() {
  // Process frames at regular intervals
  setInterval(async () => {
    try {
      // Capture frame
      const context = canvasElement.getContext('2d');
      canvasElement.width = videoElement.videoWidth;
      canvasElement.height = videoElement.videoHeight;
      context.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
      
      // Process frame with vision system
      const imageData = canvasElement.toDataURL('image/jpeg');
      
      // Detect face and expression
      await visionSystem.faceModel.detectFace(imageData);
      await visionSystem.expressionDetection.analyzeExpression(imageData);
    } catch (error) {
      console.error('Error processing video frame:', error);
    }
  }, 500); // Process every 500ms
}

// Start processing audio
function startAudioProcessing(stream) {
  // Set up audio context
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const source = audioContext.createMediaStreamSource(stream);
  
  // Create analyzer
  const analyzer = audioContext.createAnalyser();
  analyzer.fftSize = 2048;
  source.connect(analyzer);
  
  // Process audio at regular intervals
  setInterval(() => {
    try {
      // Simulate voice command detection for demo purposes
      const randomCommands = [
        'open menu',
        'show dashboard',
        'play music',
        'set reminder',
        'send message'
      ];
      
      // Randomly emit voice command events (for demo purposes)
      if (Math.random() < 0.1) { // 10% chance each interval
        const command = randomCommands[Math.floor(Math.random() * randomCommands.length)];
        
        eventBus.emit('voice_command_detected', {
          command,
          parameters: {},
          confidence: 0.7 + Math.random() * 0.3, // Random confidence between 0.7-1.0
          timestamp: Date.now()
        });
      }
      
      // Randomly emit voice emotion events (for demo purposes)
      if (Math.random() < 0.2) { // 20% chance each interval
        const emotions = {
          neutral: Math.random(),
          happy: Math.random(),
          sad: Math.random(),
          angry: Math.random(),
          fearful: Math.random(),
          disgusted: Math.random(),
          surprised: Math.random()
        };
        
        // Normalize to sum to 1
        const sum = Object.values(emotions).reduce((a, b) => a + b, 0);
        Object.keys(emotions).forEach(key => {
          emotions[key] /= sum;
        });
        
        // Find dominant emotion
        const dominant = Object.entries(emotions).reduce(
          (max, [emotion, value]) => value > max.value ? { emotion, value } : max,
          { emotion: 'neutral', value: 0 }
        );
        
        eventBus.emit('voice_emotion_detected', {
          dominant: dominant.emotion,
          confidence: 0.7 + Math.random() * 0.3, // Random confidence between 0.7-1.0
          emotions,
          timestamp: Date.now()
        });
      }
      
      // Randomly emit verification events (for demo purposes)
      if (Math.random() < 0.05) { // 5% chance each interval
        eventBus.emit('voice_verification_completed', {
          userId: 'demo-user',
          isVerified: Math.random() > 0.2, // 80% chance of verification success
          confidence: 0.7 + Math.random() * 0.3,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('Error processing audio:', error);
    }
  }, 1000); // Process every 1000ms
}

// Update status display
function updateStatus(message, type = 'info') {
  statusElement.textContent = message;
  statusElement.className = `fusion-demo-status ${type}`;
  console.log(`Status: ${message}`);
}

// Update emotion display
function updateEmotionDisplay(data) {
  emotionDisplayElement.innerHTML = '';
  
  // Add dominant emotion
  const dominantElement = document.createElement('div');
  dominantElement.innerHTML = `<strong>Dominant Emotion:</strong> ${data.dominant} (${(data.confidence * 100).toFixed(1)}% confidence)`;
  emotionDisplayElement.appendChild(dominantElement);
  
  // Add emotion bars
  const emotions = data.all;
  for (const [emotion, value] of Object.entries(emotions)) {
    const barContainer = document.createElement('div');
    
    const label = document.createElement('div');
    label.className = 'emotion-label';
    label.innerHTML = `<span>${emotion}</span><span class="emotion-value">${(value * 100).toFixed(1)}%</span>`;
    barContainer.appendChild(label);
    
    const bar = document.createElement('div');
    bar.className = 'emotion-bar';
    
    const barFill = document.createElement('div');
    barFill.className = `emotion-bar-fill ${emotion}`;
    barFill.style.width = `${value * 100}%`;
    bar.appendChild(barFill);
    
    barContainer.appendChild(bar);
    emotionDisplayElement.appendChild(barContainer);
  }
}

// Update command display
function updateCommandDisplay(data) {
  commandDisplayElement.innerHTML = '';
  
  const commandElement = document.createElement('div');
  commandElement.innerHTML = `<strong>Command:</strong> ${data.command}`;
  commandDisplayElement.appendChild(commandElement);
  
  const contextElement = document.createElement('div');
  contextElement.innerHTML = `<strong>Emotional Context:</strong> ${data.emotionalContext}`;
  commandDisplayElement.appendChild(contextElement);
  
  const confidenceElement = document.createElement('div');
  confidenceElement.innerHTML = `<strong>Confidence:</strong> ${(data.confidence * 100).toFixed(1)}%`;
  commandDisplayElement.appendChild(confidenceElement);
  
  // Add parameters if any
  if (Object.keys(data.parameters).length > 0) {
    const paramsElement = document.createElement('div');
    paramsElement.innerHTML = `<strong>Parameters:</strong> ${JSON.stringify(data.parameters)}`;
    commandDisplayElement.appendChild(paramsElement);
  }
}

// Update verification display
function updateVerificationDisplay(data) {
  verificationDisplayElement.innerHTML = '';
  
  const statusElement = document.createElement('div');
  statusElement.innerHTML = `<strong>Status:</strong> ${data.isVerified ? 'Verified' : 'Not Verified'}`;
  verificationDisplayElement.appendChild(statusElement);
  
  const userElement = document.createElement('div');
  userElement.innerHTML = `<strong>User ID:</strong> ${data.userId}`;
  verificationDisplayElement.appendChild(userElement);
  
  const confidenceElement = document.createElement('div');
  confidenceElement.innerHTML = `<strong>Confidence:</strong> ${(data.confidence * 100).toFixed(1)}%`;
  verificationDisplayElement.appendChild(confidenceElement);
  
  const sourceElement = document.createElement('div');
  sourceElement.innerHTML = `<strong>Sources:</strong> Voice & Vision`;
  verificationDisplayElement.appendChild(sourceElement);
}

// Initialize the demo when the page loads
window.addEventListener('DOMContentLoaded', initializeDemo);

// Export for module usage
export { initializeDemo };
