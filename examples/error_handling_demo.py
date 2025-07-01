"""
Example script demonstrating ALEJO's error handling capabilities
"""

import time
import random
from pathlib import Path
from typing import Dict, Any

from alejo.utils.error_handling import handle_errors
from alejo.utils.metrics import get_metrics
from alejo.utils.monitoring import get_monitor
from alejo.utils.exceptions import (
    FileOperationError, NetworkError, APIError,
    MemoryError, TimeoutError
)

# Initialize our components
metrics = get_metrics()
monitor = get_monitor()

@handle_errors(component='demo', category='file_operation')
def process_file(path: str) -> Dict[str, Any]:
    """Example of file operation with error handling."""
    start_time = time.time()
    
    try:
        # Simulate file processing that might fail
        if not Path(path).exists():
            raise FileOperationError(f"File not found: {path}")
        
        # Simulate successful processing
        time.sleep(0.5)  # Simulated work
        result = {'status': 'success', 'path': path}
        
        # Record metrics
        duration = time.time() - start_time
        metrics.record_recovery_time('demo', 'file_operation', duration)
        metrics.record_recovery_result('demo', 'file_operation', True)
        
        return result
    
    except Exception as e:
        # Log the error
        monitor.log_error({
            'component': 'demo',
            'category': 'file_operation',
            'error': str(e),
            'path': path
        })
        raise

@handle_errors(component='demo', category='api')
def api_call(endpoint: str) -> Dict[str, Any]:
    """Example of API call with rate limit handling."""
    if random.random() < 0.3:  # 30% chance of rate limit
        raise APIError("Rate limit exceeded")
    return {'status': 'success', 'endpoint': endpoint}

@handle_errors(component='demo', category='network')
def network_operation() -> Dict[str, Any]:
    """Example of network operation with retry logic."""
    if random.random() < 0.5:  # 50% chance of network error
        raise NetworkError("Connection failed")
    return {'status': 'success'}

def main():
    """Run error handling demonstration."""
    print("Starting error handling demo...")
    
    # Test file operations
    try:
        result = process_file("nonexistent.txt")
        print(f"File operation result: {result}")
    except Exception as e:
        print(f"File operation failed: {e}")
    
    # Test API calls with rate limiting
    for i in range(5):
        try:
            result = api_call(f"/api/endpoint/{i}")
            print(f"API call {i} result: {result}")
        except Exception as e:
            print(f"API call {i} failed: {e}")
        time.sleep(0.5)
    
    # Test network operations with retries
    for i in range(3):
        try:
            result = network_operation()
            print(f"Network operation {i} result: {result}")
        except Exception as e:
            print(f"Network operation {i} failed: {e}")
    
    # Print performance metrics
    print("\nPerformance Metrics:")
    metrics_report = metrics.get_performance_report()
    print(f"Total recoveries: {metrics_report['overall_stats']['total_recoveries']}")
    print(f"Overall success rate: {metrics_report['overall_stats']['overall_success_rate']:.2%}")
    
    # Print error statistics
    print("\nError Statistics:")
    error_stats = monitor.get_error_stats()
    for error_type, count in error_stats['counts'].items():
        print(f"{error_type}: {count} occurrences")

if __name__ == '__main__':
    main()