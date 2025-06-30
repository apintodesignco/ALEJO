"""
ALEJO Service Mesh
Handles service discovery, load balancing, and circuit breaking
"""

import asyncio
from typing import Dict, List, Optional, Callable
import aiohttp
from dataclasses import dataclass
import logging
from datetime import datetime, timedelta
import json
from .event_bus import EventBus, Event, EventType

logger = logging.getLogger(__name__)

@dataclass
@dataclass
class ServiceHealth:
    """Health status of a service"""
    is_healthy: bool
    last_check: datetime
    error_count: int
    latency_ms: float
    consecutive_failures: int = 0
    last_success: Optional[datetime] = None
    avg_latency_ms: float = 0.0
    request_count: int = 0
    success_rate: float = 1.0  # Start optimistic
    
    def update_metrics(self, success: bool, latency_ms: float):
        """Update service health metrics"""
        self.request_count += 1
        
        if success:
            self.consecutive_failures = 0
            self.last_success = datetime.now()
            self.error_count = max(0, self.error_count - 1)  # Gradual error recovery
        else:
            self.consecutive_failures += 1
            self.error_count += 1
            
        # Update rolling average latency (last 100 requests)
        self.avg_latency_ms = (self.avg_latency_ms * min(99, self.request_count) + latency_ms) / min(100, self.request_count + 1)
        
        # Update success rate with exponential decay
        decay = 0.95  # Newer requests have more weight
        self.success_rate = (self.success_rate * decay) + (float(success) * (1 - decay))
        
        # Update current latency
        self.latency_ms = latency_ms
        self.last_check = datetime.now()

class CircuitBreaker:
    """Enhanced circuit breaker with adaptive thresholds"""
    
    def __init__(self, failure_threshold: int = 5, reset_timeout: int = 60,
                 half_open_timeout: int = 30, success_threshold: int = 3):
        self.failure_threshold = failure_threshold
        self.reset_timeout = reset_timeout
        self.half_open_timeout = half_open_timeout
        self.success_threshold = success_threshold
        self.failures = 0
        self.successes = 0
        self.last_failure_time = None
        self.last_state_change = datetime.now()
        self.state = "CLOSED"  # CLOSED, OPEN, HALF-OPEN
        self.total_failures = 0
        self.total_requests = 0
        self.failure_rate_threshold = 0.5  # 50% failure rate triggers circuit
        
    async def call(self, func: Callable, *args, **kwargs):
        """Execute function with circuit breaker pattern"""
        if self.state == "OPEN":
            if datetime.now() - self.last_failure_time > timedelta(seconds=self.reset_timeout):
                self.state = "HALF-OPEN"
            else:
                raise Exception("Circuit breaker is OPEN")
                
        try:
            result = await func(*args, **kwargs)
            if self.state == "HALF-OPEN":
                self.state = "CLOSED"
                self.failures = 0
            return result
            
        except Exception as e:
            self.failures += 1
            self.last_failure_time = datetime.now()
            
            if self.failures >= self.failure_threshold:
                self.state = "OPEN"
                
            raise e

