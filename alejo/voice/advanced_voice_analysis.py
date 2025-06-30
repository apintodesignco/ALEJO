"""
Advanced Voice Analysis Module for ALEJO
Combines multiple state-of-the-art voice analysis technologies
"""

import os
import numpy as np
import torch
import librosa
import soundfile as sf
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from speechbrain.pretrained import EncoderClassifier
from resemblyzer import VoiceEncoder, preprocess_wav
from pyannote.audio import Pipeline
from transformers import Wav2Vec2Processor, Wav2Vec2ForCTC
from ..core.config import Config
from ..utils.logging import get_logger

logger = get_logger(__name__)

class AdvancedVoiceAnalysis:
    """Advanced voice analysis system combining multiple ML models"""
    
    def __init__(self, config: Optional[Config] = None):
        self.config = config or Config()
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        
        # Initialize models
        self._init_models()
        
        # Voice profile storage
        self.voice_profiles_dir = Path(self.config.get('voice_profiles_dir', 'data/voice_profiles'))
        self.voice_profiles_dir.mkdir(parents=True, exist_ok=True)
        self.voice_embeddings_cache = {}
        self._load_voice_profiles()

    def _init_models(self):
        """Initialize all voice analysis models"""
        logger.info("Initializing voice analysis models...")
        
        # SpeechBrain for speaker recognition
        self.speaker_encoder = EncoderClassifier.from_hparams(
            source="speechbrain/spkrec-ecapa-voxceleb",
            savedir="pretrained_models/spkrec-ecapa-voxceleb"
        )
        
        # Resemblyzer for voice similarity
        self.voice_encoder = VoiceEncoder(device=self.device)
        
        # Wav2Vec2 for speech recognition
        self.wav2vec_processor = Wav2Vec2Processor.from_pretrained("facebook/wav2vec2-large-960h")
        self.wav2vec_model = Wav2Vec2ForCTC.from_pretrained("facebook/wav2vec2-large-960h").to(self.device)
        
        # Pyannote for speaker diarization
        self.diarization = Pipeline.from_pretrained("pyannote/speaker-diarization")
        
        logger.info("All voice analysis models initialized successfully")

    def _load_voice_profiles(self):
        """Load known voice profiles from disk"""
        for profile_dir in self.voice_profiles_dir.iterdir():
            if profile_dir.is_dir():
                identity = profile_dir.name
                embeddings = []
                for audio_path in profile_dir.glob('*.wav'):
                    try:
                        wav = self._load_and_preprocess_audio(str(audio_path))
                        embedding = self.get_voice_embedding(wav)
                        if embedding is not None:
                            embeddings.append(embedding)
                    except Exception as e:
                        logger.error(f"Error loading voice profile for {audio_path}: {e}")
                if embeddings:
                    self.voice_embeddings_cache[identity] = np.mean(embeddings, axis=0)

    def _load_and_preprocess_audio(self, audio_path: str) -> np.ndarray:
        """Load and preprocess audio file"""
        wav, sr = librosa.load(audio_path, sr=16000)
        return wav

    def get_voice_embedding(self, wav: np.ndarray) -> np.ndarray:
        """Get voice embedding using multiple models"""
        # Get embeddings from different models
        speechbrain_emb = self.speaker_encoder.encode_batch(torch.tensor(wav).unsqueeze(0))
        resemblyzer_emb = self.voice_encoder.embed_utterance(preprocess_wav(wav))
        
        # Combine embeddings (simple concatenation, could be more sophisticated)
        combined_embedding = np.concatenate([
            speechbrain_emb.squeeze().cpu().numpy(),
            resemblyzer_emb
        ])
        
        return combined_embedding

    def analyze_voice(self, wav: np.ndarray) -> Dict:
        """Comprehensive voice analysis"""
        # Get voice characteristics
        f0, voiced_flag, voiced_probs = librosa.pyin(
            wav,
            fmin=librosa.note_to_hz('C2'),
            fmax=librosa.note_to_hz('C7')
        )
        
        # Get spectral features
        mfccs = librosa.feature.mfcc(y=wav, sr=16000, n_mfcc=13)
        spectral_centroid = librosa.feature.spectral_centroid(y=wav, sr=16000)
        spectral_bandwidth = librosa.feature.spectral_bandwidth(y=wav, sr=16000)
        
        # Get rhythm features
        tempo, _ = librosa.beat.beat_track(y=wav, sr=16000)
        
        # Get voice embedding and attempt identification
        embedding = self.get_voice_embedding(wav)
        identity = self._identify_voice(embedding) if embedding is not None else None
        
        # Transcribe speech
        inputs = self.wav2vec_processor(wav, sampling_rate=16000, return_tensors="pt")
        with torch.no_grad():
            logits = self.wav2vec_model(inputs.input_values.to(self.device)).logits
        predicted_ids = torch.argmax(logits, dim=-1)
        transcription = self.wav2vec_processor.batch_decode(predicted_ids)[0]
        
        return {
            'pitch_stats': {
                'mean': float(np.mean(f0[voiced_flag])) if any(voiced_flag) else 0,
                'std': float(np.std(f0[voiced_flag])) if any(voiced_flag) else 0,
                'min': float(np.min(f0[voiced_flag])) if any(voiced_flag) else 0,
                'max': float(np.max(f0[voiced_flag])) if any(voiced_flag) else 0
            },
            'spectral_features': {
                'mfcc_mean': mfccs.mean(axis=1).tolist(),
                'centroid_mean': float(spectral_centroid.mean()),
                'bandwidth_mean': float(spectral_bandwidth.mean())
            },
            'rhythm': {
                'tempo': float(tempo)
            },
            'voice_characteristics': {
                'identity': identity,
                'embedding': embedding.tolist() if embedding is not None else None
            },
            'transcription': transcription
        }

    def _identify_voice(self, voice_embedding: np.ndarray) -> Optional[str]:
        """Identify a voice by comparing with known profiles"""
        if not self.voice_embeddings_cache:
            return None
            
        min_distance = float('inf')
        best_match = None
        
        for identity, known_embedding in self.voice_embeddings_cache.items():
            distance = np.linalg.norm(voice_embedding - known_embedding)
            if distance < min_distance and distance < 0.6:  # Threshold for voice similarity
                min_distance = distance
                best_match = identity
                
        return best_match

    def add_voice_profile(self, identity: str, wav: np.ndarray) -> bool:
        """Add a new voice profile to the database"""
        embedding = self.get_voice_embedding(wav)
        if embedding is None:
            return False
            
        identity_dir = self.voice_profiles_dir / identity
        identity_dir.mkdir(exist_ok=True)
        
        # Save audio sample
        timestamp = int(time.time())
        audio_path = identity_dir / f"{timestamp}.wav"
        sf.write(str(audio_path), wav, 16000)
        
        # Update cache
        if identity in self.voice_embeddings_cache:
            existing_embedding = self.voice_embeddings_cache[identity]
            self.voice_embeddings_cache[identity] = (existing_embedding + embedding) / 2
        else:
            self.voice_embeddings_cache[identity] = embedding
            
        return True

    def analyze_emotional_tone(self, wav: np.ndarray) -> Dict:
        """Analyze emotional characteristics of voice"""
        # Extract prosodic features
        f0, voiced_flag, voiced_probs = librosa.pyin(wav, fmin=75, fmax=600)
        rmse = librosa.feature.rms(y=wav)[0]
        
        # Compute speaking rate
        mfccs = librosa.feature.mfcc(y=wav, sr=16000, n_mfcc=13)
        delta_mfcc = librosa.feature.delta(mfccs)
        delta2_mfcc = librosa.feature.delta(mfccs, order=2)
        
        # Analyze voice quality
        spec_cent = librosa.feature.spectral_centroid(y=wav, sr=16000)[0]
        spec_bw = librosa.feature.spectral_bandwidth(y=wav, sr=16000)[0]
        
        return {
            'pitch_variation': float(np.std(f0[voiced_flag])) if any(voiced_flag) else 0,
            'volume_variation': float(np.std(rmse)),
            'speaking_rate': float(np.mean(np.abs(delta_mfcc))),
            'articulation_precision': float(np.mean(np.abs(delta2_mfcc))),
            'voice_quality': {
                'brightness': float(np.mean(spec_cent)),
                'spread': float(np.mean(spec_bw))
            }
        }

    def detect_speech_segments(self, wav: np.ndarray) -> List[Dict]:
        """Detect and analyze speech segments"""
        diarization = self.diarization({"waveform": torch.tensor(wav).unsqueeze(0), "sample_rate": 16000})
        
        segments = []
        for turn, _, speaker in diarization.itertracks(yield_label=True):
            segment_wav = wav[int(turn.start * 16000):int(turn.end * 16000)]
            if len(segment_wav) > 0:
                analysis = self.analyze_voice(segment_wav)
                segments.append({
                    'start': float(turn.start),
                    'end': float(turn.end),
                    'speaker': speaker,
                    'analysis': analysis
                })
        
        return segments

    def cleanup(self):
        """Cleanup resources"""
        # Release any resources if needed
        pass
