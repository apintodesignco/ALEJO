# ALEJO Error Handling System

The ALEJO Error Handling System provides robust error tracking, recovery, and management capabilities for the ALEJO AI assistant.

## Key Features

- **Error Categorization**: Errors are categorized by severity and type
- **Automatic Recovery**: Built-in recovery strategies for common error types
- **Component Health Monitoring**: Tracks component health and degradation
- **Thread-Safe Operation**: All operations are thread-safe
- **Test Mode Support**: Special mode for testing error scenarios

## Usage

### Basic Error Handling

Use the `@handle_errors` decorator to automatically handle errors in functions:

```python
from alejo.utils.error_handling import handle_errors

@handle_errors(component='command_processor', category='file_operation')
def create_file(path):
    # Function implementation
    pass
```

### Recovery Strategies

The system includes recovery strategies for:

- Connection errors (exponential backoff)
- Memory issues (garbage collection)
- Timeouts (retry with increased timeouts)
- Permission issues (alternative paths)
- Network errors (connection pool reset)
- LLM service errors (API key rotation)

### Component Health

Components are monitored for error frequency:

```python
from alejo.utils.error_handling import get_error_tracker

tracker = get_error_tracker()
if tracker.is_component_healthy('command_processor'):
    # Proceed with operation
else:
    # Take alternative action
```

## Error Categories

- **Critical**: Immediate action required, max 1 retry
- **System**: Important system errors, max 3 retries
- **Operational**: Non-critical issues, max 5 retries
- **Recoverable**: Minor issues, max 10 retries

## Testing

Run the test suite:

```bash
python -m pytest tests/test_error_handling.py -v
```

## Integration

The error handling system is integrated with:

- Command Processor
- Voice Recognition
- LLM Service
- Web Interface
- File Operations
- Network Operations

## Best Practices

1. Always use the `@handle_errors` decorator for error-prone operations
2. Provide context when tracking errors for better recovery
3. Check component health before critical operations
4. Use test mode when running integration tests
5. Monitor error logs for patterns and trends
