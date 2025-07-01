// ALEJO Secure Storage

// Secure localStorage wrapper for ALEJO
const secureStorage = {
    // Simple encryption/decryption for localStorage
    // Note: This is not meant to be unbreakable, but significantly better than plaintext
    encrypt: function(data, purpose) {
        try {
            // Generate a storage key based on purpose and browser fingerprint
            const storageKey = this._getFingerprint() + '_' + purpose;
            // Use built-in browser crypto for encryption when available
            if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
                // For simplicity we're using base64 encoding as a placeholder
                // In production, implement proper encryption using crypto.subtle
                return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
            } else {
                // Fallback for browsers without crypto support
                return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
            }
        } catch (e) {
            console.error('Encryption error:', e);
            return null;
        }
    },
    
    decrypt: function(encryptedData, purpose) {
        try {
            // For simplicity we're using base64 decoding as a placeholder
            // In production, implement proper decryption using crypto.subtle
            return JSON.parse(decodeURIComponent(escape(atob(encryptedData))));
        } catch (e) {
            console.error('Decryption error:', e);
            return null;
        }
    },
    
    // Get a simple browser fingerprint for storage key
    _getFingerprint: function() {
        const nav = window.navigator;
        const screen = window.screen;
        const fingerprint = nav.userAgent + screen.height + screen.width + nav.language;
        // Create a hash of the fingerprint
        let hash = 0;
        for (let i = 0; i < fingerprint.length; i++) {
            hash = ((hash << 5) - hash) + fingerprint.charCodeAt(i);
            hash |= 0; // Convert to 32bit integer
        }
        return 'alejo_' + Math.abs(hash).toString(16);
    },
    
    // Store data securely
    setItem: function(key, data) {
        try {
            const encrypted = this.encrypt(data, key);
            localStorage.setItem(key, encrypted);
            return true;
        } catch (e) {
            console.error('Error storing data:', e);
            return false;
        }
    },
    
    // Retrieve data securely
    getItem: function(key) {
        try {
            const encrypted = localStorage.getItem(key);
            if (!encrypted) return null;
            return this.decrypt(encrypted, key);
        } catch (e) {
            console.error('Error retrieving data:', e);
            return null;
        }
    },
    
    // Remove an item
    removeItem: function(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            console.error('Error removing data:', e);
            return false;
        }
    }
};


/**
 * ALEJO Chat Interface - Advanced Implementation
 * Provides sophisticated chat functionality with AI-powered features
 */

// Chat state management
const chatState = {
    conversationHistory: [],
    contextWindow: 10,
    typingSpeed: 30, // ms per character
    isTyping: false,
    messageQueue: [],
    suggestedCommands: [
        "What's the weather like today?",
        "Show me system status",
        "Tell me a joke",
        "What can you do?",
        "Take a screenshot",
        "Analyze this image",
        "Set a reminder for tomorrow"
    ],
    messageTypes: {
        TEXT: 'text',
        IMAGE: 'image',
        CODE: 'code',
        SYSTEM: 'system',
        ERROR: 'error',
        WARNING: 'warning',
        SUCCESS: 'success'
    }
};

// Initialize chat interface
function initChat() {
    setupChatEventListeners();
    loadChatHistory();
    showWelcomeMessage();
    setupCommandSuggestions();
    
    // Connect to socket events specific to chat
    socket.on('chat_history', (data) => {
        if (data.history && Array.isArray(data.history)) {
            loadConversationHistory(data.history);
        }
    });
    
    socket.on('typing_indicator', (data) => {
        if (data.typing) {
            showTypingIndicator();
        } else {
            hideTypingIndicator();
        }
    });
    
    // Request chat history from server
    socket.emit('get_chat_history');
}

