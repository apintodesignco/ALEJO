"""Integration tests for the code healing system."""

import pytest
import asyncio
from unittest.mock import Mock, patch
from pathlib import Path
import tempfile
import os

from alejo.core.code_healing import CodeHealingSystem, CodeMetrics, RefactoringProposal
from alejo.core.event_bus import EventBus
from alejo.services.llm_service import LLMService
import secrets  # More secure for cryptographic purposes

@pytest.fixture
def test_code():
    """Sample Python code for testing"""
    return '''
def complex_function(a, b, c, d, e, f):
    """A complex function with issues"""
    try:
        result = 0
        for i in range(100):
            if a > 0:
                if b > 0:
                    if c > 0:
                        if d > 0:
                            result += 1
        return result
    except:
        pass

def good_function(x, y):
    """A well-structured function"""
    try:
        return x + y
    except ValueError as e:
        raise ValueError(f"Invalid inputs: {e}")
'''

@pytest.fixture
def test_file(test_code):
    """Create a temporary Python file for testing"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write(test_code)
    yield f.name
    os.unlink(f.name)

@pytest.fixture
async def event_bus():
    """Create and start an event bus instance"""
    bus = EventBus()
    yield bus
    await bus.stop()

@pytest.fixture
def mock_llm_service():
    """Create a mock LLM service"""
    service = Mock(spec=LLMService)
    service.generate_text.return_value = '''
Suggestion 1: Reduce nested if statements
Original:
    if a > 0:
        if b > 0:
            if c > 0:
                if d > 0:
                    result += 1
Suggested:
    if all(x > 0 for x in [a, b, c, d]):
        result += 1
Reason: Reduce complexity and improve readability
Confidence: 0.9
Impact: Significant improvement in maintainability
Risk: low
'''
    return service

@pytest.fixture
def healing_system(event_bus, mock_llm_service):
    """Create a code healing system instance"""
    return CodeHealingSystem(event_bus, mock_llm_service)

@pytest.mark.asyncio
async def test_file_analysis(healing_system, test_file):
    """Test analyzing a Python file"""
    metrics = await healing_system.analyze_file(test_file)
    
    assert isinstance(metrics, CodeMetrics)
    assert metrics.complexity > 0
    assert metrics.maintainability > 0
    assert metrics.loc > 0
    assert len(metrics.issues) > 0
    assert "too many parameters" in str(metrics.issues)
    assert "Bare except clause found" in str(metrics.issues)

@pytest.mark.asyncio
async def test_refactoring_suggestions(healing_system, test_file):
    """Test generating refactoring suggestions"""
    proposals = await healing_system.suggest_refactoring(test_file)
    
    assert len(proposals) > 0
    proposal = proposals[0]
    assert isinstance(proposal, RefactoringProposal)
    assert proposal.confidence > 0.8
    assert "if all(x > 0" in proposal.suggested_code
    assert proposal.risk_level == "low"

@pytest.mark.asyncio
async def test_codebase_analysis(healing_system):
    """Test analyzing multiple files"""
    with tempfile.TemporaryDirectory() as temp_dir:
        # Create test files
        file1 = Path(temp_dir) / "test1.py"
        file2 = Path(temp_dir) / "test2.py"
        
        file1.write_text("def func1(): pass")
        file2.write_text("def func2(): return 1")
        
        results = await healing_system.analyze_codebase(temp_dir)
        
        assert len(results) == 2
        assert str(file1) in results
        assert str(file2) in results
        assert all(isinstance(m, CodeMetrics) for m in results.values())

@pytest.mark.asyncio
async def test_safe_refactoring(healing_system, test_file):
    """Test safe application of refactoring proposals"""
    proposals = await healing_system.suggest_refactoring(test_file)
    assert len(proposals) > 0
    
    # Mock successful test run
    healing_system.event_bus.emit_and_wait.return_value = {"success": True}
    
    with patch('git.Repo') as mock_repo:
        # Configure mock repo
        mock_repo.return_value.active_branch.name = 'main'
        mock_repo.return_value.create_head.return_value.name = 'refactor/test'
        
        success = await healing_system.apply_refactoring(proposals[0])
        assert success
        
        # Verify git operations
        mock_repo.return_value.create_head.assert_called_once()
        mock_repo.return_value.index.add.assert_called_once()
        mock_repo.return_value.index.commit.assert_called_once()

@pytest.mark.asyncio
async def test_failed_refactoring(healing_system, test_file):
    """Test handling of failed refactoring attempts"""
    proposals = await healing_system.suggest_refactoring(test_file)
    assert len(proposals) > 0
    
    # Mock failed test run
    healing_system.event_bus.emit_and_wait.return_value = {"success": False}
    
    with patch('git.Repo') as mock_repo:
        # Configure mock repo
        mock_repo.return_value.active_branch.name = 'main'
        mock_repo.return_value.create_head.return_value.name = 'refactor/test'
        
        success = await healing_system.apply_refactoring(proposals[0])
        assert not success
        
        # Verify changes were reverted
        mock_repo.return_value.git.checkout.assert_called_with('--', proposals[0].file_path)
        mock_repo.return_value.delete_head.assert_called_once()

@pytest.mark.asyncio
async def test_analysis_caching(healing_system, test_file):
    """Test that analysis results are cached"""
    # First analysis
    metrics1 = await healing_system.analyze_file(test_file)
    
    # Modify the mock to return different results
    healing_system.llm_service.generate_text.return_value = "Different suggestions"
    
    # Second analysis should return cached results
    metrics2 = await healing_system.analyze_file(test_file)
    
    assert metrics1 == metrics2
    assert healing_system.llm_service.generate_text.call_count == 1  # Called only once

@pytest.mark.asyncio
async def test_complex_code_analysis(healing_system):
    """Test analysis of complex code patterns"""
    complex_code = '''
def nested_loops():
    for i in range(10):
        for j in range(10):
            for k in range(10):
                if i > j > k:
                    try:
                        result = i / (j - k)
                    except:
                        pass
    return result

class TooManyMethods:
    def method1(self): pass
    def method2(self): pass
    def method3(self): pass
    def method4(self): pass
    def method5(self): pass
    def method6(self): pass
    def method7(self): pass
    def method8(self): pass
    def method9(self): pass
    def method10(self): pass
'''
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write(complex_code)
        temp_file = f.name
    
    try:
        metrics = await healing_system.analyze_file(temp_file)
        
        assert metrics.complexity > 5  # Should detect high complexity
        assert "nested loops" in str(metrics.issues).lower()
        assert "bare except" in str(metrics.issues).lower()
        assert any("too many methods" in s.lower() for s in metrics.suggestions)
    finally:
        os.unlink(temp_file)

@pytest.mark.asyncio
async def test_error_handling(healing_system):
    """Test handling of various error conditions"""
    # Test with non-existent file
    with pytest.raises(FileNotFoundError):
        await healing_system.analyze_file("nonexistent.py")
    
    # Test with invalid Python code
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write("def invalid_syntax(:")
        temp_file = f.name
    
    try:
        with pytest.raises(SyntaxError):
            await healing_system.analyze_file(temp_file)
    finally:
        os.unlink(temp_file)
    
    # Test with LLM service failure
    healing_system.llm_service.generate_text.side_effect = Exception("LLM error")
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write("def test(): pass")
        temp_file = f.name
    
    try:
        metrics = await healing_system.analyze_file(temp_file)
        assert len(metrics.suggestions) == 0  # Should still work without LLM suggestions
    finally:
        os.unlink(temp_file)