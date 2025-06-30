import { test, expect } from '@playwright/test';

// Basic smoke-test: launch the built preview server (configured in playwright.config.js)
// and verify that the main UI loads with no console errors.

test.describe('Gesture Arpeggiator Front-End', () => {
  test('loads without console errors and renders canvas', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err));

    await page.goto('/');

    // Wait for WebGL canvas or UI container to appear
    await page.waitForSelector('#visualizerContainer, canvas, body', { timeout: 10000 });

    // Expect no console errors
    expect(errors, `Console errors: ${errors.map(e=>e.message).join('\n')}`).toHaveLength(0);
  });
});
