"""
ALEJO Voice Output Module
Provides voice synthesis capabilities for ALEJO
"""

import logging
import os
import sys
import tempfile
from pathlib import Path

# Try to import required packages
try:
    import pyttsx3
    PYTTSX3_AVAILABLE = True
except ImportError:
    PYTTSX3_AVAILABLE = False

logger = logging.getLogger("alejo.voice.output")

class VoiceOutput:
    """
    Voice output for ALEJO
    
    This class provides voice synthesis capabilities for ALEJO.
    """
    
    # Dictionary of words with their phonetic pronunciations
    PRONUNCIATION_DICT = {
        "ALEJO": "Ah-lay-ho",
        "Alejo": "Ah-lay-ho",
        "alejo": "Ah-lay-ho"
    }
    
    def __init__(self, config=None, event_bus=None):
        """
        Initialize the voice output
        
        Args:
            config: Optional configuration dictionary
        """
        self.config = config or {}
        self.event_bus = event_bus
        self.initialized = False
        self.engine = None
        
        # Subscribe to proactive prompts if event bus is available
        if self.event_bus:
            import asyncio
            asyncio.create_task(self._subscribe_to_prompts())
            
    async def _subscribe_to_prompts(self):
        """Subscribe to proactive prompt events"""
        from ..core.event_bus import EventType
        await self.event_bus.subscribe(EventType.PROACTIVE_PROMPT, self._handle_proactive_prompt)
        
    def _handle_proactive_prompt(self, event):
        """Handle incoming proactive prompt events"""
        self.speak(event.data['text'])
        
        # Initialize the voice engine
        self._initialize_engine()
        
    def _initialize_engine(self):
        """Initialize the voice synthesis engine"""
        if not PYTTSX3_AVAILABLE:
            logger.warning("pyttsx3 not available, voice output will be disabled")
            return
        
        try:
            self.engine = pyttsx3.init()
            
            # Configure voice properties
            rate = self.config.get('rate', 150)
            volume = self.config.get('volume', 1.0)
            voice_id = self.config.get('voice_id', None)
            
            self.engine.setProperty('rate', rate)
            self.engine.setProperty('volume', volume)
            
            # Set voice if specified
            if voice_id:
                self.engine.setProperty('voice', voice_id)
            
            self.initialized = True
            logger.info("Voice output initialized")
        except Exception as e:
            logger.error(f"Error initializing voice output: {e}")
            
    def speak(self, text):
        """
        Speak the given text
        
        Args:
            text: Text to speak
            
        Returns:
            True if speech was successful
        """
        if not self.initialized or not self.engine:
            logger.warning("Voice output not initialized, cannot speak")
            return False
        
        try:
            # Apply pronunciation dictionary
            modified_text = self._apply_pronunciation(text)
            
            self.engine.say(modified_text)
            self.engine.runAndWait()
            return True
        except Exception as e:
            logger.error(f"Error speaking: {e}")
            return False
            
    def _apply_pronunciation(self, text):
        """
        Apply pronunciation dictionary to text
        
        Args:
            text: Text to modify
            
        Returns:
            Modified text with pronunciation adjustments
        """
        modified_text = text
        
        # Replace words with their phonetic pronunciations
        for word, pronunciation in self.PRONUNCIATION_DICT.items():
            modified_text = modified_text.replace(word, pronunciation)
            
        return modified_text
            
    def get_available_voices(self):
        """
        Get available voices
        
        Returns:
            List of available voices
        """
        if not self.initialized or not self.engine:
            logger.warning("Voice output not initialized, cannot get voices")
            return []
        
        try:
            voices = self.engine.getProperty('voices')
            return [{'id': voice.id, 'name': voice.name} for voice in voices]
        except Exception as e:
            logger.error(f"Error getting voices: {e}")
            return []
