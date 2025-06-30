"""
Code-level self-healing system for ALEJO.
Provides static analysis, code quality metrics, and automated refactoring suggestions.
"""

import ast
import logging
import radon.complexity as radon_cc
import radon.metrics as radon_metrics
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass
from pathlib import Path
import git

from alejo.core.event_bus import EventBus
from alejo.utils.error_handling import ErrorTracker
from alejo.services.llm_service import LLMService

logger = logging.getLogger(__name__)

@dataclass
class CodeMetrics:
    """Metrics for a code unit (file, class, or function)"""
    complexity: float
    maintainability: float
    loc: int
    comments: int
    issues: List[str]
    suggestions: List[str]

@dataclass
class RefactoringProposal:
    """Proposed code refactoring"""
    file_path: str
    original_code: str
    suggested_code: str
    reason: str
    confidence: float
    impact: str
    risk_level: str

class CodeHealingSystem:
    """
    System for analyzing and healing code-level issues.
    
    Features:
    - Static code analysis
    - Complexity metrics
    - Automated refactoring suggestions
    - Safe code modification
    """
    
    def __init__(self, event_bus: EventBus, llm_service: Optional[LLMService] = None):
        """Initialize the code healing system"""
        self.event_bus = event_bus
        self.llm_service = llm_service
        self.error_tracker = ErrorTracker()
        self.repo = git.Repo(".")
        self.analysis_cache: Dict[str, CodeMetrics] = {}
        
    async def analyze_codebase(self, root_dir: str) -> Dict[str, CodeMetrics]:
        """
        Analyze entire codebase for issues and opportunities
        
        Args:
            root_dir: Root directory of the codebase
            
        Returns:
            Dictionary mapping file paths to code metrics
        """
        results = {}
        root_path = Path(root_dir)
        
        for py_file in root_path.rglob("*.py"):
            try:
                metrics = await self.analyze_file(str(py_file))
                results[str(py_file)] = metrics
            except Exception as e:
                logger.error(f"Error analyzing {py_file}: {e}")
                
        return results
        
    async def analyze_file(self, file_path: str) -> CodeMetrics:
        """
        Analyze a single Python file
        
        Args:
            file_path: Path to the Python file
            
        Returns:
            CodeMetrics for the file
        """
        if file_path in self.analysis_cache:
            return self.analysis_cache[file_path]
            
        with open(file_path, 'r') as f:
            code = f.read()
            
        # Calculate Radon metrics
        cc = radon_cc.cc_visit(code)
        mi = radon_metrics.mi_visit(code, multi=True)
        raw = radon_metrics.raw_metrics(code)
        
        # Parse AST for deeper analysis
        tree = ast.parse(code)
        issues = []
        suggestions = []
        
        # Analyze code structure
        visitor = CodeAnalysisVisitor()
        visitor.visit(tree)
        issues.extend(visitor.issues)
        suggestions.extend(visitor.suggestions)
        
        # Get LLM suggestions if available
        if self.llm_service:
            try:
                llm_suggestions = await self._get_llm_suggestions(code)
                suggestions.extend(llm_suggestions)
            except Exception as e:
                logger.warning(f"Failed to get LLM suggestions: {e}")
        
        metrics = CodeMetrics(
            complexity=sum(c.complexity for c in cc),
            maintainability=mi.mi_parameters['mi'],
            loc=raw.loc,
            comments=raw.comments,
            issues=issues,
            suggestions=suggestions
        )
        
        self.analysis_cache[file_path] = metrics
        return metrics
        
    async def suggest_refactoring(self, file_path: str) -> List[RefactoringProposal]:
        """
        Generate refactoring suggestions for a file
        
        Args:
            file_path: Path to the Python file
            
        Returns:
            List of refactoring proposals
        """
        if not self.llm_service:
            return []
            
        with open(file_path, 'r') as f:
            code = f.read()
            
        # Get initial metrics
        metrics = await self.analyze_file(file_path)
        
        # Generate refactoring suggestions using LLM
        suggestions = await self._get_llm_refactoring(code, metrics)
        
        return suggestions
        
    async def apply_refactoring(self, proposal: RefactoringProposal) -> bool:
        """
        Apply a refactoring proposal in a safe manner
        
        Args:
            proposal: The refactoring proposal to apply
            
        Returns:
            True if applied successfully
        """
        try:
            # Create a new branch for the refactoring
            current = self.repo.active_branch
            branch_name = f"refactor/{Path(proposal.file_path).stem}"
            new_branch = self.repo.create_head(branch_name)
            new_branch.checkout()
            
            # Apply the change
            with open(proposal.file_path, 'w') as f:
                f.write(proposal.suggested_code)
                
            # Run tests if available
            if await self._run_tests():
                # Commit the change
                self.repo.index.add([proposal.file_path])
                self.repo.index.commit(
                    f"Refactor: {proposal.reason}\n\n"
                    f"Confidence: {proposal.confidence}\n"
                    f"Impact: {proposal.impact}\n"
                    f"Risk Level: {proposal.risk_level}"
                )
                
                # Switch back to original branch
                current.checkout()
                return True
            else:
                # Revert changes on test failure
                self.repo.git.checkout('--', proposal.file_path)
                current.checkout()
                self.repo.delete_head(new_branch)
                return False
                
        except Exception as e:
            logger.error(f"Failed to apply refactoring: {e}")
            # Ensure we're back on the original branch
            if 'current' in locals():
                current.checkout()
            return False
            
    async def _get_llm_suggestions(self, code: str) -> List[str]:
        """Get code improvement suggestions from LLM"""
        if not self.llm_service:
            return []
            
        prompt = f"""
        Analyze this Python code and suggest improvements:
        
        {code}
        
        Focus on:
        1. Code structure and organization
        2. Error handling
        3. Performance optimizations
        4. Best practices
        5. Potential bugs
        
        Format each suggestion as a brief, actionable item.
        """
        
        try:
            response = await self.llm_service.generate_text(prompt)
            suggestions = [s.strip() for s in response.split('\n') if s.strip()]
            return suggestions
        except Exception as e:
            logger.error(f"LLM suggestion error: {e}")
            return []
            
    async def _get_llm_refactoring(
        self,
        code: str,
        metrics: CodeMetrics
    ) -> List[RefactoringProposal]:
        """Get specific refactoring proposals from LLM"""
        if not self.llm_service:
            return []
            
        prompt = f"""
        Analyze this Python code and propose specific refactoring changes.
        Current metrics:
        - Complexity: {metrics.complexity}
        - Maintainability: {metrics.maintainability}
        - Lines of code: {metrics.loc}
        
        Original code:
        {code}
        
        Propose refactoring that:
        1. Reduces complexity
        2. Improves maintainability
        3. Preserves functionality
        4. Follows Python best practices
        
        For each suggestion, provide:
        1. The specific code to change
        2. The proposed replacement
        3. Reason for change
        4. Confidence level (0-1)
        5. Expected impact
        6. Risk level (low/medium/high)
        """
        
        try:
            response = await self.llm_service.generate_text(prompt)
            proposals = self._parse_llm_refactoring(response, code)
            return proposals
        except Exception as e:
            logger.error(f"LLM refactoring error: {e}")
            return []
            
    def _parse_llm_refactoring(
        self,
        llm_response: str,
        original_code: str
    ) -> List[RefactoringProposal]:
        """Parse LLM response into structured refactoring proposals"""
        # This is a simplified parser - in practice, you'd want more robust parsing
        proposals = []
        
        try:
            # Split response into sections
            sections = llm_response.split('\n\n')
            
            for section in sections:
                if not section.strip():
                    continue
                    
                lines = section.split('\n')
                if len(lines) < 6:
                    continue
                    
                # Extract proposal components
                original = lines[1].strip()
                suggested = lines[2].strip()
                reason = lines[3].strip()
                confidence = float(lines[4].strip().split(':')[1].strip())
                impact = lines[5].strip()
                risk = lines[6].strip().lower()
                
                proposals.append(RefactoringProposal(
                    file_path=original_code,
                    original_code=original,
                    suggested_code=suggested,
                    reason=reason,
                    confidence=confidence,
                    impact=impact,
                    risk_level=risk
                ))
                
        except Exception as e:
            logger.error(f"Failed to parse LLM refactoring response: {e}")
            
        return proposals
        
    async def _run_tests(self) -> bool:
        """Run the test suite"""
        try:
            # Emit test event and wait for result
            result = await self.event_bus.emit_and_wait(
                "run_tests",
                {},
                timeout=300.0
            )
            return result.get("success", False)
        except Exception as e:
            logger.error(f"Failed to run tests: {e}")
            return False


