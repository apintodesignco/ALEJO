"""
Face training module for ALEJO
Allows training and customization of ALEJO's facial appearance and expressions
"""

import os
import json
import time
import logging
import cv2
import numpy as np
import torch
from pathlib import Path
from typing import Dict, List, Optional
from ..vision.advanced_face_recognition import AdvancedFaceRecognition
from ..core.config import Config
from ..utils.logging import get_logger

logger = logging.getLogger(__name__)

class FaceTrainer:
    """Advanced face training system for ALEJO using state-of-the-art models"""
    
    def __init__(self, config: Optional[Config] = None):
        """Initialize face trainer with advanced recognition capabilities"""
        self.config = config or Config()
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.face_recognition = AdvancedFaceRecognition(config)
        
        # Training data storage
        self.face_samples_dir = Path(self.config.get('face_samples_dir', 'data/face_samples'))
        self.face_profile_path = self.face_samples_dir / 'face_profile.json'
        self.face_samples_dir.mkdir(parents=True, exist_ok=True)
        self.face_profile = self._load_face_profile()
        
        # Training parameters
        self.min_samples_per_expression = 5
        self.capture_resolution = (1280, 720)  # HD resolution
        self.training_expressions = [
            'neutral', 'happy', 'sad', 'angry', 'surprised',
            'concerned', 'thinking', 'confused', 'focused'
        ]
        self.capture_resolution = (640, 480)

    def _load_face_profile(self):
        """Load existing face profile or create new one"""
        if self.face_profile_path.exists():
            try:
                with open(self.face_profile_path, 'r') as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Error loading face profile: {e}")
                return self._create_default_profile()
        return self._create_default_profile()

    def _create_default_profile(self) -> Dict:
        """Create comprehensive default face profile"""
        return {
            'identity': {
                'name': '',
                'face_encodings': [],
                'recognition_threshold': 0.6
            },
            'facial_features': {
                'eye_distance': 0.0,
                'face_shape': [],
                'symmetry_score': 0.0,
                'facial_proportions': {},
                '3d_landmarks': [],
                'face_mesh': None
            },
            'expressions': {
                expr: {
                    'samples': [],
                    'landmarks': [],
                    'muscle_movements': [],
                    'intensity_range': [0.0, 1.0]
                } for expr in self.training_expressions
            },
            'appearance': {
                'skin_tone': None,
                'face_shape_category': None,
                'distinctive_features': [],
                'age_estimation': None,
                'gender_estimation': None
            },
            'training_progress': {
                'samples_per_expression': {},
                'quality_metrics': {},
                'last_training_date': None,
                'total_samples': 0
            },
            'rendering_preferences': {
                'preferred_angle': 0.0,
                'lighting': {
                    'brightness': 1.0,
                    'contrast': 1.0,
                    'temperature': 6500,
                    'highlights': 1.0,
                    'shadows': 1.0
                },
                'detail_level': 'high',
                'smoothing_factor': 0.1
            }
        }

    def capture_face_sample(self, expression: str = 'neutral') -> Optional[str]:
        """Capture and analyze a face sample with advanced recognition"""
        if expression not in self.training_expressions:
            raise ValueError(f"Invalid expression: {expression}")
            
        logger.info(f"Capturing face sample for expression: {expression}")
        
        cap = cv2.VideoCapture(0)
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.capture_resolution[0])
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.capture_resolution[1])
        
        try:
            # Capture multiple frames for stability
            frames = []
            for _ in range(5):  # Capture 5 frames
                ret, frame = cap.read()
                if not ret:
                    raise RuntimeError("Failed to capture frame from camera")
                frames.append(frame)
                time.sleep(0.1)  # Small delay between frames
            
            # Select best frame based on face detection confidence
            best_frame = None
            best_confidence = 0
            best_face_data = None
            
            for frame in frames:
                faces = self.face_recognition.detect_faces(frame)
                if faces and faces[0]['confidence'] > best_confidence:
                    best_confidence = faces[0]['confidence']
                    best_frame = frame
                    best_face_data = faces[0]
            
            if best_frame is None:
                raise RuntimeError("No suitable face detected in captured frames")

            # Analyze face in detail
            analysis = self.face_recognition.analyze_face(best_frame, best_face_data)
            if not analysis:
                raise RuntimeError("Face analysis failed")
            
            # Generate filename and save
            timestamp = int(time.time())
            sample_path = self.face_samples_dir / f"{expression}_{timestamp}.jpg"
            cv2.imwrite(str(sample_path), best_frame)
            
            # Update profile with comprehensive analysis
            self._update_profile_with_analysis(analysis, expression, str(sample_path))
            self._save_profile()
            
            return str(sample_path)
            
        except Exception as e:
            logger.error(f"Error capturing face sample: {e}")
            return None
            
        finally:
            cap.release()

    def _analyze_face(self, frame, face_data):
        """Analyze facial characteristics from sample"""
        # Extract facial landmarks
        landmarks = self.face_detector.get_facial_landmarks(frame, face_data)
        
        # Calculate eye distance
        left_eye = np.mean(landmarks['left_eye'], axis=0)
        right_eye = np.mean(landmarks['right_eye'], axis=0)
        eye_distance = np.linalg.norm(right_eye - left_eye)
        
        # Calculate face shape using convex hull
        face_points = np.concatenate([
            landmarks['jaw'],
            landmarks['left_eyebrow'],
            landmarks['right_eyebrow']
        ])
        hull = cv2.convexHull(face_points.astype(np.int32))
        face_shape = hull.flatten().tolist()
        
        # Calculate facial symmetry
        symmetry_score = self._calculate_symmetry(landmarks)
        
        return {
            'eye_distance': float(eye_distance),
            'face_shape': face_shape,
            'symmetry_score': float(symmetry_score)
        }

    def _calculate_symmetry(self, landmarks):
        """Calculate facial symmetry score"""
        # Get midline of face
        nose_bridge = landmarks['nose_bridge']
        midline = np.mean(nose_bridge, axis=0)[0]
        
        # Compare left and right sides
        left_points = np.concatenate([
            landmarks['left_eye'],
            landmarks['left_eyebrow'],
            landmarks['left_jaw']
        ])
        right_points = np.concatenate([
            landmarks['right_eye'],
            landmarks['right_eyebrow'],
            landmarks['right_jaw']
        ])
        
        # Calculate distances from midline
        left_distances = np.abs(left_points[:, 0] - midline)
        right_distances = np.abs(right_points[:, 0] - midline)
        
        # Compare distances (1.0 = perfect symmetry)
        diff = np.mean(np.abs(left_distances - right_distances))
        max_dist = np.max(np.concatenate([left_distances, right_distances]))
        symmetry = 1.0 - (diff / max_dist)
        
        return symmetry

    def _update_profile_with_analysis(self, analysis: Dict, expression: str, sample_path: str) -> None:
        """Update face profile with comprehensive analysis results"""
        # Update facial features
        features = self.face_profile['facial_features']
        features['eye_distance'] = analysis.get('eye_distance', features['eye_distance'])
        features['symmetry_score'] = analysis.get('symmetry_score', features['symmetry_score'])
        
        if analysis.get('face_mesh'):
            features['face_mesh'] = analysis['face_mesh']
            features['3d_landmarks'] = analysis.get('landmarks_3d', [])
        
        # Update expression data
        expr_data = self.face_profile['expressions'][expression]
        expr_data['samples'].append(sample_path)
        
        if analysis.get('landmarks'):
            expr_data['landmarks'].append(analysis['landmarks'])
        if len(expr_data['landmarks']) > self.min_samples_per_expression:
            expr_data['landmarks'] = expr_data['landmarks'][-self.min_samples_per_expression:]
        
        # Update appearance data
        if analysis.get('age'):
            self.face_profile['appearance']['age_estimation'] = analysis['age']
        if analysis.get('gender'):
            self.face_profile['appearance']['gender_estimation'] = analysis['gender']
        
        # Update training progress
        progress = self.face_profile['training_progress']
        progress['total_samples'] += 1
        progress['samples_per_expression'][expression] = len(expr_data['samples'])
        
        # Update face encodings for recognition
        if analysis.get('face_encoding') is not None:
            self.face_profile['identity']['face_encodings'].append(
                analysis['face_encoding'].tolist()
            )
            # Keep only most recent encodings
            if len(self.face_profile['identity']['face_encodings']) > 10:
                self.face_profile['identity']['face_encodings'] = \
                    self.face_profile['identity']['face_encodings'][-10:]

    def _assess_sample_quality(self, sample_path: str) -> Dict:
        """Assess the quality of a captured face sample"""
        image = cv2.imread(sample_path)
        if image is None:
            return {'score': 0.0, 'issues': ['Failed to load image']}
        
        issues = []
        score = 1.0
        
        # Detect faces
        faces = self.face_recognition.detect_faces(image)
        if not faces:
            return {'score': 0.0, 'issues': ['No face detected']}
        
        face_data = faces[0]
        confidence = face_data['confidence']
        
        # Check face detection confidence
        if confidence < 0.9:
            score *= confidence
            issues.append('Low face detection confidence')
        
        # Check face size
        bbox = face_data['bbox']
        face_width = bbox[2] - bbox[0]
        face_height = bbox[3] - bbox[1]
        min_size = min(image.shape[0], image.shape[1]) * 0.3
        
        if face_width < min_size or face_height < min_size:
            size_score = max(0.5, min(face_width, face_height) / min_size)
            score *= size_score
            issues.append('Face too small in frame')
        
        # Check face centering
        center_x = (bbox[0] + bbox[2]) / 2
        center_y = (bbox[1] + bbox[3]) / 2
        img_center_x = image.shape[1] / 2
        img_center_y = image.shape[0] / 2
        
        offset_x = abs(center_x - img_center_x) / img_center_x
        offset_y = abs(center_y - img_center_y) / img_center_y
        
        if offset_x > 0.2 or offset_y > 0.2:
            centering_score = 1.0 - max(offset_x, offset_y)
            score *= centering_score
            issues.append('Face not centered in frame')
        
        # Check lighting
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        brightness = np.mean(gray)
        contrast = np.std(gray)
        
        if brightness < 50 or brightness > 200:
            score *= 0.7
            issues.append('Poor lighting conditions')
        if contrast < 30:
            score *= 0.7
            issues.append('Low image contrast')
        
        return {
            'score': float(score),
            'issues': issues
        }

    def _evaluate_training_quality(self) -> Dict:
        """Evaluate overall training quality"""
        strengths = []
        areas_for_improvement = []
        total_score = 0.0
        weights = {
            'sample_coverage': 0.3,
            'expression_quality': 0.4,
            'recognition_accuracy': 0.3
        }
        
        # Check sample coverage
        coverage_score = 0.0
        for expr in self.training_expressions:
            samples = len(self.face_profile['expressions'][expr]['samples'])
            coverage_score += min(1.0, samples / self.min_samples_per_expression)
        coverage_score /= len(self.training_expressions)
        
        if coverage_score > 0.8:
            strengths.append('Good coverage of facial expressions')
        elif coverage_score < 0.5:
            areas_for_improvement.append('Need more expression samples')
        
        # Check expression quality
        quality_scores = []
        for expr in self.training_expressions:
            for sample in self.face_profile['expressions'][expr]['samples']:
                quality = self._assess_sample_quality(sample)
                quality_scores.append(quality['score'])
        
        if quality_scores:
            avg_quality = sum(quality_scores) / len(quality_scores)
            if avg_quality > 0.8:
                strengths.append('High quality face samples')
            elif avg_quality < 0.6:
                areas_for_improvement.append('Improve sample quality (lighting, positioning)')
        
        # Check recognition accuracy
        if len(self.face_profile['identity']['face_encodings']) > 5:
            strengths.append('Strong face recognition data')
        else:
            areas_for_improvement.append('Need more face recognition samples')
        
        # Calculate overall score
        total_score = (
            weights['sample_coverage'] * coverage_score +
            weights['expression_quality'] * (avg_quality if quality_scores else 0.0) +
            weights['recognition_accuracy'] * min(1.0, len(self.face_profile['identity']['face_encodings']) / 10)
        )
        
        return {
            'overall_score': total_score,
            'strengths': strengths,
            'areas_for_improvement': areas_for_improvement
        }

    def _get_expression_tips(self, expression: str) -> str:
        """Get tips for capturing specific expressions"""
        tips = {
            'neutral': "Relax your face completely. Look straight ahead with a natural expression.",
            'happy': "Think of something that makes you genuinely happy. Let the smile reach your eyes.",
            'sad': "Think of a melancholic moment. Let your eyebrows and mouth naturally drop.",
            'angry': "Furrow your brows and tighten your jaw slightly. Don't overdo it.",
            'surprised': "Raise your eyebrows and open your eyes wider. Let your mouth open slightly.",
            'concerned': "Furrow your brows slightly and press your lips together.",
            'thinking': "Look up slightly and furrow your brows gently. Optional: touch your chin.",
            'confused': "Tilt your head slightly and raise one eyebrow. Let your mouth show uncertainty.",
            'focused': "Narrow your eyes slightly and maintain a steady gaze. Keep your expression neutral."
        }
        return tips.get(expression, "Maintain the expression naturally and consistently.")

    def _save_profile(self) -> None:
        """Save face profile to disk with error handling"""
        try:
            # Create backup of existing profile
            if self.face_profile_path.exists():
                backup_path = self.face_profile_path.with_suffix('.bak')
                self.face_profile_path.rename(backup_path)
            
            # Save new profile
            with open(self.face_profile_path, 'w') as f:
                json.dump(self.face_profile, f, indent=2)
            
            # Remove backup if save was successful
            if backup_path.exists():
                backup_path.unlink()
                
            logger.info("Face profile saved successfully")
            
        except Exception as e:
            logger.error(f"Error saving face profile: {e}")
            # Restore backup if save failed
            if 'backup_path' in locals() and backup_path.exists():
                backup_path.rename(self.face_profile_path)
                logger.info("Restored profile from backup")
            raise

    def apply_profile_to_avatar(self, avatar_renderer):
        """Apply trained face profile to avatar renderer"""
        # Set basic characteristics
        avatar_renderer.set_eye_distance(self.face_profile['facial_features']['eye_distance'])
        avatar_renderer.set_face_shape(self.face_profile['facial_features']['face_shape'])
        
        # Set expressions
        for expression, data in self.face_profile['expressions'].items():
            if data:  # If we have samples for this expression
                avatar_renderer.set_expression_template(expression, data[-1])
        
        # Set lighting preferences
        avatar_renderer.set_lighting(
            self.face_profile['lighting_preferences']['brightness'],
            self.face_profile['lighting_preferences']['contrast']
        )

    def start_training_session(self, identity: str) -> bool:
        """Start comprehensive face training session"""
        logger.info(f"Starting advanced face training session for {identity}")
        
        try:
            # Initialize training progress
            self.face_profile['identity']['name'] = identity
            self.face_profile['training_progress']['last_training_date'] = time.time()
            
            # Train each expression with multiple samples
            for expression in self.training_expressions:
                samples_needed = max(
                    0,
                    self.min_samples_per_expression - 
                    len(self.face_profile['expressions'][expression]['samples'])
                )
                
                if samples_needed > 0:
                    print(f"\nTraining {expression} expression - need {samples_needed} samples")
                    print("Tips for this expression:")
                    print(self._get_expression_tips(expression))
                    
                    for i in range(samples_needed):
                        input(f"\nPress Enter to capture {expression} sample {i+1}/{samples_needed}...")
                        
                        # Countdown for preparation
                        for j in range(3, 0, -1):
                            print(f"Capturing in {j}...")
                            time.sleep(1)
                            
                        sample_path = self.capture_face_sample(expression)
                        if sample_path:
                            print(f"Successfully captured {expression} sample {i+1}")
                            
                            # Verify sample quality
                            quality = self._assess_sample_quality(sample_path)
                            if quality['score'] < 0.7:
                                print("\nLow quality sample detected:")
                                for issue in quality['issues']:
                                    print(f"- {issue}")
                                print("Let's try again...")
                                i -= 1  # Retry this sample
                            else:
                                self._update_training_progress(expression, quality)
                        else:
                            print("\nFailed to capture sample. Let's try again...")
                            i -= 1  # Retry this sample
            
            # Final quality check and feedback
            training_quality = self._evaluate_training_quality()
            print("\nTraining Session Summary:")
            print(f"Overall quality score: {training_quality['overall_score']:.2f}/1.0")
            print("\nStrengths:")
            for strength in training_quality['strengths']:
                print(f"✓ {strength}")
            if training_quality['areas_for_improvement']:
                print("\nAreas for improvement:")
                for area in training_quality['areas_for_improvement']:
                    print(f"· {area}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error in training session: {e}")
            return False