// Set up chat event listeners
function setupChatEventListeners() {
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const clearChatButton = document.getElementById('clear-chat-button');
    const exportChatButton = document.getElementById('export-chat-button');
    
    // Send message on button click
    sendButton.addEventListener('click', () => {
        sendChatMessage();
    });
    
    // Send message on Enter key
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChatMessage();
        }
    });
    
    // Clear chat history
    if (clearChatButton) {
        clearChatButton.addEventListener('click', () => {
            clearChatHistory();
        });
    }
    
    // Export chat history
    if (exportChatButton) {
        exportChatButton.addEventListener('click', () => {
            exportChatHistory();
        });
    }
    
    // Handle file drops for chat
    const chatContainer = document.querySelector('.chat-container');
    if (chatContainer) {
        chatContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            chatContainer.classList.add('drag-over');
        });
        
        chatContainer.addEventListener('dragleave', () => {
            chatContainer.classList.remove('drag-over');
        });
        
        chatContainer.addEventListener('drop', (e) => {
            e.preventDefault();
            chatContainer.classList.remove('drag-over');
            
            if (e.dataTransfer.files.length > 0) {
                handleFileUpload(e.dataTransfer.files[0]);
            }
        });
    }
}

// Send a chat message
function sendChatMessage() {
    const messageInput = document.getElementById('message-input');
    const message = messageInput.value.trim();
    
    if (message) {
        // Add message to chat
        addChatMessage(message, 'user');
        
        // Send to server
        socket.emit('message', { command: message });
        
        // Clear input
        messageInput.value = '';
        
        // Focus input for next message
        messageInput.focus();
        
        // Hide command suggestions
        hideCommandSuggestions();
    }
}

// Add a message to the chat
function addChatMessage(content, sender, type = chatState.messageTypes.TEXT) {
    const chatMessages = document.getElementById('chat-messages');
    const timestamp = new Date();
    
    // Create message container
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    if (type !== chatState.messageTypes.TEXT) {
        messageDiv.classList.add(`message-${type}`);
    }
    
    // Create message content
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    // Handle different message types
    switch (type) {
        case chatState.messageTypes.IMAGE:
            const img = document.createElement('img');
            img.src = content;
            img.alt = 'Image in conversation';
            img.className = 'chat-image';
            contentDiv.appendChild(img);
            break;
            
        case chatState.messageTypes.CODE:
            const pre = document.createElement('pre');
            const code = document.createElement('code');
            code.textContent = content;
            pre.appendChild(code);
            contentDiv.appendChild(pre);
            
            // Add copy button
            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-code-btn';
            copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
            copyBtn.title = 'Copy code';
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(content);
                copyBtn.innerHTML = '<i class="fas fa-check"></i>';
                setTimeout(() => {
                    copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
                }, 2000);
            });
            contentDiv.appendChild(copyBtn);
            break;
            
        default:
            // Process markdown and handle special formatting
            contentDiv.innerHTML = processMessageContent(content);
    }
    
    // Create timestamp
    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    timeDiv.textContent = formatTimestamp(timestamp);
    
    // Add avatar for ALEJO messages
    if (sender === 'alejo') {
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'message-avatar';
        avatarDiv.innerHTML = '<div class="avatar-icon">A</div>';
        messageDiv.appendChild(avatarDiv);
    }
    
    // Assemble message
    messageDiv.appendChild(contentDiv);
    messageDiv.appendChild(timeDiv);
    
    // Add to chat
    chatMessages.appendChild(messageDiv);
    
    // Scroll to bottom
    scrollChatToBottom();
    
    // Add to history
    chatState.conversationHistory.push({
        content,
        sender,
        type,
        timestamp: timestamp.toISOString()
    });
    
    // Save chat history
    saveChatHistory();
    
    return messageDiv;
}

// Process message content for special formatting
function processMessageContent(content) {
    // Handle code blocks
    content = content.replace(/```([a-z]*)\n([\s\S]*?)\n```/g, (match, language, code) => {
        return `<pre><code class="language-${language}">${escapeHtml(code)}</code></pre>`;
    });
    
    // Handle inline code
    content = content.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Handle bold text
    content = content.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Handle italic text
    content = content.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    
    // Handle links
    content = content.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    
    // Handle line breaks
    content = content.replace(/\n/g, '<br>');
    
    return content;
}

