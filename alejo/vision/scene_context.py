"""
Scene Context Analysis for ALEJO
Provides rich environmental understanding through multi-modal analysis
"""

import logging
from dataclasses import dataclass
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
import torch
from transformers import (
    AutoFeatureExtractor,
    AutoModelForImageClassification,
    AutoProcessor,
    BlipForQuestionAnswering
)

logger = logging.getLogger("alejo.vision.scene_context")

@dataclass
class SpatialRelation:
    """Spatial relationship between objects"""
    subject: str
    relation: str  # e.g., "above", "below", "next to", "inside"
    object: str
    confidence: float

@dataclass
class SceneAttribute:
    """Attribute of the scene"""
    name: str  # e.g., "lighting", "time_of_day", "room_type"
    value: str
    confidence: float

@dataclass
class EnvironmentalContext:
    """Rich environmental context of a scene"""
    scene_type: str  # e.g., "indoor", "outdoor", "office", "kitchen"
    attributes: List[SceneAttribute]
    spatial_relations: List[SpatialRelation]
    lighting_condition: str  # e.g., "bright", "dim", "dark"
    time_context: str  # e.g., "day", "night", "evening"
    weather: Optional[str]  # Only for outdoor scenes
    occupancy: int  # Number of people in scene
    activity_level: str  # e.g., "quiet", "active", "busy"
    hazards: List[str]  # Potential hazards in scene
    accessibility: Dict[str, bool]  # Accessibility considerations

