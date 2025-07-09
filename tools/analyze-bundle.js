#!/usr/bin/env node
/**
 * ALEJO Bundle Analysis Tool
 * 
 * This script analyzes the production build bundle to provide insights
 * on bundle size, chunk distribution, and potential optimization targets.
 */

import { promises as fs } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

// Get directory name in ES module context
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const distFolder = join(projectRoot, 'dist');

// Size thresholds for warnings in bytes
const SIZE_THRESHOLDS = {
  CRITICAL: 500 * 1024, // 500KB
  WARNING: 250 * 1024,  // 250KB
  NOTICE: 100 * 1024    // 100KB
};

// ANSI color codes for terminal output
const COLORS = {
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

// Check if webpack-bundle-analyzer is installed
async function checkDependencies() {
  try {
    execSync('npm list webpack-bundle-analyzer', { stdio: 'ignore' });
    return true;
  } catch (e) {
    console.log(`${COLORS.yellow}⚠️ webpack-bundle-analyzer not found. Installing...${COLORS.reset}`);
    try {
      execSync('npm install -D webpack-bundle-analyzer', { stdio: 'inherit' });
      return true;
    } catch (installError) {
      console.warn(`${COLORS.yellow}⚠️ Failed to install webpack-bundle-analyzer. Will use basic analysis only.${COLORS.reset}`);
      return false;
    }
  }
}

// Analyze the dist folder contents
async function analyzeBundle() {
  console.log(`${COLORS.bold}${COLORS.blue}📊 ALEJO Bundle Analysis${COLORS.reset}`);
  
  // Check if dist folder exists
  try {
    await fs.access(distFolder);
  } catch (err) {
    console.error(`${COLORS.red}❌ Dist folder not found at ${distFolder}. Please run the build first.${COLORS.reset}`);
    process.exit(1);
  }
  
  // Get all files in the dist folder recursively
  const allFiles = await getAllFiles(distFolder);
  
  // Group files by extension
  const filesByExt = {};
  let totalSize = 0;
  
  for (const file of allFiles) {
    const stats = await fs.stat(file);
    const fileSize = stats.size;
    totalSize += fileSize;
    
    const ext = extname(file).toLowerCase() || 'no-extension';
    if (!filesByExt[ext]) {
      filesByExt[ext] = {
        count: 0,
        totalSize: 0,
        files: []
      };
    }
    
    filesByExt[ext].count++;
    filesByExt[ext].totalSize += fileSize;
    filesByExt[ext].files.push({
      name: file.replace(distFolder, '').replace(/\\/g, '/'),
      size: fileSize
    });
  }
  
  // Print summary
  console.log(`\n${COLORS.bold}📦 Bundle Size Summary${COLORS.reset}`);
  console.log(`${COLORS.bold}Total Size:${COLORS.reset} ${formatBytes(totalSize)}`);
  console.log(`${COLORS.bold}File Count:${COLORS.reset} ${allFiles.length}`);
  
  // Print breakdown by file type
  console.log(`\n${COLORS.bold}📋 Breakdown by File Type${COLORS.reset}`);
  
  const sortedExts = Object.keys(filesByExt).sort((a, b) => 
    filesByExt[b].totalSize - filesByExt[a].totalSize
  );
  
  for (const ext of sortedExts) {
    const info = filesByExt[ext];
    const percentage = (info.totalSize / totalSize * 100).toFixed(1);
    
    console.log(
      `${COLORS.bold}${ext}:${COLORS.reset} ` +
      `${info.count} files, ` +
      `${formatBytes(info.totalSize)} (${percentage}% of bundle)`
    );
  }
  
  // Find largest files
  console.log(`\n${COLORS.bold}🔍 Largest Files${COLORS.reset}`);
  
  const allFilesList = [];
  for (const ext in filesByExt) {
    allFilesList.push(...filesByExt[ext].files);
  }
  
  const largestFiles = allFilesList
    .sort((a, b) => b.size - a.size)
    .slice(0, 10);
  
  for (const file of largestFiles) {
    let colorCode = COLORS.green;
    if (file.size >= SIZE_THRESHOLDS.CRITICAL) {
      colorCode = COLORS.red;
    } else if (file.size >= SIZE_THRESHOLDS.WARNING) {
      colorCode = COLORS.yellow;
    }
    
    console.log(
      `${colorCode}${formatBytes(file.size)}${COLORS.reset} - ${file.name}`
    );
  }
  
  // Analyze JS chunks if they exist
  await analyzeJsChunks(filesByExt['.js']?.files || []);
  
  // Generate HTML report if webpack-bundle-analyzer is available
  const hasAnalyzer = await checkDependencies();
  if (hasAnalyzer) {
    await generateReport();
  }
  
  // Provide suggestions
  provideSuggestions(filesByExt, totalSize);
}

// Get all files in a directory recursively
async function getAllFiles(dir) {
  let results = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  
  await Promise.all(entries.map(async entry => {
    const fullPath = join(dir, entry.name);
    
    if (entry.isDirectory()) {
      const subFiles = await getAllFiles(fullPath);
      results = results.concat(subFiles);
    } else {
      results.push(fullPath);
    }
  }));
  
  return results;
}

// Analyze JS chunks for insights
async function analyzeJsChunks(jsFiles) {
  if (!jsFiles || jsFiles.length === 0) {
    return;
  }
  
  console.log(`\n${COLORS.bold}📄 JavaScript Chunks Analysis${COLORS.reset}`);
  
  // Check for vendor chunks
  const vendorChunks = jsFiles.filter(f => 
    f.name.includes('vendor') || f.name.includes('chunk') || f.name.includes('node_modules')
  );
  
  if (vendorChunks.length > 0) {
    console.log(`\n${COLORS.bold}Third-party Dependencies:${COLORS.reset}`);
    let vendorTotal = 0;
    
    for (const chunk of vendorChunks) {
      console.log(`${formatBytes(chunk.size)} - ${chunk.name}`);
      vendorTotal += chunk.size;
    }
    
    const percentage = (vendorTotal / jsFiles.reduce((sum, f) => sum + f.size, 0) * 100).toFixed(1);
    console.log(`${COLORS.bold}Vendor Total:${COLORS.reset} ${formatBytes(vendorTotal)} (${percentage}% of JS)`);
  }
  
  // Look for duplicate chunks
  const chunkNames = jsFiles.map(f => basename(f.name, '.js'));
  const duplicatePattern = /^(.+)[-_.]\d+$/;
  const potentialDuplicates = {};
  
  for (const name of chunkNames) {
    const match = name.match(duplicatePattern);
    if (match) {
      const baseName = match[1];
      if (!potentialDuplicates[baseName]) {
        potentialDuplicates[baseName] = [];
      }
      potentialDuplicates[baseName].push(name);
    }
  }
  
  const duplicates = Object.entries(potentialDuplicates)
    .filter(([_, variants]) => variants.length > 1);
  
  if (duplicates.length > 0) {
    console.log(`\n${COLORS.bold}${COLORS.yellow}⚠️ Potential Code Duplication:${COLORS.reset}`);
    
    for (const [baseName, variants] of duplicates) {
      console.log(`${COLORS.bold}${baseName}:${COLORS.reset} ${variants.length} variants`);
    }
    
    console.log(`${COLORS.yellow}Consider reviewing code splitting strategy to avoid duplication.${COLORS.reset}`);
  }
}

// Generate HTML report with webpack-bundle-analyzer
async function generateReport() {
  try {
    console.log(`\n${COLORS.bold}📊 Generating bundle visualization...${COLORS.reset}`);
    
    // Look for stats.json in the dist folder
    const statsPath = join(distFolder, 'stats.json');
    let hasStats = false;
    
    try {
      await fs.access(statsPath);
      hasStats = true;
    } catch (e) {
      // No stats file, check if we can generate one
      try {
        console.log(`${COLORS.yellow}No stats.json found. Attempting to generate...${COLORS.reset}`);
        
        // Create a temporary script to generate the stats
        const tempScript = 
          `const path = require('path');
           const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
           const fs = require('fs');
           const statsFile = path.join(__dirname, 'dist', 'stats.json');
           
           // Check if stats file already exists
           if (!fs.existsSync(statsFile)) {
             console.log('Generating stats.json...');
             const viteConfig = require('./vite.config.js');
             const config = typeof viteConfig === 'function' ? viteConfig() : viteConfig;
             
             // Modify Vite config to generate stats
             if (config.build) {
               config.build.brotliSize = false;
               config.build.rollupOptions = config.build.rollupOptions || {};
               config.build.rollupOptions.plugins = config.build.rollupOptions.plugins || [];
               config.build.rollupOptions.plugins.push({
                 name: 'stats-generator',
                 generateBundle(outputOptions, bundle) {
                   const stats = {
                     assets: Object.keys(bundle).map(id => {
                       const asset = bundle[id];
                       return {
                         name: id,
                         size: asset.code ? asset.code.length : (asset.source ? asset.source.length : 0)
                       };
                     })
                   };
                   fs.writeFileSync(statsFile, JSON.stringify(stats, null, 2));
                 }
               });
             }
             
             console.log('Stats generation configured, triggering build...');
           }`;
        
        const tempScriptPath = join(projectRoot, 'temp-stats.js');
        await fs.writeFile(tempScriptPath, tempScript);
        
        // Execute the temporary script
        execSync(`node ${tempScriptPath}`, { stdio: 'inherit' });
        await fs.unlink(tempScriptPath);
        
        // Check if stats.json was created
        await fs.access(statsPath);
        hasStats = true;
      } catch (genErr) {
        console.warn(`${COLORS.yellow}⚠️ Could not generate stats.json:${COLORS.reset}`, genErr.message);
      }
    }
    
    if (hasStats) {
      // Use webpack-bundle-analyzer to generate a report
      const reportPath = join(projectRoot, 'bundle-report.html');
      
      execSync(
        `npx webpack-bundle-analyzer ${statsPath} -O -o ${reportPath}`,
        { stdio: 'inherit' }
      );
      
      console.log(`${COLORS.green}✅ Bundle analysis report generated at:${COLORS.reset} bundle-report.html`);
      console.log(`${COLORS.blue}📊 Open the report in a browser to visualize the bundle composition${COLORS.reset}`);
    } else {
      console.warn(`${COLORS.yellow}⚠️ Could not generate bundle visualization without stats.json${COLORS.reset}`);
    }
  } catch (err) {
    console.warn(`${COLORS.yellow}⚠️ Error generating HTML report:${COLORS.reset}`, err.message);
  }
}

// Provide optimization suggestions based on analysis
function provideSuggestions(filesByExt, totalSize) {
  console.log(`\n${COLORS.bold}${COLORS.green}💡 Optimization Suggestions${COLORS.reset}`);
  
  const suggestions = [];
  
  // Check total bundle size
  if (totalSize > 2 * 1024 * 1024) {
    suggestions.push(`${COLORS.yellow}⚠️ Total bundle size exceeds 2MB. Consider code splitting and lazy loading.${COLORS.reset}`);
  }
  
  // Check image optimization opportunities
  const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'];
  let totalImageSize = 0;
  
  for (const ext of imageExts) {
    if (filesByExt[ext]) {
      totalImageSize += filesByExt[ext].totalSize;
    }
  }
  
  if (totalImageSize > totalSize * 0.3) {
    suggestions.push(`${COLORS.yellow}⚠️ Images make up ${Math.round(totalImageSize / totalSize * 100)}% of the bundle. Consider using webp and responsive images.${COLORS.reset}`);
  }
  
  // Check font optimization
  const fontExts = ['.woff', '.woff2', '.ttf', '.eot'];
  let totalFontSize = 0;
  
  for (const ext of fontExts) {
    if (filesByExt[ext]) {
      totalFontSize += filesByExt[ext].totalSize;
    }
  }
  
  if (totalFontSize > totalSize * 0.15) {
    suggestions.push(`${COLORS.yellow}⚠️ Fonts make up ${Math.round(totalFontSize / totalSize * 100)}% of the bundle. Consider font subsetting and using variable fonts.${COLORS.reset}`);
  }
  
  // Check JS optimization
  if (filesByExt['.js'] && filesByExt['.js'].totalSize > totalSize * 0.5) {
    suggestions.push(`${COLORS.yellow}⚠️ JavaScript makes up ${Math.round(filesByExt['.js'].totalSize / totalSize * 100)}% of the bundle. Consider code splitting, tree shaking, and lazy loading.${COLORS.reset}`);
    
    // Check for very large JS chunks
    const largeJsFiles = filesByExt['.js'].files.filter(f => f.size > SIZE_THRESHOLDS.CRITICAL);
    if (largeJsFiles.length > 0) {
      suggestions.push(`${COLORS.yellow}⚠️ Found ${largeJsFiles.length} large JS chunks (>500KB). Review and split these files.${COLORS.reset}`);
    }
  }
  
  // Check CSS optimization
  if (filesByExt['.css'] && filesByExt['.css'].files.some(f => f.size > SIZE_THRESHOLDS.WARNING)) {
    suggestions.push(`${COLORS.yellow}⚠️ Found large CSS files. Consider using CSS modules or purgeCSS to reduce unused styles.${COLORS.reset}`);
  }
  
  // General suggestions
  suggestions.push(`${COLORS.green}✅ Use dynamic imports for routes and components that aren't needed on initial load.${COLORS.reset}`);
  suggestions.push(`${COLORS.green}✅ Enable GZIP or Brotli compression on your production server.${COLORS.reset}`);
  suggestions.push(`${COLORS.green}✅ Set appropriate cache headers for static assets.${COLORS.reset}`);
  
  // Print suggestions
  if (suggestions.length > 0) {
    for (const suggestion of suggestions) {
      console.log(suggestion);
    }
  }
  
  console.log(`\n${COLORS.bold}${COLORS.blue}Run optimize-assets.js to automatically optimize your static assets.${COLORS.reset}`);
}

// Format bytes to human readable format
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Run the analysis
analyzeBundle().catch(err => {
  console.error(`${COLORS.red}❌ Unhandled error:${COLORS.reset}`, err);
  process.exit(1);
});
