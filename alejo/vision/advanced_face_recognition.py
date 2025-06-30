"""
Advanced Face Recognition Module for ALEJO
Combines multiple state-of-the-art face recognition and analysis technologies
"""

import os
import cv2
import numpy as np
import torch
import mediapipe as mp
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from deepface import DeepFace
from retinaface import RetinaFace
from insightface.app import FaceAnalysis
from ..core.config import Config
from ..utils.logging import get_logger

logger = get_logger(__name__)

class AdvancedFaceRecognition:
    """Advanced face recognition system combining multiple ML models"""
    
    def __init__(self, config: Optional[Config] = None):
        self.config = config or Config()
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        
        # Initialize all models
        self._init_models()
        
        # Cache for recognized faces
        self.known_faces_dir = Path(self.config.get('known_faces_dir', 'data/known_faces'))
        self.known_faces_dir.mkdir(parents=True, exist_ok=True)
        self.face_encodings_cache = {}
        self._load_known_faces()

    def _init_models(self):
        """Initialize all face detection and analysis models"""
        logger.info("Initializing face recognition models...")
        
        # MediaPipe for real-time face mesh
        self.mp_face_mesh = mp.solutions.face_mesh.FaceMesh(
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        
        # RetinaFace for robust face detection
        self.retina = RetinaFace(quality="normal")
        
        # InsightFace for state-of-the-art face analysis
        self.insight_face = FaceAnalysis(
            name="buffalo_l",
            providers=['CUDAExecutionProvider', 'CPUExecutionProvider']
        )
        self.insight_face.prepare(ctx_id=0)
        
        # Initialize emotion detection model
        self.emotion_model = DeepFace.build_model('Emotion')
        
        logger.info("All face recognition models initialized successfully")

    def _load_known_faces(self):
        """Load known face encodings from disk"""
        for face_dir in self.known_faces_dir.iterdir():
            if face_dir.is_dir():
                identity = face_dir.name
                encodings = []
                for img_path in face_dir.glob('*.jpg'):
                    try:
                        face_img = cv2.imread(str(img_path))
                        face_encoding = self.get_face_encoding(face_img)
                        if face_encoding is not None:
                            encodings.append(face_encoding)
                    except Exception as e:
                        logger.error(f"Error loading face encoding for {img_path}: {e}")
                if encodings:
                    self.face_encodings_cache[identity] = np.mean(encodings, axis=0)

    def get_face_encoding(self, image: np.ndarray) -> Optional[np.ndarray]:
        """Get face encoding using InsightFace"""
        faces = self.insight_face.get(image)
        if faces:
            return faces[0].embedding
        return None

    def detect_faces(self, image: np.ndarray) -> List[Dict]:
        """Detect faces using RetinaFace for high accuracy"""
        faces = self.retina.detect_faces(image)
        if isinstance(faces, tuple):
            return []
        
        results = []
        for face_idx, face_data in faces.items():
            bbox = face_data['facial_area']
            landmarks = face_data['landmarks']
            confidence = face_data['score']
            
            if confidence > 0.9:  # High confidence threshold
                results.append({
                    'bbox': bbox,
                    'landmarks': landmarks,
                    'confidence': confidence
                })
        return results

    def analyze_face(self, image: np.ndarray, face_data: Dict) -> Dict:
        """Comprehensive face analysis using multiple models"""
        bbox = face_data['bbox']
        face_img = image[bbox[1]:bbox[3], bbox[0]:bbox[2]]
        
        # Get face mesh landmarks
        rgb_img = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        mesh_results = self.mp_face_mesh.process(rgb_img)
        
        # Analyze with InsightFace
        insight_results = self.insight_face.get(face_img)
        
        # Emotion analysis with DeepFace
        try:
            emotion_results = DeepFace.analyze(
                face_img, 
                actions=['emotion'],
                enforce_detection=False,
                detector_backend='retinaface'
            )
        except Exception as e:
            logger.warning(f"Emotion detection failed: {e}")
            emotion_results = [{'emotion': {}}]

        # Combine all results
        analysis = {
            'face_mesh': self._process_face_mesh(mesh_results) if mesh_results.multi_face_landmarks else None,
            'age': insight_results[0].age if insight_results else None,
            'gender': insight_results[0].gender if insight_results else None,
            'emotions': emotion_results[0]['emotion'],
            'landmarks_3d': self._extract_3d_landmarks(mesh_results) if mesh_results.multi_face_landmarks else None,
            'face_encoding': self.get_face_encoding(face_img)
        }
        
        # Attempt identity recognition
        if analysis['face_encoding'] is not None:
            analysis['identity'] = self._identify_face(analysis['face_encoding'])
        
        return analysis

    def _process_face_mesh(self, mesh_results) -> Dict:
        """Process MediaPipe face mesh results"""
        if not mesh_results.multi_face_landmarks:
            return None
            
        landmarks = mesh_results.multi_face_landmarks[0]
        points = np.array([[p.x, p.y, p.z] for p in landmarks.landmark])
        
        return {
            'points': points,
            'contours': self._extract_face_contours(points),
            'features': self._extract_facial_features(points)
        }

    def _extract_3d_landmarks(self, mesh_results) -> np.ndarray:
        """Extract 3D landmarks from face mesh"""
        if not mesh_results.multi_face_landmarks:
            return None
            
        landmarks = mesh_results.multi_face_landmarks[0]
        return np.array([[p.x, p.y, p.z] for p in landmarks.landmark])

    def _extract_face_contours(self, points: np.ndarray) -> Dict:
        """Extract face contour information"""
        return {
            'jaw': points[0:17],
            'left_eyebrow': points[17:22],
            'right_eyebrow': points[22:27],
            'nose_bridge': points[27:31],
            'nose_tip': points[31:36],
            'left_eye': points[36:42],
            'right_eye': points[42:48],
            'outer_lips': points[48:60],
            'inner_lips': points[60:68]
        }

    def _extract_facial_features(self, points: np.ndarray) -> Dict:
        """Extract facial feature measurements"""
        left_eye = points[36:42].mean(axis=0)
        right_eye = points[42:48].mean(axis=0)
        nose_tip = points[33]
        
        return {
            'eye_distance': np.linalg.norm(right_eye - left_eye),
            'eye_nose_ratio': np.linalg.norm(nose_tip - left_eye) / np.linalg.norm(nose_tip - right_eye),
            'face_width': np.linalg.norm(points[0] - points[16]),
            'face_height': np.linalg.norm(points[8] - points[27])
        }

    def _identify_face(self, face_encoding: np.ndarray) -> Optional[str]:
        """Identify a face by comparing with known faces"""
        if not self.face_encodings_cache:
            return None
            
        min_distance = float('inf')
        best_match = None
        
        for identity, known_encoding in self.face_encodings_cache.items():
            distance = np.linalg.norm(face_encoding - known_encoding)
            if distance < min_distance and distance < 0.6:  # Threshold for face similarity
                min_distance = distance
                best_match = identity
                
        return best_match

    def add_known_face(self, identity: str, image: np.ndarray) -> bool:
        """Add a new known face to the database"""
        face_encoding = self.get_face_encoding(image)
        if face_encoding is None:
            return False
            
        identity_dir = self.known_faces_dir / identity
        identity_dir.mkdir(exist_ok=True)
        
        # Save face image
        timestamp = int(time.time())
        image_path = identity_dir / f"{timestamp}.jpg"
        cv2.imwrite(str(image_path), image)
        
        # Update cache
        if identity in self.face_encodings_cache:
            existing_encoding = self.face_encodings_cache[identity]
            self.face_encodings_cache[identity] = (existing_encoding + face_encoding) / 2
        else:
            self.face_encodings_cache[identity] = face_encoding
            
        return True

    def get_face_landmarks(self, image: np.ndarray, face_data: Dict) -> Dict:
        """Get detailed facial landmarks"""
        rgb_img = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        mesh_results = self.mp_face_mesh.process(rgb_img)
        
        if not mesh_results.multi_face_landmarks:
            return None
            
        landmarks = mesh_results.multi_face_landmarks[0]
        points = np.array([[p.x, p.y, p.z] for p in landmarks.landmark])
        
        return self._extract_face_contours(points)

    def analyze_facial_expression(self, image: np.ndarray, face_data: Dict) -> Dict:
        """Detailed analysis of facial expression"""
        bbox = face_data['bbox']
        face_img = image[bbox[1]:bbox[3], bbox[0]:bbox[2]]
        
        try:
            analysis = DeepFace.analyze(
                face_img,
                actions=['emotion', 'age', 'gender', 'race'],
                enforce_detection=False,
                detector_backend='retinaface'
            )[0]
            
            return {
                'emotions': analysis['emotion'],
                'dominant_emotion': analysis['dominant_emotion'],
                'age': analysis['age'],
                'gender': analysis['gender'],
                'race': analysis['race']
            }
        except Exception as e:
            logger.error(f"Error analyzing facial expression: {e}")
            return None

    def cleanup(self):
        """Cleanup resources"""
        self.mp_face_mesh.close()
        # Additional cleanup for other models if needed
