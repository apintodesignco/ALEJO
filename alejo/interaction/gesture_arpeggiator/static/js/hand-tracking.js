/**
 * ALEJO Gesture Arpeggiator - Hand Tracking Client
 * 
 * Handles client-side hand tracking using MediaPipe Hands,
 * with gesture recognition and hand position tracking.
 */

class HandTracking {
    /**
     * Initialize the hand tracking system
     * @param {string} videoElementId - ID of the video element
     * @param {string} canvasElementId - ID of the canvas element for drawing
     * @param {object} options - Configuration options
     */
    constructor(videoElementId, canvasElementId, options = {}) {
        // Elements
        this.videoElement = document.getElementById(videoElementId);
        this.canvasElement = document.getElementById(canvasElementId);
        this.canvasCtx = this.canvasElement.getContext('2d');
        
        // MediaPipe objects
        this.hands = null;
        this.camera = null;
        
        // Tracking state
        this.isRunning = false;
        this.lastHandData = [];
        this.gestureHistory = [];
        this.historyMaxLength = 10;
        
        // Configuration
        this.options = {
            maxHands: options.maxHands || 2,
            minDetectionConfidence: options.minDetectionConfidence || 0.7,
            minTrackingConfidence: options.minTrackingConfidence || 0.5,
            width: 640,
            height: 480,
            fps: 30
        };
        
        // Gesture recognition thresholds
        this.gestureThresholds = {
            pinchThreshold: 0.05,
            extendedFingerThreshold: -0.1,
            palmFacingThreshold: 0.2
        };
        
        // Initialize canvas dimensions
        this.resizeCanvas();
        
        // Bind methods
        this.onResults = this.onResults.bind(this);
        
        // Set up resize listener
        window.addEventListener('resize', () => this.resizeCanvas());
    }
    
