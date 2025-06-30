#!/usr/bin/env python
"""
ALEJO Performance Benchmarking Script

This script benchmarks the performance of ALEJO's AI components,
particularly focusing on memory usage, inference speed, and resource
optimization of the LocalLLMProvider and memory optimization modules.
"""

import os
import sys
import time
import asyncio
import argparse
import logging
import json
from pathlib import Path
from typing import Dict, List, Any, Optional

# Add project root to path
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(script_dir, '..'))
sys.path.insert(0, project_root)

# Import ALEJO modules
from alejo.utils.benchmarking import PerformanceBenchmark
from alejo.utils.memory_optimization import MemoryOptimizer, get_memory_optimizer
from alejo.llm_client.local_provider import LocalLLMProvider
from alejo.llm_client.factory import LLMClientFactory
from alejo.utils.performance import PerformanceMonitor

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("alejo.benchmark")

class ALEJOBenchmark:
    """
    Benchmark ALEJO components
    """
    
    def __init__(self, config_path: Optional[str] = None):
        """
        Initialize the benchmark
        
        Args:
            config_path: Path to configuration file
        """
        # Load configuration
        self.config = {}
        if config_path and os.path.exists(config_path):
            with open(config_path, 'r') as f:
                self.config = json.load(f)
        
        # Initialize components
        self.benchmark = PerformanceBenchmark()
        self.memory_optimizer = get_memory_optimizer(self.config.get('memory_optimization', {}))
        self.performance_monitor = PerformanceMonitor()
        
        # Get LLM provider
        self.llm_factory = LLMClientFactory()
        self.local_provider = self.llm_factory.get_local_provider()
        
        logger.info("ALEJO Benchmark initialized")
    
    async def benchmark_text_generation(self, prompt: str, iterations: int = 5):
        """
        Benchmark text generation
        
        Args:
            prompt: Text prompt
            iterations: Number of iterations
        """
        logger.info("Benchmarking text generation")
        
        # Define test function
        async def generate_text():
            return await self.local_provider.generate_text(prompt)
        
        # Run benchmark
        stats = await self.benchmark.benchmark_async_function(
            func=generate_text,
            iterations=iterations,
            warmup=1,
            name="text_generation"
        )
        
        return stats
    
    async def benchmark_chat_response(self, messages: List[Dict[str, str]], iterations: int = 5):
        """
        Benchmark chat response
        
        Args:
            messages: List of messages
            iterations: Number of iterations
        """
        logger.info("Benchmarking chat response")
        
        # Define test function
        async def generate_chat():
            return await self.local_provider.generate_chat_response(messages)
        
        # Run benchmark
        stats = await self.benchmark.benchmark_async_function(
            func=generate_chat,
            iterations=iterations,
            warmup=1,
            name="chat_response"
        )
        
        return stats
    
    async def benchmark_embeddings(self, text: str, iterations: int = 10):
        """
        Benchmark embeddings
        
        Args:
            text: Text to embed
            iterations: Number of iterations
        """
        logger.info("Benchmarking embeddings")
        
        # Define test function
        async def generate_embedding():
            return await self.local_provider.generate_embeddings(text)
        
        # Run benchmark
        stats = await self.benchmark.benchmark_async_function(
            func=generate_embedding,
            iterations=iterations,
            warmup=1,
            name="embeddings"
        )
        
        return stats
    
    def benchmark_memory_optimization(self, iterations: int = 10):
        """
        Benchmark memory optimization
        
        Args:
            iterations: Number of iterations
        """
        logger.info("Benchmarking memory optimization")
        
        # Create mock models
        class MockModel:
            def __init__(self, name, size_mb=100):
                self.name = name
                self.data = bytearray(size_mb * 1024 * 1024)  # Allocate memory
        
        # Define test function
        def register_and_unload():
            # Register models
            for i in range(5):
                model = MockModel(f"model_{i}")
                self.memory_optimizer.register_model(f"model_{i}", model)
            
            # Mark one model as used
            self.memory_optimizer.mark_model_used("model_0")
            
            # Trigger cleanup
            self.memory_optimizer._cleanup_unused_models(aggressive=True)
            
            # Check results
            active_models = list(self.memory_optimizer._active_models.keys())
            return len(active_models)
        
        # Run benchmark
        stats = self.benchmark.benchmark_function(
            func=register_and_unload,
            iterations=iterations,
            warmup=1,
            name="memory_optimization"
        )
        
        return stats
    
    def benchmark_cache_performance(self, iterations: int = 100):
        """
        Benchmark cache performance
        
        Args:
            iterations: Number of iterations
        """
        logger.info("Benchmarking cache performance")
        
        # Define test function
        def cache_operations():
            # Cache a result
            key = f"test_key_{time.time()}"
            self.memory_optimizer.cache_result(key, "test_result", ttl_seconds=60)
            
            # Get cached result
            result = self.memory_optimizer.get_cached_result(key)
            
            # Cleanup cache
            self.memory_optimizer._cleanup_cache()
            
            return result == "test_result"
        
        # Run benchmark
        stats = self.benchmark.benchmark_function(
            func=cache_operations,
            iterations=iterations,
            warmup=5,
            name="cache_performance"
        )
        
        return stats
    
    async def run_all_benchmarks(self):
        """
        Run all benchmarks
        """
        logger.info("Running all benchmarks")
        
        # Text generation benchmark
        prompt = "Explain the concept of artificial intelligence in simple terms."
        await self.benchmark_text_generation(prompt)
        
        # Chat response benchmark
        messages = [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "What is the capital of France?"}
        ]
        await self.benchmark_chat_response(messages)
        
        # Embeddings benchmark
        text = "This is a test sentence for embedding generation."
        await self.benchmark_embeddings(text)
        
        # Memory optimization benchmark
        self.benchmark_memory_optimization()
        
        # Cache performance benchmark
        self.benchmark_cache_performance()
        
        # Generate report
        timestamp = int(time.time())
        report_path = os.path.join(project_root, "benchmark_results", f"benchmark_{timestamp}.json")
        os.makedirs(os.path.dirname(report_path), exist_ok=True)
        
        report = self.benchmark.generate_report(report_path)
        
        logger.info(f"All benchmarks completed. Report saved to {report_path}")
        
        return report

async def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="ALEJO Performance Benchmark")
    parser.add_argument(
        "--config",
        type=str,
        default=None,
        help="Path to configuration file"
    )
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="Path to output report file"
    )
    
    args = parser.parse_args()
    
    # Create benchmark
    benchmark = ALEJOBenchmark(args.config)
    
    # Run benchmarks
    report = await benchmark.run_all_benchmarks()
    
    # Save report to specified output if provided
    if args.output:
        os.makedirs(os.path.dirname(args.output), exist_ok=True)
        with open(args.output, 'w') as f:
            json.dump(report, f, indent=2)
        logger.info(f"Report saved to {args.output}")

if __name__ == "__main__":
    asyncio.run(main())
