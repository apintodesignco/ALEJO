/**
 * ALEJO Web Interface - Main JavaScript
 */

// Initialize socket connection
const socket = io();

// DOM Elements
const chatMessages = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const voiceInputButton = document.getElementById('voice-input-button');
const menuItems = document.querySelectorAll('.menu-items a');
const views = document.querySelectorAll('.view');
const themeSelect = document.getElementById('theme-select');
const enable3dCheckbox = document.getElementById('enable-3d');
const enableVoiceCheckbox = document.getElementById('enable-voice');
const voiceVolumeSlider = document.getElementById('voice-volume');
const takeScreenshotButton = document.getElementById('take-screenshot');
const analyzeImageButton = document.getElementById('analyze-image');
const uploadImageButton = document.getElementById('upload-image');
const visionImage = document.getElementById('vision-image');
const visionAnalysis = document.getElementById('vision-analysis');
const startListeningButton = document.getElementById('start-listening');
const stopListeningButton = document.getElementById('stop-listening');
const voiceStatusIndicator = document.getElementById('voice-status-indicator');
const voiceStatusText = document.getElementById('voice-status-text');
const voiceTranscriptText = document.getElementById('voice-transcript-text');
const cpuUsage = document.getElementById('cpu-usage');
const cpuValue = document.getElementById('cpu-value');
const memoryUsage = document.getElementById('memory-usage');
const memoryValue = document.getElementById('memory-value');
const diskUsage = document.getElementById('disk-usage');
const diskValue = document.getElementById('disk-value');
const uptimeValue = document.getElementById('uptime-value');
const holographicContainer = document.getElementById('holographic-container');

// Application state
const state = {
    connected: false,
    listening: false,
    theme: 'dark',
    enable3d: true,
    enableVoice: true,
    voiceVolume: 80,
    currentView: 'chat',
    systemMetrics: {
        cpu: 0,
        memory: 0,
        disk: 0,
        uptime: 0
    },
    conversationHistory: []
};

// Initialize the application
function initApp() {
    setupEventListeners();
    setupSocketEvents();
    loadSettings();
    updateTheme();
}

// Set up event listeners
function setupEventListeners() {
    // Send message on button click
    sendButton.addEventListener('click', sendMessage);
    
    // Send message on Enter key
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
    // Menu navigation
    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const view = e.target.getAttribute('data-view');
            changeView(view);
        });
    });
    
    // Settings changes
    themeSelect.addEventListener('change', () => {
        state.theme = themeSelect.value;
        updateTheme();
        saveSettings();
    });
    
    enable3dCheckbox.addEventListener('change', () => {
        state.enable3d = enable3dCheckbox.checked;
        toggleHolographicUI();
        saveSettings();
    });
    
    enableVoiceCheckbox.addEventListener('change', () => {
        state.enableVoice = enableVoiceCheckbox.checked;
        saveSettings();
    });
    
    voiceVolumeSlider.addEventListener('input', () => {
        state.voiceVolume = voiceVolumeSlider.value;
        saveSettings();
    });
    
    // Vision controls
    takeScreenshotButton.addEventListener('click', takeScreenshot);
    analyzeImageButton.addEventListener('click', analyzeImage);
    uploadImageButton.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    visionImage.src = e.target.result;
                };
                reader.readAsDataURL(file);
            }
        };
        input.click();
    });
    
    // Voice controls
    startListeningButton.addEventListener('click', startListening);
    stopListeningButton.addEventListener('click', stopListening);
    voiceInputButton.addEventListener('click', toggleVoiceInput);
}

// Set up socket events
function setupSocketEvents() {
    socket.on('connect', () => {
        console.log('Connected to server');
        state.connected = true;
        addSystemMessage('Connected to ALEJO server');
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        state.connected = false;
        addSystemMessage('Disconnected from ALEJO server');
    });
    
    socket.on('welcome', (data) => {
        console.log('Welcome message:', data);
        addSystemMessage(data.message);
    });
    
    socket.on('response', (data) => {
        console.log('Response:', data);
        addMessage('alejo', data.response);
    });
    
    socket.on('system_metrics', (data) => {
        updateSystemMetrics(data);
    });
    
    socket.on('handshake_ack', (data) => {
        console.log('Handshake acknowledged:', data);
    });
    
    // Send handshake to server
    socket.emit('handshake', {
        client: 'web',
        version: '1.0.0',
        capabilities: {
            voice: true,
            vision: true
        }
    });
}

// Send a message to the server
function sendMessage() {
    const message = messageInput.value.trim();
    if (message) {
        addMessage('user', message);
        socket.emit('message', { command: message });
        messageInput.value = '';
    }
}

