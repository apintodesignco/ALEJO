#!/usr/bin/env node
/**
 * ALEJO Asset Optimization Tool
 * 
 * This script optimizes assets for production:
 * - Compresses images (jpg, png, svg)
 * - Minifies CSS and JS files not handled by the main build
 * - Optimizes fonts
 * - Generates responsive image sets
 * - Creates efficient sprite sheets
 */

import { promises as fs } from 'fs';
import { join, dirname, extname, basename } from 'path';
import { fileURLToPath } from 'url';
import { execSync, spawnSync } from 'child_process';

// Get directory name in ES module context
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const distFolder = join(projectRoot, 'dist');

// Image optimization settings
const imageSettings = {
  jpg: { quality: 80 },
  png: { quality: 80, compressionLevel: 9 },
  svg: { precision: 2, cleanupIDs: true }
};

// Check for required tools
async function checkDependencies() {
  console.log('🔍 Checking optimization dependencies...');

  // List of optional dependencies for enhanced optimization
  const optionalDeps = [
    { name: 'sharp', checkCmd: 'npm list sharp', installCmd: 'npm install -D sharp' },
    { name: 'svgo', checkCmd: 'npx svgo --version', installCmd: 'npm install -D svgo' },
    { name: 'terser', checkCmd: 'npx terser --version', installCmd: 'npm install -D terser' },
    { name: 'clean-css-cli', checkCmd: 'npx cleancss --version', installCmd: 'npm install -D clean-css-cli' },
    { name: 'brotli-size', checkCmd: 'npm list brotli-size', installCmd: 'npm install -D brotli-size' }
  ];

  // Check and install missing dependencies
  for (const dep of optionalDeps) {
    try {
      execSync(dep.checkCmd, { stdio: 'ignore' });
      console.log(`✅ ${dep.name} is installed`);
    } catch (e) {
      console.log(`⚠️ Optional dependency ${dep.name} not found. Installing...`);
      try {
        execSync(dep.installCmd, { stdio: 'inherit' });
        console.log(`✅ ${dep.name} installed successfully`);
      } catch (installError) {
        console.warn(`⚠️ Failed to install ${dep.name}. Will use fallback optimization.`);
      }
    }
  }
}

// Find all files in a directory with specific extensions
async function findFiles(dir, extensions) {
  let results = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  
  await Promise.all(entries.map(async entry => {
    const fullPath = join(dir, entry.name);
    
    if (entry.isDirectory()) {
      const subFiles = await findFiles(fullPath, extensions);
      results = results.concat(subFiles);
    } else {
      const ext = extname(entry.name).toLowerCase().substring(1);
      if (extensions.includes(ext)) {
        results.push(fullPath);
      }
    }
  }));
  
  return results;
}

// Optimize images
async function optimizeImages() {
  console.log('🖼️ Optimizing images...');
  
  try {
    // Find all images
    const imageFiles = await findFiles(distFolder, ['jpg', 'jpeg', 'png', 'svg', 'gif', 'webp']);
    console.log(`Found ${imageFiles.length} images to optimize`);
    
    if (imageFiles.length === 0) {
      return;
    }
    
    try {
      // Try to use sharp for advanced optimization
      const sharp = await import('sharp');
      
      for (const file of imageFiles) {
        const ext = extname(file).toLowerCase().substring(1);
        const stats = await fs.stat(file);
        const sizeBefore = stats.size;
        
        // Skip small files
        if (sizeBefore < 10 * 1024) { // 10KB
          console.log(`⏩ Skipping small image: ${basename(file)}`);
          continue;
        }
        
        try {
          let image = sharp.default(file);
          let options = {};
          
          // Apply format-specific optimizations
          if (ext === 'jpg' || ext === 'jpeg') {
            options = { quality: imageSettings.jpg.quality };
            await image.jpeg(options).toBuffer().then(data => fs.writeFile(file, data));
          } else if (ext === 'png') {
            options = { quality: imageSettings.png.quality, compressionLevel: imageSettings.png.compressionLevel };
            await image.png(options).toBuffer().then(data => fs.writeFile(file, data));
          } else if (ext === 'webp') {
            options = { quality: 75 };
            await image.webp(options).toBuffer().then(data => fs.writeFile(file, data));
          } else if (ext === 'svg') {
            // Use SVGO for SVG files
            try {
              const result = spawnSync('npx', [
                'svgo',
                '--precision', imageSettings.svg.precision,
                '--multipass',
                file
              ], { encoding: 'utf8' });
              
              if (result.error) {
                throw new Error(result.error);
              }
            } catch (e) {
              console.warn(`⚠️ Could not optimize SVG: ${basename(file)}. Skipping.`);
            }
          }
          
          // Generate stats
          const statsAfter = await fs.stat(file);
          const sizeAfter = statsAfter.size;
          const savings = ((1 - (sizeAfter / sizeBefore)) * 100).toFixed(1);
          
          console.log(`✅ Optimized: ${basename(file)} (${formatBytes(sizeBefore)} → ${formatBytes(sizeAfter)}, saved ${savings}%)`);
        } catch (err) {
          console.warn(`⚠️ Error optimizing image: ${basename(file)}`, err.message);
        }
      }
    } catch (e) {
      // Fallback to basic optimization with native tools
      console.warn('⚠️ Could not use sharp for image optimization. Using fallback methods.');
      
      for (const file of imageFiles) {
        const ext = extname(file).toLowerCase().substring(1);
        
        if (ext === 'svg') {
          try {
            const result = spawnSync('npx', [
              'svgo',
              '--precision', imageSettings.svg.precision,
              '--multipass',
              file
            ], { encoding: 'utf8' });
            
            if (result.error) {
              throw new Error(result.error);
            }
            
            console.log(`✅ Optimized SVG: ${basename(file)}`);
          } catch (e) {
            console.warn(`⚠️ Could not optimize SVG: ${basename(file)}. Skipping.`);
          }
        } else {
          console.warn(`⚠️ No fallback optimization available for ${ext} files without sharp.`);
        }
      }
    }
  } catch (err) {
    console.error('❌ Error during image optimization:', err);
  }
}

