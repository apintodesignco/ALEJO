/**
 * ALEJO Gesture Arpeggiator - Audio Engine
 * 
 * Handles client-side audio synthesis using Tone.js,
 * including arpeggiator and drum machine functionality.
 */

class AudioEngine {
    /**
     * Initialize the audio engine
     * @param {object} app - Reference to the main application
     */
    constructor(app) {
        this.app = app;
        
        // Audio state
        this.isInitialized = false;
        this.isPlaying = false;
        this.isMuted = false;
        
        // Audio components
        this.synth = null;
        this.drumSampler = null;
        this.arpeggioPattern = null;
        this.drumPattern = null;
        this.masterVolume = null;
        
        // Audio parameters
        this.bpm = 120;
        this.rootNote = 60; // Middle C
        this.scale = 'major';
        this.arpeggioPatternType = 'up';
        this.octaveRange = 2;
        this.currentDrumPatternId = 0;
        
        // Volume levels
        this.masterVolumeLevel = 0.8;
        this.arpeggioVolumeLevel = 0.8;
        this.drumVolumeLevel = 0.8;
        
        // Audio analysis
        this.analyzer = null;
        this.waveform = null;
        this.spectrum = null;
        
        // Musical data
        this.scales = {
            'major': [0, 2, 4, 5, 7, 9, 11],
            'minor': [0, 2, 3, 5, 7, 8, 10],
            'pentatonic': [0, 2, 4, 7, 9],
            'blues': [0, 3, 5, 6, 7, 10],
            'chromatic': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
        };
        
        // Drum patterns (kick, snare, hihat, tom)
        this.drumPatterns = [
            // Basic 4/4
            [
                [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
                [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0]
            ],
            // Hip-hop
            [
                [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
                [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
                [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
                [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0]
            ],
            // Electronic
            [
                [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0],
                [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0]
            ]
        ];
        
        // Bind methods
        this.onArpeggioStep = this.onArpeggioStep.bind(this);
        this.onDrumStep = this.onDrumStep.bind(this);
    }
    
    /**
     * Initialize the audio engine
     * @returns {Promise} Resolves when initialized
     */
    async initialize() {
        if (this.isInitialized) return;
        
        try {
            console.log('Initializing audio engine...');
            
            // Check if Tone.js is available
            if (!window.Tone) {
                throw new Error('Tone.js not available');
            }
            
            // Start audio context
            await Tone.start();
            
            // Set up master volume
            this.masterVolume = new Tone.Volume(Tone.gainToDb(this.masterVolumeLevel)).toDestination();
            
            // Set up synth
            this.synth = new Tone.PolySynth(Tone.Synth, {
                oscillator: {
                    type: 'triangle'
                },
                envelope: {
                    attack: 0.02,
                    decay: 0.1,
                    sustain: 0.3,
                    release: 1
                }
            }).connect(this.masterVolume);
            
            // Set up drum sampler
            this.drumSampler = new Tone.Sampler({
                urls: {
                    C1: 'kick.wav',
                    D1: 'snare.wav',
                    E1: 'hihat.wav',
                    F1: 'tom.wav'
                },
                baseUrl: '/static/audio/drums/',
                onload: () => {
                    console.log('Drum samples loaded');
                }
            }).connect(this.masterVolume);
            
            // Set up analyzer
            this.analyzer = new Tone.Analyser('waveform', 1024);
            this.masterVolume.connect(this.analyzer);
            
            // Set up spectrum analyzer
            this.spectrumAnalyzer = new Tone.Analyser('fft', 256);
            this.masterVolume.connect(this.spectrumAnalyzer);
            
            // Set BPM
            Tone.Transport.bpm.value = this.bpm;
            
            // Create arpeggio pattern
            this.createArpeggioPattern();
            
            // Create drum pattern
            this.createDrumPattern();
            
            this.isInitialized = true;
            console.log('Audio engine initialized');
            
            return true;
        } catch (error) {
            console.error('Failed to initialize audio engine:', error);
            this.isInitialized = false;
            throw error;
        }
    }
    
    /**
     * Start the audio engine
     * @returns {Promise} Resolves when started
     */
    async start() {
        if (this.isPlaying) return;
        
        try {
            // Initialize if not already
            if (!this.isInitialized) {
                await this.initialize();
            }
            
            console.log('Starting audio playback...');
            
            // Start transport
            Tone.Transport.start();
            
            this.isPlaying = true;
            console.log('Audio playback started');
            
            return true;
        } catch (error) {
            console.error('Failed to start audio playback:', error);
            this.isPlaying = false;
            throw error;
        }
    }
    
    /**
     * Stop the audio engine
     */
    stop() {
        if (!this.isPlaying) return;
        
        console.log('Stopping audio playback...');
        
        // Stop transport
        Tone.Transport.stop();
        
        this.isPlaying = false;
        console.log('Audio playback stopped');
    }
    
    /**
     * Toggle mute state
     * @returns {boolean} New mute state
     */
    toggleMute() {
        this.isMuted = !this.isMuted;
        
        if (this.masterVolume) {
            this.masterVolume.mute = this.isMuted;
        }
        
        console.log(`Audio ${this.isMuted ? 'muted' : 'unmuted'}`);
        return this.isMuted;
    }
    
    /**
     * Create arpeggio pattern
     */
    createArpeggioPattern() {
        // Clear existing pattern
        if (this.arpeggioPattern) {
            this.arpeggioPattern.dispose();
        }
        
        // Generate notes for the pattern
        const notes = this.generateArpeggioNotes();
        
        // Create new pattern
        this.arpeggioPattern = new Tone.Sequence(
            this.onArpeggioStep,
            notes,
            '16n'
        );
        
        // Start pattern
        this.arpeggioPattern.start(0);
    }
    
    /**
     * Generate notes for the arpeggio pattern
     * @returns {Array} Array of note frequencies
     */
    generateArpeggioNotes() {
        const scaleIntervals = this.scales[this.scale] || this.scales.major;
        const notes = [];
        
        // Generate notes based on pattern type
        switch (this.arpeggioPatternType) {
            case 'up':
                for (let octave = 0; octave < this.octaveRange; octave++) {
                    for (const interval of scaleIntervals) {
                        const note = this.rootNote + interval + (octave * 12);
                        notes.push(this.midiToFrequency(note));
                    }
                }
                break;
                
            case 'down':
                for (let octave = this.octaveRange - 1; octave >= 0; octave--) {
                    for (let i = scaleIntervals.length - 1; i >= 0; i--) {
                        const note = this.rootNote + scaleIntervals[i] + (octave * 12);
                        notes.push(this.midiToFrequency(note));
                    }
                }
                break;
                
            case 'upDown':
                // Up
                for (let octave = 0; octave < this.octaveRange; octave++) {
                    for (const interval of scaleIntervals) {
                        const note = this.rootNote + interval + (octave * 12);
                        notes.push(this.midiToFrequency(note));
                    }
                }
                // Down (excluding duplicates at the top)
                for (let octave = this.octaveRange - 1; octave >= 0; octave--) {
                    for (let i = scaleIntervals.length - 1; i >= 0; i--) {
                        if (octave === this.octaveRange - 1 && i === scaleIntervals.length - 1) {
                            continue; // Skip the first note in the descent (already played)
                        }
                        const note = this.rootNote + scaleIntervals[i] + (octave * 12);
                        notes.push(this.midiToFrequency(note));
                    }
                }
                break;
                
            case 'random':
                const totalNotes = scaleIntervals.length * this.octaveRange;
                for (let i = 0; i < totalNotes; i++) {
                    const octave = Math.floor(Math.random() * this.octaveRange);
                    const intervalIndex = Math.floor(Math.random() * scaleIntervals.length);
                    const note = this.rootNote + scaleIntervals[intervalIndex] + (octave * 12);
                    notes.push(this.midiToFrequency(note));
                }
                break;
                
            default:
                // Default to up
                for (let octave = 0; octave < this.octaveRange; octave++) {
                    for (const interval of scaleIntervals) {
                        const note = this.rootNote + interval + (octave * 12);
                        notes.push(this.midiToFrequency(note));
                    }
                }
        }
        
        return notes;
    }
    
    /**
     * Create drum pattern
     */
    createDrumPattern() {
        // Clear existing pattern
        if (this.drumPattern) {
            this.drumPattern.dispose();
        }
        
        // Create new pattern
        this.drumPattern = new Tone.Sequence(
            this.onDrumStep,
            Array.from({ length: 16 }, (_, i) => i),
            '16n'
        );
        
        // Start pattern
        this.drumPattern.start(0);
    }
    
    /**
     * Handle arpeggio step
     * @param {number} time - Time in seconds
     * @param {number} note - Note frequency
     */
    onArpeggioStep(time, note) {
        if (!this.isPlaying || this.isMuted) return;
        
        // Play note
        this.synth.triggerAttackRelease(note, '16n', time, this.arpeggioVolumeLevel);
        
        // Trigger event for visualization
        if (this.app && this.app.visualizer) {
            Tone.Draw.schedule(() => {
                this.app.visualizer.triggerNote(note);
            }, time);
        }
    }
    
    /**
     * Handle drum step
     * @param {number} time - Time in seconds
     * @param {number} step - Step index
     */
    onDrumStep(time, step) {
        if (!this.isPlaying || this.isMuted) return;
        
        const pattern = this.drumPatterns[this.currentDrumPatternId] || this.drumPatterns[0];
        
        // Play drum sounds
        if (pattern[0][step]) {
            this.drumSampler.triggerAttackRelease('C1', '16n', time, this.drumVolumeLevel);
        }
        
        if (pattern[1][step]) {
            this.drumSampler.triggerAttackRelease('D1', '16n', time, this.drumVolumeLevel);
        }
        
        if (pattern[2][step]) {
            this.drumSampler.triggerAttackRelease('E1', '16n', time, this.drumVolumeLevel * 0.7);
        }
        
        if (pattern[3][step]) {
            this.drumSampler.triggerAttackRelease('F1', '16n', time, this.drumVolumeLevel);
        }
        
        // Trigger event for visualization
        if (this.app && this.app.visualizer) {
            Tone.Draw.schedule(() => {
                this.app.visualizer.triggerDrum(step);
            }, time);
        }
    }
    
    /**
     * Convert MIDI note to frequency
     * @param {number} midi - MIDI note number
     * @returns {number} Frequency in Hz
     */
    midiToFrequency(midi) {
        return 440 * Math.pow(2, (midi - 69) / 12);
    }
    
    /**
     * Set master volume
     * @param {number} volume - Volume level (0-1)
     */
    setMasterVolume(volume) {
        this.masterVolumeLevel = volume;
        
        if (this.masterVolume) {
            this.masterVolume.volume.value = Tone.gainToDb(volume);
        }
    }
    
    /**
     * Set arpeggio volume
     * @param {number} volume - Volume level (0-1)
     */
    setArpeggioVolume(volume) {
        this.arpeggioVolumeLevel = volume;
    }
    
    /**
     * Set drum volume
     * @param {number} volume - Volume level (0-1)
     */
    setDrumVolume(volume) {
        this.drumVolumeLevel = volume;
    }
    
    /**
     * Set BPM
     * @param {number} bpm - Beats per minute
     */
    setBpm(bpm) {
        this.bpm = bpm;
        
        if (Tone.Transport) {
            Tone.Transport.bpm.value = bpm;
        }
    }
    
    /**
     * Set root note
     * @param {number} midiNote - MIDI note number
     */
    setRootNote(midiNote) {
        this.rootNote = midiNote;
        this.createArpeggioPattern();
    }
    
    /**
     * Set scale
     * @param {string} scale - Scale name
     */
    setScale(scale) {
        if (this.scales[scale]) {
            this.scale = scale;
            this.createArpeggioPattern();
        }
    }
    
    /**
     * Set arpeggio pattern
     * @param {string} pattern - Pattern type
     */
    setArpeggioPattern(pattern) {
        this.arpeggioPatternType = pattern;
        this.createArpeggioPattern();
    }
    
    /**
     * Set drum pattern
     * @param {number} patternId - Pattern ID
     */
    setDrumPattern(patternId) {
        if (patternId >= 0 && patternId < this.drumPatterns.length) {
            this.currentDrumPatternId = patternId;
        }
    }
    
    /**
     * Set octave range
     * @param {number} range - Octave range
     */
    setOctaveRange(range) {
        this.octaveRange = range;
        this.createArpeggioPattern();
    }
    
    /**
     * Update audio engine and return current state
     * @param {number} elapsed - Elapsed time since last update
     * @returns {object} Current audio state
     */
    update(elapsed) {
        // Get waveform data
        const waveform = this.analyzer ? this.analyzer.getValue() : new Float32Array(1024);
        
        // Get spectrum data
        const spectrum = this.spectrumAnalyzer ? this.spectrumAnalyzer.getValue() : new Float32Array(256);
        
        // Calculate audio levels
        let rms = 0;
        for (let i = 0; i < waveform.length; i++) {
            rms += waveform[i] * waveform[i];
        }
        rms = Math.sqrt(rms / waveform.length);
        
        // Calculate peak frequency
        let peakIndex = 0;
        let peakValue = 0;
        for (let i = 0; i < spectrum.length; i++) {
            if (spectrum[i] > peakValue) {
                peakValue = spectrum[i];
                peakIndex = i;
            }
        }
        
        const peakFrequency = peakIndex * (Tone.context.sampleRate / 2) / spectrum.length;
        
        // Return current state
        return {
            isPlaying: this.isPlaying,
            isMuted: this.isMuted,
            bpm: this.bpm,
            rootNote: this.rootNote,
            scale: this.scale,
            pattern: this.arpeggioPatternType,
            drumPattern: this.currentDrumPatternId,
            masterVolume: this.masterVolumeLevel,
            arpeggioVolume: this.arpeggioVolumeLevel,
            drumVolume: this.drumVolumeLevel,
            waveform: Array.from(waveform),
            spectrum: Array.from(spectrum),
            rms: rms,
            peakFrequency: peakFrequency,
            currentBeat: (Tone.Transport.position.split(':')[1] || 0)
        };
    }
}