// Add a message to the chat
function addMessage(speaker, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${speaker}`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.innerHTML = `<p>${content}</p>`;
    
    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    timeDiv.textContent = formatTime(new Date());
    
    messageDiv.appendChild(contentDiv);
    messageDiv.appendChild(timeDiv);
    
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
    
    // Add to conversation history
    state.conversationHistory.push({
        speaker,
        content,
        timestamp: new Date().toISOString()
    });
}

// Add a system message
function addSystemMessage(content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message system';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.innerHTML = `<p>${content}</p>`;
    
    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    timeDiv.textContent = formatTime(new Date());
    
    messageDiv.appendChild(contentDiv);
    messageDiv.appendChild(timeDiv);
    
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

// Scroll chat to bottom
function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Format time for messages
function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Change the current view
function changeView(view) {
    state.currentView = view;
    
    // Update menu items
    menuItems.forEach(item => {
        if (item.getAttribute('data-view') === view) {
            item.parentElement.classList.add('active');
        } else {
            item.parentElement.classList.remove('active');
        }
    });
    
    // Update views
    views.forEach(viewElement => {
        if (viewElement.id === `${view}-view`) {
            viewElement.classList.add('active');
        } else {
            viewElement.classList.remove('active');
        }
    });
}

// Update the theme
function updateTheme() {
    document.body.className = `theme-${state.theme}`;
}

// Toggle holographic UI
function toggleHolographicUI() {
    if (state.enable3d) {
        holographicContainer.style.display = 'block';
        initHolographicUI();
    } else {
        holographicContainer.style.display = 'none';
    }
}

// Initialize holographic UI
function initHolographicUI() {
    // This will be implemented in holographic.js
    if (typeof initHolographic === 'function') {
        initHolographic();
    }
}

// Take a screenshot
function takeScreenshot() {
    fetch('/api/vision/screenshot')
        .then(response => response.json())
        .then(data => {
            if (data.image) {
                visionImage.src = data.image;
            } else {
                console.error('No image in response');
            }
        })
        .catch(error => {
            console.error('Error taking screenshot:', error);
            addSystemMessage('Error taking screenshot');
        });
}

// Analyze the current image
function analyzeImage() {
    if (!visionImage.src || visionImage.src === '') {
        addSystemMessage('No image to analyze');
        return;
    }
    
    fetch('/api/vision/analyze', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            image: visionImage.src
        })
    })
        .then(response => response.json())
        .then(data => {
            visionAnalysis.textContent = data.description || 'No analysis available';
        })
        .catch(error => {
            console.error('Error analyzing image:', error);
            addSystemMessage('Error analyzing image');
        });
}

// Start voice listening
function startListening() {
    voiceStatusIndicator.classList.add('active');
    voiceStatusText.textContent = 'Listening...';
    state.listening = true;
    
    // In a real app, we would start the microphone here
    // For now, we'll just simulate it
    
    fetch('/api/audio/analyze', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            audio: 'base64-audio-data-would-go-here'
        })
    })
        .then(response => response.json())
        .then(data => {
            if (data.text) {
                voiceTranscriptText.textContent = data.text;
                // Send the transcribed text as a command
                socket.emit('message', { command: data.text });
            }
        })
        .catch(error => {
            console.error('Error analyzing audio:', error);
            addSystemMessage('Error processing voice input');
        });
}

// Stop voice listening
function stopListening() {
    voiceStatusIndicator.classList.remove('active');
    voiceStatusText.textContent = 'Voice recognition ready';
    state.listening = false;
}

// Toggle voice input for chat
function toggleVoiceInput() {
    if (state.listening) {
        stopListening();
    } else {
        startListening();
    }
}

// Update system metrics display
function updateSystemMetrics(metrics) {
    state.systemMetrics = metrics;
    
    // Update CPU
    const cpuPercent = metrics.cpu || 0;
    cpuUsage.style.width = `${cpuPercent}%`;
    cpuValue.textContent = `${cpuPercent}%`;
    
    // Update memory
    const memoryPercent = metrics.memory || 0;
    memoryUsage.style.width = `${memoryPercent}%`;
    memoryValue.textContent = `${memoryPercent}%`;
    
    // Update disk
    const diskPercent = metrics.disk || 0;
    diskUsage.style.width = `${diskPercent}%`;
    diskValue.textContent = `${diskPercent}%`;
    
    // Update uptime
    const uptime = metrics.uptime || 0;
    uptimeValue.textContent = formatUptime(uptime);
}

// Format uptime
function formatUptime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// Load settings from localStorage
function loadSettings() {
    try {
        const savedSettings = localStorage.getItem('alejoSettings');
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            state.theme = settings.theme || 'dark';
            state.enable3d = settings.enable3d !== undefined ? settings.enable3d : true;
            state.enableVoice = settings.enableVoice !== undefined ? settings.enableVoice : true;
            state.voiceVolume = settings.voiceVolume || 80;
            
            // Update UI to match settings
            themeSelect.value = state.theme;
            enable3dCheckbox.checked = state.enable3d;
            enableVoiceCheckbox.checked = state.enableVoice;
            voiceVolumeSlider.value = state.voiceVolume;
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

// Save settings to localStorage
function saveSettings() {
    try {
        const settings = {
            theme: state.theme,
            enable3d: state.enable3d,
            enableVoice: state.enableVoice,
            voiceVolume: state.voiceVolume
        };
        localStorage.setItem('alejoSettings', JSON.stringify(settings));
    } catch (error) {
        console.error('Error saving settings:', error);
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);
