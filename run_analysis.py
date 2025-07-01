"""
Code Analysis Runner for ALEJO

Runs comprehensive code analysis across the entire ALEJO codebase
and generates detailed reports of issues and metrics.
"""

import asyncio
import json
import sys
import traceback
from pathlib import Path
import logging
from datetime import datetime

from alejo.analysis.code_analyzer import CodeAnalyzer

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,  # Set to DEBUG for more verbose output
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('analysis_debug.log')
    ]
)
logger = logging.getLogger(__name__)

async def main():
    """Run code analysis and generate reports"""
    try:
        project_root = Path(__file__).parent
        logger.debug(f"Project root: {project_root}")
        
        logger.info("Starting ALEJO code analysis...")
        logger.debug("Initializing CodeAnalyzer...")
        analyzer = CodeAnalyzer(project_root)
        logger.debug("CodeAnalyzer initialized successfully")
        
        # Run analysis
        results = analyzer.analyze_project()
        
        # Save results
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_dir = project_root / 'analysis_reports'
        output_dir.mkdir(exist_ok=True)
        
        report_file = output_dir / f'analysis_report_{timestamp}.json'
        with open(report_file, 'w') as f:
            json.dump(results, f, indent=2)
            
        # Print summary
        summary = results['summary']
        print("\nCode Analysis Summary:")
        print("-" * 40)
        print(f"Total Issues Found: {summary['total_issues']}")
        print("\nIssues by Severity:")
        for severity, count in summary['issues_by_severity'].items():
            print(f"  {severity}: {count}")
        print("\nMetrics:")
        print(f"  Average Complexity: {summary['avg_complexity']:.2f}")
        print(f"  Average Maintainability: {summary['avg_maintainability']:.2f}")
        print(f"  Average Documentation Coverage: {summary['avg_doc_coverage']:.1f}%")
        
        print(f"\nDetailed report saved to: {report_file}")
        
        # List files with most issues
        print("\nTop Files by Issue Count:")
        file_issues = {}
        for issue in results['issues']:
            file_issues[issue['file']] = file_issues.get(issue['file'], 0) + 1
            
        sorted_files = sorted(file_issues.items(), key=lambda x: x[1], reverse=True)
        for file, count in sorted_files[:5]:
            print(f"  {file}: {count} issues")
            
    except Exception as e:
        logger.error(f"Analysis failed: {e}")
        raise

if __name__ == '__main__':
    try:
        logger.debug("Starting analysis script...")
        asyncio.run(main())
        logger.debug("Analysis script completed successfully")
    except Exception as e:
        logger.error(f"Fatal error in analysis script: {e}")
        logger.error(traceback.format_exc())
        sys.exit(1)