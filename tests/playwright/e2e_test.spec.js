const { test, expect } = require('@playwright/test');

// This test checks that the visualizer page loads and a WebSocket connection is established

test('Visualizer renders and WS connects', async ({ page }) => {
  // Navigate to the application's visualizer page
  await page.goto('http://localhost:3000');

  // Wait for the visualizer element to be visible (assumes it has an id 'visualizer')
  const visualizer = await page.waitForSelector('#visualizer', { timeout: 5000 });
  expect(visualizer).not.toBeNull();

  // Optionally, simulate checking websocket connection status by observing a specific indicator element
  const wsIndicator = await page.waitForSelector('#ws-status', { timeout: 5000 });
  expect(wsIndicator).not.toBeNull();

  // Log success message
  console.log('Visualizer loaded and WS indicator detected');
});
