/**
 * ALEJO Security Headers Integration Test
 * 
 * Tests the security headers implementation to ensure it works correctly
 * with the rest of the ALEJO system.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'vite';
import fetch from 'node-fetch';
import { securityHeaders } from '../../src/security/vite-security-headers.js';

describe('Security Headers Integration', () => {
  let server;
  let serverUrl;
  
  // Start a test server before running tests
  beforeAll(async () => {
    // Create a minimal Vite server with the security headers plugin
    server = await createServer({
      configFile: false,
      root: './src',
      server: {
        port: 3333,
      },
      plugins: [
        securityHeaders({
          development: true,
          reportOnly: false
        })
      ]
    });
    
    await server.listen(3333);
    serverUrl = 'http://localhost:3333';
    console.log(`Test server running at ${serverUrl}`);
  }, 10000); // Increase timeout for server startup
  
  // Close the server after tests
  afterAll(async () => {
    await server?.close();
  });
  
  it('should add Content-Security-Policy header', async () => {
    const response = await fetch(serverUrl);
    const cspHeader = response.headers.get('content-security-policy');
    
    expect(cspHeader).toBeDefined();
    expect(cspHeader).toContain("default-src 'self'");
  });
  
  it('should add X-Content-Type-Options header', async () => {
    const response = await fetch(serverUrl);
    const header = response.headers.get('x-content-type-options');
    
    expect(header).toBeDefined();
    expect(header).toBe('nosniff');
  });
  
  it('should add X-Frame-Options header', async () => {
    const response = await fetch(serverUrl);
    const header = response.headers.get('x-frame-options');
    
    expect(header).toBeDefined();
    expect(header).toBe('SAMEORIGIN');
  });
  
  it('should add X-XSS-Protection header', async () => {
    const response = await fetch(serverUrl);
    const header = response.headers.get('x-xss-protection');
    
    expect(header).toBeDefined();
    expect(header).toBe('1; mode=block');
  });
  
  it('should add Referrer-Policy header', async () => {
    const response = await fetch(serverUrl);
    const header = response.headers.get('referrer-policy');
    
    expect(header).toBeDefined();
    expect(header).toBe('strict-origin-when-cross-origin');
  });
  
  it('should add Permissions-Policy header', async () => {
    const response = await fetch(serverUrl);
    const header = response.headers.get('permissions-policy');
    
    expect(header).toBeDefined();
    expect(header).toContain('camera=()');
    expect(header).toContain('microphone=()');
    expect(header).toContain('geolocation=()');
  });
  
  it('should allow unsafe-eval in development mode', async () => {
    const response = await fetch(serverUrl);
    const cspHeader = response.headers.get('content-security-policy');
    
    expect(cspHeader).toContain("'unsafe-eval'");
  });
  
  it('should include connect-src ws: for WebSocket in development', async () => {
    const response = await fetch(serverUrl);
    const cspHeader = response.headers.get('content-security-policy');
    
    expect(cspHeader).toContain('connect-src');
    expect(cspHeader).toContain('ws:');
  });
  
  it('should not add HSTS header in development mode', async () => {
    const response = await fetch(serverUrl);
    const header = response.headers.get('strict-transport-security');
    
    // HSTS should not be present in development mode
    expect(header).toBeNull();
  });
  
  // Test production mode configuration
  describe('Production mode', () => {
    let prodServer;
    let prodServerUrl;
    
    beforeAll(async () => {
      // Create a minimal Vite server with production settings
      prodServer = await createServer({
        configFile: false,
        root: './src',
        server: {
          port: 3334,
        },
        plugins: [
          securityHeaders({
            development: false,
            reportOnly: false
          })
        ]
      });
      
      await prodServer.listen(3334);
      prodServerUrl = 'http://localhost:3334';
      console.log(`Production test server running at ${prodServerUrl}`);
    }, 10000);
    
    afterAll(async () => {
      await prodServer?.close();
    });
    
    it('should not allow unsafe-eval in production mode', async () => {
      const response = await fetch(prodServerUrl);
      const cspHeader = response.headers.get('content-security-policy');
      
      expect(cspHeader).not.toContain("'unsafe-eval'");
    });
    
    it('should add HSTS header in production mode', async () => {
      const response = await fetch(prodServerUrl);
      const header = response.headers.get('strict-transport-security');
      
      expect(header).toBeDefined();
      expect(header).toContain('max-age=31536000');
    });
  });
  
  // Test CSP report-only mode
  describe('Report-only mode', () => {
    let reportServer;
    let reportServerUrl;
    
    beforeAll(async () => {
      // Create a minimal Vite server with report-only settings
      reportServer = await createServer({
        configFile: false,
        root: './src',
        server: {
          port: 3335,
        },
        plugins: [
          securityHeaders({
            development: true,
            reportOnly: true,
            reportUri: '/api/security/csp-report'
          })
        ]
      });
      
      await reportServer.listen(3335);
      reportServerUrl = 'http://localhost:3335';
      console.log(`Report-only test server running at ${reportServerUrl}`);
    }, 10000);
    
    afterAll(async () => {
      await reportServer?.close();
    });
    
    it('should use Content-Security-Policy-Report-Only in report-only mode', async () => {
      const response = await fetch(reportServerUrl);
      const cspHeader = response.headers.get('content-security-policy-report-only');
      const enforcedCspHeader = response.headers.get('content-security-policy');
      
      expect(cspHeader).toBeDefined();
      expect(enforcedCspHeader).toBeNull();
    });
    
    it('should include report-uri in CSP when specified', async () => {
      const response = await fetch(reportServerUrl);
      const cspHeader = response.headers.get('content-security-policy-report-only');
      
      expect(cspHeader).toContain('report-uri /api/security/csp-report');
    });
  });
});
