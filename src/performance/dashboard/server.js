/**
 * @file server.js
 * @description Simple HTTP server for the ALEJO performance dashboard demo
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// MIME types for different file extensions
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Default port
const PORT = process.env.PORT || 8080;

// Create HTTP server
const server = http.createServer((req, res) => {
  console.log(`Request: ${req.method} ${req.url}`);
  
  // Get file path from URL
  let filePath = path.join(__dirname, req.url === '/' ? 'dashboard-demo.html' : req.url);
  
  // If the URL doesn't specify a file, try to serve index.html
  if (!path.extname(filePath)) {
    filePath = path.join(filePath, 'index.html');
  }
  
  // Get file extension
  const extname = path.extname(filePath);
  
  // Set content type based on file extension
  const contentType = MIME_TYPES[extname] || 'text/plain';
  
  // Read file
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // File not found
        console.error(`File not found: ${filePath}`);
        fs.readFile(path.join(__dirname, '404.html'), (err, content) => {
          res.writeHead(404, { 'Content-Type': 'text/html' });
          res.end(content, 'utf-8');
        });
      } else {
        // Server error
        console.error(`Server error: ${err.code}`);
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      // Success
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
  console.log(`Open http://localhost:${PORT}/dashboard-demo.html to view the performance dashboard demo`);
  console.log('Press Ctrl+C to stop the server');
});

// Handle server shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  server.close(() => {
    console.log('Server stopped');
    process.exit(0);
  });
});
