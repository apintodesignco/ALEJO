"""
ALEJO Microservices Test Client

This script provides a simple way to test the ALEJO microservices by sending requests
to the Brain Service and Emotional Intelligence Service endpoints.
"""

import argparse
import requests
import json
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger("alejo.test_client")

# Default endpoints
BRAIN_ENDPOINT = "http://localhost:8000/process"
EMOTIONAL_SENTIMENT_ENDPOINT = "http://localhost:8001/sentiment"
EMOTIONAL_RESPONSE_ENDPOINT = "http://localhost:8001/response"
EMOTIONAL_ETHICAL_ENDPOINT = "http://localhost:8001/ethical-evaluation"

def test_brain_service(user_input, endpoint=BRAIN_ENDPOINT):
    """Test the Brain Service by sending user input"""
    logger.info(f"Sending request to Brain Service: {user_input}")
    try:
        response = requests.post(endpoint, json={"user_input": user_input}, timeout=10)
        response.raise_for_status()
        result = response.json()
        logger.info(f"Brain Service response: {result}")
        return result
    except requests.exceptions.RequestException as e:
        logger.error(f"Error communicating with Brain Service: {e}")
        return None

def test_emotional_sentiment(text, endpoint=EMOTIONAL_SENTIMENT_ENDPOINT):
    """Test the Emotional Intelligence Service sentiment analysis"""
    logger.info(f"Sending sentiment analysis request: {text}")
    try:
        response = requests.post(endpoint, json={"text": text}, timeout=10)
        response.raise_for_status()
        result = response.json()
        logger.info(f"Sentiment analysis response: {result}")
        return result
    except requests.exceptions.RequestException as e:
        logger.error(f"Error communicating with Emotional Intelligence Service (sentiment): {e}")
        return None

def test_emotional_response(text, endpoint=EMOTIONAL_RESPONSE_ENDPOINT):
    """Test the Emotional Intelligence Service empathetic response"""
    logger.info(f"Sending empathetic response request: {text}")
    try:
        response = requests.post(endpoint, json={"text": text}, timeout=10)
        response.raise_for_status()
        result = response.json()
        logger.info(f"Empathetic response: {result}")
        return result
    except requests.exceptions.RequestException as e:
        logger.error(f"Error communicating with Emotional Intelligence Service (response): {e}")
        return None

def test_emotional_ethical(action, context_json, endpoint=EMOTIONAL_ETHICAL_ENDPOINT):
    """Test the Emotional Intelligence Service ethical evaluation"""
    try:
        context = json.loads(context_json) if context_json else {}
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON for context: {e}")
        context = {}
    
    logger.info(f"Sending ethical evaluation request for action: {action}")
    try:
        response = requests.post(endpoint, json={"action": action, "context": context}, timeout=10)
        response.raise_for_status()
        result = response.json()
        logger.info(f"Ethical evaluation response: {result}")
        return result
    except requests.exceptions.RequestException as e:
        logger.error(f"Error communicating with Emotional Intelligence Service (ethical): {e}")
        return None

def main():
    parser = argparse.ArgumentParser(description="ALEJO Microservices Test Client")
    parser.add_argument("--brain", action="store_true", help="Test Brain Service")
    parser.add_argument("--sentiment", action="store_true", help="Test Emotional Intelligence Service - Sentiment Analysis")
    parser.add_argument("--response", action="store_true", help="Test Emotional Intelligence Service - Empathetic Response")
    parser.add_argument("--ethical", action="store_true", help="Test Emotional Intelligence Service - Ethical Evaluation")
    parser.add_argument("--all", action="store_true", help="Test all services")
    parser.add_argument("--input", type=str, default="Hello, how are you?", help="Input text for testing")
    parser.add_argument("--action", type=str, default="share user data", help="Action for ethical evaluation")
    parser.add_argument("--context", type=str, default='{"purpose": "marketing"}', help="Context JSON for ethical evaluation")
    parser.add_argument("--brain-endpoint", type=str, default=BRAIN_ENDPOINT, help="Endpoint for Brain Service")
    parser.add_argument("--sentiment-endpoint", type=str, default=EMOTIONAL_SENTIMENT_ENDPOINT, help="Endpoint for Sentiment Analysis")
    parser.add_argument("--response-endpoint", type=str, default=EMOTIONAL_RESPONSE_ENDPOINT, help="Endpoint for Empathetic Response")
    parser.add_argument("--ethical-endpoint", type=str, default=EMOTIONAL_ETHICAL_ENDPOINT, help="Endpoint for Ethical Evaluation")
    
    args = parser.parse_args()
    
    if args.all or args.brain:
        test_brain_service(args.input, args.brain_endpoint)
    
    if args.all or args.sentiment:
        test_emotional_sentiment(args.input, args.sentiment_endpoint)
    
    if args.all or args.response:
        test_emotional_response(args.input, args.response_endpoint)
    
    if args.all or args.ethical:
        test_emotional_ethical(args.action, args.context, args.ethical_endpoint)
    
    if not (args.all or args.brain or args.sentiment or args.response or args.ethical):
        parser.print_help()

if __name__ == "__main__":
    main()
