"""
Optimized video stream processing for ALEJO.
Implements efficient frame capture, buffering, and processing strategies.
"""

import asyncio
import logging
import numpy as np
import cv2
from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass
import time
from concurrent.futures import ThreadPoolExecutor
import threading
from queue import Queue
import torch

from ..utils.error_handling import handle_errors, VisionError
from ..core.event_bus import EventBus, Event, EventType
from .processor import VisionProcessor

logger = logging.getLogger(__name__)

@dataclass
class StreamConfig:
    """Enhanced configuration for optimized video streaming"""
    frame_rate: int = 30
    buffer_size: int = 30
    min_frame_interval: float = 0.033
    skip_similar_frames: bool = True
    similarity_threshold: float = 0.95
    batch_size: int = 4  # Number of frames to process in a batch
    enable_gpu: bool = True  # Use GPU acceleration when available
    max_workers: int = 4  # Number of worker threads for frame preprocessing
    frame_resize: Tuple[int, int] = (640, 480)  # Target frame size for processing
    cache_size: int = 100  # Size of the frame feature cache

class FrameCache:
    """LRU cache for frame features to avoid redundant processing"""
    
    def __init__(self, max_size: int = 100):
        self.max_size = max_size
        self.cache: Dict[int, Dict[str, Any]] = {}
        self.frame_hashes: Dict[int, bytes] = {}
        self._lock = threading.Lock()
    
    def get(self, frame_hash: int) -> Optional[Dict[str, Any]]:
        """Get cached features for a frame"""
        with self._lock:
            return self.cache.get(frame_hash)
    
    def put(self, frame_hash: int, features: Dict[str, Any]):
        """Cache features for a frame"""
        with self._lock:
            if len(self.cache) >= self.max_size:
                # Remove oldest entry
                oldest_hash = next(iter(self.cache))
                del self.cache[oldest_hash]
                del self.frame_hashes[oldest_hash]
            
            self.cache[frame_hash] = features
            self.frame_hashes[frame_hash] = frame_hash

