"""
Tests for the Memory Optimization module
"""

import os
import sys
import time
import pytest
from unittest.mock import MagicMock, patch
import tempfile
import gc

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from alejo.utils.memory_optimization import (
    MemoryOptimizer, 
    lazy_load, 
    get_memory_optimizer
)

# Mock classes
class MockModel:
    """Mock model for testing"""
    
    def __init__(self, name="test_model"):
        self.name = name
        self.unloaded = False
        self.parameters_called = False
        self.cpu_called = False
    
    def unload(self):
        """Mock unload method"""
        self.unloaded = True
    
    def cpu(self):
        """Mock cpu method"""
        self.cpu_called = True
    
    def parameters(self):
        """Mock parameters method"""
        self.parameters_called = True
        # Return a list of mock parameters
        param = MagicMock()
        param.data = MagicMock()
        param.nelement.return_value = 1000000  # 1M elements
        param.element_size.return_value = 4    # 4 bytes per element
        return [param]

# Fixtures
@pytest.fixture
def memory_optimizer():
    """Create a memory optimizer for testing"""
    optimizer = MemoryOptimizer({
        'memory_optimization': True,
        'high_memory_percent': 90.0,
        'critical_memory_percent': 95.0,
        'model_unload_threshold_minutes': 0.01,  # 0.6 seconds for faster testing
        'cache_size_mb': 10
    })
    
    yield optimizer
    
    # Cleanup
    optimizer.shutdown()

# Tests
def test_initialization():
    """Test initialization of memory optimizer"""
    optimizer = MemoryOptimizer()
    assert optimizer.enabled
    assert 'high_memory_percent' in optimizer.thresholds
    assert 'critical_memory_percent' in optimizer.thresholds
    
    # Cleanup
    optimizer.shutdown()

def test_register_model(memory_optimizer):
    """Test registering a model"""
    model = MockModel()
    memory_optimizer.register_model("test_model", model)
    
    # Check that model was registered
    assert "test_model" in memory_optimizer._active_models
    assert memory_optimizer._active_models["test_model"]["unloadable"]
    assert not memory_optimizer._active_models["test_model"]["essential"]

def test_unregister_model(memory_optimizer):
    """Test unregistering a model"""
    model = MockModel()
    memory_optimizer.register_model("test_model", model)
    memory_optimizer.unregister_model("test_model")
    
    # Check that model was unregistered
    assert "test_model" not in memory_optimizer._active_models

def test_mark_model_used(memory_optimizer):
    """Test marking a model as used"""
    model = MockModel()
    memory_optimizer.register_model("test_model", model)
    
    # Get initial last_used time
    initial_time = memory_optimizer._active_models["test_model"]["last_used"]
    
    # Wait a bit
    time.sleep(0.1)
    
    # Mark as used
    memory_optimizer.mark_model_used("test_model")
    
    # Check that last_used was updated
    assert memory_optimizer._active_models["test_model"]["last_used"] > initial_time

def test_cleanup_unused_models(memory_optimizer):
    """Test cleaning up unused models"""
    # Register a model
    model = MockModel()
    memory_optimizer.register_model("test_model", model)
    
    # Wait for cleanup (threshold is 0.01 minutes = 0.6 seconds)
    time.sleep(1.0)
    
    # Trigger cleanup
    memory_optimizer._cleanup_unused_models()
    
    # Check that model was unloaded
    assert "test_model" not in memory_optimizer._active_models

def test_essential_model_not_unloaded(memory_optimizer):
    """Test that essential models are not unloaded"""
    # Register an essential model
    model = MockModel()
    memory_optimizer.register_model("essential_model", model, essential=True)
    
    # Wait for cleanup
    time.sleep(1.0)
    
    # Trigger cleanup
    memory_optimizer._cleanup_unused_models()
    
    # Check that model was not unloaded
    assert "essential_model" in memory_optimizer._active_models

def test_unload_model(memory_optimizer):
    """Test unloading a model"""
    # Register a model
    model = MockModel()
    memory_optimizer.register_model("test_model", model)
    
    # Unload model
    memory_optimizer._unload_model("test_model")
    
    # Check that model was unloaded
    assert "test_model" not in memory_optimizer._active_models
    assert model.unloaded

def test_unload_torch_model(memory_optimizer):
    """Test unloading a torch-like model"""
    # Register a model without unload method but with cpu method
    model = MockModel()
    del model.unload  # Remove unload method
    memory_optimizer.register_model("torch_model", model)
    
    # Unload model
    memory_optimizer._unload_model("torch_model")
    
    # Check that model was unloaded
    assert "torch_model" not in memory_optimizer._active_models
    assert model.cpu_called

