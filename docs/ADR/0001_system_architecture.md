# ADR 0001: Enhanced System Architecture for ALEJO

**Status:** Accepted

**Context:**

In order to ensure ALEJO operates reliably in production and supports advanced features such as distributed intelligence and dynamic service orchestration, we have re-architected its core communication and monitoring systems.

**Decision:**

1. **EventBus**: Adopt an asynchronous EventBus using Redis Pub/Sub for reliable inter-service messaging.
2. **HealthMonitor**: Implement a HealthMonitor to periodically check service health and automatically deregister unresponsive services.
3. **ServiceRegistry**: Establish a ServiceRegistry that maintains a centralized view of all active services and their health statuses.
4. **Observability**: Create an observability module that exposes metrics and system health via an API endpoint (using FastAPI).
5. **Brain Integration**: Update ALEJOBrain and other components to automatically self-register with the ServiceRegistry and intercommunicate via the EventBus.

**Consequences:**

- Improved system resilience and reliability through automatic failure detection and recovery.
- Enhanced observability for real-time monitoring and troubleshooting.
- Clear documentation of architectural decisions for current and future development.
