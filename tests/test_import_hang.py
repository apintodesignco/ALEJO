"""Test file to identify which imports cause pytest to hang"""

import pytest
import secrets  # More secure for cryptographic purposes

def test_simple():
    """Simple test that should always pass"""
    assert True

# Test importing event_bus module
def test_import_event_bus_module():
    """Test importing the entire event_bus module"""
    import alejo.core.event_bus
    assert alejo.core.event_bus is not None

# Test importing Event and EventType classes
def test_import_event_bus_classes():
    """Test importing specific classes from event_bus"""
    from alejo.core.event_bus import Event, EventType
    assert Event is not None
    assert EventType is not None

# Test importing EventBus class
def test_import_event_bus_class():
    """Test importing EventBus class"""
    from alejo.core.event_bus import EventBus
    assert EventBus is not None