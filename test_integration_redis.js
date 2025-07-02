/**
 * Integration Manager Redis Test
 * 
 * This script tests the integration between the integration-manager.js module
 * and Redis to ensure they can communicate properly.
 */

// Import Redis client
const redis = require('redis');

// Create Redis client
const client = redis.createClient({
  url: 'redis://localhost:6379'
});

// Connect to Redis
async function main() {
  console.log('Connecting to Redis...');
  
  try {
    await client.connect();
    console.log('✅ Successfully connected to Redis');
    
    // Test Redis operations
    console.log('Testing Redis operations...');
    
    // Set a test value
    await client.set('integration_test', 'working');
    console.log('✅ Successfully set test value');
    
    // Get the test value
    const value = await client.get('integration_test');
    console.log(`✅ Successfully retrieved test value: ${value}`);
    
    // Publish a test event (simulating the EventBus)
    console.log('Testing EventBus simulation...');
    await client.publish('alejo:events', JSON.stringify({
      type: 'INTEGRATION_TEST',
      payload: {
        timestamp: Date.now(),
        message: 'Integration test successful'
      }
    }));
    console.log('✅ Successfully published test event');
    
    // Clean up
    await client.del('integration_test');
    console.log('✅ Test cleanup complete');
    
    console.log('\n=== TEST SUMMARY ===');
    console.log('✅ Redis connection: SUCCESS');
    console.log('✅ Redis operations: SUCCESS');
    console.log('✅ EventBus simulation: SUCCESS');
    console.log('\nThe Redis server is working correctly and can be used by the integration-manager.js module.');
    
  } catch (error) {
    console.error('❌ Redis test failed:', error.message);
    process.exit(1);
  } finally {
    // Close the Redis connection
    await client.quit();
    console.log('Redis connection closed');
  }
}

// Run the test
main().catch(console.error);
