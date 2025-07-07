/**
 * ALEJO Gesture Training Interface
 * 
 * Provides a user interface for training custom gestures.
 * Allows users to record, save, and manage custom gestures.
 */

import { publish, subscribe } from '../core/events.js';
import { getVideoElement } from './camera.js';
import { saveCustomGesture, trainGestureModel } from './enhanced_recognition.js';

// Training state
let isTrainingMode = false;
let isRecording = false;
let currentGestureName = '';
let recordedFrames = [];
let trainingData = {};
let recordingTimer = null;
let trainingContainer = null;
let recordingCountdown = 0;

// Constants
const RECORDING_DURATION = 3; // seconds
const FRAMES_PER_GESTURE = 10;
const MIN_GESTURES_FOR_TRAINING = 3;

/**
 * Initialize the gesture training interface
 * @returns {HTMLElement} The training interface container
 */
export function initTrainingInterface() {
  if (trainingContainer) {
    return trainingContainer;
  }
  
  // Create training interface container
  trainingContainer = document.createElement('div');
  trainingContainer.className = 'alejo-gesture-training';
  trainingContainer.style.display = 'none';
  
  // Create interface elements
  trainingContainer.innerHTML = `
    <div class="training-header">
      <h2>Gesture Training</h2>
      <button class="close-btn" id="close-training">×</button>
    </div>
    <div class="training-content">
      <div class="gesture-list-container">
        <h3>Custom Gestures</h3>
        <ul class="gesture-list" id="gesture-list"></ul>
        <div class="gesture-controls">
          <input type="text" id="gesture-name" placeholder="New gesture name">
          <button id="add-gesture">Add Gesture</button>
        </div>
      </div>
      <div class="recording-container">
        <div class="video-container">
          <video id="training-video" autoplay playsinline></video>
          <div class="recording-overlay" id="recording-overlay">
            <div class="recording-countdown" id="recording-countdown"></div>
            <div class="recording-indicator"></div>
          </div>
        </div>
        <div class="recording-controls">
          <button id="record-gesture" disabled>Record Gesture</button>
          <button id="train-model" disabled>Train Model</button>
        </div>
        <div class="training-status" id="training-status"></div>
      </div>
    </div>
  `;
  
  // Add to document
  document.body.appendChild(trainingContainer);
  
  // Set up event handlers
  setupEventHandlers();
  
  // Subscribe to gesture events
  subscribe('gesture:landmarks', handleLandmarks);
  subscribe('gesture:status', handleGestureStatus);
  
  return trainingContainer;
}

/**
 * Set up event handlers for the training interface
 */
function setupEventHandlers() {
  // Close button
  const closeBtn = document.getElementById('close-training');
  closeBtn.addEventListener('click', hideTrainingInterface);
  
  // Add gesture button
  const addGestureBtn = document.getElementById('add-gesture');
  addGestureBtn.addEventListener('click', addNewGesture);
  
  // Record gesture button
  const recordGestureBtn = document.getElementById('record-gesture');
  recordGestureBtn.addEventListener('click', toggleRecording);
  
  // Train model button
  const trainModelBtn = document.getElementById('train-model');
  trainModelBtn.addEventListener('click', startModelTraining);
  
  // Gesture name input
  const gestureNameInput = document.getElementById('gesture-name');
  gestureNameInput.addEventListener('input', () => {
    const addBtn = document.getElementById('add-gesture');
    addBtn.disabled = !gestureNameInput.value.trim();
  });
}

/**
 * Show the training interface
 */
export function showTrainingInterface() {
  if (!trainingContainer) {
    initTrainingInterface();
  }
  
  // Show the container
  trainingContainer.style.display = 'block';
  isTrainingMode = true;
  
  // Set up video
  setupTrainingVideo();
  
  // Load existing gestures
  loadExistingGestures();
}

/**
 * Hide the training interface
 */
export function hideTrainingInterface() {
  if (trainingContainer) {
    trainingContainer.style.display = 'none';
  }
  
  isTrainingMode = false;
  stopRecording();
}

/**
 * Set up video for training
 */
function setupTrainingVideo() {
  const trainingVideo = document.getElementById('training-video');
  const mainVideo = getVideoElement();
  
  if (mainVideo && trainingVideo) {
    // Use the same video stream
    trainingVideo.srcObject = mainVideo.srcObject;
  }
}

/**
 * Load existing custom gestures
 */
function loadExistingGestures() {
  const gestureList = document.getElementById('gesture-list');
  
  // Clear the list
  gestureList.innerHTML = '';
  
  // Add gestures from training data
  for (const gesture in trainingData) {
    addGestureToList(gesture, trainingData[gesture].length);
  }
  
  // Update train button state
  updateTrainButtonState();
}

