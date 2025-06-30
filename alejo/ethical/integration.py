"""
Integration module for connecting the Ethical Framework to ALEJO Brain

This module provides a unified interface for the brain to access ethical decision making
capabilities including value-based decision making, ethical principles enforcement,
learning from feedback, and contextual ethics.
"""

import os
import asyncio
import logging
from typing import Dict, List, Any, Optional, Union
from datetime import datetime
import time
import json

from ..core.event_bus import EventBus
from ..core.brain import ALEJOBrain
from ..database.memory_store import MemoryStore
from ..emotional_intelligence.ethics import EthicalFramework, EthicalDecision
from ..utils.error_handling import handle_errors
from ..utils.exceptions import EthicalFrameworkError

logger = logging.getLogger("alejo.ethical.integration")

class EthicalIntegration:
    """
    Integration class for connecting the Ethical Framework to ALEJO Brain
    
    This class serves as the main interface for the brain to leverage
    ethical decision making capabilities through a unified API.
    """
    
    def __init__(
        self,
        brain: Optional[ALEJOBrain] = None,
        event_bus: Optional[EventBus] = None,
        memory_store: Optional[MemoryStore] = None,
        ethical_framework: Optional[EthicalFramework] = None,
        config_path: Optional[str] = None
    ):
        """
        Initialize the ethical integration
        
        Args:
            brain: ALEJOBrain instance
            event_bus: EventBus instance for system-wide communication
            memory_store: Memory store for persistent storage
            ethical_framework: EthicalFramework instance
            config_path: Path to configuration file
        """
        self.brain = brain
        self.event_bus = event_bus or (brain.event_bus if brain else None)
        self.memory_store = memory_store or (brain.memory_store if brain else None)
        
        # Initialize components
        self.ethical_framework = ethical_framework or EthicalFramework()
        
        # Configuration
        self.config = self._load_config(config_path)
        
        # Register event handlers
        if self.event_bus:
            self._register_event_handlers()
            
        logger.info("Ethical integration initialized")
    
    def _load_config(self, config_path: Optional[str]) -> Dict[str, Any]:
        """Load configuration from file or use defaults"""
        config = {
            "evaluation_threshold": 0.7,  # Threshold for ethical evaluations
            "logging_enabled": True,      # Whether to log ethical decisions
            "principles": {
                "beneficence": 1.0,       # Act in ways that benefit users
                "non_maleficence": 1.0,   # Avoid causing harm
                "autonomy": 0.9,          # Respect user autonomy
                "justice": 0.9,           # Treat all users fairly
                "privacy": 0.95,          # Protect user privacy
                "transparency": 0.85,     # Be transparent about capabilities
                "accountability": 0.9     # Take responsibility for actions
            }
        }
        
        if config_path and os.path.exists(config_path):
            try:
                with open(config_path, 'r') as f:
                    loaded_config = json.load(f)
                    config.update(loaded_config)
            except Exception as e:
                logger.error(f"Failed to load config from {config_path}: {e}")
        
        return config
    
    def _register_event_handlers(self):
        """Register event handlers with the event bus"""
        self.event_bus.subscribe("brain.evaluate_ethics", self._handle_evaluate_ethics)
        self.event_bus.subscribe("brain.get_ethical_principles", self._handle_get_ethical_principles)
        self.event_bus.subscribe("brain.update_ethical_principle", self._handle_update_ethical_principle)
        self.event_bus.subscribe("brain.get_recent_decisions", self._handle_get_recent_decisions)
    
    @handle_errors(EthicalFrameworkError)
    async def evaluate_ethics(
        self,
        action: str,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Evaluate the ethical implications of an action
        
        Args:
            action: Action to evaluate
            context: Context for the action
            
        Returns:
            Dictionary with ethical evaluation results
        """
        start_time = time.time()
        
        # Perform ethical evaluation
        decision = self.ethical_framework.evaluate_action(action, context)
        
        # Convert to serializable format
        result = decision.to_dict()
        result["processing_time"] = time.time() - start_time
        
        # Add recommendation based on value alignment
        if decision.value_alignment >= self.config["evaluation_threshold"]:
            result["recommendation"] = "proceed"
        else:
            result["recommendation"] = "reconsider"
        
        return result
    
    @handle_errors(EthicalFrameworkError)
    async def get_ethical_principles(self) -> Dict[str, Any]:
        """
        Get the current ethical principles and their weights
        
        Returns:
            Dictionary with ethical principles
        """
        start_time = time.time()
        
        principles = {}
        for principle, data in self.ethical_framework.principles.items():
            principles[principle] = {
                "description": data["description"],
                "weight": data["weight"]
            }
        
        return {
            "principles": principles,
            "processing_time": time.time() - start_time
        }
    
    @handle_errors(EthicalFrameworkError)
    async def update_ethical_principle(
        self,
        principle: str,
        weight: float
    ) -> Dict[str, Any]:
        """
        Update the weight of an ethical principle
        
        Args:
            principle: Name of the principle to update
            weight: New weight for the principle (0-1)
            
        Returns:
            Dictionary with update status
        """
        start_time = time.time()
        
        try:
            # Validate weight
            if weight < 0 or weight > 1:
                return {
                    "success": False,
                    "error": "Weight must be between 0 and 1",
                    "processing_time": time.time() - start_time
                }
            
            # Update principle weight
            self.ethical_framework.update_principle_weight(principle, weight)
            
            return {
                "success": True,
                "principle": principle,
                "weight": weight,
                "processing_time": time.time() - start_time
            }
        except Exception as e:
            logger.error(f"Failed to update ethical principle: {e}")
            return {
                "success": False,
                "error": str(e),
                "processing_time": time.time() - start_time
            }
    
    @handle_errors(EthicalFrameworkError)
    async def get_recent_decisions(
        self,
        limit: int = 10
    ) -> Dict[str, Any]:
        """
        Get recent ethical decisions
        
        Args:
            limit: Maximum number of decisions to return
            
        Returns:
            Dictionary with recent decisions
        """
        start_time = time.time()
        
        decisions = self.ethical_framework.get_recent_decisions(limit)
        
        # Convert to serializable format
        serialized_decisions = []
        for decision in decisions:
            serialized_decisions.append(decision.to_dict())
        
        return {
            "decisions": serialized_decisions,
            "processing_time": time.time() - start_time
        }
    
    async def _handle_evaluate_ethics(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle brain.evaluate_ethics event"""
        action = data.get("action")
        context = data.get("context", {})
        
        if not action:
            return {"error": "Missing required parameter: action"}
        
        return await self.evaluate_ethics(
            action=action,
            context=context
        )
    
    async def _handle_get_ethical_principles(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle brain.get_ethical_principles event"""
        return await self.get_ethical_principles()
    
    async def _handle_update_ethical_principle(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle brain.update_ethical_principle event"""
        principle = data.get("principle")
        weight = data.get("weight")
        
        if not principle or weight is None:
            return {"error": "Missing required parameters: principle and weight"}
        
        return await self.update_ethical_principle(
            principle=principle,
            weight=weight
        )
    
    async def _handle_get_recent_decisions(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle brain.get_recent_decisions event"""
        limit = data.get("limit", 10)
        
        return await self.get_recent_decisions(
            limit=limit
        )
