"""
ALEJO Microservices Health Check

This script checks the health status of ALEJO microservices by attempting to
connect to their endpoints and reporting availability.
"""

import argparse
import requests
import logging
import time

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger("alejo.health_check")

# Default endpoints for health checks (adjust if you have specific health endpoints)
BRAIN_ENDPOINT = "http://localhost:8000/process"
EMOTIONAL_ENDPOINT = "http://localhost:8001/sentiment"

def check_service_health(endpoint, service_name, timeout=5):
    """Check if a service is responsive by sending a simple request"""
    logger.info(f"Checking health of {service_name} at {endpoint}")
    try:
        # For a proper health check, services should have a dedicated /health endpoint
        # This is a simple test that attempts a basic request
        response = requests.post(endpoint, json={"user_input": "test", "text": "test"}, timeout=timeout)
        if response.status_code == 200:
            logger.info(f"{service_name} is UP and responsive")
            return True
        else:
            logger.warning(f"{service_name} responded with status code {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        logger.error(f"{service_name} is DOWN or not responsive: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description="ALEJO Microservices Health Check")
    parser.add_argument("--brain-endpoint", type=str, default=BRAIN_ENDPOINT, help="Endpoint for Brain Service")
    parser.add_argument("--emotional-endpoint", type=str, default=EMOTIONAL_ENDPOINT, help="Endpoint for Emotional Intelligence Service")
    parser.add_argument("--timeout", type=int, default=5, help="Timeout in seconds for health checks")
    parser.add_argument("--retries", type=int, default=3, help="Number of retries for health checks")
    parser.add_argument("--retry-delay", type=float, default=2.0, help="Delay between retries in seconds")
    args = parser.parse_args()
    
    services = [
        ("Brain Service", args.brain_endpoint),
        ("Emotional Intelligence Service", args.emotional_endpoint)
    ]
    
    all_healthy = True
    
    for service_name, endpoint in services:
        healthy = False
        for attempt in range(args.retries):
            if check_service_health(endpoint, service_name, args.timeout):
                healthy = True
                break
            else:
                logger.warning(f"Retry {attempt+1}/{args.retries} for {service_name}")
                time.sleep(args.retry_delay)
        
        if not healthy:
            all_healthy = False
            logger.error(f"{service_name} failed health check after {args.retries} attempts")
    
    if all_healthy:
        logger.info("All ALEJO services are healthy!")
    else:
        logger.error("Some ALEJO services failed health checks")
        exit(1)

if __name__ == "__main__":
    main()