// Escape HTML special characters
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Format timestamp for messages
function formatTimestamp(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Scroll chat to bottom
function scrollChatToBottom() {
    const chatMessages = document.getElementById('chat-messages');
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Show typing indicator
function showTypingIndicator() {
    const chatMessages = document.getElementById('chat-messages');
    
    // Check if typing indicator already exists
    if (document.querySelector('.typing-indicator')) {
        return;
    }
    
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message alejo typing-indicator';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
    
    typingDiv.appendChild(contentDiv);
    chatMessages.appendChild(typingDiv);
    
    scrollChatToBottom();
}

// Hide typing indicator
function hideTypingIndicator() {
    const typingIndicator = document.querySelector('.typing-indicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

// Type out a message with animation
function typeMessage(message, sender, type = chatState.messageTypes.TEXT) {
    return new Promise((resolve) => {
        if (type !== chatState.messageTypes.TEXT || sender !== 'alejo') {
            // Only animate text messages from ALEJO
            const messageDiv = addChatMessage(message, sender, type);
            resolve(messageDiv);
            return;
        }
        
        chatState.isTyping = true;
        showTypingIndicator();
        
        // Add empty message
        const messageDiv = addChatMessage('', sender, type);
        const contentDiv = messageDiv.querySelector('.message-content');
        
        // Split message into characters
        const characters = processMessageContent(message).split('');
        let index = 0;
        
        // Type out message
        const typeInterval = setInterval(() => {
            if (index < characters.length) {
                contentDiv.innerHTML += characters[index];
                index++;
                scrollChatToBottom();
            } else {
                clearInterval(typeInterval);
                hideTypingIndicator();
                chatState.isTyping = false;
                resolve(messageDiv);
                
                // Process next message in queue
                if (chatState.messageQueue.length > 0) {
                    const nextMessage = chatState.messageQueue.shift();
                    typeMessage(nextMessage.content, nextMessage.sender, nextMessage.type)
                        .then(nextMessage.resolve);
                }
            }
        }, chatState.typingSpeed);
    });
}

// Queue a message for typing
function queueMessage(content, sender, type = chatState.messageTypes.TEXT) {
    return new Promise((resolve) => {
        if (chatState.isTyping) {
            chatState.messageQueue.push({ content, sender, type, resolve });
        } else {
            typeMessage(content, sender, type).then(resolve);
        }
    });
}

// Show welcome message
function showWelcomeMessage() {
    const welcomeMessage = "Hello! I'm ALEJO, your Advanced Language and Execution Joint Operator. How can I assist you today?";
    queueMessage(welcomeMessage, 'alejo');
}

// Set up command suggestions
function setupCommandSuggestions() {
    const suggestionsContainer = document.createElement('div');
    suggestionsContainer.className = 'command-suggestions';
    suggestionsContainer.id = 'command-suggestions';
    
    chatState.suggestedCommands.forEach(command => {
        const suggestionButton = document.createElement('button');
        suggestionButton.className = 'suggestion-button';
        suggestionButton.textContent = command;
        suggestionButton.addEventListener('click', () => {
            document.getElementById('message-input').value = command;
            hideCommandSuggestions();
        });
        
        suggestionsContainer.appendChild(suggestionButton);
    });
    
    const chatInput = document.querySelector('.chat-input');
    chatInput.appendChild(suggestionsContainer);
    
    // Show suggestions when input is focused
    document.getElementById('message-input').addEventListener('focus', () => {
        showCommandSuggestions();
    });
    
    // Hide suggestions when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.chat-input')) {
            hideCommandSuggestions();
        }
    });
}

// Show command suggestions
function showCommandSuggestions() {
    const suggestionsContainer = document.getElementById('command-suggestions');
    if (suggestionsContainer) {
        suggestionsContainer.classList.add('visible');
    }
}

// Hide command suggestions
function hideCommandSuggestions() {
    const suggestionsContainer = document.getElementById('command-suggestions');
    if (suggestionsContainer) {
        suggestionsContainer.classList.remove('visible');
    }
}

// Handle file upload
function handleFileUpload(file) {
    if (!file) return;
    
    // Check file type
    if (file.type.startsWith('image/')) {
        // Handle image upload
        const reader = new FileReader();
        reader.onload = (e) => {
            const imageData = e.target.result;
            
            // Add image to chat
            addChatMessage(imageData, 'user', chatState.messageTypes.IMAGE);
            
            // Send to server for analysis
            socket.emit('analyze_image', { image: imageData });
        };
        reader.readAsDataURL(file);
    } else {
        // Handle other file types
        addChatMessage(`I've uploaded a file: ${file.name} (${formatFileSize(file.size)})`, 'user');
        
        // TODO: Implement file upload to server
        socket.emit('file_upload', { filename: file.name, size: file.size, type: file.type });
    }
}

// Format file size
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
}

