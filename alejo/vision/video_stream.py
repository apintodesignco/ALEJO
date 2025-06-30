"""
Video Stream Integration for ALEJO
Handles real-time video processing and camera integration
"""

import logging
import asyncio
import numpy as np
from typing import Optional, Dict, Any
from dataclasses import dataclass

from .processor import VisionProcessor
from ..core.event_bus import EventBus, Event, EventType
from ..utils.error_handling import handle_errors, ErrorTracker
from ..utils.exceptions import VisionError

logger = logging.getLogger("alejo.vision.video_stream")

@dataclass
class VideoStreamConfig:
    """Configuration for video stream processing"""
    frame_rate: int = 30  # Target frame rate
    buffer_size: int = 30  # Frame buffer size
    min_frame_interval: float = 0.033  # Minimum time between frames (1/30 sec)
    skip_similar_frames: bool = True  # Skip frames that are too similar
    similarity_threshold: float = 0.95  # Threshold for frame similarity

class VideoStreamManager:
    """
    Manages real-time video stream processing and camera integration
    Coordinates between CameraManager and VisionProcessor
    """
    
    def __init__(self, 
                 vision_processor: VisionProcessor,
                 event_bus: Optional[EventBus] = None,
                 config: Optional[VideoStreamConfig] = None):
        """Initialize video stream manager
        
        Args:
            vision_processor: VisionProcessor instance for frame analysis
            event_bus: Optional event bus for publishing events
            config: Optional video stream configuration
        """
        """
        Initialize video stream manager
        
        Args:
            vision_processor: VisionProcessor instance for frame analysis
            event_bus: Optional event bus for publishing events
            config: Optional video stream configuration
        """
        self.vision_processor = vision_processor
        self.event_bus = event_bus
        self.config = config or VideoStreamConfig()
        self.error_tracker = ErrorTracker()
        
        self.frame_buffer = asyncio.Queue(maxsize=self.config.buffer_size)
        self.processing_task = None
        self.capture_task = None
        self.is_running = False
        self.last_frame_time = 0
        self.last_processed_frame = None
        
        logger.info("Video stream manager initialized")
    
    async def start(self, camera_manager) -> bool:
        """
        Start video stream processing
        
        Args:
            camera_manager: CameraManager instance for video capture
            
        Returns:
            bool: True if started successfully
        """
        if self.is_running:
            logger.warning("Video stream already running")
            return False
            
        try:
            # Start camera if not already running
            if not camera_manager.active_camera:
                success = camera_manager.start_camera()
                if not success:
                    raise VisionError("Failed to start camera")
            
            self.is_running = True
            
            # Start capture and processing tasks
            self.capture_task = asyncio.create_task(
                self._capture_frames(camera_manager)
            )
            self.processing_task = asyncio.create_task(
                self._process_frames()
            )
            
            logger.info("Video stream started")
            return True
            
        except Exception as e:
            logger.error(f"Failed to start video stream: {e}")
            self.is_running = False
            return False
    
    async def stop(self) -> bool:
        """Stop video stream processing"""
        if not self.is_running:
            return False
            
        self.is_running = False
        
        # Cancel tasks
        if self.capture_task:
            self.capture_task.cancel()
            try:
                await self.capture_task
            except asyncio.CancelledError:
                pass
            
        if self.processing_task:
            self.processing_task.cancel()
            try:
                await self.processing_task
            except asyncio.CancelledError:
                pass
            
        # Clear buffer
        while not self.frame_buffer.empty():
            try:
                self.frame_buffer.get_nowait()
            except asyncio.QueueEmpty:
                break
                
        logger.info("Video stream stopped")
        return True
    
    def _generate_test_frame(self, frame_number: int) -> np.ndarray:
        """Generate a simulated frame for testing
        
        Args:
            frame_number: Current frame number for pattern generation
            
        Returns:
            numpy.ndarray: Simulated frame data
        """
        # Create a simple test pattern (moving gradient)
        height = 720  # Default test frame height
        width = 1280  # Default test frame width
        channels = 3  # RGB
        
        # Create base gradient
        x = np.linspace(0, 1, width)
        y = np.linspace(0, 1, height)
        xx, yy = np.meshgrid(x, y)
        
        # Add time-varying component
        t = frame_number / 30.0  # Animate pattern over time
        pattern = np.sin(2 * np.pi * (xx + yy + t))
        
        # Convert to RGB
        frame = np.zeros((height, width, channels), dtype=np.uint8)
        frame[..., 0] = ((np.sin(pattern) + 1) * 127.5).astype(np.uint8)  # Red channel
        frame[..., 1] = ((np.cos(pattern) + 1) * 127.5).astype(np.uint8)  # Green channel
        frame[..., 2] = ((pattern + 1) * 127.5).astype(np.uint8)         # Blue channel
        
        return frame
    
    @handle_errors(component='video_stream', category='capture')
    async def _capture_frames(self, camera_manager):
        """Capture frames from camera and add to buffer"""
        frame_number = 0
        while self.is_running:
            try:
                if camera_manager.test_mode:
                    # Generate simulated frame in test mode
                    frame = self._generate_test_frame(frame_number)
                    frame_number += 1
                else:
                    # Get frame from real camera
                    frame = camera_manager.get_frame()
                    
                if frame is None:
                    logger.warning("Failed to get frame from camera")
                    await asyncio.sleep(0.1)
                    continue
                
                current_time = asyncio.get_event_loop().time()
                
                # Check frame interval
                if (current_time - self.last_frame_time) < self.config.min_frame_interval:
                    await asyncio.sleep(0.001)  # Small sleep to prevent tight loop
                    continue
                
                # Add frame to buffer, dropping oldest if full
                try:
                    self.frame_buffer.put_nowait(frame)
                except asyncio.QueueFull:
                    try:
                        self.frame_buffer.get_nowait()  # Remove oldest frame
                        self.frame_buffer.put_nowait(frame)
                    except asyncio.QueueEmpty:
                        pass
                
                self.last_frame_time = current_time
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error capturing frame: {e}")
                await asyncio.sleep(0.1)
    
    @handle_errors(component='video_stream', category='processing')
    async def _process_frames(self):
        """Process frames from buffer"""
        while self.is_running:
            try:
                # Get frame from buffer
                frame = await self.frame_buffer.get()
                
                # Skip similar frames if enabled
                if (self.config.skip_similar_frames and 
                    self.last_processed_frame is not None):
                    similarity = self.vision_processor._compute_frame_similarity(
                        frame, self.last_processed_frame
                    )
                    if similarity > self.config.similarity_threshold:
                        continue
                
                # Process frame
                result = await self.vision_processor.process_frame(frame)
                self.last_processed_frame = frame
                
                # Publish results if event bus is available
                if self.event_bus:
                    await self.event_bus.publish(Event(
                        type=EventType.VISION,
                        payload={
                            "type": "stream_analysis",
                            "data": result,
                            "timestamp": asyncio.get_event_loop().time()
                        },
                        source="video_stream_manager"
                    ))
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error processing frame: {e}")
                await asyncio.sleep(0.1)  # Avoid tight loop on errors
