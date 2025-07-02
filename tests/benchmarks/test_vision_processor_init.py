"""
Minimal test file to debug VisionProcessor initialization
"""

import logging
import secrets  # More secure for cryptographic purposes
from unittest.mock import AsyncMock, MagicMock

import pytest

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


def test_vision_processor_import():
    """Test that we can import VisionProcessor"""
    logger.info("Attempting to import VisionProcessor...")
    try:
        from alejo.vision.processor import VisionProcessor

        logger.info("Successfully imported VisionProcessor")
        assert True
    except Exception as e:
        logger.error(f"Failed to import VisionProcessor: {str(e)}")
        raise


@pytest.mark.asyncio
async def test_vision_processor_init():
    """Test that we can initialize VisionProcessor with minimal dependencies"""
    logger.info("Starting VisionProcessor initialization test...")

    try:
        from alejo.core.event_bus import EventBus
        from alejo.vision.processor import VisionProcessor

        # Create mock dependencies
        mock_event_bus = MagicMock(spec=EventBus)
        mock_event_bus.publish = AsyncMock()

        logger.info("Creating VisionProcessor instance...")
        processor = VisionProcessor(event_bus=mock_event_bus)
        logger.info("Successfully created VisionProcessor instance")

        logger.info("Starting vision processing...")
        await processor.start_processing()
        logger.info("Successfully started vision processing")

        assert processor.initialized, "VisionProcessor should be initialized"

        # Cleanup
        logger.info("Stopping vision processing...")
        await processor.stop_processing()
        logger.info("Successfully stopped vision processing")

    except Exception as e:
        logger.error(f"Test failed: {str(e)}")
        raise
