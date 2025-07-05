# Eye Tracking Testing Guide

This document provides comprehensive guidance on testing the ALEJO eye tracking biometric system, including unit tests, integration tests, and system tests.

## Testing Infrastructure

The eye tracking module is tested using a multi-layered approach:

1. **Unit Tests**: Test individual components in isolation
2. **Integration Tests**: Test interactions between components
3. **System Tests**: Test the entire eye tracking system
4. **Security Scans**: Verify security best practices
5. **Performance Benchmarks**: Ensure optimal performance

## Running Tests

### Comprehensive Test Runner

We provide a comprehensive test runner that can execute all biometrics tests, including eye tracking:

```bash
run-biometrics-tests.bat [options]
```

Options:

- `--component=eye`: Run only eye tracking tests
- `--testTypes=unit,integration`: Specify test types to run
- `--coverage-threshold=80`: Set minimum code coverage threshold
- `--securityScan=false`: Disable security scanning
- `--performanceBenchmark=false`: Disable performance benchmarking
- `--reportDir=path/to/reports`: Specify custom report directory
- `--timeout=60000`: Set test timeout in milliseconds

### Eye Tracking Specific Tests

For eye tracking specific tests only:

```bash
run-eye-tracking-tests.bat
```

### CI/CD Integration

The eye tracking tests are fully integrated with the ALEJO CI/CD pipeline. Tests are automatically run when:

1. Code is pushed to `main` or `develop` branches
2. Pull requests are created against `main`
3. Files in `src/biometrics/eye/**` or related test files are modified
4. Commits are tagged with specific prefixes:
   - `[MAJOR FEATURE] Eye Tracking*`
   - `[SECURITY FIX] Eye Tracking*`
   - `[PERFORMANCE] Eye Tracking*`
   - `[UX] Eye Tracking*`

## Test Types

### Unit Tests

Unit tests focus on testing individual components in isolation:

- `eye-processor.js`: Core eye tracking algorithms
- `eye-calibration.js`: Calibration procedures
- `eye-accessibility.js`: Accessibility features
- `eye-privacy.js`: Privacy protection features

### Integration Tests

Integration tests verify the interaction between components:

- `eye-tracking-integration-test.js`: Tests the eye tracking integration with the main biometrics system
- `eye-tracking-system-test.js`: Tests the entire eye tracking system

Key integration test scenarios:

1. Initialization with different configurations
2. Lifecycle management (start, stop, pause, resume)
3. Configuration updates
4. Event handling
5. Calibration procedures
6. Accessibility features
7. Privacy modes
8. Error handling and recovery

### System Tests

System tests validate the eye tracking system as a whole:

1. End-to-end tracking accuracy
2. Performance under different lighting conditions
3. Compatibility with different camera setups
4. Integration with the ALEJO platform

## Test Reports

Test reports are generated in the `reports/biometrics/` directory and include:

1. Test execution summary
2. Code coverage metrics
3. Security scan results
4. Performance benchmark results

## Mocking Strategy

The eye tracking tests use a comprehensive mocking strategy:

1. **Browser APIs**: `navigator.mediaDevices.getUserMedia` is mocked to provide predictable video streams
2. **DOM Elements**: Video elements and canvas contexts are mocked
3. **Face-API.js**: Face detection and landmark detection are stubbed with predictable results
4. **Event Bus**: Event publishing and subscription are mocked to verify event flow

## Troubleshooting Tests

Common test issues and solutions:

1. **Failed camera access in tests**: Ensure the camera mock is properly configured
2. **Timeout errors**: Increase the timeout value with `--timeout=120000`
3. **Low code coverage**: Review untested code paths and add tests
4. **Inconsistent results**: Check for race conditions in async tests

## Best Practices

1. **Test in isolation**: Use mocks and stubs to isolate the component under test
2. **Test edge cases**: Include tests for error conditions and boundary cases
3. **Test accessibility**: Verify that accessibility features work correctly
4. **Test privacy modes**: Ensure all privacy modes function as expected
5. **Test performance**: Include performance benchmarks for critical operations

## Security Considerations

The eye tracking tests include security validations:

1. **Data privacy**: Verify that biometric data is properly protected
2. **Consent management**: Test that user consent is properly handled
3. **Data minimization**: Ensure only necessary data is collected and processed
4. **Local processing**: Verify that processing happens locally without external API calls

## Accessibility Testing

Special considerations for accessibility testing:

1. **Screen reader compatibility**: Test with screen reader mocks
2. **Keyboard navigation**: Verify all features are accessible via keyboard
3. **Visual impairment adaptations**: Test with different visual impairment simulations
4. **Audio feedback**: Verify audio cues work correctly

## Continuous Improvement

The testing infrastructure is designed for continuous improvement:

1. **Test coverage goals**: Aim for >80% code coverage
2. **Automated regression testing**: Prevent regressions with comprehensive test suites
3. **Performance baselines**: Track performance metrics over time
4. **Security scanning**: Regular security scans to identify vulnerabilities

## Related Documentation

- [Eye Tracking Integration Guide](./eye-tracking-integration.md)
- [Biometrics System README](../src/biometrics/README.md)
- [ALEJO Testing Framework](../testing/README.md)
