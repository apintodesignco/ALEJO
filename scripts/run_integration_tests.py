"""
Integration Test Runner Script
Manages service startup and test execution
"""

import asyncio
import logging
import sys
import time
from pathlib import Path

import sys
from pathlib import Path

# Add project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from scripts.run_services import ServiceRunner
from tests.integration.test_runner import IntegrationTestRunner

logger = logging.getLogger(__name__)

async def main():
    """Main test execution flow"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )
    
    # Start services
    logger.info("Starting ALEJO services...")
    service_runner = ServiceRunner()
    service_runner.start_services()
    
    try:
        # Wait for services to be ready
        logger.info("Waiting for services to initialize...")
        time.sleep(5)  # Give services time to start
        
        # Check service health
        health = service_runner.check_health()
        if not all(health.values()):
            failed = [s for s, h in health.items() if not h]
            logger.error(f"Services failed to start: {failed}")
            return 1
            
        # Run integration tests
        logger.info("Running integration tests...")
        test_runner = IntegrationTestRunner()
        results = await test_runner.run_tests()
        
        # Print results summary
        print("\nTest Results Summary:")
        print("-" * 50)
        print(f"Total Services: {results['summary']['total_services']}")
        print(f"Passed Services: {results['summary']['passed_services']}")
        print(f"Total Tests: {results['summary']['total_tests']}")
        print(f"Success Rate: {results['summary']['success_rate']*100:.1f}%")
        
        # Print service-specific results
        print("\nService Results:")
        print("-" * 50)
        for service, result in results['service_results'].items():
            status = "✓" if result['success'] else "✗"
            print(f"{service:15} [{status}] ", end="")
            if not result['success']:
                print(f"Error: {result.get('error', 'Unknown error')}")
            else:
                print(f"Tests: {result.get('test_count', 0)}")
                
        # Check if all services passed
        if results['summary']['success_rate'] < 1.0:
            return 1
            
        return 0
        
    except KeyboardInterrupt:
        logger.info("Test execution interrupted")
        return 1
        
    except Exception as e:
        logger.exception("Error running tests")
        return 1
        
    finally:
        # Stop all services
        logger.info("Stopping services...")
        service_runner.stop_services()

if __name__ == '__main__':
    sys.exit(asyncio.run(main()))
