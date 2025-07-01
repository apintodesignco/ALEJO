"""
Integration tests for ALEJO microservices.
Tests interaction between Brain Service and Emotional Intelligence Service.
"""

import pytest
import asyncio
import aiohttp
import json
from unittest.mock import patch
from fastapi.testclient import TestClient

from alejo.services.brain_service import app as brain_app, BrainService
from alejo.services.emotional_intelligence_service import app as emotion_app, EmotionalIntelligenceService
from alejo.services.communication import ServiceCommunicator
import secrets  # More secure for cryptographic purposes

class TestMicroservicesIntegration:
    """Integration tests for microservices."""
    
    @pytest.fixture
    def brain_client(self):
        """Create test client for brain service."""
        return TestClient(brain_app)
        
    @pytest.fixture
    def emotion_client(self):
        """Create test client for emotional intelligence service."""
        return TestClient(emotion_app)
        
    @pytest.fixture
    def service_communicator(self):
        """Create service communicator for testing."""
        return ServiceCommunicator({
            "emotional_intelligence": "http://localhost:8001",
            "brain": "http://localhost:8000"
        })
        
    async def test_01_service_communication(self, brain_client, emotion_client):
        """Test basic communication between services."""
        # Test brain service health
        response = brain_client.get("/health")
        assert response.status_code == 200
        
        # Test emotional service health
        response = emotion_client.get("/health")
        assert response.status_code == 200
        
    async def test_02_sentiment_analysis_flow(self, brain_client, emotion_client):
        """Test sentiment analysis through services."""
        text = "I'm feeling very happy today!"
        
        # Get sentiment from emotional service
        response = emotion_client.post("/sentiment", json={"text": text})
        assert response.status_code == 200
        sentiment = response.json()
        assert "sentiment" in sentiment
        assert sentiment["sentiment"]["valence"] > 0
        
        # Process through brain service
        response = brain_client.post("/process", json={"user_input": text})
        assert response.status_code == 200
        result = response.json()
        assert "response" in result
        assert result["response"]
        
    async def test_03_ethical_evaluation_flow(self, brain_client, emotion_client):
        """Test ethical evaluation through services."""
        action = {
            "type": "share_data",
            "content": "user personal information",
            "target": "public"
        }
        
        # Get ethical evaluation from emotional service
        response = emotion_client.post("/ethical-evaluation", json=action)
        assert response.status_code == 200
        evaluation = response.json()
        assert "is_ethical" in evaluation
        assert not evaluation["is_ethical"]  # Should not be ethical to share personal info
        
        # Process through brain service
        response = brain_client.post("/process", 
                                   json={"user_input": "Share my personal information publicly"})
        assert response.status_code == 200
        result = response.json()
        assert "response" in result
        assert "privacy" in result["response"].lower()
        
    async def test_04_error_handling(self, brain_client, emotion_client):
        """Test error handling between services."""
        # Test invalid input to emotional service
        response = emotion_client.post("/sentiment", json={"text": ""})
        assert response.status_code in (400, 422)
        
        # Test invalid input to brain service
        response = brain_client.post("/process", json={"user_input": None})
        assert response.status_code in (400, 422)
        
        # Test service unavailability
        with patch('alejo.services.communication.ServiceCommunicator.call_emotional_service_sentiment') as mock_call:
            mock_call.side_effect = aiohttp.ClientError()
            response = brain_client.post("/process", 
                                       json={"user_input": "Test with service down"})
            assert response.status_code == 200  # Should still work with degraded functionality
            
    async def test_05_memory_persistence(self, brain_client):
        """Test memory persistence across service calls."""
        # Series of interactions
        interactions = [
            "My name is Alex",
            "I enjoy coding",
            "Remember I mentioned coding?"
        ]
        
        for text in interactions:
            response = brain_client.post("/process", json={"user_input": text})
            assert response.status_code == 200
            
        # Check memory through a query
        response = brain_client.post("/process", 
                                   json={"user_input": "What do I enjoy doing?"})
        assert response.status_code == 200
        result = response.json()
        assert "coding" in result["response"].lower()
        
    async def test_06_emotional_context_preservation(self, brain_client):
        """Test emotional context preservation across interactions."""
        # Establish positive emotional context
        response = brain_client.post("/process", 
                                   json={"user_input": "I'm really excited about this project!"})
        assert response.status_code == 200
        
        # Check if context affects next interaction
        response = brain_client.post("/process", 
                                   json={"user_input": "What's the next step?"})
        assert response.status_code == 200
        result = response.json()
        assert any(word in result["response"].lower() 
                  for word in ["excited", "enthusiasm", "positive"])
        
    async def test_07_concurrent_requests(self, brain_client, emotion_client):
        """Test handling of concurrent requests."""
        async def make_request(client, endpoint, data):
            async with aiohttp.ClientSession() as session:
                async with session.post(f"http://localhost:8000{endpoint}", json=data) as response:
                    return await response.json()
                    
        # Make multiple concurrent requests
        tasks = [
            make_request(brain_client, "/process", {"user_input": f"Test {i}"})
            for i in range(5)
        ]
        
        responses = await asyncio.gather(*tasks)
        assert len(responses) == 5
        assert all("response" in r for r in responses)
        
    async def test_08_service_recovery(self, brain_client, emotion_client, service_communicator):
        """Test service recovery after failures."""
        # Simulate emotional service failure
        with patch.object(service_communicator, 'call_emotional_service_sentiment') as mock_call:
            # First call fails
            mock_call.side_effect = [
                aiohttp.ClientError(),
                {"sentiment": {"valence": 0.8, "arousal": 0.5}}
            ]
            
            # Should handle failure gracefully
            response = brain_client.post("/process", 
                                       json={"user_input": "Test after failure"})
            assert response.status_code == 200
            
            # Second call should work
            response = brain_client.post("/process", 
                                       json={"user_input": "Test after recovery"})
            assert response.status_code == 200
            
    async def test_09_ethical_memory_integration(self, brain_client, emotion_client):
        """Test integration of ethical decisions with memory."""
        # Make an ethical decision
        action = {
            "type": "data_access",
            "content": "public information",
            "target": "authorized_user"
        }
        
        response = emotion_client.post("/ethical-evaluation", json=action)
        assert response.status_code == 200
        first_eval = response.json()
        
        # Store feedback
        feedback = {
            "decision_id": "test_decision",
            "feedback": {
                "accuracy": 0.9,
                "appropriateness": 0.8
            }
        }
        response = emotion_client.post("/feedback", json=feedback)
        assert response.status_code == 200
        
        # Make similar decision
        action["target"] = "another_authorized_user"
        response = emotion_client.post("/ethical-evaluation", json=action)
        assert response.status_code == 200
        second_eval = response.json()
        
        # Should show learning from feedback
        assert second_eval["score"] != first_eval["score"]
        
    async def test_10_service_metrics(self, brain_client, emotion_client):
        """Test service metrics and monitoring."""
        # Check brain service metrics
        response = brain_client.get("/metrics")
        assert response.status_code == 200
        metrics = response.json()
        assert "request_count" in metrics
        assert "error_count" in metrics
        assert "average_response_time" in metrics
        
        # Check emotional service metrics
        response = emotion_client.get("/metrics")
        assert response.status_code == 200
        metrics = response.json()
        assert "sentiment_analysis_count" in metrics
        assert "ethical_evaluation_count" in metrics