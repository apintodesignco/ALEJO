/**
 * ALEJO Gesture Arpeggiator - Visualizer Core
 * 
 * Core visualization system for audio-reactive effects
 */

class Visualizer {
    /**
     * Initialize the visualizer
     * @param {string} containerId - ID of the container element
     * @param {object} options - Visualization options
     */
    constructor(containerId, options = {}) {
        // DOM elements
        this.container = document.getElementById(containerId);
        if (!this.container) {
            throw new Error(`Container element with ID '${containerId}' not found`);
        }
        
        // Configuration
        this.options = {
            mode: options.mode || 'particles',
            colorScheme: options.colorScheme || 'rainbow',
            intensity: options.intensity !== undefined ? options.intensity : 0.8,
            complexity: options.complexity !== undefined ? options.complexity : 0.6,
            speed: options.speed !== undefined ? options.speed : 0.5
        };
        
        // State
        this.isRunning = false;
        this.lastUpdateTime = 0;
        this.animationId = null;
        
        // Three.js components
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = null;
        
        // Visualization components
        this.visualizationModes = {};
        this.currentMode = null;
        
        // Color schemes
        this.colorSchemes = {
            rainbow: [
                0xff0000, 0xff7f00, 0xffff00, 0x00ff00, 
                0x0000ff, 0x4b0082, 0x9400d3
            ],
            cool: [
                0x00ffff, 0x00bfff, 0x0080ff, 0x0040ff, 
                0x0000ff, 0x4000ff, 0x8000ff
            ],
            warm: [
                0xff0000, 0xff4000, 0xff8000, 0xffbf00, 
                0xffff00, 0xffbf00, 0xff8000
            ],
            monochrome: [
                0xffffff, 0xdddddd, 0xbbbbbb, 0x999999, 
                0x777777, 0x555555, 0x333333
            ],
            neon: [
                0xff00ff, 0xff00cc, 0xff0099, 0xff0066, 
                0xff0033, 0xff0000, 0xff3300
            ]
        };
        
        // Audio reactivity
        this.audioData = {
            waveform: new Float32Array(1024),
            spectrum: new Float32Array(256),
            rms: 0,
            peakFrequency: 0
        };
        
        // Hand tracking data
        this.handData = [];
        
        // Event triggers
        this.noteEvents = [];
        this.drumEvents = [];
        this.maxEvents = 10;
        
        // Bind methods
        this.animate = this.animate.bind(this);
    }
    
    /**
     * Initialize the visualizer
     */
    init() {
        if (this.scene) return;
        
        try {
            console.log('Initializing visualizer...');
            
            // Check if Three.js is available
            if (!window.THREE) {
                throw new Error('Three.js not available');
            }
            
            // Create Three.js scene
            this.scene = new THREE.Scene();
            
            // Create camera
            const aspect = this.container.clientWidth / this.container.clientHeight;
            this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
            this.camera.position.z = 5;
            
            // Create renderer
            this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
            this.renderer.setPixelRatio(window.devicePixelRatio);
            this.container.appendChild(this.renderer.domElement);
            
            // Create clock
            this.clock = new THREE.Clock();
            
            // Initialize visualization modes
            this.initVisualizationModes();
            
            // Set initial mode
            this.setMode(this.options.mode);
            
            // Set up resize listener
            window.addEventListener('resize', () => this.resize());
            
            console.log('Visualizer initialized');
        } catch (error) {
            console.error('Failed to initialize visualizer:', error);
            throw error;
        }
    }
    
    /**
     * Initialize visualization modes
     */
    initVisualizationModes() {
        // Initialize each visualization mode
        this.visualizationModes = {
            particles: new ParticlesVisualization(this),
            waveform: new WaveformVisualization(this),
            spectrum: new SpectrumVisualization(this),
            geometric: new GeometricVisualization(this)
        };
    }
    
    /**
     * Start the visualizer
     */
    start() {
        if (this.isRunning) return;
        
        try {
            // Initialize if not already
            if (!this.scene) {
                this.init();
            }
            
            console.log('Starting visualizer...');
            
            // Start animation loop
            this.isRunning = true;
            this.lastUpdateTime = performance.now();
            this.animate();
            
            console.log('Visualizer started');
        } catch (error) {
            console.error('Failed to start visualizer:', error);
            this.isRunning = false;
            throw error;
        }
    }
    
    /**
     * Stop the visualizer
     */
    stop() {
        if (!this.isRunning) return;
        
        console.log('Stopping visualizer...');
        
        // Stop animation loop
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        console.log('Visualizer stopped');
    }
    
    /**
     * Animation loop
     */
    animate() {
        if (!this.isRunning) return;
        
        // Request next frame
        this.animationId = requestAnimationFrame(this.animate);
        
        // Get elapsed time
        const time = performance.now();
        const elapsed = (time - this.lastUpdateTime) / 1000;
        this.lastUpdateTime = time;
        
        // Update current visualization mode
        if (this.currentMode) {
            this.currentMode.update(elapsed);
        }
        
        // Render scene
        this.renderer.render(this.scene, this.camera);
        
        // Clean up old events
        this.cleanupEvents();
    }
    
