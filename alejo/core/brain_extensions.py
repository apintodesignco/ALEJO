"""
ALEJO Brain Extensions Module

This module provides extensions to the ALEJO Brain to integrate advanced capabilities:
- Multimodal processing (vision + language)
- Emotional intelligence
- Ethical framework
- Hybrid retrieval (RAG/CAG)

These extensions enhance the brain's capabilities while maintaining the modular,
event-driven architecture of the ALEJO platform.
"""

import os
import asyncio
import logging
from typing import Dict, List, Any, Optional, Union
import time
import json

from .brain import ALEJOBrain
from .event_bus import EventBus
from ..database.memory_store import MemoryStore
from ..cognitive.multimodal.integration import MultimodalIntegration
from ..emotional_intelligence.integration import EmotionalIntelligenceIntegration
from ..ethical.integration import EthicalIntegration
from ..cognitive.retrieval.integration import RetrievalIntegration
from .self_improvement import SelfImprovementEngine, get_self_improvement_engine
from ..utils.error_handling import handle_errors
from ..utils.exceptions import BrainExtensionError

logger = logging.getLogger("alejo.core.brain_extensions")

class BrainExtensions:
    """
    Extensions for the ALEJO Brain to integrate advanced capabilities
    
    This class connects various advanced modules to the brain:
    - Multimodal processing for image+text understanding
    - Emotional intelligence for empathetic interactions
    - Ethical framework for principled decision making
    - Hybrid retrieval for enhanced knowledge access
    """
    
    def __init__(
        self,
        brain: ALEJOBrain,
        config_path: Optional[str] = None
    ):
        """
        Initialize brain extensions
        
        Args:
            brain: ALEJOBrain instance to extend
            config_path: Path to configuration file
        """
        self.brain = brain
        self.event_bus = brain.event_bus
        self.memory_store = brain.memory_store
        
        # Configuration
        self.config = self._load_config(config_path)
        
        # Initialize extensions based on configuration
        self._initialize_extensions()
        
        logger.info("Brain extensions initialized")
    
    def _load_config(self, config_path: Optional[str]) -> Dict[str, Any]:
        """Load configuration from file or use defaults"""
        config = {
            "enabled_extensions": {
                "multimodal": True,
                "emotional_intelligence": True,
                "ethical_framework": True,
                "hybrid_retrieval": True,
                "self_improvement": True
            },
            "extension_configs": {
                "multimodal": {
                    "default_reasoning_depth": "deep",
                    "default_response_length": "medium"
                },
                "emotional_intelligence": {
                    "empathy_threshold": 0.7,
                    "emotion_tracking_enabled": True
                },
                "ethical_framework": {
                    "evaluation_threshold": 0.8,
                    "logging_enabled": True
                },
                "hybrid_retrieval": {
                    "default_mode": "hybrid",
                    "rag_weight": 0.6,
                    "cag_weight": 0.4,
                    "auto_threshold": 0.7
                },
                "self_improvement": {
                    "auto_analyze_interval": 3600,  # Analyze performance every hour
                    "auto_suggest_improvements": True,
                    "benchmark_enabled": True,
                    "test_on_improvement": True,
                    "darwin_goedel_enabled": True  # Enable self-evolution capability
                }
            }
        }
        
        if config_path and os.path.exists(config_path):
            try:
                with open(config_path, 'r') as f:
                    loaded_config = json.load(f)
                    # Update nested dictionaries properly
                    if "enabled_extensions" in loaded_config:
                        config["enabled_extensions"].update(loaded_config["enabled_extensions"])
                    if "extension_configs" in loaded_config:
                        for ext, ext_config in loaded_config["extension_configs"].items():
                            if ext in config["extension_configs"]:
                                config["extension_configs"][ext].update(ext_config)
                            else:
                                config["extension_configs"][ext] = ext_config
            except Exception as e:
                logger.error(f"Failed to load config from {config_path}: {e}")
        
        return config
    
    def _initialize_extensions(self):
        """Initialize enabled extensions"""
        # Initialize multimodal processing
        if self.config["enabled_extensions"]["multimodal"]:
            self._init_multimodal()
        
        # Initialize emotional intelligence
        if self.config["enabled_extensions"]["emotional_intelligence"]:
            self._init_emotional_intelligence()
        
        # Initialize ethical framework
        if self.config["enabled_extensions"]["ethical_framework"]:
            self._init_ethical_framework()
        
        # Initialize hybrid retrieval
        if self.config["enabled_extensions"]["hybrid_retrieval"]:
            self._init_hybrid_retrieval()
            
        # Initialize self-improvement (Darwin Gödel Machine)
        if self.config["enabled_extensions"]["self_improvement"]:
            self._init_self_improvement()
    
    def _init_multimodal(self):
        """Initialize multimodal processing extension"""
        try:
            self.multimodal = MultimodalIntegration(
                brain=self.brain,
                event_bus=self.event_bus,
                memory_store=self.memory_store
            )
            logger.info("Multimodal extension initialized")
            
            # Register brain methods for direct access
            self.brain.process_image = self._process_image
            self.brain.visual_qa = self._visual_qa
            self.brain.analyze_scene = self._analyze_scene
            self.brain.caption_image = self._caption_image
        except Exception as e:
            logger.error(f"Failed to initialize multimodal extension: {e}")
            self.config["enabled_extensions"]["multimodal"] = False
    
    def _init_emotional_intelligence(self):
        """Initialize emotional intelligence extension"""
        try:
            self.emotional = EmotionalIntelligenceIntegration(
                brain=self.brain,
                event_bus=self.event_bus,
                memory_store=self.memory_store
            )
            logger.info("Emotional intelligence extension initialized")
            
            # Register brain methods for direct access
            self.brain.analyze_emotion = self._analyze_emotion
            self.brain.get_emotional_response = self._get_emotional_response
            self.brain.get_interaction_recommendation = self._get_interaction_recommendation
        except Exception as e:
            logger.error(f"Failed to initialize emotional intelligence extension: {e}")
            self.config["enabled_extensions"]["emotional_intelligence"] = False
    
    def _init_ethical_framework(self):
        """Initialize ethical framework extension"""
        try:
            self.ethical = EthicalIntegration(
                brain=self.brain,
                event_bus=self.event_bus,
                memory_store=self.memory_store
            )
            logger.info("Ethical framework extension initialized")
            
            # Register brain methods for direct access
            self.brain.evaluate_ethics = self._evaluate_ethics
            self.brain.get_ethical_principles = self._get_ethical_principles
        except Exception as e:
            logger.error(f"Failed to initialize ethical framework extension: {e}")
            self.config["enabled_extensions"]["ethical_framework"] = False
    
    def _init_hybrid_retrieval(self):
        """Initialize hybrid retrieval extension"""
        try:
            self.retrieval = RetrievalIntegration(
                brain=self.brain,
                event_bus=self.event_bus,
                memory_store=self.memory_store,
                config=self.config["extension_configs"]["hybrid_retrieval"]
            )
            logger.info("Hybrid retrieval extension initialized")
            
            # Register brain methods for direct access
            self.brain.retrieve_context = self._retrieve_context
            self.brain.learn_information = self._learn_information
            self.brain.set_retrieval_mode = self._set_retrieval_mode
        except Exception as e:
            logger.error(f"Failed to initialize hybrid retrieval extension: {e}")
            raise BrainExtensionError(f"Failed to initialize hybrid retrieval extension: {e}")
    
    def _init_self_improvement(self):
        """Initialize self-improvement extension (Darwin Gödel Machine)"""
        try:
            # Use the singleton pattern to get or create the self-improvement engine
            self.self_improvement = get_self_improvement_engine(
                brain=self.brain,
                config=self.config["extension_configs"]["self_improvement"]
            )
            
            # Register additional methods on the brain for direct access
            self._register_self_improvement_methods()
            
            # Start automatic analysis if configured
            if self.config["extension_configs"]["self_improvement"].get("auto_analyze_interval"):
                self._start_auto_analysis()
                
            logger.info("Self-improvement extension (Darwin Gödel Machine) initialized")
        except Exception as e:
            logger.error(f"Failed to initialize self-improvement extension: {e}")
            raise BrainExtensionError(f"Failed to initialize self-improvement extension: {e}")
    
    def _register_self_improvement_methods(self):
        """Register self-improvement methods on the brain for direct access"""
        # Add methods to the brain for direct access
        self.brain.analyze_performance = self.analyze_performance
        self.brain.suggest_improvements = self.suggest_improvements
        self.brain.benchmark_component = self.benchmark_component
        self.brain.generate_performance_report = self.generate_performance_report
    
    def _start_auto_analysis(self):
        """Start automatic performance analysis"""
        interval = self.config["extension_configs"]["self_improvement"].get("auto_analyze_interval")
        if not interval:
            return
            
        async def _auto_analysis_task():
            while True:
                try:
                    # Wait for the specified interval
                    await asyncio.sleep(interval)
                    
                    # Analyze performance
                    analysis = await self.self_improvement.analyze_performance()
                    
                    # Generate suggestions if configured
                    if self.config["extension_configs"]["self_improvement"].get("auto_suggest_improvements"):
                        suggestions = await self.self_improvement.suggest_improvements()
                        
                        # Emit event with analysis and suggestions
                        await self.event_bus.emit("brain.self_improvement.suggestions", {
                            "analysis": analysis,
                            "suggestions": suggestions
                        })
                except Exception as e:
                    logger.error(f"Error in automatic performance analysis: {e}")
        
        # Start the task in the background
        asyncio.create_task(_auto_analysis_task())
    
    @handle_errors(BrainExtensionError)
    async def analyze_performance(self) -> Dict[str, Any]:
        """Analyze ALEJO's performance metrics
        
        Returns:
            Dict containing performance analysis results
        """
        if not self.config["enabled_extensions"]["self_improvement"]:
            logger.warning("Self-improvement extension is not enabled")
            return {"error": "Self-improvement extension is not enabled"}
            
        return await self.self_improvement.analyze_performance()
    
    @handle_errors(BrainExtensionError)
    async def suggest_improvements(self) -> List[Dict[str, Any]]:
        """Generate suggestions for improving ALEJO's performance
        
        Returns:
            List of improvement suggestions
        """
        if not self.config["enabled_extensions"]["self_improvement"]:
            logger.warning("Self-improvement extension is not enabled")
            return [{"error": "Self-improvement extension is not enabled"}]
            
        return await self.self_improvement.suggest_improvements()
    
    @handle_errors(BrainExtensionError)
    async def benchmark_component(self, component_name: str) -> Dict[str, Any]:
        """Benchmark a specific ALEJO component
        
        Args:
            component_name: Name of the component to benchmark
            
        Returns:
            Dict containing benchmark results
        """
        if not self.config["enabled_extensions"]["self_improvement"]:
            logger.warning("Self-improvement extension is not enabled")
            return {"error": "Self-improvement extension is not enabled"}
            
        return await self.self_improvement.benchmark_component(component_name)
    
    @handle_errors(BrainExtensionError)
    async def generate_performance_report(self, output_path: Optional[str] = None) -> Dict[str, Any]:
        """Generate a comprehensive performance report
        
        Args:
            output_path: Optional path to save the report
            
        Returns:
            Dict containing the performance report
        """
        if not self.config["enabled_extensions"]["self_improvement"]:
            logger.warning("Self-improvement extension is not enabled")
            return {"error": "Self-improvement extension is not enabled"}
            
        return await self.self_improvement.generate_performance_report(output_path)
    
    @handle_errors(BrainExtensionError)
    async def _process_image(
        self,
        image_data: Union[str, bytes],
        query: Optional[str] = None,
        reasoning_depth: Optional[str] = None,
        response_length: Optional[str] = None
    ) -> Dict[str, Any]:
        """Process an image with a query"""
        if not self.config["enabled_extensions"]["multimodal"]:
            raise BrainExtensionError("Multimodal extension is not enabled")
        
        return await self.multimodal.process_image_for_brain(
            image_data=image_data,
            query=query,
            reasoning_depth=reasoning_depth,
            response_length=response_length
        )
    
    @handle_errors(BrainExtensionError)
    async def _visual_qa(
        self,
        image_path: str,
        question: str
    ) -> Dict[str, Any]:
        """Answer a question about an image"""
        if not self.config["enabled_extensions"]["multimodal"]:
            raise BrainExtensionError("Multimodal extension is not enabled")
        
        return await self.multimodal._handle_brain_visual_qa({
            "image_path": image_path,
            "question": question
        })
    
    @handle_errors(BrainExtensionError)
    async def _analyze_scene(
        self,
        image_path: str,
        analysis_type: str = "comprehensive"
    ) -> Dict[str, Any]:
        """Analyze a scene in an image"""
        if not self.config["enabled_extensions"]["multimodal"]:
            raise BrainExtensionError("Multimodal extension is not enabled")
        
        return await self.multimodal._handle_brain_analyze_scene({
            "image_path": image_path,
            "analysis_type": analysis_type
        })
    
    @handle_errors(BrainExtensionError)
    async def _caption_image(
        self,
        image_path: str,
        style: str = "descriptive"
    ) -> Dict[str, Any]:
        """Generate a caption for an image"""
        if not self.config["enabled_extensions"]["multimodal"]:
            raise BrainExtensionError("Multimodal extension is not enabled")
        
        return await self.multimodal._handle_brain_caption_image({
            "image_path": image_path,
            "style": style
        })
    
    @handle_errors(BrainExtensionError)
    async def _analyze_emotion(
        self,
        text: str,
        user_id: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Analyze the emotional content of text"""
        if not self.config["enabled_extensions"]["emotional_intelligence"]:
            raise BrainExtensionError("Emotional intelligence extension is not enabled")
        
        return await self.emotional.analyze_emotion(
            text=text,
            user_id=user_id,
            context=context
        )
    
    @handle_errors(BrainExtensionError)
    async def _get_emotional_response(
        self,
        input_text: str,
        user_id: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
        target_emotion: Optional[Dict[str, float]] = None
    ) -> Dict[str, Any]:
        """Generate an emotionally appropriate response"""
        if not self.config["enabled_extensions"]["emotional_intelligence"]:
            raise BrainExtensionError("Emotional intelligence extension is not enabled")
        
        return await self.emotional.get_emotional_response(
            input_text=input_text,
            user_id=user_id,
            context=context,
            target_emotion=target_emotion
        )
    
    @handle_errors(BrainExtensionError)
    async def _get_interaction_recommendation(
        self,
        user_id: str,
        current_context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Get recommendations for how to interact with the user"""
        if not self.config["enabled_extensions"]["emotional_intelligence"]:
            raise BrainExtensionError("Emotional intelligence extension is not enabled")
        
        return await self.emotional.get_interaction_recommendation(
            user_id=user_id,
            current_context=current_context
        )
    
    @handle_errors(BrainExtensionError)
    async def _evaluate_ethics(
        self,
        action: str,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Evaluate the ethical implications of an action"""
        if not self.config["enabled_extensions"]["ethical_framework"]:
            raise BrainExtensionError("Ethical framework extension is not enabled")
        
        return await self.ethical.evaluate_ethics(
            action=action,
            context=context
        )
    
    @handle_errors(BrainExtensionError)
    async def _get_ethical_principles(self) -> Dict[str, Any]:
        """Get the current ethical principles and their weights"""
        if not self.config["enabled_extensions"]["ethical_framework"]:
            raise BrainExtensionError("Ethical framework extension is not enabled")
        
        return await self.ethical.get_ethical_principles()
    
    @handle_errors(BrainExtensionError)
    async def _retrieve_context(
        self,
        query: str,
        mode: Optional[str] = None,
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Retrieve context for a query using hybrid retrieval"""
        if not self.config["enabled_extensions"]["hybrid_retrieval"]:
            raise BrainExtensionError("Hybrid retrieval extension is not enabled")
        
        # Use configured default mode if not specified
        if mode is None:
            mode = self.config["extension_configs"]["hybrid_retrieval"]["default_mode"]
        
        return await self.retrieval.query(
            query=query,
            mode=mode,
            user_id=user_id
        )
    
    @handle_errors(BrainExtensionError)
    async def _learn_information(
        self,
        content: str,
        metadata: Optional[Dict[str, Any]] = None,
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Learn new information using hybrid retrieval"""
        if not self.config["enabled_extensions"]["hybrid_retrieval"]:
            raise BrainExtensionError("Hybrid retrieval extension is not enabled")
        
        return await self.retrieval.learn(
            content=content,
            metadata=metadata,
            user_id=user_id
        )
    
    @handle_errors(BrainExtensionError)
    async def _set_retrieval_mode(
        self,
        mode: str,
        rag_weight: Optional[float] = None,
        cag_weight: Optional[float] = None
    ) -> Dict[str, Any]:
        """Set the retrieval mode for hybrid retrieval"""
        if not self.config["enabled_extensions"]["hybrid_retrieval"]:
            raise BrainExtensionError("Hybrid retrieval extension is not enabled")
        
        return await self.retrieval.set_mode(
            mode=mode,
            rag_weight=rag_weight,
            cag_weight=cag_weight
        )
