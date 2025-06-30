"""
Audio Engine for Gesture Arpeggiator

This module implements the audio generation engine for ALEJO's gesture-based
arpeggiator system, providing real-time synthesis of arpeggios and drum patterns
based on hand gesture controls.
"""

import logging
import asyncio
import json
import math
import time
from typing import Dict, List, Optional, Any, Union, Tuple
from enum import Enum
import numpy as np

logger = logging.getLogger(__name__)

class Scale(Enum):
    """Musical scales for the arpeggiator"""
    MAJOR = "major"
    MINOR = "minor"
    PENTATONIC = "pentatonic"
    BLUES = "blues"
    CHROMATIC = "chromatic"
    DORIAN = "dorian"
    PHRYGIAN = "phrygian"
    LYDIAN = "lydian"
    MIXOLYDIAN = "mixolydian"
    LOCRIAN = "locrian"

class ArpeggioPattern(Enum):
    """Arpeggio patterns"""
    UP = "up"
    DOWN = "down"
    UP_DOWN = "updown"
    DOWN_UP = "downup"
    RANDOM = "random"
    CONVERGE = "converge"
    DIVERGE = "diverge"
    PINKY_TO_THUMB = "pinky_to_thumb"

class AudioEngine:
    """
    Audio generation engine for the Gesture Arpeggiator
    
    This class handles the generation of musical notes and rhythms based on
    hand gesture controls, providing real-time synthesis for the arpeggiator
    and drum machine.
    """
    
    def __init__(self):
        """Initialize the audio engine"""
        self._active = False
        self._bpm = 120
        self._current_beat = 0
        self._beat_interval = 60.0 / self._bpm / 4  # 16th note interval
        self._last_beat_time = 0
        
        # Musical parameters
        self._root_note = 60  # Middle C in MIDI
        self._scale_type = Scale.MAJOR
        self._octave_range = 2
        self._arpeggio_pattern = ArpeggioPattern.UP
        self._arpeggio_notes = []
        self._current_arpeggio_step = 0
        
        # Drum parameters
        self._drum_pattern_id = 0
        self._drum_patterns = self._initialize_drum_patterns()
        self._current_drum_hits = {"kick": False, "snare": False, "hihat": False, "tom": False}
        
        # Volume controls
        self._master_volume = 0.8
        self._arpeggio_volume = 0.8
        self._drum_volume = 0.8
        
        # Audio generation state
        self._audio_buffer = np.zeros(1024, dtype=np.float32)
        self._sample_rate = 44100
        
        # Scale definitions (semitone intervals from root)
        self._scales = {
            Scale.MAJOR: [0, 2, 4, 5, 7, 9, 11],
            Scale.MINOR: [0, 2, 3, 5, 7, 8, 10],
            Scale.PENTATONIC: [0, 2, 4, 7, 9],
            Scale.BLUES: [0, 3, 5, 6, 7, 10],
            Scale.CHROMATIC: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
            Scale.DORIAN: [0, 2, 3, 5, 7, 9, 10],
            Scale.PHRYGIAN: [0, 1, 3, 5, 7, 8, 10],
            Scale.LYDIAN: [0, 2, 4, 6, 7, 9, 11],
            Scale.MIXOLYDIAN: [0, 2, 4, 5, 7, 9, 10],
            Scale.LOCRIAN: [0, 1, 3, 5, 6, 8, 10]
        }
        
        # Initialize arpeggio notes
        self._update_arpeggio_notes()
        
    def _initialize_drum_patterns(self) -> List[Dict]:
        """Initialize predefined drum patterns"""
        return [
            {
                "name": "Four on the floor",
                "kick": [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
                "snare": [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
                "hihat": [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                "tom": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]
            },
            {
                "name": "Hip Hop",
                "kick": [1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0],
                "snare": [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
                "hihat": [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
                "tom": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]
            },
            {
                "name": "Breakbeat",
                "kick": [1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
                "snare": [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0],
                "hihat": [1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1],
                "tom": [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]
            },
            {
                "name": "Techno",
                "kick": [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0],
                "snare": [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
                "hihat": [0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1],
                "tom": [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0]
            },
            {
                "name": "Jazz",
                "kick": [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0],
                "snare": [0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0],
                "hihat": [1, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
                "tom": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]
            }
        ]
        
    def start(self):
        """Start the audio engine"""
        if not self._active:
            self._active = True
            self._last_beat_time = time.time()
            logger.info("Audio engine started")
            
    def stop(self):
        """Stop the audio engine"""
        if self._active:
            self._active = False
            logger.info("Audio engine stopped")
            
    def is_active(self) -> bool:
        """Check if the audio engine is active"""
        return self._active
        
    def update(self) -> Dict:
        """
        Update the audio engine state
        
        Returns:
            Dictionary with current audio state
        """
        if not self._active:
            return self._get_audio_state()
            
        current_time = time.time()
        elapsed = current_time - self._last_beat_time
        
        # Check if it's time for the next beat
        if elapsed >= self._beat_interval:
            # Calculate how many beats have passed (in case of lag)
            beats_passed = int(elapsed / self._beat_interval)
            self._current_beat = (self._current_beat + beats_passed) % 16
            self._last_beat_time = current_time
            
            # Update arpeggio step
            self._update_arpeggio_step()
            
            # Update drum hits
            self._update_drum_hits()
            
            # Generate audio for this beat
            self._generate_audio()
            
        return self._get_audio_state()
        
    def _update_arpeggio_step(self):
        """Update the current arpeggio step based on pattern"""
        if not self._arpeggio_notes:
            return
            
        pattern = self._arpeggio_pattern
        num_notes = len(self._arpeggio_notes)
        
        if pattern == ArpeggioPattern.UP:
            self._current_arpeggio_step = (self._current_arpeggio_step + 1) % num_notes
        elif pattern == ArpeggioPattern.DOWN:
            self._current_arpeggio_step = (self._current_arpeggio_step - 1) % num_notes
        elif pattern == ArpeggioPattern.UP_DOWN:
            # Up and down pattern
            cycle_length = 2 * num_notes - 2
            step = (self._current_beat % cycle_length)
            if step < num_notes:
                self._current_arpeggio_step = step
            else:
                self._current_arpeggio_step = 2 * num_notes - 2 - step
        elif pattern == ArpeggioPattern.RANDOM:
            import random
            self._current_arpeggio_step = random.randint(0, num_notes - 1)
        elif pattern == ArpeggioPattern.CONVERGE:
            # Notes converge from outside to center
            half = num_notes // 2
            if self._current_beat % 2 == 0:
                self._current_arpeggio_step = half - (self._current_beat // 2) % half
            else:
                self._current_arpeggio_step = half + ((self._current_beat + 1) // 2) % half
        elif pattern == ArpeggioPattern.DIVERGE:
            # Notes diverge from center to outside
            half = num_notes // 2
            if self._current_beat % 2 == 0:
                self._current_arpeggio_step = half + (self._current_beat // 2) % half
            else:
                self._current_arpeggio_step = half - ((self._current_beat + 1) // 2) % half
                
    def _update_drum_hits(self):
        """Update drum hits based on current beat and pattern"""
        if self._drum_pattern_id >= len(self._drum_patterns):
            self._drum_pattern_id = 0
            
        pattern = self._drum_patterns[self._drum_pattern_id]
        beat_idx = self._current_beat % 16
        
        self._current_drum_hits = {
            "kick": pattern["kick"][beat_idx] == 1,
            "snare": pattern["snare"][beat_idx] == 1,
            "hihat": pattern["hihat"][beat_idx] == 1,
            "tom": pattern["tom"][beat_idx] == 1
        }
        
    def _generate_audio(self):
        """Generate audio for the current beat"""
        # In a real implementation, this would generate actual audio samples
        # For now, we'll just update the state
        pass
        
    def _get_audio_state(self) -> Dict:
        """
        Get the current audio state
        
        Returns:
            Dictionary with current audio parameters
        """
        current_note = None
        if self._arpeggio_notes and 0 <= self._current_arpeggio_step < len(self._arpeggio_notes):
            current_note = self._arpeggio_notes[self._current_arpeggio_step]
            
        return {
            "active": self._active,
            "bpm": self._bpm,
            "current_beat": self._current_beat,
            "current_note": current_note,
            "drum_hits": self._current_drum_hits,
            "master_volume": self._master_volume,
            "arpeggio_volume": self._arpeggio_volume,
            "drum_volume": self._drum_volume
        }
        
    def _update_arpeggio_notes(self):
        """Update the arpeggio notes based on current settings"""
        scale = self._scales[self._scale_type]
        notes = []
        
        # Generate notes across octave range
        for octave in range(self._octave_range):
            for interval in scale:
                note = self._root_note + interval + (octave * 12)
                notes.append(note)
                
        self._arpeggio_notes = notes
        self._current_arpeggio_step = 0
        
    def set_bpm(self, bpm: int):
        """
        Set the tempo in beats per minute
        
        Args:
            bpm: Tempo in beats per minute
        """
        if 40 <= bpm <= 300:
            self._bpm = bpm
            self._beat_interval = 60.0 / self._bpm / 4  # 16th note interval
            
    def set_root_note(self, midi_note: int):
        """
        Set the root note for the arpeggiator
        
        Args:
            midi_note: MIDI note number (0-127)
        """
        if 0 <= midi_note <= 127:
            self._root_note = midi_note
            self._update_arpeggio_notes()
            
    def set_scale(self, scale_type: Scale):
        """
        Set the scale type for the arpeggiator
        
        Args:
            scale_type: Scale type enum
        """
        if scale_type in Scale:
            self._scale_type = scale_type
            self._update_arpeggio_notes()
            
    def set_octave_range(self, octave_range: int):
        """
        Set the octave range for the arpeggiator
        
        Args:
            octave_range: Number of octaves (1-4)
        """
        if 1 <= octave_range <= 4:
            self._octave_range = octave_range
            self._update_arpeggio_notes()
            
    def set_arpeggio_pattern(self, pattern: ArpeggioPattern):
        """
        Set the arpeggio pattern
        
        Args:
            pattern: Arpeggio pattern enum
        """
        if pattern in ArpeggioPattern:
            self._arpeggio_pattern = pattern
            
    def set_drum_pattern(self, pattern_id: int):
        """
        Set the drum pattern
        
        Args:
            pattern_id: Index of the drum pattern
        """
        if 0 <= pattern_id < len(self._drum_patterns):
            self._drum_pattern_id = pattern_id
            
    def set_master_volume(self, volume: float):
        """
        Set the master volume
        
        Args:
            volume: Volume level (0.0-1.0)
        """
        self._master_volume = max(0.0, min(1.0, volume))
        
    def set_arpeggio_volume(self, volume: float):
        """
        Set the arpeggiator volume
        
        Args:
            volume: Volume level (0.0-1.0)
        """
        self._arpeggio_volume = max(0.0, min(1.0, volume))
        
    def set_drum_volume(self, volume: float):
        """
        Set the drum volume
        
        Args:
            volume: Volume level (0.0-1.0)
        """
        self._drum_volume = max(0.0, min(1.0, volume))
        
    def get_available_scales(self) -> Dict[str, List[int]]:
        """
        Get available musical scales
        
        Returns:
            Dictionary of scale names and intervals
        """
        return {scale.value: intervals for scale, intervals in self._scales.items()}
        
    def get_available_patterns(self) -> List[str]:
        """
        Get available arpeggio patterns
        
        Returns:
            List of pattern names
        """
        return [pattern.value for pattern in ArpeggioPattern]
        
    def get_available_drum_patterns(self) -> List[Dict]:
        """
        Get available drum patterns
        
        Returns:
            List of drum pattern dictionaries
        """
        return self._drum_patterns
        
    def note_to_frequency(self, midi_note: int) -> float:
        """
        Convert MIDI note number to frequency in Hz
        
        Args:
            midi_note: MIDI note number (0-127)
            
        Returns:
            Frequency in Hz
        """
        return 440.0 * (2.0 ** ((midi_note - 69) / 12.0))
        
    def note_to_name(self, midi_note: int) -> str:
        """
        Convert MIDI note number to note name
        
        Args:
            midi_note: MIDI note number (0-127)
            
        Returns:
            Note name (e.g., "C4")
        """
        notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
        octave = (midi_note // 12) - 1
        note = notes[midi_note % 12]
        return f"{note}{octave}"
