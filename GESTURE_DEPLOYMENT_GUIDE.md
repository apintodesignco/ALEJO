# ALEJO Gesture System Deployment Guide

## Overview

This guide provides detailed instructions for deploying the ALEJO gesture system in various environments. The gesture system enables intuitive, hands-free interaction through a WebSocket-based architecture, enhancing accessibility and user experience.

## Deployment Options

### 1. Docker Compose Deployment (Recommended)

The simplest way to deploy the complete ALEJO system with gesture support is using Docker Compose:

```bash
# Clone the repository
git clone https://github.com/apintodesignco/ALEJO.git
cd ALEJO

# Start the entire system
docker-compose up -d

# Or start only the gesture-related services
docker-compose up -d redis brain gesture_websocket
```

### 2. Standalone Deployment

For development or testing, you can run the gesture system standalone:

```bash
# Clone the repository
git clone https://github.com/apintodesignco/ALEJO.git
cd ALEJO

# Install dependencies
pip install -r requirements.txt

# Run the gesture system
python start_gesture_system.py
```

### 3. Production Deployment

For production environments, we recommend using Docker Compose with additional security measures:

```bash
# Set up environment variables
cp .env.example .env
# Edit .env to configure your production settings

# Start the system with production settings
ALEJO_ENV=production docker-compose up -d
```

## Configuration

### Environment Variables

The gesture system can be configured using the following environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `ALEJO_GESTURE_ENABLED` | `true` | Enable/disable the gesture system |
| `ALEJO_WEBSOCKET_PORT` | `8765` | Port for the WebSocket server |
| `ALEJO_ACCESSIBILITY_LEVEL` | `standard` | Accessibility level (`basic`, `standard`, `enhanced`) |
| `ALEJO_LOCAL_INFERENCE` | `1` | Use local inference for gesture processing |
| `ALEJO_REDIS_URL` | `redis://redis:6379/0` | Redis connection URL |
| `ALEJO_LOG_LEVEL` | `info` | Logging level (`debug`, `info`, `warning`, `error`) |

### Docker Compose Configuration

The gesture system is configured in the `docker-compose.yml` file:

```yaml
gesture_websocket:
  build:
    context: .
    dockerfile: Dockerfile
  ports:
    - "8765:8765"
  environment:
    - PYTHONPATH=/app
    - REDIS_URL=redis://redis:6379/0
    - ALEJO_WEBSOCKET_PORT=8765
    - ALEJO_GESTURE_ENABLED=true
  volumes:
    - .:/app
  depends_on:
    redis:
      condition: service_healthy
    brain:
      condition: service_healthy
  command: ["python", "-m", "alejo.handlers.gesture_websocket_handler"]
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8765/health"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 5s
```

## Deployment Validation

### 1. Automated Validation

We provide a comprehensive validation script to ensure your deployment is working correctly:

```bash
# Validate the default deployment
python validate_gesture_deployment.py

# Validate a custom deployment
python validate_gesture_deployment.py --ws-url=ws://your-host:8765 --web-url=http://your-host:8000 --redis-url=redis://your-host:6379/0
```

### 2. Docker Deployment Testing

For Docker-based deployments, use the Docker-specific test script:

```bash
# Test the Docker deployment
python test_gesture_docker.py

# Test with custom endpoints
python test_gesture_docker.py --ws-url=ws://your-host:8765 --health-url=http://your-host:8765/health
```

### 3. Manual Validation

To manually validate your deployment:

1. Access the gesture interface at `http://your-host:8000/gestures`
2. Check that the WebSocket server is running: `curl http://your-host:8765/health`
3. Test basic gesture recognition in the browser
4. Verify that accessibility features are working

## Troubleshooting

### Common Issues

#### WebSocket Connection Failures

If you're experiencing WebSocket connection issues:

```bash
# Check if the WebSocket server is running
docker-compose ps gesture_websocket

# Check the logs
docker-compose logs gesture_websocket

# Verify the port is accessible
curl http://localhost:8765/health
```

#### Redis Connection Issues

If the gesture system can't connect to Redis:

```bash
# Check if Redis is running
docker-compose ps redis

# Check Redis logs
docker-compose logs redis

# Test Redis connection
redis-cli -h localhost ping
```

#### Static File Access Problems

If static files aren't loading:

```bash
# Check if the files exist
ls -la alejo/static/js/gesture-controller.js

# Verify the web server is serving static files
curl http://localhost:8000/static/js/gesture-controller.js
```

## Security Considerations

### WebSocket Security

For production deployments, consider the following security measures:

1. **TLS Encryption**: Configure your reverse proxy (e.g., Nginx) to terminate TLS for WebSocket connections
2. **Authentication**: Implement token-based authentication for WebSocket connections
3. **Rate Limiting**: Configure rate limiting to prevent abuse
4. **Input Validation**: Ensure all gesture data is properly validated

### Example Nginx Configuration

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Web interface
    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSocket endpoint
    location /ws/ {
        proxy_pass http://localhost:8765;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

## Monitoring and Logging

### Log Collection

The gesture system logs to stdout/stderr, which can be collected by Docker or your logging system:

```bash
# View real-time logs
docker-compose logs -f gesture_websocket

# Export logs to a file
docker-compose logs gesture_websocket > gesture_logs.txt
```

### Health Monitoring

Set up health checks to monitor the gesture system:

```bash
# Check the health endpoint
curl http://localhost:8765/health

# Set up a cron job for monitoring
echo "*/5 * * * * curl -s http://localhost:8765/health > /dev/null || send-alert.sh" | crontab -
```

## Scaling

For high-traffic deployments, consider scaling the gesture system:

```bash
# Scale the gesture WebSocket service
docker-compose up -d --scale gesture_websocket=3

# Use a load balancer to distribute traffic
# Example HAProxy configuration in haproxy.cfg
```

## Conclusion

By following this deployment guide, you should have a fully functional ALEJO gesture system running in your environment. For additional support or questions, please refer to the [GESTURE_SYSTEM.md](./GESTURE_SYSTEM.md) documentation or open an issue on our GitHub repository.
