# ALEJO: Advanced Learning Engine with Judgment and Observation

![ALEJO AI](assets/alejo-logo.png)

[![GitHub stars](https://img.shields.io/github/stars/apintodesignco/ALEJO)](https://github.com/apintodesignco/ALEJO/stargazers)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://github.com/apintodesignco/ALEJO/actions/workflows/alejo-ci-cd.yml/badge.svg)](https://github.com/apintodesignco/ALEJO/actions/workflows/alejo-ci-cd.yml)

> **ALEJO is a next-generation cognitive assistant that transforms human-computer interaction through advanced memory systems, multimodal perception, and ethical reasoning—all with uncompromising privacy.**

[Features](#-key-features) • [Installation](#️-installation) • [Usage](#-usage) • [Contributing](#-contributing) • [License](#-license)

## 🌟 What Makes ALEJO Different

ALEJO stands apart from conventional AI assistants through its unique combination of:

- **Sophisticated Memory Architecture** — Maintains rich contextual awareness across conversations through relationship memory, autobiographical timeline, and adaptive prioritization
- **Human-Like Interaction** — Seamlessly integrates voice, vision, and gesture recognition to create natural, intuitive interactions that adapt to your communication style
- **Ethical Reasoning Foundation** — Makes decisions based on verifiable truth foundations with full transparency into reasoning processes and fallacy detection
- **Uncompromising Privacy** — Processes data locally by default with end-to-end encryption, giving you complete control over what information is stored and how it's used

## 🚀 Key Features

### Personalized AI Experience

- **🧠 Advanced Memory Systems** — Builds relationship memories, autobiographical timelines, and prioritizes information based on your interactions
- **🗣️ Voice Recognition & Training** — Recognizes your voice and adapts to your unique speaking style over time
- **👤 Facial Recognition** — Provides personalized interactions through secure, privacy-focused facial recognition
- **👋 Gesture Control System** — Enables intuitive hands-free interaction through camera-based gesture recognition

### Cognitive Capabilities

- **🧮 Reasoning Engine** — Validates logical consistency and provides transparent reasoning processes
- **🔍 Truth Foundation** — Maintains a core database of verifiable facts with built-in fallacy detection
- **📝 Reasoning Tracer** — Offers full transparency into how conclusions are reached
- **📚 Memory Preservation** — Features an optional memorial mode to respectfully preserve memories of loved ones

### Security & Privacy

- **🔒 Local Processing** — Keeps all data on your device by default
- **🛡️ Privacy Guard** — Implements end-to-end encryption for all sensitive data
- **✅ Consent Manager** — Provides granular control over data collection and usage
- **📊 Audit Trail** — Maintains complete transparency into all system actions

## 🛠️ Installation

To get started with ALEJO, follow these steps:

### 1. Clone the Repository

```bash
git clone https://github.com/apintodesignco/ALEJO.git
cd ALEJO
```

### 2. Install Dependencies

ALEJO uses both Python and Node.js. Install the necessary dependencies for both environments:

```bash
pip install -r requirements.txt
npm install
```

### 3. Run the Setup Script

This script handles the core installation process:

```bash
python setup.py install
```

### 4. Verify the Installation

Run the verification script to ensure all components are set up correctly:

```bash
python -m alejo.verify
```

For a quick end-to-end baseline test (no camera/voice/UI), you can run:

```bash
python scripts/smoke_test.py
```

Expect ✔ when all core modules are healthy.

## 💻 Usage

### As a Python Library

You can use ALEJO directly in your Python projects:

```python
from alejo import ALEJO

# Initialize ALEJO with default configuration
alejo = ALEJO()

# Start the voice and vision systems
alejo.start()

# Interact with ALEJO
response = alejo.process("Tell me about my schedule today")
print(response)
```

### Web Interface

To start the web interface, run:

```bash
python -m alejo.serve
```

Then open your browser to [http://localhost:8000](http://localhost:8000) to access the ALEJO web interface.

### Command Line Options

The `alejo.py` script accepts the following command line options:

- `--web`: Start the web interface (default: off)
- `--voice`: Enable voice interface (default: off)
- `--port PORT`: Web interface port (default: 5000)
- `--host HOST`: Web interface host (default: 0.0.0.0)
- `--debug`: Enable debug mode (default: off)

## 📊 System Requirements

- Python 3.9 or higher
- Node.js 18 or higher
- 8GB RAM minimum (16GB recommended)
- NVIDIA GPU with CUDA support (for optimal performance)
- Webcam and microphone (for vision and voice features)

## 📜 License

This project is licensed under the MIT License with ALEJO-specific terms - see the [LICENSE.md](LICENSE.md) file for details.

## 🤝 Contributing

Contributions are welcome! Please see our [Contributing Guidelines](CONTRIBUTING.md) for more information.

## 📚 Documentation

Comprehensive documentation is available at [docs.alejoai.com](https://docs.alejoai.com):

- [Getting Started Guide](https://docs.alejoai.com/getting-started)
- [API Reference](https://docs.alejoai.com/api)
- [Advanced Configuration](https://docs.alejoai.com/configuration)
- [Privacy & Security](https://docs.alejoai.com/privacy)
- [Contributing Guidelines](https://docs.alejoai.com/contributing)

## 📋 Branch Structure

- `main`: Core ALEJO assistant without disability features
- `disability-features`: Full implementation including accessibility and disability support modules

## 💖 Sponsorship and Support

ALEJO is being released as a free and accessible tool to help people first and foremost. However, development and maintenance require resources. If you would like to sponsor this project or help with funding, you can contribute through the following methods:

- **Stripe**: Sponsorships are available through our GitHub-linked Stripe account
- **Cash App**: **$apintodesignco**
- **Direct Contact**: Reach out to Alejandro Pinto at [al.pintoemail@gmail.com](mailto:al.pintoemail@gmail.com)

Your support helps ensure that ALEJO remains available to those who need it, especially people with disabilities who can benefit from its capabilities. Any contributions beyond what's needed for development are reinvested into making ALEJO better or given back to the community.

Thank you! Your contribution, no matter the size, is greatly appreciated and will be used to help people who really need it even further.

We believe in helping each other first and foremost - that's why ALEJO is free and accessible to all.

## Acknowledgments

ALEJO is a comprehensive AI system with advanced features and capabilities designed for seamless human-computer interaction.
