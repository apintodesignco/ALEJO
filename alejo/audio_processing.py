import pyaudio
import logging

# Setup logging
logger = logging.getLogger(__name__)

class AudioProcessor:
    """A class to handle audio streaming from the microphone using PyAudio."""
    
    # Using Porcupine's recommended sample rate. VAD and ASR should also use this.
    RATE = 16000 
    # Porcupine processes audio in frames of 512 samples.
    CHUNK_SIZE = 512 
    FORMAT = pyaudio.paInt16
    CHANNELS = 1

    def __init__(self):
        self._pyaudio_instance = None
        self.stream = None
        self.is_listening = False
        logger.info("AudioProcessor initialized.")

    def start_listening(self):
        """Opens the microphone stream and yields raw audio frames."""
        if self.is_listening:
            logger.warning("AudioProcessor is already listening.")
            return

        self._pyaudio_instance = pyaudio.PyAudio()
        try:
            self.stream = self._pyaudio_instance.open(
                format=self.FORMAT,
                channels=self.CHANNELS,
                rate=self.RATE,
                input=True,
                frames_per_buffer=self.CHUNK_SIZE
            )
            logger.info("Microphone stream opened successfully.")
        except Exception as e:
            logger.error(f"Failed to open microphone stream: {e}")
            self.stop_listening() # Clean up
            return # Stop execution if stream fails

        self.is_listening = True
        logger.info("Yielding raw audio frames...")
        
        while self.is_listening:
            try:
                frame = self.stream.read(self.CHUNK_SIZE, exception_on_overflow=False)
                yield frame
            except IOError as e:
                if e.errno == pyaudio.paInputOverflowed:
                    logger.warning("Input overflowed, dropping frame.")
                else:
                    logger.error(f"Stream read error: {e}")
                    self.is_listening = False # Stop on other IOErrors
            except Exception as e:
                logger.error(f"An unexpected error occurred in listening loop: {e}")
                self.is_listening = False

        # Cleanup after the loop finishes
        self.stop_listening()

    def stop_listening(self):
        """Stops the audio stream and terminates the PyAudio instance."""
        if not self.is_listening and self.stream is None and self._pyaudio_instance is None:
            return # Already stopped

        self.is_listening = False
        if self.stream:
            try:
                if self.stream.is_active():
                    self.stream.stop_stream()
                self.stream.close()
                logger.info("Microphone stream stopped and closed.")
            except Exception as e:
                logger.error(f"Error closing stream: {e}")
            finally:
                self.stream = None
        
        if self._pyaudio_instance:
            try:
                self._pyaudio_instance.terminate()
                logger.info("PyAudio instance terminated.")
            except Exception as e:
                logger.error(f"Error terminating PyAudio: {e}")
            finally:
                self._pyaudio_instance = None

    def terminate_pyaudio(self):
        """Public method to ensure cleanup is performed. Alias for stop_listening."""
        self.stop_listening()