    /**
     * Start hand tracking
     * @returns {Promise} Resolves when started
     */
    async start() {
        if (this.isRunning) return;
        
        try {
            console.log('Starting hand tracking...');
            
            // Check if MediaPipe is available
            if (!window.Hands) {
                throw new Error('MediaPipe Hands not available');
            }
            
            // Initialize MediaPipe Hands
            this.hands = new Hands({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
                }
            });
            
            // Configure MediaPipe Hands
            await this.hands.setOptions({
                maxNumHands: this.options.maxHands,
                modelComplexity: 1,
                minDetectionConfidence: this.options.minDetectionConfidence,
                minTrackingConfidence: this.options.minTrackingConfidence
            });
            
            // Set up result handler
            this.hands.onResults(this.onResults);
            
            // Initialize camera
            this.camera = new Camera(this.videoElement, {
                onFrame: async () => {
                    if (this.isRunning) {
                        await this.hands.send({image: this.videoElement});
                    }
                },
                width: this.options.width,
                height: this.options.height,
                fps: this.options.fps
            });
            
            // Start camera
            await this.camera.start();
            
            this.isRunning = true;
            console.log('Hand tracking started');
            
            return true;
        } catch (error) {
            console.error('Failed to start hand tracking:', error);
            this.isRunning = false;
            throw error;
        }
    }
    
    /**
     * Stop hand tracking
     */
    stop() {
        if (!this.isRunning) return;
        
        console.log('Stopping hand tracking...');
        
        // Stop camera if it exists
        if (this.camera) {
            this.camera.stop();
        }
        
        // Clear canvas
        this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
        
        this.isRunning = false;
        this.lastHandData = [];
        
        console.log('Hand tracking stopped');
    }
    
    /**
     * Handle results from MediaPipe Hands
     * @param {object} results - Results from MediaPipe Hands
     */
    onResults(results) {
        if (!this.isRunning) return;
        
        // Clear canvas
        this.canvasCtx.save();
        this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
        
        // Draw hand landmarks
        if (results.multiHandLandmarks && results.multiHandedness) {
            // Process each detected hand
            const handData = [];
            
            for (let i = 0; i < results.multiHandLandmarks.length; i++) {
                const landmarks = results.multiHandLandmarks[i];
                const handedness = results.multiHandedness[i];
                
                // Draw landmarks
                this.drawLandmarks(landmarks, handedness);
                
                // Process hand data
                const processedHand = this.processHandData(landmarks, handedness, i);
                handData.push(processedHand);
                
                // Update gesture indicator
                const elementId = processedHand.isLeft ? 'leftHandGesture' : 'rightHandGesture';
                const element = document.getElementById(elementId);
                if (element) {
                    element.textContent = `${processedHand.isLeft ? 'Left' : 'Right'}: ${processedHand.gesture}`;
                }
            }
            
            // Update last hand data
            this.lastHandData = handData;
            
            // Update gesture history
            if (handData.length > 0) {
                this.gestureHistory.push(handData.map(hand => hand.gesture));
                if (this.gestureHistory.length > this.historyMaxLength) {
                    this.gestureHistory.shift();
                }
            }
        } else {
            // No hands detected
            this.lastHandData = [];
            
            // Update gesture indicators
            document.getElementById('leftHandGesture').textContent = 'Left: None';
            document.getElementById('rightHandGesture').textContent = 'Right: None';
        }
        
        this.canvasCtx.restore();
    }
    
    /**
     * Process hand data from landmarks
     * @param {Array} landmarks - Hand landmarks
     * @param {object} handedness - Hand handedness
     * @param {number} index - Hand index
     * @returns {object} Processed hand data
     */
    processHandData(landmarks, handedness, index) {
        // Determine if left or right hand
        const isLeft = handedness.label === 'Left';
        
        // Extract key landmarks
        const wrist = landmarks[0];
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        const middleTip = landmarks[12];
        const ringTip = landmarks[16];
        const pinkyTip = landmarks[20];
        
        // Calculate hand center
        const centerX = landmarks.reduce((sum, lm) => sum + lm.x, 0) / landmarks.length;
        const centerY = landmarks.reduce((sum, lm) => sum + lm.y, 0) / landmarks.length;
        const centerZ = landmarks.reduce((sum, lm) => sum + lm.z, 0) / landmarks.length;
        
        // Recognize gesture
        const gesture = this.recognizeGesture(landmarks);
        
        // Create hand data object
        return {
            id: index,
            isLeft: isLeft,
            position: { x: centerX, y: centerY, z: centerZ },
            landmarks: landmarks.map(lm => ({ x: lm.x, y: lm.y, z: lm.z })),
            gesture: gesture,
            confidence: handedness.score
        };
    }
    
    /**
     * Recognize hand gesture from landmarks
     * @param {Array} landmarks - Hand landmarks
     * @returns {string} Recognized gesture
     */
    recognizeGesture(landmarks) {
        // Get extended fingers
        const extendedFingers = this.getExtendedFingers(landmarks);
        
        // Check for specific gestures
        if (this.isPinching(landmarks)) {
            return 'pinch';
        }
        
        // Check based on extended fingers
        const fingerSum = extendedFingers.reduce((sum, val) => sum + val, 0);
        
        if (fingerSum === 0) {
            return 'fist';
        } else if (fingerSum === 5) {
            // Open hand - check if palm is facing up or down
            return this.isPalmFacingDown(landmarks) ? 'palm_down' : 'open';
        } else if (extendedFingers[1] === 1 && fingerSum === 1) {
            return 'pointing';
        } else if (extendedFingers[1] === 1 && extendedFingers[2] === 1 && fingerSum === 2) {
            return 'victory';
        } else if (extendedFingers[0] === 1 && fingerSum === 1) {
            return 'thumbs_up';
        } else if (extendedFingers[0] === 1 && extendedFingers[4] === 1 && fingerSum === 2) {
            return 'rock';
        }
        
        // Default
        return 'unknown';
    }
    
    /**
     * Check if fingers are extended
     * @param {Array} landmarks - Hand landmarks
     * @returns {Array} Array of 5 booleans indicating extended fingers
     */
    getExtendedFingers(landmarks) {
        // Wrist position
        const wrist = landmarks[0];
        
        // Finger MCP joints (knuckles)
        const mcpJoints = [landmarks[1], landmarks[5], landmarks[9], landmarks[13], landmarks[17]];
        
        // Finger PIP joints (middle joints)
        const pipJoints = [landmarks[2], landmarks[6], landmarks[10], landmarks[14], landmarks[18]];
        
        // Finger tips
        const tips = [landmarks[4], landmarks[8], landmarks[12], landmarks[16], landmarks[20]];
        
        // Check each finger
        return [
            this.isThumbExtended(landmarks[1], landmarks[2], landmarks[3], landmarks[4]),
            this.isFingerExtended(wrist, mcpJoints[1], pipJoints[1], tips[1]),
            this.isFingerExtended(wrist, mcpJoints[2], pipJoints[2], tips[2]),
            this.isFingerExtended(wrist, mcpJoints[3], pipJoints[3], tips[3]),
            this.isFingerExtended(wrist, mcpJoints[4], pipJoints[4], tips[4])
        ];
    }
    
    /**
     * Check if thumb is extended
     * @param {object} cmc - Carpometacarpal joint
     * @param {object} mcp - Metacarpophalangeal joint
     * @param {object} ip - Interphalangeal joint
     * @param {object} tip - Tip of thumb
     * @returns {number} 1 if extended, 0 if not
     */
    isThumbExtended(cmc, mcp, ip, tip) {
        // Vector from mcp to tip
        const vecX = tip.x - mcp.x;
        const vecY = tip.y - mcp.y;
        
        // Vector from mcp to wrist
        const baseVecX = cmc.x - mcp.x;
        const baseVecY = cmc.y - mcp.y;
        
        // Dot product
        const dot = vecX * baseVecX + vecY * baseVecY;
        
        // If dot product is negative, vectors point in opposite directions
        return dot < 0 ? 1 : 0;
    }
    
    /**
     * Check if finger is extended
     * @param {object} wrist - Wrist landmark
     * @param {object} mcp - Metacarpophalangeal joint
     * @param {object} pip - Proximal interphalangeal joint
     * @param {object} tip - Finger tip
     * @returns {number} 1 if extended, 0 if not
     */
    isFingerExtended(wrist, mcp, pip, tip) {
        // Check if tip is higher than PIP joint (y is inverted in screen coordinates)
        return tip.y < pip.y ? 1 : 0;
    }
    
    /**
     * Check if hand is making a pinch gesture
     * @param {Array} landmarks - Hand landmarks
     * @returns {boolean} True if pinching
     */
    isPinching(landmarks) {
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        
        // Calculate distance between thumb and index fingertips
        const distance = Math.sqrt(
            Math.pow(thumbTip.x - indexTip.x, 2) +
            Math.pow(thumbTip.y - indexTip.y, 2) +
            Math.pow(thumbTip.z - indexTip.z, 2)
        );
        
        return distance < this.gestureThresholds.pinchThreshold;
    }
    
    /**
     * Check if palm is facing down
     * @param {Array} landmarks - Hand landmarks
     * @returns {boolean} True if palm is facing down
     */
    isPalmFacingDown(landmarks) {
        // Use wrist and MCP joints to determine palm orientation
        const wrist = landmarks[0];
        const indexMcp = landmarks[5];
        const pinkyMcp = landmarks[17];
        
        // Calculate normal vector to palm using cross product
        const v1x = indexMcp.x - wrist.x;
        const v1y = indexMcp.y - wrist.y;
        const v1z = indexMcp.z - wrist.z;
        
        const v2x = pinkyMcp.x - wrist.x;
        const v2y = pinkyMcp.y - wrist.y;
        const v2z = pinkyMcp.z - wrist.z;
        
        // Cross product
        const normalX = v1y * v2z - v1z * v2y;
        const normalY = v1z * v2x - v1x * v2z;
        const normalZ = v1x * v2y - v1y * v2x;
        
        // If z component of normal vector is negative, palm is facing down
        return normalZ < this.gestureThresholds.palmFacingThreshold;
    }
    
    /**
     * Draw hand landmarks on canvas
     * @param {Array} landmarks - Hand landmarks
     * @param {object} handedness - Hand handedness
     */
    drawLandmarks(landmarks, handedness) {
        // Draw connections
        this.canvasCtx.lineWidth = 2;
        this.canvasCtx.strokeStyle = handedness.label === 'Left' ? '#00FF00' : '#FF0000';
        
        // Draw connections between landmarks
        this.drawConnections(landmarks);
        
        // Draw landmarks
        this.canvasCtx.fillStyle = handedness.label === 'Left' ? '#00FF00' : '#FF0000';
        
        for (const landmark of landmarks) {
            this.canvasCtx.beginPath();
            this.canvasCtx.arc(
                landmark.x * this.canvasElement.width,
                landmark.y * this.canvasElement.height,
                3,
                0,
                2 * Math.PI
            );
            this.canvasCtx.fill();
        }
    }
    
    /**
     * Draw connections between landmarks
     * @param {Array} landmarks - Hand landmarks
     */
    drawConnections(landmarks) {
        // Define connections
        const connections = [
            // Thumb
            [0, 1], [1, 2], [2, 3], [3, 4],
            // Index finger
            [0, 5], [5, 6], [6, 7], [7, 8],
            // Middle finger
            [0, 9], [9, 10], [10, 11], [11, 12],
            // Ring finger
            [0, 13], [13, 14], [14, 15], [15, 16],
            // Pinky
            [0, 17], [17, 18], [18, 19], [19, 20],
            // Palm
            [0, 5], [5, 9], [9, 13], [13, 17]
        ];
        
        // Draw each connection
        for (const connection of connections) {
            const [i, j] = connection;
            
            this.canvasCtx.beginPath();
            this.canvasCtx.moveTo(
                landmarks[i].x * this.canvasElement.width,
                landmarks[i].y * this.canvasElement.height
            );
            this.canvasCtx.lineTo(
                landmarks[j].x * this.canvasElement.width,
                landmarks[j].y * this.canvasElement.height
            );
            this.canvasCtx.stroke();
        }
    }
    
    /**
     * Resize canvas to match video dimensions
     */
    resizeCanvas() {
        const container = this.canvasElement.parentElement;
        if (!container) return;
        
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        
        // Maintain aspect ratio
        const aspectRatio = this.options.width / this.options.height;
        let width = containerWidth;
        let height = containerWidth / aspectRatio;
        
        if (height > containerHeight) {
            height = containerHeight;
            width = containerHeight * aspectRatio;
        }
        
        this.canvasElement.width = width;
        this.canvasElement.height = height;
    }
    
    /**
     * Update hand tracking and return current hand data
     * @returns {Array} Current hand data
     */
    update() {
        return this.lastHandData;
    }
    
    /**
     * Get the dominant gesture from recent history
     * @returns {string} Dominant gesture
     */
    getDominantGesture() {
        if (this.gestureHistory.length === 0) {
            return 'unknown';
        }
        
        // Count gesture occurrences
        const gestureCounts = {};
        
        for (const handGestures of this.gestureHistory) {
            for (const gesture of handGestures) {
                if (gesture !== 'unknown') {
                    gestureCounts[gesture] = (gestureCounts[gesture] || 0) + 1;
                }
            }
        }
        
        // Find most frequent gesture
        let dominantGesture = 'unknown';
        let maxCount = 0;
        
        for (const [gesture, count] of Object.entries(gestureCounts)) {
            if (count > maxCount) {
                maxCount = count;
                dominantGesture = gesture;
            }
        }
        
        return dominantGesture;
    }
    
    /**
     * Update tracking options
     * @param {object} options - New options
     */
    updateOptions(options) {
        Object.assign(this.options, options);
        
        // Update MediaPipe options if running
        if (this.isRunning && this.hands) {
            this.hands.setOptions({
                maxNumHands: this.options.maxHands,
                minDetectionConfidence: this.options.minDetectionConfidence,
                minTrackingConfidence: this.options.minTrackingConfidence
            });
        }
    }
}
