/**
 * ALEJO Eye Tracking Demo Server
 * 
 * Simple Express server to serve the eye tracking demo files.
 * This server handles static file serving and provides proper MIME types.
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from project root
app.use(express.static(projectRoot));

// Serve node_modules for dependencies
app.use('/node_modules', express.static(path.join(projectRoot, 'node_modules')));

// Special route for the eye tracking demo
app.get('/', (req, res) => {
  res.redirect('/demos/eye-tracking-demo.html');
});

// Start server
app.listen(PORT, () => {
  console.log(`ALEJO Eye Tracking Demo server running at http://localhost:${PORT}`);
  console.log(`Open http://localhost:${PORT}/demos/eye-tracking-demo.html in your browser`);
});
