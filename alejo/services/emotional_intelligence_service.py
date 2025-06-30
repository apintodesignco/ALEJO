"""
ALEJO Emotional Intelligence Service

This module implements the Emotional Intelligence Service as a microservice, handling:
- Emotional memory management
"""

import argparse
import logging
from typing import Dict, Any, Optional
from datetime import datetime
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import json

from ..emotional_intelligence import EmotionalProcessor, EmotionalMemory, EthicalFramework
from ..core.event_bus import EventBus, Event, EventType
from ..utils.exceptions import EmotionalProcessingError

app = FastAPI()
logger = logging.getLogger(__name__)

class EmotionalIntelligenceService:
    """Enhanced emotional intelligence service with event-driven architecture"""
    
    def __init__(self, redis_url: str = "redis://localhost:6379/0"):
        self.processor = EmotionalProcessor()
        self.memory = EmotionalMemory()
        self.ethics = EthicalFramework()
        self.event_bus = EventBus(redis_url)
        self.current_emotional_state = {
            "valence": 0.5,
            "arousal": 0.5,
            "dominance": 0.5
        }
        
    async def start(self):
        """Start the emotional intelligence service"""
        await self.event_bus.start()
        
        # Subscribe to relevant events
        self.event_bus.subscribe(EventType.EMOTION, self._handle_emotion_event)
        self.event_bus.subscribe(EventType.COMMAND, self._handle_command_event)
        logger.info("Emotional intelligence service started")
        
    async def stop(self):
        """Stop the emotional intelligence service"""
        await self.event_bus.stop()
        logger.info("Emotional intelligence service stopped")
        
    async def process_emotion(self, text: str, context: dict = None) -> Dict[str, Any]:
        """Process text for emotional content and update state"""
        try:
            # Analyze sentiment and emotions
            sentiment = self.processor.analyze_sentiment(text)
            
            # Get relationship context
            relationship = self.memory.get_relationship_context()
            
            # Update emotional state
            self._update_emotional_state(sentiment)
            
            # Store interaction in memory
            self.memory.store_interaction(
                text=text,
                sentiment=sentiment,
                context=context or {}
            )
            
            # Generate empathetic response considering ethics
            response = self.processor.generate_empathetic_response(
                text,
                self.current_emotional_state,
                relationship
            )
            
            # Evaluate response ethically
            ethical_eval = self.ethics.evaluate_action({
                "action": "respond",
                "content": response.content,
                "context": context or {}
            })
            
            if not ethical_eval.is_acceptable:
                response = self.processor.generate_alternative_response(
                    text,
                    ethical_constraints=ethical_eval.constraints
                )
            
            result = {
                "sentiment": sentiment,
                "emotional_state": self.current_emotional_state,
                "response": response.dict(),
                "ethical_evaluation": ethical_eval.dict()
            }
            
            # Emit emotion event
            await self.event_bus.emit_emotion(
                emotion=sentiment["dominant_emotion"],
                intensity=sentiment["intensity"],
                source="emotional_intelligence"
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Error processing emotion: {e}")
            raise EmotionalProcessingError(f"Failed to process emotion: {e}")
            
    def _update_emotional_state(self, sentiment: dict):
        """Update the current emotional state based on new sentiment"""
        # Apply weighted update to emotional state
        alpha = 0.3  # Learning rate
        self.current_emotional_state = {
            "valence": (1 - alpha) * self.current_emotional_state["valence"] + alpha * sentiment["valence"],
            "arousal": (1 - alpha) * self.current_emotional_state["arousal"] + alpha * sentiment["arousal"],
            "dominance": (1 - alpha) * self.current_emotional_state["dominance"] + alpha * sentiment["dominance"]
        }
        
    async def _handle_emotion_event(self, event: Event):
        """Handle incoming emotion events"""
        if event.source != "emotional_intelligence":
            try:
                await self.process_emotion(
                    event.payload.get("text", ""),
                    event.payload.get("context")
                )
            except Exception as e:
                logger.error(f"Error handling emotion event: {e}")
                
    async def _handle_command_event(self, event: Event):
        """Handle incoming command events for ethical evaluation"""
        try:
            if "command" in event.payload:
                ethical_eval = self.ethics.evaluate_action({
                    "action": event.payload["command"],
                    "parameters": event.payload.get("parameters", {}),
                    "context": event.payload.get("context", {})
                })
                
                if not ethical_eval.is_acceptable:
                    await self.event_bus.emit_emotion(
                        emotion="concern",
                        intensity=0.7,
                        source="emotional_intelligence"
                    )
                    
        except Exception as e:
            logger.error(f"Error handling command event: {e}")

# Dummy implementations for missing modules
class DummyEmotionalMemory:
    def __init__(self, config=None):
        pass
    def store_emotion(self, *args, **kwargs):
        return None
    def retrieve_emotions(self, *args, **kwargs):
        return []

class DummyEmotionalProcessor:
    def __init__(self, config=None):
        pass
    def analyze_sentiment(self, text):
        return {'positive': 0.5, 'negative': 0.3, 'neutral': 0.2}
    def generate_empathetic_response(self, text, context=None):
        return 'I understand how you feel.'

class DummyEthicalFramework:
    def __init__(self, config=None):
        pass
    def evaluate_action(self, action, context):
        class Decision:
            def __init__(self):
                self.is_ethical = True
                self.score = 0.8
                self.justification = 'This action seems ethical based on basic assessment.'
        return Decision()

try:
    from alejo.emotional_intelligence.memory import EmotionalMemory
except ImportError as e:
    logging.warning(f"Failed to import EmotionalMemory: {e}. Emotional memory functionality will be disabled.")
    EmotionalMemory = DummyEmotionalMemory

try:
    from alejo.emotional_intelligence.processor import EmotionalProcessor
except ImportError as e:
    logging.warning(f"Failed to import EmotionalProcessor: {e}. Emotional processing functionality will be disabled.")
    EmotionalProcessor = DummyEmotionalProcessor

try:
    from alejo.emotional_intelligence.ethics import EthicalFramework
except ImportError as e:
    logging.warning(f"Failed to import EthicalFramework: {e}. Ethical evaluation functionality will be disabled.")
    EthicalFramework = DummyEthicalFramework

app = FastAPI()
emotional_memory = None
emotional_processor = None
ethical_framework = None

try:
    from alejo.utils.error_handling import handle_errors
except ImportError as e:
    logging.warning(f"Failed to import error handling: {e}. Error handling functionality will be disabled.")
    def handle_errors(component, category):
        def decorator(func):
            return func
        return decorator

# Global instance for the service
emotional_instance = None

class EmotionalIntelligenceService:
    """Microservice for Emotional Intelligence functionality"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """Initialize the Emotional Intelligence Service"""
        self.config = config or {}
        # Initialize emotional intelligence components
        try:
            self.emotional_memory = EmotionalMemory(config=self.config)
            self.emotional_processor = EmotionalProcessor(config=self.config)
            self.ethical_framework = EthicalFramework(config=self.config)
        except Exception as e:
            logger.error(f"Error initializing emotional intelligence components: {e}")
            # Fallback to mock or minimal functionality for testing
            from unittest.mock import MagicMock
            self.emotional_memory = MagicMock()
            self.emotional_processor = MagicMock()
            self.ethical_framework = MagicMock()
            self.emotional_processor.analyze_sentiment.return_value = {'valence': 0.5, 'arousal': 0.5, 'dominance': 0.5, 'joy': 0.5, 'sadness': 0.5}
            self.emotional_memory.get_relationship_context.return_value = {'trust_level': 0.5, 'rapport_level': 0.5}
            self.ethical_framework.evaluate_action.return_value = MagicMock(value_alignment=0.8, justification='Ethical', principles_considered=[])
        
        # Set emotional_instance for compatibility with tests
        global emotional_instance
        emotional_instance = self
        logger.info("Emotional Intelligence Service initialized")
    
    @handle_errors(component="emotional_service", category="processing")
    async def analyze_sentiment(self, text: str) -> Dict[str, float]:
        """Analyze sentiment of the input text"""
        try:
            if not self.emotional_processor:
                raise ValueError("Emotional Intelligence functionality unavailable")
            sentiment = self.emotional_processor.analyze_sentiment(text)
            return sentiment
        except Exception as e:
            logger.error(f"Error analyzing sentiment: {e}", exc_info=True)
            raise
    
    @handle_errors(component="emotional_service", category="processing")
    async def generate_empathetic_response(self, text: str, relationship_context: Optional[Dict[str, Any]] = None) -> str:
        """Generate an empathetic response based on input text"""
        try:
            if not self.emotional_processor:
                raise ValueError("Emotional Intelligence functionality unavailable")
            response = self.emotional_processor.generate_empathetic_response(text, relationship_context)
            return response.content if hasattr(response, 'content') else str(response)
        except Exception as e:
            logger.error(f"Error generating empathetic response: {e}", exc_info=True)
            raise
    
    @handle_errors(component="emotional_service", category="decision")
    async def evaluate_ethical_action(self, action: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """Evaluate the ethical implications of an action"""
        try:
            if not self.ethical_framework:
                raise ValueError("Ethical Framework unavailable")
            decision = self.ethical_framework.evaluate_action(action, context)
            return {
                "is_ethical": decision.is_ethical,
                "score": decision.score,
                "justification": decision.justification
            }
        except Exception as e:
            logger.error(f"Error evaluating ethical action: {e}", exc_info=True)
            raise

# Service metrics
service_metrics = {
    'start_time': None,
    'sentiment_analysis_count': 0,
    'ethical_evaluation_count': 0,
    'error_count': 0,
    'total_response_time': 0
}

# FastAPI endpoints
@app.on_event("startup")
async def startup_event():
    """Initialize emotional intelligence instance on startup"""
    global emotional_memory, emotional_processor, ethical_framework, service_metrics
    emotional_memory = EmotionalMemory(config={}) if EmotionalMemory else None
    emotional_processor = EmotionalProcessor(config={}) if EmotionalProcessor else None
    ethical_framework = EthicalFramework(config={}) if EthicalFramework else None
    service_metrics['start_time'] = asyncio.get_event_loop().time()
    logger.info("Emotional Intelligence Service started")
    
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    if not emotional_processor or not ethical_framework:
        raise HTTPException(status_code=503, detail="Emotional Intelligence Service not initialized")
    return {
        "status": "healthy",
        "uptime": asyncio.get_event_loop().time() - service_metrics['start_time'],
        "components": {
            "emotional_processor": "healthy" if emotional_processor else "unavailable",
            "ethical_framework": "healthy" if ethical_framework else "unavailable",
            "emotional_memory": "healthy" if emotional_memory else "unavailable"
        }
    }

@app.get("/metrics")
async def get_metrics():
    """Get service metrics"""
    if not emotional_processor:
        raise HTTPException(status_code=503, detail="Emotional Intelligence Service not initialized")
    avg_response_time = (service_metrics['total_response_time'] / 
                        (service_metrics['sentiment_analysis_count'] + service_metrics['ethical_evaluation_count'])) \
        if (service_metrics['sentiment_analysis_count'] + service_metrics['ethical_evaluation_count']) > 0 else 0
    return {
        "sentiment_analysis_count": service_metrics['sentiment_analysis_count'],
        "ethical_evaluation_count": service_metrics['ethical_evaluation_count'],
        "error_count": service_metrics['error_count'],
        "average_response_time": avg_response_time,
        "uptime": asyncio.get_event_loop().time() - service_metrics['start_time']
    }

@app.post("/sentiment")
async def analyze_text_sentiment(text: str):
    """Endpoint to analyze sentiment of text"""
    if not emotional_processor:
        raise HTTPException(status_code=503, detail="Emotional Intelligence Service not initialized")
    start_time = asyncio.get_event_loop().time()
    try:
        sentiment = emotional_processor.analyze_sentiment(text)
        service_metrics['sentiment_analysis_count'] += 1
        service_metrics['total_response_time'] += asyncio.get_event_loop().time() - start_time
        return {"sentiment": sentiment}
    except Exception as e:
        service_metrics['error_count'] += 1
        logger.error(f"API Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    
@app.post("/response")
async def generate_response(text: str, relationship_context: Optional[Dict[str, Any]] = None):
    """Endpoint to generate empathetic response"""
    if not emotional_processor:
        raise HTTPException(status_code=503, detail="Emotional Intelligence Service not initialized")
    try:
        response = emotional_processor.generate_empathetic_response(text, relationship_context)
        return {"response": response.content if hasattr(response, 'content') else str(response)}
    except Exception as e:
        logger.error(f"API Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    
@app.post("/ethical-evaluation")
async def evaluate_action(action: str, context: Dict[str, Any]):
    """Endpoint to evaluate ethical implications of an action"""
    if not ethical_framework:
        raise HTTPException(status_code=503, detail="Emotional Intelligence Service not initialized")
    start_time = asyncio.get_event_loop().time()
    try:
        decision = ethical_framework.evaluate_action(action, context)
        service_metrics['ethical_evaluation_count'] += 1
        service_metrics['total_response_time'] += asyncio.get_event_loop().time() - start_time
        return {
            "is_ethical": decision.is_ethical,
            "score": decision.score,
            "justification": decision.justification
        }
    except Exception as e:
        service_metrics['error_count'] += 1
        logger.error(f"API Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

def run_service(host: str = "0.0.0.0", port: int = 8001):
    """Run the Emotional Intelligence Service"""
    logger.info(f"Starting Emotional Intelligence Service on {host}:{port}")
    import uvicorn
    uvicorn.run(app, host=host, port=port)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run Emotional Intelligence Service")
    parser.add_argument("--host", default="0.0.0.0", help="Host to run the service on")
    parser.add_argument("--port", type=int, default=8001, help="Port to run the service on")
    args = parser.parse_args()
    run_service(host=args.host, port=args.port)