class OptimizedVideoStream:
    """
    High-performance video stream processor with optimizations:
    - Parallel frame preprocessing
    - Batch processing
    - GPU acceleration
    - Feature caching
    - Adaptive frame skipping
    """
    
    def __init__(
        self,
        vision_processor: VisionProcessor,
        event_bus: Optional[EventBus] = None,
        config: Optional[StreamConfig] = None
    ):
        """Initialize the optimized video stream"""
        self.vision_processor = vision_processor
        self.event_bus = event_bus
        self.config = config or StreamConfig()
        
        # Initialize processing components
        self.device = "cuda" if (torch.cuda.is_available() and self.config.enable_gpu) else "cpu"
        self.frame_cache = FrameCache(max_size=self.config.cache_size)
        self.thread_pool = ThreadPoolExecutor(max_workers=self.config.max_workers)
        
        # Frame management
        self.raw_frame_queue = Queue(maxsize=self.config.buffer_size)
        self.processed_frame_queue = asyncio.Queue(maxsize=self.config.buffer_size)
        self.frame_batch = []
        self.last_processed_frame = None
        self.last_frame_time = 0
        
        # Processing state
        self.is_running = False
        self.capture_thread = None
        self.processing_task = None
        self.batch_processing_task = None
        
        # Performance metrics
        self.metrics = {
            'fps': 0,
            'processing_time': 0,
            'batch_size': 0,
            'cache_hits': 0,
            'frames_skipped': 0
        }
        
        logger.info(
            f"Optimized video stream initialized on {self.device} "
            f"with {self.config.max_workers} workers"
        )

    def _preprocess_frame(self, frame: np.ndarray) -> np.ndarray:
        """Preprocess a frame in a worker thread"""
        try:
            # Resize frame
            frame = cv2.resize(frame, self.config.frame_resize)
            
            # Convert to RGB
            if len(frame.shape) == 2:
                frame = cv2.cvtColor(frame, cv2.COLOR_GRAY2RGB)
            elif frame.shape[2] == 3:
                frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # Normalize
            frame = frame.astype(np.float32) / 255.0
            
            return frame
            
        except Exception as e:
            logger.error(f"Error preprocessing frame: {e}")
            return None

    def _compute_frame_hash(self, frame: np.ndarray) -> int:
        """Compute a perceptual hash of the frame for caching"""
        # Resize to tiny size for quick comparison
        tiny = cv2.resize(frame, (16, 16))
        # Compute difference hash
        diff = tiny[1:, :] > tiny[:-1, :]
        return hash(diff.tobytes())

    def _frames_are_similar(self, frame1: np.ndarray, frame2: np.ndarray) -> bool:
        """Check if two frames are perceptually similar"""
        try:
            # Compute structural similarity index
            score = cv2.compareHist(
                cv2.calcHist([frame1], [0], None, [256], [0, 256]),
                cv2.calcHist([frame2], [0], None, [256], [0, 256]),
                cv2.HISTCMP_CORREL
            )
            return score > self.config.similarity_threshold
        except Exception as e:
            logger.error(f"Error comparing frames: {e}")
            return False

    async def _process_frame_batch(self, batch: List[np.ndarray]) -> List[Dict[str, Any]]:
        """Process a batch of frames efficiently"""
        try:
            # Convert batch to tensor
            batch_tensor = torch.tensor(batch).to(self.device)
            
            # Process batch through vision processor
            with torch.no_grad():
                results = await self.vision_processor.process_batch(batch_tensor)
            
            return results
            
        except Exception as e:
            logger.error(f"Error processing frame batch: {e}")
            return [None] * len(batch)

    def _capture_frames_thread(self, camera):
        """Capture frames in a separate thread"""
        while self.is_running:
            try:
                # Get frame from camera
                frame = camera.get_frame()
                if frame is None:
                    continue
                
                current_time = time.time()
                frame_interval = current_time - self.last_frame_time
                
                # Apply frame rate control
                if frame_interval < self.config.min_frame_interval:
                    continue
                
                # Skip similar frames if enabled
                if (self.config.skip_similar_frames and 
                    self.last_processed_frame is not None):
                    if self._frames_are_similar(frame, self.last_processed_frame):
                        self.metrics['frames_skipped'] += 1
                        continue
                
                # Preprocess frame in thread pool
                preprocessed = self.thread_pool.submit(
                    self._preprocess_frame, frame
                ).result()
                
                if preprocessed is not None:
                    self.raw_frame_queue.put(preprocessed)
                    self.last_frame_time = current_time
                
            except Exception as e:
                logger.error(f"Error in frame capture thread: {e}")
                time.sleep(0.1)

    async def _batch_processing_loop(self):
        """Process frames in batches"""
        while self.is_running:
            try:
                # Collect frames into batch
                while (len(self.frame_batch) < self.config.batch_size and 
                       not self.raw_frame_queue.empty()):
                    frame = self.raw_frame_queue.get_nowait()
                    self.frame_batch.append(frame)
                
                if not self.frame_batch:
                    await asyncio.sleep(0.01)
                    continue
                
                # Process batch
                start_time = time.time()
                results = await self._process_frame_batch(self.frame_batch)
                
                # Update metrics
                processing_time = time.time() - start_time
                self.metrics.update({
                    'processing_time': processing_time,
                    'batch_size': len(self.frame_batch),
                    'fps': len(self.frame_batch) / processing_time
                })
                
                # Queue results
                for frame, result in zip(self.frame_batch, results):
                    if result is not None:
                        await self.processed_frame_queue.put({
                            'frame': frame,
                            'result': result,
                            'timestamp': time.time()
                        })
                
                # Clear batch
                self.frame_batch = []
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in batch processing loop: {e}")
                await asyncio.sleep(0.1)

    async def start(self, camera) -> bool:
        """Start optimized video stream processing"""
        if self.is_running:
            return False
        
        try:
            self.is_running = True
            
            # Start capture thread
            self.capture_thread = threading.Thread(
                target=self._capture_frames_thread,
                args=(camera,)
            )
            self.capture_thread.start()
            
            # Start batch processing
            self.batch_processing_task = asyncio.create_task(
                self._batch_processing_loop()
            )
            
            logger.info("Optimized video stream started")
            return True
            
        except Exception as e:
            logger.error(f"Failed to start video stream: {e}")
            await self.stop()
            return False

    async def stop(self) -> bool:
        """Stop video stream processing"""
        if not self.is_running:
            return False
        
        self.is_running = False
        
        # Stop capture thread
        if self.capture_thread:
            self.capture_thread.join()
            self.capture_thread = None
        
        # Stop batch processing
        if self.batch_processing_task:
            self.batch_processing_task.cancel()
            try:
                await self.batch_processing_task
            except asyncio.CancelledError:
                pass
            self.batch_processing_task = None
        
        # Clear queues
        while not self.raw_frame_queue.empty():
            self.raw_frame_queue.get()
        while not self.processed_frame_queue.empty():
            await self.processed_frame_queue.get()
        
        # Clear batch
        self.frame_batch = []
        
        logger.info("Optimized video stream stopped")
        return True

    def get_metrics(self) -> Dict[str, Any]:
        """Get current performance metrics"""
        return self.metrics.copy()
