"""
Gesture Recognition for ALEJO
Handles real-time hand gesture and sign language detection
"""

import logging
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
import cv2
import mediapipe as mp
from dataclasses import dataclass
import torch
from transformers import AutoFeatureExtractor, AutoModelForImageClassification
from .gesture_trainer import GestureTrainer, GestureExample

logger = logging.getLogger("alejo.vision.gesture_recognition")

@dataclass
class HandLandmark:
    """Individual hand landmark point"""
    x: float
    y: float
    z: float
    visibility: float

@dataclass
class Hand:
    """Detected hand with landmarks and gesture information"""
    landmarks: Dict[str, HandLandmark]
    handedness: str  # 'Left' or 'Right'
    gesture: Optional[str]  # Detected gesture
    confidence: float
    sign: Optional[str]  # Detected sign language symbol
    sign_confidence: float
    bounding_box: Tuple[float, float, float, float]  # (x1, y1, x2, y2)

class GestureRecognizer:
    """
    Real-time hand gesture and sign language recognition
    Features:
    - Hand detection and tracking
    - 3D landmark detection
    - Dynamic gesture recognition
    - Basic sign language interpretation
    - Custom gesture training
    """
    
    def __init__(self, model_dir: str = "models/gestures"):
        """Initialize gesture recognition components"""
        self.initialized = False
        
        try:
            # Initialize MediaPipe Hands
            self.mp_hands = mp.solutions.hands
            self.hands = self.mp_hands.Hands(
                static_image_mode=False,
                max_num_hands=2,
                min_detection_confidence=0.7,
                min_tracking_confidence=0.5
            )
            
            # Initialize gesture classifier
            self.feature_extractor = AutoFeatureExtractor.from_pretrained(
                "microsoft/resnet-50"  # Base model for transfer learning
            )
            self.gesture_classifier = AutoModelForImageClassification.from_pretrained(
                "microsoft/resnet-50"
            )
            
            # Standard gesture mappings
            self.gestures = {
                0: "open_palm",
                1: "closed_fist",
                2: "pointing",
                3: "thumbs_up",
                4: "thumbs_down",
                5: "peace",
                6: "ok_sign",
                7: "wave"
            }
            
            # Initialize sign language detector
            self.sign_detector = AutoModelForImageClassification.from_pretrained(
                "microsoft/resnet-50"  # Will be fine-tuned for sign language
            )
            
            # Hand landmark names
            self.landmark_names = {
                "WRIST": 0,
                "THUMB_CMC": 1, "THUMB_MCP": 2, "THUMB_IP": 3, "THUMB_TIP": 4,
                "INDEX_FINGER_MCP": 5, "INDEX_FINGER_PIP": 6, 
                "INDEX_FINGER_DIP": 7, "INDEX_FINGER_TIP": 8,
                "MIDDLE_FINGER_MCP": 9, "MIDDLE_FINGER_PIP": 10,
                "MIDDLE_FINGER_DIP": 11, "MIDDLE_FINGER_TIP": 12,
                "RING_FINGER_MCP": 13, "RING_FINGER_PIP": 14,
                "RING_FINGER_DIP": 15, "RING_FINGER_TIP": 16,
                "PINKY_MCP": 17, "PINKY_PIP": 18, "PINKY_DIP": 19, "PINKY_TIP": 20
            }
            
            # Initialize gesture trainer
            self.trainer = GestureTrainer(self, model_dir)
            
            # Load custom gesture model if available
            self.custom_model, self.custom_gestures = self.trainer.load_model()
            if self.custom_model:
                logger.info(f"Loaded {len(self.custom_gestures)} custom gestures")
            
            self.initialized = True
            logger.info("Initialized gesture recognizer with all components")
        except Exception as e:
            logger.error(f"Failed to initialize gesture recognizer: {e}")
            raise
            
    def detect_hands(self, frame: np.ndarray) -> List[Hand]:
        """
        Detect and analyze hands in a frame
        
        Args:
            frame: Video frame as numpy array
            
        Returns:
            List of detected hands with landmarks and gestures
        """
        if not self.initialized:
            raise RuntimeError("Gesture recognizer not initialized")
            
        try:
            # Convert to RGB for MediaPipe
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # Process frame
            results = self.hands.process(rgb_frame)
            
            detected_hands = []
            if results.multi_hand_landmarks:
                for hand_landmarks, handedness in zip(
                    results.multi_hand_landmarks,
                    results.multi_handedness
                ):
                    # Extract hand information
                    landmarks = {}
                    for name, idx in self.landmark_names.items():
                        landmark = hand_landmarks.landmark[idx]
                        landmarks[name] = HandLandmark(
                            x=landmark.x,
                            y=landmark.y,
                            z=landmark.z,
                            visibility=1.0  # MediaPipe doesn't provide visibility
                        )
                    
                    # Get hand bounding box
                    h, w, _ = frame.shape
                    x_coords = [lm.x * w for lm in hand_landmarks.landmark]
                    y_coords = [lm.y * h for lm in hand_landmarks.landmark]
                    x1, y1 = min(x_coords), min(y_coords)
                    x2, y2 = max(x_coords), max(y_coords)
                    
                    # Add padding to bounding box
                    padding = 20
                    x1 = max(0, x1 - padding)
                    y1 = max(0, y1 - padding)
                    x2 = min(w, x2 + padding)
                    y2 = min(h, y2 + padding)
                    
                    # Extract hand region
                    hand_img = frame[int(y1):int(y2), int(x1):int(x2)]
                    if hand_img.size == 0:
                        continue
                    
                    # Prepare image for classification
                    inputs = self.feature_extractor(
                        hand_img, return_tensors="pt"
                    )
                    
                    # Get gesture predictions from base model
                    with torch.no_grad():
                        outputs = self.gesture_classifier(**inputs)
                        gesture_probs = torch.nn.functional.softmax(
                            outputs.logits, dim=-1
                        )
                        
                        # Check custom gestures if available
                        custom_gesture = None
                        custom_conf = 0.0
                        if self.custom_model:
                            # Extract landmark features
                            features = []
                            for name in sorted(landmarks.keys()):
                                lm = landmarks[name]
                                features.extend([lm.x, lm.y, lm.z])
                            features.append(
                                1.0 if handedness.classification[0].label == 'Right' else 0.0
                            )
                            
                            # Get custom gesture predictions
                            custom_outputs = self.custom_model(
                                torch.tensor(features, dtype=torch.float32)
                            )
                            custom_probs = torch.nn.functional.softmax(
                                custom_outputs, dim=-1
                            )
                            
                            # Get best custom gesture
                            custom_idx = torch.argmax(custom_probs).item()
                            custom_conf = float(custom_probs[custom_idx])
                            if custom_conf > 0.8:  # High confidence threshold
                                custom_gesture = self.custom_gestures[custom_idx]
                        
                        # Get sign language predictions
                        sign_outputs = self.sign_detector(**inputs)
                        sign_probs = torch.nn.functional.softmax(
                            sign_outputs.logits, dim=-1
                        )
                    
                    # Get best gesture and sign
                    gesture_idx = torch.argmax(gesture_probs).item()
                    gesture = self.gestures.get(gesture_idx)
                    gesture_conf = float(gesture_probs[0][gesture_idx])
                    
                    sign_idx = torch.argmax(sign_probs).item()
                    sign = None  # TODO: Add sign language mapping
                    sign_conf = float(sign_probs[0][sign_idx])
                    
                    # Create Hand object
                    hand = Hand(
                        landmarks=landmarks,
                        handedness=handedness.classification[0].label,
                        gesture=gesture,
                        confidence=gesture_conf,
                        sign=sign,
                        sign_confidence=sign_conf,
                        bounding_box=(float(x1), float(y1), float(x2), float(y2))
                    )
                    detected_hands.append(hand)
            
            return detected_hands
            
        except Exception as e:
            logger.error(f"Error during hand detection: {e}")
            raise
            
    async def train_custom_gesture(self, name: str, examples: List[np.ndarray]) -> bool:
        """Train the gesture classifier on a new custom gesture
        
        Args:
            name: Name of the new gesture
            examples: List of example frames showing the gesture
            
        Returns:
            True if training was successful
        """
        try:
            # Add examples to trainer
            success_count = 0
            for frame in examples:
                if await self.trainer.add_example(frame, name):
                    success_count += 1
                    
            if success_count < self.trainer.min_examples:
                logger.warning(
                    f"Not enough successful examples for gesture '{name}' "
                    f"(have {success_count}, need {self.trainer.min_examples})"
                )
                return False
                
            # Train the model
            if self.trainer.train():
                # Update custom gesture model
                self.custom_model, self.custom_gestures = self.trainer.load_model()
                logger.info(f"Successfully trained gesture '{name}'")
                return True
                
            return False
            
        except Exception as e:
            logger.error(f"Error training custom gesture: {e}")
            return False
    
    def save_custom_gestures(self, path: str):
        """Save trained custom gestures to file"""
        # TODO: Implement gesture model saving
        pass
    
    def load_custom_gestures(self, path: str):
        """Load trained custom gestures from file"""
        # TODO: Implement gesture model loading
        pass
