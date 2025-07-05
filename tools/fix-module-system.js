#!/usr/bin/env node

/**
 * ALEJO Module System Fixer
 * 
 * This script scans the ALEJO codebase for CommonJS modules and converts them to ES modules
 * to ensure consistency with the project's "type": "module" setting in package.json.
 * 
 * It performs the following fixes:
 * 1. Converts require() to import statements
 * 2. Converts module.exports to export statements
 * 3. Adds __dirname and __filename equivalents for ES modules
 * 4. Updates file extensions to .mjs where appropriate
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Configuration
const CONFIG = {
  // Directories to scan
  scanDirs: [
    'src',
    'tests',
    'tools',
    'demos'
  ],
  // Files to ignore
  ignoreFiles: [
    'node_modules',
    '.git',
    'dist',
    'build',
    'coverage'
  ],
  // File extensions to process
  extensions: ['.js', '.mjs', '.cjs'],
  // Whether to actually make changes or just report them
  dryRun: false
};

// Conversion patterns
const PATTERNS = [
  // require() to import
  {
    test: /const\s+(\{[^}]+\}|\w+)\s+=\s+require\(['"]([^'"]+)['"]\);?/g,
    replace: (match, importName, moduleName) => {
      if (importName.startsWith('{') && importName.endsWith('}')) {
        return `import ${importName} from '${moduleName}';`;
      } else {
        return `import ${importName} from '${moduleName}';`;
      }
    }
  },
  // module.exports to export default
  {
    test: /module\.exports\s+=\s+([^;]+);?/g,
    replace: (match, exportValue) => `export default ${exportValue};`
  },
  // Add __dirname and __filename equivalents
  {
    test: /(?:const|let|var)?\s*\{?\s*__dirname\s*\}?\s*=\s*[^;]+;?/g,
    replace: () => `import { fileURLToPath } from 'url';\nimport path from 'path';\n\nconst __filename = fileURLToPath(import.meta.url);\nimport { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);`
  }
];

/**
 * Scans a directory recursively for JavaScript files
 * @param {string} dir - Directory to scan
 * @returns {Promise<string[]>} - Array of file paths
 */
async function scanDirectory(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    // Skip ignored files and directories
    if (CONFIG.ignoreFiles.some(ignore => fullPath.includes(ignore))) {
      continue;
    }
    
    if (entry.isDirectory()) {
      files.push(...await scanDirectory(fullPath));
    } else if (CONFIG.extensions.includes(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * Analyzes a file for CommonJS patterns
 * @param {string} filePath - Path to the file
 * @returns {Object} - Analysis results
 */
function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const results = {
    path: filePath,
    hasCommonJS: false,
    requireCount: 0,
    exportCount: 0,
    changes: []
  };
  
  // Check for CommonJS patterns
  if (content.includes('require(')) {
    results.hasCommonJS = true;
    results.requireCount = (content.match(/require\(/g) || []).length;
  }
  
  if (content.includes('module.exports')) {
    results.hasCommonJS = true;
    results.exportCount = (content.match(/module\.exports/g) || []).length;
  }
  
  // Apply patterns to get potential changes
  let modifiedContent = content;
  let hasChanges = false;
  
  for (const pattern of PATTERNS) {
    const matches = content.match(pattern.test);
    if (matches) {
      modifiedContent = modifiedContent.replace(pattern.test, pattern.replace);
      hasChanges = true;
      
      results.changes.push({
        pattern: pattern.test.toString(),
        matches: matches.length
      });
    }
  }
  
  results.modifiedContent = hasChanges ? modifiedContent : null;
  
  return results;
}

/**
 * Fixes a file by converting CommonJS to ES modules
 * @param {string} filePath - Path to the file
 * @param {string} modifiedContent - New content
 */
function fixFile(filePath, modifiedContent) {
  if (CONFIG.dryRun) {
    console.log(`Would fix: ${filePath}`);
    return;
  }
  
  console.log(`Fixing: ${filePath}`);
  fs.writeFileSync(filePath, modifiedContent, 'utf8');
}

/**
 * Main function
 */
async function main() {
  console.log('ALEJO Module System Fixer');
  console.log('========================');
  console.log(`Project root: ${PROJECT_ROOT}`);
  console.log(`Mode: ${CONFIG.dryRun ? 'Dry run (no changes)' : 'Fix mode (will modify files)'}`);
  console.log();
  
  // Scan directories
  const allFiles = [];
  for (const dir of CONFIG.scanDirs) {
    const dirPath = path.join(PROJECT_ROOT, dir);
    if (fs.existsSync(dirPath)) {
      console.log(`Scanning ${dir}...`);
      const files = await scanDirectory(dirPath);
      allFiles.push(...files);
    }
  }
  
  console.log(`Found ${allFiles.length} JavaScript files to analyze`);
  
  // Analyze files
  const results = {
    total: allFiles.length,
    commonJS: 0,
    fixed: 0,
    errors: 0
  };
  
  for (const file of allFiles) {
    try {
      const analysis = analyzeFile(file);
      
      if (analysis.hasCommonJS) {
        results.commonJS++;
        console.log(`\n${file} (${analysis.requireCount} requires, ${analysis.exportCount} exports)`);
        
        if (analysis.modifiedContent) {
          fixFile(file, analysis.modifiedContent);
          results.fixed++;
        }
      }
    } catch (error) {
      console.error(`Error processing ${file}: ${error.message}`);
      results.errors++;
    }
  }
  
  // Summary
  console.log('\nSummary:');
  console.log(`Total files analyzed: ${results.total}`);
  console.log(`Files with CommonJS patterns: ${results.commonJS}`);
  console.log(`Files fixed: ${results.fixed}`);
  console.log(`Errors: ${results.errors}`);
  
  if (CONFIG.dryRun) {
    console.log('\nThis was a dry run. No files were modified.');
    console.log('To apply fixes, set CONFIG.dryRun = false');
  }
}

// Run the script
main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
