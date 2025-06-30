"""
ALEJO Brain Service

This module implements the Brain Service as a microservice, handling:
- Command interpretation and processing
- Interaction with LLM for response generation
- Coordination with other services
"""

import argparse
import logging
import inspect
from fastapi import FastAPI, HTTPException, Response
from pydantic import BaseModel
import asyncio

try:
    from alejo.brain.alejo_brain import ALEJOBrain
except ImportError as e:
    logging.warning(f"Failed to import ALEJOBrain: {e}. BrainService will not be fully functional.")
    ALEJOBrain = None

try:
    from alejo.services.communication import ServiceCommunicator, DEFAULT_ENDPOINTS
except ImportError as e:
    logging.warning(f"Failed to import ServiceCommunicator: {e}. Inter-service communication will not be available.")
    ServiceCommunicator = None
    DEFAULT_ENDPOINTS = {}

try:
    from alejo.learning.self_improvement import ImprovementMetrics
except ImportError as e:
    logging.warning(f"Failed to import ImprovementMetrics: {e}. Self-improvement metrics will not be available.")
    ImprovementMetrics = None

try:
    import uvicorn
except ImportError:
    logging.warning("Uvicorn not available. Install with: pip install uvicorn")

try:
    from alejo.utils.error_handling import handle_errors
    from alejo.core.self_healing import SelfHealingSystem, HealingStrategy
except ImportError as e:
    logging.warning(f"Failed to import error handling: {e}. Error handling functionality will be disabled.")
    def handle_errors(component, category):
        def decorator(func):
            return func
        return decorator
    SelfHealingSystem = None
    HealingStrategy = None

logger = logging.getLogger(__name__)

app = FastAPI()
brain_instance = None

class BrainService:
    """Microservice for ALEJOBrain functionality"""
    
    def __init__(self, config: dict = None):
        """Initialize the Brain Service"""
        self.config = config or {}
        
        # Initialize event bus first for self-healing system
        from alejo.core.event_bus import EventBus
        self.event_bus = EventBus()
        
        # Initialize self-healing system
        if SelfHealingSystem:
            self.healing_system = SelfHealingSystem(self.event_bus)
            # Register core components for health monitoring
            self.healing_system.register_component("brain", [
                HealingStrategy.RETRY,
                HealingStrategy.RESTART,
                HealingStrategy.DEGRADE
            ])
            self.healing_system.register_component("llm_service", [
                HealingStrategy.RETRY,
                HealingStrategy.FAILOVER,
                HealingStrategy.DEGRADE
            ])
            asyncio.create_task(self.healing_system.start_monitoring())
        else:
            self.healing_system = None
            logger.warning("Self-healing system unavailable")
        
        # Initialize brain with error tracking
        if ALEJOBrain:
            try:
                self.brain = ALEJOBrain(config=self.config)
                if self.healing_system:
                    self.healing_system.report_error("brain", None)  # Clear any previous errors
            except Exception as e:
                logger.error(f"Failed to initialize brain: {e}")
                if self.healing_system:
                    self.healing_system.report_error("brain", e)
                self.brain = None
        else:
            self.brain = None
            logger.warning("Brain functionality unavailable due to import issues")
        
        # Initialize service communicator
        if ServiceCommunicator:
            try:
                # Include self-improvement service endpoint
                endpoints = DEFAULT_ENDPOINTS.copy()
                endpoints.update({
                    "self_improvement": "http://localhost:8003"
                })
                self.communicator = ServiceCommunicator(endpoints)
                if self.healing_system:
                    self.healing_system.register_component("service_communicator", [
                        HealingStrategy.RETRY,
                        HealingStrategy.RECONFIGURE
                    ])
            except Exception as e:
                logger.error(f"Failed to initialize service communicator: {e}")
                if self.healing_system:
                    self.healing_system.report_error("service_communicator", e)
                self.communicator = None
        else:
            self.communicator = None
            logger.warning("Service communication unavailable")
        
        # Initialize emotional intelligence components
        if self.brain:
            try:
                from alejo.emotional_intelligence import EmotionalMemory, EmotionalProcessor, EthicalFramework
                self.brain.emotional_memory = EmotionalMemory(config=self.config)
                self.brain.emotional_processor = EmotionalProcessor(config=self.config)
                self.brain.ethical_framework = EthicalFramework(config=self.config)
                
                if self.healing_system:
                    # Register emotional components for health monitoring
                    self.healing_system.register_component("emotional_memory", [
                        HealingStrategy.RETRY,
                        HealingStrategy.RESTART
                    ])
                    self.healing_system.register_component("emotional_processor", [
                        HealingStrategy.RETRY,
                        HealingStrategy.DEGRADE
                    ])
                
                logger.info("Initialized emotional intelligence components")
            except Exception as e:
                logger.error(f"Failed to initialize emotional components: {e}")
                if self.healing_system:
                    self.healing_system.report_error("emotional_components", e)
        else:
            logger.error("Brain not available, cannot initialize emotional intelligence components")
        
        logger.info("Brain Service initialized")
    
    @handle_errors(component="brain_service", category="processing")
    async def process_user_input(self, user_input: str) -> str:
        """Process user input through ALEJOBrain"""
        try:
            if not self.brain:
                if self.healing_system:
                    # Attempt to recover brain functionality
                    await self.healing_system._attempt_recovery("brain")
                if not self.brain:  # Still not available after recovery attempt
                    raise ValueError("Brain functionality unavailable")
            
            try:
                # Analyze sentiment and emotions using real models
                sentiment = self.brain.emotional_processor.analyze_sentiment(user_input)
                emotional_context = self.brain.emotional_memory.get_relationship_context()
            except Exception as e:
                if self.healing_system:
                    self.healing_system.report_error("emotional_processor", e)
                    await self.healing_system._attempt_recovery("emotional_processor")
                    # Retry after recovery attempt
                    sentiment = self.brain.emotional_processor.analyze_sentiment(user_input)
                    emotional_context = self.brain.emotional_memory.get_relationship_context()
                else:
                    raise
            
            try:
                # Update emotional memory with this interaction
                self.brain.emotional_memory.store_interaction(
                    text=user_input,
                    sentiment=sentiment,
                    context=emotional_context
                )
            except Exception as e:
                if self.healing_system:
                    self.healing_system.report_error("emotional_memory", e)
                    await self.healing_system._attempt_recovery("emotional_memory")
                    # Retry after recovery
                    self.brain.emotional_memory.store_interaction(
                        text=user_input,
                        sentiment=sentiment,
                        context=emotional_context
                    )
                else:
                    raise
            
            # Process through ALEJOBrain
            try:
                response = await self.brain.process_text(user_input)
            except Exception as e:
                if self.healing_system:
                    self.healing_system.report_error("brain", e)
                    await self.healing_system._attempt_recovery("brain")
                    # Retry after recovery
                    response = await self.brain.process_text(user_input)
                else:
                    raise
            
            # Add empathetic response if needed
            if self.communicator:
                try:
                    empathetic_response = self.communicator.call_emotional_service_response(
                        user_input,
                        relationship_context={}
                    )
                    response = f"{response} {empathetic_response}"
                except Exception as e:
                    if self.healing_system:
                        self.healing_system.report_error("service_communicator", e)
                        await self.healing_system._attempt_recovery("service_communicator")
                        # Retry after recovery
                        empathetic_response = self.communicator.call_emotional_service_response(
                            user_input,
                            relationship_context={}
                        )
                        response = f"{response} {empathetic_response}"
                    else:
                        logger.warning(f"Failed to get empathetic response: {e}")
            
            return response
        except Exception as e:
            logger.error(f"Error processing user input: {e}", exc_info=True)
            if self.healing_system:
                self.healing_system.report_error("brain_service", e)
            raise

