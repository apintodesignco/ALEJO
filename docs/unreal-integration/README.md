# ALEJO Unreal Engine Integration

This documentation provides a comprehensive guide to integrating ALEJO with Unreal Engine projects, with a focus on accessibility, voice interaction, and privacy-preserving local architecture.

## Overview

ALEJO's Unreal Engine integration consists of two main components:

1. **Node.js Bridge Server**: A local server that handles voice processing, text processing, and resource management
2. **Unreal Engine Plugin**: A plugin that communicates with the bridge server via WebSockets

This architecture ensures all processing remains local (no external API keys or cloud services required), while providing powerful accessibility and voice interaction features to Unreal Engine projects.

## Prerequisites

- Unreal Engine 5.x
- Node.js 18.x or later
- Windows, macOS, or Linux

## Getting Started

### 1. Set up the Node.js Bridge Server

The bridge server must be running before your Unreal Engine project can connect to ALEJO.

```bash
# Navigate to the server directory
cd src/unreal-integration/server

# Install dependencies
npm install

# Start the server
node server.js
```

By default, the server runs on `localhost:3030`. This can be configured in `server.js`.

### 2. Install the ALEJO Plugin for Unreal Engine

1. Copy the `plugin` folder from `src/unreal-integration` to your Unreal Engine project's `Plugins` directory
2. If the `Plugins` directory doesn't exist, create it
3. Restart the Unreal Engine editor
4. Enable the ALEJO plugin via Edit → Plugins → ALEJO

### 3. Set up the ALEJO Subsystem

Add the ALEJO Subsystem to your `GameInstance` class:

```cpp
// In your GameInstance header
#include "ALEJOSubsystem.h"

// In your GameInstance class implementation
void UMyGameInstance::Init()
{
    Super::Init();
    
    // Get the ALEJO Subsystem
    UALEJOSubsystem* ALEJOSubsystem = GetSubsystem<UALEJOSubsystem>();
    if (ALEJOSubsystem)
    {
        // Connect to the bridge server
        ALEJOSubsystem->ConnectToWebSocket("ws://localhost:3030");
    }
}
```

## Core Components

### ALEJOSubsystem

`UALEJOSubsystem` is the main interface between your Unreal Engine project and the ALEJO system. It manages WebSocket communication, processes text and voice commands, and handles accessibility settings.

```cpp
// Get the subsystem from a UObject context
UALEJOSubsystem* ALEJOSubsystem = GetGameInstance()->GetSubsystem<UALEJOSubsystem>();

// Send text to be processed
TMap<FString, FString> Context;
Context.Add(TEXT("source"), TEXT("game_dialog"));
ALEJOSubsystem->ProcessText("Hello ALEJO", Context);

// Process a voice command
ALEJOSubsystem->ProcessVoiceCommand("Open inventory", Context);

// Listen for results
ALEJOSubsystem->OnTextProcessingResult.AddDynamic(this, &UMyClass::HandleTextResult);
ALEJOSubsystem->OnVoiceProcessingResult.AddDynamic(this, &UMyClass::HandleVoiceResult);
```

### ALEJOAccessibilitySettings

`UALEJOAccessibilitySettings` manages accessibility preferences for users with disabilities:

```cpp
// Create or get accessibility settings
UALEJOAccessibilitySettings* AccessibilitySettings = ALEJOSubsystem->CreateAccessibilitySettings();

// Configure accessibility features
AccessibilitySettings->bScreenReaderEnabled = true;
AccessibilitySettings->bHighContrastMode = true;
AccessibilitySettings->FontScaleFactor = 1.5f;
AccessibilitySettings->bReducedMotion = true;
AccessibilitySettings->bSimplifiedLanguage = true;

// Update settings in the subsystem
ALEJOSubsystem->UpdateAccessibilitySettings(AccessibilitySettings);
```

### ALEJOUIHelper

`UALEJOUIHelper` provides tools to build accessible UIs:

