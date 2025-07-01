"""
Tests for the ALEJO Collective Learning CI/CD pipeline scripts
"""

import pytest
import os
import json
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock, mock_open

# Import the scripts as modules
import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from scripts import process_insights, generate_improvements, apply_improvements
import secrets  # More secure for cryptographic purposes


@pytest.fixture
def mock_config_manager():
    """Mock configuration manager"""
    config_manager = MagicMock()
    config_manager.get_config.return_value = {
        "enabled": True,
        "auto_apply": False,
        "min_confidence": 0.8
    }
    return config_manager


@pytest.fixture
def mock_data_manager():
    """Mock data manager"""
    data_manager = MagicMock()
    data_manager.get_unprocessed_insights.return_value = []
    data_manager.mark_insights_processed.return_value = None
    data_manager.store_improvements.return_value = None
    return data_manager


@pytest.fixture
def mock_improvement_engine():
    """Mock improvement engine"""
    engine = MagicMock()
    engine.generate_improvements.return_value = []
    engine.apply_improvement.return_value = True
    return engine


@pytest.fixture
def sample_insights():
    """Sample insights for testing"""
    return [
        {
            "id": "insight-1",
            "category": "performance",
            "component": "database",
            "operation": "query",
            "time": 500,
            "tags": ["performance", "slow"],
            "anonymized": True,
            "processed": False
        },
        {
            "id": "insight-2",
            "category": "security",
            "component": "authentication",
            "vulnerability_type": "sql_injection",
            "severity": "high",
            "anonymized": True,
            "processed": False
        }
    ]


@pytest.fixture
def sample_improvements():
    """Sample improvements for testing"""
    return [
        {
            "id": "perf-database-12345678",
            "title": "Optimize query in database",
            "description": "Performance optimization for query based on user insights",
            "category": "performance",
            "component": "database",
            "operation": "query",
            "confidence": 0.8,
            "status": "proposed"
        },
        {
            "id": "sec-sql_injection-87654321",
            "title": "Fix sql_injection vulnerability in authentication",
            "description": "Security improvement to address sql_injection vulnerability",
            "category": "security",
            "vulnerability_type": "sql_injection",
            "components": ["authentication"],
            "confidence": 0.9,
            "severity": "high",
            "status": "proposed"
        }
    ]


class TestProcessInsights:
    """Tests for the process_insights.py script"""
    
    @patch("scripts.process_insights.CollectiveDataManager")
    @patch("scripts.process_insights.ConfigManager")
    def test_process_insights(self, mock_config_cls, mock_data_cls, sample_insights, tmp_path):
        """Test processing insights"""
        # Setup mocks
        mock_data = MagicMock()
        mock_data.get_unprocessed_insights.return_value = sample_insights
        mock_data_cls.return_value = mock_data
        
        output_dir = tmp_path / "insights"
        output_dir.mkdir()
        output_file = output_dir / "processed_insights.json"
        
        # Run the function
        with patch.object(process_insights, "parse_args") as mock_args:
            mock_args.return_value = MagicMock(output_dir=str(output_dir))
            process_insights.main()
        
        # Verify
        assert output_file.exists()
        with open(output_file) as f:
            processed = json.load(f)
            assert len(processed) == len(sample_insights)
            assert all(insight.get("processed", False) for insight in processed)


class TestGenerateImprovements:
    """Tests for the generate_improvements.py script"""
    
    @patch("scripts.generate_improvements.ImprovementEngine")
    @patch("scripts.generate_improvements.CollectiveDataManager")
    @patch("scripts.generate_improvements.ConfigManager")
    def test_generate_improvements(self, mock_config_cls, mock_data_cls, mock_engine_cls, 
                                  sample_insights, sample_improvements, tmp_path):
        """Test generating improvements"""
        # Setup mocks
        mock_engine = MagicMock()
        mock_engine.generate_improvements.return_value = sample_improvements
        mock_engine_cls.return_value = mock_engine
        
        input_dir = tmp_path / "insights"
        input_dir.mkdir()
        input_file = input_dir / "processed_insights.json"
        with open(input_file, "w") as f:
            json.dump(sample_insights, f)
            
        output_dir = tmp_path / "improvements"
        output_dir.mkdir()
        
        # Run the function
        with patch.object(generate_improvements, "parse_args") as mock_args:
            mock_args.return_value = MagicMock(
                input_file=str(input_file),
                output_dir=str(output_dir),
                create_prs=False
            )
            generate_improvements.main()
        
        # Verify
        output_file = output_dir / "improvement_proposals.json"
        assert output_file.exists()
        with open(output_file) as f:
            improvements = json.load(f)
            assert len(improvements) == len(sample_improvements)


class TestApplyImprovements:
    """Tests for the apply_improvements.py script"""
    
    @patch("scripts.apply_improvements.ImprovementEngine")
    @patch("scripts.apply_improvements.CollectiveDataManager")
    @patch("scripts.apply_improvements.ConfigManager")
    def test_apply_improvements(self, mock_config_cls, mock_data_cls, mock_engine_cls, 
                               sample_improvements, tmp_path):
        """Test applying improvements"""
        # Setup mocks
        mock_engine = MagicMock()
        mock_engine.apply_improvement.return_value = True
        mock_engine_cls.return_value = mock_engine
        
        input_dir = tmp_path / "improvements"
        input_dir.mkdir()
        input_file = input_dir / "improvement_proposals.json"
        
        # Only include high-confidence improvements
        high_confidence_improvements = [imp for imp in sample_improvements if imp["confidence"] >= 0.8]
        with open(input_file, "w") as f:
            json.dump(high_confidence_improvements, f)
            
        # Run the function
        with patch.object(apply_improvements, "parse_args") as mock_args:
            mock_args.return_value = MagicMock(
                input_file=str(input_file),
                dry_run=True,
                min_confidence=0.8
            )
            apply_improvements.main()
        
        # Verify
        assert mock_engine.apply_improvement.call_count == len(high_confidence_improvements)
    
    @patch("scripts.apply_improvements.ImprovementEngine")
    @patch("scripts.apply_improvements.CollectiveDataManager")
    @patch("scripts.apply_improvements.ConfigManager")
    def test_apply_improvements_with_filter(self, mock_config_cls, mock_data_cls, mock_engine_cls, 
                                          sample_improvements, tmp_path):
        """Test applying improvements with category filter"""
        # Setup mocks
        mock_engine = MagicMock()
        mock_engine.apply_improvement.return_value = True
        mock_engine_cls.return_value = mock_engine
        
        input_dir = tmp_path / "improvements"
        input_dir.mkdir()
        input_file = input_dir / "improvement_proposals.json"
        
        with open(input_file, "w") as f:
            json.dump(sample_improvements, f)
            
        # Run the function with category filter
        with patch.object(apply_improvements, "parse_args") as mock_args:
            mock_args.return_value = MagicMock(
                input_file=str(input_file),
                dry_run=True,
                min_confidence=0.7,
                category="security"
            )
            apply_improvements.main()
        
        # Verify only security improvements were applied
        security_improvements = [imp for imp in sample_improvements if imp["category"] == "security"]
        assert mock_engine.apply_improvement.call_count == len(security_improvements)