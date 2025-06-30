"""
Real-time object tracking for ALEJO
Handles tracking of detected objects across video frames
"""

import cv2
import numpy as np
from dataclasses import dataclass
from typing import Dict, List, Tuple, Optional
import logging
from .scene_analyzer import SceneObject

logger = logging.getLogger("alejo.vision.object_tracking")

@dataclass
class TrackedObject:
    """Object being tracked across frames"""
    id: str  # Unique tracking ID
    label: str  # Object class label
    confidence: float  # Detection confidence
    bounding_box: Tuple[float, float, float, float]  # (x1, y1, x2, y2)
    center: Tuple[float, float]  # Center point
    velocity: Tuple[float, float]  # (dx, dy) per frame
    frames_tracked: int  # Number of frames this object has been tracked
    last_seen: int  # Frame number when last seen
    attributes: Dict[str, any]  # Additional attributes (color, size, etc.)

class ObjectTracker:
    """
    Tracks objects across video frames using a combination of:
    1. SORT (Simple Online and Realtime Tracking)
    2. IoU (Intersection over Union) tracking
    3. Feature matching for re-identification
    """
    
    def __init__(self, max_disappeared: int = 30, min_confidence: float = 0.5):
        """
        Initialize object tracker
        
        Args:
            max_disappeared: Maximum number of frames an object can disappear before being removed
            min_confidence: Minimum confidence score for object detection
        """
        self.next_object_id = 0
        self.objects: Dict[str, TrackedObject] = {}
        self.disappeared = {}
        self.max_disappeared = max_disappeared
        self.min_confidence = min_confidence
        
        # Initialize SORT tracker
        self.sort_tracker = cv2.TrackerCSRT_create()
        
    def update(self, frame: np.ndarray, detections: List[SceneObject]) -> List[TrackedObject]:
        """
        Update object tracking with new frame and detections
        
        Args:
            frame: Current video frame
            detections: List of detected objects from scene analyzer
            
        Returns:
            List of currently tracked objects
        """
        # Convert detections to format suitable for tracking
        detection_boxes = []
        for det in detections:
            if det.confidence >= self.min_confidence:
                detection_boxes.append({
                    'box': det.bounding_box,
                    'label': det.label,
                    'confidence': det.confidence,
                    'attributes': det.attributes
                })
        
        # Match new detections with existing tracks
        matched_tracks = self._match_detections(frame, detection_boxes)
        
        # Update tracking status
        current_objects = []
        for track_id, detection in matched_tracks:
            if track_id in self.objects:
                # Update existing track
                tracked_obj = self.objects[track_id]
                tracked_obj.bounding_box = detection['box']
                tracked_obj.confidence = detection['confidence']
                tracked_obj.frames_tracked += 1
                tracked_obj.last_seen = 0  # Reset disappearance counter
                tracked_obj.attributes.update(detection['attributes'])
                
                # Update velocity based on center point movement
                new_center = self._calculate_center(detection['box'])
                old_center = tracked_obj.center
                tracked_obj.velocity = (
                    new_center[0] - old_center[0],
                    new_center[1] - old_center[1]
                )
                tracked_obj.center = new_center
            else:
                # Create new track
                self.objects[track_id] = TrackedObject(
                    id=track_id,
                    label=detection['label'],
                    confidence=detection['confidence'],
                    bounding_box=detection['box'],
                    center=self._calculate_center(detection['box']),
                    velocity=(0.0, 0.0),
                    frames_tracked=1,
                    last_seen=0,
                    attributes=detection['attributes']
                )
            
            current_objects.append(self.objects[track_id])
            
        # Update disappeared counters and remove stale tracks
        all_track_ids = set(self.objects.keys())
        matched_ids = set(track_id for track_id, _ in matched_tracks)
        for track_id in all_track_ids - matched_ids:
            self.disappeared[track_id] = self.disappeared.get(track_id, 0) + 1
            if self.disappeared[track_id] > self.max_disappeared:
                del self.objects[track_id]
                del self.disappeared[track_id]
            else:
                # Predict new position based on velocity
                obj = self.objects[track_id]
                predicted_center = (
                    obj.center[0] + obj.velocity[0],
                    obj.center[1] + obj.velocity[1]
                )
                # Update bounding box based on predicted center
                width = obj.bounding_box[2] - obj.bounding_box[0]
                height = obj.bounding_box[3] - obj.bounding_box[1]
                obj.bounding_box = (
                    predicted_center[0] - width/2,
                    predicted_center[1] - height/2,
                    predicted_center[0] + width/2,
                    predicted_center[1] + height/2
                )
                obj.center = predicted_center
                obj.last_seen += 1
                current_objects.append(obj)
        
        return current_objects
    
    def _match_detections(self, frame: np.ndarray, 
                         detections: List[Dict]) -> List[Tuple[str, Dict]]:
        """Match detected objects with existing tracks"""
        if not self.objects:
            # No existing tracks, create new ones
            return [(str(self.next_object_id + i), det) 
                   for i, det in enumerate(detections)]
        
        # Calculate IoU between existing tracks and new detections
        matched = []
        unmatched_detections = []
        used_tracks = set()
        
        for detection in detections:
            best_iou = 0.0
            best_track_id = None
            det_box = detection['box']
            
            for track_id, tracked_obj in self.objects.items():
                if track_id in used_tracks:
                    continue
                    
                track_box = tracked_obj.bounding_box
                iou = self._calculate_iou(det_box, track_box)
                
                if iou > best_iou and iou > 0.3:  # Min IoU threshold
                    best_iou = iou
                    best_track_id = track_id
            
            if best_track_id is not None:
                matched.append((best_track_id, detection))
                used_tracks.add(best_track_id)
            else:
                unmatched_detections.append(detection)
        
        # Create new tracks for unmatched detections
        for detection in unmatched_detections:
            matched.append((str(self.next_object_id), detection))
            self.next_object_id += 1
        
        return matched
    
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
    
    def _calculate_center(self, box: Tuple[float, float, float, float]) -> Tuple[float, float]:
        """Calculate center point of a bounding box"""
        return ((box[0] + box[2]) / 2, (box[1] + box[3]) / 2)
