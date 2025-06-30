"""
Tests for the Improvement Engine in ALEJO's Collective Learning system
"""

import pytest
import json
import os
from datetime import datetime
from unittest.mock import patch, MagicMock, AsyncMock

from alejo.core.config_manager import ConfigManager
from alejo.collective.improvement_engine import ImprovementEngine
from alejo.collective.data_manager import CollectiveDataManager


@pytest.fixture
def config_manager():
    """Create a config manager with test settings"""
    config = {
        "collective": {
            "improvements": {
                "auto_apply": False,
                "min_confidence": 0.8
            }
        },
        "github": {
            "enabled": True,
            "repo": "test/alejo",
            "token": "test_token",
            "branch": "test-branch",
            "improvements_path": "data/collective/improvements"
        }
    }
    
    manager = MagicMock(spec=ConfigManager)
    manager.get_config.side_effect = lambda key, default=None: config.get(key.split(".")[0], {}).get(key.split(".")[1], default) if "." in key else config.get(key, default)
    manager.get.side_effect = lambda key, default=None: config.get(key.split(".")[0], {}).get(key.split(".")[1], default) if "." in key else config.get(key, default)
    
    return manager


@pytest.fixture
def data_manager():
    """Create a data manager mock"""
    manager = MagicMock(spec=CollectiveDataManager)
    manager.get_unprocessed_insights = AsyncMock(return_value=[])
    manager.mark_insights_processed = AsyncMock()
    manager.store_improvements = AsyncMock()
    manager.get_improvement = AsyncMock()
    manager.update_improvement_status = AsyncMock()
    
    return manager


@pytest.fixture
def improvement_engine(config_manager, data_manager):
    """Create an improvement engine instance"""
    return ImprovementEngine(config_manager, data_manager)


