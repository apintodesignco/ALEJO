"""Mock classes for testing"""

class EventBus:
    """Mock event bus"""
    def __init__(self):
        self.subscribers = {}
        
    async def publish(self, event_type: str, data: dict):
        """Publish an event"""
        if event_type in self.subscribers:
            for subscriber in self.subscribers[event_type]:
                await subscriber(data)
                
    def subscribe(self, event_type: str, callback):
        """Subscribe to an event type"""
        if event_type not in self.subscribers:
            self.subscribers[event_type] = []
        self.subscribers[event_type].append(callback)
        
class EmotionalIntelligenceService:
    """Mock emotional intelligence service"""
    def __init__(self, event_bus):
        self.event_bus = event_bus
        self.personality_model = PersonalityModel()
        self.empathy_model = EmpathyModel()
        self.emotion_detector = EmotionDetector()
        self.ethical_framework = EthicalFramework()
        
    def detect_emotions(self, text=None, audio_data=None, image_data=None):
        """Detect emotions from various inputs"""
        emotions = {}
        if text:
            emotions.update(self.emotion_detector.detect_text_emotion(text))
        if audio_data:
            emotions.update(self.emotion_detector.detect_audio_emotion(audio_data))
        if image_data:
            emotions.update(self.emotion_detector.detect_facial_emotion(image_data))
        return emotions
        
    def generate_response(self, text):
        """Generate empathetic response"""
        emotions = self.detect_emotions(text=text)
        personality = self.personality_model.get_state()
        response = self.empathy_model.generate_response(text, emotions, personality)
        return Response(content=response, empathy_level=0.8)
        
    def process_interaction(self, interaction):
        """Process user interaction"""
        self.personality_model.update(interaction)
        
    def add_emotional_memory(self, memory):
        """Add emotional memory"""
        self.empathy_model.add_memory(memory)
        
    def process_input(self, text):
        """Process user input"""
        return self.generate_response(text)
        
class PersonalityModel:
    """Mock personality model"""
    def __init__(self):
        self.state = {"openness": 0.5, "conscientiousness": 0.5}
        
    def get_state(self):
        """Get current personality state"""
        return self.state.copy()
        
    def update(self, interaction):
        """Update personality state"""
        self.state["openness"] += 0.1
        self.state["conscientiousness"] += 0.1
        
class EmpathyModel:
    """Mock empathy model"""
    def __init__(self):
        self.memories = []
        
    def generate_response(self, text, emotions, personality):
        """Generate empathetic response"""
        return "I understand how you feel."
        
    def add_memory(self, memory):
        """Add emotional memory"""
        self.memories.append(memory)
        
class EmotionDetector:
    """Mock emotion detector"""
    def detect_text_emotion(self, text):
        """Detect emotions from text"""
        return {"joy": 0.8, "sadness": 0.2}
        
    def detect_audio_emotion(self, audio_data):
        """Detect emotions from audio"""
        return {"joy": 0.7, "anger": 0.3}
        
    def detect_facial_emotion(self, image_data):
        """Detect emotions from facial expression"""
        return {"happiness": 0.9, "neutral": 0.1}
        
class EthicalFramework:
    """Mock ethical framework"""
    def evaluate_request(self, request, context=None):
        """Evaluate ethical implications of request"""
        return EthicalEvaluation(
            is_ethical=True,
            confidence=0.9,
            aligned_values=["honesty", "empathy"]
        )
        
class Response:
    """Response class"""
    def __init__(self, content, empathy_level):
        self.content = content
        self.empathy_level = empathy_level
        
class EthicalEvaluation:
    """Ethical evaluation class"""
    def __init__(self, is_ethical, confidence, aligned_values):
        self.is_ethical = is_ethical
        self.confidence = confidence
        self.aligned_values = aligned_values
