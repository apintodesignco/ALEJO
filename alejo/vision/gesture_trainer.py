"""
Custom Gesture Training for ALEJO
Enables users to teach ALEJO new gestures through demonstration
"""

import logging
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from typing import List, Dict, Any, Optional, Tuple
import json
import os
from dataclasses import dataclass
import cv2
from .gesture_recognition import Hand, HandLandmark, GestureRecognizer

logger = logging.getLogger("alejo.vision.gesture_trainer")

@dataclass
class GestureExample:
    """Example of a gesture for training"""
    gesture_name: str
    landmarks: Dict[str, HandLandmark]
    handedness: str
    metadata: Dict[str, Any]
    timestamp: float

class GestureDataset(Dataset):
    """Dataset for training gesture recognition"""
    def __init__(self, examples: List[GestureExample]):
        self.examples = examples
        self.gesture_names = sorted(list(set(ex.gesture_name for ex in examples)))
        self.gesture_to_idx = {name: i for i, name in enumerate(self.gesture_names)}
        
    def __len__(self):
        return len(self.examples)
        
    def __getitem__(self, idx):
        example = self.examples[idx]
        
        # Convert landmarks to feature vector
        features = []
        for name in sorted(example.landmarks.keys()):
            lm = example.landmarks[name]
            features.extend([lm.x, lm.y, lm.z])
            
        # Add handedness as one-hot feature
        features.append(1.0 if example.handedness == 'Right' else 0.0)
        
        return {
            'features': torch.tensor(features, dtype=torch.float32),
            'label': self.gesture_to_idx[example.gesture_name]
        }

class GestureTrainer:
    """
    Trains custom gesture recognition models
    Features:
    - Few-shot learning for quick gesture adaptation
    - Real-time feedback during training
    - Persistence of learned gestures
    - Transfer learning from base gestures
    """
    
    def __init__(self, recognizer: GestureRecognizer, 
                 model_dir: str = "models/gestures"):
        """
        Initialize gesture trainer
        
        Args:
            recognizer: GestureRecognizer instance to extend
            model_dir: Directory to save/load models
        """
        self.recognizer = recognizer
        self.model_dir = model_dir
        self.examples: Dict[str, List[GestureExample]] = {}
        self.min_examples = 5  # Minimum examples needed per gesture
        
        # Create model directory if needed
        os.makedirs(model_dir, exist_ok=True)
        
    async def add_example(self, frame: np.ndarray, gesture_name: str,
                         metadata: Optional[Dict[str, Any]] = None) -> bool:
        """
        Add a new example of a gesture
        
        Args:
            frame: Video frame containing the gesture
            gesture_name: Name of the gesture
            metadata: Optional metadata about the example
            
        Returns:
            True if example was successfully added
        """
        try:
            # Detect hands in frame
            hands = self.recognizer.detect_hands(frame)
            
            if not hands:
                logger.warning("No hands detected in example frame")
                return False
                
            # Use the most prominent hand (typically the one closest to camera)
            hand = max(hands, key=lambda h: 
                (h.bounding_box[2] - h.bounding_box[0]) * 
                (h.bounding_box[3] - h.bounding_box[1])
            )
            
            # Create gesture example
            example = GestureExample(
                gesture_name=gesture_name,
                landmarks=hand.landmarks,
                handedness=hand.handedness,
                metadata=metadata or {},
                timestamp=time.time()
            )
            
            # Add to examples
            if gesture_name not in self.examples:
                self.examples[gesture_name] = []
            self.examples[gesture_name].append(example)
            
            logger.info(f"Added example for gesture '{gesture_name}' "
                       f"({len(self.examples[gesture_name])} total examples)")
            
            return True
            
        except Exception as e:
            logger.error(f"Error adding gesture example: {e}")
            return False
            
    def train(self) -> bool:
        """
        Train the gesture recognition model on collected examples
        
        Returns:
            True if training was successful
        """
        try:
            # Check if we have enough examples
            for name, examples in self.examples.items():
                if len(examples) < self.min_examples:
                    logger.warning(
                        f"Not enough examples for gesture '{name}' "
                        f"(have {len(examples)}, need {self.min_examples})"
                    )
                    return False
            
            # Prepare dataset
            all_examples = []
            for examples in self.examples.values():
                all_examples.extend(examples)
                
            dataset = GestureDataset(all_examples)
            
            # Create data loader
            loader = DataLoader(
                dataset,
                batch_size=32,
                shuffle=True
            )
            
            # Create model (simple neural network for now)
            input_size = len(dataset[0]['features'])
            hidden_size = 128
            output_size = len(dataset.gesture_names)
            
            model = nn.Sequential(
                nn.Linear(input_size, hidden_size),
                nn.ReLU(),
                nn.Dropout(0.5),
                nn.Linear(hidden_size, hidden_size),
                nn.ReLU(),
                nn.Dropout(0.5),
                nn.Linear(hidden_size, output_size)
            )
            
            # Training settings
            criterion = nn.CrossEntropyLoss()
            optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
            num_epochs = 100
            
            # Train the model
            model.train()
            for epoch in range(num_epochs):
                total_loss = 0
                for batch in loader:
                    optimizer.zero_grad()
                    outputs = model(batch['features'])
                    loss = criterion(outputs, batch['label'])
                    loss.backward()
                    optimizer.step()
                    total_loss += loss.item()
                
                if (epoch + 1) % 10 == 0:
                    logger.info(f"Epoch {epoch+1}/{num_epochs}, "
                              f"Loss: {total_loss/len(loader):.4f}")
            
            # Save the model and gesture mappings
            self._save_model(model, dataset.gesture_names)
            
            logger.info("Successfully trained custom gesture model")
            return True
            
        except Exception as e:
            logger.error(f"Error training gesture model: {e}")
            return False
            
    def _save_model(self, model: nn.Module, gesture_names: List[str]):
        """Save trained model and gesture mappings"""
        # Save model weights
        model_path = os.path.join(self.model_dir, "custom_gestures.pth")
        torch.save(model.state_dict(), model_path)
        
        # Save gesture mappings
        mappings_path = os.path.join(self.model_dir, "gesture_mappings.json")
        with open(mappings_path, 'w') as f:
            json.dump({
                'gestures': gesture_names,
                'num_features': next(model.parameters()).shape[1]
            }, f)
        
    def load_model(self) -> Tuple[Optional[nn.Module], Optional[List[str]]]:
        """Load trained model and gesture mappings"""
        try:
            # Load gesture mappings
            mappings_path = os.path.join(self.model_dir, "gesture_mappings.json")
            if not os.path.exists(mappings_path):
                return None, None
                
            with open(mappings_path, 'r') as f:
                mappings = json.load(f)
                
            # Create model
            input_size = mappings['num_features']
            hidden_size = 128
            output_size = len(mappings['gestures'])
            
            model = nn.Sequential(
                nn.Linear(input_size, hidden_size),
                nn.ReLU(),
                nn.Dropout(0.5),
                nn.Linear(hidden_size, hidden_size),
                nn.ReLU(),
                nn.Dropout(0.5),
                nn.Linear(hidden_size, output_size)
            )
            
            # Load model weights
            model_path = os.path.join(self.model_dir, "custom_gestures.pth")
            model.load_state_dict(torch.load(model_path))
            
            return model, mappings['gestures']
            
        except Exception as e:
            logger.error(f"Error loading gesture model: {e}")
            return None, None
