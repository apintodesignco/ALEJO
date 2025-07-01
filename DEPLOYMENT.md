# ALEJO Deployment Guide

## Overview

ALEJO is designed to be deployed as a collection of microservices that work together to provide a comprehensive AI platform. All inference is performed locally, ensuring privacy and control over your data.

## Prerequisites

- Docker
- Docker Compose
- Python 3.9+
- Minimum 16GB RAM (32GB recommended)
- 50GB disk space for models and data

## Quick Deployment

We've created a deployment script that handles all the complexities of deploying ALEJO. To use it:

```bash
# Deploy all services
python deploy.py deploy

# Check status
python deploy.py status

# Stop all services
python deploy.py stop
```

## Local Development

1. Build and start all services:

   ```bash
   docker-compose up --build
   ```

2. Individual services can be started with:

   ```bash
   # Brain Service
   docker-compose up brain

   # Emotional Intelligence Service
   docker-compose up emotional_intelligence
   
   # Gesture WebSocket Service
   docker-compose up gesture_websocket
   ```

## Gesture System Deployment

The ALEJO gesture system enables intuitive, hands-free interaction through a WebSocket-based architecture. To deploy and use the gesture system:

1. Ensure the gesture WebSocket service is running:

   ```bash
   docker-compose up gesture_websocket
   ```

2. Access the gesture demo interface at:

   [http://localhost:8000/gestures](http://localhost:8000/gestures)

3. Configure gesture settings in your environment file:

   ```bash
   # Gesture-related settings in .env
   ALEJO_GESTURE_ENABLED=true
   ALEJO_WEBSOCKET_PORT=8765
   ALEJO_ACCESSIBILITY_LEVEL=enhanced  # basic, standard, or enhanced
   ```

4. Enable/disable gesture features during runtime through the settings panel in the UI

## Testing the Gesture System

We've included a comprehensive testing suite for the gesture system to ensure it's working correctly in your environment:

1. Run the automated test script:

   ```bash
   python test_gesture_system.py
   ```

2. For custom WebSocket endpoints:

   ```bash
   python test_gesture_system.py --url=ws://your-host:port
   ```

3. Run the CI/CD test suite:

   ```bash
   # Unit tests for gesture components
   python -m pytest tests/unit/interaction/test_gesture_websocket.py -v
   
   # Integration tests for the WebSocket handler
   python -m pytest tests/integration/test_gesture_websocket.py -v
   
   # End-to-end tests for the complete gesture system
   python -m pytest tests/e2e/test_gesture_interface.py -v
   ```

4. For quick startup with all gesture components enabled:

   ```bash
   python start_gesture_system.py
   ```

## Service Access URLs

Access the various ALEJO services at these URLs:

- Main UI: [http://localhost:8000/ui](http://localhost:8000/ui)
- Gesture Interface: [http://localhost:8000/gestures](http://localhost:8000/gestures)
- Brain Service API: [http://localhost:8000](http://localhost:8000)
- Emotional Intelligence API: [http://localhost:8001](http://localhost:8001)
- Memory Service API: [http://localhost:8002](http://localhost:8002)
- Command Processor API: [http://localhost:8003](http://localhost:8003)
- Gesture WebSocket: [ws://localhost:8765](ws://localhost:8765)

## Health Checks
Both services expose health endpoints:
- Brain Service: http://localhost:8000/health
- Emotional Intelligence Service: http://localhost:8001/health

## Metrics
Monitor service performance at:
- Brain Service: http://localhost:8000/metrics
- Emotional Intelligence Service: http://localhost:8001/metrics

## Container Structure
- `Dockerfile.brain`: Brain service container
- `Dockerfile.emotional`: Emotional Intelligence service container
- `docker-compose.yml`: Service orchestration

## Service Dependencies
```
Redis
  ├── Brain Service
  └── Emotional Intelligence Service
```

## Volume Management
- `redis_data`: Redis persistence
- `emotional_data`: Emotional Intelligence data
- `memory_data`: Memory service data

## Scaling
To scale services horizontally:
```bash
docker-compose up --scale brain=2 --scale emotional_intelligence=2
```

## Monitoring
1. Service Health:
   ```bash
   docker-compose ps
   ```

2. Logs:
   ```bash
   # All services
   docker-compose logs -f

   # Specific service
   docker-compose logs -f brain
   docker-compose logs -f emotional_intelligence
   ```

## Troubleshooting
1. If services fail to start:
   ```bash
   docker-compose down
   docker-compose up --build
   ```

2. To reset data:
   ```bash
   docker-compose down -v
   docker-compose up --build
   ```

3. Check container status:
   ```bash
   docker ps
   docker inspect <container_id>
   ```

## Production Deployment
For production deployment:
1. Use proper SSL/TLS certificates
2. Configure proper authentication
3. Set up monitoring (e.g., Prometheus + Grafana)
4. Use container orchestration (e.g., Kubernetes)
5. Configure proper logging (e.g., ELK stack)
6. Set up CI/CD pipelines
