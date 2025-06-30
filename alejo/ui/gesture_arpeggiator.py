"""
Gesture Arpeggiator UI Controller for ALEJO

This module provides a gesture-based interface controller that translates
user hand movements into interactive commands and UI controls.
"""

import logging
from typing import Dict, List, Any, Optional, Tuple, Callable
import time
import math
import asyncio
from dataclasses import dataclass, field
from enum import Enum

from ..core.config_manager import ConfigManager
from ..utils.event_bus import EventBus, Event

logger = logging.getLogger(__name__)


class GestureType(Enum):
    """Types of recognized gestures"""
    SWIPE_LEFT = "swipe_left"
    SWIPE_RIGHT = "swipe_right"
    SWIPE_UP = "swipe_up"
    SWIPE_DOWN = "swipe_down"
    PINCH = "pinch"
    SPREAD = "spread"
    ROTATE_CW = "rotate_clockwise"
    ROTATE_CCW = "rotate_counterclockwise"
    TAP = "tap"
    DOUBLE_TAP = "double_tap"
    HOLD = "hold"
    WAVE = "wave"


@dataclass
class GestureEvent:
    """Represents a detected gesture event"""
    gesture_type: GestureType
    confidence: float
    position: Tuple[float, float]  # Normalized x, y coordinates (0-1)
    timestamp: float = field(default_factory=time.time)
    duration: float = 0.0  # Duration in seconds for gestures that have duration
    magnitude: float = 1.0  # Relative size/strength of the gesture
    metadata: Dict[str, Any] = field(default_factory=dict)


