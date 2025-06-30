"""
Advanced Scene Analysis for ALEJO
Handles complex scene understanding and real-time object tracking
"""

import logging
from typing import Dict, Any, List, Optional, Tuple
import numpy as np
from dataclasses import dataclass
import torch
from transformers import AutoFeatureExtractor, AutoModelForObjectDetection
from ..utils.error_handling import handle_errors, ErrorTracker
from ..utils.exceptions import VisionError

logger = logging.getLogger("alejo.vision.scene_analyzer")

@dataclass
class SceneObject:
    """Represents a detected object in a scene"""
    label: str
    confidence: float
    bounding_box: Tuple[float, float, float, float]  # (x1, y1, x2, y2)
    attributes: Dict[str, Any]
    tracking_id: Optional[str] = None

@dataclass
class SceneContext:
    """Represents the overall context of a scene"""
    environment_type: str  # indoor, outdoor, etc.
    time_of_day: Optional[str]
    weather_conditions: Optional[str]
    lighting: str  # bright, dim, dark
    objects: List[SceneObject]
    relationships: List[Dict[str, Any]]  # spatial relationships between objects
    activities: List[str]  # ongoing activities detected in scene

class SceneAnalyzer:
    """
    Advanced scene analysis using state-of-the-art vision models
    """
    
    def __init__(self):
        """Initialize scene analyzer with required models"""
        self.error_tracker = ErrorTracker()
        self.initialized = False
        
        try:
            # Initialize object detection model
            self.feature_extractor = AutoFeatureExtractor.from_pretrained("facebook/detr-resnet-50")
            self.object_detector = AutoModelForObjectDetection.from_pretrained("facebook/detr-resnet-50")
            
            # Move model to GPU if available
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
            self.object_detector.to(self.device)
            
            self.initialized = True
            logger.info("Scene analyzer initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize scene analyzer: {e}")
            raise VisionError(f"Scene analyzer initialization failed: {e}")
    
    @handle_errors(component='scene_analyzer', category='analysis')
    def analyze_scene(self, frame: np.ndarray) -> SceneContext:
        """
        Perform comprehensive scene analysis on a frame
        
        Args:
            frame: numpy array containing the image frame
            
        Returns:
            SceneContext object containing analysis results
        """
        if not self.initialized:
            raise VisionError("Scene analyzer not initialized")
            
        try:
            # Prepare image for model
            inputs = self.feature_extractor(images=frame, return_tensors="pt")
            inputs = {k: v.to(self.device) for k, v in inputs.items()}
            
            # Run object detection
            with torch.no_grad():
                outputs = self.object_detector(**inputs)
            
            # Process results
            probas = outputs.logits.softmax(-1)[0, :, :-1]
            keep = probas.max(-1).values > 0.7
            target_sizes = torch.tensor([frame.shape[:2]]).to(self.device)
            
            # Convert boxes to image coordinates
            boxes = outputs.pred_boxes[0, keep]
            boxes = self.feature_extractor.post_process_box(boxes, target_sizes)[0]
            
            # Create SceneObject instances
            objects = []
            for box, proba in zip(boxes, probas[keep]):
                label_id = proba.argmax()
                objects.append(SceneObject(
                    label=self.feature_extractor.id2label[label_id.item()],
                    confidence=proba[label_id].item(),
                    bounding_box=tuple(box.tolist()),
                    attributes={},
                    tracking_id=None
                ))
            
            # Analyze scene context
            context = SceneContext(
                environment_type=self._determine_environment(objects),
                time_of_day=self._estimate_time_of_day(frame),
                weather_conditions=None,  # Would require outdoor scene
                lighting=self._analyze_lighting(frame),
                objects=objects,
                relationships=self._analyze_spatial_relationships(objects),
                activities=self._detect_activities(objects)
            )
            
            return context
            
        except Exception as e:
            logger.error(f"Scene analysis failed: {e}")
            raise VisionError(f"Scene analysis failed: {e}")
    
    def _determine_environment(self, objects: List[SceneObject]) -> str:
        """Determine if scene is indoor/outdoor based on detected objects"""
        indoor_objects = {"chair", "table", "bed", "tv", "couch", "lamp"}
        outdoor_objects = {"tree", "car", "building", "street", "traffic light"}
        
        indoor_count = sum(1 for obj in objects if obj.label.lower() in indoor_objects)
        outdoor_count = sum(1 for obj in objects if obj.label.lower() in outdoor_objects)
        
        return "indoor" if indoor_count > outdoor_count else "outdoor"
    
    def _estimate_time_of_day(self, frame: np.ndarray) -> Optional[str]:
        """Estimate time of day from image brightness and color temperature"""
        mean_brightness = np.mean(frame)
        if mean_brightness < 50:
            return "night"
        elif mean_brightness < 100:
            return "evening/dawn"
        else:
            return "day"
    
    def _analyze_lighting(self, frame: np.ndarray) -> str:
        """Analyze lighting conditions in the scene"""
        mean_brightness = np.mean(frame)
        if mean_brightness < 60:
            return "dark"
        elif mean_brightness < 120:
            return "dim"
        else:
            return "bright"
    
    def _analyze_spatial_relationships(self, objects: List[SceneObject]) -> List[Dict[str, Any]]:
        """Analyze spatial relationships between detected objects"""
        relationships = []
        for i, obj1 in enumerate(objects):
            for obj2 in objects[i+1:]:
                rel = self._get_spatial_relationship(obj1, obj2)
                if rel:
                    relationships.append({
                        "object1": obj1.label,
                        "object2": obj2.label,
                        "relationship": rel
                    })
        return relationships
    
    def _get_spatial_relationship(self, obj1: SceneObject, obj2: SceneObject) -> Optional[str]:
        """Determine spatial relationship between two objects"""
        box1 = obj1.bounding_box
        box2 = obj2.bounding_box
        
        # Calculate centers
        center1 = ((box1[0] + box1[2])/2, (box1[1] + box1[3])/2)
        center2 = ((box2[0] + box2[2])/2, (box2[1] + box2[3])/2)
        
        # Determine horizontal relationship
        if center1[0] < center2[0]:
            h_rel = "left of"
        else:
            h_rel = "right of"
            
        # Determine vertical relationship
        if center1[1] < center2[1]:
            v_rel = "above"
        else:
            v_rel = "below"
            
        # Return the more significant relationship based on distance
        dx = abs(center1[0] - center2[0])
        dy = abs(center1[1] - center2[1])
        return h_rel if dx > dy else v_rel
    
    def _detect_activities(self, objects: List[SceneObject]) -> List[str]:
        """Detect ongoing activities based on object combinations"""
        activities = []
        object_labels = {obj.label.lower() for obj in objects}
        
        # Activity detection rules
        if {"person", "chair"}.issubset(object_labels):
            activities.append("sitting")
        if {"person", "book"}.issubset(object_labels):
            activities.append("reading")
        if {"person", "laptop"}.issubset(object_labels):
            activities.append("working")
        if {"person", "car"}.issubset(object_labels):
            activities.append("driving/traveling")
            
        return activities