    /**
     * Update visualizer with new data
     * @param {object} audioState - Audio engine state
     * @param {Array} handData - Hand tracking data
     * @param {number} elapsed - Elapsed time since last update
     */
    update(audioState, handData, elapsed) {
        // Update audio data
        if (audioState) {
            this.audioData.waveform = audioState.waveform || this.audioData.waveform;
            this.audioData.spectrum = audioState.spectrum || this.audioData.spectrum;
            this.audioData.rms = audioState.rms || this.audioData.rms;
            this.audioData.peakFrequency = audioState.peakFrequency || this.audioData.peakFrequency;
        }
        
        // Update hand data
        this.handData = handData || [];
    }
    
    /**
     * Trigger note event for visualization
     * @param {number} note - Note frequency
     */
    triggerNote(note) {
        this.noteEvents.push({
            time: performance.now(),
            note: note,
            age: 0
        });
        
        // Limit number of events
        if (this.noteEvents.length > this.maxEvents) {
            this.noteEvents.shift();
        }
    }
    
    /**
     * Trigger drum event for visualization
     * @param {number} step - Drum step index
     */
    triggerDrum(step) {
        this.drumEvents.push({
            time: performance.now(),
            step: step,
            age: 0
        });
        
        // Limit number of events
        if (this.drumEvents.length > this.maxEvents) {
            this.drumEvents.shift();
        }
    }
    
    /**
     * Clean up old events
     */
    cleanupEvents() {
        const now = performance.now();
        
        // Update age and remove old note events
        this.noteEvents = this.noteEvents.filter(event => {
            event.age = (now - event.time) / 1000;
            return event.age < 2; // Remove events older than 2 seconds
        });
        
        // Update age and remove old drum events
        this.drumEvents = this.drumEvents.filter(event => {
            event.age = (now - event.time) / 1000;
            return event.age < 2; // Remove events older than 2 seconds
        });
    }
    
    /**
     * Set visualization mode
     * @param {string} mode - Visualization mode
     */
    setMode(mode) {
        if (!this.visualizationModes[mode]) {
            console.warn(`Visualization mode '${mode}' not found, using 'particles'`);
            mode = 'particles';
        }
        
        console.log(`Setting visualization mode to '${mode}'`);
        
        // Clean up current mode
        if (this.currentMode) {
            this.currentMode.dispose();
        }
        
        // Set new mode
        this.currentMode = this.visualizationModes[mode];
        this.currentMode.init();
        this.options.mode = mode;
    }
    
    /**
     * Set color scheme
     * @param {string} scheme - Color scheme name
     */
    setColorScheme(scheme) {
        if (!this.colorSchemes[scheme]) {
            console.warn(`Color scheme '${scheme}' not found, using 'rainbow'`);
            scheme = 'rainbow';
        }
        
        console.log(`Setting color scheme to '${scheme}'`);
        this.options.colorScheme = scheme;
        
        // Update current mode
        if (this.currentMode) {
            this.currentMode.updateColors();
        }
    }
    
    /**
     * Set visualization intensity
     * @param {number} intensity - Intensity value (0-1)
     */
    setIntensity(intensity) {
        this.options.intensity = Math.max(0, Math.min(1, intensity));
        
        // Update current mode
        if (this.currentMode) {
            this.currentMode.updateOptions();
        }
    }
    
    /**
     * Set visualization complexity
     * @param {number} complexity - Complexity value (0-1)
     */
    setComplexity(complexity) {
        this.options.complexity = Math.max(0, Math.min(1, complexity));
        
        // Update current mode
        if (this.currentMode) {
            this.currentMode.updateOptions();
        }
    }
    
    /**
     * Set visualization speed
     * @param {number} speed - Speed value (0-1)
     */
    setSpeed(speed) {
        this.options.speed = Math.max(0, Math.min(1, speed));
        
        // Update current mode
        if (this.currentMode) {
            this.currentMode.updateOptions();
        }
    }
    
    /**
     * Resize visualizer to match container
     */
    resize() {
        if (!this.renderer || !this.camera) return;
        
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
        this.renderer.setSize(width, height);
    }
    
    /**
     * Get current color palette
     * @returns {Array} Array of color values
     */
    getColorPalette() {
        return this.colorSchemes[this.options.colorScheme] || this.colorSchemes.rainbow;
    }
    
    /**
     * Get color based on value
     * @param {number} value - Value between 0 and 1
     * @returns {number} Color value
     */
    getColor(value) {
        const palette = this.getColorPalette();
        const index = Math.min(Math.floor(value * palette.length), palette.length - 1);
        return palette[index];
    }
}

/**
 * Base class for visualization modes
 */
class VisualizationMode {
    /**
     * Initialize the visualization mode
     * @param {Visualizer} visualizer - Parent visualizer
     */
    constructor(visualizer) {
        this.visualizer = visualizer;
        this.scene = visualizer.scene;
        this.camera = visualizer.camera;
        this.objects = [];
    }
    
    /**
     * Initialize the visualization mode
     */
    init() {
        // To be implemented by subclasses
    }
    
    /**
     * Update the visualization
     * @param {number} elapsed - Elapsed time since last update
     */
    update(elapsed) {
        // To be implemented by subclasses
    }
    
    /**
     * Update colors based on current color scheme
     */
    updateColors() {
        // To be implemented by subclasses
    }
    
    /**
     * Update options
     */
    updateOptions() {
        // To be implemented by subclasses
    }
    
    /**
     * Dispose of resources
     */
    dispose() {
        // Remove all objects from scene
        for (const object of this.objects) {
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
                if (Array.isArray(object.material)) {
                    for (const material of object.material) {
                        material.dispose();
                    }
                } else {
                    object.material.dispose();
                }
            }
            this.scene.remove(object);
        }
        
        this.objects = [];
    }
}
