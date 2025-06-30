"""
ALEJO Integration Test Runner
Executes comprehensive integration tests across all services
"""

import asyncio
import logging
import json
from pathlib import Path
from datetime import datetime
from typing import Dict, Optional

from alejo.core.service_mesh import ServiceMesh
from alejo.core.event_bus import EventBus
from alejo.utils.error_handling import ErrorTracker

logger = logging.getLogger(__name__)

class IntegrationTestRunner:
    """Manages execution of ALEJO integration tests"""
    
    def __init__(self, config_path: Optional[str] = None):
        self.config = self._load_config(config_path)
        self.event_bus = EventBus()
        self.service_mesh = ServiceMesh(self.event_bus, self.config)
        self.error_tracker = ErrorTracker()
        
    def _load_config(self, config_path: Optional[str]) -> Dict:
        """Load test configuration"""
        if not config_path:
            config_path = Path(__file__).parent / 'test_config.json'
            
        try:
            with open(config_path) as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Failed to load config from {config_path}: {e}")
            return {}
            
    async def setup(self):
        """Initialize test environment"""
        # Create test resources directory if needed
        resources_dir = Path(__file__).parent / 'resources'
        resources_dir.mkdir(exist_ok=True)
        
        # Start service mesh
        await self.service_mesh.start()
        
        # Register test event handlers
        self.event_bus.subscribe('test_start', self._on_test_start)
        self.event_bus.subscribe('test_complete', self._on_test_complete)
        
    async def teardown(self):
        """Clean up test environment"""
        await self.service_mesh.stop()
        
    async def run_tests(self) -> Dict:
        """Execute all integration tests"""
        try:
            await self.setup()
            
            # Start test session
            session_id = datetime.now().strftime('%Y%m%d_%H%M%S')
            logger.info(f"Starting integration test session {session_id}")
            
            # Run tests through service mesh
            results = await self.service_mesh.run_integration_tests()
            
            # Generate test report
            report = self._generate_report(session_id, results)
            
            # Save report
            report_path = Path(__file__).parent / 'reports' / f'integration_test_{session_id}.json'
            report_path.parent.mkdir(exist_ok=True)
            with open(report_path, 'w') as f:
                json.dump(report, f, indent=2)
                
            return report
            
        except Exception as e:
            logger.exception("Error running integration tests")
            return {
                'success': False,
                'error': str(e)
            }
        finally:
            await self.teardown()
            
    def _generate_report(self, session_id: str, results: Dict) -> Dict:
        """Generate detailed test report"""
        total_tests = sum(r.get('test_count', 0) for r in results.values())
        passed_services = sum(1 for r in results.values() if r.get('success', False))
        
        return {
            'session_id': session_id,
            'timestamp': datetime.now().isoformat(),
            'summary': {
                'total_services': len(results),
                'passed_services': passed_services,
                'total_tests': total_tests,
                'success_rate': passed_services / len(results) if results else 0
            },
            'service_results': results,
            'errors': self.error_tracker.get_errors()
        }
        
    async def _on_test_start(self, event):
        """Handle test start event"""
        logger.info(f"Starting tests for service: {event.data.get('service')}")
        
    async def _on_test_complete(self, event):
        """Handle test completion event"""
        service = event.data.get('service')
        success = event.data.get('success', False)
        logger.info(f"Completed tests for service: {service} (Success: {success})")
        
def main():
    """Main entry point for running integration tests"""
    logging.basicConfig(level=logging.INFO)
    
    runner = IntegrationTestRunner()
    results = asyncio.run(runner.run_tests())
    
    # Print summary
    print("\nTest Results Summary:")
    print("-" * 50)
    print(f"Total Services: {results['summary']['total_services']}")
    print(f"Passed Services: {results['summary']['passed_services']}")
    print(f"Total Tests: {results['summary']['total_tests']}")
    print(f"Success Rate: {results['summary']['success_rate']*100:.1f}%")
    print("\nDetailed results saved to reports directory")
    
if __name__ == '__main__':
    main()