def test_estimate_model_size(memory_optimizer):
    """Test estimating model size"""
    # Create a model with parameters
    model = MockModel()
    
    # Estimate size
    size_mb = memory_optimizer._estimate_model_size(model)
    
    # Check size (should be 4MB based on our mock)
    assert size_mb > 0

def test_cache_result(memory_optimizer):
    """Test caching a result"""
    # Cache a result
    memory_optimizer.cache_result("test_key", "test_result", ttl_seconds=1)
    
    # Get cached result
    result = memory_optimizer.get_cached_result("test_key")
    
    # Check result
    assert result == "test_result"
    
    # Check hit count
    assert memory_optimizer._cache_info["test_key"]["hits"] == 1

def test_cache_expiration(memory_optimizer):
    """Test cache expiration"""
    # Cache a result with short TTL
    memory_optimizer.cache_result("test_key", "test_result", ttl_seconds=0.1)
    
    # Wait for expiration
    time.sleep(0.2)
    
    # Try to get expired result
    result = memory_optimizer.get_cached_result("test_key")
    
    # Check that result is None
    assert result is None
    assert "test_key" not in memory_optimizer._result_cache
    assert "test_key" not in memory_optimizer._cache_info

def test_cleanup_cache(memory_optimizer):
    """Test cleaning up cache"""
    # Cache multiple results with different TTLs
    memory_optimizer.cache_result("key1", "result1", ttl_seconds=0.1)
    memory_optimizer.cache_result("key2", "result2", ttl_seconds=60)
    
    # Wait for first key to expire
    time.sleep(0.2)
    
    # Trigger cache cleanup
    memory_optimizer._cleanup_cache()
    
    # Check that expired key was removed
    assert "key1" not in memory_optimizer._result_cache
    assert "key1" not in memory_optimizer._cache_info
    
    # Check that non-expired key remains
    assert "key2" in memory_optimizer._result_cache
    assert "key2" in memory_optimizer._cache_info

def test_aggressive_cache_cleanup(memory_optimizer):
    """Test aggressive cache cleanup"""
    # Cache multiple results
    for i in range(10):
        memory_optimizer.cache_result(f"key{i}", f"result{i}", ttl_seconds=60)
        # Simulate different hit counts
        for _ in range(i):
            memory_optimizer.get_cached_result(f"key{i}")
    
    # Trigger aggressive cleanup
    memory_optimizer._cleanup_cache(aggressive=True)
    
    # Check that some keys were removed (least used first)
    assert "key0" not in memory_optimizer._result_cache
    assert "key9" in memory_optimizer._result_cache  # Most used should remain

def test_lazy_load_decorator():
    """Test lazy loading decorator"""
    load_count = 0
    
    @lazy_load
    def load_resource():
        nonlocal load_count
        load_count += 1
        return "resource"
    
    # First call should load
    result1 = load_resource()
    assert result1 == "resource"
    assert load_count == 1
    
    # Second call should use cached result
    result2 = load_resource()
    assert result2 == "resource"
    assert load_count == 1  # Still 1
    
    # Force reload
    result3 = load_resource.reload()
    assert result3 == "resource"
    assert load_count == 2  # Incremented

def test_get_memory_optimizer():
    """Test getting the singleton memory optimizer"""
    optimizer1 = get_memory_optimizer()
    optimizer2 = get_memory_optimizer()
    
    # Should be the same instance
    assert optimizer1 is optimizer2
    
    # Cleanup
    optimizer1.shutdown()

def test_emergency_memory_cleanup(memory_optimizer):
    """Test emergency memory cleanup"""
    # Register models
    model1 = MockModel("model1")
    model2 = MockModel("model2")
    memory_optimizer.register_model("model1", model1, essential=True)
    memory_optimizer.register_model("model2", model2, essential=False)
    
    # Cache results
    memory_optimizer.cache_result("key1", "result1")
    
    # Trigger emergency cleanup
    memory_optimizer._emergency_memory_cleanup()
    
    # Check that non-essential model was unloaded
    assert "model1" in memory_optimizer._active_models  # Essential remains
    assert "model2" not in memory_optimizer._active_models
    
    # Check that cache was cleared
    assert not memory_optimizer._result_cache
    assert not memory_optimizer._cache_info

if __name__ == "__main__":
    pytest.main(["-xvs", __file__])
