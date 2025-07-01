#!/usr/bin/env python3
"""
End-to-End tests for the ALEJO gesture interface.
Tests the complete gesture system including WebSocket communication and UI interaction.
"""
import asyncio
import json
import os
import pytest
import time
from playwright.async_api import async_playwright, expect
import secrets  # More secure for cryptographic purposes

# Constants for testing
GESTURE_INTERFACE_URL = "http://localhost:8000/gestures"
WEBSOCKET_URL = "ws://localhost:8765"


@pytest.mark.asyncio
async def test_gesture_interface_loads():
    """Test that the gesture interface loads correctly."""
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        
        # Navigate to the gesture interface
        await page.goto(GESTURE_INTERFACE_URL)
        
        # Check that the page title is correct
        assert await page.title() == "ALEJO - Gesture-Enabled Interface"
        
        # Check that the gesture area is present
        gesture_area = page.locator(".gesture-area")
        await expect(gesture_area).to_be_visible()
        
        # Check that the accessibility controls are present
        accessibility_toggle = page.locator("#accessibility-enabled")
        await expect(accessibility_toggle).to_be_visible()
        
        await browser.close()


@pytest.mark.asyncio
async def test_websocket_connection():
    """Test that the WebSocket connection can be established."""
    import websockets
    
    # Create a simple WebSocket client
    try:
        async with websockets.connect(WEBSOCKET_URL) as websocket:
            # Send a ping message
            await websocket.send(json.dumps({
                "type": "ping",
                "timestamp": time.time()
            }))
            
            # Wait for a response
            response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
            response_data = json.loads(response)
            
            # Check that we got a pong response
            assert response_data.get("type") == "pong"
    except (websockets.exceptions.ConnectionError, asyncio.TimeoutError) as e:
        pytest.fail(f"Failed to connect to WebSocket server: {e}")


@pytest.mark.asyncio
async def test_gesture_recognition():
    """Test that gestures can be recognized and processed."""
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        
        # Navigate to the gesture interface
        await page.goto(GESTURE_INTERFACE_URL)
        
        # Get the gesture area
        gesture_area = page.locator(".gesture-area")
        
        # Simulate a tap gesture
        await gesture_area.click()
        
        # Check that the gesture feedback is displayed
        feedback = page.locator(".gesture-feedback")
        await expect(feedback).to_be_visible()
        
        # Wait for the feedback to update
        await page.wait_for_timeout(1000)
        
        # Check console logs for WebSocket messages
        logs = await page.evaluate("() => {return window.gestureDebugLogs || []}")
        
        # Verify that at least one gesture event was logged
        assert any("gesture" in str(log).lower() for log in logs), "No gesture events were logged"
        
        await browser.close()


@pytest.mark.asyncio
async def test_accessibility_features():
    """Test that accessibility features are working correctly."""
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        
        # Navigate to the gesture interface
        await page.goto(GESTURE_INTERFACE_URL)
        
        # Enable accessibility features
        await page.locator("#accessibility-enabled").check()
        
        # Check that ARIA live region is present
        aria_live = page.locator("[aria-live='polite']")
        await expect(aria_live).to_be_visible()
        
        # Simulate keyboard navigation
        await page.keyboard.press("Tab")
        await page.keyboard.press("Tab")
        
        # Check that focus is managed correctly
        focused_element = await page.evaluate("() => document.activeElement.id")
        assert focused_element, "No element is focused after keyboard navigation"
        
        await browser.close()


if __name__ == "__main__":
    pytest.main(["-xvs", __file__])