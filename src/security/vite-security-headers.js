/**
 * ALEJO Security Headers Plugin for Vite
 * 
 * This plugin adds essential security headers to all responses during development
 * and provides configuration options for production deployments.
 * 
 * Security headers implemented:
 * - Content-Security-Policy (CSP): Prevents XSS attacks
 * - Strict-Transport-Security (HSTS): Enforces HTTPS
 * - X-Content-Type-Options: Prevents MIME type sniffing
 * - X-Frame-Options: Prevents clickjacking
 * - X-XSS-Protection: Additional XSS protection for older browsers
 * - Referrer-Policy: Controls referrer information
 * - Permissions-Policy: Controls browser features
 */

/**
 * Creates a Vite plugin that adds security headers to all responses
 * @param {Object} options - Configuration options
 * @param {boolean} options.development - Whether to use development-friendly CSP (default: false)
 * @param {boolean} options.reportOnly - Whether to use report-only mode for CSP (default: false)
 * @param {string} options.reportUri - URI to report CSP violations to (default: '/api/security/csp-report')
 * @returns {import('vite').Plugin}
 */
export function securityHeaders(options = {}) {
  const {
    development = false,
    reportOnly = false,
    reportUri = '/api/security/csp-report'
  } = options;

  // Default CSP directives
  const defaultDirectives = {
    'default-src': ["'self'"],
    'script-src': ["'self'"],
    'style-src': ["'self'"],
    'img-src': ["'self'", 'data:'],
    'font-src': ["'self'"],
    'connect-src': ["'self'"],
    'media-src': ["'self'"],
    'object-src': ["'none'"],
    'child-src': ["'self'"],
    'frame-ancestors': ["'self'"],
    'form-action': ["'self'"],
    'base-uri': ["'self'"],
    'upgrade-insecure-requests': [],
  };

  // Add report-uri if specified
  if (reportUri) {
    defaultDirectives['report-uri'] = [reportUri];
  }

  // Development-specific CSP modifications
  if (development) {
    // Allow eval for development tools and HMR
    defaultDirectives['script-src'].push("'unsafe-eval'");
    // Allow inline styles for development convenience
    defaultDirectives['style-src'].push("'unsafe-inline'");
    // Allow WebSocket connections for HMR
    defaultDirectives['connect-src'].push('ws:', 'wss:');
  }

  /**
   * Converts CSP directives object to string
   * @param {Object} directives - CSP directives
   * @returns {string} - CSP header value
   */
  function buildCspString(directives) {
    return Object.entries(directives)
      .map(([key, values]) => {
        if (values.length === 0) {
          return key;
        }
        return `${key} ${values.join(' ')}`;
      })
      .join('; ');
  }

  return {
    name: 'vite-plugin-security-headers',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // Content-Security-Policy
        const cspHeaderName = reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy';
        res.setHeader(cspHeaderName, buildCspString(defaultDirectives));

        // HTTP Strict Transport Security (max-age=1 year)
        // Only applied in production to avoid HSTS issues during development
        if (!development) {
          res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
        }

        // Prevent MIME type sniffing
        res.setHeader('X-Content-Type-Options', 'nosniff');

        // Prevent clickjacking
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');

        // XSS Protection for older browsers
        res.setHeader('X-XSS-Protection', '1; mode=block');

        // Control referrer information
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

        // Permissions Policy (formerly Feature-Policy)
        res.setHeader(
          'Permissions-Policy',
          'camera=(), microphone=(), geolocation=(), interest-cohort=()'
        );

        next();
      });
    },
    // Provide configuration for production builds
    // This can be used in documentation or deployment scripts
    getProductionConfig() {
      return {
        csp: buildCspString(defaultDirectives),
        hsts: 'max-age=31536000; includeSubDomains; preload',
        xContentTypeOptions: 'nosniff',
        xFrameOptions: 'SAMEORIGIN',
        xXssProtection: '1; mode=block',
        referrerPolicy: 'strict-origin-when-cross-origin',
        permissionsPolicy: 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
      };
    }
  };
}

/**
 * Generates Netlify _headers file content for security headers
 * @param {Object} options - Configuration options (same as securityHeaders)
 * @returns {string} - Content for _headers file
 */
export function generateNetlifyHeaders(options = {}) {
  const plugin = securityHeaders(options);
  const config = plugin.getProductionConfig();
  
  return `/*
  Content-Security-Policy: ${config.csp}
  Strict-Transport-Security: ${config.hsts}
  X-Content-Type-Options: ${config.xContentTypeOptions}
  X-Frame-Options: ${config.xFrameOptions}
  X-XSS-Protection: ${config.xXssProtection}
  Referrer-Policy: ${config.referrerPolicy}
  Permissions-Policy: ${config.permissionsPolicy}
`;
}

/**
 * Generates Vercel headers configuration for vercel.json
 * @param {Object} options - Configuration options (same as securityHeaders)
 * @returns {Object} - Headers configuration for vercel.json
 */
export function generateVercelHeaders(options = {}) {
  const plugin = securityHeaders(options);
  const config = plugin.getProductionConfig();
  
  return {
    headers: [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: config.csp
          },
          {
            key: "Strict-Transport-Security",
            value: config.hsts
          },
          {
            key: "X-Content-Type-Options",
            value: config.xContentTypeOptions
          },
          {
            key: "X-Frame-Options",
            value: config.xFrameOptions
          },
          {
            key: "X-XSS-Protection",
            value: config.xXssProtection
          },
          {
            key: "Referrer-Policy",
            value: config.referrerPolicy
          },
          {
            key: "Permissions-Policy",
            value: config.permissionsPolicy
          }
        ]
      }
    ]
  };
}

export default securityHeaders;
