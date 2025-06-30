"""
Collective Learner for ALEJO
Enables collaborative learning from multiple ALEJO instances while maintaining privacy
"""

import logging
import asyncio
from dataclasses import dataclass
from typing import List, Dict, Any, Optional, Tuple, Set
from datetime import datetime
import json
import uuid
import hashlib
from pathlib import Path
import os

from ..core.event_bus import EventBus, Event, EventType
from ..core.config_manager import ConfigManager
from ..learning.interactive_learner import LearningFeedback, InteractionPattern

logger = logging.getLogger("alejo.collective.collective_learner")

@dataclass
class CollectiveInsight:
    """Anonymized insight derived from user data"""
    insight_id: str
    category: str  # "interaction", "conversation", "preference", "performance"
    pattern_type: str  # Specific type within the category
    features: Dict[str, Any]  # Anonymized features
    confidence: float
    creation_timestamp: datetime
    metadata: Dict[str, Any]  # Any additional metadata
    source_hash: str  # Hash identifier of the source (no PII)
    
    @classmethod
    def from_interaction_pattern(cls, pattern: InteractionPattern, user_id_hash: str) -> 'CollectiveInsight':
        """Create an anonymized collective insight from an interaction pattern"""
        return cls(
            insight_id=str(uuid.uuid4()),
            category="interaction",
            pattern_type=pattern.pattern_type,
            features=pattern.features.copy(),
            confidence=pattern.confidence,
            creation_timestamp=datetime.now(),
            metadata={
                "observation_count": pattern.observation_count,
                "first_observed": pattern.last_observed.isoformat(),
            },
            source_hash=user_id_hash
        )

