import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Basic accessibility test that checks HTML files for common issues
 */
function runAccessibilityTests() {
    console.log('--- Running Accessibility Tests ---');
    
    const publicDir = path.join(__dirname, '../../public');
    const htmlFiles = [];
    
    // Find HTML files in public directory
    if (fs.existsSync(publicDir)) {
        const files = fs.readdirSync(publicDir);
        files.forEach(file => {
            if (file.endsWith('.html')) {
                htmlFiles.push(path.join(publicDir, file));
            }
        });
    }
    
    if (htmlFiles.length === 0) {
        console.log('No HTML files found to test.');
        return true;
    }
    
    let allTestsPassed = true;
    
    htmlFiles.forEach(filePath => {
        console.log(`\nTesting: ${path.basename(filePath)}`);
        
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const issues = checkAccessibilityIssues(content);
            
            if (issues.length === 0) {
                console.log('  ✓ No accessibility issues found');
            } else {
                console.log('  ✗ Accessibility issues found:');
                issues.forEach(issue => {
                    console.log(`    - ${issue}`);
                });
                allTestsPassed = false;
            }
        } catch (error) {
            console.error(`  Error reading file: ${error.message}`);
            allTestsPassed = false;
        }
    });
    
    return allTestsPassed;
}

/**
 * Check for basic accessibility issues in HTML content
 */
function checkAccessibilityIssues(htmlContent) {
    const issues = [];
    
    // Check for missing lang attribute
    if (!/<html[^>]*\slang\s*=/i.test(htmlContent)) {
        issues.push('Missing lang attribute on <html> element');
    }
    
    // Check for images without alt attributes
    const imgMatches = htmlContent.match(/<img[^>]*>/gi) || [];
    imgMatches.forEach(img => {
        if (!/alt\s*=/i.test(img)) {
            issues.push('Image missing alt attribute');
        }
    });
    
    // Check for missing page title
    if (!/<title[^>]*>[^<]+<\/title>/i.test(htmlContent)) {
        issues.push('Missing or empty page title');
    }
    
    // Check for proper heading structure (at least one h1)
    if (!/<h1[^>]*>/i.test(htmlContent)) {
        issues.push('Missing h1 heading');
    }
    
    // Check for form inputs without labels
    const inputMatches = htmlContent.match(/<input[^>]*>/gi) || [];
    inputMatches.forEach(input => {
        if (/type\s*=\s*["']?(text|email|password|number|tel|url)["']?/i.test(input)) {
            const hasId = /id\s*=\s*["']([^"']+)["']/i.exec(input);
            if (hasId) {
                const id = hasId[1];
                const labelRegex = new RegExp(`<label[^>]*for\s*=\s*["']${id}["'][^>]*>`, 'i');
                if (!labelRegex.test(htmlContent)) {
                    issues.push(`Input with id="${id}" missing associated label`);
                }
            } else {
                issues.push('Input missing id attribute for label association');
            }
        }
    });
    
    return issues;
}

// Run the tests
const testsPassed = runAccessibilityTests();

if (testsPassed) {
    console.log('\n✓ All accessibility tests passed');
    process.exit(0);
} else {
    console.log('\n✗ Some accessibility tests failed');
    process.exit(1);
}
