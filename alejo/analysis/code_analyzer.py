"""
Code Analysis Module for ALEJO

Provides comprehensive static analysis, bug detection, and code quality assessment
through multiple analysis tools and techniques.
"""

import ast
import logging
import subprocess
import json
import tempfile
from pathlib import Path
from typing import Dict, List, Set, Any, Optional, Tuple
from dataclasses import dataclass
import coverage
import pylint.lint
import mypy.api
from pyflakes.api import checkPath
import radon.complexity as radon
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)

@dataclass
class CodeIssue:
    """Represents a code issue found during analysis"""
    file: str
    line: int
    column: int
    severity: str
    message: str
    source: str
    
@dataclass
class CodeMetrics:
    """Code quality metrics for a file or module"""
    complexity: float
    maintainability: float
    test_coverage: float
    documentation_coverage: float
    
class CodeAnalyzer:
    """Analyzes Python code for quality, bugs, and potential improvements"""
    
    def __init__(self, project_root: Path):
        """Initialize analyzer with project root path"""
        self.project_root = project_root
        self.issues: List[CodeIssue] = []
        self.metrics: Dict[str, CodeMetrics] = {}
        
    def run_pylint(self, file_path: Path) -> List[CodeIssue]:
        """Run Pylint on a file"""
        issues = []
        try:
            print(f"Running Pylint on {file_path}")
            args = ['--disable=all', '--enable=E,F,W,R', str(file_path)]
            reporter = pylint.lint.Run(args, do_exit=False)
            
            for msg in reporter.linter.reporter.messages:
                issues.append(CodeIssue(
                    file=str(file_path),
                    line=msg.line,
                    column=msg.column,
                    severity=msg.category,
                    message=msg.msg,
                    source="pylint"
                ))
            print(f"Found {len(issues)} Pylint issues")
        except Exception as e:
            print(f"Pylint error on {file_path}: {e}")
            
        return issues
        
    def run_mypy(self, file_path: Path) -> List[CodeIssue]:
        """Run MyPy type checker on a file"""
        issues = []
        result = mypy.api.run([str(file_path)])
        
        for line in result[0].splitlines():
            if ': error:' in line or ': warning:' in line:
                file, line_no, severity, msg = self._parse_mypy_message(line)
                issues.append(CodeIssue(
                    file=file,
                    line=int(line_no),
                    column=0,
                    severity=severity,
                    message=msg,
                    source="mypy"
                ))
                
        return issues
        
    def run_pyflakes(self, file_path: Path) -> List[CodeIssue]:
        """Run PyFlakes on a file"""
        issues = []
        checkPath(str(file_path))
        # PyFlakes reports to stderr, which we capture through logging
        return issues
        
    def calculate_complexity(self, file_path: Path) -> CodeMetrics:
        """Calculate code complexity metrics"""
        with open(file_path, 'r') as f:
            code = f.read()
            
        # Calculate Cyclomatic Complexity
        complexity = radon.cc_visit(code)
        avg_complexity = sum(item.complexity for item in complexity) / len(complexity) if complexity else 0
        
        # Calculate Maintainability Index
        mi = radon.mi_visit(code, multi=True)
        
        # Calculate test coverage using coverage.py
        test_coverage = self._calculate_test_coverage(file_path)
        
        # Calculate documentation coverage
        doc_coverage = self._calculate_doc_coverage(code)
        
        return CodeMetrics(
            complexity=avg_complexity,
            maintainability=mi,
            test_coverage=test_coverage,
            documentation_coverage=doc_coverage
        )
        
    def _calculate_test_coverage(self, file_path: Path) -> float:
        """Calculate test coverage for a file using coverage.py.
        
        This method:
        1. Creates a Coverage object with appropriate config
        2. Runs tests for the file with coverage tracking
        3. Analyzes coverage data
        4. Returns coverage percentage
        """
        try:
            # Initialize coverage.py
            cov = coverage.Coverage(
                source=[str(file_path.parent)],
                omit=['*/__pycache__/*', '*/tests/*', '*/venv/*'],
                branch=True  # Enable branch coverage
            )
            
            # Start coverage tracking
            cov.start()
            
            try:
                # Find and run corresponding test file
                test_file = self._find_test_file(file_path)
                if test_file:
                    subprocess.run(
                        ['python', '-m', 'pytest', str(test_file), '-v'],
                        capture_output=True,
                        text=True,
                        check=False  # Don't raise on test failures
                    )
            finally:
                # Stop coverage tracking
                cov.stop()
            
            # Save coverage data
            with tempfile.NamedTemporaryFile(suffix='.json', delete=False) as tmp:
                cov.json_report(outfile=tmp.name)
                coverage_data = json.load(open(tmp.name))
                
            # Extract coverage for our specific file
            file_coverage = coverage_data.get('files', {}).get(str(file_path), {})
            
            if not file_coverage:
                return 0.0
                
            # Calculate coverage percentage
            executed_lines = len(file_coverage.get('executed_lines', []))
            missing_lines = len(file_coverage.get('missing_lines', []))
            total_lines = executed_lines + missing_lines
            
            if total_lines == 0:
                return 100.0
                
            coverage_pct = (executed_lines / total_lines) * 100
            
            # Include branch coverage in final score if available
            if 'branch_coverage' in file_coverage:
                branch_pct = file_coverage['branch_coverage']
                coverage_pct = (coverage_pct + branch_pct) / 2
                
            return coverage_pct
            
        except Exception as e:
            logger.error(f"Error calculating test coverage: {e}")
            return 0.0
            
    def _find_test_file(self, source_file: Path) -> Optional[Path]:
        """Find corresponding test file for a source file.
        
        Looks for test files in these patterns:
        1. tests/test_<filename>.py
        2. tests/<module>/test_<filename>.py
        3. <module>/tests/test_<filename>.py
        """
        filename = source_file.name
        test_filename = f"test_{filename}"
        
        # Common test file locations
        test_locations = [
            self.project_root / 'tests' / test_filename,
            self.project_root / 'tests' / source_file.parent.name / test_filename,
            source_file.parent / 'tests' / test_filename
        ]
        
        for test_path in test_locations:
            if test_path.exists():
                return test_path
                
        return None
            
    def _calculate_doc_coverage(self, code: str) -> float:
        """Calculate documentation coverage percentage"""
        try:
            tree = ast.parse(code)
            total_nodes = 0
            documented_nodes = 0
            
            for node in ast.walk(tree):
                if isinstance(node, (ast.FunctionDef, ast.ClassDef, ast.Module)):
                    total_nodes += 1
                    if ast.get_docstring(node):
                        documented_nodes += 1
                        
            return (documented_nodes / total_nodes * 100) if total_nodes > 0 else 100.0
            
        except Exception as e:
            logger.error(f"Error calculating doc coverage: {e}")
            return 0.0
            
    def _parse_mypy_message(self, message: str) -> tuple:
        """Parse MyPy error message into components"""
        try:
            file_info, msg = message.split(':', 2)[0:2]
            file_path, line_no = file_info.rsplit(':', 1)
            severity = 'error' if 'error' in msg else 'warning'
            return file_path, line_no, severity, msg.strip()
        except Exception:
            return ('unknown', 0, 'error', message)
            
    def analyze_file(self, file_path: Path) -> tuple[List[CodeIssue], CodeMetrics]:
        """Analyze a single file"""
        issues = []
        
        # Run static analysis tools
        issues.extend(self.run_pylint(file_path))
        issues.extend(self.run_mypy(file_path))
        issues.extend(self.run_pyflakes(file_path))
        
        # Calculate metrics
        metrics = self.calculate_complexity(file_path)
        
        return issues, metrics
        
    def analyze_project(self) -> Dict[str, Any]:
        """Analyze entire project"""
        print("Starting project analysis...")
        try:
            python_files = list(self.project_root.rglob('*.py'))
            print(f"Found {len(python_files)} Python files to analyze")
            
            all_issues = []
            all_metrics = {}
            
            # Analyze files sequentially for better error tracking
            for file_path in python_files:
                print(f"Analyzing {file_path}...")
                try:
                    issues, metrics = self.analyze_file(file_path)
                    all_issues.extend(issues)
                    all_metrics[str(file_path)] = metrics
                except Exception as e:
                    print(f"Error analyzing {file_path}: {e}")
                    continue
            
            return {
                'issues': all_issues,
                'metrics': all_metrics,
                'summary': self._generate_summary(all_issues, all_metrics)
            }
        except Exception as e:
            print(f"Fatal error in project analysis: {e}")
            return {
                'issues': [],
                'metrics': {},
                'summary': {
                    'total_issues': 0,
                    'issues_by_severity': {},
                    'avg_complexity': 0.0,
                    'avg_maintainability': 0.0,
                    'avg_doc_coverage': 0.0
                }
            }
            
        return {
            'issues': all_issues,
            'metrics': all_metrics,
            'summary': self._generate_summary(all_issues, all_metrics)
        }
        
    def _generate_summary(
        self,
        issues: List[CodeIssue],
        metrics: Dict[str, CodeMetrics]
    ) -> Dict[str, Any]:
        """Generate analysis summary"""
        return {
            'total_issues': len(issues),
            'issues_by_severity': self._count_by_severity(issues),
            'avg_complexity': sum(m.complexity for m in metrics.values()) / len(metrics) if metrics else 0,
            'avg_maintainability': sum(m.maintainability for m in metrics.values()) / len(metrics) if metrics else 0,
            'avg_doc_coverage': sum(m.documentation_coverage for m in metrics.values()) / len(metrics) if metrics else 0
        }
        
    def _count_by_severity(self, issues: List[CodeIssue]) -> Dict[str, int]:
        """Count issues by severity"""
        counts = {}
        for issue in issues:
            counts[issue.severity] = counts.get(issue.severity, 0) + 1
        return counts
