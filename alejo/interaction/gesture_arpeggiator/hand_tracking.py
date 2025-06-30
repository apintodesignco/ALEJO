"""
Hand Tracking Module for Gesture Arpeggiator

This module implements hand tracking and gesture recognition using MediaPipe,
providing real-time hand landmark detection and gesture classification for
ALEJO's gesture-based arpeggiator system.
"""

import logging
import numpy as np
import cv2
import math
from typing import Dict, List, Optional, Tuple, Any, Union
from enum import Enum
import asyncio
import time
import json

# Import MediaPipe dependencies conditionally to allow for graceful fallback
try:
    import mediapipe as mp
    MEDIAPIPE_AVAILABLE = True
except ImportError:
    MEDIAPIPE_AVAILABLE = False
    logging.warning("MediaPipe not available. Hand tracking will be disabled.")

logger = logging.getLogger(__name__)

class GestureType(str, Enum):
    """Recognized hand gestures for musical control"""
    OPEN = "open"
    CLOSED = "closed"
    POINTING = "pointing"
    PINCH = "pinch"
    VICTORY = "victory"
    THUMBS_UP = "thumbs_up"
    ROCK = "rock"
    PALM_DOWN = "palm_down"
    PALM_UP = "palm_up"
    FIST = "fist"
    UNKNOWN = "unknown"

