"""
Synapse Models for ALEJO's SpiNNaker-inspired Neuromorphic Architecture

This module implements sophisticated, biologically-inspired synapse models that
enable complex learning and adaptation in ALEJO's neuromorphic computing system.
"""

import numpy as np
import logging
from enum import Enum
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Union, Callable, Any
from abc import ABC, abstractmethod
import asyncio
from datetime import datetime
import math
from collections import deque

from alejo.brain.neuromorphic.neural_models import Spike, SpikeType

logger = logging.getLogger(__name__)

class PlasticityType(Enum):
    """Types of synaptic plasticity"""
    STATIC = 0
    STDP = 1  # Spike-Timing-Dependent Plasticity
    SHORT_TERM = 2  # Short-term plasticity (facilitation/depression)
    HOMEOSTATIC = 3  # Homeostatic plasticity
    REWARD_MODULATED = 4  # Reward-modulated plasticity
    STRUCTURAL = 5  # Structural plasticity (synapse creation/pruning)

@dataclass
class SynapseState:
    """Current state of a synapse"""
    weight: float
    max_weight: float
    min_weight: float
    delay: float  # Synaptic delay in seconds
    last_pre_spike_time: float
    last_post_spike_time: float
    trace_pre: float  # Presynaptic trace for STDP
    trace_post: float  # Postsynaptic trace for STDP
    eligibility_trace: float  # For reward-modulated learning
    active: bool  # Whether the synapse is currently active
    creation_time: float
    transmission_history: List[float] = field(default_factory=list)
    
    def reset_traces(self):
        """Reset all learning-related traces"""
        self.trace_pre = 0.0
        self.trace_post = 0.0
        self.eligibility_trace = 0.0

class SynapseModel(ABC):
    """
    Abstract base class for all synapse models
    
    Synapses connect neurons and determine how activity propagates through
    the network. They can exhibit various forms of plasticity (learning).
    """
    
    def __init__(self, 
                 synapse_id: str,
                 pre_neuron_id: str,
                 post_neuron_id: str,
                 params: Dict = None):
        """
        Initialize a new synapse
        
        Args:
            synapse_id: Unique identifier for this synapse
            pre_neuron_id: ID of the presynaptic neuron
            post_neuron_id: ID of the postsynaptic neuron
            params: Model-specific parameters
        """
        self.synapse_id = synapse_id
        self.pre_neuron_id = pre_neuron_id
        self.post_neuron_id = post_neuron_id
        self.params = params or {}
        self.state = self._initialize_state()
        self.enabled = True
        self.last_update_time = datetime.now().timestamp()
        
    @abstractmethod
    def _initialize_state(self) -> SynapseState:
        """Initialize the synapse state with model-specific defaults"""
        pass
        
    @abstractmethod
    def transmit_spike(self, spike: Spike) -> Optional[Spike]:
        """
        Transmit a spike from pre to post neuron, potentially modifying it
        
        Args:
            spike: The incoming spike from the presynaptic neuron
            
        Returns:
            Modified spike to be delivered to the postsynaptic neuron, or None if filtered
        """
        pass
    
    @abstractmethod
    def update_plasticity(self, pre_spike: bool, post_spike: bool, reward: float = 0.0) -> None:
        """
        Update synaptic strength based on pre/post activity and reward signals
        
        Args:
            pre_spike: Whether the presynaptic neuron fired
            post_spike: Whether the postsynaptic neuron fired
            reward: Optional reward signal for reinforcement learning
        """
        pass
    
    def is_active(self) -> bool:
        """Check if the synapse is active and enabled"""
        return self.enabled and self.state.active

