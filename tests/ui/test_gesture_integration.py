import pytest
import asyncio
from unittest.mock import MagicMock, patch, AsyncMock

from alejo.ui.gesture_integration import GestureIntegration
from alejo.config.config_manager import ConfigManager
from alejo.events.event_bus import EventBus


class TestGestureIntegration:
    @pytest.fixture
    def event_bus(self):
        return MagicMock(spec=EventBus)
        
    @pytest.fixture
    def config_manager(self):
        config = {
            "gesture_integration": {
                "enabled": True,
                "default_confidence_threshold": 0.7,
                "action_handlers": {
                    "navigation": True,
                    "zoom": True,
                    "interaction": True,
                    "system": True
                }
            }
        }
        manager = MagicMock(spec=ConfigManager)
        manager.get_config.return_value = config
        return manager
        
    @pytest.fixture
    def gesture_integration(self, event_bus, config_manager):
        return GestureIntegration(event_bus, config_manager)
        
    def test_initialization(self, gesture_integration, event_bus, config_manager):
        """Test that GestureIntegration initializes correctly."""
        assert gesture_integration.event_bus == event_bus
        assert gesture_integration.config_manager == config_manager
        assert gesture_integration.enabled is True
        assert gesture_integration.confidence_threshold == 0.7
        assert gesture_integration.ui_context == "default"
        assert all(gesture_integration.action_handlers.values())
        
        # Verify event subscriptions were set up
        event_bus.subscribe.assert_any_call("gesture.action", gesture_integration.handle_gesture_action)
        event_bus.subscribe.assert_any_call("ui.context_changed", gesture_integration.update_ui_context)
        event_bus.subscribe.assert_any_call("config.updated.gesture_integration", gesture_integration.update_config)
        
    @pytest.mark.asyncio
    async def test_handle_gesture_action_navigation(self, gesture_integration):
        """Test handling navigation gesture actions."""
        gesture_integration.handle_navigation_action = AsyncMock()
        
        action_event = {
            "action_type": "navigation",
            "direction": "forward",
            "confidence": 0.8,
            "source_element": "main-content"
        }
        
        await gesture_integration.handle_gesture_action(action_event)
        gesture_integration.handle_navigation_action.assert_awaited_once_with(action_event)
        
    @pytest.mark.asyncio
    async def test_handle_gesture_action_zoom(self, gesture_integration):
        """Test handling zoom gesture actions."""
        gesture_integration.handle_zoom_action = AsyncMock()
        
        action_event = {
            "action_type": "zoom",
            "direction": "in",
            "magnitude": 0.5,
            "confidence": 0.9,
            "source_element": "image-viewer"
        }
        
        await gesture_integration.handle_gesture_action(action_event)
        gesture_integration.handle_zoom_action.assert_awaited_once_with(action_event)
        
    @pytest.mark.asyncio
    async def test_handle_gesture_action_interaction(self, gesture_integration):
        """Test handling interaction gesture actions."""
        gesture_integration.handle_interaction_action = AsyncMock()
        
        action_event = {
            "action_type": "interaction",
            "interaction": "select",
            "confidence": 0.85,
            "source_element": "dropdown-menu"
        }
        
        await gesture_integration.handle_gesture_action(action_event)
        gesture_integration.handle_interaction_action.assert_awaited_once_with(action_event)
        
    @pytest.mark.asyncio
    async def test_handle_gesture_action_system(self, gesture_integration):
        """Test handling system gesture actions."""
        gesture_integration.handle_system_action = AsyncMock()
        
        action_event = {
            "action_type": "system",
            "command": "undo",
            "confidence": 0.95
        }
        
        await gesture_integration.handle_gesture_action(action_event)
        gesture_integration.handle_system_action.assert_awaited_once_with(action_event)
        
    @pytest.mark.asyncio
    async def test_handle_gesture_action_low_confidence(self, gesture_integration, event_bus):
        """Test that low confidence gesture actions are ignored."""
        action_event = {
            "action_type": "navigation",
            "direction": "forward",
            "confidence": 0.5  # Below threshold of 0.7
        }
        
        await gesture_integration.handle_gesture_action(action_event)
        # Verify no action handlers were called and feedback was published
        event_bus.publish.assert_called_once()
        assert "feedback" in event_bus.publish.call_args[0][0]
        
    @pytest.mark.asyncio
    async def test_handle_gesture_action_disabled_handler(self, gesture_integration):
        """Test that actions with disabled handlers are ignored."""
        # Disable the navigation handler
        gesture_integration.action_handlers["navigation"] = False
        
        action_event = {
            "action_type": "navigation",
            "direction": "forward",
            "confidence": 0.8
        }
        
        await gesture_integration.handle_gesture_action(action_event)
        # Verify no handlers were called
        assert not hasattr(gesture_integration, "handle_navigation_action") or \
               not gesture_integration.handle_navigation_action.called
        
    @pytest.mark.asyncio
    async def test_handle_navigation_action(self, gesture_integration, event_bus):
        """Test navigation action handling."""
        action_event = {
            "action_type": "navigation",
            "direction": "forward",
            "confidence": 0.8,
            "source_element": "dashboard-section"
        }
        
        await gesture_integration.handle_navigation_action(action_event)
        event_bus.publish.assert_called_with("navigation.request", {
            "direction": "forward",
            "source": "gesture",
            "element_id": "dashboard-section"
        })
        
    @pytest.mark.asyncio
    async def test_handle_zoom_action(self, gesture_integration, event_bus):
        """Test zoom action handling."""
        action_event = {
            "action_type": "zoom",
            "direction": "in",
            "magnitude": 0.5,
            "confidence": 0.9,
            "source_element": "metrics-table"
        }
        
        await gesture_integration.handle_zoom_action(action_event)
        event_bus.publish.assert_called_with("ui.zoom", {
            "direction": "in",
            "magnitude": 0.5,
            "element_id": "metrics-table",
            "source": "gesture"
        })
        
    @pytest.mark.asyncio
    async def test_handle_interaction_action(self, gesture_integration, event_bus):
        """Test interaction action handling."""
        action_event = {
            "action_type": "interaction",
            "interaction": "select",
            "confidence": 0.85,
            "source_element": "services-list"
        }
        
        await gesture_integration.handle_interaction_action(action_event)
        event_bus.publish.assert_called_with("ui.interaction", {
            "type": "select",
            "element_id": "services-list",
            "source": "gesture"
        })
        
    @pytest.mark.asyncio
    async def test_handle_system_action(self, gesture_integration, event_bus):
        """Test system action handling."""
        action_event = {
            "action_type": "system",
            "command": "refresh",
            "confidence": 0.95
        }
        
        await gesture_integration.handle_system_action(action_event)
        event_bus.publish.assert_called_with("system.command", {
            "command": "refresh",
            "source": "gesture"
        })
        
    def test_update_ui_context(self, gesture_integration):
        """Test UI context updates."""
        context_event = {
            "context": "editing",
            "element_id": "content-editor"
        }
        
        gesture_integration.update_ui_context(context_event)
        assert gesture_integration.ui_context == "editing"
        assert gesture_integration.active_element_id == "content-editor"
        
    def test_update_config(self, gesture_integration):
        """Test configuration updates."""
        new_config = {
            "enabled": False,
            "default_confidence_threshold": 0.8,
            "action_handlers": {
                "navigation": True,
                "zoom": False,
                "interaction": True,
                "system": False
            }
        }
        
        gesture_integration.update_config(new_config)
        assert gesture_integration.enabled is False
        assert gesture_integration.confidence_threshold == 0.8
        assert gesture_integration.action_handlers["navigation"] is True
        assert gesture_integration.action_handlers["zoom"] is False
        assert gesture_integration.action_handlers["interaction"] is True
        assert gesture_integration.action_handlers["system"] is False
        
    @pytest.mark.asyncio
    async def test_register_gesture_elements(self, gesture_integration, event_bus):
        """Test registering gesture-enabled elements."""
        elements = [
            {"id": "dashboard-section", "gesture_actions": ["expand", "collapse"]},
            {"id": "metrics-table", "gesture_actions": ["sort", "filter"]}
        ]
        
        await gesture_integration.register_gesture_elements(elements)
        event_bus.publish.assert_called_with("gesture.elements.registered", {
            "elements": elements,
            "context": "default"
        })
        
    @pytest.mark.asyncio
    async def test_announce_gesture_feedback(self, gesture_integration, event_bus):
        """Test announcing gesture feedback for accessibility."""
        await gesture_integration.announce_gesture_feedback("Zoom gesture recognized", "info")
        event_bus.publish.assert_called_with("ui.accessibility.announce", {
            "message": "Zoom gesture recognized",
            "priority": "info",
            "source": "gesture"
        })
        
    @pytest.mark.asyncio
    async def test_integration_with_dashboard(self, gesture_integration, event_bus):
        """Test integration with the dashboard template."""
        # Simulate registering dashboard elements
        dashboard_elements = [
            {"id": "services-heading", "gesture_actions": ["expand"]},
            {"id": "metrics-heading", "gesture_actions": ["sort"]}
        ]
        
        await gesture_integration.register_gesture_elements(dashboard_elements)
        
        # Simulate a gesture action on the services section
        action_event = {
            "action_type": "interaction",
            "interaction": "expand",
            "confidence": 0.9,
            "source_element": "services-heading"
        }
        
        gesture_integration.handle_interaction_action = AsyncMock()
        await gesture_integration.handle_gesture_action(action_event)
        
        # Verify the interaction handler was called
        gesture_integration.handle_interaction_action.assert_awaited_once_with(action_event)
