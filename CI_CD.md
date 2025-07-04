# ALEJO CI/CD Pipeline

## Overview

This document describes the Continuous Integration and Continuous Deployment (CI/CD) pipeline for ALEJO.

## Pipeline Stages

### 1. Test Stage

- Runs all unit tests
- Runs integration tests
- Checks code coverage (minimum 80%)
- Uses Redis service container for tests
- Environment:
  - Python 3.9
  - Ubuntu latest

### 2. Code Quality Stage

- Linting with flake8
- Code formatting with black
- Import sorting with isort
- Type checking with mypy

### 3. Docker Stage

- Builds Docker images for both services
- Pushes to Docker Hub
- Uses build cache for faster builds
- Tags:
  - latest
  - commit SHA

### 4. Deployment Stage

- Deploys to AWS ECS
- Updates services with zero downtime
- Requires AWS credentials

## Development Workflow

### Pull Request Validation

1. Code validation
   - Formatting checks
   - Linting
   - Tests
   - Coverage

2. Docker validation
   - Builds images
   - Runs integration tests

3. Security scan
   - Snyk vulnerability scanning

4. Performance check
   - Load testing with Locust
   - 10 users, 2 spawn rate

5. Preview deployment
   - Deploys to preview environment
   - Comments preview URL on PR

## Required Secrets

- `OPENAI_API_KEY`: OpenAI API key
- `DOCKERHUB_USERNAME`: Docker Hub username
- `DOCKERHUB_TOKEN`: Docker Hub access token
- `AWS_ACCESS_KEY_ID`: AWS access key
- `AWS_SECRET_ACCESS_KEY`: AWS secret key
- `SNYK_TOKEN`: Snyk security scanning token

## Environments

### Production

- AWS ECS cluster: alejo-cluster
- Services:
  - alejo-brain
  - alejo-emotional

### Preview

- AWS ECS cluster: alejo-preview
- Dynamic service names based on PR number
- Temporary deployments

## Monitoring

- Service health checks
- Performance metrics
- AWS CloudWatch integration

## Security

- Vulnerability scanning
- Dependency updates
- Access control
- Secret management

## Best Practices

1. Keep main branch always deployable
2. Use feature branches
3. Write comprehensive tests
4. Document changes
5. Review code
6. Monitor deployments

## Troubleshooting

1. Failed tests

   ```bash
   # Run tests locally
   pytest tests/ -v
   ```

2. Failed builds

   ```bash
   # Build locally
   docker-compose build
   ```

3. Failed deployments

   ```bash
   # Check ECS service status
   aws ecs describe-services --cluster alejo-cluster --services alejo-brain alejo-emotional
   ```