class CollectiveLearner:
    """
    Manages collective learning across ALEJO instances
    
    Features:
    - Secure, anonymized data collection with user consent
    - Pattern aggregation from multiple sources
    - Shared learning distribution to all instances
    - Privacy and security at every step
    """
    
    def __init__(
        self, 
        event_bus: EventBus,
        config_manager: ConfigManager,
        data_manager=None,
        privacy_controller=None,
        consent_manager=None,
        improvement_engine=None
    ):
        """Initialize collective learner"""
        self.event_bus = event_bus
        self.config_manager = config_manager
        
        # These will be lazily loaded to avoid circular imports
        self._data_manager = data_manager
        self._privacy_controller = privacy_controller
        self._consent_manager = consent_manager
        self._improvement_engine = improvement_engine
        
        self.insights_cache: List[CollectiveInsight] = []
        self.insights_processed: Set[str] = set()
        self.enabled = False
        self.user_id_hash = ""
        self._initialize()
        
        # Register event handlers
        self.event_bus.register(EventType.LEARNING_UPDATE, self._handle_learning_update)
        self.event_bus.register(EventType.SYSTEM_READY, self._handle_system_ready)
        
    def _initialize(self):
        """Initialize the collective learning system"""
        try:
            # Load configuration
            collective_config = self.config_manager.get_config("collective_learning", {})
            self.enabled = collective_config.get("enabled", False)
            self.anonymous_id = collective_config.get("anonymous_id", str(uuid.uuid4()))
            
            # Create a unique, anonymous identifier for this installation
            # This is a hash that can't be traced back to the user
            self.user_id_hash = hashlib.sha256(
                (self.anonymous_id + str(os.getpid())).encode()
            ).hexdigest()
            
            # Create data directory if needed
            data_dir = Path(self.config_manager.get_data_dir()) / "collective"
            data_dir.mkdir(exist_ok=True)
            
            logger.info("Collective learning system initialized")
        except Exception as e:
            logger.error(f"Error initializing collective learning: {e}")
            self.enabled = False
            
    @property
    def data_manager(self):
        """Lazy load data manager"""
        if not self._data_manager:
            from .data_manager import CollectiveDataManager
            self._data_manager = CollectiveDataManager(self.config_manager)
        return self._data_manager
    
    @property
    def privacy_controller(self):
        """Lazy load privacy controller"""
        if not self._privacy_controller:
            from .privacy_controller import PrivacyController
            self._privacy_controller = PrivacyController()
        return self._privacy_controller
    
    @property
    def consent_manager(self):
        """Lazy load consent manager"""
        if not self._consent_manager:
            from .consent_manager import ConsentManager
            self._consent_manager = ConsentManager(self.config_manager)
        return self._consent_manager
    
    @property
    def improvement_engine(self):
        """Lazy load improvement engine"""
        if not self._improvement_engine:
            from .improvement_engine import ImprovementEngine
            self._improvement_engine = ImprovementEngine(
                self.event_bus, 
                self.config_manager,
                self.data_manager
            )
        return self._improvement_engine
        
    async def _handle_learning_update(self, event: Event):
        """Handle learning updates from the interactive learner"""
        if not self.enabled or not self.consent_manager.has_user_consent():
            return
            
        patterns = event.data.get("patterns", [])
        if patterns:
            await self._process_patterns(patterns)
    
    async def _handle_system_ready(self, event: Event):
        """Handle system ready event"""
        if self.enabled:
            # Check consent on startup
            if not self.consent_manager.has_user_consent():
                await self._request_consent()
            
            # If consent granted, start improvement checks
            if self.consent_manager.has_user_consent():
                await self.improvement_engine.check_for_improvements()
                
    async def _request_consent(self):
        """Request user consent for data collection"""
        consent_event = Event(
            event_type=EventType.USER_CONSENT_REQUIRED,
            source="collective_learner",
            data={
                "title": "Help Improve ALEJO",
                "message": (
                    "Would you like to contribute anonymous usage data to help improve ALEJO? "
                    "This data is anonymized, securely encrypted, and only used to enhance the system. "
                    "You can opt out at any time from the settings menu."
                ),
                "callback": self.consent_manager.set_user_consent
            }
        )
        await self.event_bus.emit(consent_event)
    
    async def _process_patterns(self, patterns: List[InteractionPattern]):
        """Process learning patterns into collective insights"""
        try:
            insights = []
            for pattern in patterns:
                # Skip patterns with low confidence or observation count
                if pattern.confidence < 0.7 or pattern.observation_count < 3:
                    continue
                
                # Create anonymized insight
                insight = CollectiveInsight.from_interaction_pattern(
                    pattern, self.user_id_hash
                )
                
                # Apply privacy controls to ensure no PII is included
                sanitized_insight = self.privacy_controller.sanitize_insight(insight)
                insights.append(sanitized_insight)
                
            # Store insights
            if insights:
                await self.data_manager.store_insights(insights)
                self.insights_cache.extend(insights)
                
                # Check if we should submit insights
                await self._check_submit_insights()
                
        except Exception as e:
            logger.error(f"Error processing patterns: {e}")
            
    async def _check_submit_insights(self):
        """Check if we should submit insights to the central system"""
        if len(self.insights_cache) >= 10:  # Batch for efficiency
            await self._submit_insights(self.insights_cache)
            self.insights_cache = []
    
    async def _submit_insights(self, insights: List[CollectiveInsight]):
        """Submit insights to the central system"""
        try:
            # This would connect to the ALEJO improvement API in a production system
            # For now, we'll just log and store locally
            logger.info(f"Would submit {len(insights)} insights to central system")
            
            # In a real implementation, we would:
            # 1. Encrypt the insights
            # 2. Send them to a secure API endpoint
            # 3. Receive confirmation
            
            # For development, just store them locally
            await self.data_manager.mark_insights_submitted(insights)
            
        except Exception as e:
            logger.error(f"Error submitting insights: {e}")
            
    async def apply_collective_improvements(self):
        """Apply improvements from the collective system"""
        if not self.enabled or not self.consent_manager.has_user_consent():
            return False
            
        try:
            improvements = await self.improvement_engine.get_available_improvements()
            if improvements:
                logger.info(f"Applying {len(improvements)} collective improvements")
                result = await self.improvement_engine.apply_improvements(improvements)
                return result
                
            return False
        except Exception as e:
            logger.error(f"Error applying collective improvements: {e}")
            return False
            
    def get_status(self) -> Dict[str, Any]:
        """Get the status of the collective learning system"""
        return {
            "enabled": self.enabled,
            "has_consent": self.consent_manager.has_user_consent() if self.enabled else False,
            "insights_collected": len(self.insights_processed),
            "improvements_applied": self.improvement_engine.improvements_applied if self.enabled else 0,
            "last_check": self.improvement_engine.last_check.isoformat() if self.enabled and self.improvement_engine.last_check else None
        }
