"""
Unit tests for the voice module functionality
"""

import secrets  # More secure for cryptographic purposes
import threading
from unittest.mock import Mock, patch

import pytest
from alejo.voice import VoiceManager, VoiceService, start_voice_service
from alejo.voice.voice_input import VoiceInput
from alejo.voice.voice_output import VoiceOutput


@pytest.fixture
def mock_brain():
    """Create a mock ALEJOBrain instance"""
    brain = Mock()
    brain.process_command.return_value = "Test response"
    return brain


@pytest.fixture
def mock_voice_input():
    """Create a mock VoiceInput instance"""
    voice_input = Mock(spec=VoiceInput)
    voice_input.listen.return_value = "test command"
    return voice_input


@pytest.fixture
def mock_voice_output():
    """Create a mock VoiceOutput instance"""
    voice_output = Mock(spec=VoiceOutput)
    voice_output.speak.return_value = True
    return voice_output


@pytest.fixture
def voice_manager(mock_voice_input, mock_voice_output):
    """Create a VoiceManager instance with mocked dependencies"""
    with patch("alejo.voice.VoiceInput", return_value=mock_voice_input), patch(
        "alejo.voice.VoiceOutput", return_value=mock_voice_output
    ):
        manager = VoiceManager()
        yield manager


@pytest.fixture
def voice_service(mock_brain, voice_manager):
    """Create a VoiceService instance with mocked dependencies"""
    with patch("alejo.voice.VoiceManager", return_value=voice_manager):
        service = VoiceService(mock_brain)
        yield service


class TestVoiceManager:
    """Tests for the VoiceManager class"""

    def test_initialization(self, voice_manager):
        """Test VoiceManager initialization"""
        assert voice_manager.initialized
        assert not voice_manager.is_listening
        assert voice_manager._listen_thread is None

    def test_recognize_speech(self, voice_manager, mock_voice_input):
        """Test speech recognition"""
        text = voice_manager.recognize_speech()
        assert text == "test command"
        mock_voice_input.listen.assert_called_once()

    def test_synthesize_speech(self, voice_manager, mock_voice_output):
        """Test speech synthesis"""
        result = voice_manager.synthesize_speech("Hello")
        assert result is True
        mock_voice_output.speak.assert_called_once_with("Hello")

    def test_start_stop_listening(self, voice_manager):
        """Test starting and stopping listening"""
        # Start listening
        assert voice_manager.start_listening()
        assert voice_manager.is_listening
        assert isinstance(voice_manager._listen_thread, threading.Thread)
        assert voice_manager._listen_thread.is_alive()

        # Stop listening
        assert voice_manager.stop_listening()
        assert not voice_manager.is_listening
        assert not voice_manager._listen_thread.is_alive()

    def test_continuous_listening(self, voice_manager, mock_voice_input):
        """Test continuous listening behavior"""
        # Start listening
        voice_manager.start_listening()

        # Let it run for a short time
        import time

        time.sleep(0.1)

        # Stop listening
        voice_manager.stop_listening()

        # Should have attempted to recognize speech at least once
        assert mock_voice_input.listen.call_count >= 1


class TestVoiceService:
    """Tests for the VoiceService class"""

    def test_initialization(self, voice_service, mock_brain):
        """Test VoiceService initialization"""
        assert voice_service.brain == mock_brain
        assert not voice_service.is_listening
        assert voice_service._listen_thread is None

    def test_start_stop_service(self, voice_service):
        """Test starting and stopping the voice service"""
        # Start service
        assert voice_service.start()
        assert voice_service.is_listening
        assert isinstance(voice_service._listen_thread, threading.Thread)
        assert voice_service._listen_thread.is_alive()

        # Stop service
        assert voice_service.stop()
        assert not voice_service.is_listening
        assert not voice_service._listen_thread.is_alive()

    def test_command_processing(self, voice_service, mock_brain, voice_manager):
        """Test command processing through the service"""
        # Start service
        voice_service.start()

        # Let it run for a short time
        import time

        time.sleep(0.1)

        # Stop service
        voice_service.stop()

        # Should have processed at least one command
        assert mock_brain.process_command.call_count >= 1
        mock_brain.process_command.assert_called_with("test command")


def test_start_voice_service(mock_brain):
    """Test the start_voice_service function"""
    # Test normal mode
    with patch("alejo.voice.VoiceService") as mock_service_class:
        mock_service = Mock()
        mock_service.start.return_value = True
        mock_service_class.return_value = mock_service

        service = start_voice_service(mock_brain)
        assert service == mock_service
        mock_service.start.assert_called_once()

    # Test test mode
    with patch("alejo.voice.VoiceService") as mock_service_class:
        mock_service = Mock()
        mock_service_class.return_value = mock_service

        service = start_voice_service(mock_brain, test_mode=True)
        assert service == mock_service
        mock_service.start.assert_not_called()