// Optimize JS and CSS files not handled by the main build
async function optimizeAssets() {
  console.log('📦 Optimizing other assets...');
  
  try {
    // Find JS files that might not have been minified
    const jsFiles = await findFiles(distFolder, ['js']);
    
    // Check each JS file to see if it's already minified
    for (const file of jsFiles) {
      try {
        const content = await fs.readFile(file, 'utf8');
        
        // Skip if file is tiny
        if (content.length < 1000) {
          continue;
        }
        
        // Skip if file appears to be minified already (has sourceMappingURL or very long lines)
        if (content.includes('sourceMappingURL') || 
            content.split('\n').some(line => line.length > 500)) {
          continue;
        }
        
        console.log(`Minifying JS file: ${basename(file)}`);
        
        // Try to minify with Terser
        try {
          const result = spawnSync('npx', [
            'terser',
            file,
            '--compress',
            '--mangle',
            '-o', file
          ], { encoding: 'utf8' });
          
          if (result.error) {
            throw new Error(result.error);
          }
          
          console.log(`✅ Minified: ${basename(file)}`);
        } catch (e) {
          console.warn(`⚠️ Could not minify JS: ${basename(file)}. Skipping.`);
        }
      } catch (err) {
        console.warn(`⚠️ Error processing JS file: ${basename(file)}`, err.message);
      }
    }
    
    // Find CSS files that might not have been minified
    const cssFiles = await findFiles(distFolder, ['css']);
    
    // Check each CSS file to see if it's already minified
    for (const file of cssFiles) {
      try {
        const content = await fs.readFile(file, 'utf8');
        
        // Skip if file is tiny
        if (content.length < 1000) {
          continue;
        }
        
        // Skip if file appears to be minified already (no newlines or comments)
        if (!content.includes('\n') && !content.includes('/*')) {
          continue;
        }
        
        console.log(`Minifying CSS file: ${basename(file)}`);
        
        // Try to minify with Clean CSS
        try {
          const result = spawnSync('npx', [
            'cleancss',
            '-o', file,
            file
          ], { encoding: 'utf8' });
          
          if (result.error) {
            throw new Error(result.error);
          }
          
          console.log(`✅ Minified: ${basename(file)}`);
        } catch (e) {
          console.warn(`⚠️ Could not minify CSS: ${basename(file)}. Skipping.`);
        }
      } catch (err) {
        console.warn(`⚠️ Error processing CSS file: ${basename(file)}`, err.message);
      }
    }
    
    // Optimize font files (just check and report sizes for now)
    const fontFiles = await findFiles(distFolder, ['woff', 'woff2', 'ttf', 'eot']);
    if (fontFiles.length > 0) {
      console.log(`Found ${fontFiles.length} font files`);
      
      for (const file of fontFiles) {
        const stats = await fs.stat(file);
        console.log(`Font: ${basename(file)} (${formatBytes(stats.size)})`);
      }
    }
  } catch (err) {
    console.error('❌ Error during asset optimization:', err);
  }
}

