"""
ALEJO Event Bus System
Handles all inter-service communication and event management
"""

import asyncio
import json
import uuid
from typing import Dict, List, Callable, Any, Optional, Union
from dataclasses import dataclass
from datetime import datetime
import logging
from enum import Enum
from ..utils.exceptions import EventBusError
from contextlib import asynccontextmanager
import importlib

logger = logging.getLogger(__name__)

# Lazily load Redis to avoid import-time side effects
def get_redis_asyncio():
    """Lazily import redis.asyncio to prevent import-time side effects"""
    try:
        return importlib.import_module('redis.asyncio')
    except ImportError as e:
        logger.warning(f"Failed to import redis.asyncio: {e}. Redis functionality will be unavailable.")
        return None



class EventType(Enum):
    COMMAND = "command"
    EMOTION = "emotion"
    MEMORY = "memory"
    PROACTIVE_PROMPT = "proactive_prompt"
    VISION = "vision"
    GAZE = "gaze"
    VOICE = "voice"
    SYSTEM = "system"
    ERROR = "error"
    ADAPTATION_UPDATED = "adaptation_updated"
    COMMAND_EXECUTED = "command_executed"
    BRAIN_SHUTDOWN = "brain_shutdown"
    
    # Collective learning events
    COLLECTIVE_INSIGHT = "collective_insight"
    LEARNING_UPDATE = "learning_update"
    USER_CONSENT_REQUIRED = "user_consent_required"
    USER_CONSENT_UPDATED = "user_consent_updated"
    IMPROVEMENT_AVAILABLE = "improvement_available"
    IMPROVEMENT_APPLIED = "improvement_applied"
    SYSTEM_READY = "system_ready"
    
    @property
    def priority(self) -> int:
        """Get default priority for event type"""
        priorities = {
            EventType.ERROR: 1,  # Highest priority
            EventType.SYSTEM: 2,
            EventType.COMMAND: 3,
            EventType.EMOTION: 4,
            EventType.VOICE: 5,
            EventType.GAZE: 6,
            EventType.VISION: 7,
            EventType.MEMORY: 7,
            EventType.USER_CONSENT_REQUIRED: 7,
            EventType.USER_CONSENT_UPDATED: 7,
            EventType.ADAPTATION_UPDATED: 8,
            EventType.COMMAND_EXECUTED: 9,
            EventType.SYSTEM_READY: 9,
            EventType.COLLECTIVE_INSIGHT: 10,
            EventType.LEARNING_UPDATE: 10,
            EventType.IMPROVEMENT_AVAILABLE: 10,
            EventType.IMPROVEMENT_APPLIED: 10,
            EventType.BRAIN_SHUTDOWN: 11  # Lowest priority
        }
        return priorities.get(self, 5)  # Default medium priority

@dataclass
class Event:
    """Base event class for all ALEJO events"""
    type: EventType
    payload: Dict[str, Any]
    timestamp: Optional[datetime] = None
    source: str = "unknown"
    correlation_id: Optional[str] = None
    priority: Optional[int] = None
    retry_count: int = 0
    max_retries: int = 3
    
    def __post_init__(self):
        """Initialize optional fields"""
        if self.timestamp is None:
            self.timestamp = datetime.now()
        if self.correlation_id is None:
            self.correlation_id = str(uuid.uuid4())
        if self.priority is None:
            self.priority = self.type.priority
    
    @classmethod
    def create(cls, type: EventType, payload: dict, source: str, correlation_id: str = None):
        """Create a new event with current timestamp"""
        return cls(
            type=type,
            payload=payload,
            source=source,
            correlation_id=correlation_id or str(asyncio.current_task().get_name())
        )