# Service metrics
request_metrics = {
    'request_count': 0,
    'error_count': 0,
    'total_response_time': 0,
    'start_time': None
}

# FastAPI endpoints
@app.on_event("startup")
async def startup_event():
    """Initialize brain instance on startup"""
    global brain_instance, request_metrics
    brain_instance = BrainService(config={})
    request_metrics['start_time'] = asyncio.get_event_loop().time()
    logger.info("Brain Service started")
    
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    if not brain_instance:
        raise HTTPException(status_code=503, detail="Brain Service not initialized")
    
    # Get component health status
    health_status = {"status": "healthy"}
    if brain_instance.healing_system:
        component_health = brain_instance.healing_system.get_all_health()
        health_status["components"] = {
            name: {
                "status": health.status,
                "error_count": health.error_count,
                "last_error": health.last_error,
                "recovery_attempts": health.recovery_attempts
            } for name, health in component_health.items()
        }
        
        # Overall status is degraded if any component is in error state
        if any(h.status == "error" for h in component_health.values()):
            health_status["status"] = "degraded"
    
    health_status["uptime"] = asyncio.get_event_loop().time() - request_metrics['start_time']
    return health_status

@app.get("/metrics")
async def get_metrics():
    """Get service metrics"""
    if not brain_instance:
        raise HTTPException(status_code=503, detail="Brain Service not initialized")
    
    avg_response_time = (request_metrics['total_response_time'] / request_metrics['request_count']) if request_metrics['request_count'] > 0 else 0
    
    # Get self-improvement metrics if available
    improvement_metrics = {}
    if brain_instance.communicator:
        try:
            improvement_data = brain_instance.communicator.send_request(
                "self_improvement",
                "/metrics",
                method="GET"
            )
            improvement_metrics = {
                "error_recovery_rate": improvement_data.get("error_recovery_rate", 0),
                "learning_efficiency": improvement_data.get("learning_efficiency", 0),
                "emotional_adaptation": improvement_data.get("emotional_adaptation", 0),
                "performance_score": improvement_data.get("performance_score", 0)
            }
        except Exception as e:
            logger.warning(f"Failed to get self-improvement metrics: {e}")
    
    return {
        "request_count": request_metrics['request_count'],
        "error_count": request_metrics['error_count'],
        "average_response_time": avg_response_time,
        "uptime": asyncio.get_event_loop().time() - request_metrics['start_time'],
        "improvement_metrics": improvement_metrics
    }

@app.post("/process")
async def process_input(user_input: str):
    """Endpoint to process user input"""
    if not brain_instance:
        raise HTTPException(status_code=503, detail="Brain Service not initialized")
    start_time = asyncio.get_event_loop().time()
    try:
        response = await brain_instance.process_user_input(user_input)
        request_metrics['request_count'] += 1
        request_metrics['total_response_time'] += asyncio.get_event_loop().time() - start_time
        return {"response": response}
    except Exception as e:
        request_metrics['error_count'] += 1
        logger.error(f"API Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

def run_service(host: str = "0.0.0.0", port: int = 8000):
    """Run the Brain Service"""
    if not uvicorn:
        logger.error("Cannot run service: Uvicorn not available")
        return
    
    logger.info(f"Starting Brain Service on {host}:{port}")
    uvicorn.run(app, host=host, port=port)

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Run Brain Service")
    parser.add_argument("--host", default="0.0.0.0", help="Host to run the service on")
    parser.add_argument("--port", type=int, default=8000, help="Port to run the service on")
    args = parser.parse_args()
    run_service(host=args.host, port=args.port)