/**
 * Add a new gesture to the training list
 */
function addNewGesture() {
  const gestureNameInput = document.getElementById('gesture-name');
  const gestureName = gestureNameInput.value.trim();
  
  if (!gestureName) {
    return;
  }
  
  // Initialize training data for this gesture
  if (!trainingData[gestureName]) {
    trainingData[gestureName] = [];
  }
  
  // Add to list
  addGestureToList(gestureName, 0);
  
  // Clear input
  gestureNameInput.value = '';
  
  // Select the new gesture
  selectGesture(gestureName);
}

/**
 * Add a gesture to the UI list
 * @param {String} name - Gesture name
 * @param {Number} sampleCount - Number of samples
 */
function addGestureToList(name, sampleCount) {
  const gestureList = document.getElementById('gesture-list');
  
  // Check if already in list
  const existingItem = Array.from(gestureList.children).find(
    item => item.dataset.gesture === name
  );
  
  if (existingItem) {
    // Update sample count
    const countSpan = existingItem.querySelector('.sample-count');
    countSpan.textContent = sampleCount;
    return;
  }
  
  // Create list item
  const item = document.createElement('li');
  item.dataset.gesture = name;
  item.innerHTML = `
    <span class="gesture-name">${name}</span>
    <span class="sample-count">${sampleCount}</span>
    <button class="delete-gesture">×</button>
  `;
  
  // Add click handler
  item.addEventListener('click', () => selectGesture(name));
  
  // Add delete handler
  const deleteBtn = item.querySelector('.delete-gesture');
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    deleteGesture(name);
  });
  
  // Add to list
  gestureList.appendChild(item);
}

/**
 * Select a gesture for recording
 * @param {String} name - Gesture name
 */
function selectGesture(name) {
  // Update UI
  const gestureList = document.getElementById('gesture-list');
  Array.from(gestureList.children).forEach(item => {
    item.classList.toggle('selected', item.dataset.gesture === name);
  });
  
  // Set current gesture
  currentGestureName = name;
  
  // Enable record button
  const recordBtn = document.getElementById('record-gesture');
  recordBtn.disabled = false;
  
  // Update status
  updateStatus(`Selected gesture: ${name}`);
}

/**
 * Delete a gesture
 * @param {String} name - Gesture name
 */
function deleteGesture(name) {
  // Remove from training data
  delete trainingData[name];
  
  // Remove from list
  const gestureList = document.getElementById('gesture-list');
  const item = Array.from(gestureList.children).find(
    item => item.dataset.gesture === name
  );
  
  if (item) {
    gestureList.removeChild(item);
  }
  
  // Clear selection if this was the selected gesture
  if (currentGestureName === name) {
    currentGestureName = '';
    const recordBtn = document.getElementById('record-gesture');
    recordBtn.disabled = true;
  }
  
  // Update train button state
  updateTrainButtonState();
}

/**
 * Toggle recording state
 */
