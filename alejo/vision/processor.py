"""
Vision Processor for ALEJO
Handles advanced image analysis, real-time object detection, and scene understanding
"""

import os
import io
import time
import logging
import numpy as np
from typing import Dict, Any, List, Tuple, Optional, Union
from PIL import Image
import base64
import cv2
import asyncio
import torch
import torchvision.transforms as transforms
from concurrent.futures import ThreadPoolExecutor

from ..utils.error_handling import handle_errors, ErrorTracker
from ..utils.exceptions import VisionError, LLMServiceError
from ..llm_client import LLMClientFactory, LLMError
from .scene_analyzer import SceneAnalyzer, SceneContext
from .object_tracking import ObjectTracker, TrackedObject
from .yolo_detector import YOLODetector, YOLOConfig
from .emotion_detector import EmotionDetector, FaceEmotion
from .gesture_recognition import GestureRecognizer, Hand
from .gaze_tracker import GazeTracker
from .scene_context import SceneContextAnalyzer, EnvironmentalContext
from ..core.event_bus import EventBus, Event, EventType
from ..config import ConfigManager

logger = logging.getLogger("alejo.vision.processor")

class VisionProcessor:
    """
    Advanced vision processing system for ALEJO
    
    Features:
    - Real-time object detection and tracking
    - Advanced scene understanding and context analysis
    - Multimodal vision processing (images, video streams)
    - Facial detection and emotion recognition
    - OCR and text understanding
    - Environmental perception and spatial reasoning
    """
    
    def __init__(self, config_path: Optional[str] = None, event_bus: Optional[EventBus] = None):
        """
        Initialize the vision processor
        
        Args:
            config_path: Optional path to configuration file
            event_bus: Optional event bus for real-time event publishing
        """
        # Initialize configuration manager
        self.config_manager = ConfigManager(config_path)
        self.error_tracker = ErrorTracker()
        self.event_bus = event_bus
        self.initialized = False
        self.processing_enabled = True
        
        try:
            # Set up GPU acceleration if available
            self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
            logger.info(f"Using device: {self.device}")
            
            # Configure image transforms
            vision_config = self.config_manager.vision_config
            self.transform = transforms.Compose([
                transforms.Resize((640, 640)),
                transforms.ToTensor(),
                transforms.Normalize(mean=[0.485, 0.456, 0.406],
                                  std=[0.229, 0.224, 0.225])
            ])
            
            # Initialize thread pool for parallel processing
            max_workers = vision_config.get('max_workers', 4)
            self.thread_pool = ThreadPoolExecutor(max_workers=max_workers)
            
            # Initialize performance tracking
            self.frame_count = 0
            self.skip_frames = vision_config.get('skip_frames', 2)
            self.processing_stats = {
                'fps': 0,
                'processing_time': 0,
                'batch_size': 1,
                'gpu_utilization': 0 if torch.cuda.is_available() else None
            }
            
            # Initialize vision components with GPU support
            self.scene_analyzer = SceneAnalyzer(device=self.device)
            self.object_tracker = ObjectTracker(
                max_disappeared=vision_config.get('max_disappeared', 30),
                min_confidence=vision_config.get('min_confidence', 0.5)
            )
            
            # Initialize YOLOv8 for fast detection
            yolo_config = YOLOConfig(
                model_size=vision_config.get('yolo_model_size', 's'),
                confidence_threshold=vision_config.get('confidence_threshold', 0.3),
                iou_threshold=vision_config.get('iou_threshold', 0.45),
                device=self.device
            )
            self.yolo_detector = YOLODetector(yolo_config)
            
            # Initialize emotion detection with GPU support
            self.emotion_detector = EmotionDetector(device=self.device)
            
            # Initialize gesture recognition with GPU support
            self.gesture_recognizer = GestureRecognizer(device=self.device)
            
            # Initialize scene context analyzer
            self.context_analyzer = SceneContextAnalyzer(device=self.device)

            # Initialize Gaze Tracker if enabled
            self.gaze_tracker = None
            self.gaze_tracker_thread = None
            if vision_config.get('gaze_tracking_enabled', False):
                loop = asyncio.get_running_loop()
                self.gaze_tracker = GazeTracker(event_bus=self.event_bus, loop=loop)
                self.gaze_tracker_thread = self.thread_pool.submit(self.gaze_tracker.run)
                logger.info("Gaze tracking enabled and started.")

            
            # Initialize LLM client for high-level vision understanding
            vision_config = self.config_manager.vision_config
            provider = vision_config.get('provider', 'local')
            self.llm_client = LLMClientFactory.create_client(
                provider=provider,
                config_override=vision_config
            )
            
            # Initialize video capture and processing
            self.frame_buffer = asyncio.Queue(maxsize=30)  # 1 second buffer at 30fps
            self.last_processed_frame = None
            self.processing_task = None
            self.tracked_objects: List[TrackedObject] = []
            self.frame_count = 0
            
            # Frame processing optimization
            self.skip_frames = 2  # Process every 3rd frame for heavy analysis
            self.processing_stats = {
                'fps': 0,
                'processing_time': 0,
                'detection_count': 0
            }
            
            self.initialized = True
            logger.info(f"Vision processor initialized with {provider} provider and scene analyzer")
        except Exception as e:
            logger.error(f"Failed to initialize vision processor: {e}")
            raise VisionError(f"Vision processor initialization failed: {e}")
            
    @handle_errors(component='vision_processor', category='analysis')
    async def analyze_image(self, image_data: Union[bytes, str], 
                          analysis_type: str = "general") -> Dict[str, Any]:
        """
        Analyze an image using the local vision LLM
        
        Args:
            image_data: Image data as bytes or base64 string
            analysis_type: Type of analysis to perform
                         ("general", "objects", "text", "faces", "scene")
                         
        Returns:
            Dictionary containing analysis results
        """
        if not self.initialized:
            raise VisionError("Vision processor not initialized")
            
        # Convert image data to bytes if needed
        if isinstance(image_data, str):
            try:
                image_data = base64.b64decode(image_data)
            except Exception as e:
                raise VisionError(f"Invalid base64 image data: {e}")
                
        # Convert bytes to PIL Image for preprocessing
        try:
            image = Image.open(io.BytesIO(image_data))
        except Exception as e:
            raise VisionError(f"Invalid image data: {e}")
            
        # Prepare the image
        image = self._preprocess_image(image)
        
        # Prepare prompt based on analysis type
        prompt = self._get_analysis_prompt(analysis_type)
        
        try:
            # Convert image to base64 for API
            buffered = io.BytesIO()
            image.save(buffered, format="JPEG")
            image_base64 = base64.b64encode(buffered.getvalue()).decode('utf-8')
            
            # Prepare message for vision analysis
            messages = [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": prompt
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{image_base64}"
                            }
                        }
                    ]
                }
            ]
            
            try:
                # Use our LLM client for vision analysis
                response = await self.llm_client.generate_chat_response(
                    messages=messages,
                    max_tokens=300
                )
                
                # Parse and return results based on analysis type
                result = {
                    "analysis": response.content,
                    "model": response.model,
                    "usage": response.usage,
                    "metadata": response.metadata
                }
                
                # Add structured data based on analysis type
                parsed_data = self._parse_vision_response(response.content, analysis_type)
                result.update(parsed_data)
                
                return result
                
            except LLMError as e:
                raise VisionError(f"Vision analysis failed: {str(e)}")
            
        except Exception as e:
            # Track error with the OpenAI client for recovery
            error_context = {'service': self.client, 'retry_count': 0}
            self.error_tracker.track_error('llm_service', 'vision', e, error_context)
            raise VisionError(f"Vision analysis failed: {e}")
            
    @handle_errors(component='vision_processor', category='detection')
    def detect_objects(self, image_data: Union[bytes, str]) -> List[Dict[str, Any]]:
        """
        Detect and locate objects in an image
        
        Args:
            image_data: Image data as bytes or base64 string
            
        Returns:
            List of detected objects with their locations and confidence scores
        """
        results = self.analyze_image(image_data, analysis_type="objects")
        return results.get("objects", [])
        
    @handle_errors(component='vision_processor', category='ocr')
    def extract_text(self, image_data: Union[bytes, str]) -> str:
        """
        Extract text from an image using OCR
        
        Args:
            image_data: Image data as bytes or base64 string
            
        Returns:
            Extracted text as string
        """
        results = self.analyze_image(image_data, analysis_type="text")
        return results.get("text", "")
        
    @handle_errors(component='vision_processor', category='faces')
    def detect_faces(self, image_data: Union[bytes, str]) -> List[Dict[str, Any]]:
        """
        Detect and analyze faces in an image
        
        Args:
            image_data: Image data as bytes or base64 string
            
        Returns:
            List of detected faces with their locations and attributes
        """
        results = self.analyze_image(image_data, analysis_type="faces")
        return results.get("faces", [])
        
    @handle_errors(component='vision_processor', category='scene')
    def understand_scene(self, image_data: Union[bytes, str]) -> Dict[str, Any]:
        """
        Analyze and understand the scene in an image
        
        Args:
            image_data: Image data as bytes or base64 string
            
        Returns:
            Dictionary containing scene analysis results
        """
        return self.analyze_image(image_data, analysis_type="scene")
        
    def _preprocess_image(self, image: Image.Image) -> Image.Image:
        """
        Preprocess an image for analysis
        
        Args:
            image: PIL Image object
            
        Returns:
            Preprocessed PIL Image object
        """
        # Convert to RGB if needed
        if image.mode != "RGB":
            image = image.convert("RGB")
            
        # Resize if too large
        max_size = self.config.get("max_image_size", 1024)
        if max(image.size) > max_size:
            ratio = max_size / max(image.size)
            new_size = tuple(int(dim * ratio) for dim in image.size)
            image = image.resize(new_size, Image.LANCZOS)
            
        return image
        
    def _get_analysis_prompt(self, analysis_type: str) -> str:
        """Get the appropriate prompt for the analysis type"""
        prompts = {
            "general": "Describe this image in detail.",
            "objects": "List all objects in this image with their locations.",
            "text": "Read and transcribe any text in this image.",
            "faces": "Describe any faces in this image and their expressions.",
            "scene": "Describe the scene, setting, and atmosphere of this image."
        }
        return prompts.get(analysis_type, prompts["general"])
        
    def _parse_vision_response(self, response: Any, 
                             analysis_type: str) -> Dict[str, Any]:
        """Parse the vision API response based on analysis type"""
        try:
            content = response.choices[0].message.content
            
            # Basic structure for each type
            result = {
                "raw_response": content,
                "analysis_type": analysis_type,
                "timestamp": response.created
            }
            
            # Add type-specific parsing
            if analysis_type == "objects":
                # Parse object descriptions into structured data
                result["objects"] = self._extract_objects(content)
            elif analysis_type == "text":
                # Clean and structure extracted text
                result["text"] = self._clean_extracted_text(content)
            elif analysis_type == "faces":
                # Parse face descriptions into structured data
                result["faces"] = self._extract_faces(content)
            elif analysis_type == "scene":
                # Parse scene description into structured data
                scene_data = self._parse_scene_description(content)
                result.update(scene_data)
                
            return result
            
        except Exception as e:
            raise VisionError(f"Failed to parse vision response: {e}")
            
    def _extract_objects(self, content: str) -> List[Dict[str, Any]]:
        """Extract structured object data from response"""
        objects = []
        try:
            # Simple parsing - can be enhanced with regex or NLP
            lines = content.split('\n')
            for line in lines:
                if ':' in line:
                    obj, desc = line.split(':', 1)
                    objects.append({
                        "name": obj.strip(),
                        "description": desc.strip()
                    })
        except Exception:
            logger.warning("Failed to parse objects, returning raw text")
            objects.append({"description": content})
        return objects
        
    def _clean_extracted_text(self, content: str) -> str:
        """Clean and format extracted text"""
        # Remove common OCR artifacts and clean up text
        text = content.replace('OCR Result:', '').strip()
        return text
        
    def _extract_faces(self, content: str) -> List[Dict[str, Any]]:
        """Extract structured face data from response"""
        faces = []
        try:
            # Simple parsing - can be enhanced with regex or NLP
            sections = content.split('\n\n')
            for section in sections:
                if section.strip():
                    faces.append({
                        "description": section.strip()
                    })
        except Exception:
            logger.warning("Failed to parse faces, returning raw text")
            faces.append({"description": content})
        return faces
        
    async def process_frame(self, frame: np.ndarray) -> Dict[str, Any]:
        """Process a single frame from the video stream
        
        Args:
            frame: Video frame as numpy array
            
        Returns:
            Dictionary containing processing results including tracked objects
        """
        # Process single frame as a batch of one
        results = await self.process_batch([frame])
        return results[0] if results else None

    async def process_batch(self, frames: List[np.ndarray]) -> List[Dict[str, Any]]:
        """Process a batch of video frames.

        Each frame runs through the full vision pipeline (YOLO, scene analysis,
        emotion detection, etc.).  All heavy components may be **monkey-patched**
        during unit-testing so this method must remain lightweight and, most
        importantly, must never crash the caller.  Any internal failure is
        logged and tracked but the overall batch proceeds.

        Args:
            frames: List of frames (numpy arrays, BGR format).

        Returns:
            List with one result-dict per input frame containing tracking data
            and basic processing statistics.
        """
        results: List[Dict[str, Any]] = []

        for frame in frames:
            self.frame_count += 1
            start_time = time.time()

            # Default fallbacks in case detectors fail
            merged_objects: List[Any] = []
            face_emotions: List[Any] = []
            env_context: Any = None

            try:
                # --- Detection & analysis ----------------------------------------------------
                yolo_objects = await self.yolo_detector.detect(frame)  # type: ignore
                scene_objects = await self.scene_analyzer.analyze(frame)  # type: ignore
                merged_objects = self._merge_detections(yolo_objects, scene_objects)

                face_emotions = await self.emotion_detector.detect_emotions(frame)  # type: ignore

                # Higher-level environmental context
                env_context = await self.context_analyzer.analyze_context(
                    frame, [obj.label for obj in merged_objects]
                )  # type: ignore
            except Exception as e:  # noqa: BLE001 – log & continue
                logger.error(f"Vision processing failure on frame {self.frame_count}: {e}")
                self.error_tracker.track_error(e)

            # --- Tracking -------------------------------------------------------------------
            try:
                self.tracked_objects = self.object_tracker.update(frame, merged_objects)
            except Exception as e:
                logger.debug(f"Object tracker failure: {e}")
                self.tracked_objects = []

            # --- Stats ----------------------------------------------------------------------
            processing_time = time.time() - start_time
            self.processing_stats.update({
                "processing_time": processing_time,
                "fps": 1.0 / processing_time if processing_time > 0 else 0.0,
                "detection_count": len(merged_objects),
            })

            # --- Event emission --------------------------------------------------------------
            if self.event_bus:
                # Fire granular events (best-effort)
                if env_context is not None:
                    await self.event_bus.emit(Event(
                        type=EventType.ENVIRONMENT_ANALYZED,
                        data={
                            "context": env_context,
                            "frame_number": self.frame_count,
                        },
                    ))

                if face_emotions:
                    await self.event_bus.emit(Event(
                        type=EventType.FACIAL_EMOTIONS_DETECTED,
                        data={
                            "emotions": face_emotions,
                            "frame_number": self.frame_count,
                        },
                    ))

            # Assemble per-frame result -------------------------------------------------------
            frame_result = {
                "frame_number": self.frame_count,
                "tracked_objects": self.tracked_objects,
                "processing_stats": self.processing_stats.copy(),
            }

            # Emit high-level "frame processed" event
            if self.event_bus:
                await self.event_bus.emit(Event(
                    type=EventType.VISION_FRAME_PROCESSED,
                    data=frame_result,
                ))

            results.append(frame_result)

        return results

    async def start_processing(self):
        """Start the frame processing loop"""
        if not self.initialized:
            raise VisionError("Vision processor not initialized")
            
        if self.processing_task is not None:
            return
            
        async def process_frames():
            while self.processing_enabled:
                try:
                    # Get frame from buffer
                    frame = await self.frame_buffer.get()
                    
                    # Process frame
                    await self.process_frame(frame)
                    
                    # Mark task as done
                    self.frame_buffer.task_done()
                except asyncio.CancelledError:
                    break
                except Exception as e:
                    logger.error(f"Error processing frame: {e}")
                    self.error_tracker.track_error(e)
        
        self.processing_task = asyncio.create_task(process_frames())
        logger.info("Started vision frame processing loop")
        
    async def stop_processing(self):
        """Stop the frame processing loop"""
        if self.processing_task:
            self.processing_task.cancel()
            self.processing_task = None
        logger.info("Vision processing stopped")

    def shutdown(self):
        """Gracefully shut down the vision processor and its components."""
        logger.info("Shutting down vision processor...")
        self.stop_processing()
        if self.gaze_tracker:
            self.gaze_tracker.stop()
        self.thread_pool.shutdown(wait=True)
        logger.info("Vision processor shut down.")

    def _merge_detections(self, yolo_objects: List[SceneObject], 
                         scene_objects: List[SceneObject]) -> List[SceneObject]:
        """Merge detections from YOLO and scene analyzer
        
        Args:
            yolo_objects: Objects detected by YOLOv8
            scene_objects: Objects detected by scene analyzer
            
        Returns:
            Merged list of detected objects
        """
        merged = []
        used_scene_objects = set()
        
        # First, process YOLO detections
        for yolo_obj in yolo_objects:
            # Find matching scene object if any
            best_match = None
            best_iou = 0.3  # Minimum IoU threshold
            
            for i, scene_obj in enumerate(scene_objects):
                if i in used_scene_objects:
                    continue
                    
                iou = self._calculate_iou(
                    yolo_obj.bounding_box,
                    scene_obj.bounding_box
                )
                
                if iou > best_iou:
                    best_iou = iou
                    best_match = i
            
            if best_match is not None:
                # Merge attributes from both detections
                scene_obj = scene_objects[best_match]
                merged_obj = SceneObject(
                    label=yolo_obj.label,  # Prefer YOLO's label for common objects
                    confidence=max(yolo_obj.confidence, scene_obj.confidence),
                    bounding_box=yolo_obj.bounding_box,  # YOLO's boxes are typically more precise
                    attributes={
                        **scene_obj.attributes,  # Scene analyzer's rich attributes
                        **yolo_obj.attributes,   # YOLO's additional attributes
                        'detection_source': 'both'
                    }
                )
                used_scene_objects.add(best_match)
            else:
                # Use YOLO detection as is
                yolo_obj.attributes['detection_source'] = 'yolo'
                merged_obj = yolo_obj
                
            merged.append(merged_obj)
        
        # Add remaining scene objects (those not matched with YOLO)
        for i, scene_obj in enumerate(scene_objects):
            if i not in used_scene_objects:
                scene_obj.attributes['detection_source'] = 'scene'
                merged.append(scene_obj)
        
        return merged
        
    def _calculate_iou(self, box1: Tuple[float, float, float, float],
                      box2: Tuple[float, float, float, float]) -> float:
        """Calculate Intersection over Union between two boxes"""
        x1 = max(box1[0], box2[0])
        y1 = max(box1[1], box2[1])
        x2 = min(box1[2], box2[2])
        y2 = min(box1[3], box2[3])
        
        if x2 < x1 or y2 < y1:
            return 0.0
            
        intersection = (x2 - x1) * (y2 - y1)
        
        area1 = (box1[2] - box1[0]) * (box1[3] - box1[1])
        area2 = (box2[2] - box2[0]) * (box2[3] - box2[1])
        
        return intersection / (area1 + area2 - intersection)
        
    def _parse_scene_description(self, content: str) -> Dict[str, Any]:
        """Parse scene description into structured data"""
        return {
            "description": content,
            "summary": content.split('.')[0] if '.' in content else content
        }

    async def shutdown(self):
        """Gracefully shut down the vision processor and its components."""
        logger.info("Shutting down vision processor...")
        await self.stop_processing()
        if self.gaze_tracker:
            self.gaze_tracker.stop()
        self.thread_pool.shutdown(wait=True)
        logger.info("Vision processor shut down.")
