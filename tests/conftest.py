"""
Pytest configuration and fixtures for ALEJO tests
"""

import pytest
import pytest_asyncio
import asyncio
import os
import sys
import logging
from unittest.mock import Mock, patch
from pathlib import Path

# Add project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# Now we can import from alejo
from PySide6.QtWidgets import QApplication
from alejo.database.memory_store import MemoryStore
from alejo.cognitive.memory.episodic_memory import EpisodicMemory
from alejo.cognitive.memory.semantic_memory import SemanticMemory
from alejo.cognitive.memory.working_memory import WorkingMemory
from alejo.core.event_bus import EventBus, EventType
from .mocks.event_bus import MockEventBus

logger = logging.getLogger(__name__)

# Let pytest-asyncio handle event loop management
# This ensures proper async fixture handling and test execution

# Configure test database path
@pytest.fixture(scope="session")
def test_db_path(tmp_path_factory):
    """Create a temporary directory for test databases."""
    db_dir = tmp_path_factory.mktemp("test_db")
    return str(db_dir / "test.db")

# Clean up test files after tests
@pytest.fixture(autouse=True)
def cleanup_test_files(request):
    """Clean up any test files after each test.
    
    This fixture:
    1. Tracks temporary files created during tests
    2. Cleans up any test artifacts in the test's directory
    3. Removes any temporary databases created
    
    The cleanup runs automatically after each test.
    """
    # Store the test's directory for cleanup
    test_dir = Path(request.module.__file__).parent
    temp_files = []
    
    def _register_temp_file(path):
        """Register a temporary file for cleanup"""
        temp_files.append(Path(path))
    
    # Make temp file registration available to the test
    request.node.register_temp_file = _register_temp_file
    
    yield
    
    try:
        # Clean up registered temp files
        for file in temp_files:
            try:
                if file.exists():
                    if file.is_file():
                        file.unlink()
                    elif file.is_dir():
                        file.rmdir()
            except Exception as e:
                logger.warning(f"Failed to remove temp file {file}: {e}")
        
        # Clean up common test artifacts
        patterns = [
            "*.pyc",
            "*.pyo",
            "*.pyd",
            "*.db",
            "*.sqlite",
            "*.coverage",
            "test_*.json",
            "*.log"
        ]
        
        for pattern in patterns:
            for file in test_dir.glob(pattern):
                try:
                    if file.is_file():
                        file.unlink()
                except Exception as e:
                    logger.warning(f"Failed to remove artifact {file}: {e}")
                    
    except Exception as e:
        logger.error(f"Error during test cleanup: {e}")

# Create mock event bus
@pytest.fixture
def event_bus():
    """Create a mock event bus for testing."""
    return MockEventBus()

@pytest_asyncio.fixture
async def real_event_bus():
    """Create a real event bus for integration testing."""
    # Use test-specific configuration that doesn't connect to Redis during collection
    bus = EventBus(redis_url="redis://localhost:6379/0", test_mode=True)
    # Only start the bus when the test actually runs, not during collection
    yield bus
    # Clean up after test
    if hasattr(bus, 'running') and bus.running:
        await bus.stop()
    await bus.stop()

@pytest.fixture
def config():
    """Create test configuration."""
    return {}

@pytest.fixture
def mock_brain():
    """Create a mock brain for testing."""
    brain = Mock()
    brain.process_text = Mock()
    return brain

@pytest.fixture
def mock_ui():
    """Create a mock UI for testing."""
    ui = Mock()
    ui.show_proactive_prompt = Mock()
    return ui

@pytest.fixture
def mock_voice():
    """Create a mock voice service for testing."""
    voice = Mock()
    voice.speak = Mock()
    return voice

# Create memory store
@pytest_asyncio.fixture
async def memory_store(test_db_path):
    """Create a test memory store."""
    store = MemoryStore(test_db_path)
    await store.initialize()
    yield store
    await store.close()

# Create episodic memory
@pytest_asyncio.fixture
async def episodic_memory(event_bus, memory_store):
    """Create an episodic memory system."""
    return EpisodicMemory(event_bus, memory_store)

# Create semantic memory
@pytest_asyncio.fixture
async def semantic_memory(event_bus, memory_store):
    """Create a semantic memory system."""
    return SemanticMemory(event_bus, memory_store)

# Create working memory
@pytest_asyncio.fixture
async def working_memory(event_bus, episodic_memory, semantic_memory):
    """Create a working memory system."""
    return WorkingMemory(event_bus, episodic_memory, semantic_memory)