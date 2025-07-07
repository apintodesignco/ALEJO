/**
 * Fallback Manager Test Suite
 * 
 * Tests the functionality of the fallback manager including:
 * - Fallback registration and retrieval
 * - Fallback execution with retry logic
 * - Accessibility-preserving fallbacks
 * - Stub implementation generation
 * - Fallback statistics tracking
 */

import { 
  registerFallbackImplementation,
  getFallbackImplementation,
  executePrimaryWithFallback,
  createAccessibilityFallback,
  generateStubImplementation,
  getFallbackStatistics
} from '../../../src/core/system/fallback-manager.js';

// Mock dependencies
import { logInitEvent } from '../../../src/core/system/initialization-log-viewer.js';
import { publishEvent } from '../../../src/core/event-bus.js';

// Mock the dependencies
jest.mock('../../../src/core/system/initialization-log-viewer.js', () => ({
  logInitEvent: jest.fn()
}));

jest.mock('../../../src/core/event-bus.js', () => ({
  publishEvent: jest.fn()
}));

describe('Fallback Manager', () => {
  // Reset mocks and state before each test
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });
  
  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Fallback Registration', () => {
    test('should register a fallback implementation successfully', () => {
      // Arrange
      const componentId = 'test.component';
      const fallbackFn = jest.fn().mockResolvedValue({ status: 'ready' });
      const metadata = {
        isStub: false,
        isAccessible: true,
        limitations: ['Limited functionality'],
        capabilities: ['Basic operations']
      };
      
      // Act
      const result = registerFallbackImplementation(componentId, fallbackFn, metadata);
      
      // Assert
      expect(result).toBe(true);
      const fallback = getFallbackImplementation(componentId);
      expect(fallback).toBeDefined();
      expect(fallback.implementation).toBe(fallbackFn);
      expect(fallback.metadata.isStub).toBe(false);
      expect(fallback.metadata.isAccessible).toBe(true);
      expect(fallback.metadata.limitations).toContain('Limited functionality');
      expect(fallback.metadata.capabilities).toContain('Basic operations');
    });
    
    test('should update an existing fallback implementation', () => {
      // Arrange
      const componentId = 'test.component';
      const fallbackFn1 = jest.fn().mockResolvedValue({ status: 'ready' });
      const fallbackFn2 = jest.fn().mockResolvedValue({ status: 'ready' });
      
      // Act
      registerFallbackImplementation(componentId, fallbackFn1, { isStub: true });
      const result = registerFallbackImplementation(componentId, fallbackFn2, { isStub: false });
      
      // Assert
      expect(result).toBe(true);
      const fallback = getFallbackImplementation(componentId);
      expect(fallback.implementation).toBe(fallbackFn2);
      expect(fallback.metadata.isStub).toBe(false);
    });
    
    test('should return null for non-existent fallback', () => {
      // Act
      const fallback = getFallbackImplementation('non.existent.component');
      
      // Assert
      expect(fallback).toBeNull();
    });
  });

  describe('Fallback Execution', () => {
    test('should execute primary function successfully without using fallback', async () => {
      // Arrange
      const componentId = 'test.component';
      const primaryFn = jest.fn().mockResolvedValue({ status: 'ready' });
      const fallbackFn = jest.fn().mockResolvedValue({ status: 'fallback' });
      
      registerFallbackImplementation(componentId, fallbackFn, { isStub: false });
      
      // Act
      const result = await executePrimaryWithFallback(componentId, primaryFn);
      
      // Assert
      expect(result).toEqual({ status: 'ready' });
      expect(primaryFn).toHaveBeenCalled();
      expect(fallbackFn).not.toHaveBeenCalled();
      
      // Check statistics
      const stats = getFallbackStatistics();
      expect(stats.componentStats[componentId].usageCount).toBe(0);
    });
    
    test('should use fallback when primary function fails', async () => {
      // Arrange
      const componentId = 'test.component';
      const error = new Error('Primary function failed');
      const primaryFn = jest.fn().mockRejectedValue(error);
      const fallbackFn = jest.fn().mockResolvedValue({ status: 'fallback' });
      
      registerFallbackImplementation(componentId, fallbackFn, { 
        isStub: false,
        isAccessible: true
      });
      
      // Act
      const result = await executePrimaryWithFallback(componentId, primaryFn, {
        retryAttempts: 1
      });
      
      // Assert
      expect(result).toEqual({ status: 'fallback' });
      expect(primaryFn).toHaveBeenCalled();
      expect(fallbackFn).toHaveBeenCalled();
      
      // Check statistics
      const stats = getFallbackStatistics();
      expect(stats.componentStats[componentId].usageCount).toBe(1);
      expect(stats.activeFallbacks).toBe(1);
      expect(stats.accessibleFallbacks).toBe(1);
    });
    
    test('should retry primary function before using fallback', async () => {
      // Arrange
      const componentId = 'test.component';
      const error = new Error('Primary function failed');
      const primaryFn = jest.fn().mockRejectedValue(error);
      const fallbackFn = jest.fn().mockResolvedValue({ status: 'fallback' });
      
      registerFallbackImplementation(componentId, fallbackFn, { isStub: false });
      
      // Act
      const retryPromise = executePrimaryWithFallback(componentId, primaryFn, {
        retryAttempts: 3,
        retryDelay: 100
      });
      
      // Fast-forward timers to trigger retries
      jest.advanceTimersByTime(100); // First retry
      jest.advanceTimersByTime(200); // Second retry
      jest.advanceTimersByTime(400); // Third retry
      
      const result = await retryPromise;
      
      // Assert
      expect(result).toEqual({ status: 'fallback' });
      expect(primaryFn).toHaveBeenCalledTimes(4); // Initial + 3 retries
      expect(fallbackFn).toHaveBeenCalled();
      
      // Check that retry events were logged
      expect(logInitEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'retry',
          componentId
        })
      );
    });
    
    test('should throw error when both primary and fallback fail', async () => {
      // Arrange
      const componentId = 'test.component';
      const primaryError = new Error('Primary function failed');
      const fallbackError = new Error('Fallback function failed');
      const primaryFn = jest.fn().mockRejectedValue(primaryError);
      const fallbackFn = jest.fn().mockRejectedValue(fallbackError);
      
      registerFallbackImplementation(componentId, fallbackFn, { isStub: false });
      
      // Act & Assert
      await expect(executePrimaryWithFallback(componentId, primaryFn, {
        retryAttempts: 0
      })).rejects.toThrow('Fallback function failed');
      
      expect(primaryFn).toHaveBeenCalled();
      expect(fallbackFn).toHaveBeenCalled();
      
      // Check that failure events were logged
      expect(logInitEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'fallback-failed',
          componentId,
          error: fallbackError
        })
      );
    });
    
    test('should throw error when no fallback is available', async () => {
      // Arrange
      const componentId = 'test.component';
      const error = new Error('Primary function failed');
      const primaryFn = jest.fn().mockRejectedValue(error);
      
      // Act & Assert
      await expect(executePrimaryWithFallback(componentId, primaryFn)).rejects.toThrow('Primary function failed');
      expect(primaryFn).toHaveBeenCalled();
    });
  });

  describe('Accessibility Fallbacks', () => {
    test('should create accessibility-preserving fallback', () => {
      // Arrange
      const componentId = 'a11y.component';
      const fallbackFn = jest.fn().mockResolvedValue({ status: 'fallback' });
      const a11yFeatures = {
        screenReader: true,
        keyboardNavigation: true
      };
      
      // Act
      const a11yFallback = createAccessibilityFallback(componentId, fallbackFn, a11yFeatures);
      
      // Assert
      expect(a11yFallback).toBeDefined();
      expect(typeof a11yFallback).toBe('function');
      
      // Register and check metadata
      registerFallbackImplementation(componentId, a11yFallback);
      const fallback = getFallbackImplementation(componentId);
      expect(fallback.metadata.isAccessible).toBe(true);
      expect(fallback.metadata.capabilities).toContain('screenReader');
      expect(fallback.metadata.capabilities).toContain('keyboardNavigation');
    });
    
    test('should prioritize accessibility fallbacks', async () => {
      // Arrange
      const componentId = 'a11y.component';
      const error = new Error('Primary function failed');
      const primaryFn = jest.fn().mockRejectedValue(error);
      
      const a11yFallback = createAccessibilityFallback(
        componentId,
        jest.fn().mockResolvedValue({ status: 'a11y-fallback' }),
        { screenReader: true }
      );
      
      registerFallbackImplementation(componentId, a11yFallback);
      
      // Act
      const result = await executePrimaryWithFallback(componentId, primaryFn, {
        retryAttempts: 0,
        prioritizeAccessibility: true
      });
      
      // Assert
      expect(result).toEqual({ status: 'a11y-fallback' });
      
      // Check statistics
      const stats = getFallbackStatistics();
      expect(stats.accessibleFallbacks).toBe(1);
    });
  });

  describe('Stub Implementations', () => {
    test('should generate stub implementation with specified methods', () => {
      // Arrange
      const componentId = 'test.component';
      const methods = ['getData', 'setData'];
      const properties = ['isReady'];
      const events = ['dataChanged'];
      
      // Act
      const stubImpl = generateStubImplementation(componentId, {
        methods,
        properties,
        events
      });
      
      // Assert
      expect(stubImpl).toBeDefined();
      expect(typeof stubImpl).toBe('function');
      
      // Execute stub and check result
      return stubImpl().then(result => {
        expect(result).toBeDefined();
        expect(result.getData).toBeDefined();
        expect(result.setData).toBeDefined();
        expect(result.isReady).toBeDefined();
        expect(result.on).toBeDefined(); // Event handler
        
        // Check that methods return expected values
        expect(result.getData()).toBeNull();
        expect(result.setData('test')).toBeUndefined();
        
        // Check that properties have expected values
        expect(result.isReady).toBe(false);
      });
    });
    
    test('should register stub implementation with correct metadata', () => {
      // Arrange
      const componentId = 'test.component';
      const stubImpl = generateStubImplementation(componentId, {
        methods: ['getData'],
        properties: ['isReady']
      });
      
      // Act
      registerFallbackImplementation(componentId, stubImpl);
      
      // Assert
      const fallback = getFallbackImplementation(componentId);
      expect(fallback.metadata.isStub).toBe(true);
      expect(fallback.metadata.limitations).toContain('Limited functionality');
      expect(fallback.metadata.limitations).toContain('No data persistence');
    });
  });

  describe('Fallback Statistics', () => {
    test('should track fallback usage statistics', async () => {
      // Arrange
      const component1 = 'test.component1';
      const component2 = 'test.component2';
      
      const primaryFn1 = jest.fn().mockRejectedValue(new Error('Failed'));
      const primaryFn2 = jest.fn().mockRejectedValue(new Error('Failed'));
      
      const fallbackFn1 = jest.fn().mockResolvedValue({ status: 'fallback1' });
      const fallbackFn2 = jest.fn().mockResolvedValue({ status: 'fallback2' });
      
      registerFallbackImplementation(component1, fallbackFn1, { 
        isStub: true,
        isAccessible: false
      });
      
      registerFallbackImplementation(component2, fallbackFn2, { 
        isStub: false,
        isAccessible: true
      });
      
      // Act
      await executePrimaryWithFallback(component1, primaryFn1);
      await executePrimaryWithFallback(component2, primaryFn2);
      await executePrimaryWithFallback(component1, primaryFn1);
      
      // Assert
      const stats = getFallbackStatistics();
      
      expect(stats.totalFallbacks).toBe(2);
      expect(stats.activeFallbacks).toBe(2);
      expect(stats.stubImplementations).toBe(1);
      expect(stats.accessibleFallbacks).toBe(1);
      
      expect(stats.componentStats[component1].usageCount).toBe(2);
      expect(stats.componentStats[component2].usageCount).toBe(1);
      
      expect(stats.componentStats[component1].isStub).toBe(true);
      expect(stats.componentStats[component2].isAccessible).toBe(true);
    });
  });
});
