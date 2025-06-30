"""
Advanced Personality Modeling for ALEJO
Uses reinforcement learning and VAEs for adaptive personality traits
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.distributions import Normal
import numpy as np
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple
import logging
from collections import deque
import random

logger = logging.getLogger(__name__)

@dataclass
class PersonalityState:
    """Current personality state"""
    traits: Dict[str, float]  # Big Five traits
    mood: Dict[str, float]    # Current mood factors
    adaptations: List[Dict]   # Recent personality adaptations
    confidence: float         # Confidence in current state

class PersonalityVAE(nn.Module):
    """Variational Autoencoder for personality modeling"""
    
    def __init__(self, input_dim: int = 5, latent_dim: int = 8, hidden_dim: int = 32):
        super().__init__()
        
        # Encoder
        self.encoder = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim),
            nn.ReLU()
        )
        
        self.fc_mu = nn.Linear(hidden_dim, latent_dim)
        self.fc_var = nn.Linear(hidden_dim, latent_dim)
        
        # Decoder
        self.decoder = nn.Sequential(
            nn.Linear(latent_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, input_dim),
            nn.Sigmoid()  # Traits are between 0 and 1
        )
        
    def encode(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        """Encode personality traits to latent space"""
        hidden = self.encoder(x)
        mu = self.fc_mu(hidden)
        log_var = self.fc_var(hidden)
        return mu, log_var
        
    def reparameterize(self, mu: torch.Tensor, log_var: torch.Tensor) -> torch.Tensor:
        """Reparameterization trick"""
        std = torch.exp(0.5 * log_var)
        eps = torch.randn_like(std)
        return mu + eps * std
        
    def decode(self, z: torch.Tensor) -> torch.Tensor:
        """Decode latent vector to personality traits"""
        return self.decoder(z)
        
    def forward(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        """Forward pass"""
        mu, log_var = self.encode(x)
        z = self.reparameterize(mu, log_var)
        return self.decode(z), mu, log_var

class PersonalityRL:
    """Reinforcement learning for personality adaptation"""
    
    def __init__(self, state_dim: int = 5, action_dim: int = 5, hidden_dim: int = 64):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
        # Actor network (policy)
        self.actor = nn.Sequential(
            nn.Linear(state_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, action_dim),
            nn.Tanh()  # Actions are trait adjustments between -1 and 1
        ).to(self.device)
        
        # Critic network (value function)
        self.critic = nn.Sequential(
            nn.Linear(state_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, 1)
        ).to(self.device)
        
        # Optimizers
        self.actor_optimizer = torch.optim.Adam(self.actor.parameters(), lr=3e-4)
        self.critic_optimizer = torch.optim.Adam(self.critic.parameters(), lr=1e-3)
        
        # Experience replay buffer
        self.replay_buffer = deque(maxlen=10000)
        self.batch_size = 64
        
    def select_action(self, state: np.ndarray) -> np.ndarray:
        """Select personality adaptation action"""
        state_tensor = torch.FloatTensor(state).unsqueeze(0).to(self.device)
        with torch.no_grad():
            action = self.actor(state_tensor)
        return action.cpu().numpy()[0]
        
    def train(self, experiences: List[Tuple]):
        """Train on batch of experiences"""
        if len(experiences) < self.batch_size:
            return
            
        # Sample random batch
        batch = random.sample(experiences, self.batch_size)
        states, actions, rewards, next_states = zip(*batch)
        
        # Convert to tensors
        states = torch.FloatTensor(states).to(self.device)
        actions = torch.FloatTensor(actions).to(self.device)
        rewards = torch.FloatTensor(rewards).unsqueeze(1).to(self.device)
        next_states = torch.FloatTensor(next_states).to(self.device)
        
        # Update critic
        next_values = self.critic(next_states)
        expected_values = rewards + 0.99 * next_values
        values = self.critic(states)
        critic_loss = F.mse_loss(values, expected_values.detach())
        
        self.critic_optimizer.zero_grad()
        critic_loss.backward()
        self.critic_optimizer.step()
        
        # Update actor using policy gradient
        advantages = (expected_values - values).detach()
        actor_loss = -(self.critic(states) * advantages).mean()
        
        self.actor_optimizer.zero_grad()
        actor_loss.backward()
        self.actor_optimizer.step()

class AdaptivePersonality:
    """
    Advanced personality modeling system with VAE and RL
    """
    
    def __init__(self):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
        # Initialize models
        self.vae = PersonalityVAE().to(self.device)
        self.rl = PersonalityRL()
        
        # Initialize personality state
        self.state = PersonalityState(
            traits={
                "openness": 0.7,
                "conscientiousness": 0.8,
                "extraversion": 0.6,
                "agreeableness": 0.75,
                "neuroticism": 0.3
            },
            mood={
                "valence": 0.5,
                "energy": 0.5,
                "dominance": 0.5
            },
            adaptations=[],
            confidence=1.0
        )
        
        # Experience tracking
        self.interaction_history = []
        self.adaptation_results = []
        
    def update_personality(self, interaction: Dict) -> PersonalityState:
        """Update personality based on interaction"""
        try:
            # Extract relevant features
            user_emotion = interaction.get("user_emotion", {})
            response_effectiveness = interaction.get("effectiveness", 0.5)
            
            # Create state vector
            current_state = self._create_state_vector()
            
            # Get adaptation action from RL
            action = self.rl.select_action(current_state)
            
            # Apply personality adaptation
            new_traits = self._adapt_traits(action)
            
            # Update mood based on interaction
            new_mood = self._update_mood(user_emotion)
            
            # Calculate reward based on interaction effectiveness
            reward = self._calculate_reward(response_effectiveness)
            
            # Store experience
            self.rl.replay_buffer.append((
                current_state,
                action,
                reward,
                self._create_state_vector(new_traits)
            ))
            
            # Train models if enough experiences
            if len(self.rl.replay_buffer) >= self.rl.batch_size:
                self.rl.train(list(self.rl.replay_buffer))
            
            # Update state
            self.state.traits = new_traits
            self.state.mood = new_mood
            self.state.adaptations.append({
                "action": action.tolist(),
                "reward": reward,
                "timestamp": interaction.get("timestamp")
            })
            
            # Update confidence based on reward
            self.state.confidence = min(1.0, self.state.confidence + (reward * 0.1))
            
            return self.state
            
        except Exception as e:
            logger.error(f"Error updating personality: {e}")
            return self.state
            
    def generate_response_style(self, context: Dict) -> Dict[str, float]:
        """Generate personality-influenced response style"""
        try:
            # Create personality vector
            personality_vector = torch.FloatTensor([
                self.state.traits["openness"],
                self.state.traits["conscientiousness"],
                self.state.traits["extraversion"],
                self.state.traits["agreeableness"],
                self.state.traits["neuroticism"]
            ]).to(self.device)
            
            # Generate personality embedding using VAE
            with torch.no_grad():
                mu, _ = self.vae.encode(personality_vector.unsqueeze(0))
                personality_embedding = mu[0]
                
            # Calculate response style factors
            warmth = (self.state.traits["agreeableness"] * 0.6 + 
                     self.state.traits["extraversion"] * 0.4)
            depth = (self.state.traits["openness"] * 0.7 + 
                    self.state.traits["conscientiousness"] * 0.3)
            emotionality = self.state.traits["neuroticism"]
            
            # Adjust based on mood
            warmth *= (1.0 + self.state.mood["valence"] - 0.5)
            depth *= (1.0 + self.state.mood["energy"] - 0.5)
            emotionality *= (1.0 + self.state.mood["dominance"] - 0.5)
            
            return {
                "warmth": max(0.0, min(1.0, warmth)),
                "depth": max(0.0, min(1.0, depth)),
                "emotionality": max(0.0, min(1.0, emotionality)),
                "confidence": self.state.confidence
            }
            
        except Exception as e:
            logger.error(f"Error generating response style: {e}")
            return {
                "warmth": 0.5,
                "depth": 0.5,
                "emotionality": 0.5,
                "confidence": 0.5
            }
            
    def _create_state_vector(self, traits: Dict[str, float] = None) -> np.ndarray:
        """Create state vector for RL"""
        traits = traits or self.state.traits
        return np.array([
            traits["openness"],
            traits["conscientiousness"],
            traits["extraversion"],
            traits["agreeableness"],
            traits["neuroticism"]
        ])
        
    def _adapt_traits(self, action: np.ndarray) -> Dict[str, float]:
        """Apply adaptation action to traits"""
        traits = self.state.traits.copy()
        trait_names = list(traits.keys())
        
        for i, trait in enumerate(trait_names):
            # Apply action with constraints
            traits[trait] = max(0.0, min(1.0, traits[trait] + action[i] * 0.1))
            
        return traits
        
    def _update_mood(self, user_emotion: Dict[str, float]) -> Dict[str, float]:
        """Update mood based on interaction"""
        mood = self.state.mood.copy()
        
        # Gradual mood adjustment based on user emotion
        alpha = 0.2  # Learning rate
        if user_emotion:
            mood["valence"] = (1 - alpha) * mood["valence"] + alpha * user_emotion.get("valence", mood["valence"])
            mood["energy"] = (1 - alpha) * mood["energy"] + alpha * user_emotion.get("arousal", mood["energy"])
            mood["dominance"] = (1 - alpha) * mood["dominance"] + alpha * user_emotion.get("dominance", mood["dominance"])
            
        return mood
        
    def _calculate_reward(self, effectiveness: float) -> float:
        """Calculate reward for RL"""
        # Base reward from effectiveness
        reward = effectiveness - 0.5  # Center around 0
        
        # Penalty for extreme trait values
        trait_penalty = 0.0
        for value in self.state.traits.values():
            if value < 0.1 or value > 0.9:
                trait_penalty += 0.1
                
        return reward - trait_penalty
