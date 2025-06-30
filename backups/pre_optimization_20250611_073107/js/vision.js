/**
 * ALEJO Vision Interface - JavaScript Implementation
 * Handles image processing, computer vision, and camera integration
 */

// Vision state
const visionState = {
    cameraActive: false,
    cameraStream: null,
    videoElement: null,
    canvasElement: null,
    canvasContext: null,
    screenshotMode: false,
    imageAnalysisActive: false,
    currentFilters: [],
    supportedFilters: ['normal', 'grayscale', 'sepia', 'invert', 'blur', 'edge-detection']
};

// Initialize vision capabilities
function initVision() {
    // Set up DOM elements
    visionState.videoElement = document.getElementById('camera-feed');
    visionState.canvasElement = document.getElementById('vision-canvas');
    
    if (visionState.canvasElement) {
        visionState.canvasContext = visionState.canvasElement.getContext('2d');
    }
    
    // Set up event listeners
    setupVisionEventListeners();
    
    // Check for camera permission status
    checkCameraPermission();
}

// Set up vision event listeners
function setupVisionEventListeners() {
    const startCameraButton = document.getElementById('start-camera-button');
    const stopCameraButton = document.getElementById('stop-camera-button');
    const takePhotoButton = document.getElementById('take-photo-button');
    const analyzeImageButton = document.getElementById('analyze-image-button');
    const uploadImageButton = document.getElementById('upload-image-button');
    const filterSelect = document.getElementById('vision-filter-select');
    
    if (startCameraButton) {
        startCameraButton.addEventListener('click', startCamera);
    }
    
    if (stopCameraButton) {
        stopCameraButton.addEventListener('click', stopCamera);
    }
    
    if (takePhotoButton) {
        takePhotoButton.addEventListener('click', takeScreenshot);
    }
    
    if (analyzeImageButton) {
        analyzeImageButton.addEventListener('click', analyzeCurrentImage);
    }
    
    if (uploadImageButton) {
        uploadImageButton.addEventListener('click', () => {
            document.getElementById('image-upload-input').click();
        });
    }
    
    // Set up image upload handler
    const imageUploadInput = document.getElementById('image-upload-input');
    if (imageUploadInput) {
        imageUploadInput.addEventListener('change', handleImageUpload);
    }
    
    // Set up filter selection
    if (filterSelect) {
        filterSelect.addEventListener('change', (e) => {
            applyFilter(e.target.value);
        });
    }
}

// Check camera permission
function checkCameraPermission() {
    navigator.permissions.query({ name: 'camera' })
        .then(permissionStatus => {
            updateCameraStatus(permissionStatus.state);
            
            permissionStatus.onchange = () => {
                updateCameraStatus(permissionStatus.state);
            };
        })
        .catch(error => {
            console.error('Camera permission check error:', error);
            updateCameraStatus('unknown');
        });
}

// Update camera status UI
function updateCameraStatus(status) {
    const cameraStatusElement = document.getElementById('camera-status');
    if (!cameraStatusElement) return;
    
    switch (status) {
        case 'granted':
            cameraStatusElement.textContent = 'Camera access granted';
            cameraStatusElement.className = 'status-granted';
            break;
        case 'denied':
            cameraStatusElement.textContent = 'Camera access denied';
            cameraStatusElement.className = 'status-denied';
            break;
        case 'prompt':
            cameraStatusElement.textContent = 'Camera permission required';
            cameraStatusElement.className = 'status-prompt';
            break;
        default:
            cameraStatusElement.textContent = 'Camera status unknown';
            cameraStatusElement.className = 'status-unknown';
    }
}

// Start camera
function startCamera() {
    if (visionState.cameraActive) return;
    
    const constraints = {
        video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user'
        }
    };
    
    navigator.mediaDevices.getUserMedia(constraints)
        .then(stream => {
            visionState.videoElement.srcObject = stream;
            visionState.cameraStream = stream;
            visionState.cameraActive = true;
            
            // Update UI
            document.getElementById('camera-container').classList.add('active');
            document.getElementById('start-camera-button').disabled = true;
            document.getElementById('stop-camera-button').disabled = false;
            document.getElementById('take-photo-button').disabled = false;
            
            // Start processing frames
            processVideoFrames();
        })
        .catch(error => {
            console.error('Error accessing camera:', error);
            addChatMessage(`Error accessing camera: ${error.message}`, 'system', 'error');
        });
}

