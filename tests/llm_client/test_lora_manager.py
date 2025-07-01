"""
Tests for the ALEJO LoRA Manager Module

This module contains tests for the LoRAManager class and related functionality.
"""

import os
import sys
import time
import asyncio
import pytest
import json
from unittest.mock import MagicMock, patch
from typing import Dict, List, Any
import tempfile
import shutil

# Import ALEJO modules
from alejo.llm_client.lora_manager import LoRAManager, get_lora_manager
from alejo.utils.events import EventBus
from alejo.utils.exceptions import LoRAError
import secrets  # More secure for cryptographic purposes

# Test fixtures
@pytest.fixture
def event_bus():
    """Create an event bus for testing"""
    return EventBus()

@pytest.fixture
def temp_dir():
    """Create a temporary directory for testing"""
    temp_dir = tempfile.mkdtemp()
    yield temp_dir
    shutil.rmtree(temp_dir)

@pytest.fixture
def lora_manager(event_bus, temp_dir):
    """Create a LoRA manager for testing"""
    base_model_path = os.path.join(temp_dir, "model.bin")
    # Create empty model file
    with open(base_model_path, 'w') as f:
        f.write("mock model")
    
    # Create LoRA directory
    lora_dir = os.path.join(temp_dir, "lora_adapters")
    os.makedirs(lora_dir, exist_ok=True)
    
    return LoRAManager(
        event_bus=event_bus,
        base_model_path=base_model_path,
        lora_dir=lora_dir
    )

# Tests
@pytest.mark.asyncio
async def test_initialization(lora_manager):
    """Test initialization of the LoRA manager"""
    assert lora_manager is not None
    assert lora_manager.event_bus is not None
    assert lora_manager.base_model_path is not None
    assert lora_manager.lora_dir is not None
    assert os.path.exists(lora_manager.lora_dir)
    assert lora_manager.config is not None
    assert "auto_select_enabled" in lora_manager.config
    assert "adapter_selection" in lora_manager.config

@pytest.mark.asyncio
async def test_create_adapter(lora_manager):
    """Test creating a new adapter"""
    # Create a new adapter
    metadata = await lora_manager.create_adapter(
        name="test_adapter",
        description="Test adapter for unit tests",
        task_type="testing"
    )
    
    # Check that the adapter was created
    assert metadata is not None
    assert metadata["name"] == "test_adapter"
    assert metadata["description"] == "Test adapter for unit tests"
    assert metadata["task_type"] == "testing"
    
    # Check that the adapter directory was created
    adapter_path = os.path.join(lora_manager.lora_dir, "test_adapter")
    assert os.path.exists(adapter_path)
    
    # Check that the metadata file was created
    metadata_path = os.path.join(adapter_path, "metadata.json")
    assert os.path.exists(metadata_path)
    
    # Check that the metadata file contains the correct data
    with open(metadata_path, 'r') as f:
        loaded_metadata = json.load(f)
    
    assert loaded_metadata["name"] == "test_adapter"
    assert loaded_metadata["description"] == "Test adapter for unit tests"
    assert loaded_metadata["task_type"] == "testing"

@pytest.mark.asyncio
async def test_list_available_adapters(lora_manager):
    """Test listing available adapters"""
    # Create some adapters
    await lora_manager.create_adapter(
        name="adapter1",
        description="Adapter 1",
        task_type="task1"
    )
    
    await lora_manager.create_adapter(
        name="adapter2",
        description="Adapter 2",
        task_type="task2"
    )
    
    # List adapters
    adapters = await lora_manager.list_available_adapters()
    
    # Check that the adapters were listed
    assert len(adapters) == 2
    
    # Check that the adapter metadata is correct
    adapter_names = [adapter["name"] for adapter in adapters]
    assert "adapter1" in adapter_names
    assert "adapter2" in adapter_names

@pytest.mark.asyncio
async def test_hot_swap_adapter(lora_manager):
    """Test hot-swapping adapters"""
    # Create some adapters
    await lora_manager.create_adapter(
        name="adapter1",
        description="Adapter 1",
        task_type="task1"
    )
    
    await lora_manager.create_adapter(
        name="adapter2",
        description="Adapter 2",
        task_type="task2"
    )
    
    # Hot-swap to adapter1
    result = await lora_manager.hot_swap_adapter("adapter1")
    
    # Check that the hot-swap was successful
    assert result is True
    assert lora_manager.active_adapter == "adapter1"
    assert "adapter1" in lora_manager.loaded_adapters
    
    # Hot-swap to adapter2
    result = await lora_manager.hot_swap_adapter("adapter2")
    
    # Check that the hot-swap was successful
    assert result is True
    assert lora_manager.active_adapter == "adapter2"
    assert "adapter2" in lora_manager.loaded_adapters
    assert "adapter1" not in lora_manager.loaded_adapters

