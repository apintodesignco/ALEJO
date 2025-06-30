/**
 * ALEJO Voice Interface - JavaScript Implementation
 * Handles voice recognition and speech synthesis
 */

// Voice recognition state
let recognition = null;
let isRecognizing = false;
let recognitionTimeout = null;

// Speech synthesis
const synth = window.speechSynthesis;
let voices = [];

// Initialize voice capabilities
function initVoice() {
    // Check if browser supports speech recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        setupSpeechRecognition();
    } else {
        console.warn('Speech recognition not supported in this browser');
        document.getElementById('voice-status-text').textContent = 'Voice recognition not supported in this browser';
        document.getElementById('start-listening-button').disabled = true;
        document.getElementById('stop-listening-button').disabled = true;
    }
    
    // Set up speech synthesis
    setupSpeechSynthesis();
}

// Set up speech recognition
function setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    
    recognition.onstart = () => {
        isRecognizing = true;
        document.getElementById('voice-status-indicator').classList.add('active');
        document.getElementById('voice-status-text').textContent = 'Listening...';
        document.getElementById('voice-transcript-text').textContent = '';
    };
    
    recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript;
            } else {
                interimTranscript += transcript;
            }
        }
        
        document.getElementById('voice-transcript-text').textContent = finalTranscript || interimTranscript;
        
        // Reset timeout
        if (recognitionTimeout) {
            clearTimeout(recognitionTimeout);
        }
        
        // Auto-stop after silence
        recognitionTimeout = setTimeout(() => {
            if (isRecognizing) {
                stopRecognition();
                
                // Process the final transcript
                const transcript = document.getElementById('voice-transcript-text').textContent.trim();
                if (transcript) {
                    processVoiceCommand(transcript);
                }
            }
        }, 1500);
    };
    
    recognition.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        document.getElementById('voice-status-text').textContent = `Error: ${event.error}`;
        stopRecognition();
    };
    
    recognition.onend = () => {
        isRecognizing = false;
        document.getElementById('voice-status-indicator').classList.remove('active');
        document.getElementById('voice-status-text').textContent = 'Voice recognition ready';
    };
}

// Start speech recognition
function startRecognition() {
    if (recognition && !isRecognizing) {
        try {
            recognition.start();
        } catch (e) {
            console.error('Error starting recognition', e);
        }
    }
}

// Stop speech recognition
function stopRecognition() {
    if (recognition && isRecognizing) {
        try {
            recognition.stop();
        } catch (e) {
            console.error('Error stopping recognition', e);
        }
    }
}

// Process voice command
function processVoiceCommand(command) {
    console.log('Processing voice command:', command);
    
    // Send command to server
    socket.emit('message', { command: command });
    
    // Add to chat
    addMessage('user', command);
}

// Set up speech synthesis
function setupSpeechSynthesis() {
    // Get available voices
    function loadVoices() {
        voices = synth.getVoices();
        console.log('Available voices:', voices);
    }
    
    if (synth.onvoiceschanged !== undefined) {
        synth.onvoiceschanged = loadVoices;
    }
    
    loadVoices();
}

// Speak text
function speak(text, callback) {
    if (!synth) {
        console.error('Speech synthesis not supported');
        if (callback) callback();
        return;
    }
    
    // Stop any current speech
    synth.cancel();
    
    // Create utterance
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Select voice (prefer a female voice if available)
    let selectedVoice = voices.find(voice => voice.name.includes('Female') || voice.name.includes('female'));
    if (!selectedVoice) {
        selectedVoice = voices[0]; // Default to first voice
    }
    
    if (selectedVoice) {
        utterance.voice = selectedVoice;
    }
    
    // Set properties
    utterance.volume = document.getElementById('voice-volume').value / 100;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    
    // Set callback
    utterance.onend = () => {
        if (callback) callback();
    };
    
    // Speak
    synth.speak(utterance);
}

// Listen for socket events for text-to-speech
socket.on('speak', (data) => {
    if (document.getElementById('enable-voice').checked) {
        speak(data.text);
    }
});

// Initialize voice when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize voice capabilities
    initVoice();
    
    // Set up event listeners
    document.getElementById('start-listening-button').addEventListener('click', startRecognition);
    document.getElementById('stop-listening-button').addEventListener('click', stopRecognition);
    document.getElementById('voice-input-button').addEventListener('click', () => {
        if (isRecognizing) {
            stopRecognition();
        } else {
            startRecognition();
        }
    });
});
