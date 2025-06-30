"""
Neural Models for ALEJO's SpiNNaker-inspired Neuromorphic Architecture

This module implements various biologically-inspired neuron models that form
the foundation of ALEJO's neuromorphic computing system.
"""

import numpy as np
import logging
from enum import Enum
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple, Union, Callable
from abc import ABC, abstractmethod
import asyncio
from datetime import datetime

logger = logging.getLogger(__name__)

class SpikeType(Enum):
    """Types of neural spikes for different signaling purposes"""
    EXCITATORY = 1
    INHIBITORY = 2
    MODULATORY = 3
    REWARD = 4
    ERROR = 5

@dataclass
class Spike:
    """Representation of a neural spike event"""
    source_id: str
    target_id: str
    spike_type: SpikeType
    weight: float
    timestamp: float
    payload: Optional[Dict] = None

@dataclass
class NeuronState:
    """Current state of a neuron"""
    membrane_potential: float
    threshold: float
    refractory_period: float
    last_spike_time: float
    spike_count: int
    adaptation_variable: float
    input_current: float
    
    def reset(self):
        """Reset neuron after spiking"""
        self.membrane_potential = 0.0
        self.last_spike_time = datetime.now().timestamp()
        self.spike_count += 1

class NeuronModel(ABC):
    """Abstract base class for all neuron models"""
    
    def __init__(self, neuron_id: str, params: Dict = None):
        self.neuron_id = neuron_id
        self.params = params or {}
        self.state = self._initialize_state()
        self.incoming_spikes: List[Spike] = []
        self.outgoing_connections: List[str] = []
        self.enabled = True
        self.last_update_time = datetime.now().timestamp()
        
    @abstractmethod
    def _initialize_state(self) -> NeuronState:
        """Initialize the neuron state with model-specific defaults"""
        pass
        
    @abstractmethod
    def update(self, dt: float) -> Optional[Spike]:
        """Update neuron state and potentially generate a spike"""
        pass
    
    def receive_spike(self, spike: Spike):
        """Receive an incoming spike from another neuron"""
        if not self.enabled:
            return
        
        self.incoming_spikes.append(spike)
        
    def add_connection(self, target_neuron_id: str):
        """Add an outgoing connection to another neuron"""
        if target_neuron_id not in self.outgoing_connections:
            self.outgoing_connections.append(target_neuron_id)
            
    def remove_connection(self, target_neuron_id: str):
        """Remove an outgoing connection to another neuron"""
        if target_neuron_id in self.outgoing_connections:
            self.outgoing_connections.remove(target_neuron_id)

class LeakyIntegrateAndFireNeuron(NeuronModel):
    """
    Leaky Integrate-and-Fire (LIF) neuron model
    
    A simple but efficient spiking neuron model that integrates input and
    leaks potential over time. When membrane potential exceeds threshold,
    the neuron fires a spike and resets.
    """
    
    def _initialize_state(self) -> NeuronState:
        """Initialize LIF neuron state"""
        return NeuronState(
            membrane_potential=0.0,
            threshold=self.params.get('threshold', 1.0),
            refractory_period=self.params.get('refractory_period', 0.002),  # 2ms
            last_spike_time=0.0,
            spike_count=0,
            adaptation_variable=0.0,
            input_current=0.0
        )
    
    def update(self, dt: float) -> Optional[Spike]:
        """
        Update LIF neuron state and potentially generate a spike
        
        Args:
            dt: Time step in seconds
            
        Returns:
            Spike object if neuron fires, None otherwise
        """
        current_time = datetime.now().timestamp()
        
        # Check if in refractory period
        if current_time - self.state.last_spike_time < self.state.refractory_period:
            return None
        
        # Process incoming spikes
        input_current = 0.0
        for spike in self.incoming_spikes:
            if spike.spike_type == SpikeType.EXCITATORY:
                input_current += spike.weight
            elif spike.spike_type == SpikeType.INHIBITORY:
                input_current -= spike.weight
                
        self.incoming_spikes.clear()
        self.state.input_current = input_current
        
        # Update membrane potential with leak
        tau_m = self.params.get('tau_m', 0.01)  # Membrane time constant (10ms)
        R = self.params.get('R', 1.0)  # Membrane resistance
        
        # LIF equation: dV/dt = -(V - V_rest)/tau_m + R*I(t)
        v_rest = self.params.get('v_rest', 0.0)
        dv = (-(self.state.membrane_potential - v_rest) / tau_m + R * input_current) * dt
        self.state.membrane_potential += dv
        
        # Check for spike
        if self.state.membrane_potential >= self.state.threshold:
            # Generate spike
            spike = Spike(
                source_id=self.neuron_id,
                target_id="",  # Will be set by the network
                spike_type=SpikeType.EXCITATORY,
                weight=1.0,
                timestamp=current_time,
                payload=None
            )
            
            # Reset membrane potential
            self.state.reset()
            
            return spike
            
        self.last_update_time = current_time
        return None

