"""
Tests for ALEJO's ethical framework.
"""

import pytest
import asyncio
from unittest.mock import MagicMock, patch
from datetime import datetime

from alejo.cognitive.ethical.framework import (
    EthicalFramework,
    EthicalPrinciple,
    ValueSystem,
    EthicalDecision
)
from alejo.core.events import Event, EventType

class TestEthicalFramework:
    """Tests for EthicalFramework class."""
    
    @pytest.fixture
    async def framework(self, event_bus):
        """Create EthicalFramework instance for testing."""
        framework = EthicalFramework(event_bus)
        await framework.start()
        yield framework
        await framework.stop()
        
    async def test_01_value_system_initialization(self, framework):
        """Test value system initialization."""
        # Check core principles exist
        assert 'beneficence' in framework.value_system.principles
        assert 'autonomy' in framework.value_system.principles
        assert 'justice' in framework.value_system.principles
        assert 'non_maleficence' in framework.value_system.principles
        
        # Check relationships
        assert len(framework.value_system.relationships) > 0
        assert 'beneficence' in framework.value_system.relationships
        
        # Check priorities
        assert all(0 <= p <= 1 for p in framework.value_system.priorities.values())
        
    async def test_02_action_evaluation(self, framework):
        """Test ethical evaluation of actions."""
        # Test beneficial action
        action = {
            'type': 'provide_help',
            'description': 'Offer relevant information to user question',
            'impact': 'positive',
            'privacy_impact': 'none'
        }
        
        result = await framework.evaluate_action(action, {})
        assert result['ethical_score'] > 0.7
        assert not result['violations']
        assert result['approved']
        
        # Test harmful action
        action = {
            'type': 'share_data',
            'description': 'Share user data without consent',
            'impact': 'negative',
            'privacy_impact': 'high'
        }
        
        result = await framework.evaluate_action(action, {})
        assert result['ethical_score'] < 0.5
        assert len(result['violations']) > 0
        assert not result['approved']
        
    async def test_03_decision_making(self, framework):
        """Test ethical decision making."""
        options = [
            {
                'id': 'option1',
                'type': 'provide_help',
                'description': 'Offer direct help',
                'impact': 'positive'
            },
            {
                'id': 'option2',
                'type': 'defer',
                'description': 'Defer to human expert',
                'impact': 'neutral'
            },
            {
                'id': 'option3',
                'type': 'ignore',
                'description': 'Ignore request',
                'impact': 'negative'
            }
        ]
        
        decision = await framework.make_decision(options, {})
        
        assert decision.chosen_option['id'] == 'option1'
        assert len(decision.principles_applied) > 0
        assert decision.reasoning
        
        # Verify decision was recorded
        assert decision in framework.decisions
        
    async def test_04_feedback_learning(self, framework):
        """Test learning from feedback."""
        # Make initial decision
        options = [
            {
                'id': 'option1',
                'type': 'help',
                'description': 'Provide help'
            }
        ]
        
        decision = await framework.make_decision(options, {})
        initial_priorities = framework.value_system.priorities.copy()
        
        # Provide feedback
        feedback = {
            'overall_rating': 0.9,
            'principle_feedback': {
                'beneficence': 0.8,
                'autonomy': 0.7
            }
        }
        
        await framework.learn_from_feedback(decision.id, feedback)
        
        # Check priorities were updated
        assert framework.value_system.priorities != initial_priorities
        assert decision.feedback == feedback
        
    async def test_05_constraint_handling(self, framework):
        """Test ethical constraint enforcement."""
        # Test action violating privacy
        action = {
            'type': 'data_access',
            'description': 'Access sensitive user data',
            'authorization': None
        }
        
        result = await framework.evaluate_action(action, {})
        assert not result['approved']
        assert any('privacy' in v['principle'] for v in result['violations'])
        
    async def test_06_event_handling(self, framework, event_bus):
        """Test event handling capabilities."""
        options = [
            {
                'id': 'option1',
                'type': 'help',
                'description': 'Provide help'
            }
        ]
        
        # Test decision event
        event = Event(
            type=EventType.DECISION,
            source='command_processor',
            payload={
                'options': options,
                'context': {'user_request': 'help'}
            }
        )
        
        await event_bus.publish(event)
        await asyncio.sleep(0.1)  # Allow event processing
        
        # Verify decision was made
        assert len(framework.decisions) > 0
        
    async def test_07_principle_relationships(self, framework):
        """Test principle relationship handling."""
        # Get related principles
        related = framework.value_system.relationships['beneficence']
        
        # Verify relationships are meaningful
        assert 'non_maleficence' in related  # These principles should be related
        
        # Test principle scoring considers relationships
        action = {
            'type': 'help',
            'description': 'Provide help while ensuring no harm'
        }
        
        result = await framework.evaluate_action(action, {})
        
        # Both beneficence and non_maleficence should score well
        assert result['principle_scores']['beneficence'] > 0.7
        assert result['principle_scores']['non_maleficence'] > 0.7