class EventBus:
    """Central event bus for ALEJO using Redis pub/sub
    Handles all inter-service communication"""
    
    def __init__(self, redis_url: str = "redis://localhost:6379/0", pool_size: int = 10, test_mode: bool = False, **redis_options):
        """Initialize the event bus without connecting to Redis or creating asyncio objects
        
        Args:
            redis_url: Redis connection URL
            pool_size: Maximum number of connections in the pool
            test_mode: If True, operate in test mode without connecting to Redis
            **redis_options: Additional Redis client options including:
                - socket_timeout: Socket operations timeout (default: 5s)
                - socket_connect_timeout: Connection timeout (default: 5s)
                - socket_keepalive: Enable TCP keepalive (default: True)
                - retry_on_timeout: Retry commands on timeout (default: True)
                - max_retries: Maximum number of retries (default: 3)
                - retry_delay: Initial delay between retries in seconds (default: 1.0)
                - health_check_interval: Seconds between health checks (default: 30)
        """
        # Redis settings
        self._redis_url = redis_url
        self._redis_client = None
        self._redis_pool = None
        self._pubsub = None
        self._test_mode = test_mode
        
        # Connection pool settings
        self._pool_size = pool_size
        self._socket_timeout = redis_options.get('socket_timeout', 5.0)
        self._socket_connect_timeout = redis_options.get('socket_connect_timeout', 5.0)
        self._socket_keepalive = redis_options.get('socket_keepalive', True)
        self._retry_on_timeout = redis_options.get('retry_on_timeout', True)
        
        # Retry settings
        self._max_retries = redis_options.get('max_retries', 3)
        self._retry_delay = redis_options.get('retry_delay', 1.0)
        
        # Health check settings
        self._health_check_interval = redis_options.get('health_check_interval', 30)
        self._last_health_check = 0
        self._health_check_task = None
        
        # Initialize non-asyncio attributes
        self.subscribers: Dict[str, List[Callable]] = {event_type.value: [] for event_type in EventType}
        self.running = False
        
        # These will be initialized in start()
        self._connection_lock = None
        self._retry_queue = None
        self._priority_queue = None
        self._processing_tasks = []
        
    async def start(self):
        """Start the event bus, initialize asyncio objects and Redis connection"""
        if self.running:
            return
            
        # Initialize asyncio objects
        self._connection_lock = asyncio.Lock()
        self._retry_queue = asyncio.Queue()
        self._priority_queue = asyncio.PriorityQueue()
        
        self.running = True
        
        # In test mode, skip Redis initialization
        if not self._test_mode:
            await self._init_redis()
            # Start health check loop
            self._health_check_task = asyncio.create_task(self._health_check_loop())
            logger.info("EventBus started with health check monitoring")
        else:
            logger.info("EventBus started in test mode (no Redis connection)")
        
    async def _init_redis(self):
        """Initialize Redis connection pool lazily with retries"""
        if self._redis_pool is None:
            async with self._connection_lock:
                if self._redis_pool is None:  # Double-check under lock
                    aioredis = get_redis_asyncio()
                    if aioredis is None:
                        logger.error("Redis module could not be imported")
                        raise EventBusError("Redis module could not be imported")
                        
                    last_error = None
                    retry_delay = self._retry_delay
                    
                    for attempt in range(self._max_retries):
                        try:
                            self._redis_pool = aioredis.ConnectionPool.from_url(
                                self._redis_url,
                                max_connections=self._pool_size,
                                socket_timeout=self._socket_timeout,
                                socket_connect_timeout=self._socket_connect_timeout,
                                socket_keepalive=self._socket_keepalive,
                                retry_on_timeout=self._retry_on_timeout,
                                health_check_interval=self._health_check_interval
                            )
                            logger.info(f"Redis pool initialized successfully on attempt {attempt + 1}")
                            return
                        except Exception as e:
                            last_error = e
                            if attempt < self._max_retries - 1:
                                logger.warning(f"Redis connection attempt {attempt + 1} failed: {e}. Retrying in {retry_delay}s...")
                                await asyncio.sleep(retry_delay)
                                retry_delay *= 2  # Exponential backoff
                    
                    # If we get here, all retries failed
                    logger.error(f"Failed to initialize Redis pool after {self._max_retries} attempts")
                    raise EventBusError(f"Redis connection failed: {last_error}") from last_error
        
    async def _health_check_loop(self):
        """Periodically check Redis connection health"""
        while self.running:
            try:
                await asyncio.sleep(self._health_check_interval)
                if self._redis_pool:
                    await self._redis_pool.ping()
                    logger.debug("Redis connection is healthy")
                else:
                    logger.warning("Redis connection is not initialized")
            except Exception as e:
                logger.error(f"Redis health check failed: {e}")
                self.running = False
                
    async def stop(self):
        """Stop the event bus and health check"""
        if not self.running:
            return
            
        self.running = False
        if self._health_check_task:
            self._health_check_task.cancel()
            try:
                await self._health_check_task
            except asyncio.CancelledError:
                pass
            self._health_check_task = None
        if self._pubsub:
            await self._pubsub.close()
            self._redis_client.close()
            self._redis_client = None
            self._pubsub = None
            
        # Clean up connections
        if self._pubsub:
            self._pubsub.unsubscribe()
        if self._redis_client:
            self._redis_client.close()
            
        logger.info("Event bus stopped and cleaned up")
        
    async def publish(self, event: Event) -> bool:
        """Publish an event to the bus with priority and retry support"""
        try:
            # Add to priority queue
            await self._priority_queue.put((event.priority, event))
            logger.debug(f"Queued event: {event.type} from {event.source} with priority {event.priority}")
            return True
            
        except Exception as e:
            logger.error(f"Error queueing event: {e}")
            raise EventBusError(f"Failed to queue event: {e}")
            
    async def _publish_to_redis(self, event: Event) -> bool:
        """Actually publish event to Redis"""
        if not self._redis_client:
            logger.error("Cannot publish event: Redis client not initialized")
            await self._retry_queue.put(event)
            return False
            
        try:
            channel = event.type.value
            message = json.dumps({
                "type": event.type.value,
                "data": event.payload,
                "timestamp": event.timestamp.isoformat(),
                "source": event.source,
                "correlation_id": event.correlation_id,
                "priority": event.priority,
                "retry_count": event.retry_count
            })
            
            success = await self._event_loop.run_in_executor(
                None, 
                self._redis_client.publish,
                channel,
                message
            )
            
            if success:
                logger.debug(f"Published event: {event.type} from {event.source}")
                return True
            else:
                # Add to retry queue if publish failed but retries remain
                if event.retry_count < event.max_retries:
                    event.retry_count += 1
                    await self._retry_queue.put(event)
                    logger.warning(f"Event publish failed, queued for retry: {event.type}")
                    return False
                else:
                    logger.error(f"Event publish failed after {event.max_retries} retries: {event.type}")
                    return False
                    
        except Exception as e:
            logger.error(f"Error publishing event: {e}")
            if event.retry_count < event.max_retries:
                event.retry_count += 1
                await self._retry_queue.put(event)
                logger.warning(f"Error publishing event, queued for retry: {event.type}")
            else:
                logger.error(f"Error publishing event after {event.max_retries} retries: {event.type}")
            return False
            
    def subscribe(self, event_type: Any, callback: Callable[[Event], None]):
        """Subscribe to events of a specific type"""
        key = event_type.value if isinstance(event_type, EventType) else event_type
        self.subscribers.setdefault(key, []).append(callback)
        logger.debug(f"Added subscriber for event type {key}")
        
    def unsubscribe(self, event_type: Any, callback: Callable[[Event], None]):
        """Unsubscribe from events of a specific type"""
        key = event_type.value if isinstance(event_type, EventType) else event_type
        if key in self.subscribers and callback in self.subscribers[key]:
            self.subscribers[key].remove(callback)
            logger.debug(f"Removed subscriber for event type {key}")
        
    async def _process_priority_queue(self):
        """Process events from priority queue"""
        while self.running:
            try:
                # Get highest priority event
                priority, event = await self._priority_queue.get()
                
                # Attempt to publish
                success = await self._publish_to_redis(event)
                
                # Mark task as done
                self._priority_queue.task_done()
                
                if not success and event.retry_count < event.max_retries:
                    # Will be handled by retry queue
                    continue
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error processing priority queue: {e}")
                await asyncio.sleep(1)  # Prevent tight error loop
                
    @asynccontextmanager
    async def _get_redis_client(self):
        """Get a Redis client from the pool with error handling"""
        # In test mode, raise an error since Redis is not available
        if self._test_mode:
            try:
                logger.warning("Attempted to get Redis client in test mode")
                raise EventBusError("Redis operations not available in test mode")
            except Exception as e:
                raise e
                
        # Ensure Redis is initialized
        await self._init_redis()
        
        # Get client
        client = None
        try:
            aioredis = get_redis_asyncio()
            if aioredis is None:
                raise EventBusError("Redis module could not be imported")
                
            client = aioredis.Redis(connection_pool=self._redis_pool)
            yield client
        except Exception as e:
            logger.error(f"Failed to get Redis client: {e}")
            if self._redis_pool:
                await self._redis_pool.disconnect()
                self._redis_pool = None
            raise EventBusError(f"Failed to get Redis client: {e}") from e
        finally:
            if client:
                try:
                    await client.close()
                except Exception:
                    pass
                    
    def subscribe(self, event_type: Any, callback: Callable[[Event], None]):
        """Subscribe to events of a specific type"""
        key = event_type.value if isinstance(event_type, EventType) else event_type
        self.subscribers.setdefault(key, []).append(callback)
        logger.debug(f"Added subscriber for event type {key}")
        
    def unsubscribe(self, event_type: Any, callback: Callable[[Event], None]):
        """Unsubscribe from events of a specific type"""
        key = event_type.value if isinstance(event_type, EventType) else event_type
        if key in self.subscribers and callback in self.subscribers[key]:
            self.subscribers[key].remove(callback)
            logger.debug(f"Removed subscriber for event type {key}")
        
    async def _process_priority_queue(self):
        """Process events from priority queue"""
        while self.running:
            try:
                # Get highest priority event
                priority, event = await self._priority_queue.get()
                
                # Attempt to publish
                success = await self._publish_to_redis(event)
                
                # Mark task as done
                self._priority_queue.task_done()
                
                if not success and event.retry_count < event.max_retries:
                    # Will be handled by retry queue
                    continue
                        
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error processing priority queue: {e}")
                await asyncio.sleep(1)  # Prevent tight error loop
                
    @asynccontextmanager
    async def _get_redis_client(self):
        """Get a Redis client from the pool with error handling"""
        # Ensure Redis is initialized
        await self._init_redis()
            
        # Get client
        aioredis = get_redis_asyncio()
        if aioredis is None:
            logger.error("Redis module could not be imported")
            raise EventBusError("Redis module could not be imported")
                
        client = None
        try:
            client = aioredis.Redis(connection_pool=self._redis_pool)
            yield client
        except Exception as e:
            logger.error(f"Failed to get Redis client: {e}")
            if self._redis_pool:
                await self._redis_pool.disconnect()
                self._redis_pool = None
            raise EventBusError(f"Failed to get Redis client: {e}") from e
        finally:
            # Clean up resources
            if client:
                try:
                    await client.close()
                except Exception as e:
                    logger.warning(f"Error closing Redis client: {e}")
                await asyncio.sleep(1)  # Prevent tight error loop
                
    async def _message_listener(self):
        """Listen for messages on subscribed channels"""
        if not self._pubsub:
            logger.error("Cannot listen for messages: Redis pubsub not initialized")
            self.running = False
            return
                
        try:
            # Subscribe to all channels
            for event_type in EventType:
                self._pubsub.subscribe(event_type.value)
            
            # Process messages
            while self.running:
                message = self._pubsub.get_message(timeout=1)
                if message:
                    await self._handle_message(message)
                        
        except Exception as e:
            logger.error(f"Error in message listener: {e}")
            self.running = False
                
    async def _handle_message(self, message: dict):
        """Handle incoming messages from Redis"""
        try:
            if message.get('type') != 'message':
                return

            message_data = message.get("data")
            if isinstance(message_data, bytes):
                message_data = message_data.decode('utf-8')

            data = json.loads(message_data)
            event_type_str = data.get("type")

            event = Event(
                type=EventType(event_type_str),
                payload=data.get("payload", {}),
                timestamp=datetime.fromisoformat(data["timestamp"]) if data.get("timestamp") else datetime.now(),
                source=data.get("source", "unknown"),
                correlation_id=data.get("correlation_id"),
                priority=data.get("priority")
            )
            
            key = event.type.value
            if key in self.subscribers:
                for callback in self.subscribers[key]:
                    try:
                        if asyncio.iscoroutinefunction(callback):
                            await callback(event)
                        else:
                            await self._event_loop.run_in_executor(None, callback, event)
                    except Exception as e:
                        logger.error(f"Error in event handler for {key}: {e}", exc_info=True)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to decode message data: {message.get('data')}, error: {e}")
        except Exception as e:
            logger.error(f"Error handling message: {e}", exc_info=True)


    async def emit_command(self, command: str, params: dict, source: str):
        """Emit a command event"""
        event = Event.create(
            type=EventType.COMMAND,
            payload={"command": command, "parameters": params},
            source=source
        )
        await self.publish(event)
        
    async def emit_emotion(self, emotion: str, intensity: float, source: str):
        """Emit an emotion event"""
        event = Event.create(
            type=EventType.EMOTION,
            payload={"emotion": emotion, "intensity": intensity},
            source=source
        )
        await self.publish(event)
        
    async def emit_memory(self, memory_type: str, content: dict, source: str):
        """Emit a memory event"""
        event = Event.create(
            type=EventType.MEMORY,
            payload={"type": memory_type, "content": content},
            source=source
        )
        await self.publish(event)

    async def emit_proactive_prompt(self, text: str, prompt_type: str, rationale: str, source: str = "brain"):
        """Emit a proactive empathy/curiosity prompt event"""
        event = Event.create(
            type=EventType.PROACTIVE_PROMPT,
            payload={
                "text": text,
                "prompt_type": prompt_type,
                "rationale": rationale,
                "timestamp": datetime.now().isoformat()
            },
            source=source
        )
        await self.publish(event)
