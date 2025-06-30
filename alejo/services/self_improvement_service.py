"""
Self-improvement microservice for ALEJO
"""

import logging
import asyncio
from typing import Dict, Any, Optional
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from alejo.learning.self_improvement import SelfImprovementSystem, ImprovementMetrics
from alejo.core.event_bus import EventBus
from alejo.utils.error_handling import ErrorTracker
from alejo.learning.interactive_learner import InteractiveLearner
from alejo.emotional_intelligence.emotional_core import EmotionalCore
from alejo.emotional_intelligence.models.emotional_memory import EmotionalMemoryService

logger = logging.getLogger(__name__)

class AdaptationRequest(BaseModel):
    """Request model for triggering adaptations"""
    component: str
    trigger_type: str
    context: Dict[str, Any]

class MetricsResponse(BaseModel):
    """Response model for system metrics"""
    error_recovery_rate: float
    learning_efficiency: float
    emotional_adaptation: float
    performance_score: float
    timestamp: str

class SelfImprovementService:
    """
    Microservice for managing ALEJO's self-improvement capabilities
    
    Features:
    - System-wide performance monitoring
    - Automated adaptation strategies
    - Error pattern analysis and recovery
    - Learning optimization
    """
    
    def __init__(self):
        """Initialize the self-improvement service"""
        self.app = FastAPI(title="ALEJO Self-Improvement Service")
        self.event_bus = EventBus()
        self.improvement_system: Optional[SelfImprovementSystem] = None
        self.monitor_task: Optional[asyncio.Task] = None
        
        # Register routes
        self._register_routes()
        logger.info("Self-improvement service initialized")
    
    def _register_routes(self):
        """Register FastAPI routes"""
        
        @self.app.on_event("startup")
        async def startup():
            """Initialize components on startup"""
            try:
                # Initialize core components
                error_tracker = ErrorTracker()
                interactive_learner = InteractiveLearner()
                emotional_core = EmotionalCore()
                emotional_memory = EmotionalMemoryService()
                
                # Initialize improvement system
                self.improvement_system = SelfImprovementSystem(
                    event_bus=self.event_bus,
                    error_tracker=error_tracker,
                    interactive_learner=interactive_learner,
                    emotional_core=emotional_core,
                    emotional_memory=emotional_memory
                )
                
                # Start monitoring loop
                self.monitor_task = asyncio.create_task(
                    self.improvement_system.monitor_and_improve()
                )
                
                logger.info("Self-improvement service started")
                
            except Exception as e:
                logger.error(f"Failed to start self-improvement service: {e}")
                raise
        
        @self.app.on_event("shutdown")
        async def shutdown():
            """Clean up on shutdown"""
            if self.monitor_task:
                self.monitor_task.cancel()
                try:
                    await self.monitor_task
                except asyncio.CancelledError:
                    pass
            logger.info("Self-improvement service stopped")
        
        @self.app.get("/health")
        async def health_check():
            """Health check endpoint"""
            if not self.improvement_system:
                raise HTTPException(
                    status_code=503,
                    detail="Self-improvement system not initialized"
                )
            return {"status": "healthy"}
        
        @self.app.get("/metrics", response_model=MetricsResponse)
        async def get_metrics():
            """Get current system metrics"""
            if not self.improvement_system:
                raise HTTPException(
                    status_code=503,
                    detail="Self-improvement system not initialized"
                )
            
            metrics = await self.improvement_system._collect_system_metrics()
            return MetricsResponse(
                error_recovery_rate=metrics.error_recovery_rate,
                learning_efficiency=metrics.learning_efficiency,
                emotional_adaptation=metrics.emotional_adaptation,
                performance_score=metrics.performance_score,
                timestamp=metrics.timestamp.isoformat()
            )
        
        @self.app.post("/adapt")
        async def trigger_adaptation(request: AdaptationRequest):
            """Trigger a specific adaptation strategy"""
            if not self.improvement_system:
                raise HTTPException(
                    status_code=503,
                    detail="Self-improvement system not initialized"
                )
            
            # Find matching strategy
            strategy = self.improvement_system.adaptation_strategies.get(
                f"{request.component}_{request.trigger_type}"
            )
            
            if not strategy:
                raise HTTPException(
                    status_code=404,
                    detail=f"No adaptation strategy found for {request.component}/{request.trigger_type}"
                )
            
            # Apply adaptation
            await self.improvement_system._apply_adaptation(
                f"{request.component}_{request.trigger_type}",
                strategy
            )
            
            return {
                "status": "adaptation_triggered",
                "strategy": f"{request.component}_{request.trigger_type}"
            }
        
        @self.app.get("/adaptations/active")
        async def get_active_adaptations():
            """Get list of currently active adaptations"""
            if not self.improvement_system:
                raise HTTPException(
                    status_code=503,
                    detail="Self-improvement system not initialized"
                )
            
            return {
                "active_adaptations": [
                    {
                        "strategy_id": strategy_id,
                        "start_time": start_time.isoformat()
                    }
                    for strategy_id, start_time 
                    in self.improvement_system.active_adaptations.items()
                ]
            }
        
        @self.app.get("/strategies")
        async def get_adaptation_strategies():
            """Get list of available adaptation strategies"""
            if not self.improvement_system:
                raise HTTPException(
                    status_code=503,
                    detail="Self-improvement system not initialized"
                )
            
            return {
                "strategies": [
                    {
                        "id": strategy_id,
                        "component": strategy.component,
                        "priority": strategy.priority,
                        "trigger_condition": strategy.trigger_condition,
                        "success_criteria": strategy.success_criteria
                    }
                    for strategy_id, strategy 
                    in self.improvement_system.adaptation_strategies.items()
                ]
            }
    
    def run(self, host: str = "0.0.0.0", port: int = 8003):
        """Run the service"""
        import uvicorn
        uvicorn.run(self.app, host=host, port=port)
