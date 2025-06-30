#!/usr/bin/env python3
"""
ALEJO Startup Sound Generator

Creates a high-quality, futuristic startup sound that gives the impression
of a half-machine, half-human entity awakening.
"""

import os
import sys
import numpy as np
from scipy.io import wavfile
import argparse
from pathlib import Path

def create_startup_sound(output_path, duration=5.0, sample_rate=44100):
    """
    Create a futuristic startup sound that combines mechanical and organic elements.
    
    Args:
        output_path: Path to save the WAV file
        duration: Duration of the sound in seconds
        sample_rate: Sample rate of the audio
    """
    # Calculate total samples
    total_samples = int(duration * sample_rate)
    
    # Create time array
    t = np.linspace(0, duration, total_samples, False)
    
    # Initialize the audio array
    audio = np.zeros(total_samples)
    
    # Part 1: Low power-up hum (0-1.5s)
    mask1 = (t < 1.5)
    t1 = t[mask1]
    env1 = np.power(t1 / 1.5, 2) * np.exp(-(t1 / 1.5) * 2)
    freq1 = 80 + 40 * np.sin(2 * np.pi * 0.5 * t1)
    hum = env1 * np.sin(2 * np.pi * freq1 * t1)
    audio[mask1] += hum * 0.5
    
    # Part 2: Rising electronic tone (1.0-2.5s)
    mask2 = (t >= 1.0) & (t < 2.5)
    t2 = t[mask2] - 1.0
    env2 = np.power(t2 / 1.5, 0.5) * np.exp(-(t2 / 1.5) * 2)
    freq2 = 200 + 800 * t2 / 1.5
    tone = env2 * np.sin(2 * np.pi * freq2 * t2)
    audio[mask2] += tone * 0.4
    
    # Part 3: Digital processing sounds (1.8-3.0s)
    mask3 = (t >= 1.8) & (t < 3.0)
    t3 = t[mask3] - 1.8
    env3 = np.exp(-(t3 / 1.2) * 3)
    
    # Create digital processing sounds (random blips and beeps)
    for i in range(15):
        start = np.random.uniform(0, 1.0)
        length = np.random.uniform(0.05, 0.2)
        freq = np.random.uniform(500, 2000)
        
        submask = (t3 >= start) & (t3 < start + length)
        if np.any(submask):
            t_sub = t3[submask] - start
            env_sub = np.sin(np.pi * t_sub / length)
            blip = env_sub * np.sin(2 * np.pi * freq * t_sub)
            audio[mask3][submask] += blip * 0.3 * env3[submask]
    
    # Part 4: Human-like breath (2.5-3.5s)
    mask4 = (t >= 2.5) & (t < 3.5)
    t4 = t[mask4] - 2.5
    env4 = np.sin(np.pi * t4)
    
    # Create breath noise
    np.random.seed(42)  # For reproducibility
    noise = np.random.normal(0, 1, len(t4))
    filtered_noise = np.convolve(noise, np.hanning(500) / 250, mode='same')
    breath = env4 * filtered_noise
    audio[mask4] += breath * 0.2
    
    # Part 5: System activation (3.0-5.0s)
    mask5 = (t >= 3.0)
    t5 = t[mask5] - 3.0
    env5 = 1 - np.exp(-(t5 / 2.0) * 3)
    
    # Create activation chord (multiple harmonically related frequencies)
    chord_freqs = [220, 330, 440, 550, 660]
    chord = np.zeros_like(t5)
    for i, freq in enumerate(chord_freqs):
        amp = 0.8 / (i + 1)
        phase = np.random.uniform(0, 2 * np.pi)
        chord += amp * np.sin(2 * np.pi * freq * t5 + phase)
    
    # Add subtle pulsing
    pulse_rate = 8.0  # Hz
    pulse_depth = 0.2
    pulse = 1.0 - pulse_depth * np.power(np.sin(2 * np.pi * pulse_rate * t5), 2)
    
    audio[mask5] += env5 * chord * pulse * 0.4
    
    # Final crescendo (4.0-5.0s)
    mask6 = (t >= 4.0)
    t6 = t[mask6] - 4.0
    env6 = np.power(t6, 0.5)
    sweep_freq = 100 + 900 * t6
    final_sweep = env6 * np.sin(2 * np.pi * sweep_freq * t6)
    audio[mask6] += final_sweep * 0.3
    
    # Normalize audio to prevent clipping
    audio = audio / np.max(np.abs(audio)) * 0.9
    
    # Convert to 16-bit PCM
    audio_16bit = (audio * 32767).astype(np.int16)
    
    # Save as WAV file
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    wavfile.write(output_path, sample_rate, audio_16bit)
    
    return output_path

def main():
    """Main function to parse arguments and create the startup sound."""
    parser = argparse.ArgumentParser(description='Create ALEJO startup sound')
    parser.add_argument('--output', type=str, default=None, 
                        help='Output path for the WAV file')
    parser.add_argument('--duration', type=float, default=5.0,
                        help='Duration of the sound in seconds')
    parser.add_argument('--sample-rate', type=int, default=44100,
                        help='Sample rate of the audio')
    
    args = parser.parse_args()
    
    # Default output path if not specified
    if args.output is None:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        sounds_dir = os.path.join(script_dir, 'sounds')
        os.makedirs(sounds_dir, exist_ok=True)
        args.output = os.path.join(sounds_dir, 'alejo_startup.wav')
    
    # Create the startup sound
    output_path = create_startup_sound(args.output, args.duration, args.sample_rate)
    print(f"Startup sound created at: {output_path}")

if __name__ == "__main__":
    main()