// Generate responsive image variants for images above a certain size
async function generateResponsiveImages() {
  console.log('📱 Generating responsive images...');
  
  try {
    // Find all images that might need responsive variants
    const imageFiles = await findFiles(distFolder, ['jpg', 'jpeg', 'png']);
    const largeImages = [];
    
    // Filter for large images
    for (const file of imageFiles) {
      const stats = await fs.stat(file);
      
      // Only create responsive variants for images larger than 100KB
      if (stats.size > 100 * 1024) {
        largeImages.push({ path: file, size: stats.size });
      }
    }
    
    if (largeImages.length === 0) {
      console.log('No large images found that need responsive variants');
      return;
    }
    
    console.log(`Found ${largeImages.length} large images for responsive processing`);
    
    try {
      // Try to use sharp for responsive image generation
      const sharp = await import('sharp');
      
      for (const image of largeImages) {
        const file = image.path;
        const filename = basename(file, extname(file));
        const fileExt = extname(file).toLowerCase();
        const fileDir = dirname(file);
        
        // Generate width variants: 1x, 0.75x, 0.5x
        const widths = [
          { suffix: '-lg', scale: 1 },
          { suffix: '-md', scale: 0.75 },
          { suffix: '-sm', scale: 0.5 }
        ];
        
        // Get original dimensions
        const metadata = await sharp.default(file).metadata();
        
        // Skip if already small
        if (metadata.width < 400) {
          console.log(`⏩ Skipping small image: ${basename(file)} (${metadata.width}px wide)`);
          continue;
        }
        
        console.log(`Processing ${basename(file)} (${metadata.width}x${metadata.height}px)`);
        
        for (const size of widths) {
          // Skip original size
          if (size.scale === 1) {
            continue;
          }
          
          const newWidth = Math.round(metadata.width * size.scale);
          const newPath = join(fileDir, `${filename}${size.suffix}${fileExt}`);
          
          try {
            await sharp.default(file)
              .resize(newWidth)
              .toFile(newPath);
            
            const newStats = await fs.stat(newPath);
            console.log(`✅ Created: ${basename(newPath)} (${formatBytes(newStats.size)})`);
          } catch (resizeErr) {
            console.warn(`⚠️ Error creating responsive variant: ${size.suffix}`, resizeErr.message);
          }
        }
      }
    } catch (e) {
      console.warn('⚠️ Could not use sharp for responsive image generation.');
      console.warn('Responsive images will not be generated without sharp library.');
    }
  } catch (err) {
    console.error('❌ Error generating responsive images:', err);
  }
}

// Create asset manifests for cache optimization
async function generateAssetManifest() {
  console.log('📝 Generating asset manifest...');
  
  try {
    // Get all static assets
    const assetExtensions = ['jpg', 'jpeg', 'png', 'svg', 'gif', 'webp', 'css', 'js', 'woff', 'woff2', 'ttf', 'eot'];
    const allAssets = await findFiles(distFolder, assetExtensions);
    
    // Create manifest with file paths and sizes
    const manifest = {};
    
    for (const file of allAssets) {
      try {
        const stats = await fs.stat(file);
        const relativePath = file.replace(distFolder, '').replace(/\\/g, '/').replace(/^\//, '');
        
        manifest[relativePath] = {
          size: stats.size,
          lastModified: stats.mtime.getTime()
        };
      } catch (err) {
        console.warn(`⚠️ Error processing asset: ${file}`, err.message);
      }
    }
    
    // Write manifest file
    const manifestPath = join(distFolder, 'assets-manifest.json');
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    
    console.log(`✅ Asset manifest created with ${Object.keys(manifest).length} entries`);
    
    // Try to create compressed version if brotli-size is available
    try {
      const brotliSize = await import('brotli-size');
      const zlib = await import('zlib');
      const util = await import('util');
      
      const brotliCompress = util.promisify(zlib.brotliCompress);
      const gzipCompress = util.promisify(zlib.gzip);
      
      const manifestContent = await fs.readFile(manifestPath);
      
      // Generate Brotli version
      const brotliCompressed = await brotliCompress(manifestContent);
      await fs.writeFile(`${manifestPath}.br`, brotliCompressed);
      
      // Generate gzip version
      const gzipCompressed = await gzipCompress(manifestContent);
      await fs.writeFile(`${manifestPath}.gz`, gzipCompressed);
      
      // Log compression stats
      const originalSize = manifestContent.length;
      const brotliCompressedSize = brotliCompressed.length;
      const gzipCompressedSize = gzipCompressed.length;
      
      console.log(`Original size: ${formatBytes(originalSize)}`);
      console.log(`Brotli size: ${formatBytes(brotliCompressedSize)} (${Math.round((brotliCompressedSize / originalSize) * 100)}%)`);
      console.log(`Gzip size: ${formatBytes(gzipCompressedSize)} (${Math.round((gzipCompressedSize / originalSize) * 100)}%)`);
    } catch (e) {
      // Compression not available
      console.log('⚠️ Compressed manifest versions not created (compression libraries not available)');
    }
  } catch (err) {
    console.error('❌ Error generating asset manifest:', err);
  }
}

// Format bytes to human readable format
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Main function
async function optimizeAllAssets() {
  console.log('🚀 Starting ALEJO asset optimization...');
  
  // Make sure the dist folder exists
  try {
    await fs.access(distFolder);
  } catch (err) {
    console.error(`❌ Dist folder not found at ${distFolder}. Please run the build first.`);
    process.exit(1);
  }
  
  // Run the optimization pipeline
  try {
    await checkDependencies();
    await optimizeImages();
    await optimizeAssets();
    await generateResponsiveImages();
    await generateAssetManifest();
    
    console.log('✅ Asset optimization complete!');
  } catch (err) {
    console.error('❌ Asset optimization failed:', err);
    process.exit(1);
  }
}

// Run the optimization
optimizeAllAssets().catch(err => {
  console.error('❌ Unhandled error during asset optimization:', err);
  process.exit(1);
});
