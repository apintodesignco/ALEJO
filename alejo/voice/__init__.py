"""
ALEJO Voice Module
Provides voice interaction capabilities for ALEJO
"""

import logging
import threading
from .voice_input import VoiceInput
from .voice_output import VoiceOutput
from .device_utils import list_audio_devices, choose_device

__all__ = ['VoiceManager', 'VoiceService', 'start_voice_service']

logger = logging.getLogger("alejo.voice")

class VoiceManager:
    """
    Voice interaction manager for ALEJO
    
    This class provides voice recognition and synthesis capabilities
    for ALEJO's voice interaction features.
    """
    
    def __init__(self, config=None):
        """
        Initialize the voice manager
        
        Args:
            config: Optional configuration dictionary
        """
        self.config = config or {}
        # Detect and, if needed, prompt for audio devices exactly once
        devices = list_audio_devices()
        mic_idx = self.config.get('mic_device_index')
        spk_idx = self.config.get('speaker_device_index')
        if devices:
            if mic_idx is None:
                sel = choose_device(devices, want_input=True)
                mic_idx = sel.index if sel else None
            if spk_idx is None:
                sel_out = choose_device(devices, want_input=False)
                spk_idx = sel_out.index if sel_out else None
        if mic_idx is not None:
            self.config['mic_device_index'] = mic_idx
        if spk_idx is not None:
            self.config['speaker_device_index'] = spk_idx

        self.voice_input = VoiceInput(self.config)
        self.voice_output = VoiceOutput(self.config)
        self.is_listening = False
        self._listen_thread = None
        self._stop_listening = threading.Event()
        self.initialized = True
        logger.info("Voice manager initialized")
        
    def recognize_speech(self, audio_data=None):
        """
        Recognize speech from audio data
        
        Args:
            audio_data: Audio data to recognize. If None, will listen for input.
            
        Returns:
            Recognized text
        """
        if not self.initialized:
            logger.error("Voice manager not initialized")
            return ""
            
        try:
            if audio_data is None:
                # Use voice_input to listen and recognize
                return self.voice_input.listen()
            else:
                # TODO: Implement handling of pre-recorded audio data
                logger.warning("Processing pre-recorded audio not yet implemented")
                return ""
        except Exception as e:
            logger.error(f"Error recognizing speech: {e}")
            return ""
        
    def synthesize_speech(self, text):
        """
        Synthesize speech from text
        
        Args:
            text: Text to synthesize
            
        Returns:
            True if synthesis and playback were successful
        """
        if not self.initialized:
            logger.error("Voice manager not initialized")
            return False
            
        try:
            return self.voice_output.speak(text)
        except Exception as e:
            logger.error(f"Error synthesizing speech: {e}")
            return False
        
    def start_listening(self):
        """
        Start listening for voice commands in a separate thread
        
        Returns:
            True if listening started successfully
        """
        if not self.initialized:
            logger.error("Voice manager not initialized")
            return False
            
        if self.is_listening:
            logger.warning("Already listening")
            return True
            
        try:
            self._stop_listening.clear()
            self._listen_thread = threading.Thread(
                target=self._continuous_listen,
                daemon=True
            )
            self._listen_thread.start()
            self.is_listening = True
            logger.info("Started listening for voice commands")
            return True
        except Exception as e:
            logger.error(f"Error starting voice listening: {e}")
            return False
            
    def _continuous_listen(self):
        """Background thread function for continuous listening"""
        while not self._stop_listening.is_set():
            try:
                text = self.recognize_speech()
                if text:
                    # TODO: Process recognized text through command pipeline
                    logger.info(f"Recognized: {text}")
            except Exception as e:
                logger.error(f"Error in continuous listening: {e}")
                # Brief pause before retrying
                self._stop_listening.wait(1)
        
    def stop_listening(self):
        """
        Stop listening for voice commands
        
        Returns:
            True if listening stopped successfully
        """
        if not self.is_listening:
            logger.warning("Not currently listening")
            return True
            
        try:
            self._stop_listening.set()
            if self._listen_thread:
                self._listen_thread.join(timeout=5)
                if self._listen_thread.is_alive():
                    logger.warning("Listen thread did not stop gracefully")
                    
            self.is_listening = False
            logger.info("Stopped listening for voice commands")
            return True
        except Exception as e:
            logger.error(f"Error stopping voice listening: {e}")
            return False
        
        
