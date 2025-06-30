"""
YOLOv8 integration for ALEJO
Provides fast real-time object detection using YOLOv8
"""

import logging
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
from ultralytics import YOLO
import torch
from dataclasses import dataclass
from .scene_analyzer import SceneObject

logger = logging.getLogger("alejo.vision.yolo_detector")

@dataclass
class YOLOConfig:
    """Configuration for YOLOv8 detector"""
    model_size: str = "n"  # n=nano, s=small, m=medium, l=large, x=xlarge
    confidence_threshold: float = 0.25
    iou_threshold: float = 0.45
    device: str = "auto"  # auto, cpu, cuda:0, etc.
    max_det: int = 300  # Maximum detections per image

class YOLODetector:
    """
    Fast object detection using YOLOv8
    Provides real-time detection with high accuracy
    """
    
    def __init__(self, config: Optional[YOLOConfig] = None):
        """
        Initialize YOLOv8 detector
        
        Args:
            config: Optional detector configuration
        """
        self.config = config or YOLOConfig()
        self.initialized = False
        self.model = None
        
        try:
            # Initialize YOLOv8 model
            model_name = f"yolov8{self.config.model_size}"
            self.model = YOLO(model_name)
            
            # Set model parameters
            self.model.conf = self.config.confidence_threshold
            self.model.iou = self.config.iou_threshold
            self.model.max_det = self.config.max_det
            
            # Move model to appropriate device
            if self.config.device != "auto":
                self.model.to(self.config.device)
                
            self.initialized = True
            logger.info(f"Initialized YOLOv8 detector with {model_name}")
        except Exception as e:
            logger.error(f"Failed to initialize YOLOv8 detector: {e}")
            raise
            
    async def detect_objects(self, frame: np.ndarray) -> List[SceneObject]:
        """
        Detect objects in a frame using YOLOv8
        
        Args:
            frame: Video frame as numpy array
            
        Returns:
            List of detected objects
        """
        if not self.initialized:
            raise RuntimeError("YOLOv8 detector not initialized")
            
        try:
            # Run inference
            results = self.model(frame, verbose=False)
            
            # Convert results to SceneObject format
            detected_objects = []
            
            for r in results:
                boxes = r.boxes
                for box in boxes:
                    # Get box coordinates
                    x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                    
                    # Get class and confidence
                    cls = int(box.cls[0].item())
                    conf = float(box.conf[0].item())
                    label = r.names[cls]
                    
                    # Create SceneObject
                    obj = SceneObject(
                        label=label,
                        confidence=conf,
                        bounding_box=(float(x1), float(y1), float(x2), float(y2)),
                        attributes={
                            "class_id": cls,
                            "area": float((x2 - x1) * (y2 - y1))
                        }
                    )
                    detected_objects.append(obj)
            
            return detected_objects
            
        except Exception as e:
            logger.error(f"Error during YOLOv8 detection: {e}")
            raise
            
    def get_model_info(self) -> Dict[str, Any]:
        """Get information about the loaded model"""
        if not self.initialized:
            return {"status": "not_initialized"}
            
        return {
            "model_name": self.model.name,
            "model_type": self.model.type,
            "task": self.model.task,
            "device": str(next(self.model.parameters()).device),
            "confidence_threshold": self.model.conf,
            "iou_threshold": self.model.iou,
            "max_detections": self.model.max_det
        }
