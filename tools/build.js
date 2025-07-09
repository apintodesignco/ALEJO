#!/usr/bin/env node
/**
 * ALEJO Unified Build System
 * 
 * This script orchestrates the entire ALEJO build process:
 * 1. Optimizes all assets and resources
 * 2. Runs the Vite production build
 * 3. Creates a distributable package
 * 4. Validates the build for production readiness
 */

import { execSync } from 'child_process';
import { copyFileSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { resolve, join } from 'path';
import { fileURLToPath } from 'url';

// Get directory name in ES module
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = resolve(__dirname, '..');
const distDir = join(projectRoot, 'dist');

/**
 * Main build function
 */
async function buildAlejo() {
  try {
    console.log('🔄 Starting ALEJO build process...');
    
    // Step 1: Clean the dist directory
    console.log('🧹 Cleaning previous builds...');
    try {
      execSync('npm run clean', { stdio: 'inherit', cwd: projectRoot });
    } catch (e) {
      // If clean script doesn't exist, create dist directory
      mkdirSync(distDir, { recursive: true });
    }
    
    // Step 2: Run linting and validation
    console.log('🔍 Validating code quality...');
    try {
      execSync('npm run lint', { stdio: 'inherit', cwd: projectRoot });
    } catch (e) {
      console.warn('⚠️  Linting issues detected. Continuing with build...');
    }
    
    // Step 3: Run the Vite production build
    console.log('🏗️  Building production bundle...');
    execSync('npm run build', { stdio: 'inherit', cwd: projectRoot });
    
    // Step 4: Optimize assets further
    console.log('⚡ Optimizing assets...');
    optimizeAssets();
    
    // Step 5: Create initialization scripts
    console.log('📝 Creating initialization scripts...');
    createInitScripts();
    
    // Step 6: Create production configuration
    console.log('⚙️  Creating production configuration...');
    createProductionConfig();
    
    // Step 7: Copy essential files to dist
    console.log('📦 Preparing distribution package...');
    copyEssentialFiles();
    
    // Step 8: Validate the build
    console.log('✅ Validating build...');
    validateBuild();
    
    console.log('🚀 ALEJO build complete! Distribution package ready in /dist');
    return true;
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

/**
 * Optimize assets beyond Vite's default optimization
 */
function optimizeAssets() {
  // Create assets directories if they don't exist
  const assetDirs = ['css', 'js', 'images', 'fonts'];
  assetDirs.forEach(dir => {
    mkdirSync(join(distDir, 'assets', dir), { recursive: true });
  });
  
  // Run our comprehensive asset optimization
  console.log('🔍 Running advanced asset optimization...');
  try {
    // Use the newly created optimization tool
    execSync('node tools/optimize-assets.js', { stdio: 'inherit', cwd: projectRoot });
    console.log('✅ Assets optimized successfully');
    
    // Run bundle analysis if not in CI environment
    if (!process.env.CI) {
      console.log('📊 Analyzing bundle composition...');
      execSync('node tools/analyze-bundle.js', { stdio: 'inherit', cwd: projectRoot });
    }
  } catch (error) {
    console.warn('⚠️ Asset optimization encountered issues:', error.message);
    console.log('⚠️ Continuing with build process...');
  }
}

/**
 * Create initialization scripts for the production build
 */
function createInitScripts() {
  // Create the one-click initialization script
  const initScript = `#!/usr/bin/env node
/**
 * ALEJO Initialization Script
 * Start ALEJO with one command
 */

import { createServer } from 'http';
import { readFileSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { execSync, spawn } from 'child_process';

// Get the directory name in ES module context
const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Default configuration
const defaultConfig = {
  port: 9000,
  resourceLimits: {
    maxCpuPercent: 75,
    maxMemoryMb: 1024,
    maxDiskUsageMb: 500
  },
  accessibility: true,
  autoStart: true,
  localOnly: true
};

// Initialize ALEJO
async function initializeAlejo() {
  console.log('⚙️ ALEJO: Initializing system...');
  
  // Load or create configuration
  let config = defaultConfig;
  
  try {
    const configPath = join(__dirname, 'alejo.config.json');
    config = JSON.parse(readFileSync(configPath, 'utf8'));
    console.log('📋 Loaded configuration from alejo.config.json');
  } catch (error) {
    console.log('📋 Using default configuration');
    // Save default config for future use
    writeFileSync(
      join(__dirname, 'alejo.config.json'),
      JSON.stringify(defaultConfig, null, 2)
    );
  }
  
  // Start the server
  const server = createServer((req, res) => {
    // Simple static file server
    const url = req.url === '/' ? '/index.html' : req.url;
    try {
      const filePath = join(__dirname, url);
      const content = readFileSync(filePath);
      
      // Set appropriate content type
      const ext = url.split('.').pop();
      const contentTypeMap = {
        'html': 'text/html',
        'css': 'text/css',
        'js': 'application/javascript',
        'json': 'application/json',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'svg': 'image/svg+xml'
      };
      
      res.writeHead(200, { 'Content-Type': contentTypeMap[ext] || 'text/plain' });
      res.end(content);
    } catch (error) {
      res.writeHead(404);
      res.end('Not found');
    }
  });
  
  // Start the server
  server.listen(config.port, config.localOnly ? 'localhost' : '0.0.0.0', () => {
    console.log(\`✅ ALEJO is running. Access at http://\${config.localOnly ? 'localhost' : '0.0.0.0'}:\${config.port}\`);
    
    // Auto-open browser if configured
    if (config.autoStart) {
      const url = \`http://localhost:\${config.port}\`;
      const open = () => {
        try {
          const command = process.platform === 'win32' ? 
            \`start "\${url}"\` : 
            process.platform === 'darwin' ? 
              \`open "\${url}"\` : 
              \`xdg-open "\${url}"\`;
          
          execSync(command);
        } catch (error) {
          console.log(\`Opening browser manually: \${url}\`);
        }
      };
      
      // Give the server a moment to start
      setTimeout(open, 500);
    }
  });
  
  // Handle server errors
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(\`❌ Port \${config.port} is already in use. Try changing the port in alejo.config.json\`);
    } else {
      console.error('❌ Server error:', error);
    }
    process.exit(1);
  });
  
  // Handle process termination
  process.on('SIGINT', () => {
    console.log('👋 Shutting down ALEJO...');
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  });
}

// Start ALEJO
initializeAlejo().catch(error => {
  console.error('❌ Initialization error:', error);
  process.exit(1);
});
`;

  // Write the initialization script
  writeFileSync(join(distDir, 'start-alejo.js'), initScript);
  
  // Make it executable (Unix-like systems)
  try {
    execSync(`chmod +x ${join(distDir, 'start-alejo.js')}`);
  } catch (e) {
    // Windows doesn't need this
  }
}

/**
 * Create production configuration
 */
function createProductionConfig() {
  const prodConfig = {
    port: 9000,
    resourceLimits: {
      maxCpuPercent: 75,
      maxMemoryMb: 1024,
      maxDiskUsageMb: 500
    },
    accessibility: true,
    autoStart: true,
    localOnly: true,
    security: {
      encryptLocalStorage: true,
      cspEnabled: true,
      allowedOrigins: ['self']
    },
    performance: {
      enableProgressiveLoading: true,
      cacheAssets: true,
      enableServiceWorker: true,
      preloadCriticalAssets: true
    }
  };
  
  // Write production config
  writeFileSync(
    join(distDir, 'alejo.config.json'),
    JSON.stringify(prodConfig, null, 2)
  );
}

/**
 * Copy essential files to the distribution directory
 */
function copyEssentialFiles() {
  // Copy package.json with modified scripts for production
  const packageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json')));
  
  // Simplify package.json for production
  const prodPackageJson = {
    name: packageJson.name,
    version: packageJson.version,
    description: packageJson.description,
    private: packageJson.private,
    type: packageJson.type,
    scripts: {
      start: 'node start-alejo.js'
    },
    dependencies: {
      // Only include production dependencies
      ...packageJson.dependencies
    }
  };
  
  // Write production package.json
  writeFileSync(
    join(distDir, 'package.json'),
    JSON.stringify(prodPackageJson, null, 2)
  );
  
  // Copy README with installation instructions
  const readmeContent = `# ALEJO AI

## One-Click Installation

1. Install Node.js 18 or later
2. Run \`npm install\` 
3. Run \`npm start\`
4. ALEJO will open in your default browser

## Configuration

You can modify the \`alejo.config.json\` file to change:

- Port number
- Resource limits
- Accessibility features
- Security settings
- Performance options

## Resources

- Documentation: https://alejoai.com/docs
- GitHub: https://github.com/apintodesignco/ALEJO
`;

  writeFileSync(join(distDir, 'README.md'), readmeContent);
}

/**
 * Validate the build for production readiness
 */
function validateBuild() {
  // Check that essential files exist
  const requiredFiles = [
    'index.html',
    'assets',
    'start-alejo.js',
    'alejo.config.json',
    'package.json'
  ];
  
  requiredFiles.forEach(file => {
    if (!existsSync(join(distDir, file))) {
      throw new Error(`Missing essential file: ${file}`);
    }
  });
  
  // Additional validation could be performed here
}

// Execute the build process
buildAlejo().catch(console.error);