```cpp
// Create UI helper
UALEJOUIHelper* UIHelper = NewObject<UALEJOUIHelper>();
UIHelper->Initialize(AccessibilitySettings);

// Apply accessibility features
UIHelper->ApplyHighContrastMode(MyWidget, true);
UIHelper->ApplyFontScaling(MyWidget);
UIHelper->AnnounceToScreenReader("Welcome to the game");

// Get accessible color pairs
FLinearColor BackgroundColor;
FLinearColor ForegroundColor;
UIHelper->GetAccessibleColorPair(BackgroundColor, ForegroundColor, true);
```

### ALEJOAccessibleWidget

`UALEJOAccessibleWidget` is a base UMG widget class that implements accessibility features:

```cpp
// Create a Blueprint widget that inherits from ALEJOAccessibleWidget
// In the widget blueprint:

// Apply accessibility settings
UFUNCTION(BlueprintCallable)
void ApplyAccessibilitySettings();

// Announce to screen readers
UFUNCTION(BlueprintCallable)
void AnnounceToScreenReader(const FString& Message, bool bInterrupt);

// Voice input handling
UFUNCTION(BlueprintCallable)
void OnVoiceInputReceived(const FString& VoiceCommand);

// Event handlers
UFUNCTION(BlueprintNativeEvent)
void OnConnectionStatusChanged(bool bIsConnected);

UFUNCTION(BlueprintNativeEvent)
void OnTextProcessingResult(const FString& Result);

UFUNCTION(BlueprintNativeEvent)
void OnVoiceProcessingResult(const FString& Result);

UFUNCTION(BlueprintNativeEvent)
void OnResourceModeChanged(const FString& ResourceMode);
```

## Blueprint Integration

ALEJO provides a Blueprint function library to make integration easy for Blueprint-only projects:

```cpp
// Connect to the bridge server
UALEJOBlueprintLibrary::ConnectToALEJO("ws://localhost:3030");

// Process text
UALEJOBlueprintLibrary::ProcessText("Hello ALEJO", ContextMap);

// Process voice command
UALEJOBlueprintLibrary::ProcessVoiceCommand("Open inventory", ContextMap);

// Create accessibility settings
UALEJOAccessibilitySettings* Settings = UALEJOBlueprintLibrary::CreateAccessibilitySettings();

// Update accessibility settings
UALEJOBlueprintLibrary::UpdateAccessibilitySettings(Settings);

// Send custom events
UALEJOBlueprintLibrary::SendCustomEvent("game.level.completed", "{\"level\":1,\"score\":100}");
```

## Accessibility-First Development

ALEJO prioritizes accessibility features for users with disabilities. When developing with the ALEJO Unreal Engine integration, follow these best practices:

### Visual Accessibility

- Use high contrast mode for users with low vision
- Implement scalable fonts and UI elements
- Support color blind users with appropriate color schemes
- Reduce motion and animations for users sensitive to motion

```cpp
// Example: Setting high contrast mode
AccessibilitySettings->bHighContrastMode = true;
UIHelper->ApplyHighContrastMode(MyWidget, true);

// Example: Setting font scaling
AccessibilitySettings->FontScaleFactor = 1.5f;
UIHelper->ApplyFontScaling(MyWidget);

// Example: Setting reduced motion
AccessibilitySettings->bReducedMotion = true;
UIHelper->ApplyReducedMotionSettings(MyWidget);
```

### Hearing Accessibility

- Provide visual alternatives for audio cues
- Support screen readers for UI navigation
- Implement subtitles and captions

```cpp
// Example: Announcing to screen readers
UIHelper->AnnounceToScreenReader("Enemy approaching from the left");

// Example: Visual alert for audio cue
void PlayAudioCue(UAudioComponent* AudioComponent, const FString& CueText)
{
    AudioComponent->Play();
    
    if (AccessibilitySettings->bScreenReaderEnabled || AccessibilitySettings->bVisualAudioCues)
    {
        ShowVisualAlert(CueText);
        UIHelper->AnnounceToScreenReader(CueText);
    }
}
```

### Motor Accessibility

- Support keyboard navigation for all UI elements
- Enable voice commands for common actions
- Provide simplified control schemes