class VoiceService:
    """
    Voice service for ALEJO. Handles wake word listening, command processing,
    and text-to-speech response.
    """
    
    def __init__(self, brain, config=None, event_bus=None):
        """
        Initialize the voice service.
        
        Args:
            brain: The ALEJOBrain instance for command processing.
            config: Optional configuration dictionary.
            event_bus: Optional event bus for inter-service communication.
        """
        self.brain = brain
        self.config = config or {}
        self.event_bus = event_bus
        self.voice_manager = VoiceManager(config)
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
        self._stop_event = threading.Event()
        self._listen_thread = None
        self.is_listening = False
        logger.info("Voice service initialized")
        
    def start(self):
        """
        Start the voice service.
        
        Returns:
            True if service started successfully.
        """
        if self.is_listening:
            logger.warning("Voice service already running")
            return True
            
        try:
            self._stop_event.clear()
            self._listen_thread = threading.Thread(
                target=self._process_voice_commands,
                daemon=True
            )
            self._listen_thread.start()
            self.is_listening = True
            logger.info("Voice service started")
            return True
        except Exception as e:
            logger.error(f"Error starting voice service: {e}")
            return False
            
    def stop(self):
        """
        Stop the voice service.
        
        Returns:
            True if service stopped successfully.
        """
        if not self.is_listening:
            logger.warning("Voice service not running")
            return True
            
        try:
            self._stop_event.set()
            if self._listen_thread:
                self._listen_thread.join(timeout=5)
                if self._listen_thread.is_alive():
                    logger.warning("Voice service thread did not stop gracefully")
            
            # Ensure voice manager stops listening
            self.voice_manager.stop_listening()
            self.is_listening = False
            logger.info("Voice service stopped")
            return True
        except Exception as e:
            logger.error(f"Error stopping voice service: {e}")
            return False
            
    def _process_voice_commands(self):
        """
        Main loop for processing voice commands.
        Handles wake word detection, command recognition, and response generation.
        """
        while not self._stop_event.is_set():
            try:
                # Start listening for commands
                if not self.voice_manager.start_listening():
                    logger.error("Failed to start voice manager listening")
                    break
                    
                # Process recognized text
                text = self.voice_manager.recognize_speech()
                if text:
                    # Process command through ALEJO brain
                    response = self.brain.process_command(text)
                    
                    # Synthesize and speak response
                    if response:
                        self.voice_manager.synthesize_speech(response)
                        
            except Exception as e:
                logger.error(f"Error in voice command processing: {e}")
                # Brief pause before retrying
                self._stop_event.wait(1)
                
            finally:
                # Always stop listening between commands
                self.voice_manager.stop_listening()

    def _listen_loop(self):
        """The main loop for listening for the wake word and commands."""
        wake_word = self.config.get('wake_word', 'alejo').lower()
        logger.info(f"Listening for wake word: '{wake_word}'")

        while self.is_listening:
            try:
                text = self.voice_input.listen().lower()
                if text and wake_word in text:
                    logger.info(f"Wake word '{wake_word}' detected in phrase: '{text}'")
                    
                    # Extract the command from the phrase
                    command = text.replace(wake_word, '', 1).strip()
                    
                    if command:
                        logger.info(f"Command received: '{command}'")
                        response = self.brain.process_command(command)
                        if response:
                            self.speak(response)
                    else:
                        # If only the wake word was said
                        logger.info("Only wake word heard. Prompting user.")
                        self.speak("Yes?")

            except Exception as e:
                logger.error(f"An error occurred in the listen loop: {e}", exc_info=True)

    def start_service(self):
        """Starts the voice listening loop in a background thread."""
        if self.is_listening:
            logger.warning("Voice service is already running.")
            return True
            
        self.is_listening = True
        self._listen_thread = threading.Thread(target=self._listen_loop, daemon=True)
        self._listen_thread.start()
        logger.info("Voice listening thread started.")
        return True
        
    def stop_service(self):
        """Stops the voice listening loop."""
        if not self.is_listening:
            logger.warning("Voice service is not running.")
            return True
            
        self.is_listening = False
        if self._listen_thread and self._listen_thread.is_alive():
            # The loop will exit on its own since is_listening is False
            self._listen_thread.join(timeout=2)
        logger.info("Voice service stopped.")
        return True
        
    def speak(self, text):
        """Synthesizes and speaks the given text."""
        try:
            return self.voice_output.speak(text)
        except Exception as e:
            logger.error(f"Error in speak function: {e}", exc_info=True)
            return False


def start_voice_service(brain, config=None, event_bus=None, test_mode=False):
    """
    Initialize and start the ALEJO voice service.
    
    Args:
        brain: The ALEJOBrain instance.
        config: Optional configuration dictionary.
        test_mode: If True, initialize without starting actual voice services.
        
    Returns:
        VoiceService instance if started successfully, None otherwise.
    """
    try:
        service = VoiceService(brain, config, event_bus=event_bus)
        if not test_mode:
            if not service.start():
                logger.error("Failed to start voice service")
                return None
        return service
    except Exception as e:
        logger.error(f"Failed to start voice service: {e}")
        return None