class STDPSynapse(SynapseModel):
    """
    Spike-Timing-Dependent Plasticity (STDP) synapse model
    
    Implements biologically realistic learning based on the relative timing
    of pre and postsynaptic spikes. The synapse strengthens when presynaptic
    spikes precede postsynaptic ones (causal relationship) and weakens when
    the order is reversed.
    """
    
    def _initialize_state(self) -> SynapseState:
        """Initialize STDP synapse state"""
        return SynapseState(
            weight=self.params.get('initial_weight', 0.5),
            max_weight=self.params.get('max_weight', 1.0),
            min_weight=self.params.get('min_weight', 0.0),
            delay=self.params.get('delay', 0.001),  # 1ms default delay
            last_pre_spike_time=0.0,
            last_post_spike_time=0.0,
            trace_pre=0.0,
            trace_post=0.0,
            eligibility_trace=0.0,
            active=True,
            creation_time=datetime.now().timestamp(),
            transmission_history=[]
        )
    
    def transmit_spike(self, spike: Spike) -> Optional[Spike]:
        """
        Transmit a spike from pre to post neuron with STDP modulation
        
        Args:
            spike: The incoming spike from the presynaptic neuron
            
        Returns:
            Modified spike to be delivered to the postsynaptic neuron
        """
        if not self.is_active():
            return None
            
        current_time = datetime.now().timestamp()
        
        # Record spike time for plasticity
        self.state.last_pre_spike_time = current_time
        
        # Update presynaptic trace for STDP
        tau_pre = self.params.get('tau_pre', 0.020)  # 20ms time constant
        self.state.trace_pre += 1.0
        
        # Create a new spike with modified weight and delay
        transmitted_spike = Spike(
            source_id=spike.source_id,
            target_id=self.post_neuron_id,
            spike_type=spike.spike_type,
            weight=spike.weight * self.state.weight,  # Scale by synaptic weight
            timestamp=current_time + self.state.delay,  # Add synaptic delay
            payload=spike.payload
        )
        
        # Record transmission for analytics
        if len(self.state.transmission_history) >= 100:
            self.state.transmission_history.pop(0)  # Keep history bounded
        self.state.transmission_history.append(current_time)
        
        self.last_update_time = current_time
        return transmitted_spike
    
    def update_plasticity(self, pre_spike: bool, post_spike: bool, reward: float = 0.0) -> None:
        """
        Update synaptic strength based on STDP rules
        
        Args:
            pre_spike: Whether the presynaptic neuron fired
            post_spike: Whether the postsynaptic neuron fired
            reward: Optional reward signal (not used in basic STDP)
        """
        if not self.is_active():
            return
            
        current_time = datetime.now().timestamp()
        
        # STDP parameters
        tau_pre = self.params.get('tau_pre', 0.020)  # 20ms
        tau_post = self.params.get('tau_post', 0.020)  # 20ms
        a_plus = self.params.get('a_plus', 0.01)  # LTP strength
        a_minus = self.params.get('a_minus', 0.0105)  # LTD strength
        
        # Decay traces over time
        dt = current_time - self.last_update_time
        self.state.trace_pre *= np.exp(-dt / tau_pre)
        self.state.trace_post *= np.exp(-dt / tau_post)
        
        # Update traces based on spikes
        if pre_spike:
            self.state.trace_pre += 1.0
            
            # If post neuron recently spiked, decrease weight (LTD)
            dw = -a_minus * self.state.trace_post
            self.state.weight = max(self.state.min_weight, 
                                   min(self.state.max_weight, 
                                       self.state.weight + dw))
            
        if post_spike:
            self.state.last_post_spike_time = current_time
            self.state.trace_post += 1.0
            
            # If pre neuron recently spiked, increase weight (LTP)
            dw = a_plus * self.state.trace_pre
            self.state.weight = max(self.state.min_weight, 
                                   min(self.state.max_weight, 
                                       self.state.weight + dw))
        
        self.last_update_time = current_time

class NeuromodulatedSTDPSynapse(STDPSynapse):
    """
    Neuromodulated STDP synapse with dopamine-like reward signaling
    
    Extends standard STDP with a three-factor learning rule that incorporates
    reward signals (like dopamine) to modulate plasticity, enabling reinforcement
    learning in spiking neural networks.
    """
    
    def _initialize_state(self) -> SynapseState:
        """Initialize neuromodulated STDP synapse state"""
        state = super()._initialize_state()
        state.eligibility_trace = 0.0
        return state
    
    def update_plasticity(self, pre_spike: bool, post_spike: bool, reward: float = 0.0) -> None:
        """
        Update synaptic strength based on three-factor learning rule
        
        Args:
            pre_spike: Whether the presynaptic neuron fired
            post_spike: Whether the postsynaptic neuron fired
            reward: Dopamine-like reward signal
        """
        if not self.is_active():
            return
            
        current_time = datetime.now().timestamp()
        
        # Three-factor learning parameters
        tau_pre = self.params.get('tau_pre', 0.020)  # 20ms
        tau_post = self.params.get('tau_post', 0.020)  # 20ms
        tau_eligibility = self.params.get('tau_eligibility', 0.5)  # 500ms
        a_plus = self.params.get('a_plus', 0.01)
        a_minus = self.params.get('a_minus', 0.0105)
        reward_factor = self.params.get('reward_factor', 1.0)
        
        # Decay traces over time
        dt = current_time - self.last_update_time
        self.state.trace_pre *= np.exp(-dt / tau_pre)
        self.state.trace_post *= np.exp(-dt / tau_post)
        self.state.eligibility_trace *= np.exp(-dt / tau_eligibility)
        
        # Update standard STDP traces
        if pre_spike:
            self.state.trace_pre += 1.0
            
            # Update eligibility trace based on post-before-pre timing
            self.state.eligibility_trace -= a_minus * self.state.trace_post
            
        if post_spike:
            self.state.last_post_spike_time = current_time
            self.state.trace_post += 1.0
            
            # Update eligibility trace based on pre-before-post timing
            self.state.eligibility_trace += a_plus * self.state.trace_pre
        
        # Apply weight change modulated by reward
        if abs(reward) > 1e-6:  # Only apply if reward is non-zero
            dw = reward_factor * reward * self.state.eligibility_trace
            self.state.weight = max(self.state.min_weight, 
                                   min(self.state.max_weight, 
                                       self.state.weight + dw))
        
        self.last_update_time = current_time