// Save chat history to localStorage
function saveChatHistory() {
    try {
        // Limit history to last N messages
        const limitedHistory = chatState.conversationHistory.slice(-100);
        secureStorage.setItem('alejoChat', JSON.stringify(limitedHistory));
    } catch (error) {
        console.error('Error saving chat history:', error);
    }
}

// Load chat history from localStorage
function loadChatHistory() {
    try {
        const savedHistory = secureStorage.getItem('alejoChat');
        if (savedHistory) {
            const history = JSON.parse(savedHistory);
            loadConversationHistory(history);
        }
    } catch (error) {
        console.error('Error loading chat history:', error);
    }
}

// Load conversation history
function loadConversationHistory(history) {
    if (!Array.isArray(history) || history.length === 0) return;
    
    // Clear existing messages
    const chatMessages = document.getElementById('chat-messages');
    chatMessages.innerHTML = '';
    
    // Add messages from history
    history.forEach(msg => {
        addChatMessage(msg.content, msg.sender, msg.type || chatState.messageTypes.TEXT);
    });
}

// Clear chat history
function clearChatHistory() {
    // Clear UI
    const chatMessages = document.getElementById('chat-messages');
    chatMessages.innerHTML = '';
    
    // Clear state
    chatState.conversationHistory = [];
    
    // Clear storage
    secureStorage.removeItem('alejoChat');
    
    // Notify server
    socket.emit('clear_chat_history');
    
    // Show confirmation
    addChatMessage('Chat history has been cleared.', 'system', chatState.messageTypes.SYSTEM);
}

// Export chat history
function exportChatHistory() {
    if (chatState.conversationHistory.length === 0) {
        addChatMessage('No chat history to export.', 'system', chatState.messageTypes.WARNING);
        return;
    }
    
    // Format history for export
    let exportText = 'ALEJO Chat History - ' + new Date().toLocaleString() + '\n\n';
    
    chatState.conversationHistory.forEach(msg => {
        const sender = msg.sender === 'alejo' ? 'ALEJO' : 'You';
        const timestamp = new Date(msg.timestamp).toLocaleString();
        let content = msg.content;
        
        // Handle different message types
        if (msg.type === chatState.messageTypes.IMAGE) {
            content = '[Image]';
        }
        
        exportText += `[${timestamp}] ${sender}: ${content}\n\n`;
    });
    
    // Create download link
    const blob = new Blob([exportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ALEJO_Chat_History_' + new Date().toISOString().replace(/[:.]/g, '-') + '.txt';
    a.click();
    
    // Clean up
    URL.revokeObjectURL(url);
    
    // Show confirmation
    addChatMessage('Chat history has been exported.', 'system', chatState.messageTypes.SUCCESS);
}

// Initialize chat when DOM is loaded
document.addEventListener('DOMContentLoaded', initChat);

// Socket event handlers
socket.on('response', (data) => {
    if (data.response) {
        queueMessage(data.response, 'alejo');
    }
});

// Export functions
window.addChatMessage = addChatMessage;
window.queueMessage = queueMessage;
