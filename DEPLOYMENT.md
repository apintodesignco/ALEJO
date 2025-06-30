# ALEJO Deployment Guide

## Prerequisites
- Docker
- Docker Compose
- Python 3.9+
- Redis (included in docker-compose)

## Environment Setup
1. Clone the repository
2. Set up environment variables:
   ```bash
   OPENAI_API_KEY=your_api_key
   REDIS_URL=redis://redis:6379/0
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
   ```

3. Access services at:
   - Brain Service: http://localhost:8000
   - Emotional Intelligence Service: http://localhost:8001

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
