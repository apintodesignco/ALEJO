// Simplified Vite Configuration for ALEJO
import { defineConfig } from 'vite';

export default defineConfig({
  // Define base path
  base: './',
  
  // Define source directory
  root: './src',
  
  // Configure build options
  build: {
    outDir: '../dist',
    sourcemap: true,
    minify: 'terser'
  },
  
  // Configure development server
  server: {
    port: 5173,
    open: true,
    cors: true
  },
  
  // Configure resolver for module imports
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname
    }
  }
});
