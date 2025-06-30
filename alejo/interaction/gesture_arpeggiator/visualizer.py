"""
Visualizer for Gesture Arpeggiator

This module implements the visualization engine for ALEJO's gesture-based
arpeggiator system, providing audio-reactive visual effects that respond
to musical parameters and hand gestures.
"""

import logging
import json
import math
import time
from typing import Dict, List, Optional, Any, Union, Tuple
from enum import Enum
import numpy as np

logger = logging.getLogger(__name__)

class VisualizerMode(Enum):
    """Visualization modes for the arpeggiator"""
    PARTICLES = "particles"
    WAVEFORM = "waveform"
    SPECTRUM = "spectrum"
    GEOMETRIC = "geometric"
    FLUID = "fluid"
    NEURAL = "neural"

class ColorScheme(Enum):
    """Color schemes for the visualizer"""
    RAINBOW = "rainbow"
    MONOCHROME = "monochrome"
    COMPLEMENTARY = "complementary"
    ANALOGOUS = "analogous"
    TRIADIC = "triadic"
    REACTIVE = "reactive"

class Visualizer:
    """
    Audio-reactive visualizer for the Gesture Arpeggiator
    
    This class handles the generation of visual effects that respond to
    musical parameters, audio analysis, and hand gestures.
    """
    
    def __init__(self):
        """Initialize the visualizer"""
        self._active = False
        self._mode = VisualizerMode.PARTICLES
        self._color_scheme = ColorScheme.RAINBOW
        self._intensity = 0.8
        self._complexity = 0.6
        self._speed = 0.5
        
        # Visual state
        self._particles = []
        self._waveform_data = np.zeros(128, dtype=np.float32)
        self._spectrum_data = np.zeros(64, dtype=np.float32)
        self._beat_energy = 0.0
        self._last_update_time = time.time()
        
        # Color palette (RGB values)
        self._color_palettes = {
            ColorScheme.RAINBOW: [
                (255, 0, 0),    # Red
                (255, 127, 0),  # Orange
                (255, 255, 0),  # Yellow
                (0, 255, 0),    # Green
                (0, 0, 255),    # Blue
                (75, 0, 130),   # Indigo
                (148, 0, 211)   # Violet
            ],
            ColorScheme.MONOCHROME: [
                (0, 120, 255),   # Base blue
                (40, 140, 255),
                (80, 160, 255),
                (120, 180, 255),
                (160, 200, 255),
                (200, 220, 255),
                (220, 240, 255)
            ],
            ColorScheme.COMPLEMENTARY: [
                (0, 180, 255),   # Blue
                (40, 200, 255),
                (80, 220, 255),
                (255, 180, 0),   # Orange
                (255, 200, 40),
                (255, 220, 80)
            ],
            ColorScheme.ANALOGOUS: [
                (0, 100, 255),   # Blue
                (0, 180, 255),
                (0, 255, 220),   # Cyan
                (0, 255, 140),
                (0, 255, 60)     # Green
            ],
            ColorScheme.TRIADIC: [
                (255, 60, 0),    # Red-orange
                (255, 120, 0),
                (0, 180, 255),   # Blue
                (40, 200, 255),
                (120, 255, 0),   # Green-yellow
                (180, 255, 0)
            ],
            ColorScheme.REACTIVE: [
                (255, 0, 0),     # Low frequencies (red)
                (255, 120, 0),   # Low-mid (orange)
                (255, 255, 0),   # Mid (yellow)
                (0, 255, 0),     # Mid-high (green)
                (0, 180, 255),   # High (blue)
                (120, 0, 255)    # Very high (purple)
            ]
        }
        
        # Initialize particles
        self._initialize_particles(100)
        
    def _initialize_particles(self, count: int):
        """
        Initialize particle system
        
        Args:
            count: Number of particles to create
        """
        self._particles = []
        for _ in range(count):
            self._particles.append({
                "x": np.random.random(),
                "y": np.random.random(),
                "z": np.random.random() * 0.5,
                "size": np.random.random() * 0.05 + 0.01,
                "speed": np.random.random() * 0.02 + 0.01,
                "angle": np.random.random() * 2 * math.pi,
                "color_idx": int(np.random.random() * len(self._color_palettes[self._color_scheme])),
                "life": np.random.random() * 0.8 + 0.2
            })
            
    def start(self):
        """Start the visualizer"""
        if not self._active:
            self._active = True
            self._last_update_time = time.time()
            logger.info("Visualizer started")
            
    def stop(self):
        """Stop the visualizer"""
        if self._active:
            self._active = False
            logger.info("Visualizer stopped")
            
    def is_active(self) -> bool:
        """Check if the visualizer is active"""
        return self._active
        
    def update(self, audio_state: Dict, hand_data: List[Dict]) -> Dict:
        """
        Update the visualizer state
        
        Args:
            audio_state: Current audio engine state
            hand_data: Current hand tracking data
            
        Returns:
            Dictionary with current visualization state
        """
        if not self._active:
            return self._get_visualization_state()
            
        current_time = time.time()
        delta_time = current_time - self._last_update_time
        self._last_update_time = current_time
        
        # Update based on visualization mode
        if self._mode == VisualizerMode.PARTICLES:
            self._update_particles(delta_time, audio_state, hand_data)
        elif self._mode == VisualizerMode.WAVEFORM:
            self._update_waveform(audio_state)
        elif self._mode == VisualizerMode.SPECTRUM:
            self._update_spectrum(audio_state)
        elif self._mode == VisualizerMode.GEOMETRIC:
            self._update_geometric(delta_time, audio_state, hand_data)
        elif self._mode == VisualizerMode.FLUID:
            self._update_fluid(delta_time, audio_state, hand_data)
        elif self._mode == VisualizerMode.NEURAL:
            self._update_neural(delta_time, audio_state, hand_data)
            
        # Update beat energy
        if audio_state["active"] and audio_state["current_beat"] % 4 == 0:
            self._beat_energy = 1.0
        else:
            self._beat_energy *= 0.9
            
        return self._get_visualization_state()
        
    def _update_particles(self, delta_time: float, audio_state: Dict, hand_data: List[Dict]):
        """
        Update particle system
        
        Args:
            delta_time: Time since last update
            audio_state: Current audio engine state
            hand_data: Current hand tracking data
        """
        # Base speed factor from audio state
        speed_factor = self._speed
        if audio_state["active"]:
            speed_factor *= 1.0 + self._beat_energy * 0.5
            
        # Update each particle
        for particle in self._particles:
            # Move particle
            particle["x"] += math.cos(particle["angle"]) * particle["speed"] * speed_factor * delta_time * 60
            particle["y"] += math.sin(particle["angle"]) * particle["speed"] * speed_factor * delta_time * 60
            
            # Decrease life
            particle["life"] -= 0.01 * speed_factor * delta_time * 60
            
            # Reset particles that are out of bounds or dead
            if (particle["x"] < 0 or particle["x"] > 1 or
                particle["y"] < 0 or particle["y"] > 1 or
                particle["life"] <= 0):
                
                particle["x"] = np.random.random()
                particle["y"] = np.random.random()
                particle["life"] = np.random.random() * 0.8 + 0.2
                particle["angle"] = np.random.random() * 2 * math.pi
                
                # If hands are detected, spawn particles near hand positions
                if hand_data and np.random.random() < 0.7:
                    hand = hand_data[int(np.random.random() * len(hand_data))]
                    particle["x"] = hand["position"]["x"]
                    particle["y"] = hand["position"]["y"]
                    
                    # Angle away from hand center
                    particle["angle"] = math.atan2(
                        particle["y"] - hand["position"]["y"],
                        particle["x"] - hand["position"]["x"]
                    )
                    
            # Update color based on audio
            if audio_state["active"] and audio_state["current_note"]:
                note = audio_state["current_note"] % 12
                particle["color_idx"] = note % len(self._color_palettes[self._color_scheme])
                
    def _update_waveform(self, audio_state: Dict):
        """
        Update waveform visualization
        
        Args:
            audio_state: Current audio engine state
        """
        # In a real implementation, this would use actual audio samples
        # For now, generate a synthetic waveform based on audio state
        
        if not audio_state["active"]:
            # Decay existing waveform
            self._waveform_data *= 0.9
            return
            
        # Generate a synthetic waveform based on current note
        if audio_state["current_note"]:
            freq = 440.0 * (2.0 ** ((audio_state["current_note"] - 69) / 12.0))
            phase = (audio_state["current_beat"] % 16) / 16.0 * 2 * math.pi
            
            for i in range(len(self._waveform_data)):
                t = i / len(self._waveform_data)
                # Mix sine waves at fundamental and harmonics
                value = math.sin(2 * math.pi * freq * t + phase) * 0.5
                value += math.sin(2 * 2 * math.pi * freq * t + phase) * 0.25
                value += math.sin(3 * 2 * math.pi * freq * t + phase) * 0.125
                
                # Apply envelope based on beat position
                beat_pos = audio_state["current_beat"] % 4
                if beat_pos == 0:
                    env = 1.0
                else:
                    env = 1.0 - beat_pos / 4.0
                    
                self._waveform_data[i] = value * env * audio_state["master_volume"] * audio_state["arpeggio_volume"]
                
        # Add drum transients
        if audio_state["drum_hits"]["kick"]:
            kick_env = np.exp(-np.linspace(0, 10, len(self._waveform_data)))
            self._waveform_data += kick_env * 0.8 * audio_state["drum_volume"]
            
        if audio_state["drum_hits"]["snare"]:
            snare_env = np.exp(-np.linspace(0, 8, len(self._waveform_data)))
            noise = np.random.normal(0, 0.5, len(self._waveform_data))
            self._waveform_data += snare_env * noise * 0.6 * audio_state["drum_volume"]
            
    def _update_spectrum(self, audio_state: Dict):
        """
        Update spectrum visualization
        
        Args:
            audio_state: Current audio engine state
        """
        # In a real implementation, this would use FFT of audio samples
        # For now, generate a synthetic spectrum based on audio state
        
        # Decay existing spectrum
        self._spectrum_data *= 0.8
        
        if not audio_state["active"]:
            return
            
        # Generate synthetic spectrum based on current note
        if audio_state["current_note"]:
            note_bin = (audio_state["current_note"] % 12) * 5 + 10
            
            # Create peaks at fundamental and harmonics
            for harmonic in range(1, 4):
                bin_idx = min(note_bin * harmonic, len(self._spectrum_data) - 1)
                peak_width = 3
                
                for i in range(max(0, bin_idx - peak_width), min(len(self._spectrum_data), bin_idx + peak_width + 1)):
                    distance = abs(i - bin_idx)
                    value = math.exp(-distance * distance / (2 * 2)) * (1.0 / harmonic)
                    self._spectrum_data[i] = max(self._spectrum_data[i], 
                                               value * audio_state["master_volume"] * audio_state["arpeggio_volume"])
                                               
        # Add drum spectrum components
        if audio_state["drum_hits"]["kick"]:
            # Kick drum: low frequency energy
            for i in range(0, 10):
                value = math.exp(-i / 3) * audio_state["drum_volume"]
                self._spectrum_data[i] = max(self._spectrum_data[i], value)
                
        if audio_state["drum_hits"]["snare"]:
            # Snare: mid-high frequency noise
            for i in range(15, 40):
                value = 0.7 * np.random.random() * audio_state["drum_volume"]
                self._spectrum_data[i] = max(self._spectrum_data[i], value)
                
        if audio_state["drum_hits"]["hihat"]:
            # Hi-hat: high frequency content
            for i in range(40, len(self._spectrum_data)):
                value = 0.5 * np.random.random() * audio_state["drum_volume"]
                self._spectrum_data[i] = max(self._spectrum_data[i], value)
                
    def _update_geometric(self, delta_time: float, audio_state: Dict, hand_data: List[Dict]):
        """
        Update geometric visualization
        
        Args:
            delta_time: Time since last update
            audio_state: Current audio engine state
            hand_data: Current hand tracking data
        """
        # This would be implemented with more complex geometric shapes
        # For now, we'll just update the basic state
        pass
        
    def _update_fluid(self, delta_time: float, audio_state: Dict, hand_data: List[Dict]):
        """
        Update fluid simulation visualization
        
        Args:
            delta_time: Time since last update
            audio_state: Current audio engine state
            hand_data: Current hand tracking data
        """
        # This would be implemented with fluid dynamics simulation
        # For now, we'll just update the basic state
        pass
        
    def _update_neural(self, delta_time: float, audio_state: Dict, hand_data: List[Dict]):
        """
        Update neural network visualization
        
        Args:
            delta_time: Time since last update
            audio_state: Current audio engine state
            hand_data: Current hand tracking data
        """
        # This would visualize a neural network responding to audio
        # For now, we'll just update the basic state
        pass
        
    def _get_visualization_state(self) -> Dict:
        """
        Get the current visualization state
        
        Returns:
            Dictionary with current visualization parameters
        """
        # Return a simplified state for the frontend to render
        return {
            "active": self._active,
            "mode": self._mode.value,
            "color_scheme": self._color_scheme.value,
            "intensity": self._intensity,
            "complexity": self._complexity,
            "speed": self._speed,
            "beat_energy": self._beat_energy,
            "particle_count": len(self._particles),
            "waveform_preview": self._waveform_data.tolist()[:16],  # Just send a preview
            "spectrum_preview": self._spectrum_data.tolist()[:16]   # Just send a preview
        }
        
    def set_mode(self, mode: VisualizerMode):
        """
        Set the visualization mode
        
        Args:
            mode: Visualization mode enum
        """
        if mode in VisualizerMode:
            self._mode = mode
            logger.info(f"Visualizer mode set to {mode.value}")
            
    def set_color_scheme(self, scheme: ColorScheme):
        """
        Set the color scheme
        
        Args:
            scheme: Color scheme enum
        """
        if scheme in ColorScheme:
            self._color_scheme = scheme
            logger.info(f"Visualizer color scheme set to {scheme.value}")
            
    def set_intensity(self, intensity: float):
        """
        Set the visualization intensity
        
        Args:
            intensity: Intensity level (0.0-1.0)
        """
        self._intensity = max(0.0, min(1.0, intensity))
        
    def set_complexity(self, complexity: float):
        """
        Set the visualization complexity
        
        Args:
            complexity: Complexity level (0.0-1.0)
        """
        self._complexity = max(0.0, min(1.0, complexity))
        
        # Adjust particle count based on complexity
        particle_count = int(100 + 900 * self._complexity)
        if len(self._particles) != particle_count:
            self._initialize_particles(particle_count)
            
    def set_speed(self, speed: float):
        """
        Set the visualization speed
        
        Args:
            speed: Speed level (0.0-1.0)
        """
        self._speed = max(0.0, min(1.0, speed))
        
    def get_available_modes(self) -> List[str]:
        """
        Get available visualization modes
        
        Returns:
            List of mode names
        """
        return [mode.value for mode in VisualizerMode]
        
    def get_available_color_schemes(self) -> List[str]:
        """
        Get available color schemes
        
        Returns:
            List of color scheme names
        """
        return [scheme.value for scheme in ColorScheme]
