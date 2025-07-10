# ALEJO Unreal Engine Integration

This integration provides a professional studio-grade UI for ALEJO using Unreal Engine, with accessibility as a first-class feature.

## Architecture Overview

The integration consists of two main components:

1. **Node.js Bridge Server**: Exposes ALEJO's functionality via a WebSocket API
2. **Unreal Engine Plugin**: Connects to the bridge server and provides Blueprint-accessible functionality

```
┌──────────────┐      ┌────────────────┐      ┌────────────────┐
│              │      │                │      │                │
│  ALEJO Core  │<─────│  Node.js API   │<─────│  Unreal Engine │
│  Components  │      │  Bridge Server │      │  Plugin        │
│              │      │                │      │                │
└──────────────┘      └────────────────┘      └────────────────┘
     local JS           WebSocket API           C++ & Blueprints
```

## Core Principles

This integration follows ALEJO's core principles:

- **No External API Keys**: All functionality operates locally without external service dependencies
- **Accessibility First**: UI elements prioritize accessibility for users with disabilities
- **Local-First Architecture**: All processing remains on the user's device
- **Resource Efficiency**: Adaptive resource management based on system capabilities
- **Privacy Preserving**: No user data sent to external services

## Getting Started

### Prerequisites

- Node.js 16.x or higher
- Unreal Engine 5.1 or higher
- C++ development environment (Visual Studio 2019+ on Windows)

### Installation

#### 1. Start the Bridge Server

```bash
cd src/unreal-integration/server
npm install
npm start
```

The server will start on port 3030 by default.

#### 2. Install the Unreal Engine Plugin

1. Copy the `plugin` directory to your Unreal Engine project's `Plugins` directory
2. Rename the copied directory to `ALEJO`
3. Regenerate project files and build the solution
4. Enable the plugin in Unreal Engine (Edit > Plugins > Search for "ALEJO")

## Usage

### Connecting to ALEJO

```cpp
// C++ Example
#include "ALEJOSubsystem.h"

// Get the ALEJO subsystem
UALEJOSubsystem* ALEJOSubsystem = GetWorld()->GetGameInstance()->GetSubsystem<UALEJOSubsystem>();

// Connect to ALEJO bridge
ALEJOSubsystem->Connect();

// Check connection status
if (ALEJOSubsystem->IsConnected())
{
    // Connected successfully
}
```

In Blueprints, use the "Connect To ALEJO" node to establish a connection.

### Processing Text Input

```cpp
// C++ Example
TMap<FString, FString> Context;
Context.Add("sessionId", "12345");
Context.Add("previousContext", "greeting");

ALEJOSubsystem->ProcessText("Hello ALEJO", Context);

// Set up a delegate to receive the response
ALEJOSubsystem->OnTextProcessed.AddDynamic(this, &UMyClass::HandleTextProcessed);

// Delegate handler
void UMyClass::HandleTextProcessed(const FString& Response)
{
    // Do something with the response
    UE_LOG(LogTemp, Log, TEXT("ALEJO responded: %s"), *Response);
}
```

In Blueprints, use the "Process Text Input" node to send text to ALEJO and bind an event to "On Text Processed" to receive the response.

### Processing Voice Commands

```cpp
// C++ Example
TMap<FString, FString> Context;
ALEJOSubsystem->ProcessVoiceCommand("set timer for 5 minutes", Context);

// Set up a delegate to receive the response
ALEJOSubsystem->OnVoiceProcessed.AddDynamic(this, &UMyClass::HandleVoiceProcessed);

// Delegate handler
void UMyClass::HandleVoiceProcessed(const FString& Response)
{
    // Do something with the response
}
```

In Blueprints, use the "Process Voice Command" node and bind an event to "On Voice Processed".

### Accessibility Features

```cpp
// C++ Example
UALEJOAccessibilitySettings* Settings = NewObject<UALEJOAccessibilitySettings>();

// Configure visual accessibility
Settings->bHighContrastMode = true;
Settings->FontScaleFactor = 1.5f;
Settings->bScreenReaderEnabled = true;

// Configure hearing accessibility
Settings->bCaptionsEnabled = true;
Settings->bSignLanguageEnabled = true;
Settings->SignLanguagePreference = "ASL";

// Apply settings
ALEJOSubsystem->UpdateAccessibilitySettings(Settings);
```

In Blueprints, use the "Create Accessibility Settings" node to create a settings object, configure its properties, and then use "Update Accessibility Settings" to apply them.

### Custom Events

```cpp
// C++ Example
ALEJOSubsystem->SendCustomEvent("ui.screen.changed", "mainMenu");

// Listen for events from ALEJO
ALEJOSubsystem->OnALEJOEvent.AddDynamic(this, &UMyClass::HandleALEJOEvent);

void UMyClass::HandleALEJOEvent(const FString& EventType, const FString& EventData)
{
    if (EventType == "accessibility.announcement")
    {
        // Handle accessibility announcement
    }
}
```

In Blueprints, use the "Send Custom Event" node and bind to "On ALEJO Event" to receive events.

## Resource Mode Adaptation

The integration automatically adapts to ALEJO's resource mode changes:

```cpp
// C++ Example
ALEJOSubsystem->OnResourceModeChanged.AddDynamic(this, &UMyClass::HandleResourceModeChanged);

void UMyClass::HandleResourceModeChanged(const FString& NewMode)
{
    if (NewMode == "low")
    {
        // Reduce visual effects, simplify UI
    }
    else if (NewMode == "high")
    {
        // Enable full visual effects
    }
}
```

In Blueprints, bind to the "On Resource Mode Changed" event.

## Best Practices for Accessibility

1. **Screen Reader Support**: Ensure all UI elements have proper labels for screen readers
2. **Keyboard Navigation**: Make all functionality accessible via keyboard
3. **Adaptive Font Sizing**: Respect the user's font scaling preferences
4. **Color Contrast**: Use high contrast modes for visually impaired users
5. **Captions**: Provide captions for all audio content
6. **Sign Language**: Use the sign language avatar system for deaf users
7. **Reduced Motion**: Respect the user's preference for reduced motion

## Example Projects

Example Unreal projects demonstrating ALEJO integration are available in the `examples` directory:

1. **Basic Integration**: Simple example of connecting to ALEJO
2. **Accessibility Showcase**: Demonstrates all accessibility features
3. **Virtual Assistant**: Complete virtual assistant implementation

## License

This integration is open source and free to use under the MIT License.

## Contributing

Contributions are welcome! Please see CONTRIBUTING.md for guidelines.
