# Running ALEJO Microservices

## Overview

This document provides instructions for running ALEJO's microservices architecture, which splits functionality into independent, scalable components.

## Prerequisites

Before running the services, ensure you have the necessary dependencies installed:

```bash
pip install fastapi uvicorn requests
```text

## Available Services

ALEJO currently has two primary microservices:

- **Brain Service**: Handles core command processing and coordination (default port: 8000)
- **Emotional Intelligence Service**: Manages sentiment analysis, empathetic responses, and ethical decisions (default port: 8001)

## Running Individual Services

You can run each service independently using the following commands from the project root directory:

```bash

# Run Brain Service (default port 8000)

python alejo/services/brain_service.py

# Run Emotional Intelligence Service (default port 8001)

python alejo/services/emotional_intelligence_service.py
```text

To specify custom host or port values:

```bash

# Run Brain Service on a custom port

python alejo/services/brain_service.py --host 0.0.0.0 --port 9000

# Run Emotional Intelligence Service on a custom port

python alejo/services/emotional_intelligence_service.py --host 0.0.0.0 --port 9001
```text

## Running All Services at Once

For convenience during development, you can use the `run_services.py` script to launch all services simultaneously:

```bash
python run_services.py
```text

This script starts each service in a separate process and monitors their output. Use Ctrl+C to stop all services gracefully.

## Verifying Services are Running

Once the services are started, you can verify they are running by accessing their API endpoints:

- Brain Service: `<http://localhost:8000/docs`> (Swagger UI for API documentation)
- Emotional Intelligence Service: `<http://localhost:8001/docs`> (Swagger UI for API documentation)

Alternatively, use a tool like `curl` or Postman to send test requests to the services.

## Troubleshooting

- **Port Conflict**: If a port is already in use, you'll see an error message. Use the `--port` argument to specify a different port.
- **Dependencies**: Ensure all required packages are installed. Check the console output for import errors.
- **Logs**: Check the console output for detailed logs from each service. The runner script prefixes each log line with the service name.

## Inter-Service Communication

The services communicate with each other using HTTP requests. The `ServiceCommunicator` class handles this communication, automatically retrying failed requests up to 3 times.

If you encounter communication issues between services, ensure both services are running and accessible at their configured endpoints.