class TestImprovementEngine:
    """Tests for the ImprovementEngine class"""
    
    @pytest.mark.asyncio
    async def test_generate_improvements_empty(self, improvement_engine):
        """Test generating improvements with no insights"""
        improvements = await improvement_engine.generate_improvements()
        assert improvements == []
        improvement_engine.data_manager.get_unprocessed_insights.assert_called_once()
        improvement_engine.data_manager.mark_insights_processed.assert_not_called()
        improvement_engine.data_manager.store_improvements.assert_not_called()
    
    @pytest.mark.asyncio
    async def test_generate_performance_improvements(self, improvement_engine, data_manager):
        """Test generating performance improvements"""
        # Setup test data
        insights = [
            {
                "id": "insight-1",
                "category": "performance",
                "component": "database",
                "operation": "query",
                "time": 500,
                "tags": ["performance", "slow"],
                "created_at": datetime.now().isoformat()
            },
            {
                "id": "insight-2",
                "category": "performance",
                "component": "database",
                "operation": "query",
                "time": 600,
                "tags": ["performance", "slow"],
                "created_at": datetime.now().isoformat()
            },
            {
                "id": "insight-3",
                "category": "performance",
                "component": "database",
                "operation": "query",
                "time": 700,
                "tags": ["performance", "slow"],
                "created_at": datetime.now().isoformat()
            }
        ]
        
        data_manager.get_unprocessed_insights.return_value = insights
        
        # Execute
        improvements = await improvement_engine.generate_improvements()
        
        # Verify
        assert len(improvements) == 1
        assert improvements[0]["category"] == "performance"
        assert improvements[0]["component"] == "database"
        assert improvements[0]["operation"] == "query"
        assert improvements[0]["confidence"] >= 0.7  # 0.5 + (3 * 0.1) = 0.8
        assert "proposed" == improvements[0]["status"]
        
        # Verify data manager calls
        data_manager.get_unprocessed_insights.assert_called_once()
        data_manager.mark_insights_processed.assert_called_once_with(insights)
        data_manager.store_improvements.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_generate_security_improvements(self, improvement_engine, data_manager):
        """Test generating security improvements"""
        # Setup test data
        insights = [
            {
                "id": "insight-1",
                "category": "security",
                "component": "authentication",
                "vulnerability_type": "sql_injection",
                "severity": "high",
                "created_at": datetime.now().isoformat()
            }
        ]
        
        data_manager.get_unprocessed_insights.return_value = insights
        
        # Execute
        improvements = await improvement_engine.generate_improvements()
        
        # Verify
        assert len(improvements) == 1
        assert improvements[0]["category"] == "security"
        assert improvements[0]["vulnerability_type"] == "sql_injection"
        assert improvements[0]["components"] == ["authentication"]
        assert improvements[0]["severity"] == "high"
        assert improvements[0]["confidence"] >= 0.7  # Security starts with higher base confidence
        
    @pytest.mark.asyncio
    async def test_generate_accessibility_improvements(self, improvement_engine, data_manager):
        """Test generating accessibility improvements"""
        # Setup test data
        insights = [
            {
                "id": "insight-1",
                "category": "accessibility",
                "component": "dashboard",
                "issue_type": "contrast_ratio",
                "wcag_level": "AA",
                "created_at": datetime.now().isoformat()
            }
        ]
        
        data_manager.get_unprocessed_insights.return_value = insights
        
        # Execute
        improvements = await improvement_engine.generate_improvements()
        
        # Verify
        assert len(improvements) == 1
        assert improvements[0]["category"] == "accessibility"
        assert improvements[0]["issue_type"] == "contrast_ratio"
        assert improvements[0]["components"] == ["dashboard"]
        assert improvements[0]["wcag_level"] == "AA"
        
    @pytest.mark.asyncio
    async def test_generate_privacy_improvements(self, improvement_engine, data_manager):
        """Test generating privacy improvements"""
        # Setup test data
        insights = [
            {
                "id": "insight-1",
                "category": "privacy",
                "component": "user_data",
                "issue_type": "data_retention",
                "impact": "high",
                "created_at": datetime.now().isoformat()
            }
        ]
        
        data_manager.get_unprocessed_insights.return_value = insights
        
        # Execute
        improvements = await improvement_engine.generate_improvements()
        
        # Verify
        assert len(improvements) == 1
        assert improvements[0]["category"] == "privacy"
        assert improvements[0]["issue_type"] == "data_retention"
        assert improvements[0]["components"] == ["user_data"]
        assert improvements[0]["impact"] == "high"
        
    @pytest.mark.asyncio
    async def test_generate_multiple_category_improvements(self, improvement_engine, data_manager):
        """Test generating improvements from multiple categories"""
        # Setup test data
        insights = [
            {
                "id": "insight-1",
                "category": "performance",
                "component": "database",
                "operation": "query",
                "time": 500,
                "tags": ["performance", "slow"],
                "created_at": datetime.now().isoformat()
            },
            {
                "id": "insight-2",
                "category": "performance",
                "component": "database",
                "operation": "query",
                "time": 600,
                "tags": ["performance", "slow"],
                "created_at": datetime.now().isoformat()
            },
            {
                "id": "insight-3",
                "category": "performance",
                "component": "database",
                "operation": "query",
                "time": 700,
                "tags": ["performance", "slow"],
                "created_at": datetime.now().isoformat()
            },
            {
                "id": "insight-4",
                "category": "security",
                "component": "authentication",
                "vulnerability_type": "sql_injection",
                "severity": "high",
                "created_at": datetime.now().isoformat()
            },
            {
                "id": "insight-5",
                "category": "accessibility",
                "component": "dashboard",
                "issue_type": "contrast_ratio",
                "wcag_level": "AA",
                "created_at": datetime.now().isoformat()
            }
        ]
        
        data_manager.get_unprocessed_insights.return_value = insights
        
        # Execute
        improvements = await improvement_engine.generate_improvements()
        
        # Verify
        assert len(improvements) == 3  # One from each category
        categories = [imp["category"] for imp in improvements]
        assert "performance" in categories
        assert "security" in categories
        assert "accessibility" in categories
        
    @pytest.mark.asyncio
    async def test_apply_improvement(self, improvement_engine, data_manager):
        """Test applying an improvement"""
        # Setup test data
        improvement_id = "test-improvement-id"
        improvement = {
            "id": improvement_id,
            "title": "Test Improvement",
            "description": "Test improvement description",
            "category": "performance",
            "component": "database",
            "status": "proposed"
        }
        
        data_manager.get_improvement.return_value = improvement
        
        # Mock GitHub API request
        with patch.object(improvement_engine, '_github_api_request', new_callable=AsyncMock) as mock_github:
            mock_github.return_value = {"number": 123, "html_url": "https://github.com/test/alejo/pull/123"}
            
            # Execute
            result = await improvement_engine.apply_improvement(improvement_id)
            
            # Verify
            assert result is True
            data_manager.get_improvement.assert_called_once_with(improvement_id)
            data_manager.update_improvement_status.assert_called_once()
            assert mock_github.call_count > 0
    
    @pytest.mark.asyncio
    async def test_apply_improvement_not_found(self, improvement_engine, data_manager):
        """Test applying a non-existent improvement"""
        # Setup
        improvement_id = "non-existent-id"
        data_manager.get_improvement.return_value = None
        
        # Execute
        result = await improvement_engine.apply_improvement(improvement_id)
        
        # Verify
        assert result is False
        data_manager.get_improvement.assert_called_once_with(improvement_id)
        data_manager.update_improvement_status.assert_not_called()
