# ALEJO Preference System Documentation

## Overview

The ALEJO Preference System is a robust personalization engine that learns user preferences implicitly through interactions and explicitly through direct settings. The system has been enhanced with several resilience and performance features:

1. **Circuit Breaker Pattern** - Prevents cascading failures when external systems (like relationship memory) are unavailable
2. **Caching Layer** - Improves performance by caching frequently accessed data
3. **Preference Normalization** - Maintains consistent preference distributions over time
4. **Comprehensive Telemetry** - Provides detailed insights into system performance and errors

## Architecture

The preference system consists of the following key components:

```
src/personalization/behavior/
├── preference-model.js           # Core preference learning and storage
├── preference-relationship-integration.js  # Integration with relationship memory
├── preference-normalization.js   # Preference strength normalization
├── preference-normalization-scheduler.js   # Scheduled normalization tasks
└── preference-system-init.js     # System initialization and configuration

src/utils/
├── circuit-breaker.js            # Circuit breaker implementation
├── cache-manager.js              # Caching infrastructure
├── audit-trail.js                # Telemetry and logging
└── queue-manager.js              # Retry queue for failed operations
```

## Key Features

### 1. Circuit Breaker Pattern

The circuit breaker pattern prevents cascading failures by detecting when external systems are unavailable and temporarily halting requests to those systems.

- **States**: CLOSED (normal operation), OPEN (failing, no requests sent), HALF-OPEN (testing if system recovered)
- **Configuration**: Adjustable failure thresholds, reset timeouts, and success thresholds
- **Telemetry**: Detailed logging of state changes and failures
- **Registry**: Central tracking of all circuit breakers in the system

```javascript
// Example usage
const result = await relationshipCircuitBreaker.execute(async () => {
  // Call to external system that might fail
  return await externalSystem.call();
});
```

### 2. Caching Layer

The caching system improves performance by storing frequently accessed data in memory.

- **TTL Support**: Configurable time-to-live for cache entries
- **Size Limits**: Maximum cache size with LRU eviction policy
- **Statistics**: Detailed hit/miss statistics for monitoring
- **Memoization**: Helper functions for caching function results

```javascript
// Example usage
const cachedData = relationshipCache.get(cacheKey);
if (cachedData) {
  return cachedData;
}

// Fetch and cache data
const data = await fetchData();
relationshipCache.set(cacheKey, data);
```

### 3. Preference Normalization

Preference normalization ensures that preference strengths remain consistent over time and across users.

- **Time-based Decay**: Gradually reduces preference strengths over time
- **Statistical Normalization**: Applies z-score based normalization to maintain consistent distributions
- **Scheduled Runs**: Configurable periodic normalization of all preferences
- **Bounded Values**: Ensures preference strengths stay within defined limits

```javascript
// Example usage
const normalizedStrength = normalizePreferenceStrength(
  rawStrength,
  category,
  existingPreferences
);
```

### 4. System Initialization

The preference system is initialized with a single call that configures all components:

```javascript
// Initialize the entire preference system
const { success, cleanup } = await initializePreferenceSystem({
  circuitBreaker: {
    failureThreshold: 5,
    resetTimeoutMs: 30000
  },
  cache: {
    relationship: {
      ttlMs: 3600000,
      maxSize: 1000
    }
  },
  normalization: {
    intervalHours: 24,
    runOnStartup: true
  }
});

// Later, when shutting down
cleanup();
```

## Integration Points

### Relationship Memory Integration

The preference system integrates with the relationship memory system to:

1. Adjust preference strengths based on relationship context
2. Update relationship memory with new preference observations
3. Handle failures gracefully with circuit breaker and retry queues

```javascript
// Get relationship context with circuit breaker and caching
const context = await getRelationshipContext(userId, entityId);

// Update relationship with circuit breaker and retry queue
await updateRelationshipFromPreference(userId, entityId, key, value, strength);
```

### Event System Integration

The preference system publishes and subscribes to events:

- `preference:system:ready` - Published when the system is initialized
- `user:preference:observed` - Published when a preference is observed with sufficient confidence
- `user:logout` - Subscribed to clear user-specific cache entries
- `system:memory:warning` - Subscribed to reduce cache sizes when memory is low
- `system:shutdown` - Subscribed to clean up resources

## Configuration Options

### Circuit Breaker Configuration

| Option | Description | Default |
|--------|-------------|---------|
| `failureThreshold` | Number of failures before opening circuit | 5 |
| `resetTimeoutMs` | Time in ms before trying half-open state | 30000 |
| `successThreshold` | Successes needed to close circuit | 2 |

### Cache Configuration

| Option | Description | Default |
|--------|-------------|---------|
| `ttlMs` | Time-to-live in milliseconds | 3600000 (1 hour) |
| `maxSize` | Maximum number of entries | 1000 |
| `pruneIntervalMs` | Interval for pruning expired entries | 300000 (5 min) |

### Normalization Configuration

| Option | Description | Default |
|--------|-------------|---------|
| `intervalHours` | Hours between normalization runs | 24 |
| `batchSize` | Users to process per batch | 50 |
| `runOnStartup` | Whether to run on system start | true |
| `targetMean` | Target mean preference strength | 0.5 |
| `targetStd` | Target standard deviation | 0.2 |

## Telemetry and Monitoring

The system provides comprehensive telemetry through the audit trail:

- Circuit breaker state changes
- Cache hit/miss statistics
- Normalization runs and results
- Performance metrics for all operations
- Detailed error logging

## Error Handling

The preference system implements robust error handling:

1. **Circuit Breaker**: Prevents repeated calls to failing systems
2. **Retry Queues**: Ensures critical updates are eventually processed
3. **Graceful Degradation**: Returns sensible defaults when components fail
4. **Comprehensive Logging**: Detailed error information for debugging

## Testing

Comprehensive test suites are provided for all components:

- Unit tests for individual components
- Integration tests for component interactions
- System tests for end-to-end functionality

## Future Enhancements

Planned enhancements to the preference system:

1. **Distributed Caching**: Support for Redis or other distributed cache backends
2. **Machine Learning Integration**: Advanced preference prediction models
3. **Preference Clustering**: Group similar users for cold-start recommendations
4. **Privacy Controls**: Enhanced user control over preference data
5. **Explainable Preferences**: Help users understand why preferences were inferred
