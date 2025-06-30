"""
Voice training module for ALEJO
Allows training and customization of ALEJO's voice characteristics
"""

import os
import json
import logging
import sounddevice as sd
import numpy as np
import librosa
from pathlib import Path
from scipy.io import wavfile
from ..voice.voice_output import VoiceOutput
from ..core.config import Config

logger = logging.getLogger(__name__)

class VoiceTrainer:
    """Handles voice training and customization for ALEJO"""
    
    def __init__(self, config=None):
        """Initialize voice trainer"""
        self.config = config or Config()
        self.voice_samples_dir = Path(self.config.get('voice_samples_dir', 'data/voice_samples'))
        self.voice_profile_path = self.voice_samples_dir / 'voice_profile.json'
        self.voice_samples_dir.mkdir(parents=True, exist_ok=True)
        self.voice_profile = self._load_voice_profile()
        self.sample_rate = 44100
        self.channels = 1
        self.duration = 5  # seconds per recording

    def _load_voice_profile(self):
        """Load existing voice profile or create new one"""
        if self.voice_profile_path.exists():
            try:
                with open(self.voice_profile_path, 'r') as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Error loading voice profile: {e}")
                return self._create_default_profile()
        return self._create_default_profile()

    def _create_default_profile(self):
        """Create default voice profile"""
        return {
            'pitch': 1.0,
            'speed': 1.0,
            'volume': 1.0,
            'samples': [],
            'characteristics': {
                'pitch_range': [],
                'formants': [],
                'rhythm_patterns': []
            }
        }

    def record_voice_sample(self):
        """Record a voice sample from the user"""
        logger.info("Recording voice sample... Speak naturally.")
        
        # Record audio
        recording = sd.rec(
            int(self.duration * self.sample_rate),
            samplerate=self.sample_rate,
            channels=self.channels,
            dtype=np.float32
        )
        sd.wait()

        # Generate filename and save
        sample_path = self.voice_samples_dir / f"sample_{len(self.voice_profile['samples'])}.wav"
        wavfile.write(sample_path, self.sample_rate, recording)
        
        # Extract characteristics
        characteristics = self._analyze_sample(recording)
        
        # Update profile
        self.voice_profile['samples'].append(str(sample_path))
        self._update_profile_characteristics(characteristics)
        self._save_profile()

        return str(sample_path)

    def _analyze_sample(self, audio_data):
        """Analyze voice characteristics from sample"""
        # Extract pitch
        pitches, magnitudes = librosa.piptrack(
            y=audio_data.flatten(),
            sr=self.sample_rate
        )
        
        # Extract formants using librosa's MFCC
        mfccs = librosa.feature.mfcc(
            y=audio_data.flatten(),
            sr=self.sample_rate,
            n_mfcc=13
        )
        
        # Extract rhythm using onset detection
        onset_env = librosa.onset.onset_strength(
            y=audio_data.flatten(),
            sr=self.sample_rate
        )
        
        return {
            'pitch_range': [float(pitches.min()), float(pitches.max())],
            'formants': mfccs.mean(axis=1).tolist(),
            'rhythm_patterns': onset_env.tolist()
        }

    def _update_profile_characteristics(self, new_chars):
        """Update voice profile with new characteristics"""
        profile = self.voice_profile['characteristics']
        
        # Update pitch range
        if not profile['pitch_range']:
            profile['pitch_range'] = new_chars['pitch_range']
        else:
            profile['pitch_range'] = [
                min(profile['pitch_range'][0], new_chars['pitch_range'][0]),
                max(profile['pitch_range'][1], new_chars['pitch_range'][1])
            ]
        
        # Update formants (running average)
        if not profile['formants']:
            profile['formants'] = new_chars['formants']
        else:
            profile['formants'] = [
                (old * 0.7 + new * 0.3)
                for old, new in zip(profile['formants'], new_chars['formants'])
            ]
        
        # Update rhythm patterns
        profile['rhythm_patterns'].extend(new_chars['rhythm_patterns'])
        if len(profile['rhythm_patterns']) > 1000:  # Limit storage
            profile['rhythm_patterns'] = profile['rhythm_patterns'][-1000:]

    def _save_profile(self):
        """Save voice profile to disk"""
        try:
            with open(self.voice_profile_path, 'w') as f:
                json.dump(self.voice_profile, f, indent=2)
            logger.info("Voice profile saved successfully")
        except Exception as e:
            logger.error(f"Error saving voice profile: {e}")

    def apply_profile_to_voice(self, voice_output: VoiceOutput):
        """Apply trained voice profile to voice output"""
        if not isinstance(voice_output, VoiceOutput):
            raise TypeError("Expected VoiceOutput instance")
            
        # Apply voice characteristics
        voice_output.set_pitch(self.voice_profile['pitch'])
        voice_output.set_speed(self.voice_profile['speed'])
        voice_output.set_volume(self.voice_profile['volume'])
        
        # Apply more sophisticated characteristics if supported by the TTS engine
        if hasattr(voice_output, 'set_voice_characteristics'):
            voice_output.set_voice_characteristics(
                pitch_range=self.voice_profile['characteristics']['pitch_range'],
                formants=self.voice_profile['characteristics']['formants'],
                rhythm_patterns=self.voice_profile['characteristics']['rhythm_patterns']
            )

    def start_training_session(self, num_samples=5):
        """Start an interactive voice training session"""
        logger.info(f"Starting voice training session. Will record {num_samples} samples.")
        
        for i in range(num_samples):
            input(f"\nPress Enter to record sample {i+1}/{num_samples}...")
            sample_path = self.record_voice_sample()
            logger.info(f"Recorded sample: {sample_path}")
            
        logger.info("Training session complete. Voice profile updated.")