class HandTracker:
    """
    Hand tracking and gesture recognition using MediaPipe
    
    This class provides real-time hand landmark detection and gesture
    classification for the gesture arpeggiator system.
    """
    
    def __init__(self, 
                 max_num_hands: int = 2,
                 min_detection_confidence: float = 0.7,
                 min_tracking_confidence: float = 0.5):
        """
        Initialize the hand tracker
        
        Args:
            max_num_hands: Maximum number of hands to detect
            min_detection_confidence: Minimum confidence for hand detection
            min_tracking_confidence: Minimum confidence for hand tracking
        """
        self.max_num_hands = max_num_hands
        self.min_detection_confidence = min_detection_confidence
        self.min_tracking_confidence = min_tracking_confidence
        
        self._initialized = False
        self._mp_hands = None
        self._hands = None
        self._mp_drawing = None
        self._mp_drawing_styles = None
        
        # Hand tracking state
        self.current_hands: List[Dict] = []
        self.hand_history: List[List[Dict]] = []
        self.history_max_length = 30  # Store 1 second at 30fps
        
        # Initialize MediaPipe if available
        if MEDIAPIPE_AVAILABLE:
            self._initialize_mediapipe()
        
    def _initialize_mediapipe(self):
        """Initialize MediaPipe Hands solution"""
        try:
            mp_hands = mp.solutions.hands
            mp_drawing = mp.solutions.drawing_utils
            mp_drawing_styles = mp.solutions.drawing_styles
            
            # Initialize the Hands solution
            hands = mp_hands.Hands(
                static_image_mode=False,
                max_num_hands=self.max_num_hands,
                min_detection_confidence=self.min_detection_confidence,
                min_tracking_confidence=self.min_tracking_confidence
            )
            
            self._mp_hands = mp_hands
            self._hands = hands
            self._mp_drawing = mp_drawing
            self._mp_drawing_styles = mp_drawing_styles
            self._initialized = True
            
            logger.info("MediaPipe Hands initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize MediaPipe Hands: {e}")
            self._initialized = False
            
    def is_initialized(self) -> bool:
        """Check if the hand tracker is initialized"""
        return self._initialized
        
    def process_frame(self, frame: np.ndarray) -> Tuple[List[Dict], np.ndarray]:
        """
        Process a video frame to detect and track hands
        
        Args:
            frame: Input video frame (BGR format)
            
        Returns:
            Tuple of (hand_data, annotated_frame)
        """
        if not self._initialized:
            return [], frame
            
        # Convert BGR to RGB
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        # Process the frame with MediaPipe Hands
        results = self._hands.process(frame_rgb)
        
        # Convert back to BGR for OpenCV
        annotated_frame = cv2.cvtColor(frame_rgb, cv2.COLOR_RGB2BGR)
        
        # Extract hand data
        hand_data = self._extract_hand_data(results, frame.shape)
        
        # Update hand history
        self.current_hands = hand_data
        self.hand_history.append(hand_data)
        if len(self.hand_history) > self.history_max_length:
            self.hand_history.pop(0)
            
        # Draw hand landmarks on the frame
        if results.multi_hand_landmarks:
            for hand_landmarks in results.multi_hand_landmarks:
                self._mp_drawing.draw_landmarks(
                    annotated_frame,
                    hand_landmarks,
                    self._mp_hands.HAND_CONNECTIONS,
                    self._mp_drawing_styles.get_default_hand_landmarks_style(),
                    self._mp_drawing_styles.get_default_hand_connections_style()
                )
                
        return hand_data, annotated_frame
        
    def _extract_hand_data(self, results, frame_shape) -> List[Dict]:
        """
        Extract hand data from MediaPipe results
        
        Args:
            results: MediaPipe Hands processing results
            frame_shape: Shape of the input frame
            
        Returns:
            List of hand data dictionaries
        """
        hands = []
        
        if not results.multi_hand_landmarks:
            return hands
            
        height, width, _ = frame_shape
        
        # Process each detected hand
        for idx, (hand_landmarks, handedness) in enumerate(
            zip(results.multi_hand_landmarks, results.multi_handedness)
        ):
            # Extract landmarks
            landmarks = []
            for landmark in hand_landmarks.landmark:
                landmarks.append({
                    "x": landmark.x,
                    "y": landmark.y,
                    "z": landmark.z
                })
                
            # Determine if left or right hand
            is_left = handedness.classification[0].label == "Left"
            
            # Calculate hand center position
            center_x = sum(lm["x"] for lm in landmarks) / len(landmarks)
            center_y = sum(lm["y"] for lm in landmarks) / len(landmarks)
            center_z = sum(lm["z"] for lm in landmarks) / len(landmarks)
            
            # Recognize gesture
            gesture = self._recognize_gesture(landmarks)
            
            # Calculate confidence
            confidence = handedness.classification[0].score
            
            # Create hand data dictionary
            hand_data = {
                "id": idx,
                "landmarks": landmarks,
                "gesture": gesture,
                "position": {
                    "x": center_x,
                    "y": center_y,
                    "z": center_z
                },
                "isLeft": is_left,
                "confidence": confidence
            }
            
            hands.append(hand_data)
            
        return hands
        
    def _recognize_gesture(self, landmarks: List[Dict]) -> str:
        """
        Recognize hand gesture from landmarks
        
        Args:
            landmarks: List of hand landmarks
            
        Returns:
            Recognized gesture type
        """
        if not landmarks or len(landmarks) < 21:
            return GestureType.UNKNOWN
            
        # Extract key landmarks
        wrist = landmarks[0]
        thumb_tip = landmarks[4]
        index_tip = landmarks[8]
        middle_tip = landmarks[12]
        ring_tip = landmarks[16]
        pinky_tip = landmarks[20]
        
        # Calculate finger extensions
        fingers_extended = self._get_extended_fingers(landmarks)
        
        # Recognize gestures based on finger positions
        if sum(fingers_extended) == 0:
            return GestureType.FIST
        elif sum(fingers_extended) == 5:
            # Check palm orientation
            if self._is_palm_facing_down(landmarks):
                return GestureType.PALM_DOWN
            else:
                return GestureType.OPEN
        elif fingers_extended == [0, 1, 0, 0, 0]:
            return GestureType.POINTING
        elif fingers_extended == [0, 1, 1, 0, 0]:
            return GestureType.VICTORY
        elif fingers_extended == [1, 0, 0, 0, 0]:
            return GestureType.THUMBS_UP
        elif fingers_extended == [1, 0, 0, 0, 1]:
            return GestureType.ROCK
        elif self._is_pinching(landmarks):
            return GestureType.PINCH
            
        return GestureType.UNKNOWN
        
    def _get_extended_fingers(self, landmarks: List[Dict]) -> List[int]:
        """
        Determine which fingers are extended
        
        Args:
            landmarks: List of hand landmarks
            
        Returns:
            List of binary values indicating extended fingers
            [thumb, index, middle, ring, pinky]
        """
        # Get key points
        wrist = landmarks[0]
        thumb_tip = landmarks[4]
        thumb_ip = landmarks[3]
        thumb_mcp = landmarks[2]
        
        index_tip = landmarks[8]
        index_pip = landmarks[6]
        
        middle_tip = landmarks[12]
        middle_pip = landmarks[10]
        
        ring_tip = landmarks[16]
        ring_pip = landmarks[14]
        
        pinky_tip = landmarks[20]
        pinky_pip = landmarks[18]
        
        # Check if each finger is extended
        # Thumb is special case
        thumb_extended = self._is_thumb_extended(thumb_tip, thumb_ip, thumb_mcp, wrist)
        
        # For other fingers, compare tip position to PIP joint
        index_extended = index_tip["y"] < index_pip["y"]
        middle_extended = middle_tip["y"] < middle_pip["y"]
        ring_extended = ring_tip["y"] < ring_pip["y"]
        pinky_extended = pinky_tip["y"] < pinky_pip["y"]
        
        return [
            1 if thumb_extended else 0,
            1 if index_extended else 0,
            1 if middle_extended else 0,
            1 if ring_extended else 0,
            1 if pinky_extended else 0
        ]
        
    def _is_thumb_extended(self, tip, ip, mcp, wrist) -> bool:
        """
        Check if thumb is extended
        
        Args:
            tip: Thumb tip landmark
            ip: Thumb IP joint landmark
            mcp: Thumb MCP joint landmark
            wrist: Wrist landmark
            
        Returns:
            True if thumb is extended, False otherwise
        """
        # Calculate vectors
        wrist_to_mcp = [mcp["x"] - wrist["x"], mcp["y"] - wrist["y"]]
        mcp_to_tip = [tip["x"] - mcp["x"], tip["y"] - mcp["y"]]
        
        # Calculate angle between vectors
        dot_product = wrist_to_mcp[0] * mcp_to_tip[0] + wrist_to_mcp[1] * mcp_to_tip[1]
        wrist_to_mcp_mag = math.sqrt(wrist_to_mcp[0]**2 + wrist_to_mcp[1]**2)
        mcp_to_tip_mag = math.sqrt(mcp_to_tip[0]**2 + mcp_to_tip[1]**2)
        
        if wrist_to_mcp_mag * mcp_to_tip_mag == 0:
            return False
            
        cos_angle = dot_product / (wrist_to_mcp_mag * mcp_to_tip_mag)
        cos_angle = max(-1.0, min(1.0, cos_angle))  # Clamp to [-1, 1]
        angle = math.acos(cos_angle) * 180 / math.pi
        
        # Thumb is extended if angle is large enough
        return angle > 30
        
    def _is_pinching(self, landmarks: List[Dict]) -> bool:
        """
        Check if hand is making a pinch gesture
        
        Args:
            landmarks: List of hand landmarks
            
        Returns:
            True if pinching, False otherwise
        """
        thumb_tip = landmarks[4]
        index_tip = landmarks[8]
        
        # Calculate distance between thumb and index fingertips
        dx = thumb_tip["x"] - index_tip["x"]
        dy = thumb_tip["y"] - index_tip["y"]
        dz = thumb_tip["z"] - index_tip["z"]
        
        distance = math.sqrt(dx*dx + dy*dy + dz*dz)
        
        # Pinch threshold
        return distance < 0.05
        
    def _is_palm_facing_down(self, landmarks: List[Dict]) -> bool:
        """
        Check if palm is facing down
        
        Args:
            landmarks: List of hand landmarks
            
        Returns:
            True if palm is facing down, False otherwise
        """
        # Use cross product of vectors to determine palm orientation
        wrist = landmarks[0]
        index_mcp = landmarks[5]
        pinky_mcp = landmarks[17]
        
        # Create vectors
        v1 = [index_mcp["x"] - wrist["x"], 
              index_mcp["y"] - wrist["y"], 
              index_mcp["z"] - wrist["z"]]
              
        v2 = [pinky_mcp["x"] - wrist["x"], 
              pinky_mcp["y"] - wrist["y"], 
              pinky_mcp["z"] - wrist["z"]]
              
        # Cross product
        cross = [
            v1[1] * v2[2] - v1[2] * v2[1],
            v1[2] * v2[0] - v1[0] * v2[2],
            v1[0] * v2[1] - v1[1] * v2[0]
        ]
        
        # If z component of cross product is negative, palm is facing down
        return cross[2] < 0
        
    def get_current_hands(self) -> List[Dict]:
        """Get current hand tracking data"""
        return self.current_hands
        
    def get_hand_history(self) -> List[List[Dict]]:
        """Get hand tracking history"""
        return self.hand_history
        
    def release(self):
        """Release resources"""
        if self._initialized and self._hands:
            self._hands.close()
            self._initialized = False
