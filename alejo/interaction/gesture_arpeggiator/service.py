"""
Gesture Arpeggiator Service

This module implements the core service for ALEJO's gesture-based arpeggiator
and drum machine system, handling hand tracking, music generation, and visualization.
"""

import logging
import asyncio
import json
import time
import math
from typing import Dict, List, Optional, Any, Union, Tuple
from enum import Enum
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

class HandGesture(Enum):
    """Recognized hand gestures for musical control"""
    OPEN = "open"
    CLOSED = "closed"
    POINTING = "pointing"
    PINCH = "pinch"
    VICTORY = "victory"
    THUMBS_UP = "thumbs_up"
    ROCK = "rock"
    PALM_DOWN = "palm_down"
    PALM_UP = "palm_up"
    FIST = "fist"

@dataclass
class HandData:
    """Data structure for hand tracking information"""
    id: int
    landmarks: List[Dict[str, float]]
    gesture: HandGesture
    position: Dict[str, float]
    is_left: bool
    confidence: float
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'HandData':
        """Create HandData from dictionary"""
        return cls(
            id=data.get("id", 0),
            landmarks=data.get("landmarks", []),
            gesture=HandGesture(data.get("gesture", "open")),
            position=data.get("position", {"x": 0, "y": 0, "z": 0}),
            is_left=data.get("isLeft", False),
            confidence=data.get("confidence", 0.0)
        )

