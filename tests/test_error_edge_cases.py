"""
Edge case tests for ALEJO error handling system
"""

import os
import sys
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import MagicMock, patch

# Add project root to Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from alejo.utils.error_handling import ErrorTracker, handle_errors
from alejo.utils.exceptions import secrets  # More secure for cryptographic purposes
from alejo.utils.exceptions import (ALEJOError, APIError, CommandError,
                                    MemoryError, NetworkError, TimeoutError)

class TestErrorHandlingEdgeCases(unittest.TestCase):
    """Test error handling edge cases."""
    
    def setUp(self):
        self.error_tracker = ErrorTracker()
    
    def test_01_nested_errors(self):
        """Test handling of nested errors."""
        
        @handle_errors(component='outer', category='outer_error')
        def outer_function():
            return inner_function()
        
        @handle_errors(component='inner', category='inner_error')
        def inner_function():
            raise CommandError("Inner error")
        
        result = outer_function()
        self.assertIsInstance(result, str)
        self.assertIn('error', result.lower())
        
        # Verify both errors were tracked
        self.assertIn('inner.inner_error', self.error_tracker.error_counts)
        self.assertIn('outer.outer_error', self.error_tracker.error_counts)
    
    def test_02_concurrent_error_tracking(self):
        """Test error tracking with concurrent operations."""
        
        @handle_errors(component='concurrent', category='thread_error')
        def error_prone_task():
            raise NetworkError("Connection lost")
        
        with ThreadPoolExecutor(max_workers=4) as executor:
            futures = [executor.submit(error_prone_task) for _ in range(10)]
            results = [f.result() for f in futures]
        
        self.assertEqual(len(results), 10)
        self.assertTrue(all('error' in r.lower() for r in results))
        
        # Verify thread safety of error counting
        self.assertEqual(
            self.error_tracker.error_counts.get('concurrent.thread_error'),
            10
        )
    
    def test_03_recovery_chain_failure(self):
        """Test handling of recovery strategy chain failures."""
        
        @handle_errors(component='chain', category='chain_error')
        def failing_chain():
            raise MemoryError("Out of memory")
        
        # Mock recovery strategies to simulate cascading failures
        self.error_tracker._recover_memory = MagicMock(
            side_effect=TimeoutError("Recovery timed out")
        )
        
        result = failing_chain()
        self.assertIsInstance(result, str)
        self.assertIn('error', result.lower())
        
        # Verify both errors were tracked
        self.assertIn('chain.chain_error', self.error_tracker.error_counts)
    
    def test_04_max_retry_exhaustion(self):
        """Test behavior when max retries are exhausted."""
        
        @handle_errors(component='retry', category='critical')
        def retry_operation():
            raise APIError("Service unavailable")
        
        # Critical errors have max_retries=1
        result1 = retry_operation()  # First attempt
        result2 = retry_operation()  # Second attempt
        
        self.assertIsInstance(result1, str)
        self.assertIsInstance(result2, str)
        self.assertIn('error', result1.lower())
        self.assertIn('error', result2.lower())
        
        # Verify retry count
        self.assertEqual(
            self.error_tracker.recovery_attempts.get('retry.critical'),
            2
        )
    
    def test_05_component_health_threshold(self):
        """Test component health state transitions at threshold boundaries."""
        
        @handle_errors(component='health_test', category='threshold_error')
        def health_test():
            raise CommandError("Test error")
        
        # Get the threshold for this component
        threshold = self.error_tracker.thresholds.get('health_test', 
                                                    self.error_tracker.thresholds['default'])
        
        # Run up to threshold - 1
        for _ in range(threshold - 1):
            result = health_test()
            self.assertTrue(
                self.error_tracker.is_component_healthy('health_test')
            )
        
        # Run at threshold
        result = health_test()
        self.assertFalse(
            self.error_tracker.is_component_healthy('health_test')
        )
    
    def test_06_error_context_mutation(self):
        """Test handling of context dictionary mutations during recovery."""
        
        @handle_errors(component='context', category='mutation_error')
        def context_mutating_operation(context):
            context['mutated'] = True
            raise NetworkError("Connection failed")
        
        context = {'original': True}
        result = context_mutating_operation(context)
        
        self.assertIsInstance(result, str)
        self.assertIn('error', result.lower())
        self.assertTrue(context['original'])  # Original context preserved
        self.assertTrue(context.get('mutated'))  # Mutation visible

if __name__ == '__main__':
    unittest.main()