// Stop camera
function stopCamera() {
    if (!visionState.cameraActive) return;
    
    // Stop all tracks
    if (visionState.cameraStream) {
        visionState.cameraStream.getTracks().forEach(track => track.stop());
    }
    
    // Clear video source
    visionState.videoElement.srcObject = null;
    visionState.cameraStream = null;
    visionState.cameraActive = false;
    
    // Update UI
    document.getElementById('camera-container').classList.remove('active');
    document.getElementById('start-camera-button').disabled = false;
    document.getElementById('stop-camera-button').disabled = true;
    document.getElementById('take-photo-button').disabled = true;
}

// Process video frames for real-time effects
function processVideoFrames() {
    if (!visionState.cameraActive) return;
    
    // Draw video frame to canvas with any active filters
    if (visionState.canvasContext && visionState.videoElement.readyState === 4) {
        visionState.canvasElement.width = visionState.videoElement.videoWidth;
        visionState.canvasElement.height = visionState.videoElement.videoHeight;
        
        visionState.canvasContext.drawImage(
            visionState.videoElement, 
            0, 0, 
            visionState.canvasElement.width, 
            visionState.canvasElement.height
        );
        
        // Apply active filters
        applyActiveFilters();
    }
    
    // Continue processing frames
    requestAnimationFrame(processVideoFrames);
}

// Take a screenshot
function takeScreenshot() {
    if (!visionState.cameraActive || !visionState.canvasElement) return;
    
    try {
        // Capture current frame
        const imageData = visionState.canvasElement.toDataURL('image/png');
        
        // Display the captured image
        displayCapturedImage(imageData);
        
        // Add to chat if needed
        if (typeof addChatMessage === 'function') {
            addChatMessage(imageData, 'user', 'image');
        }
        
        // Send to server for processing
        socket.emit('analyze_image', { image: imageData });
    } catch (error) {
        console.error('Error taking screenshot:', error);
    }
}

// Display captured image
function displayCapturedImage(imageData) {
    const capturedImage = document.getElementById('captured-image');
    if (capturedImage) {
        capturedImage.src = imageData;
        document.getElementById('captured-image-container').classList.add('active');
    }
}

// Handle image upload
function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        console.error('Selected file is not an image');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const imageData = e.target.result;
        displayCapturedImage(imageData);
        
        // Add to chat if needed
        if (typeof addChatMessage === 'function') {
            addChatMessage(imageData, 'user', 'image');
        }
        
        // Send to server for processing
        socket.emit('analyze_image', { image: imageData });
    };
    reader.readAsDataURL(file);
}

// Analyze current image
function analyzeCurrentImage() {
    const capturedImage = document.getElementById('captured-image');
    if (!capturedImage || !capturedImage.src) return;
    
    // Show loading state
    document.getElementById('analysis-status').textContent = 'Analyzing image...';
    document.getElementById('analysis-status').classList.add('loading');
    
    // Send to server for processing
    socket.emit('analyze_image', { image: capturedImage.src });
}

// Apply filter to video
function applyFilter(filterName) {
    if (!visionState.supportedFilters.includes(filterName)) return;
    
    // Clear existing filters
    visionState.currentFilters = [];
    
    // Add new filter if not 'normal'
    if (filterName !== 'normal') {
        visionState.currentFilters.push(filterName);
    }
}

// Apply active filters to canvas
function applyActiveFilters() {
    if (!visionState.canvasContext || visionState.currentFilters.length === 0) return;
    
    const imageData = visionState.canvasContext.getImageData(
        0, 0, 
        visionState.canvasElement.width, 
        visionState.canvasElement.height
    );
    
    visionState.currentFilters.forEach(filter => {
        switch (filter) {
            case 'grayscale':
                applyGrayscaleFilter(imageData);
                break;
            case 'sepia':
                applySepiaFilter(imageData);
                break;
            case 'invert':
                applyInvertFilter(imageData);
                break;
            case 'blur':
                applyBlurFilter(imageData);
                break;
            case 'edge-detection':
                applyEdgeDetectionFilter(imageData);
                break;
        }
    });
    
    visionState.canvasContext.putImageData(imageData, 0, 0);
}

// Grayscale filter
function applyGrayscaleFilter(imageData) {
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        data[i] = avg;     // Red
        data[i + 1] = avg; // Green
        data[i + 2] = avg; // Blue
    }
}

// Sepia filter
function applySepiaFilter(imageData) {
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        data[i] = Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189));
        data[i + 1] = Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168));
        data[i + 2] = Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131));
    }
}

