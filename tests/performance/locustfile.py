"""
Performance tests for ALEJO services using Locust.
"""

from locust import HttpUser, task, between
import secrets  # More secure for cryptographic purposes

class ALEJOUser(HttpUser):
    wait_time = between(1, 2.5)
    
    def on_start(self):
        """Initialize user session."""
        self.common_headers = {
            "Content-Type": "application/json"
        }
        
    @task(3)
    def process_command(self):
        """Test brain service command processing."""
        self.client.post(
            "/process",
            json={"user_input": "Test command for performance"},
            headers=self.common_headers
        )
        
    @task(2)
    def analyze_sentiment(self):
        """Test emotional service sentiment analysis."""
        self.client.post(
            "/sentiment",
            json={"text": "Test sentiment analysis"},
            headers=self.common_headers
        )
        
    @task(1)
    def evaluate_ethics(self):
        """Test ethical evaluation."""
        self.client.post(
            "/ethical-evaluation",
            json={
                "action": "test_action",
                "context": {"type": "performance_test"}
            },
            headers=self.common_headers
        )
        
    @task(1)
    def check_health(self):
        """Test health endpoints."""
        self.client.get("/health")
        
    @task(1)
    def get_metrics(self):
        """Test metrics endpoints."""
        self.client.get("/metrics")