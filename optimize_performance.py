#!/usr/bin/env python3
"""
ALEJO Performance Optimizer
Analyzes and optimizes ALEJO for maximum performance
"""
import os
import sys
import time
import logging
import json
import shutil
import subprocess
from pathlib import Path
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('logs/optimization.log')
    ]
)

logger = logging.getLogger(__name__)

# Create logs directory if it doesn't exist
os.makedirs('logs', exist_ok=True)

# Add the current directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))


class ALEJOPerformanceOptimizer:
    """Optimizes ALEJO for maximum performance"""
    
    def __init__(self):
        """Initialize the optimizer"""
        self.project_root = Path(os.path.dirname(os.path.abspath(__file__)))
        self.static_dir = self.project_root / 'core' / 'web' / 'static'
        self.js_dir = self.static_dir / 'js'
        self.css_dir = self.static_dir / 'css'
        self.images_dir = self.static_dir / 'images'
        self.backup_dir = self.project_root / 'backups' / f'pre_optimization_{datetime.now().strftime("%Y%m%d_%H%M%S")}'
        
        # Create backup directory
        os.makedirs(self.backup_dir, exist_ok=True)
        
        # Results tracking
        self.results = {
            'js_optimization': {'files': 0, 'size_before': 0, 'size_after': 0},
            'css_optimization': {'files': 0, 'size_before': 0, 'size_after': 0},
            'startup_time': {'before': 0, 'after': 0},
            'memory_usage': {'before': 0, 'after': 0}
        }
    
    def backup_files(self):
        """Create backups of files before optimization"""
        logger.info("Creating backups of files before optimization...")
        
        # Backup JS files
        js_backup_dir = self.backup_dir / 'js'
        os.makedirs(js_backup_dir, exist_ok=True)
        for js_file in self.js_dir.glob('*.js'):
            shutil.copy2(js_file, js_backup_dir / js_file.name)
        
        # Backup CSS files
        css_backup_dir = self.backup_dir / 'css'
        os.makedirs(css_backup_dir, exist_ok=True)
        for css_file in self.css_dir.glob('*.css'):
            shutil.copy2(css_file, css_backup_dir / css_file.name)
        
        logger.info(f"Backups created in {self.backup_dir}")
        return True
    
    def measure_startup_time(self):
        """Measure ALEJO startup time"""
        logger.info("Measuring startup time...")
        
        try:
            # Add project root to path to ensure imports work
            sys.path.insert(0, str(self.project_root))
            
            # Import required modules
            try:
                from core.brain import ALEJOBrain
                from core.voice import VoiceService
                from core.web.web_interface.__init__ import ALEJOWebInterface
            except ImportError as e:
                logger.error(f"Import error: {e}")
                logger.info("Trying alternative import paths...")
                # Try alternative import path
                from core.brain.brain import ALEJOBrain
                from core.voice.voice import VoiceService
                from core.web.web_interface import ALEJOWebInterface
            
            # Measure time to initialize components
            start_time = time.time()
            
            brain = ALEJOBrain()
            voice = VoiceService()
            config = {"port": 5000, "host": "127.0.0.1", "debug": False}
            web_interface = ALEJOWebInterface(brain, voice, config)
            
            end_time = time.time()
            startup_time = end_time - start_time
            
            logger.info(f"Startup time: {startup_time:.2f} seconds")
            self.results['startup_time']['before'] = startup_time
            
            return True
        except Exception as e:
            logger.error(f"Error measuring startup time: {e}")
            logger.exception("Detailed error:")
            return False
    
    def measure_memory_usage(self):
        """Measure memory usage of ALEJO"""
        logger.info("Measuring memory usage...")
        
        try:
            import psutil
            
            # Get current process
            process = psutil.Process(os.getpid())
            
            # Measure memory before loading ALEJO
            memory_before = process.memory_info().rss / (1024 * 1024)  # MB
            
            # Add project root to path to ensure imports work
            sys.path.insert(0, str(self.project_root))
            
            # Import and initialize ALEJO components
            try:
                from core.brain import ALEJOBrain
                from core.voice import VoiceService
                from core.web.web_interface.__init__ import ALEJOWebInterface
            except ImportError as e:
                logger.error(f"Import error: {e}")
                logger.info("Trying alternative import paths...")
                # Try alternative import path
                from core.brain.brain import ALEJOBrain
                from core.voice.voice import VoiceService
                from core.web.web_interface import ALEJOWebInterface
            
            brain = ALEJOBrain()
            voice = VoiceService()
            config = {"port": 5000, "host": "127.0.0.1", "debug": False}
            web_interface = ALEJOWebInterface(brain, voice, config)
            
            # Measure memory after loading ALEJO
            memory_after = process.memory_info().rss / (1024 * 1024)  # MB
            memory_usage = memory_after - memory_before
            
            logger.info(f"Memory usage: {memory_usage:.2f} MB")
            self.results['memory_usage']['before'] = memory_usage
            
            return True
        except ImportError:
            logger.warning("psutil not available, skipping memory measurement")
            return False
        except Exception as e:
            logger.error(f"Error measuring memory usage: {e}")
            logger.exception("Detailed error:")
            return False
    
    def optimize_js_files(self):
        """Optimize JavaScript files"""
        logger.info("Optimizing JavaScript files...")
        
        # Create optimized directory
        optimized_dir = self.js_dir / 'optimized'
        os.makedirs(optimized_dir, exist_ok=True)
        
        total_size_before = 0
        total_size_after = 0
        files_processed = 0
        
        for js_file in self.js_dir.glob('*.js'):
            # Skip already minified files
            if '.min.' in js_file.name:
                continue
            
            logger.info(f"Optimizing {js_file.name}...")
            
            # Get original file size
            original_size = os.path.getsize(js_file)
            total_size_before += original_size
            
            # Read file content
            with open(js_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Basic minification
            # Remove comments (simple approach)
            lines = []
            in_multiline_comment = False
            for line in content.split('\n'):
                if in_multiline_comment:
                    if '*/' in line:
                        in_multiline_comment = False
                        line = line.split('*/', 1)[1]
                    else:
                        continue
                
                if '/*' in line:
                    if '*/' in line:
                        line = line.split('/*')[0] + line.split('*/', 1)[1]
                    else:
                        line = line.split('/*')[0]
                        in_multiline_comment = True
                
                if not in_multiline_comment:
                    if '//' in line:
                        line = line.split('//')[0]
                    if line.strip():
                        lines.append(line)
            
            # Join lines and remove extra whitespace
            minified = ' '.join([line.strip() for line in lines])
            minified = minified.replace('{ ', '{').replace(' }', '}')
            minified = minified.replace('; ', ';').replace(', ', ',')
            minified = minified.replace('  ', ' ')
            
            # Create minified filename
            minified_file = optimized_dir / f"{js_file.stem}.min.js"
            
            # Write minified content
            with open(minified_file, 'w', encoding='utf-8') as f:
                f.write(minified)
            
            # Get minified file size
            minified_size = os.path.getsize(minified_file)
            total_size_after += minified_size
            
            # Calculate reduction
            reduction = (1 - (minified_size / original_size)) * 100
            logger.info(f"Reduced {js_file.name} by {reduction:.1f}% ({original_size / 1024:.1f} KB -> {minified_size / 1024:.1f} KB)")
            
            files_processed += 1
        
        # Update results
        self.results['js_optimization']['files'] = files_processed
        self.results['js_optimization']['size_before'] = total_size_before
        self.results['js_optimization']['size_after'] = total_size_after
        
        logger.info(f"Processed {files_processed} JavaScript files")
        logger.info(f"Total size reduction: {total_size_before / 1024:.1f} KB -> {total_size_after / 1024:.1f} KB")
        
        return optimized_dir
    
    def optimize_css_files(self):
        """Optimize CSS files"""
        logger.info("Optimizing CSS files...")
        
        # Create optimized directory
        optimized_dir = self.css_dir / 'optimized'
        os.makedirs(optimized_dir, exist_ok=True)
        
        total_size_before = 0
        total_size_after = 0
        files_processed = 0
        
        for css_file in self.css_dir.glob('*.css'):
            # Skip already minified files
            if '.min.' in css_file.name:
                continue
            
            logger.info(f"Optimizing {css_file.name}...")
            
            # Get original file size
            original_size = os.path.getsize(css_file)
            total_size_before += original_size
            
            # Read file content
            with open(css_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Basic minification
            # Remove comments
            while '/*' in content and '*/' in content:
                start = content.find('/*')
                end = content.find('*/', start) + 2
                content = content[:start] + content[end:]
            
            # Remove newlines and extra spaces
            minified = ' '.join([line.strip() for line in content.split('\n')])
            minified = minified.replace('  ', ' ')
            minified = minified.replace(' {', '{').replace('{ ', '{')
            minified = minified.replace(' }', '}').replace('} ', '}')
            minified = minified.replace(' ;', ';').replace('; ', ';')
            minified = minified.replace(' :', ':').replace(': ', ':')
            minified = minified.replace(' ,', ',').replace(', ', ',')
            
            # Create minified filename
            minified_file = optimized_dir / f"{css_file.stem}.min.css"
            
            # Write minified content
            with open(minified_file, 'w', encoding='utf-8') as f:
                f.write(minified)
            
            # Get minified file size
            minified_size = os.path.getsize(minified_file)
            total_size_after += minified_size
            
            # Calculate reduction
            reduction = (1 - (minified_size / original_size)) * 100
            logger.info(f"Reduced {css_file.name} by {reduction:.1f}% ({original_size / 1024:.1f} KB -> {minified_size / 1024:.1f} KB)")
            
            files_processed += 1
        
        # Update results
        self.results['css_optimization']['files'] = files_processed
        self.results['css_optimization']['size_before'] = total_size_before
        self.results['css_optimization']['size_after'] = total_size_after
        
        logger.info(f"Processed {files_processed} CSS files")
        logger.info(f"Total size reduction: {total_size_before / 1024:.1f} KB -> {total_size_after / 1024:.1f} KB")
        
        return optimized_dir
    
    def update_html_references(self, js_dir, css_dir):
        """Update HTML templates to use optimized files"""
        logger.info("Updating HTML templates to use optimized files...")
        
        templates_dir = self.project_root / 'core' / 'web' / 'templates'
        
        if not templates_dir.exists():
            logger.warning(f"Templates directory not found at {templates_dir}")
            logger.info("Searching for templates directory...")
            
            # Try to find templates directory
            for templates_path in self.project_root.glob('**/templates'):
                if templates_path.is_dir():
                    templates_dir = templates_path
                    logger.info(f"Found templates directory at {templates_dir}")
                    break
        
        if not templates_dir.exists():
            logger.error("Could not find templates directory")
            return False
        
        # Create backup directory for templates
        html_backup_dir = self.backup_dir / 'templates'
        os.makedirs(html_backup_dir, exist_ok=True)
        
        # Process each HTML file
        html_files = list(templates_dir.glob('*.html'))
        if not html_files:
            logger.warning(f"No HTML files found in {templates_dir}")
            return False
        
        for html_file in html_files:
            logger.info(f"Updating {html_file.name}...")
            
            try:
                # Read file content
                with open(html_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Backup original file
                shutil.copy2(html_file, html_backup_dir / html_file.name)
                
                # Update JS references
                for js_file in self.js_dir.glob('*.js'):
                    if '.min.' in js_file.name:
                        continue
                    
                    # Check for different reference patterns
                    js_patterns = [
                        f'static/js/{js_file.name}',
                        f'/static/js/{js_file.name}',
                        f'../static/js/{js_file.name}',
                        f'js/{js_file.name}'
                    ]
                    
                    min_js_path = f'static/js/optimized/{js_file.stem}.min.js'
                    
                    for pattern in js_patterns:
                        if pattern in content:
                            content = content.replace(pattern, min_js_path)
                            logger.info(f"  Replaced JS reference: {pattern} -> {min_js_path}")
                
                # Update CSS references
                for css_file in self.css_dir.glob('*.css'):
                    if '.min.' in css_file.name:
                        continue
                    
                    # Check for different reference patterns
                    css_patterns = [
                        f'static/css/{css_file.name}',
                        f'/static/css/{css_file.name}',
                        f'../static/css/{css_file.name}',
                        f'css/{css_file.name}'
                    ]
                    
                    min_css_path = f'static/css/optimized/{css_file.stem}.min.css'
                    
                    for pattern in css_patterns:
                        if pattern in content:
                            content = content.replace(pattern, min_css_path)
                            logger.info(f"  Replaced CSS reference: {pattern} -> {min_css_path}")
                
                # Write updated content
                with open(html_file, 'w', encoding='utf-8') as f:
                    f.write(content)
                
                logger.info(f"Updated {html_file.name}")
                
            except Exception as e:
                logger.error(f"Error updating {html_file.name}: {e}")
                logger.exception("Detailed error:")
        
        return True
    
    def generate_report(self):
        """Generate optimization report"""
        logger.info("Generating optimization report...")
        
        report = {
            'timestamp': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            'results': self.results,
            'summary': {
                'js_files_optimized': self.results['js_optimization']['files'],
                'js_size_reduction': self.results['js_optimization']['size_before'] - self.results['js_optimization']['size_after'],
                'js_size_reduction_percent': 0,
                'css_files_optimized': self.results['css_optimization']['files'],
                'css_size_reduction': self.results['css_optimization']['size_before'] - self.results['css_optimization']['size_after'],
                'css_size_reduction_percent': 0,
                'total_size_reduction': 0,
                'total_size_reduction_percent': 0
            }
        }
        
        # Calculate percentages
        if self.results['js_optimization']['size_before'] > 0:
            report['summary']['js_size_reduction_percent'] = (1 - (self.results['js_optimization']['size_after'] / self.results['js_optimization']['size_before'])) * 100
        
        if self.results['css_optimization']['size_before'] > 0:
            report['summary']['css_size_reduction_percent'] = (1 - (self.results['css_optimization']['size_after'] / self.results['css_optimization']['size_before'])) * 100
        
        total_before = self.results['js_optimization']['size_before'] + self.results['css_optimization']['size_before']
        total_after = self.results['js_optimization']['size_after'] + self.results['css_optimization']['size_after']
        report['summary']['total_size_reduction'] = total_before - total_after
        
        if total_before > 0:
            report['summary']['total_size_reduction_percent'] = (1 - (total_after / total_before)) * 100
        
        # Write report to file
        report_file = self.project_root / 'optimization_report.json'
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2)
        
        logger.info(f"Optimization report saved to {report_file}")
        
        # Print summary
        logger.info("Optimization Summary:")
        logger.info(f"JavaScript: {report['summary']['js_files_optimized']} files optimized, {report['summary']['js_size_reduction'] / 1024:.1f} KB saved ({report['summary']['js_size_reduction_percent']:.1f}%)")
        logger.info(f"CSS: {report['summary']['css_files_optimized']} files optimized, {report['summary']['css_size_reduction'] / 1024:.1f} KB saved ({report['summary']['css_size_reduction_percent']:.1f}%)")
        logger.info(f"Total: {report['summary']['total_size_reduction'] / 1024:.1f} KB saved ({report['summary']['total_size_reduction_percent']:.1f}%)")
        
        return report_file


def main():
    """Main entry point"""
    logger.info("Starting ALEJO Performance Optimizer...")
    
    try:
        optimizer = ALEJOPerformanceOptimizer()
        
        # Check if static directories exist
        if not optimizer.static_dir.exists():
            logger.error(f"Static directory not found at {optimizer.static_dir}")
            logger.info("Searching for static directory...")
            
            # Try to find static directory
            found = False
            for static_path in optimizer.project_root.glob('**/static'):
                if static_path.is_dir():
                    optimizer.static_dir = static_path
                    optimizer.js_dir = static_path / 'js'
                    optimizer.css_dir = static_path / 'css'
                    optimizer.images_dir = static_path / 'images'
                    logger.info(f"Found static directory at {optimizer.static_dir}")
                    found = True
                    break
            
            if not found:
                logger.error("Could not find static directory. Aborting optimization.")
                return False
        
        # Check if JS and CSS directories exist
        if not optimizer.js_dir.exists():
            logger.error(f"JavaScript directory not found at {optimizer.js_dir}")
            return False
        
        if not optimizer.css_dir.exists():
            logger.error(f"CSS directory not found at {optimizer.css_dir}")
            return False
        
        # Create backups
        logger.info("Creating backups of original files...")
        if not optimizer.backup_files():
            logger.error("Failed to create backups. Aborting optimization.")
            return False
        
        # Measure performance before optimization
        logger.info("Measuring initial performance metrics...")
        startup_success = optimizer.measure_startup_time()
        memory_success = optimizer.measure_memory_usage()
        
        if not startup_success and not memory_success:
            logger.warning("Could not measure performance metrics. Continuing with file optimization only.")
        
        # Optimize files
        logger.info("Optimizing JavaScript files...")
        js_dir = optimizer.optimize_js_files()
        
        logger.info("Optimizing CSS files...")
        css_dir = optimizer.optimize_css_files()
        
        # Update HTML references
        logger.info("Updating HTML references to use optimized files...")
        optimizer.update_html_references(js_dir, css_dir)
        
        # Generate report
        logger.info("Generating optimization report...")
        report_file = optimizer.generate_report()
        
        logger.info("ALEJO Performance Optimization complete!")
        logger.info(f"Optimization report saved to {report_file}")
        logger.info("To use the original files, restore from the backup directory.")
        
        return True
    
    except Exception as e:
        logger.error(f"Error during optimization: {e}")
        logger.exception("Detailed error:")
        return False


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)