class ShortTermPlasticitySynapse(SynapseModel):
    """
    Short-term plasticity synapse model with facilitation and depression
    
    Implements dynamic synaptic efficacy that changes over short time scales,
    exhibiting either facilitation (increased efficacy) or depression (decreased
    efficacy) based on recent activity patterns.
    """
    
    def _initialize_state(self) -> SynapseState:
        """Initialize short-term plasticity synapse state"""
        base_state = SynapseState(
            weight=self.params.get('initial_weight', 0.5),
            max_weight=self.params.get('max_weight', 2.0),
            min_weight=self.params.get('min_weight', 0.0),
            delay=self.params.get('delay', 0.001),
            last_pre_spike_time=0.0,
            last_post_spike_time=0.0,
            trace_pre=0.0,
            trace_post=0.0,
            eligibility_trace=0.0,
            active=True,
            creation_time=datetime.now().timestamp(),
            transmission_history=[]
        )
        
        # Add STP-specific state variables
        self.facilitation = self.params.get('initial_facilitation', 1.0)
        self.depression = self.params.get('initial_depression', 1.0)
        
        return base_state
    
    def transmit_spike(self, spike: Spike) -> Optional[Spike]:
        """
        Transmit a spike with short-term plasticity dynamics
        
        Args:
            spike: The incoming spike from the presynaptic neuron
            
        Returns:
            Modified spike to be delivered to the postsynaptic neuron
        """
        if not self.is_active():
            return None
            
        current_time = datetime.now().timestamp()
        
        # Record spike time
        self.state.last_pre_spike_time = current_time
        
        # Update STP dynamics
        tau_f = self.params.get('tau_facilitation', 0.2)  # 200ms
        tau_d = self.params.get('tau_depression', 0.5)  # 500ms
        U = self.params.get('utilization', 0.2)  # Utilization of resources
        
        # Time since last spike
        dt = current_time - self.last_update_time if self.last_update_time > 0 else 0.1
        
        # Update facilitation and depression variables
        self.facilitation *= np.exp(-dt / tau_f)
        self.facilitation += U * (1 - self.facilitation)
        
        self.depression *= np.exp(-dt / tau_d)
        self.depression -= U * self.depression
        
        # Effective weight combines base weight with STP dynamics
        effective_weight = self.state.weight * self.facilitation * self.depression
        
        # Create transmitted spike
        transmitted_spike = Spike(
            source_id=spike.source_id,
            target_id=self.post_neuron_id,
            spike_type=spike.spike_type,
            weight=spike.weight * effective_weight,
            timestamp=current_time + self.state.delay,
            payload=spike.payload
        )
        
        # Record transmission
        if len(self.state.transmission_history) >= 100:
            self.state.transmission_history.pop(0)
        self.state.transmission_history.append(current_time)
        
        self.last_update_time = current_time
        return transmitted_spike
    
    def update_plasticity(self, pre_spike: bool, post_spike: bool, reward: float = 0.0) -> None:
        """
        Update STP dynamics (facilitation/depression)
        
        Note: STP is primarily updated during spike transmission, not here
        """
        # STP is primarily handled in transmit_spike
        # This method is implemented to satisfy the abstract base class
        pass

class SynapseFactory:
    """Factory for creating different types of synapses"""
    
    @staticmethod
    def create_synapse(model_type: str, 
                      synapse_id: str,
                      pre_neuron_id: str,
                      post_neuron_id: str,
                      params: Dict = None) -> SynapseModel:
        """
        Create a synapse of the specified type
        
        Args:
            model_type: Type of synapse model to create
            synapse_id: Unique identifier for the synapse
            pre_neuron_id: ID of the presynaptic neuron
            post_neuron_id: ID of the postsynaptic neuron
            params: Model-specific parameters
            
        Returns:
            Instantiated synapse model
        """
        if model_type == "STDP":
            return STDPSynapse(synapse_id, pre_neuron_id, post_neuron_id, params)
        elif model_type == "NeuromodulatedSTDP":
            return NeuromodulatedSTDPSynapse(synapse_id, pre_neuron_id, post_neuron_id, params)
        elif model_type == "ShortTermPlasticity":
            return ShortTermPlasticitySynapse(synapse_id, pre_neuron_id, post_neuron_id, params)
        else:
            raise ValueError(f"Unknown synapse model type: {model_type}")