class IzhikevichNeuron(NeuronModel):
    """
    Izhikevich neuron model
    
    A computationally efficient model that can reproduce many different
    firing patterns observed in real neurons.
    """
    
    def _initialize_state(self) -> NeuronState:
        """Initialize Izhikevich neuron state"""
        return NeuronState(
            membrane_potential=self.params.get('c', -65.0),  # Initial voltage
            threshold=30.0,  # Fixed threshold for Izhikevich model
            refractory_period=0.001,  # 1ms
            last_spike_time=0.0,
            spike_count=0,
            adaptation_variable=self.params.get('d', 2.0) * self.params.get('b', 0.2),
            input_current=0.0
        )
    
    def update(self, dt: float) -> Optional[Spike]:
        """
        Update Izhikevich neuron state and potentially generate a spike
        
        Args:
            dt: Time step in seconds
            
        Returns:
            Spike object if neuron fires, None otherwise
        """
        current_time = datetime.now().timestamp()
        
        # Process incoming spikes
        input_current = 0.0
        for spike in self.incoming_spikes:
            if spike.spike_type == SpikeType.EXCITATORY:
                input_current += spike.weight
            elif spike.spike_type == SpikeType.INHIBITORY:
                input_current -= spike.weight
                
        self.incoming_spikes.clear()
        self.state.input_current = input_current
        
        # Izhikevich model parameters
        a = self.params.get('a', 0.02)  # Recovery rate
        b = self.params.get('b', 0.2)   # Sensitivity of recovery variable
        c = self.params.get('c', -65.0)  # Post-spike reset value for V
        d = self.params.get('d', 2.0)    # Post-spike increment for U
        
        # Scale dt from seconds to ms for Izhikevich equations
        dt_ms = dt * 1000
        
        # Izhikevich equations
        v = self.state.membrane_potential
        u = self.state.adaptation_variable
        
        dv = (0.04 * v**2 + 5 * v + 140 - u + input_current) * dt_ms
        du = (a * (b * v - u)) * dt_ms
        
        v += dv
        u += du
        
        self.state.membrane_potential = v
        self.state.adaptation_variable = u
        
        # Check for spike
        if v >= self.state.threshold:
            # Generate spike
            spike = Spike(
                source_id=self.neuron_id,
                target_id="",  # Will be set by the network
                spike_type=SpikeType.EXCITATORY,
                weight=1.0,
                timestamp=current_time,
                payload=None
            )
            
            # Reset according to Izhikevich model
            self.state.membrane_potential = c
            self.state.adaptation_variable = u + d
            self.state.last_spike_time = current_time
            self.state.spike_count += 1
            
            return spike
            
        self.last_update_time = current_time
        return None