```cpp
// Example: Enable keyboard navigation
AccessibilitySettings->bKeyboardNavigationEnabled = true;
SetWidgetNavigable(MyWidget, true);

// Example: Process voice commands
ALEJOSubsystem->ProcessVoiceCommand("Use health potion", Context);

// Example: Simplify controls based on settings
if (AccessibilitySettings->bSimplifiedControls)
{
    EnableOneButtonMode(true);
}
```

### Cognitive Accessibility

- Offer simplified language options
- Provide clear instructions and feedback
- Support adjustable game speed

```cpp
// Example: Use simplified language
if (AccessibilitySettings->bSimplifiedLanguage)
{
    DisplayText = UIHelper->GetAccessibleText(OriginalText);
}

// Example: Clear feedback
UIHelper->AnnounceToScreenReader("Mission completed. New objective: Return to base");
```

## Resource Mode Adaptation

ALEJO adapts to the available system resources through resource modes. Your Unreal Engine integration should respect these modes:

```cpp
// Listen for resource mode changes
ALEJOSubsystem->OnResourceModeChanged.AddDynamic(this, &UMyClass::HandleResourceModeChanged);

// Handle resource mode changes
void UMyClass::HandleResourceModeChanged(const FString& ResourceMode)
{
    if (ResourceMode == TEXT("low"))
    {
        // Reduce visual effects
        // Disable non-essential features
        // Optimize performance
    }
    else if (ResourceMode == TEXT("medium"))
    {
        // Standard feature set
    }
    else if (ResourceMode == TEXT("high"))
    {
        // Enable enhanced features
        // Full visual effects
    }
}
```

## WebSocket Communication

The communication between Unreal Engine and the Node.js bridge server uses JSON messages over WebSockets:

### Message Types

| Type | Direction | Purpose |
|------|-----------|---------|
| `processText` | UE → Server | Send text for processing |
| `textResult` | Server → UE | Return text processing results |
| `processVoiceCommand` | UE → Server | Send voice command for processing |
| `voiceResult` | Server → UE | Return voice processing results |
| `updateAccessibilitySettings` | UE → Server | Update accessibility settings |
| `accessibilitySettingsUpdated` | Server → UE | Confirm settings update |
| `setResourceMode` | UE → Server | Change resource mode |
| `resourceModeChanged` | Server → UE | Notify of resource mode change |
| `startVoiceStreaming` | UE → Server | Start streaming voice input |
| `stopVoiceStreaming` | UE → Server | Stop streaming voice input |
| `voiceActivity` | Server → UE | Voice activity feedback |
| `customEvent` | Both | Custom events for extensibility |

## Sample Implementations

### Basic Voice Command UI

```cpp
// In a widget blueprint extending ALEJOAccessibleWidget:

// Override the voice processing result handler
void UMyVoiceCommandWidget::OnVoiceProcessingResult_Implementation(const FString& Result)
{
    // Update UI with result
    ResultText->SetText(FText::FromString(Result));
    
    // Announce result to screen reader
    AnnounceToScreenReader(FString::Printf(TEXT("Voice command result: %s"), *Result));
    
    // Process commands
    if (Result.Contains(TEXT("open inventory")))
    {
        OpenInventory();
    }
    else if (Result.Contains(TEXT("map")))
    {
        OpenMap();
    }
}

// Start voice command mode
void UMyVoiceCommandWidget::StartVoiceCommand()
{
    ShowVoiceActivityFeedback(true);
    AnnounceToScreenReader(TEXT("Listening for voice command"), true);
    
    // Send custom event to start voice input
    if (UGameInstance* GameInstance = GetGameInstance())
    {
        if (UALEJOSubsystem* ALEJOSubsystem = GameInstance->GetSubsystem<UALEJOSubsystem>())
        {
            ALEJOSubsystem->SendCustomEvent(TEXT("voice.listening.start"), TEXT("{}"));
        }
    }
}
```

### Accessibility Settings Menu

