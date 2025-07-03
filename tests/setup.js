/**
 * ALEJO Test Setup
 * 
 * This file sets up the test environment for ALEJO tests.
 * It configures global mocks and test helpers.
 */

// Set up global test environment
globalThis.IS_TEST_ENV = true;

// Mock the global publish function if not already defined
if (!global.publish) {
  global.publish = jest.fn();
}

// Mock browser APIs that might not be available in the test environment
if (typeof window === 'undefined') {
  global.window = {};
}

// Mock console methods to make test output cleaner
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.error = (...args) => {
  // Check if this is a test-related error we want to see
  const isTestError = args.some(arg => 
    typeof arg === 'string' && 
    (arg.includes('test') || arg.includes('expect'))
  );
  
  if (isTestError || process.env.DEBUG === 'true') {
    originalConsoleError(...args);
  }
  // Otherwise suppress console errors in tests
};

console.warn = (...args) => {
  if (process.env.DEBUG === 'true') {
    originalConsoleWarn(...args);
  }
  // Otherwise suppress console warnings in tests
};

// Clean up function to restore console methods
afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});
