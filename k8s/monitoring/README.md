# ALEJO Monitoring and Service Mesh Setup

## Components

### Service Mesh (Istio)

1. Gateway configuration
2. Virtual services
3. mTLS policies
4. Traffic management
5. Circuit breakers

### Monitoring Stack

1. Prometheus
   - Metrics collection
   - Data storage
   - Query interface

2. Grafana
   - Dashboards
   - Alerting
   - Visualization

## Installation

1. Install Istio:

```bash
istioctl install --set profile=demo -y
kubectl label namespace alejo istio-injection=enabled
```

1. Create monitoring namespace:

```bash
kubectl create namespace monitoring
```

1. Deploy Prometheus:

```bash
kubectl apply -f monitoring/prometheus-config.yaml
kubectl apply -f monitoring/prometheus.yaml
```

1. Deploy Grafana:

```bash
kubectl apply -f monitoring/grafana.yaml
kubectl apply -f monitoring/grafana-dashboards.yaml
```

1. Apply Istio configurations:

```bash
kubectl apply -f istio/gateway.yaml
kubectl apply -f istio/policies.yaml
```

## Dashboards

1. ALEJO Overview
   - Service health
   - Response times
   - Error rates

2. Emotional Intelligence Metrics
   - Sentiment analysis accuracy
   - Response times
   - Processing rates

3. Brain Service Metrics
   - Memory usage
   - Command processing
   - System resources

## Monitoring

1. Access Grafana:

```bash
kubectl port-forward svc/grafana 3000:3000 -n monitoring
```

1. Access Prometheus:

```bash
kubectl port-forward svc/prometheus 9090:9090 -n monitoring
```

1. View service mesh metrics:

```bash
istioctl dashboard kiali
```

## Alerts

Configured alerts for:

1. High error rates
2. Service unavailability
3. Memory pressure
4. Response time degradation
5. Emotional analysis accuracy drops

## Troubleshooting

1. Check Istio proxy:

```bash
istioctl proxy-status
```text

2. Verify metrics collection:

```bash
curl <http://localhost:9090/api/v1/targets>
```text

3. Check Grafana datasources:

```bash
kubectl get configmap grafana-datasources -n monitoring -o yaml
```text

## Best Practices

1. Regular monitoring review
2. Alert threshold tuning
3. Dashboard optimization
4. Capacity planning
5. Performance analysis

## Maintenance

1. Update Istio:

```bash
istioctl upgrade
```text

2. Update monitoring stack:

```bash
kubectl apply -f monitoring/
```text

3. Backup Grafana:

```bash
kubectl cp monitoring/grafana-0:/var/lib/grafana ./grafana-backup
```text