@pytest.mark.asyncio
async def test_delete_adapter(lora_manager):
    """Test deleting an adapter"""
    # Create an adapter
    await lora_manager.create_adapter(
        name="adapter_to_delete",
        description="Adapter to delete",
        task_type="task"
    )
    
    # Check that the adapter exists
    adapter_path = os.path.join(lora_manager.lora_dir, "adapter_to_delete")
    assert os.path.exists(adapter_path)
    
    # Delete the adapter
    result = await lora_manager.delete_adapter("adapter_to_delete")
    
    # Check that the delete was successful
    assert result is True
    assert not os.path.exists(adapter_path)

@pytest.mark.asyncio
async def test_benchmark_adapter(lora_manager):
    """Test benchmarking an adapter"""
    # Create an adapter
    await lora_manager.create_adapter(
        name="adapter_to_benchmark",
        description="Adapter to benchmark",
        task_type="task"
    )
    
    # Benchmark the adapter
    results = await lora_manager.benchmark_adapter("adapter_to_benchmark")
    
    # Check that the benchmark results are valid
    assert results is not None
    assert "hot_swap_time" in results
    assert "inference_time" in results
    assert "memory_usage" in results
    
    # Check that the benchmark results were saved to the adapter metadata
    metadata_path = os.path.join(lora_manager.lora_dir, "adapter_to_benchmark", "metadata.json")
    with open(metadata_path, 'r') as f:
        metadata = json.load(f)
    
    assert "benchmarks" in metadata
    assert len(metadata["benchmarks"]) == 1

@pytest.mark.asyncio
async def test_task_detection(lora_manager, event_bus):
    """Test task detection from messages"""
    # Create a message with code-related content
    message = "Can you help me write a Python function to sort a list?"
    
    # Create a message event
    message_event = {
        "message": message,
        "message_id": "123"
    }
    
    # Create a spy for the event bus emit method
    original_emit = event_bus.emit
    emitted_events = []
    
    async def spy_emit(event_name, data):
        emitted_events.append((event_name, data))
        return await original_emit(event_name, data)
    
    # Replace the emit method with our spy
    event_bus.emit = spy_emit
    
    try:
        # Trigger the message received event
        await event_bus.emit("brain.message_received", message_event)
        
        # Wait for event processing
        await asyncio.sleep(0.1)
        
        # Check that the task detection event was emitted
        task_events = [(name, data) for name, data in emitted_events if name == "brain.task_detected"]
        assert len(task_events) == 1
        
        # Check that the task type is correct
        task_event = task_events[0]
        assert task_event[1]["task_type"] == "code_generation"
        assert task_event[1]["message_id"] == "123"
    finally:
        # Restore the original emit method
        event_bus.emit = original_emit

@pytest.mark.asyncio
async def test_singleton_instance():
    """Test singleton instance"""
    # Create an event bus
    event_bus = EventBus()
    
    # Create a temporary directory
    temp_dir = tempfile.mkdtemp()
    try:
        # Create a base model path
        base_model_path = os.path.join(temp_dir, "model.bin")
        with open(base_model_path, 'w') as f:
            f.write("mock model")
        
        # Get singleton instance
        manager1 = get_lora_manager(
            event_bus=event_bus,
            base_model_path=base_model_path
        )
        
        # Get singleton instance again
        manager2 = get_lora_manager()
        
        # Check that both instances are the same
        assert manager1 is manager2
    finally:
        # Clean up
        shutil.rmtree(temp_dir)

@pytest.mark.asyncio
async def test_adapter_error_handling(lora_manager):
    """Test error handling for non-existent adapters"""
    # Try to hot-swap to a non-existent adapter
    with pytest.raises(LoRAError):
        await lora_manager.hot_swap_adapter("non_existent_adapter")
    
    # Try to delete a non-existent adapter
    with pytest.raises(LoRAError):
        await lora_manager.delete_adapter("non_existent_adapter")
    
    # Try to benchmark a non-existent adapter
    with pytest.raises(LoRAError):
        await lora_manager.benchmark_adapter("non_existent_adapter")