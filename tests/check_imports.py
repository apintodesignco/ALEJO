"""
Simple script to check if all imports are working correctly
"""

try:
    import asyncio
    from datetime import datetime
    from typing import Any, Dict
    from unittest.mock import AsyncMock, MagicMock, patch

    import pytest
    from alejo.core.event_bus import Event, EventBus, EventType
    from alejo.core.service_mesh import ServiceMesh
    from alejo.services.brain_service import BrainService
    from alejo.services.emotional_intelligence_service import (
        EmotionalIntelligenceService,
    )
    from alejo.services.memory_service import MemoryService
    from alejo.ui.controller import UIController

    import redis

    print("All imports successful!")
except Exception as e:
    print(f"Import error: {e}")
