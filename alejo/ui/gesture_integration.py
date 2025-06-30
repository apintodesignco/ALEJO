"""
Gesture Integration Module for ALEJO

This module integrates the Gesture Arpeggiator with the ALEJO UI system,
providing a bridge between gesture detection and UI actions.
"""

import logging
import asyncio
from typing import Dict, Any, Optional, List, Callable
import time

from .gesture_arpeggiator import GestureArpeggiator, GestureType, GestureEvent
from ..core.config_manager import ConfigManager
from ..utils.event_bus import EventBus, Event

logger = logging.getLogger(__name__)


class GestureIntegration:
    """
    Integrates gesture recognition with ALEJO's UI system
    
    This class:
    1. Connects gesture recognition systems to the Gesture Arpeggiator
    2. Translates UI actions from gestures into appropriate UI updates
    3. Provides accessibility features through gesture-based interaction
    4. Manages user preferences for gesture control
    """
    
    def __init__(self, config_manager: Optional[ConfigManager] = None, 
                 event_bus: Optional[EventBus] = None):
        """
        Initialize the Gesture Integration
        
        Args:
            config_manager: Configuration manager for settings
            event_bus: Event bus for publishing and subscribing to events
        """
        self.config_manager = config_manager
        self.event_bus = event_bus
        
        # Initialize the gesture arpeggiator
        self.arpeggiator = GestureArpeggiator(config_manager, event_bus)
        
        # Action handlers mapping
        self.action_handlers: Dict[str, Callable] = {
            "navigation.previous": self._handle_navigation_previous,
            "navigation.next": self._handle_navigation_next,
            "navigation.menu": self._handle_navigation_menu,
            "navigation.close": self._handle_navigation_close,
            "view.zoom_in": self._handle_view_zoom_in,
            "view.zoom_out": self._handle_view_zoom_out,
            "interaction.select": self._handle_interaction_select,
            "interaction.activate": self._handle_interaction_activate,
            "interaction.context_menu": self._handle_interaction_context_menu,
            "edit.undo": self._handle_edit_undo
        }
        
        # State tracking
        self.current_ui_mode = "default"
        self.current_ui_context = {}
        self.gesture_enabled_elements = []
        
        # Register event handlers if event bus is available
        if event_bus:
            self._register_event_handlers()
    
    def _register_event_handlers(self) -> None:
        """Register handlers for relevant events"""
        self.event_bus.subscribe("ui.action", self._handle_ui_action)
        self.event_bus.subscribe("ui.mode_changed", self._handle_ui_mode_changed)
        self.event_bus.subscribe("ui.context_updated", self._handle_ui_context_updated)
        self.event_bus.subscribe("config.updated", self._handle_config_updated)
    
    async def _handle_ui_action(self, event: Event) -> None:
        """
        Handle UI action events from gestures
        
        Args:
            event: The UI action event
        """
        action = event.payload.get("action")
        source = event.payload.get("source")
        
        # Only process actions from gesture sources
        if source not in ["gesture_arpeggiator", "gesture_sequence"]:
            return
            
        logger.debug(f"Processing UI action: {action} from {source}")
        
        # Call the appropriate handler if available
        handler = self.action_handlers.get(action)
        if handler:
            try:
                await handler(event.payload)
            except Exception as e:
                logger.error(f"Error handling action {action}: {e}")
        else:
            logger.debug(f"No handler registered for action: {action}")
    
    async def _handle_ui_mode_changed(self, event: Event) -> None:
        """
        Handle UI mode change events
        
        Args:
            event: The UI mode change event
        """
        self.current_ui_mode = event.payload.get("mode", "default")
        logger.debug(f"UI mode changed to: {self.current_ui_mode}")
    
    async def _handle_ui_context_updated(self, event: Event) -> None:
        """
        Handle UI context update events
        
        Args:
            event: The UI context update event
        """
        context = event.payload.get("context", {})
        self.current_ui_context.update(context)
        
        # Update gesture-enabled elements
        if "gesture_elements" in context:
            self.gesture_enabled_elements = context["gesture_elements"]
    
    async def _handle_config_updated(self, event: Event) -> None:
        """
        Handle configuration update events
        
        Args:
            event: The configuration update event
        """
        if event.payload.get("component") == "gesture_integration":
            config = event.payload.get("config", {})
            self.update_configuration(config)
    
    # ---------------------------------------------------------------
    # Action handlers
    # ---------------------------------------------------------------
    
    async def _handle_navigation_previous(self, payload: Dict[str, Any]) -> None:
        """Handle navigation previous action"""
        if not self.event_bus:
            return
            
        await self.event_bus.publish("navigation.request", {
            "direction": "previous",
            "source": "gesture",
            "context": self.current_ui_context
        })
    
    async def _handle_navigation_next(self, payload: Dict[str, Any]) -> None:
        """Handle navigation next action"""
        if not self.event_bus:
            return
            
        await self.event_bus.publish("navigation.request", {
            "direction": "next",
            "source": "gesture",
            "context": self.current_ui_context
        })
    
    async def _handle_navigation_menu(self, payload: Dict[str, Any]) -> None:
        """Handle navigation menu action"""
        if not self.event_bus:
            return
            
        await self.event_bus.publish("navigation.request", {
            "target": "menu",
            "source": "gesture",
            "context": self.current_ui_context
        })
    
    async def _handle_navigation_close(self, payload: Dict[str, Any]) -> None:
        """Handle navigation close action"""
        if not self.event_bus:
            return
            
        await self.event_bus.publish("navigation.request", {
            "action": "close",
            "source": "gesture",
            "context": self.current_ui_context
        })
    
    async def _handle_view_zoom_in(self, payload: Dict[str, Any]) -> None:
        """Handle view zoom in action"""
        if not self.event_bus:
            return
            
        # Get magnitude from gesture if available
        magnitude = 0.1  # Default zoom increment
        if "gesture" in payload and "magnitude" in payload["gesture"]:
            magnitude = min(0.25, max(0.05, payload["gesture"]["magnitude"] * 0.1))
            
        await self.event_bus.publish("view.zoom", {
            "direction": "in",
            "amount": magnitude,
            "source": "gesture",
            "context": self.current_ui_context
        })
    
    async def _handle_view_zoom_out(self, payload: Dict[str, Any]) -> None:
        """Handle view zoom out action"""
        if not self.event_bus:
            return
            
        # Get magnitude from gesture if available
        magnitude = 0.1  # Default zoom increment
        if "gesture" in payload and "magnitude" in payload["gesture"]:
            magnitude = min(0.25, max(0.05, payload["gesture"]["magnitude"] * 0.1))
            
        await self.event_bus.publish("view.zoom", {
            "direction": "out",
            "amount": magnitude,
            "source": "gesture",
            "context": self.current_ui_context
        })
    
    async def _handle_interaction_select(self, payload: Dict[str, Any]) -> None:
        """Handle interaction select action"""
        if not self.event_bus:
            return
            
        # Get position from gesture if available
        position = (0.5, 0.5)  # Default center position
        if "gesture" in payload and "position" in payload["gesture"]:
            position = payload["gesture"]["position"]
            
        # Find closest selectable element at position
        element_id = self._find_element_at_position(position)
            
        await self.event_bus.publish("interaction.select", {
            "element_id": element_id,
            "position": position,
            "source": "gesture",
            "context": self.current_ui_context
        })
    
    async def _handle_interaction_activate(self, payload: Dict[str, Any]) -> None:
        """Handle interaction activate action"""
        if not self.event_bus:
            return
            
        # Get position from gesture if available
        position = (0.5, 0.5)  # Default center position
        if "gesture" in payload and "position" in payload["gesture"]:
            position = payload["gesture"]["position"]
            
        # Find closest activatable element at position
        element_id = self._find_element_at_position(position)
            
        await self.event_bus.publish("interaction.activate", {
            "element_id": element_id,
            "position": position,
            "source": "gesture",
            "context": self.current_ui_context
        })
    
    async def _handle_interaction_context_menu(self, payload: Dict[str, Any]) -> None:
        """Handle interaction context menu action"""
        if not self.event_bus:
            return
            
        # Get position from gesture if available
        position = (0.5, 0.5)  # Default center position
        if "gesture" in payload and "position" in payload["gesture"]:
            position = payload["gesture"]["position"]
            
        await self.event_bus.publish("interaction.context_menu", {
            "position": position,
            "source": "gesture",
            "context": self.current_ui_context
        })
    
    async def _handle_edit_undo(self, payload: Dict[str, Any]) -> None:
        """Handle edit undo action"""
        if not self.event_bus:
            return
            
        await self.event_bus.publish("edit.request", {
            "action": "undo",
            "source": "gesture",
            "context": self.current_ui_context
        })
    
    # ---------------------------------------------------------------
    # Helper methods
    # ---------------------------------------------------------------
    
    def _find_element_at_position(self, position: tuple) -> Optional[str]:
        """
        Find the closest UI element at the given position
        
        Args:
            position: Normalized (x, y) position
            
        Returns:
            Element ID if found, None otherwise
        """
        if not self.gesture_enabled_elements:
            return None
            
        # Find closest element (in a real implementation, this would use
        # actual element positions and dimensions from the UI context)
        closest_element = None
        closest_distance = float('inf')
        
        for element in self.gesture_enabled_elements:
            if "position" in element:
                element_pos = element["position"]
                distance = ((position[0] - element_pos[0]) ** 2 + 
                           (position[1] - element_pos[1]) ** 2) ** 0.5
                
                if distance < closest_distance:
                    closest_distance = distance
                    closest_element = element
        
        return closest_element["id"] if closest_element else None
    
    def update_configuration(self, config: Dict[str, Any]) -> None:
        """
        Update integration configuration
        
        Args:
            config: New configuration settings
        """
        # Update arpeggiator configuration if included
        if "arpeggiator" in config:
            self.arpeggiator.update_configuration(config["arpeggiator"])
            
        # Update config manager if available
        if self.config_manager:
            self.config_manager.update_config("gesture_integration", config)
            
        logger.info("Gesture Integration configuration updated")
    
    async def initialize(self) -> None:
        """Initialize the gesture integration system"""
        logger.info("Initializing Gesture Integration")
        
        # Publish initialization event
        if self.event_bus:
            await self.event_bus.publish("system.component_ready", {
                "component": "gesture_integration",
                "capabilities": [
                    "gesture_recognition",
                    "gesture_navigation",
                    "gesture_interaction"
                ]
            })


# Export public API
__all__ = ["GestureIntegration"]
