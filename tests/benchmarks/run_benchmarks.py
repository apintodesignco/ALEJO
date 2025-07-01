"""
ALEJO System-Wide Benchmark Runner
Executes all benchmarks and generates a comprehensive performance report
"""

import os
import asyncio
import time
import json
import logging
from datetime import datetime
from typing import Dict, Any, List
import matplotlib.pyplot as plt
import seaborn as sns
import pandas as pd

from .benchmark_framework import Benchmarker, BenchmarkResult
from .test_vision_benchmarks import TestVisionBenchmarks
from .test_emotional_benchmarks import TestEmotionalBenchmarks
from .test_brain_benchmarks import TestBrainBenchmarks
import secrets  # More secure for cryptographic purposes

logger = logging.getLogger(__name__)

class BenchmarkRunner:
    """Runs all benchmarks and generates reports"""
    
    def __init__(self):
        self.benchmarker = Benchmarker()
        self.results_dir = os.path.join(
            os.path.dirname(__file__),
            'results'
        )
        os.makedirs(self.results_dir, exist_ok=True)
    
    async def run_all_benchmarks(self) -> Dict[str, List[BenchmarkResult]]:
        """Run all benchmark tests"""
        logger.info("Starting system-wide benchmark run...")
        start_time = time.time()
        
        # Run all benchmark classes
        test_classes = [
            TestVisionBenchmarks(),
            TestEmotionalBenchmarks(),
            TestBrainBenchmarks()
        ]
        
        all_results = {}
        for test_class in test_classes:
            class_name = test_class.__class__.__name__
            logger.info(f"Running {class_name}...")
            
            # Get all test methods
            test_methods = [
                method for method in dir(test_class)
                if method.startswith('test_')
            ]
            
            # Run each test
            class_results = []
            for method in test_methods:
                try:
                    test_func = getattr(test_class, method)
                    result = await test_func()
                    if isinstance(result, BenchmarkResult):
                        class_results.append(result)
                except Exception as e:
                    logger.error(f"Error running {method}: {e}")
            
            all_results[class_name] = class_results
        
        total_time = time.time() - start_time
        logger.info(f"Completed all benchmarks in {total_time:.2f}s")
        
        return all_results
    
    def generate_report(self, results: Dict[str, List[BenchmarkResult]]):
        """Generate comprehensive benchmark report"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_dir = os.path.join(self.results_dir, timestamp)
        os.makedirs(report_dir, exist_ok=True)
        
        # Convert results to DataFrame for analysis
        records = []
        for class_name, class_results in results.items():
            for result in class_results:
                record = {
                    'class': class_name,
                    'name': result.name,
                    'operation': result.operation,
                    'mean_time': result.mean_time,
                    'std_dev': result.std_dev,
                    'memory_usage': result.memory_usage,
                    'cpu_usage': result.cpu_usage,
                    'gpu_usage': result.gpu_usage,
                    'batch_size': result.batch_size
                }
                records.append(record)
        
        df = pd.DataFrame(records)
        
        # Generate plots
        self._plot_timing_distribution(df, report_dir)
        self._plot_resource_usage(df, report_dir)
        self._plot_batch_performance(df, report_dir)
        
        # Generate summary statistics
        summary = {
            'timestamp': timestamp,
            'total_tests': len(records),
            'timing_summary': {
                'mean': df['mean_time'].mean(),
                'std': df['mean_time'].std(),
                'min': df['mean_time'].min(),
                'max': df['mean_time'].max()
            },
            'resource_summary': {
                'mean_memory': df['memory_usage'].mean(),
                'mean_cpu': df['cpu_usage'].mean(),
                'mean_gpu': df['gpu_usage'].mean() if 'gpu_usage' in df else None
            },
            'class_summaries': {}
        }
        
        # Add per-class summaries
        for class_name in df['class'].unique():
            class_df = df[df['class'] == class_name]
            summary['class_summaries'][class_name] = {
                'test_count': len(class_df),
                'mean_time': class_df['mean_time'].mean(),
                'mean_memory': class_df['memory_usage'].mean()
            }
        
        # Save summary
        with open(os.path.join(report_dir, 'summary.json'), 'w') as f:
            json.dump(summary, f, indent=2)
        
        # Save raw results
        df.to_csv(os.path.join(report_dir, 'raw_results.csv'))
        
        return report_dir
    
    def _plot_timing_distribution(self, df: pd.DataFrame, report_dir: str):
        """Plot timing distribution across components"""
        plt.figure(figsize=(12, 6))
        sns.boxplot(data=df, x='class', y='mean_time')
        plt.title('Operation Timing Distribution by Component')
        plt.xticks(rotation=45)
        plt.tight_layout()
        plt.savefig(os.path.join(report_dir, 'timing_distribution.png'))
        plt.close()
    
    def _plot_resource_usage(self, df: pd.DataFrame, report_dir: str):
        """Plot resource usage patterns"""
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(15, 6))
        
        # Memory usage
        sns.barplot(data=df, x='class', y='memory_usage', ax=ax1)
        ax1.set_title('Memory Usage by Component')
        ax1.set_xticklabels(ax1.get_xticklabels(), rotation=45)
        
        # CPU usage
        sns.barplot(data=df, x='class', y='cpu_usage', ax=ax2)
        ax2.set_title('CPU Usage by Component')
        ax2.set_xticklabels(ax2.get_xticklabels(), rotation=45)
        
        plt.tight_layout()
        plt.savefig(os.path.join(report_dir, 'resource_usage.png'))
        plt.close()
    
    def _plot_batch_performance(self, df: pd.DataFrame, report_dir: str):
        """Plot batch processing performance"""
        batch_df = df[df['batch_size'].notna()]
        if len(batch_df) > 0:
            plt.figure(figsize=(10, 6))
            sns.lineplot(
                data=batch_df,
                x='batch_size',
                y='mean_time',
                hue='operation'
            )
            plt.title('Batch Processing Performance')
            plt.xlabel('Batch Size')
            plt.ylabel('Mean Processing Time (s)')
            plt.tight_layout()
            plt.savefig(os.path.join(report_dir, 'batch_performance.png'))
            plt.close()

async def main():
    """Run all benchmarks and generate report"""
    runner = BenchmarkRunner()
    results = await runner.run_all_benchmarks()
    report_dir = runner.generate_report(results)
    logger.info(f"Benchmark report generated in: {report_dir}")

if __name__ == "__main__":
    asyncio.run(main())