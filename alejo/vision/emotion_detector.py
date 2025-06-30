"""
Facial Emotion Recognition for ALEJO
Detects and analyzes facial emotions in real-time
"""

import logging
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
import cv2
from dataclasses import dataclass
import torch
from transformers import AutoFeatureExtractor, AutoModelForImageClassification

logger = logging.getLogger("alejo.vision.emotion_detector")

@dataclass
class FaceEmotion:
    """Represents detected emotion in a face"""
    emotion: str
    confidence: float
    bounding_box: Tuple[float, float, float, float]  # (x1, y1, x2, y2)
    facial_landmarks: Dict[str, Tuple[float, float]]  # Key points like eyes, mouth
    secondary_emotions: Dict[str, float]  # Other possible emotions with confidences
    intensity: float  # Overall emotional intensity
    valence: float  # Positive/negative value (-1 to 1)
    arousal: float  # Calm/excited value (0 to 1)

class EmotionDetector:
    """
    Real-time facial emotion recognition using state-of-the-art models
    Supports:
    - 7 basic emotions (happy, sad, angry, fearful, surprised, disgusted, neutral)
    - Intensity and valence detection
    - Multiple face tracking
    - Facial landmark detection
    """
    
    def __init__(self):
        """Initialize emotion detection models"""
        self.initialized = False
        
        try:
            # Initialize face detection
            self.face_cascade = cv2.CascadeClassifier(
                cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
            )
            
            # Initialize emotion classification model
            self.feature_extractor = AutoFeatureExtractor.from_pretrained(
                "dima806/facial_emotions_image_detection"  # Trained on FER2013
            )
            self.emotion_classifier = AutoModelForImageClassification.from_pretrained(
                "dima806/facial_emotions_image_detection"
            )
            
            # Initialize facial landmark detector
            self.landmark_detector = cv2.face.createFacemarkLBF()
            self.landmark_detector.loadModel("lbfmodel.yaml")  # Pre-trained model
            
            # Emotion mapping
            self.emotions = [
                'angry', 'disgust', 'fear', 'happy', 
                'neutral', 'sad', 'surprise'
            ]
            
            self.initialized = True
            logger.info("Initialized emotion detector with all models")
        except Exception as e:
            logger.error(f"Failed to initialize emotion detector: {e}")
            raise
            
    def detect_emotions(self, frame: np.ndarray) -> List[FaceEmotion]:
        """
        Detect emotions in faces from a frame
        
        Args:
            frame: Video frame as numpy array
            
        Returns:
            List of detected face emotions
        """
        if not self.initialized:
            raise RuntimeError("Emotion detector not initialized")
            
        try:
            # Convert to grayscale for face detection
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            
            # Detect faces
            faces = self.face_cascade.detectMultiScale(
                gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30)
            )
            
            # Process each face
            emotions = []
            for (x, y, w, h) in faces:
                # Extract face ROI
                face_roi = frame[y:y+h, x:x+w]
                
                # Get facial landmarks
                success, landmarks = self.landmark_detector.fit(gray, faces)
                facial_landmarks = {}
                if success:
                    for points in landmarks:
                        for i, point in enumerate(points[0]):
                            x, y = point
                            # Map landmark indices to facial features
                            feature = self._get_landmark_name(i)
                            facial_landmarks[feature] = (float(x), float(y))
                
                # Prepare image for emotion classification
                inputs = self.feature_extractor(
                    face_roi, return_tensors="pt"
                )
                
                # Get emotion predictions
                with torch.no_grad():
                    outputs = self.emotion_classifier(**inputs)
                    probs = torch.nn.functional.softmax(outputs.logits, dim=-1)
                
                # Get emotion probabilities
                emotion_probs = {
                    self.emotions[i]: float(prob)
                    for i, prob in enumerate(probs[0])
                }
                
                # Find primary emotion
                primary_emotion = max(emotion_probs.items(), key=lambda x: x[1])
                
                # Calculate emotional metrics
                intensity = float(torch.max(probs))
                
                # Calculate valence (positive/negative value)
                positive_emotions = ['happy', 'surprise', 'neutral']
                negative_emotions = ['sad', 'angry', 'fear', 'disgust']
                valence = 0.0
                for emotion, prob in emotion_probs.items():
                    if emotion in positive_emotions:
                        valence += prob
                    elif emotion in negative_emotions:
                        valence -= prob
                valence = max(-1.0, min(1.0, valence))
                
                # Calculate arousal (emotional intensity)
                calm_emotions = ['neutral', 'sad']
                excited_emotions = ['happy', 'angry', 'surprise', 'fear']
                arousal = 0.0
                for emotion, prob in emotion_probs.items():
                    if emotion in excited_emotions:
                        arousal += prob
                    elif emotion in calm_emotions:
                        arousal -= prob
                arousal = max(0.0, min(1.0, (arousal + 1.0) / 2.0))
                
                # Create FaceEmotion object
                face_emotion = FaceEmotion(
                    emotion=primary_emotion[0],
                    confidence=primary_emotion[1],
                    bounding_box=(float(x), float(y), float(x+w), float(y+h)),
                    facial_landmarks=facial_landmarks,
                    secondary_emotions={
                        k: v for k, v in emotion_probs.items()
                        if k != primary_emotion[0]
                    },
                    intensity=intensity,
                    valence=valence,
                    arousal=arousal
                )
                emotions.append(face_emotion)
            
            return emotions
            
        except Exception as e:
            logger.error(f"Error during emotion detection: {e}")
            raise
            
    def _get_landmark_name(self, index: int) -> str:
        """Map landmark index to facial feature name"""
        # Standard facial landmark mapping
        landmarks = {
            range(0, 17): "jaw",
            range(17, 22): "right_eyebrow",
            range(22, 27): "left_eyebrow",
            range(27, 31): "nose_bridge",
            range(31, 36): "nose_tip",
            range(36, 42): "right_eye",
            range(42, 48): "left_eye",
            range(48, 60): "outer_lip",
            range(60, 68): "inner_lip"
        }
        
        for range_obj, name in landmarks.items():
            if index in range_obj:
                return name
        return "unknown"
