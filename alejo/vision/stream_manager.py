"""
Vision Stream Manager for ALEJO.
Integrates optimized video stream with vision processor for efficient frame processing.
"""

import asyncio
import logging
from typing import Optional, Dict, Any
from dataclasses import dataclass

from .optimized_stream import OptimizedVideoStream, StreamConfig
from .processor import VisionProcessor
from ..core.event_bus import EventBus
from ..utils.error_handling import handle_errors, VisionError

logger = logging.getLogger(__name__)

@dataclass
class StreamManagerConfig:
    """Configuration for the stream manager"""
    stream_config: Optional[StreamConfig] = None
    enable_gpu: bool = True
    max_batch_size: int = 4
    buffer_size: int = 30
    frame_rate: int = 30

class StreamManager:
    """
    High-level manager for vision stream processing.
    Coordinates between OptimizedVideoStream and VisionProcessor.
    """
    
    def __init__(
        self,
        vision_processor: VisionProcessor,
        event_bus: Optional[EventBus] = None,
        config: Optional[StreamManagerConfig] = None
    ):
        """Initialize stream manager
        
        Args:
            vision_processor: VisionProcessor instance
            event_bus: Optional event bus for events
            config: Optional configuration
        """
        self.vision_processor = vision_processor
        self.event_bus = event_bus
        self.config = config or StreamManagerConfig()
        
        # Create optimized stream
        stream_config = self.config.stream_config or StreamConfig(
            frame_rate=self.config.frame_rate,
            buffer_size=self.config.buffer_size,
            batch_size=self.config.max_batch_size,
            enable_gpu=self.config.enable_gpu
        )
        self.stream = OptimizedVideoStream(
            vision_processor=vision_processor,
            event_bus=event_bus,
            config=stream_config
        )
        
        # Processing state
        self.is_running = False
        self.current_metrics = {}
    
    @handle_errors(component='stream_manager', category='stream')
    async def start(self, camera_manager) -> bool:
        """Start stream processing
        
        Args:
            camera_manager: Camera manager instance
            
        Returns:
            bool: True if started successfully
        """
        if self.is_running:
            return False
            
        try:
            # Start vision processor if not running
            if not self.vision_processor.processing_enabled:
                await self.vision_processor.start_processing()
            
            # Start optimized stream
            success = await self.stream.start(camera_manager)
            if not success:
                raise VisionError("Failed to start optimized stream")
                
            self.is_running = True
            logger.info("Vision stream manager started")
            return True
            
        except Exception as e:
            logger.error(f"Failed to start stream manager: {e}")
            await self.stop()
            return False
    
    async def stop(self) -> bool:
        """Stop stream processing"""
        if not self.is_running:
            return False
            
        try:
            # Stop optimized stream
            await self.stream.stop()
            
            # Stop vision processor
            await self.vision_processor.stop_processing()
            
            self.is_running = False
            logger.info("Vision stream manager stopped")
            return True
            
        except Exception as e:
            logger.error(f"Error stopping stream manager: {e}")
            return False
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get current performance metrics"""
        metrics = {
            'stream': self.stream.get_metrics(),
            'vision': self.vision_processor.processing_stats
        }
        
        # Calculate aggregate metrics
        if metrics['stream']['processing_time'] > 0:
            metrics['aggregate'] = {
                'total_fps': 1.0 / metrics['stream']['processing_time'],
                'batch_size': metrics['stream']['batch_size'],
                'gpu_utilization': metrics['vision']['gpu_utilization']
            }
        
        return metrics
