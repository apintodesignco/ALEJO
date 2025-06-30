import speech_recognition as sr
import logging

logger = logging.getLogger(__name__)

class VoiceInput:
    """Handles capturing audio from the microphone and converting it to text."""

    def __init__(self, config=None):
        self.config = config or {}
        self.recognizer = sr.Recognizer()
        mic_idx = self.config.get('mic_device_index')
        try:
            self.microphone = sr.Microphone(device_index=mic_idx) if mic_idx is not None else sr.Microphone()
        except Exception as e:
            logger.error(f"Failed to open microphone (index={mic_idx}): {e}. Falling back to default device.")
            self.microphone = sr.Microphone()
        
        # Adjust for ambient noise once upon initialization
        logger.info("Calibrating microphone for ambient noise...")
        try:
            with self.microphone as source:
                self.recognizer.adjust_for_ambient_noise(source)
            logger.info("Microphone calibration complete.")
        except Exception as e:
            logger.error(f"Could not calibrate microphone: {e}")

    def listen(self):
        """
        Listens for a single phrase from the microphone and returns the recognized text.

        Returns:
            A string containing the recognized text, or an empty string if
            recognition fails or no audio is heard.
        """
        if not isinstance(self.recognizer, sr.Recognizer):
            logger.error("Speech recognizer not initialized.")
            return ""

        try:
            with self.microphone as source:
                logger.debug("Listening for voice command...")
                # Use a 5-second timeout to avoid waiting forever
                audio = self.recognizer.listen(source, timeout=5, phrase_time_limit=10)

            logger.debug("Audio captured, attempting to recognize...")
            text = self.recognizer.recognize_google(audio)
            logger.info(f"Recognized text: '{text}'")
            return text.lower()

        except sr.WaitTimeoutError:
            logger.debug("Listening timed out while waiting for phrase to start")
            return ""
        except sr.UnknownValueError:
            logger.debug("Speech recognition could not understand audio")
            return ""
        except sr.RequestError as e:
            logger.error(f"Could not request results from Google Speech Recognition service; {e}")
            return ""
        except Exception as e:
            logger.error(f"An unexpected error occurred during listening: {e}", exc_info=True)
            return ""