class SceneContextAnalyzer:
    """
    Advanced scene context analysis using multi-modal AI
    Features:
    - Scene type classification
    - Attribute detection
    - Spatial relationship understanding
    - Environmental condition assessment
    - Safety and accessibility analysis
    """
    
    def __init__(self):
        """Initialize scene context analyzer"""
        try:
            # Initialize scene classification model
            self.scene_extractor = AutoFeatureExtractor.from_pretrained(
                "microsoft/resnet-50"
            )
            self.scene_classifier = AutoModelForImageClassification.from_pretrained(
                "microsoft/resnet-50"
            )
            
            # Initialize BLIP for visual question answering
            self.vqa_processor = AutoProcessor.from_pretrained(
                "Salesforce/blip-vqa-base"
            )
            self.vqa_model = BlipForQuestionAnswering.from_pretrained(
                "Salesforce/blip-vqa-base"
            )
            
            # Scene type categories
            self.scene_types = {
                "indoor": ["living_room", "kitchen", "bedroom", "office", "bathroom"],
                "outdoor": ["street", "park", "garden", "parking_lot", "playground"]
            }
            
            # Spatial relation templates
            self.spatial_templates = [
                "Is there anything above the {}?",
                "What is next to the {}?",
                "Is there anything inside the {}?",
                "What is in front of the {}?"
            ]
            
            logger.info("Initialized scene context analyzer")
            
        except Exception as e:
            logger.error(f"Failed to initialize scene context analyzer: {e}")
            raise
            
    async def analyze_context(self, frame: np.ndarray,
                            detected_objects: List[str]) -> EnvironmentalContext:
        """
        Analyze the environmental context of a scene
        
        Args:
            frame: Video frame to analyze
            detected_objects: List of objects already detected in scene
            
        Returns:
            Rich environmental context
        """
        try:
            # Prepare image for models
            scene_inputs = self.scene_extractor(frame, return_tensors="pt")
            
            # Get scene classification
            with torch.no_grad():
                scene_outputs = self.scene_classifier(**scene_inputs)
                scene_probs = torch.nn.functional.softmax(scene_outputs.logits, dim=-1)
                scene_type = self._get_scene_type(scene_probs)
            
            # Get scene attributes through VQA
            attributes = await self._analyze_attributes(frame)
            
            # Analyze spatial relationships between detected objects
            spatial_relations = await self._analyze_spatial_relations(
                frame, detected_objects
            )
            
            # Analyze environmental conditions
            conditions = await self._analyze_conditions(frame)
            
            # Analyze safety and accessibility
            hazards = await self._detect_hazards(frame, detected_objects)
            accessibility = await self._assess_accessibility(
                frame, detected_objects, scene_type
            )
            
            # Count people in scene
            occupancy = len([obj for obj in detected_objects if obj == "person"])
            
            # Determine activity level
            activity_level = self._determine_activity_level(
                occupancy, detected_objects
            )
            
            return EnvironmentalContext(
                scene_type=scene_type,
                attributes=attributes,
                spatial_relations=spatial_relations,
                lighting_condition=conditions["lighting"],
                time_context=conditions["time"],
                weather=conditions.get("weather") if scene_type == "outdoor" else None,
                occupancy=occupancy,
                activity_level=activity_level,
                hazards=hazards,
                accessibility=accessibility
            )
            
        except Exception as e:
            logger.error(f"Error analyzing scene context: {e}")
            raise
            
    async def _analyze_attributes(self, frame: np.ndarray) -> List[SceneAttribute]:
        """Analyze scene attributes using VQA"""
        attributes = []
        questions = [
            "What type of room is this?",
            "How is the lighting in this scene?",
            "What time of day does it appear to be?",
            "What is the main color scheme?",
            "Is this a busy or quiet space?"
        ]
        
        for question in questions:
            # Prepare VQA input
            inputs = self.vqa_processor(
                frame, question, return_tensors="pt"
            )
            
            # Get answer
            with torch.no_grad():
                outputs = self.vqa_model(**inputs)
                answer = self.vqa_processor.decode(
                    outputs.logits.argmax(-1)
                )
            
            # Create attribute
            name = question.lower().replace("?", "").replace(" ", "_")
            attributes.append(SceneAttribute(
                name=name,
                value=answer,
                confidence=float(outputs.logits.max())
            ))
            
        return attributes
        
    async def _analyze_spatial_relations(
        self, frame: np.ndarray, objects: List[str]
    ) -> List[SpatialRelation]:
        """Analyze spatial relationships between objects"""
        relations = []
        
        for obj in objects:
            for template in self.spatial_templates:
                question = template.format(obj)
                
                # Prepare VQA input
                inputs = self.vqa_processor(
                    frame, question, return_tensors="pt"
                )
                
                # Get answer
                with torch.no_grad():
                    outputs = self.vqa_model(**inputs)
                    answer = self.vqa_processor.decode(
                        outputs.logits.argmax(-1)
                    )
                    confidence = float(outputs.logits.max())
                
                if answer not in ["nothing", "no", "none"]:
                    relation_type = template.split()[2].replace("the", "").strip()
                    relations.append(SpatialRelation(
                        subject=obj,
                        relation=relation_type,
                        object=answer,
                        confidence=confidence
                    ))
        
        return relations
        
    async def _analyze_conditions(self, frame: np.ndarray) -> Dict[str, str]:
        """Analyze environmental conditions"""
        conditions = {}
        
        # Analyze lighting
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        avg_brightness = np.mean(gray)
        if avg_brightness < 50:
            conditions["lighting"] = "dark"
        elif avg_brightness < 150:
            conditions["lighting"] = "dim"
        else:
            conditions["lighting"] = "bright"
            
        # Get time context through VQA
        time_q = "What time of day does this appear to be?"
        inputs = self.vqa_processor(frame, time_q, return_tensors="pt")
        with torch.no_grad():
            outputs = self.vqa_model(**inputs)
            conditions["time"] = self.vqa_processor.decode(
                outputs.logits.argmax(-1)
            )
            
        # Get weather for outdoor scenes
        weather_q = "What is the weather like in this scene?"
        inputs = self.vqa_processor(frame, weather_q, return_tensors="pt")
        with torch.no_grad():
            outputs = self.vqa_model(**inputs)
            conditions["weather"] = self.vqa_processor.decode(
                outputs.logits.argmax(-1)
            )
            
        return conditions
        
    async def _detect_hazards(
        self, frame: np.ndarray, objects: List[str]
    ) -> List[str]:
        """Detect potential hazards in scene"""
        hazards = []
        
        # Check for common hazards
        hazard_objects = {
            "knife": "sharp object",
            "scissors": "sharp object",
            "chemical": "harmful substance",
            "medicine": "harmful substance",
            "fire": "fire hazard",
            "stove": "hot surface",
            "iron": "hot surface",
            "cable": "trip hazard",
            "water": "slip hazard"
        }
        
        for obj in objects:
            if obj in hazard_objects:
                hazards.append(hazard_objects[obj])
                
        # Check for environmental hazards
        hazard_q = "Are there any visible hazards or dangers in this scene?"
        inputs = self.vqa_processor(frame, hazard_q, return_tensors="pt")
        with torch.no_grad():
            outputs = self.vqa_model(**inputs)
            answer = self.vqa_processor.decode(outputs.logits.argmax(-1))
            
        if answer not in ["no", "none", "nothing"]:
            hazards.append(answer)
            
        return list(set(hazards))  # Remove duplicates
        
    async def _assess_accessibility(
        self, frame: np.ndarray, objects: List[str], scene_type: str
    ) -> Dict[str, bool]:
        """Assess scene accessibility"""
        accessibility = {
            "wheelchair_accessible": True,
            "clear_pathways": True,
            "adequate_lighting": True,
            "visible_signage": True
        }
        
        # Check for obstacles
        obstacle_objects = ["stairs", "step", "narrow_doorway"]
        if any(obj in objects for obj in obstacle_objects):
            accessibility["wheelchair_accessible"] = False
            
        # Check pathway clearance
        path_q = "Are there clear pathways for movement in this scene?"
        inputs = self.vqa_processor(frame, path_q, return_tensors="pt")
        with torch.no_grad():
            outputs = self.vqa_model(**inputs)
            answer = self.vqa_processor.decode(outputs.logits.argmax(-1))
        accessibility["clear_pathways"] = answer.lower() in ["yes", "clear"]
        
        # Check lighting
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        avg_brightness = np.mean(gray)
        accessibility["adequate_lighting"] = avg_brightness >= 100
        
        # Check signage for public spaces
        if scene_type == "indoor":
            sign_q = "Are there any visible signs or markers in this scene?"
            inputs = self.vqa_processor(frame, sign_q, return_tensors="pt")
            with torch.no_grad():
                outputs = self.vqa_model(**inputs)
                answer = self.vqa_processor.decode(outputs.logits.argmax(-1))
            accessibility["visible_signage"] = answer.lower() in ["yes", "visible"]
            
        return accessibility
        
    def _get_scene_type(self, probs: torch.Tensor) -> str:
        """Determine scene type from classification probabilities"""
        scene_idx = torch.argmax(probs).item()
        scene_conf = float(probs[0][scene_idx])
        
        # Map to general scene type
        scene_name = self.scene_classifier.config.id2label[scene_idx]
        for type_name, scenes in self.scene_types.items():
            if any(scene in scene_name.lower() for scene in scenes):
                return type_name
                
        return "other"
        
    def _determine_activity_level(
        self, occupancy: int, objects: List[str]
    ) -> str:
        """Determine scene activity level"""
        if occupancy > 5:
            return "busy"
        elif occupancy > 2:
            return "active"
            
        # Check for activity indicators
        activity_objects = ["laptop", "phone", "book", "tv", "game"]
        activity_count = sum(1 for obj in objects if obj in activity_objects)
        
        if activity_count > 2:
            return "active"
        else:
            return "quiet"
