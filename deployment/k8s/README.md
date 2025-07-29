# ALEJO Kubernetes Deployment

## Prerequisites

- Kubernetes 1.20+
- NVIDIA GPU operators (for GPU acceleration)

## Deployment Steps

```bash
kubectl apply -f alejo-deployment.yaml
```

## Verifying Deployment

```bash
kubectl get pods -l app=alejo
kubectl logs deployment/alejo-core
```