class GestureArpeggiator:
    """
    Gesture Arpeggiator UI Controller
    
    Translates detected hand gestures into UI control events and provides
    accessible gesture-based interaction with ALEJO.
    """
    
    def __init__(self, config_manager: Optional[ConfigManager] = None, 
                 event_bus: Optional[EventBus] = None):
        """
        Initialize the Gesture Arpeggiator
        
        Args:
            config_manager: Configuration manager for settings
            event_bus: Event bus for publishing and subscribing to events
        """
        self.config_manager = config_manager
        self.event_bus = event_bus
        
        # Default configuration
        self.enabled = True
        self.sensitivity = 0.5  # 0.0 to 1.0
        self.gesture_timeout = 0.8  # seconds
        
        # Gesture mapping configuration
        self.gesture_mappings: Dict[GestureType, str] = {
            GestureType.SWIPE_LEFT: "navigation.previous",
            GestureType.SWIPE_RIGHT: "navigation.next",
            GestureType.SWIPE_UP: "navigation.menu",
            GestureType.SWIPE_DOWN: "navigation.close",
            GestureType.PINCH: "view.zoom_out",
            GestureType.SPREAD: "view.zoom_in",
            GestureType.ROTATE_CW: "control.increase",
            GestureType.ROTATE_CCW: "control.decrease",
            GestureType.TAP: "interaction.select",
            GestureType.DOUBLE_TAP: "interaction.activate",
            GestureType.HOLD: "interaction.context_menu",
            GestureType.WAVE: "system.attention"
        }
        
        # State tracking
        self.active_gestures: List[GestureEvent] = []
        self.last_gesture_time = 0.0
        self.gesture_sequence: List[GestureEvent] = []
        self.max_sequence_length = 5
        self.sequence_timeout = 2.0  # seconds
        
        # Load configuration if available
        if config_manager:
            self._load_configuration()
            
        # Register event handlers if event bus is available
        if event_bus:
            self._register_event_handlers()
    
    def _load_configuration(self) -> None:
        """Load configuration settings from config manager"""
        gesture_config = self.config_manager.get_config("gesture_arpeggiator", {})
        
        self.enabled = gesture_config.get("enabled", True)
        self.sensitivity = gesture_config.get("sensitivity", 0.5)
        self.gesture_timeout = gesture_config.get("gesture_timeout", 0.8)
        self.max_sequence_length = gesture_config.get("max_sequence_length", 5)
        self.sequence_timeout = gesture_config.get("sequence_timeout", 2.0)
        
        # Load custom gesture mappings if available
        custom_mappings = gesture_config.get("gesture_mappings", {})
        for gesture_name, action in custom_mappings.items():
            try:
                gesture_type = GestureType(gesture_name)
                self.gesture_mappings[gesture_type] = action
            except ValueError:
                logger.warning(f"Unknown gesture type in config: {gesture_name}")
    
    def _register_event_handlers(self) -> None:
        """Register handlers for relevant events"""
        self.event_bus.subscribe("gesture.detected", self._handle_gesture_detected)
        self.event_bus.subscribe("ui.mode_changed", self._handle_ui_mode_changed)
        self.event_bus.subscribe("config.updated", self._handle_config_updated)
    
    async def _handle_gesture_detected(self, event: Event) -> None:
        """Handle gesture detection events"""
        if not self.enabled:
            return
            
        gesture_data = event.payload.get("gesture", {})
        
        try:
            gesture_type = GestureType(gesture_data.get("type"))
            confidence = gesture_data.get("confidence", 0.0)
            position = gesture_data.get("position", (0.5, 0.5))
            duration = gesture_data.get("duration", 0.0)
            magnitude = gesture_data.get("magnitude", 1.0)
            metadata = gesture_data.get("metadata", {})
            
            # Create gesture event
            gesture_event = GestureEvent(
                gesture_type=gesture_type,
                confidence=confidence,
                position=position,
                duration=duration,
                magnitude=magnitude,
                metadata=metadata
            )
            
            # Process the gesture if confidence exceeds sensitivity threshold
            if confidence >= self.sensitivity:
                await self._process_gesture(gesture_event)
                
        except (ValueError, KeyError) as e:
            logger.error(f"Error processing gesture event: {e}")
    
    async def _handle_ui_mode_changed(self, event: Event) -> None:
        """Handle UI mode change events"""
        ui_mode = event.payload.get("mode")
        
        # Clear gesture state when UI mode changes
        self.active_gestures = []
        self.gesture_sequence = []
        
        logger.debug(f"UI mode changed to {ui_mode}, gesture state reset")
    
    async def _handle_config_updated(self, event: Event) -> None:
        """Handle configuration update events"""
        if event.payload.get("component") == "gesture_arpeggiator":
            config = event.payload.get("config", {})
            self.update_configuration(config)
    
    async def _process_gesture(self, gesture: GestureEvent) -> None:
        """
        Process a detected gesture
        
        Args:
            gesture: The gesture event to process
        """
        current_time = time.time()
        
        # Add to active gestures
        self.active_gestures.append(gesture)
        
        # Clean up old active gestures
        self.active_gestures = [g for g in self.active_gestures 
                              if current_time - g.timestamp < self.gesture_timeout]
        
        # Add to gesture sequence if it's a new gesture (not continuation)
        if (current_time - self.last_gesture_time > self.gesture_timeout or
            not self.gesture_sequence or
            self.gesture_sequence[-1].gesture_type != gesture.gesture_type):
            
            self.gesture_sequence.append(gesture)
            self.last_gesture_time = current_time
            
            # Limit sequence length
            if len(self.gesture_sequence) > self.max_sequence_length:
                self.gesture_sequence.pop(0)
        
        # Clean up old sequence gestures
        self.gesture_sequence = [g for g in self.gesture_sequence 
                               if current_time - g.timestamp < self.sequence_timeout]
        
        # Map gesture to action and publish event
        await self._map_gesture_to_action(gesture)
        
        # Check for gesture sequences
        await self._check_gesture_sequences()
    
    async def _map_gesture_to_action(self, gesture: GestureEvent) -> None:
        """
        Map a gesture to its corresponding action and publish event
        
        Args:
            gesture: The gesture to map to an action
        """
        if not self.event_bus:
            return
            
        action = self.gesture_mappings.get(gesture.gesture_type)
        if not action:
            return
            
        # Create action payload
        payload = {
            "action": action,
            "source": "gesture_arpeggiator",
            "gesture": {
                "type": gesture.gesture_type.value,
                "position": gesture.position,
                "magnitude": gesture.magnitude,
                "confidence": gesture.confidence
            },
            "timestamp": gesture.timestamp
        }
        
        # Publish action event
        await self.event_bus.publish("ui.action", payload)
        logger.debug(f"Mapped gesture {gesture.gesture_type.value} to action {action}")
    
    async def _check_gesture_sequences(self) -> None:
        """Check for recognized gesture sequences and trigger corresponding actions"""
        if len(self.gesture_sequence) < 2:
            return
            
        # Example sequence: SWIPE_RIGHT followed by SWIPE_LEFT (undo)
        if (len(self.gesture_sequence) >= 2 and
            self.gesture_sequence[-2].gesture_type == GestureType.SWIPE_RIGHT and
            self.gesture_sequence[-1].gesture_type == GestureType.SWIPE_LEFT):
            
            if self.event_bus:
                await self.event_bus.publish("ui.action", {
                    "action": "edit.undo",
                    "source": "gesture_sequence",
                    "sequence": ["swipe_right", "swipe_left"]
                })
                logger.debug("Recognized gesture sequence: undo")
                
                # Clear the used sequence
                self.gesture_sequence = []
    
    def update_configuration(self, config: Dict[str, Any]) -> None:
        """
        Update arpeggiator configuration
        
        Args:
            config: New configuration settings
        """
        if "enabled" in config:
            self.enabled = config["enabled"]
            
        if "sensitivity" in config:
            self.sensitivity = config["sensitivity"]
            
        if "gesture_timeout" in config:
            self.gesture_timeout = config["gesture_timeout"]
            
        if "max_sequence_length" in config:
            self.max_sequence_length = config["max_sequence_length"]
            
        if "sequence_timeout" in config:
            self.sequence_timeout = config["sequence_timeout"]
            
        # Update gesture mappings if provided
        if "gesture_mappings" in config:
            for gesture_name, action in config["gesture_mappings"].items():
                try:
                    gesture_type = GestureType(gesture_name)
                    self.gesture_mappings[gesture_type] = action
                except ValueError:
                    logger.warning(f"Unknown gesture type in config update: {gesture_name}")
        
        # Update config manager if available
        if self.config_manager:
            self.config_manager.update_config("gesture_arpeggiator", config)
            
        logger.info("Gesture Arpeggiator configuration updated")


# Export public API
__all__ = ["GestureArpeggiator", "GestureEvent", "GestureType"]
