"""
ALEJO Gesture System Test Configuration

This module provides configuration settings for gesture system tests,
allowing for consistent test environments across unit, integration, and E2E tests.
"""

import os
import secrets  # More secure for cryptographic purposes
from pathlib import Path

# Test environment settings
TEST_ENV = {
    "mock_mediapipe": True,
    "mock_websockets": True,
    "mock_audio": True,
    "use_test_data": True,
}

# Test data paths
TEST_DATA_DIR = Path(__file__).parent / "test_data"
GESTURE_SAMPLES_DIR = TEST_DATA_DIR / "gesture_samples"
AUDIO_SAMPLES_DIR = TEST_DATA_DIR / "audio_samples"

# Ensure test data directories exist
os.makedirs(GESTURE_SAMPLES_DIR, exist_ok=True)
os.makedirs(AUDIO_SAMPLES_DIR, exist_ok=True)

# Test server configuration
TEST_SERVER_CONFIG = {"host": "localhost", "port": 8765, "debug": True, "timeout": 5.0}

# Mock gesture data
MOCK_HAND_LANDMARKS = {
    "pinch": [
        {"x": 0.5, "y": 0.5, "z": 0.0},  # Wrist
        {"x": 0.6, "y": 0.4, "z": 0.0},  # Thumb base
        {"x": 0.65, "y": 0.35, "z": 0.0},  # Thumb middle
        {"x": 0.7, "y": 0.3, "z": 0.0},  # Thumb tip
        {"x": 0.55, "y": 0.45, "z": 0.0},  # Index finger base
        {"x": 0.6, "y": 0.4, "z": 0.0},  # Index finger middle
        {"x": 0.65, "y": 0.35, "z": 0.0},  # Index finger tip
        # ... other landmarks
    ],
    "open_hand": [
        {"x": 0.5, "y": 0.5, "z": 0.0},  # Wrist
        {"x": 0.4, "y": 0.4, "z": 0.0},  # Thumb base
        {"x": 0.3, "y": 0.3, "z": 0.0},  # Thumb middle
        {"x": 0.2, "y": 0.2, "z": 0.0},  # Thumb tip
        {"x": 0.5, "y": 0.4, "z": 0.0},  # Index finger base
        {"x": 0.5, "y": 0.3, "z": 0.0},  # Index finger middle
        {"x": 0.5, "y": 0.2, "z": 0.0},  # Index finger tip
        # ... other landmarks
    ],
    # Add more gesture patterns as needed
}

# Test presets
TEST_PRESETS = {
    "basic": {
        "name": "Basic Test Preset",
        "bpm": 120,
        "scale": "C major",
        "octave": 4,
        "arpeggiation_rate": 16,
        "reverb": 0.3,
        "delay": 0.2,
    },
    "ambient": {
        "name": "Ambient Test Preset",
        "bpm": 80,
        "scale": "E minor",
        "octave": 3,
        "arpeggiation_rate": 8,
        "reverb": 0.7,
        "delay": 0.5,
    },
}


def get_mock_data_for_gesture(gesture_name):
    """Get mock hand landmark data for a specific gesture"""
    return MOCK_HAND_LANDMARKS.get(gesture_name, MOCK_HAND_LANDMARKS["open_hand"])


def get_test_preset(preset_name):
    """Get a test preset configuration by name"""
    return TEST_PRESETS.get(preset_name, TEST_PRESETS["basic"])