class AdaptiveExponentialNeuron(NeuronModel):
    """
    Adaptive Exponential Integrate-and-Fire (AdEx) neuron model
    
    A more biologically realistic model that includes an adaptation mechanism
    and exponential spike initiation.
    """
    
    def _initialize_state(self) -> NeuronState:
        """Initialize AdEx neuron state"""
        return NeuronState(
            membrane_potential=self.params.get('v_rest', -70.0),
            threshold=self.params.get('v_thresh', -50.0),
            refractory_period=self.params.get('refractory_period', 0.002),  # 2ms
            last_spike_time=0.0,
            spike_count=0,
            adaptation_variable=0.0,
            input_current=0.0
        )
    
    def update(self, dt: float) -> Optional[Spike]:
        """
        Update AdEx neuron state and potentially generate a spike
        
        Args:
            dt: Time step in seconds
            
        Returns:
            Spike object if neuron fires, None otherwise
        """
        current_time = datetime.now().timestamp()
        
        # Check if in refractory period
        if current_time - self.state.last_spike_time < self.state.refractory_period:
            return None
        
        # Process incoming spikes
        input_current = 0.0
        for spike in self.incoming_spikes:
            if spike.spike_type == SpikeType.EXCITATORY:
                input_current += spike.weight
            elif spike.spike_type == SpikeType.INHIBITORY:
                input_current -= spike.weight
                
        self.incoming_spikes.clear()
        self.state.input_current = input_current
        
        # AdEx parameters
        C = self.params.get('C', 281.0)  # Membrane capacitance
        g_L = self.params.get('g_L', 30.0)  # Leak conductance
        E_L = self.params.get('E_L', -70.6)  # Leak reversal potential
        delta_T = self.params.get('delta_T', 2.0)  # Slope factor
        v_T = self.params.get('v_T', -50.4)  # Threshold potential
        tau_w = self.params.get('tau_w', 144.0)  # Adaptation time constant
        a = self.params.get('a', 4.0)  # Subthreshold adaptation
        b = self.params.get('b', 80.5)  # Spike-triggered adaptation
        v_reset = self.params.get('v_reset', -70.6)  # Reset potential
        
        # AdEx equations
        v = self.state.membrane_potential
        w = self.state.adaptation_variable
        
        # Exponential term for spike initiation
        exp_term = delta_T * np.exp((v - v_T) / delta_T)
        
        # Membrane potential equation
        dv = (-(v - E_L) + exp_term - w / C + input_current / C) * dt
        
        # Adaptation variable equation
        dw = (a * (v - E_L) - w) / tau_w * dt
        
        v += dv
        w += dw
        
        self.state.membrane_potential = v
        self.state.adaptation_variable = w
        
        # Check for spike (using a high threshold as proxy for exponential divergence)
        if v >= 0:  # Arbitrary high value
            # Generate spike
            spike = Spike(
                source_id=self.neuron_id,
                target_id="",  # Will be set by the network
                spike_type=SpikeType.EXCITATORY,
                weight=1.0,
                timestamp=current_time,
                payload=None
            )
            
            # Reset membrane potential and increase adaptation
            self.state.membrane_potential = v_reset
            self.state.adaptation_variable = w + b
            self.state.last_spike_time = current_time
            self.state.spike_count += 1
            
            return spike
            
        self.last_update_time = current_time
        return None

class NeuronFactory:
    """Factory for creating different types of neurons"""
    
    @staticmethod
    def create_neuron(model_type: str, neuron_id: str, params: Dict = None) -> NeuronModel:
        """
        Create a neuron of the specified type
        
        Args:
            model_type: Type of neuron model to create
            neuron_id: Unique identifier for the neuron
            params: Model-specific parameters
            
        Returns:
            Instantiated neuron model
        """
        if model_type == "LIF":
            return LeakyIntegrateAndFireNeuron(neuron_id, params)
        elif model_type == "Izhikevich":
            return IzhikevichNeuron(neuron_id, params)
        elif model_type == "AdEx":
            return AdaptiveExponentialNeuron(neuron_id, params)
        else:
            raise ValueError(f"Unknown neuron model type: {model_type}")