class CodeAnalysisVisitor(ast.NodeVisitor):
    """AST visitor for code analysis"""
    
    def __init__(self):
        self.issues = []
        self.suggestions = []
        self.complexity = 0
        
    def visit_FunctionDef(self, node):
        """Analyze function definitions"""
        # Check function length
        if len(node.body) > 50:
            self.issues.append(
                f"Function '{node.name}' is too long ({len(node.body)} lines)"
            )
            self.suggestions.append(
                f"Consider breaking '{node.name}' into smaller functions"
            )
            
        # Check number of arguments
        args = len(node.args.args)
        if args > 5:
            self.issues.append(
                f"Function '{node.name}' has too many parameters ({args})"
            )
            self.suggestions.append(
                f"Consider using a configuration object for '{node.name}' parameters"
            )
            
        self.generic_visit(node)
        
    def visit_Try(self, node):
        """Analyze try blocks"""
        # Check for bare except
        for handler in node.handlers:
            if handler.type is None:
                self.issues.append("Bare except clause found")
                self.suggestions.append(
                    "Specify exception types in except clauses"
                )
                
        self.generic_visit(node)
        
    def visit_If(self, node):
        """Analyze if statements"""
        self.complexity += 1
        self.generic_visit(node)
        
    def visit_While(self, node):
        """Analyze while loops"""
        self.complexity += 1
        self.generic_visit(node)
        
    def visit_For(self, node):
        """Analyze for loops"""
        self.complexity += 1
        self.generic_visit(node)