// Invert filter
function applyInvertFilter(imageData) {
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        data[i] = 255 - data[i];         // Red
        data[i + 1] = 255 - data[i + 1]; // Green
        data[i + 2] = 255 - data[i + 2]; // Blue
    }
}

// Simple blur filter
function applyBlurFilter(imageData) {
    // This is a simplified blur implementation
    // A real implementation would use a convolution kernel
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    
    // Create a copy of the image data
    const original = new Uint8ClampedArray(data);
    
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = (y * width + x) * 4;
            
            // Simple 3x3 box blur
            let r = 0, g = 0, b = 0;
            
            for (let yy = -1; yy <= 1; yy++) {
                for (let xx = -1; xx <= 1; xx++) {
                    const offset = ((y + yy) * width + (x + xx)) * 4;
                    r += original[offset];
                    g += original[offset + 1];
                    b += original[offset + 2];
                }
            }
            
            // Average of 9 pixels
            data[idx] = r / 9;
            data[idx + 1] = g / 9;
            data[idx + 2] = b / 9;
        }
    }
}

// Simple edge detection filter
function applyEdgeDetectionFilter(imageData) {
    // Convert to grayscale first
    applyGrayscaleFilter(imageData);
    
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    
    // Create a copy of the image data
    const original = new Uint8ClampedArray(data);
    
    // Simple Sobel operator
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = (y * width + x) * 4;
            
            // Horizontal gradient
            const gx = 
                -1 * original[((y-1) * width + (x-1)) * 4] +
                -2 * original[((y) * width + (x-1)) * 4] +
                -1 * original[((y+1) * width + (x-1)) * 4] +
                1 * original[((y-1) * width + (x+1)) * 4] +
                2 * original[((y) * width + (x+1)) * 4] +
                1 * original[((y+1) * width + (x+1)) * 4];
                
            // Vertical gradient
            const gy = 
                -1 * original[((y-1) * width + (x-1)) * 4] +
                -2 * original[((y-1) * width + (x)) * 4] +
                -1 * original[((y-1) * width + (x+1)) * 4] +
                1 * original[((y+1) * width + (x-1)) * 4] +
                2 * original[((y+1) * width + (x)) * 4] +
                1 * original[((y+1) * width + (x+1)) * 4];
                
            // Magnitude
            const mag = Math.sqrt(gx * gx + gy * gy);
            
            // Threshold
            const value = mag > 50 ? 255 : 0;
            
            data[idx] = value;
            data[idx + 1] = value;
            data[idx + 2] = value;
        }
    }
}

// Socket event handlers
socket.on('image_analysis_result', (data) => {
    // Update UI with analysis results
    document.getElementById('analysis-status').textContent = 'Analysis complete';
    document.getElementById('analysis-status').classList.remove('loading');
    
    // Display results
    const resultsContainer = document.getElementById('analysis-results');
    if (resultsContainer && data.results) {
        resultsContainer.innerHTML = '';
        
        if (data.results.objects && data.results.objects.length > 0) {
            const objectsList = document.createElement('div');
            objectsList.className = 'analysis-section';
            objectsList.innerHTML = '<h4>Detected Objects</h4>';
            
            const objectsUl = document.createElement('ul');
            data.results.objects.forEach(obj => {
                const li = document.createElement('li');
                li.textContent = `${obj.name} (${Math.round(obj.confidence * 100)}%)`;
                objectsUl.appendChild(li);
            });
            
            objectsList.appendChild(objectsUl);
            resultsContainer.appendChild(objectsList);
        }
        
        if (data.results.text) {
            const textSection = document.createElement('div');
            textSection.className = 'analysis-section';
            textSection.innerHTML = '<h4>Detected Text</h4>';
            textSection.innerHTML += `<p>${data.results.text}</p>`;
            resultsContainer.appendChild(textSection);
        }
        
        if (data.results.description) {
            const descSection = document.createElement('div');
            descSection.className = 'analysis-section';
            descSection.innerHTML = '<h4>Image Description</h4>';
            descSection.innerHTML += `<p>${data.results.description}</p>`;
            resultsContainer.appendChild(descSection);
        }
    }
    
    // Add to chat if needed
    if (typeof queueMessage === 'function' && data.summary) {
        queueMessage(data.summary, 'alejo');
    }
});

// Initialize vision when DOM is loaded
document.addEventListener('DOMContentLoaded', initVision);