class ServiceMesh:
    """
    Service mesh implementation for ALEJO
    Handles service discovery, health checks, load balancing, and testing coordination
    """
    
    def __init__(self, event_bus: Optional[EventBus] = None, config: Optional[dict] = None):
        self.event_bus = event_bus or EventBus()
        self.config = config or {}
        self.services: Dict[str, List[str]] = {}
        self.health: Dict[str, ServiceHealth] = {}
        self.circuit_breakers: Dict[str, CircuitBreaker] = {}
        self.session: Optional[aiohttp.ClientSession] = None
        self.test_mode = False
        self.test_results: Dict[str, List[dict]] = {}
        self.service_mocks: Dict[str, Callable] = {}
        
        # Service dependencies for testing order
        self.service_deps = {
            'brain': ['memory', 'emotional'],
            'emotional': ['memory'],
            'voice': ['brain'],
            'vision': ['brain'],
            'memory': [],
            'training': ['brain', 'memory']
        }
        
    async def start(self):
        """Initialize service mesh and start health checks"""
        self.session = aiohttp.ClientSession()
        await self.discover_services()
        asyncio.create_task(self._health_check_loop())
        
    async def stop(self):
        """Gracefully shutdown service mesh"""
        if self.session:
            await self.session.close()
        self.session = None
        
    def enable_test_mode(self):
        """Enable test mode with mocking and result collection"""
        self.test_mode = True
        self.test_results.clear()
        for service in self.service_deps.keys():
            self.test_results[service] = []
            
    def disable_test_mode(self):
        """Disable test mode"""
        self.test_mode = False
        self.service_mocks.clear()
        
    def mock_service(self, service_name: str, mock_func: Callable):
        """Register a mock function for a service during testing"""
        self.service_mocks[service_name] = mock_func
        
    async def run_integration_tests(self) -> Dict[str, dict]:
        """Run comprehensive integration tests across all services"""
        self.enable_test_mode()
        results = {}
        
        # Test services in dependency order
        test_order = self._get_test_order()
        for service in test_order:
            logger.info(f"Testing service: {service}")
            service_result = await self._test_service(service)
            results[service] = service_result
            
            if not service_result['success']:
                logger.error(f"Tests failed for {service}, stopping integration tests")
                break
                
        self.disable_test_mode()
        return results
        
    def _get_test_order(self) -> List[str]:
        """Get services ordered by dependencies for testing"""
        visited = set()
        order = []
        
        def visit(service):
            if service in visited:
                return
            visited.add(service)
            for dep in self.service_deps[service]:
                visit(dep)
            order.append(service)
            
        for service in self.service_deps:
            visit(service)
            
        return order
        
    async def _test_service(self, service: str) -> dict:
        """Run tests for a specific service"""
        try:
            # Basic health check
            endpoint = await self.get_endpoint(service)
            if not endpoint:
                return {
                    'success': False,
                    'error': f"No healthy endpoint found for {service}",
                    'metrics': self._get_service_metrics(service)
                }

            health = await self._check_service_health(endpoint)
            if not health.is_healthy:
                return {
                    'success': False,
                    'error': f"Service {service} is unhealthy",
                    'metrics': self._get_service_metrics(service)
                }
            
            # Run service-specific tests
            test_func = getattr(self, f"_test_{service}_service", None)
            if test_func:
                await test_func()
            
            # Analyze test results
            service_results = self.test_results.get(service, [])
            success_rate = sum(1 for r in service_results if r.get('success')) / len(service_results) if service_results else 0
            
            return {
                'success': success_rate >= 0.95,  # 95% success rate required
                'test_count': len(service_results),
                'success_rate': success_rate,
                'metrics': self._get_service_metrics(service)
            }
            
        except Exception as e:
            logger.exception(f"Error testing {service}")
            return {
                'success': False,
                'error': str(e),
                'metrics': self._get_service_metrics(service)
            }
            
    def _get_service_metrics(self, service: str) -> dict:
        """Get detailed metrics for a service"""
        health = self.services.get(service)
        if not health:
            return {}
            
        return {
            'latency': health.avg_latency_ms,
            'success_rate': health.success_rate,
            'error_count': health.error_count,
            'request_count': health.request_count
        }
        
    async def _test_memory_service(self):
        """Test memory service functionality"""
        try:
            # Test basic operations
            memory_id = await self._call_service('memory', 'create', {
                'content': 'Test memory',
                'tags': ['test']
            })
            
            # Test retrieval
            memory = await self._call_service('memory', 'get', {'id': memory_id})
            assert memory['content'] == 'Test memory'
            
            # Test search
            results = await self._call_service('memory', 'search', {'query': 'test'})
            assert len(results) > 0
            
            # Test update
            await self._call_service('memory', 'update', {
                'id': memory_id,
                'content': 'Updated test memory'
            })
            
            # Test delete
            await self._call_service('memory', 'delete', {'id': memory_id})
            
            self.test_results['memory'].append({
                'success': True,
                'test': 'basic_operations'
            })
            
        except Exception as e:
            self.test_results['memory'].append({
                'success': False,
                'test': 'basic_operations',
                'error': str(e)
            })
            
    async def _test_emotional_service(self):
        """Test emotional intelligence service functionality"""
        try:
            # Test sentiment analysis
            sentiment = await self._call_service('emotional', 'analyze_sentiment', {
                'text': 'I am very happy today!'
            })
            assert sentiment['polarity'] > 0
            
            # Test emotion detection
            emotions = await self._call_service('emotional', 'detect_emotions', {
                'text': 'This makes me angry!'
            })
            assert len(emotions) > 0
            
            # Test empathy generation
            response = await self._call_service('emotional', 'generate_empathy', {
                'context': 'User is frustrated with a technical problem'
            })
            assert response and len(response) > 0
            
            self.test_results['emotional'].append({
                'success': True,
                'test': 'emotional_analysis'
            })
            
        except Exception as e:
            self.test_results['emotional'].append({
                'success': False,
                'test': 'emotional_analysis',
                'error': str(e)
            })
            
    async def _test_brain_service(self):
        """Test brain service functionality"""
        try:
            # Test command processing
            result = await self._call_service('brain', 'process_command', {
                'command': 'help',
                'context': {'mode': 'test'}
            })
            assert result['success']
            
            # Test context management
            context = await self._call_service('brain', 'get_context', {})
            assert context is not None
            
            # Test decision making
            decision = await self._call_service('brain', 'make_decision', {
                'options': ['A', 'B'],
                'context': {'test': True}
            })
            assert decision in ['A', 'B']
            
            self.test_results['brain'].append({
                'success': True,
                'test': 'core_functions'
            })
            
        except Exception as e:
            self.test_results['brain'].append({
                'success': False,
                'test': 'core_functions',
                'error': str(e)
            })
            
    async def _test_voice_service(self):
        """Test voice service functionality"""
        try:
            # Test voice recognition (mock)
            if 'voice' in self.service_mocks:
                recognition = await self.service_mocks['voice']('test_audio.wav')
            else:
                recognition = await self._call_service('voice', 'recognize', {
                    'audio_path': 'test/resources/test_audio.wav'
                })
            assert recognition['text']
            
            # Test voice synthesis
            synthesis = await self._call_service('voice', 'synthesize', {
                'text': 'Hello, this is a test.'
            })
            assert synthesis['audio_data']
            
            self.test_results['voice'].append({
                'success': True,
                'test': 'voice_processing'
            })
            
        except Exception as e:
            self.test_results['voice'].append({
                'success': False,
                'test': 'voice_processing',
                'error': str(e)
            })
            
    async def _test_vision_service(self):
        """Test vision service functionality"""
        try:
            # Test face detection
            faces = await self._call_service('vision', 'detect_faces', {
                'image_path': 'test/resources/test_face.jpg'
            })
            assert len(faces) > 0
            
            # Test object detection
            objects = await self._call_service('vision', 'detect_objects', {
                'image_path': 'test/resources/test_scene.jpg'
            })
            assert len(objects) > 0
            
            # Test scene analysis
            scene = await self._call_service('vision', 'analyze_scene', {
                'image_path': 'test/resources/test_scene.jpg'
            })
            assert scene['description']
            
            self.test_results['vision'].append({
                'success': True,
                'test': 'vision_processing'
            })
            
        except Exception as e:
            self.test_results['vision'].append({
                'success': False,
                'test': 'vision_processing',
                'error': str(e)
            })
            
    async def _test_training_service(self):
        """Test training service functionality"""
        try:
            # Test face training
            face_result = await self._call_service('training', 'train_face', {
                'mode': 'test',
                'samples': ['test/resources/test_face_1.jpg']
            })
            assert face_result['profile_updated']
            
            # Test voice training
            voice_result = await self._call_service('training', 'train_voice', {
                'mode': 'test',
                'samples': ['test/resources/test_voice_1.wav']
            })
            assert voice_result['profile_updated']
            
            # Test profile management
            profile = await self._call_service('training', 'get_training_profile', {})
            assert profile['face'] and profile['voice']
            
            self.test_results['training'].append({
                'success': True,
                'test': 'training_functions'
            })
            
        except Exception as e:
            self.test_results['training'].append({
                'success': False,
                'test': 'training_functions',
                'error': str(e)
            })
    
    async def _call_service(self, service: str, method: str, params: dict) -> dict:
        """Call a service method with parameters"""
        if service in self.service_mocks and self.test_mode:
            return await self.service_mocks[service](method, params)
            
        if not self.session:
            raise RuntimeError("Service mesh not started")
            
        service_config = self.config.get('services', {}).get(service, {})
        if not service_config:
            raise ValueError(f"Service {service} not configured")
            
        url = f"{service_config['url']}/{method}"
        timeout = aiohttp.ClientTimeout(total=service_config.get('timeout_ms', 5000) / 1000)
        
        try:
            async with self.session.post(url, json=params, timeout=timeout) as response:
                response.raise_for_status()
                return await response.json()
                
        except Exception as e:
            logger.error(f"Error calling {service}.{method}: {e}")
            if service in self.services:
                self.services[service].update_metrics(False, timeout.total * 1000)
            raise
        self.services: Dict[str, List[str]] = {}  # service_name -> [endpoints]
        self.health: Dict[str, ServiceHealth] = {}  # endpoint -> health
        self.circuit_breakers: Dict[str, CircuitBreaker] = {}  # endpoint -> circuit_breaker
        self._service_counters: Dict[str, int] = {}  # For round-robin load balancing
        self.session: Optional[aiohttp.ClientSession] = None
        self._weights: Dict[str, float] = {}  # Endpoint weights for weighted load balancing
        self._service_versions: Dict[str, Dict[str, str]] = {}  # Service versions for canary deployment
        self._service_dependencies: Dict[str, List[str]] = {}  # Service dependencies for cascade failure prevention
        self._health_check_interval = 30  # Seconds between health checks
        self._last_health_check: Dict[str, datetime] = {}
        
    async def start(self):
        """Start the service mesh"""
        self.session = aiohttp.ClientSession()
        asyncio.create_task(self._health_check_loop())
        
        # Subscribe to service registration events
        self.event_bus.subscribe(EventType.SYSTEM, self._handle_system_event)
        logger.info("Service mesh started")
        
    async def stop(self):
        """Stop the service mesh"""
        if self.session:
            await self.session.close()
        logger.info("Service mesh stopped")
        
    def register_service(self, service_name: str, endpoint: str):
        """Register a new service endpoint"""
        if service_name not in self.services:
            self.services[service_name] = []
            self._service_counters[service_name] = 0
        
        if endpoint not in self.services[service_name]:
            self.services[service_name].append(endpoint)
            self.health[endpoint] = ServiceHealth(
                is_healthy=True,
                last_check=datetime.now(),
                error_count=0,
                latency_ms=0
            )
            self.circuit_breakers[endpoint] = CircuitBreaker()
            logger.info(f"Registered service {service_name} at {endpoint}")
            
        logger.info(f"Registered service {service_name} at {endpoint}")
        
    async def call_service(self, service_name: str, path: str, method: str = "GET", **kwargs) -> dict:
        """Call a service with load balancing and circuit breaking"""
        if service_name not in self.services or not self.services[service_name]:
            raise Exception(f"No endpoints available for service {service_name}")
            
        endpoint = await self.get_endpoint(service_name)
        if not endpoint:
            raise Exception(f"No healthy endpoints available for service {service_name}")
            
        circuit_breaker = self.circuit_breakers[endpoint]
        
        async def make_request():
            start_time = datetime.now()
            async with self.session.request(method, f"{endpoint}{path}", **kwargs) as response:
                response.raise_for_status()
                data = await response.json()
                
                # Update health metrics
                latency = (datetime.now() - start_time).total_seconds() * 1000
                self.health[endpoint].latency_ms = latency
                return data
                
        try:
            return await circuit_breaker.call(make_request)
        except Exception as e:
            logger.error(f"Error calling service {service_name}: {e}")
            raise
            
    async def _health_check_loop(self):
        """Periodic health check of all registered services"""
        while True:
            try:
                await asyncio.sleep(30)  # Check every 30 seconds
                await self._check_all_services()
            except Exception as e:
                logger.error(f"Error in health check loop: {e}")
                await asyncio.sleep(5)  # Brief pause before retrying
                
    async def _check_all_services(self):
        """Check health of all registered services"""
        for service_name, endpoints in list(self.services.items()):
            unhealthy_endpoints = []
            for endpoint in endpoints:
                is_healthy = await self._check_service_health(endpoint)
                if not is_healthy:
                    unhealthy_endpoints.append(endpoint)
                    
            # Deregister endpoints that have been unhealthy for too long
            for endpoint in unhealthy_endpoints:
                if self.health[endpoint].error_count > 10:  # Threshold for deregistration
                    self.deregister_service(service_name, endpoint)
                    logger.warning(f"Auto-deregistered unhealthy endpoint {endpoint} for service {service_name}")
                    
            await asyncio.sleep(1)  # Brief pause between services
            
    async def _check_service_health(self, endpoint: str) -> bool:
        """Check health of a single service endpoint with advanced metrics"""
        try:
            start_time = datetime.now()
            async with self.session.get(
                f"{endpoint}/health",  # Use dedicated health endpoint
                timeout=aiohttp.ClientTimeout(total=5),  # 5 second timeout
                headers={"X-Health-Check": "true"}
            ) as response:
                latency = (datetime.now() - start_time).total_seconds() * 1000
                
                # Parse health data if available
                health_data = {}
                try:
                    if response.headers.get("content-type", "").startswith("application/json"):
                        health_data = await response.json()
                except:
                    pass
                    
                # Get current health or create new
                current_health = self.health.get(endpoint) or ServiceHealth(
                    is_healthy=True,
                    last_check=datetime.now(),
                    error_count=0,
                    latency_ms=0
                )
                
                # Update metrics
                success = response.status == 200
                current_health.update_metrics(success, latency)
                
                # Update additional metrics from health endpoint
                if health_data:
                    if "version" in health_data:
                        service_name = next(
                            (name for name, eps in self.services.items() if endpoint in eps),
                            None
                        )
                        if service_name:
                            self._service_versions.setdefault(service_name, {})[endpoint] = health_data["version"]
                            
                    if "dependencies" in health_data:
                        service_name = next(
                            (name for name, eps in self.services.items() if endpoint in eps),
                            None
                        )
                        if service_name:
                            self._service_dependencies[service_name] = health_data["dependencies"]
                            
                # Store updated health
                self.health[endpoint] = current_health
                
                # Emit health status event
                await self.event_bus.publish(Event(
                    type=EventType.SYSTEM,
                    data={
                        "action": "health_update",
                        "endpoint": endpoint,
                        "health": {
                            "is_healthy": current_health.is_healthy,
                            "success_rate": current_health.success_rate,
                            "avg_latency_ms": current_health.avg_latency_ms,
                            "error_count": current_health.error_count
                        }
                    }
                ))
                
                return success
                
        except Exception as e:
            logger.error(f"Health check failed for {endpoint}: {e}")
            self.health[endpoint].is_healthy = False
            self.health[endpoint].error_count += 1
            return False
            
    async def get_endpoint(self, service_name: str) -> Optional[str]:
        """Get a healthy endpoint using weighted load balancing"""
        endpoints = self.services.get(service_name)
        if not endpoints:
            return None
            
        # Filter healthy endpoints
        healthy_endpoints = [ep for ep in endpoints if self.health[ep].is_healthy]
        if not healthy_endpoints:
            return None
            
        # Calculate weights based on health metrics
        weights = {}
        for ep in healthy_endpoints:
            health = self.health[ep]
            # Weight formula considers:
            # - Success rate (0-1)
            # - Normalized latency (lower is better)
            # - Recent errors (exponential penalty)
            latency_factor = 1.0 / (1.0 + health.avg_latency_ms / 1000)  # Normalize to 0-1
            error_penalty = 0.5 ** health.consecutive_failures
            weight = health.success_rate * latency_factor * error_penalty
            weights[ep] = max(0.1, weight)  # Minimum weight of 0.1
            
        # Normalize weights
        total_weight = sum(weights.values())
        if total_weight > 0:
            weights = {ep: w/total_weight for ep, w in weights.items()}
            
        # Select endpoint using weighted random choice
        r = random.random()
        cumsum = 0
        for ep, weight in weights.items():
            cumsum += weight
            if r <= cumsum:
                return ep
                
        return healthy_endpoints[0]  # Fallback to first healthy endpoint
            
    async def _handle_system_event(self, event: Event):
        """Handle system events for service registration/deregistration"""
        if event.payload.get("action") == "register":
            self.register_service(
                event.payload["service_name"],
                event.payload["endpoint"]
            )
        elif event.payload.get("action") == "deregister":
            # TODO: Implement service deregistration
            pass
