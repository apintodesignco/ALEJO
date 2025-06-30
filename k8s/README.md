# ALEJO Kubernetes Deployment

## Architecture Overview
ALEJO runs as a set of microservices in Kubernetes:
- Brain Service (3+ replicas)
- Emotional Intelligence Service (3+ replicas)
- Redis for caching and pub/sub
- Ingress for external access

## Prerequisites
- Kubernetes cluster (1.19+)
- kubectl configured
- Helm 3
- cert-manager for TLS
- nginx-ingress controller

## Deployment Steps

1. Create namespace:
```bash
kubectl apply -f namespace.yaml
```

2. Create ConfigMap and Secrets:
```bash
# Create ConfigMap
kubectl apply -f configmap.yaml

# Create secrets (replace placeholders first)
kubectl create secret generic alejo-secrets \
  --from-literal=OPENAI_API_KEY='your-api-key' \
  --from-literal=DB_PASSWORD='your-db-password' \
  --from-literal=JWT_SECRET='your-jwt-secret' \
  -n alejo
```

3. Deploy Redis:
```bash
kubectl apply -f redis.yaml
```

4. Deploy services:
```bash
kubectl apply -f brain-service.yaml
kubectl apply -f emotional-service.yaml
```

5. Configure ingress:
```bash
kubectl apply -f ingress.yaml
```

## Monitoring

1. Check deployments:
```bash
kubectl get deployments -n alejo
```

2. Check pods:
```bash
kubectl get pods -n alejo
```

3. Check services:
```bash
kubectl get services -n alejo
```

4. View logs:
```bash
# Brain Service logs
kubectl logs -f deployment/brain-service -n alejo

# Emotional Service logs
kubectl logs -f deployment/emotional-service -n alejo
```

## Scaling

The services use Horizontal Pod Autoscaling:
- CPU threshold: 70%
- Memory threshold: 80%
- Min replicas: 3
- Max replicas: 10

Manual scaling:
```bash
kubectl scale deployment brain-service --replicas=5 -n alejo
kubectl scale deployment emotional-service --replicas=5 -n alejo
```

## Storage

Persistent volumes are used for:
- Redis data
- Brain Service data
- Emotional Service data

## Health Checks
Both services implement:
- Liveness probes
- Readiness probes
- Startup probes

## Security
1. Network policies
2. RBAC configuration
3. Secret management
4. TLS termination

## Troubleshooting

1. Check pod status:
```bash
kubectl describe pod <pod-name> -n alejo
```

2. Check service endpoints:
```bash
kubectl get endpoints -n alejo
```

3. Check ingress:
```bash
kubectl describe ingress alejo-ingress -n alejo
```

4. View container logs:
```bash
kubectl logs <pod-name> -c <container-name> -n alejo
```

## Maintenance

1. Update images:
```bash
kubectl set image deployment/brain-service \
  brain-service=${DOCKERHUB_USERNAME}/alejo-brain:new-tag -n alejo
```

2. Rollback:
```bash
kubectl rollout undo deployment/brain-service -n alejo
```

3. Check rollout status:
```bash
kubectl rollout status deployment/brain-service -n alejo
```