function toggleRecording() {
  if (isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
}

/**
 * Start recording a gesture
 */
function startRecording() {
  if (!currentGestureName) {
    return;
  }
  
  // Reset recorded frames
  recordedFrames = [];
  
  // Update UI
  isRecording = true;
  const recordBtn = document.getElementById('record-gesture');
  recordBtn.textContent = 'Stop Recording';
  recordBtn.classList.add('recording');
  
  // Show countdown
  recordingCountdown = RECORDING_DURATION;
  updateCountdown();
  
  // Start countdown timer
  recordingTimer = setInterval(updateCountdown, 1000);
  
  // Update status
  updateStatus(`Recording gesture: ${currentGestureName}...`);
  
  // Show recording overlay
  const overlay = document.getElementById('recording-overlay');
  overlay.classList.add('active');
}

/**
 * Update the recording countdown
 */
function updateCountdown() {
  const countdownEl = document.getElementById('recording-countdown');
  
  if (recordingCountdown > 0) {
    countdownEl.textContent = recordingCountdown;
    recordingCountdown--;
  } else {
    // Stop recording when countdown reaches 0
    stopRecording();
  }
}

/**
 * Stop recording a gesture
 */
function stopRecording() {
  if (!isRecording) {
    return;
  }
  
  // Clear timer
  clearInterval(recordingTimer);
  
  // Update UI
  isRecording = false;
  const recordBtn = document.getElementById('record-gesture');
  recordBtn.textContent = 'Record Gesture';
  recordBtn.classList.remove('recording');
  
  // Hide recording overlay
  const overlay = document.getElementById('recording-overlay');
  overlay.classList.remove('active');
  
  // Process recorded frames
  processRecordedFrames();
}

/**
 * Process the recorded frames
 */
function processRecordedFrames() {
  if (recordedFrames.length === 0) {
    updateStatus('No hand landmarks detected during recording');
    return;
  }
  
  // Sample frames evenly
  const sampledFrames = sampleFrames(recordedFrames, FRAMES_PER_GESTURE);
  
  // Add to training data
  if (!trainingData[currentGestureName]) {
    trainingData[currentGestureName] = [];
  }
  
  trainingData[currentGestureName].push(sampledFrames);
  
  // Update UI
  updateStatus(`Added sample for ${currentGestureName}`);
  
  // Update gesture list
  const gestureList = document.getElementById('gesture-list');
  const item = Array.from(gestureList.children).find(
    item => item.dataset.gesture === currentGestureName
  );
  
  if (item) {
    const countSpan = item.querySelector('.sample-count');
    countSpan.textContent = trainingData[currentGestureName].length;
  }
  
  // Update train button state
  updateTrainButtonState();
}

/**
 * Sample frames evenly from the recorded frames
 * @param {Array} frames - Recorded frames
 * @param {Number} count - Number of frames to sample
 * @returns {Array} - Sampled frames
 */
function sampleFrames(frames, count) {
  if (frames.length <= count) {
    return frames;
  }
  
  const result = [];
  const step = frames.length / count;
  
  for (let i = 0; i < count; i++) {
    const index = Math.floor(i * step);
    result.push(frames[index]);
  }
  
  return result;
}

/**
 * Update the train button state
 */
function updateTrainButtonState() {
  const trainBtn = document.getElementById('train-model');
  const gestureCount = Object.keys(trainingData).length;
  
  // Need at least MIN_GESTURES_FOR_TRAINING gestures with samples
  let hasEnoughSamples = true;
  let totalSamples = 0;
  
  for (const gesture in trainingData) {
    if (trainingData[gesture].length === 0) {
      hasEnoughSamples = false;
      break;
    }
    totalSamples += trainingData[gesture].length;
  }
  
  trainBtn.disabled = gestureCount < MIN_GESTURES_FOR_TRAINING || !hasEnoughSamples;
  
  if (gestureCount < MIN_GESTURES_FOR_TRAINING) {
    updateStatus(`Add at least ${MIN_GESTURES_FOR_TRAINING} gestures (${gestureCount} added)`);
  } else if (!hasEnoughSamples) {
    updateStatus('Record samples for all gestures');
  } else {
    updateStatus(`Ready to train (${gestureCount} gestures, ${totalSamples} samples)`);
  }
}

/**
 * Start training the gesture model
 */
async function startModelTraining() {
  updateStatus('Training model...');
  
  // Disable UI during training
  const trainBtn = document.getElementById('train-model');
  trainBtn.disabled = true;
  
  try {
    // Prepare training data
    const formattedData = {};
    
    for (const gesture in trainingData) {
      formattedData[gesture] = trainingData[gesture].flat();
    }
    
    // Train the model
    const result = await trainGestureModel(formattedData);
    
    if (result.success) {
      updateStatus(`Model trained successfully! Accuracy: ${(result.accuracy * 100).toFixed(1)}%`);
    } else {
      updateStatus(`Training failed: ${result.error}`);
    }
  } catch (error) {
    updateStatus(`Training error: ${error.message}`);
  } finally {
    // Re-enable UI
    updateTrainButtonState();
  }
}

/**
 * Handle landmarks from gesture recognition
 * @param {Object} data - Landmark data
 */
function handleLandmarks(data) {
  if (!isTrainingMode || !isRecording) {
    return;
  }
  
  // Store landmarks for training
  recordedFrames.push(data.landmarks);
}

/**
 * Handle gesture status updates
 * @param {Object} data - Status data
 */
function handleGestureStatus(data) {
  if (!isTrainingMode) {
    return;
  }
  
  // Update status based on gesture system state
  if (data.state === 'training') {
    updateStatus('Training model...');
  } else if (data.state === 'trained') {
    updateStatus(`Model trained successfully! Accuracy: ${(data.accuracy * 100).toFixed(1)}%`);
  } else if (data.state === 'error') {
    updateStatus(`Error: ${data.message}`);
  }
}

/**
 * Update the status message
 * @param {String} message - Status message
 */
function updateStatus(message) {
  const statusEl = document.getElementById('training-status');
  if (statusEl) {
    statusEl.textContent = message;
  }
}
