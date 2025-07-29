#!/usr/bin/env node

/**
 * Simple Development Server for ALEJO
 * This server serves the static files and provides basic development features
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import open from 'open';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5173;

// Serve static files from src directory
app.use(express.static(path.join(__dirname, 'src')));

// Serve node_modules for client-side dependencies
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));

// Handle SPA routing - serve index.html for all routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 ALEJO Development Server running at http://localhost:${PORT}`);
  console.log(`📁 Serving files from: ${path.join(__dirname, 'src')}`);
  
  // Open browser automatically
  open(`http://localhost:${PORT}`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down ALEJO Development Server...');
  process.exit(0);
});
