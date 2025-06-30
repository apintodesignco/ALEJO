"""
Performance and load testing for ALEJO components
"""

import unittest
import os
import sys
import time
import threading
import queue
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch, MagicMock
from pathlib import Path

# Add project root to Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from alejo.brain import ALEJOBrain
from alejo.utils.exceptions import (
    CommandError, VoiceRecognitionError, LLMServiceError
)

class TestALEJOPerformance(unittest.TestCase):
    """Test suite for ALEJO performance characteristics."""
    
    def setUp(self):
        """Set up test environment."""
        os.environ["ALEJO_LOCAL_INFERENCE"] = "1"
        self.mock_LocalLLM = patch('alejo.llm_client.local_client.LocalLLMClient').start()
        self.mock_instance = MagicMock()
        self.mock_LocalLLM.return_value = self.mock_instance
        self.brain = ALEJOBrain()
        
    def tearDown(self):
        """Clean up test environment."""
        if "ALEJO_LOCAL_INFERENCE" in os.environ:
            del os.environ["ALEJO_LOCAL_INFERENCE"]
        patch.stopall()

    def test_01_command_throughput(self):
        """Test command processing throughput."""
        # Configure mock responses
        self.mock_instance.chat.completions.create.return_value.choices[0].message.content = (
            '{"command": "test", "args": {}}'
        )
        
        # Process commands in rapid succession
        start_time = time.time()
        num_commands = 100
        
        for _ in range(num_commands):
            self.brain.process_command("test command")
            
        duration = time.time() - start_time
        
        # Calculate throughput
        throughput = num_commands / duration
        
        # Should handle at least 10 commands per second
        self.assertGreater(throughput, 10.0)

    def test_02_concurrent_command_processing(self):
        """Test concurrent command processing capability."""
        # Configure mock responses
        self.mock_instance.chat.completions.create.return_value.choices[0].message.content = (
            '{"command": "test", "args": {}}'
        )
        
        num_threads = 10
        num_commands_per_thread = 10
        results = queue.Queue()
        
        def process_commands():
            thread_results = []
            for _ in range(num_commands_per_thread):
                try:
                    result = self.brain.process_command("test command")
                    thread_results.append(result)
                except Exception as e:
                    thread_results.append(str(e))
            results.put(thread_results)
        
        # Create and start threads
        threads = []
        for _ in range(num_threads):
            thread = threading.Thread(target=process_commands)
            threads.append(thread)
            thread.start()
        
        # Wait for completion
        for thread in threads:
            thread.join()
        
        # Collect results
        all_results = []
        while not results.empty():
            all_results.extend(results.get())
        
        # Verify all commands were processed
        self.assertEqual(len(all_results), num_threads * num_commands_per_thread)

    def test_03_memory_stability(self):
        """Test memory usage stability under load."""
        import psutil
        process = psutil.Process()
        initial_memory = process.memory_info().rss
        
        # Configure mock responses
        self.mock_instance.chat.completions.create.return_value.choices[0].message.content = (
            '{"command": "test", "args": {}}'
        )
        
        # Process many commands
        num_iterations = 1000
        for _ in range(num_iterations):
            self.brain.process_command("test command")
        
        # Check memory usage
        final_memory = process.memory_info().rss
        memory_growth = final_memory - initial_memory
        
        # Memory growth should be reasonable
        max_allowed_growth = 50 * 1024 * 1024  # 50MB
        self.assertLess(memory_growth, max_allowed_growth)

    def test_04_voice_processing_performance(self):
        """Test voice processing performance."""
        # Configure mock responses
        self.mock_instance.audio.transcriptions.create.return_value = "test command"
        self.mock_instance.chat.completions.create.return_value.choices[0].message.content = (
            '{"command": "test", "args": {}}'
        )
        
        # Process voice commands
        test_audio = b"test audio data"
        num_commands = 50
        start_time = time.time()
        
        for _ in range(num_commands):
            self.brain.process_voice(test_audio)
            
        duration = time.time() - start_time
        
        # Calculate throughput
        throughput = num_commands / duration
        
        # Should handle at least 5 voice commands per second
        self.assertGreater(throughput, 5.0)

    def test_05_error_handling_under_load(self):
        """Test error handling performance under load."""
        def process_with_errors():
            try:
                if time.time() % 2 == 0:
                    raise LLMServiceError("Test error")
                return "success"
            except Exception as e:
                return str(e)
        
        # Process many operations with frequent errors
        num_operations = 1000
        start_time = time.time()
        
        with ThreadPoolExecutor(max_workers=4) as executor:
            results = list(executor.map(lambda _: process_with_errors(), range(num_operations)))
        
        duration = time.time() - start_time
        
        # Calculate error handling throughput
        throughput = num_operations / duration
        
        # Should handle at least 100 operations per second even with errors
        self.assertGreater(throughput, 100.0)
        
        # Verify results
        self.assertEqual(len(results), num_operations)

    def test_06_response_time_distribution(self):
        """Test response time distribution."""
        # Configure mock responses
        self.mock_instance.chat.completions.create.return_value.choices[0].message.content = (
            '{"command": "test", "args": {}}'
        )
        
        response_times = []
        num_requests = 100
        
        for _ in range(num_requests):
            start_time = time.time()
            self.brain.process_command("test command")
            response_times.append(time.time() - start_time)
        
        # Calculate statistics
        avg_response_time = sum(response_times) / len(response_times)
        sorted_times = sorted(response_times)
        p95_response_time = sorted_times[int(0.95 * len(sorted_times))]
        
        # Average response time should be under 100ms
        self.assertLess(avg_response_time, 0.1)
        
        # 95th percentile should be under 200ms
        self.assertLess(p95_response_time, 0.2)
