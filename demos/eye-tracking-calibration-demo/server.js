/**
 * ALEJO Eye Tracking Calibration Demo Server
 * 
 * This script starts a local development server for the eye tracking calibration demo
 * using Node.js built-in http server.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import url from 'url';

// MIME types for different file extensions
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.woff': 'application/font-woff',
  '.ttf': 'application/font-ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'application/font-otf',
  '.wasm': 'application/wasm'
};

// Port for the server
const PORT = 3000;

// Create the server
const server = http.createServer((req, res) => {
  // Parse the URL
  const parsedUrl = url.parse(req.url);
  
  // Extract the path from the URL
  let pathname = path.join(__dirname, parsedUrl.pathname);
  
  // If the path ends with '/', serve index.html
  if (pathname.endsWith('/')) {
    pathname = path.join(pathname, 'index.html');
  }
  
  // Get the file extension
  const ext = path.parse(pathname).ext;
  
  // Check if the file exists
  fs.access(pathname, fs.constants.F_OK, (err) => {
    if (err) {
      // If the file doesn't exist, try to serve from project root
      const projectRootPath = path.join(__dirname, '..', '..', parsedUrl.pathname);
      
      fs.access(projectRootPath, fs.constants.F_OK, (rootErr) => {
        if (rootErr) {
          // If the file doesn't exist in the project root either, return 404
          res.statusCode = 404;
          res.end(`File ${parsedUrl.pathname} not found!`);
          return;
        }
        
        // Serve the file from project root
        serveFile(projectRootPath, res);
      });
      return;
    }
    
    // Serve the file
    serveFile(pathname, res);
  });
});

// Function to serve a file
function serveFile(filePath, res) {
  // Get the file extension
  const ext = path.parse(filePath).ext;
  
  // Read the file
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.statusCode = 500;
      res.end(`Error reading file: ${err.message}`);
      return;
    }
    
    // Set the content type based on the file extension
    res.setHeader('Content-Type', mimeTypes[ext] || 'text/plain');
    
    // Add security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Send the file data
    res.end(data);
  });
}

// Start the server
server.listen(PORT, () => {
  console.log('');
  console.log('===================================================');
  console.log('ALEJO Eye Tracking Calibration Demo');
  console.log('===================================================');
  console.log('');
  console.log(`Server running at: http://localhost:${PORT}`);
  console.log('');
  console.log('Press Ctrl+C to stop the server');
  console.log('');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  server.close(() => {
    console.log('Server shut down.');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('Shutting down server...');
  server.close(() => {
    console.log('Server shut down.');
    process.exit(0);
  });
});
