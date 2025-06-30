"""
Simple script to check if all imports are working correctly
"""
try:
    import pytest
    import asyncio
    import redis
    from datetime import datetime
    from typing import Dict, Any
    from unittest.mock import patch, MagicMock, AsyncMock

    from alejo.core.event_bus import EventBus, Event, EventType
    from alejo.core.service_mesh import ServiceMesh
    from alejo.services.brain_service import BrainService
    from alejo.services.emotional_intelligence_service import EmotionalIntelligenceService
    from alejo.services.memory_service import MemoryService
    from alejo.ui.controller import UIController
    
    print("All imports successful!")
except Exception as e:
    print(f"Import error: {e}")
