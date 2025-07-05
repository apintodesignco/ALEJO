# ALEJO Security Headers Implementation

## Overview

This document describes the security headers implementation for ALEJO, which provides protection against common web vulnerabilities such as Cross-Site Scripting (XSS), clickjacking, and man-in-the-middle attacks.

## Implemented Security Headers

ALEJO implements the following security headers:

| Header | Purpose | Value |
|--------|---------|-------|
| Content-Security-Policy (CSP) | Prevents XSS attacks by controlling resource loading | Customizable, see below |
| Strict-Transport-Security (HSTS) | Enforces HTTPS connections | `max-age=31536000; includeSubDomains; preload` |
| X-Content-Type-Options | Prevents MIME type sniffing | `nosniff` |
| X-Frame-Options | Prevents clickjacking attacks | `SAMEORIGIN` |
| X-XSS-Protection | Additional XSS protection for older browsers | `1; mode=block` |
| Referrer-Policy | Controls referrer information | `strict-origin-when-cross-origin` |
| Permissions-Policy | Controls browser features | `camera=(), microphone=(), geolocation=(), interest-cohort=()` |

## Implementation

The security headers are implemented using a custom Vite plugin located at `src/security/vite-security-headers.js`. This plugin:

1. Adds security headers to all responses during development
2. Provides configuration options for production deployments
3. Includes utilities for generating headers configuration for popular hosting platforms

### Development Environment

In the development environment, the security headers are automatically applied by the Vite development server. The CSP is configured in a more permissive way to allow for development tools and hot module replacement.

### Production Environment

For production deployments, the security headers are configured based on the hosting platform:

#### Netlify

Create a `_headers` file in the `public` directory with the following content:

```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; media-src 'self'; object-src 'none'; child-src 'self'; frame-ancestors 'self'; form-action 'self'; base-uri 'self'; upgrade-insecure-requests;
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  X-Content-Type-Options: nosniff
  X-Frame-Options: SAMEORIGIN
  X-XSS-Protection: 1; mode=block
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
```

You can generate this file automatically using the `generateNetlifyHeaders` utility:

```javascript
import { generateNetlifyHeaders } from './src/security/vite-security-headers.js';
import { writeFileSync } from 'fs';

const headersContent = generateNetlifyHeaders();
writeFileSync('./public/_headers', headersContent);
```

#### Vercel

Create a `vercel.json` file in the project root with the following content:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; media-src 'self'; object-src 'none'; child-src 'self'; frame-ancestors 'self'; form-action 'self'; base-uri 'self'; upgrade-insecure-requests;"
        },
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=31536000; includeSubDomains; preload"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "SAMEORIGIN"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        },
        {
          "key": "Permissions-Policy",
          "value": "camera=(), microphone=(), geolocation=(), interest-cohort=()"
        }
      ]
    }
  ]
}
```

You can generate this configuration automatically using the `generateVercelHeaders` utility:

```javascript
import { generateVercelHeaders } from './src/security/vite-security-headers.js';
import { writeFileSync } from 'fs';

const vercelConfig = {
  // Your existing Vercel configuration
  ...generateVercelHeaders()
};

writeFileSync('./vercel.json', JSON.stringify(vercelConfig, null, 2));
```

#### Apache

For Apache servers, add the following to your `.htaccess` file:

```apache
# Security Headers
<IfModule mod_headers.c>
  # Content Security Policy
  Header set Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; media-src 'self'; object-src 'none'; child-src 'self'; frame-ancestors 'self'; form-action 'self'; base-uri 'self'; upgrade-insecure-requests;"
  
  # HTTP Strict Transport Security
  Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
  
  # Prevent MIME type sniffing
  Header set X-Content-Type-Options "nosniff"
  
  # Prevent clickjacking
  Header set X-Frame-Options "SAMEORIGIN"
  
  # XSS Protection
  Header set X-XSS-Protection "1; mode=block"
  
  # Referrer Policy
  Header set Referrer-Policy "strict-origin-when-cross-origin"
  
  # Permissions Policy
  Header set Permissions-Policy "camera=(), microphone=(), geolocation=(), interest-cohort=()"
</IfModule>
```

#### Nginx

For Nginx servers, add the following to your server configuration:

```nginx
# Security Headers
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; media-src 'self'; object-src 'none'; child-src 'self'; frame-ancestors 'self'; form-action 'self'; base-uri 'self'; upgrade-insecure-requests;" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), interest-cohort=()" always;
```

## Customizing Content Security Policy

The Content Security Policy can be customized by modifying the `defaultDirectives` object in the `securityHeaders` function. The default CSP is relatively strict, allowing resources only from the same origin.

If you need to allow resources from other origins, you can modify the CSP directives. For example, to allow scripts from a CDN:

```javascript
const defaultDirectives = {
  'default-src': ["'self'"],
  'script-src': ["'self'", 'https://cdn.example.com'],
  // Other directives...
};
```

## CSP Reporting

The security headers plugin supports CSP reporting, which allows you to collect information about CSP violations. To enable reporting:

1. Set up an endpoint to receive CSP reports (e.g., `/api/security/csp-report`)
2. Configure the `reportUri` option in the `securityHeaders` function
3. Optionally, enable `reportOnly` mode to collect reports without blocking resources

Example:

```javascript
securityHeaders({
  reportOnly: true,
  reportUri: '/api/security/csp-report'
})
```

## Testing Security Headers

You can test your security headers implementation using online tools such as:

- [Security Headers](https://securityheaders.com/)
- [Mozilla Observatory](https://observatory.mozilla.org/)
- [CSP Evaluator](https://csp-evaluator.withgoogle.com/)

## Best Practices

1. **Start in Report-Only Mode**: Begin with CSP in report-only mode to identify potential issues before enforcing the policy.
2. **Regularly Review Reports**: Monitor CSP violation reports to identify legitimate resources that should be allowed.
3. **Avoid 'unsafe-inline' and 'unsafe-eval'**: These directives weaken the security of your CSP. Use nonces or hashes instead if inline scripts or styles are necessary.
4. **Use Subresource Integrity**: For external resources, use integrity attributes to ensure the resource hasn't been tampered with.
5. **Keep Headers Updated**: Regularly review and update your security headers as new best practices emerge.

## References

- [MDN: Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [MDN: HTTP Strict Transport Security](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security)
- [OWASP: Secure Headers Project](https://owasp.org/www-project-secure-headers/)
- [Google Web Fundamentals: Security](https://developers.google.com/web/fundamentals/security)
