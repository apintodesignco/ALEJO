"""
ALEJO Gesture Arpeggiator Module

This module provides a hand gesture-controlled musical arpeggiator and drum machine
with audio-reactive visualizations. It integrates with ALEJO's vision system for
hand tracking and can be activated through multiple modalities including hand gestures,
voice commands, and sign language recognition.
"""

from alejo.interaction.gesture_arpeggiator.controller import GestureArpeggiatorController
from alejo.interaction.gesture_arpeggiator.service import GestureArpeggiatorService

__all__ = ['GestureArpeggiatorController', 'GestureArpeggiatorService']
