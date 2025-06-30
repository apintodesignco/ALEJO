# ALEJO Microservices Prototype

## Overview

This document outlines the prototype for transitioning ALEJO from a monolithic architecture to a microservices-based architecture. The goal is to improve scalability, maintainability, and deployment flexibility.

## Prototype Structure

The initial prototype focuses on separating two core components into independent services:

- **Brain Service**: Handles command interpretation, LLM interaction, and overall coordination.
- **Emotional Intelligence Service**: Manages emotional memory, sentiment analysis, empathetic responses, and ethical decision-making.

## Implementation Details

1. **Brain Service** (`brain_service.py`):
   - Provides an API endpoint for processing user input.
   - Internally uses `ALEJOBrain` for command processing.
   - Runs on port 8000 by default.

2. **Emotional Intelligence Service** (`emotional_intelligence_service.py`):
   - Provides API endpoints for sentiment analysis, empathetic response generation, and ethical evaluation.
   - Manages `EmotionalMemory`, `EmotionalProcessor`, and `EthicalFramework`.
   - Runs on port 8001 by default.

## Running the Services

- Both services are built using FastAPI and Uvicorn for HTTP server capabilities.
- Ensure dependencies are installed: `pip install fastapi uvicorn`.
- Run each service independently:
  - Brain Service: `python alejo/services/brain_service.py`
  - Emotional Intelligence Service: `python alejo/services/emotional_intelligence_service.py`

## Future Steps

- **Inter-Service Communication**: Implement a message queue (e.g., RabbitMQ or Kafka) or direct HTTP calls for communication between services.
- **Service Discovery**: Add a service registry or discovery mechanism for dynamic service location.
- **Deployment**: Create Docker containers for each service to facilitate deployment and scaling.
- **Testing**: Develop integration tests to ensure services work together seamlessly.

This prototype lays the foundation for a fully distributed architecture, allowing ALEJO to scale individual components based on demand.