```cpp
// In a settings menu widget:

// Initialize with current settings
void UAccessibilitySettingsWidget::NativeConstruct()
{
    Super::NativeConstruct();
    
    if (UGameInstance* GameInstance = GetGameInstance())
    {
        if (UALEJOSubsystem* ALEJOSubsystem = GameInstance->GetSubsystem<UALEJOSubsystem>())
        {
            // Get current settings
            UALEJOAccessibilitySettings* CurrentSettings = ALEJOSubsystem->GetAccessibilitySettings();
            if (CurrentSettings)
            {
                // Update UI controls
                ScreenReaderToggle->SetIsChecked(CurrentSettings->bScreenReaderEnabled);
                HighContrastToggle->SetIsChecked(CurrentSettings->bHighContrastMode);
                FontScaleSlider->SetValue(CurrentSettings->FontScaleFactor);
                ReducedMotionToggle->SetIsChecked(CurrentSettings->bReducedMotion);
                SimplifiedLanguageToggle->SetIsChecked(CurrentSettings->bSimplifiedLanguage);
            }
        }
    }
}

// Apply settings when changed
void UAccessibilitySettingsWidget::ApplySettings()
{
    if (UGameInstance* GameInstance = GetGameInstance())
    {
        if (UALEJOSubsystem* ALEJOSubsystem = GameInstance->GetSubsystem<UALEJOSubsystem>())
        {
            // Create new settings object
            UALEJOAccessibilitySettings* NewSettings = ALEJOSubsystem->CreateAccessibilitySettings();
            
            // Update from UI controls
            NewSettings->bScreenReaderEnabled = ScreenReaderToggle->IsChecked();
            NewSettings->bHighContrastMode = HighContrastToggle->IsChecked();
            NewSettings->FontScaleFactor = FontScaleSlider->GetValue();
            NewSettings->bReducedMotion = ReducedMotionToggle->IsChecked();
            NewSettings->bSimplifiedLanguage = SimplifiedLanguageToggle->IsChecked();
            
            // Apply to subsystem
            ALEJOSubsystem->UpdateAccessibilitySettings(NewSettings);
            
            // Announce changes
            AnnounceToScreenReader(TEXT("Accessibility settings updated"), true);
        }
    }
}
```

## Troubleshooting

### Common Issues

1. **Connection Failed**
   - Ensure the Node.js bridge server is running on the expected port
   - Check for firewall restrictions on localhost connections
   - Verify WebSocket URL format (should be `ws://localhost:3030`)

2. **Voice Commands Not Working**
   - Check microphone permissions and settings
   - Verify voice processing modules are loaded in the Node.js server
   - Check WebSocket connection status

3. **Accessibility Features Not Applied**
   - Ensure accessibility settings are correctly serialized and sent to the server
   - Check that UI helpers are initialized with the correct settings
   - Verify widget inheritance from ALEJOAccessibleWidget

### Logging

Enable detailed logging for troubleshooting:

```cpp
// In your GameInstance or module startup code
FLogCategoryAlejo.SetVerbosity(ELogVerbosity::Verbose);

// In the Node.js server
process.env.DEBUG = 'alejo:*';
```

## Testing

The ALEJO Unreal Engine integration includes comprehensive tests:

1. **Node.js Bridge Tests**
   - WebSocket communication
   - Event handling
   - Resource management
   - Voice processing

2. **Unreal Engine Plugin Tests**
   - ALEJOSubsystem functionality
   - Accessibility settings serialization
   - UI helper functions
   - Event propagation

Run the tests as follows:

```bash
# For Node.js bridge tests
cd test/unreal-integration
npm test

# For Unreal Engine plugin tests
# Open Unreal Editor → Developer Tools → Session Frontend → Automation
# Run the "ALEJO.Integration" tests
```

## Security and Privacy

ALEJO follows strict privacy and security principles:

1. **Local Processing**: All data processing happens locally, with no external service dependencies
2. **No API Keys**: No external API keys or cloud services required
3. **WebSocket Security**: Communication restricted to localhost
4. **Data Privacy**: No personal data stored or transmitted
5. **Security Headers**: HTTP security headers implemented on the bridge server

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines on contributing to the ALEJO Unreal Engine integration.

## License

ALEJO is open source and free. See [LICENSE](../LICENSE) for details.
