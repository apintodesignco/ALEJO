"""
Performance metrics tracking for ALEJO error handling
"""

import time
import statistics
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from collections import defaultdict

class ErrorMetrics:
    """Tracks performance metrics for error handling and recovery."""
    
    def __init__(self):
        self.recovery_times: Dict[str, List[float]] = defaultdict(list)
        self.success_rates: Dict[str, List[bool]] = defaultdict(list)
        self.error_frequencies: Dict[str, List[datetime]] = defaultdict(list)
        self.recovery_costs: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    
    def record_recovery_time(self, component: str, strategy: str, duration: float):
        """Record the time taken for a recovery attempt."""
        key = f"{component}.{strategy}"
        self.recovery_times[key].append(duration)
    
    def record_recovery_result(self, component: str, strategy: str, success: bool):
        """Record whether a recovery attempt was successful."""
        key = f"{component}.{strategy}"
        self.success_rates[key].append(success)
    
    def record_error_occurrence(self, component: str, error_type: str):
        """Record when an error occurred."""
        key = f"{component}.{error_type}"
        self.error_frequencies[key].append(datetime.now())
    
    def record_recovery_cost(self, component: str, strategy: str, 
                           resources: Dict[str, Any]):
        """Record resources used during recovery."""
        key = f"{component}.{strategy}"
        self.recovery_costs[key].append(resources)
    
    def get_average_recovery_time(self, component: str, 
                                strategy: str) -> Optional[float]:
        """Get average recovery time for a component/strategy."""
        key = f"{component}.{strategy}"
        times = self.recovery_times.get(key, [])
        return statistics.mean(times) if times else None
    
    def get_success_rate(self, component: str, strategy: str) -> Optional[float]:
        """Get success rate for a component/strategy."""
        key = f"{component}.{strategy}"
        results = self.success_rates.get(key, [])
        if not results:
            return None
        return sum(1 for r in results if r) / len(results)
    
    def get_error_frequency(self, component: str, error_type: str,
                          window: timedelta = timedelta(hours=1)) -> int:
        """Get error frequency within time window."""
        key = f"{component}.{error_type}"
        times = self.error_frequencies.get(key, [])
        cutoff = datetime.now() - window
        return sum(1 for t in times if t > cutoff)
    
    def get_average_resource_usage(self, component: str,
                                 strategy: str) -> Dict[str, float]:
        """Get average resource usage for recovery attempts."""
        key = f"{component}.{strategy}"
        costs = self.recovery_costs.get(key, [])
        if not costs:
            return {}
        
        # Calculate averages for each resource type
        totals: Dict[str, float] = defaultdict(float)
        for cost in costs:
            for resource, value in cost.items():
                totals[resource] += value
        
        return {k: v / len(costs) for k, v in totals.items()}
    
    def get_performance_report(self) -> Dict[str, Any]:
        """Generate comprehensive performance report."""
        report = {
            'recovery_metrics': {},
            'error_frequencies': {},
            'resource_usage': {},
            'overall_stats': {
                'total_errors': sum(len(f) for f in self.error_frequencies.values()),
                'total_recoveries': sum(len(t) for t in self.recovery_times.values()),
                'overall_success_rate': None
            }
        }
        
        # Calculate overall success rate
        all_results = [r for results in self.success_rates.values() for r in results]
        if all_results:
            report['overall_stats']['overall_success_rate'] = (
                sum(1 for r in all_results if r) / len(all_results)
            )
        
        # Add component-specific metrics
        for key in self.recovery_times:
            component, strategy = key.split('.')
            report['recovery_metrics'][key] = {
                'avg_recovery_time': self.get_average_recovery_time(
                    component, strategy
                ),
                'success_rate': self.get_success_rate(component, strategy),
                'sample_size': len(self.recovery_times[key])
            }
        
        return report

# Singleton instance
_metrics_instance = None

def get_metrics() -> ErrorMetrics:
    """Get or create the metrics tracker instance."""
    global _metrics_instance
    if _metrics_instance is None:
        _metrics_instance = ErrorMetrics()
    return _metrics_instance
