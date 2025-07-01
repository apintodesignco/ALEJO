// vite.config.js
import { defineConfig } from 'vite';
import legacy from '@vitejs/plugin-legacy';
import { splitVendorChunkPlugin } from 'vite';
import { resolve } from 'path';

/**
 * ALEJO Vite Configuration
 * 
 * This configuration enables modern performance optimizations:
 * - Code splitting (automatic chunking of vendor dependencies)
 * - Dynamic imports for lazy loading
 * - Legacy browser support
 * - Asset compression and optimization
 * - Configurable output formats
 */
export default defineConfig({
  // Define base path - useful for subdirectory deployments
  base: './',
  
  // Define source directory
  root: './src',
  
  // Configure build options for production
  build: {
    // Output directory relative to project root
    outDir: '../dist',
    
    // Configure code splitting
    rollupOptions: {
      output: {
        // Create separate chunks for different parts of the application
        manualChunks: {
          // Vendor chunk for third-party dependencies
          'vendor': ['three', 'tone'],
          
          // Core application features
          'core': ['./src/core/index.js'],
          
          // UI components and rendering
          'ui': ['./src/ui/index.js'],
          
          // Gesture recognition system (load only when needed)
          'gesture': ['./src/gesture/index.js']
        },
        // Control chunk naming
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]'
      }
    },
    
    // Enable minification and compression
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    
    // Control chunk size warnings
    chunkSizeWarningLimit: 1000,
    
    // Generate source maps for debugging
    sourcemap: true
  },
  
  // Configure development server
  server: {
    port: 3000,
    open: true,
    cors: true,
    // Proxy API requests to FastAPI backend during development
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true
      }
    }
  },
  
  // Plugin configuration
  plugins: [
    // Split vendor chunks automatically
    splitVendorChunkPlugin(),
    
    // Add legacy browser support
    legacy({
      targets: ['defaults', 'not IE 11']
    })
  ],
  
  // Optimize dependencies
  optimizeDeps: {
    include: ['three', 'tone']
  },
  
  // Configure resolver for module imports
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  }
});