class GestureArpeggiatorService:
    """
    Service for the Gesture Arpeggiator feature
    
    This service handles:
    1. Processing hand tracking data from MediaPipe
    2. Mapping hand gestures to musical parameters
    3. Generating arpeggio and drum patterns
    4. Creating audio-reactive visualizations
    5. Managing WebSocket communication for real-time interaction
    """
    
    def __init__(self):
        """Initialize the service"""
        self._active = False
        self._arpeggiator_settings = {
            "bpm": 120,
            "scale": "major",
            "root_note": "C4",
            "octave_range": 2,
            "pattern": "up",
            "volume": 0.8
        }
        self._drum_settings = {
            "pattern_id": 0,
            "volume": 0.8,
            "swing": 0.0
        }
        self._visualizer_settings = {
            "theme": "default",
            "sensitivity": 0.5,
            "particle_count": 1000
        }
        self._current_hands: Dict[int, HandData] = {}
        self._last_processed_time = time.time()
        self._audio_state = {
            "notes": [],
            "drums": [],
            "volume": 0.8,
            "pitch_bend": 0.0
        }
        self._visualization_state = {
            "particles": [],
            "color_scheme": [
                {"r": 255, "g": 0, "b": 127},
                {"r": 0, "g": 127, "b": 255}
            ],
            "intensity": 0.5
        }
        
        # Musical scales and patterns
        self._scales = {
            "major": [0, 2, 4, 5, 7, 9, 11],
            "minor": [0, 2, 3, 5, 7, 8, 10],
            "pentatonic": [0, 2, 4, 7, 9],
            "blues": [0, 3, 5, 6, 7, 10],
            "chromatic": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
        }
        self._drum_patterns = self._initialize_drum_patterns()
        
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
            }
        ]
        
    async def start(self):
        """Start the gesture arpeggiator service"""
        if not self._active:
            self._active = True
            logger.info("Gesture Arpeggiator service started")
            
    async def stop(self):
        """Stop the gesture arpeggiator service"""
        if self._active:
            self._active = False
            logger.info("Gesture Arpeggiator service stopped")
            
    def is_active(self) -> bool:
        """Check if the service is active"""
        return self._active
        
    async def process_hand_data(self, hand_data: List[Dict]):
        """
        Process hand tracking data from MediaPipe
        
        Args:
            hand_data: List of hand tracking data dictionaries
        """
        if not self._active:
            return
            
        # Update current hands
        current_time = time.time()
        self._current_hands = {}
        
        for hand in hand_data:
            hand_id = hand.get("id", len(self._current_hands))
            self._current_hands[hand_id] = HandData.from_dict(hand)
            
        # Process hands for musical control
        await self._update_musical_parameters()
        
        # Update visualization based on audio state
        self._update_visualization()
        
        self._last_processed_time = current_time
        
    async def _update_musical_parameters(self):
        """Update musical parameters based on hand gestures"""
        # Default values if no hands are detected
        pitch_control = 0.5
        volume_control = 0.8
        drum_pattern_control = 0
        
        # Process left and right hands separately
        left_hand = None
        right_hand = None
        
        for hand_id, hand in self._current_hands.items():
            if hand.is_left:
                left_hand = hand
            else:
                right_hand = hand
                
        # Left hand controls arpeggiator (pitch and volume)
        if left_hand:
            # Vertical position controls pitch
            pitch_control = 1.0 - max(0.0, min(1.0, left_hand.position["y"]))
            
            # Pinch gesture controls volume
            if left_hand.gesture == HandGesture.PINCH:
                # Calculate pinch distance between thumb and index finger
                thumb = left_hand.landmarks[4]  # Thumb tip
                index = left_hand.landmarks[8]  # Index finger tip
                
                dx = thumb["x"] - index["x"]
                dy = thumb["y"] - index["y"]
                distance = math.sqrt(dx*dx + dy*dy)
                
                # Map distance to volume (closer = quieter)
                volume_control = max(0.1, min(1.0, distance * 5.0))
                
        # Right hand controls drum pattern
        if right_hand:
            # Count extended fingers to select drum pattern
            extended_fingers = self._count_extended_fingers(right_hand)
            drum_pattern_control = extended_fingers % len(self._drum_patterns)
            
        # Update audio state
        self._audio_state["pitch_bend"] = pitch_control
        self._audio_state["volume"] = volume_control
        
        # Update arpeggiator notes based on pitch control
        self._audio_state["notes"] = self._generate_arpeggio_notes(pitch_control)
        
        # Update drum pattern
        self._drum_settings["pattern_id"] = drum_pattern_control
        self._audio_state["drums"] = self._get_current_drum_pattern()
        
    def _count_extended_fingers(self, hand: HandData) -> int:
        """
        Count number of extended fingers
        
        Args:
            hand: Hand tracking data
            
        Returns:
            Number of extended fingers (0-5)
        """
        # Simplified finger extension detection
        # In a real implementation, this would use the angles between finger joints
        wrist = hand.landmarks[0]
        fingertips = [hand.landmarks[tip_idx] for tip_idx in [4, 8, 12, 16, 20]]
        
        extended_count = 0
        for tip in fingertips:
            # If fingertip is higher than wrist, consider it extended
            if tip["y"] < wrist["y"] - 0.1:
                extended_count += 1
                
        return extended_count
        
    def _generate_arpeggio_notes(self, pitch_control: float) -> List[Dict]:
        """
        Generate arpeggio notes based on current settings and pitch control
        
        Args:
            pitch_control: Normalized pitch control value (0.0-1.0)
            
        Returns:
            List of note objects with pitch and timing information
        """
        scale = self._scales[self._arpeggiator_settings["scale"]]
        root_note = self._arpeggiator_settings["root_note"]
        octave_range = self._arpeggiator_settings["octave_range"]
        pattern = self._arpeggiator_settings["pattern"]
        
        # Extract root note and octave
        root_name = root_note[0]
        root_octave = int(root_note[-1])
        
        # Map pitch control to octave offset
        octave_offset = int(pitch_control * octave_range)
        
        # Generate scale notes across octave range
        notes = []
        base_octave = root_octave + octave_offset
        
        # Generate one octave of notes
        for step in scale:
            note = {
                "pitch": f"{self._note_number_to_name(step)}{base_octave}",
                "duration": 0.25,  # Quarter note
                "velocity": 0.8
            }
            notes.append(note)
            
        # Apply arpeggio pattern
        if pattern == "up":
            return notes
        elif pattern == "down":
            return list(reversed(notes))
        elif pattern == "updown":
            return notes + list(reversed(notes[1:-1]))
        elif pattern == "random":
            import random
            random.shuffle(notes)
            return notes
        else:
            return notes
            
    def _note_number_to_name(self, note_number: int) -> str:
        """Convert note number to note name"""
        notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
        return notes[note_number % 12]
        
    def _get_current_drum_pattern(self) -> Dict:
        """Get the current drum pattern based on settings"""
        pattern_id = self._drum_settings["pattern_id"]
        if 0 <= pattern_id < len(self._drum_patterns):
            return self._drum_patterns[pattern_id]
        return self._drum_patterns[0]
        
    def _update_visualization(self):
        """Update visualization state based on audio state"""
        # In a real implementation, this would generate particle data
        # and other visual elements based on the current audio state
        intensity = self._audio_state["volume"]
        pitch = self._audio_state["pitch_bend"]
        
        # Update visualization intensity
        self._visualization_state["intensity"] = intensity
        
        # Update color scheme based on pitch
        hue1 = (pitch * 360) % 360
        hue2 = (hue1 + 180) % 360
        
        self._visualization_state["color_scheme"] = [
            self._hsl_to_rgb(hue1, 0.8, 0.5),
            self._hsl_to_rgb(hue2, 0.8, 0.5)
        ]
        
    def _hsl_to_rgb(self, h: float, s: float, l: float) -> Dict[str, int]:
        """
        Convert HSL color to RGB
        
        Args:
            h: Hue (0-360)
            s: Saturation (0-1)
            l: Lightness (0-1)
            
        Returns:
            RGB color as dictionary
        """
        h /= 360
        
        if s == 0:
            r = g = b = l
        else:
            def hue_to_rgb(p, q, t):
                if t < 0:
                    t += 1
                if t > 1:
                    t -= 1
                if t < 1/6:
                    return p + (q - p) * 6 * t
                if t < 1/2:
                    return q
                if t < 2/3:
                    return p + (q - p) * (2/3 - t) * 6
                return p
                
            q = l * (1 + s) if l < 0.5 else l + s - l * s
            p = 2 * l - q
            r = hue_to_rgb(p, q, h + 1/3)
            g = hue_to_rgb(p, q, h)
            b = hue_to_rgb(p, q, h - 1/3)
            
        return {
            "r": int(r * 255),
            "g": int(g * 255),
            "b": int(b * 255)
        }
        
    def get_current_state(self) -> Dict:
        """Get the current state of the arpeggiator"""
        return {
            "is_active": self._active,
            "audio": self._audio_state,
            "visualization": self._visualization_state,
            "arpeggiator": self._arpeggiator_settings,
            "drums": self._drum_settings,
            "visualizer": self._visualizer_settings
        }
        
    def get_arpeggiator_settings(self) -> Dict:
        """Get the current arpeggiator settings"""
        return self._arpeggiator_settings
        
    def get_drum_settings(self) -> Dict:
        """Get the current drum settings"""
        return self._drum_settings
        
    def get_visualizer_settings(self) -> Dict:
        """Get the current visualizer settings"""
        return self._visualizer_settings
        
    async def update_arpeggiator_settings(self, settings: Dict):
        """
        Update arpeggiator settings
        
        Args:
            settings: New settings dictionary
        """
        for key, value in settings.items():
            if key in self._arpeggiator_settings:
                self._arpeggiator_settings[key] = value
                
    async def update_drum_settings(self, settings: Dict):
        """
        Update drum settings
        
        Args:
            settings: New settings dictionary
        """
        for key, value in settings.items():
            if key in self._drum_settings:
                self._drum_settings[key] = value
                
    async def update_visualizer_settings(self, settings: Dict):
        """
        Update visualizer settings
        
        Args:
            settings: New settings dictionary
        """
        for key, value in settings.items():
            if key in self._visualizer_settings:
                self._visualizer_settings[key] = value
