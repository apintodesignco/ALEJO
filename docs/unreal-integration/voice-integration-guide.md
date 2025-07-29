# ALEJO Voice Integration Guide for Unreal Engine

This guide details how to implement voice interaction features in your Unreal Engine project using the ALEJO integration, with a focus on privacy-preserving local processing and accessibility.

## Overview

ALEJO provides comprehensive voice interaction capabilities that enable players to:

- Issue voice commands to control the game
- Receive voice feedback through text-to-speech
- Engage in natural conversation with in-game characters
- Navigate interfaces using voice when physical controls are difficult

All voice processing happens locally on the user's device, with no external API keys or cloud services required.

## Core Voice Integration Components

### Voice Command Processing

ALEJO handles two primary types of voice interaction:

1. **Command-based**: Specific voice commands that trigger predefined actions
2. **Conversational**: Natural language processing for dialogue and queries

#### Architecture Overview

```text
[Game Input] → [ALEJO Subsystem] → [WebSocket] → [Node.js Bridge] → [Voice Processing] → [WebSocket] → [ALEJO Subsystem] → [Game Response]
```

## Getting Started with Voice Integration

### 1. Voice Command Setup

First, connect your widget to the ALEJO voice processing system:

```cpp
// In your widget class header (C++)
UCLASS()
class MYGAME_API UMyVoiceEnabledWidget : public UALEJOAccessibleWidget
{
    GENERATED_BODY()
    
protected:
    // Override required functions
    virtual void NativeConstruct() override;
    
    // Handle voice processing results
    virtual void OnVoiceProcessingResult_Implementation(const FString& Result) override;
    
    // Start voice command mode
    UFUNCTION(BlueprintCallable)
    void StartVoiceCommand();
};
```

Implementation:

```cpp
// In your widget class implementation (C++)
void UMyVoiceEnabledWidget::NativeConstruct()
{
    Super::NativeConstruct();
    
    // Enable voice shortcut (Ctrl+Space)
    bEnableVoiceShortcut = true;
    VoiceActivationKeys = {EKeys::LeftControl, EKeys::SpaceBar};
    
    // Enable voice activity feedback
    bShowVoiceActivityFeedback = true;
    
    // Set voice activity icon position
    VoiceActivityIconPosition = FVector2D(50.0f, 50.0f);
}

void UMyVoiceEnabledWidget::OnVoiceProcessingResult_Implementation(const FString& Result)
{
    // Handle the voice processing result
    AnnounceToScreenReader(FString::Printf(TEXT("Voice command received: %s"), *Result));
    
    // Parse voice commands and execute corresponding actions
    if (Result.Contains(TEXT("pause")) || Result.Contains(TEXT("stop")))
    {
        PauseGame();
    }
    else if (Result.Contains(TEXT("inventory")) || Result.Contains(TEXT("items")))
    {
        OpenInventory();
    }
    else if (Result.Contains(TEXT("map")) || Result.Contains(TEXT("location")))
    {
        OpenMap();
    }
    // Add more command parsing as needed
}

void UMyVoiceEnabledWidget::StartVoiceCommand()
{
    // Get the ALEJO subsystem
    UALEJOSubsystem* ALEJOSubsystem = GetGameInstance()->GetSubsystem<UALEJOSubsystem>();
    if (!ALEJOSubsystem)
    {
        return;
    }
    
    // Start voice streaming
    TMap<FString, FString> Context;
    Context.Add(TEXT("source"), TEXT("gameplay"));
    Context.Add(TEXT("interface"), TEXT("main_ui"));
    
    ALEJOSubsystem->StartVoiceStreaming(Context);
    
    // Show visual feedback
    ShowVoiceActivityFeedback(true);
    
    // Announce to screen reader
    AnnounceToScreenReader(TEXT("Listening for voice command"), true);
}
```

### 2. Blueprint Implementation

For Blueprint-only projects, you can create a Blueprint class based on `UALEJOAccessibleWidget`:

1. Create a new Blueprint Widget class that inherits from `UALEJOAccessibleWidget`
2. Override the `Event On Voice Processing Result` function
3. Create a custom event for starting voice command mode

```text
// Blueprint event graph example pseudocode:

// In Event Construct
Set Enable Voice Shortcut = true
Add To Voice Activation Keys (Left Control)
Add To Voice Activation Keys (Space Bar)
Set Show Voice Activity Feedback = true
Set Voice Activity Icon Position (X=50, Y=50)

// In Event On Voice Processing Result
If (String Contains (Result, "pause") OR String Contains (Result, "stop"))
    Then Pause Game
Else If (String Contains (Result, "inventory") OR String Contains (Result, "items"))
    Then Open Inventory
Else If (String Contains (Result, "map"))
    Then Open Map
End If

// Custom Event: Start Voice Command
Get ALEJO Subsystem
Create Map (String, String) as Context
Add To Map (Context, "source", "gameplay")
Add To Map (Context, "interface", "main_ui")
Call Start Voice Streaming (Context)
Show Voice Activity Feedback (true)
Announce To Screen Reader ("Listening for voice command", true)
```

### 3. Voice Activity Feedback

Users need clear feedback when voice recognition is active:

```cpp
// Methods available in UALEJOAccessibleWidget:

// Show/hide voice activity icon
ShowVoiceActivityFeedback(bool bShow);

// Update voice activity visualization (confidence: 0.0 to 1.0)
UpdateVoiceActivityVisualization(float VoiceConfidence);

// Set voice activity icon position
SetVoiceActivityIconPosition(FVector2D Position);

// Set voice activity icon size
SetVoiceActivityIconSize(FVector2D Size);

// Set voice activity icon color
SetVoiceActivityIconColor(FLinearColor Color);
```

Use these methods to create clear visual feedback when voice input is being processed, which is especially important for users with hearing impairments who may not hear auditory cues.

### 4. Processing Context

Provide context to improve voice command recognition accuracy:

```cpp
// Creating context for voice processing
TMap<FString, FString> VoiceContext;

// Add general context
VoiceContext.Add(TEXT("source"), TEXT("gameplay"));
VoiceContext.Add(TEXT("interface"), TEXT("inventory_screen"));

// Add game-specific context
VoiceContext.Add(TEXT("player_level"), FString::FromInt(PlayerLevel));
VoiceContext.Add(TEXT("current_location"), CurrentLocationName);
VoiceContext.Add(TEXT("available_actions"), TEXT("equip,drop,use,examine"));

// Process voice command with context
ALEJOSubsystem->ProcessVoiceCommand(VoiceCommand, VoiceContext);
```

## Advanced Voice Integration Features

### 1. Voice Streaming Mode

For continuous voice input (rather than one-time commands):

```cpp
// Start continuous voice streaming
ALEJOSubsystem->StartVoiceStreaming(Context);

// Handle voice activity updates
void UMyWidget::OnVoiceActivity_Implementation(float Confidence, bool bIsFinal)
{
    // Update visual feedback based on confidence level
    UpdateVoiceActivityVisualization(Confidence);
    
    // Handle final voice segment
    if (bIsFinal)
    {
        // Process completed voice input
    }
}

// Stop voice streaming when done
ALEJOSubsystem->StopVoiceStreaming();
```

### 2. Command-to-Action Mapping System

Create a flexible system for mapping voice commands to game actions:

```cpp
// Define a voice command mapping class
UCLASS()
class UVoiceCommandMapping : public UObject
{
    GENERATED_BODY()
    
public:
    // Add a command with variants
    void AddCommand(const FString& CommandID, const TArray<FString>& CommandVariants, const FScriptDelegate& ActionDelegate);
    
    // Process voice result against known commands
    bool ProcessVoiceResult(const FString& VoiceResult);
    
private:
    // Map of command IDs to variants and delegates
    TMap<FString, TPair<TArray<FString>, FScriptDelegate>> CommandMap;
};

// Usage example
UVoiceCommandMapping* CommandMapping = NewObject<UVoiceCommandMapping>();

// Add inventory command with variants
TArray<FString> InventoryVariants = {TEXT("inventory"), TEXT("items"), TEXT("backpack"), TEXT("gear")};
FScriptDelegate OpenInventoryDelegate;
OpenInventoryDelegate.BindUFunction(this, FName("OpenInventory"));
CommandMapping->AddCommand(TEXT("open_inventory"), InventoryVariants, OpenInventoryDelegate);

// In voice result handler
void UMyWidget::OnVoiceProcessingResult_Implementation(const FString& Result)
{
    // Try to process the result with command mapping
    if (!CommandMapping->ProcessVoiceResult(Result))
    {
        // No matching command found, provide feedback
        AnnounceToScreenReader(TEXT("Command not recognized"));
    }
}
```

### 3. Integration with Game Systems

Connect voice commands to core game systems:

```cpp
// Character control example
void UVoiceControlComponent::ProcessMovementCommand(const FString& Command)
{
    ACharacter* Character = Cast<ACharacter>(GetOwner());
    if (!Character)
    {
        return;
    }
    
    if (Command.Contains(TEXT("forward")) || Command.Contains(TEXT("ahead")))
    {
        // Move character forward
        Character->AddMovementInput(Character->GetActorForwardVector(), 1.0f);
    }
    else if (Command.Contains(TEXT("back")) || Command.Contains(TEXT("backward")))
    {
        // Move character backward
        Character->AddMovementInput(Character->GetActorForwardVector(), -1.0f);
    }
    // Add other movement directions
}

// UI navigation example
void UVoiceNavigableMenu::ProcessNavigationCommand(const FString& Command)
{
    if (Command.Contains(TEXT("select")) || Command.Contains(TEXT("choose")))
    {
        // Activate focused widget
        if (UWidget* FocusedWidget = GetFocusedWidget())
        {
            if (UButton* Button = Cast<UButton>(FocusedWidget))
            {
                Button->OnClicked.Broadcast();
            }
        }
    }
    else if (Command.Contains(TEXT("next")) || Command.Contains(TEXT("down")))
    {
        // Focus next widget
        FocusNextWidget();
    }
    // Add other navigation commands
}
```

## Accessibility Considerations for Voice Integration

### 1. Multimodal Input Support

Always provide multiple ways to accomplish the same action:

```cpp
// In a UI widget class
void UAccessibleMenuWidget::NativeOnInitialized()
{
    Super::NativeOnInitialized();
    
    // Register button click handler
    if (ActionButton)
    {
        ActionButton->OnClicked.AddDynamic(this, &UAccessibleMenuWidget::OnActionButtonClicked);
    }
    
    // Register voice command for the same action
    TArray<FString> VoiceCommands = {TEXT("perform action"), TEXT("do action"), TEXT("activate")};
    RegisterVoiceCommand(TEXT("action_button"), VoiceCommands, FScriptDelegate::CreateUObject(this, &UAccessibleMenuWidget::OnActionButtonClicked));
    
    // Register keyboard shortcut
    KeyboardShortcut = FKey(EKeys::A);
    KeyboardModifier = FKey(EKeys::LeftControl);
}

// Handle the action from any input method
UFUNCTION()
void UAccessibleMenuWidget::OnActionButtonClicked()
{
    // Perform the action
    PerformAction();
    
    // Provide feedback appropriate for current accessibility settings
    if (GetAccessibilitySettings()->bScreenReaderEnabled)
    {
        AnnounceToScreenReader(TEXT("Action performed"));
    }
    else if (GetAccessibilitySettings()->bVisualFeedbackEnabled)
    {
        ShowVisualFeedback();
    }
    else
    {
        PlayActionSound();
    }
}
```

### 2. Voice Command Discoverability

Help users discover available voice commands:

```cpp
// Create a voice command help screen
void UVoiceCommandHelpWidget::NativeConstruct()
{
    Super::NativeConstruct();
    
    // Get all registered voice commands
    UALEJOSubsystem* ALEJOSubsystem = GetGameInstance()->GetSubsystem<UALEJOSubsystem>();
    TArray<FVoiceCommandInfo> VoiceCommands = ALEJOSubsystem->GetRegisteredVoiceCommands();
    
    // Create list items for each command
    for (const FVoiceCommandInfo& CommandInfo : VoiceCommands)
    {
        UVoiceCommandListItem* ListItem = CreateWidget<UVoiceCommandListItem>(this, VoiceCommandListItemClass);
        if (ListItem)
        {
            ListItem->SetCommandInfo(CommandInfo);
            VoiceCommandsList->AddChild(ListItem);
        }
    }
    
    // Announce available commands count to screen reader
    AnnounceToScreenReader(FString::Printf(TEXT("%d voice commands available"), VoiceCommands.Num()));
}
```

### 3. Speech Impairment Considerations

Adjust voice recognition settings for users with speech impairments:

```cpp
// In an accessibility settings class
void UALEJOSpeechAccessibilitySettings::ConfigureForSpeechImpairment(ESpeechImpairmentType ImpairmentType, float SeverityLevel)
{
    // Get ALEJO subsystem
    UALEJOSubsystem* ALEJOSubsystem = GetGameInstance()->GetSubsystem<UALEJOSubsystem>();
    
    // Create speech settings
    TMap<FString, FString> SpeechSettings;
    
    // Configure based on impairment type
    switch (ImpairmentType)
    {
    case ESpeechImpairmentType::Stuttering:
        SpeechSettings.Add(TEXT("recognition_mode"), TEXT("extended_timeout"));
        SpeechSettings.Add(TEXT("timeout_factor"), FString::SanitizeFloat(1.0f + SeverityLevel));
        break;
        
    case ESpeechImpairmentType::Dysarthria:
        SpeechSettings.Add(TEXT("recognition_mode"), TEXT("adaptive"));
        SpeechSettings.Add(TEXT("confidence_threshold"), FString::SanitizeFloat(0.4f - (0.2f * SeverityLevel)));
        break;
    
    // Add more speech impairment types
    }
    
    // Update settings
    ALEJOSubsystem->SendCustomEvent(TEXT("speech.accessibility.update"), FJsonObjectConverter::UStructToJsonObjectString(SpeechSettings));
}
```

## Voice Command Testing

### 1. Manual Testing

Test voice commands in different environments and scenarios:

- Quiet environments vs. noisy backgrounds
- Different microphone distances
- Various user accents and speech patterns
- With and without speech impairments
- Different voice activation methods (shortcut vs. button)

### 2. Automated Voice Command Testing

Set up automated tests for voice command recognition:

```cpp
// In an automation test class
IMPLEMENT_SIMPLE_AUTOMATION_TEST(FALEJOVoiceCommandTest, "ALEJO.VoiceCommands", EAutomationTestFlags::EditorContext | EAutomationTestFlags::ProductFilter)

bool FALEJOVoiceCommandTest::RunTest(const FString& Parameters)
{
    // Create test game instance
    UWorld* World = UEditorUtilities::CreateGameWorld(TEXT("ALEJOVoiceTest"), false);
    UGameInstance* GameInstance = World->GetGameInstance();
    
    // Get ALEJO subsystem
    UALEJOSubsystem* ALEJOSubsystem = GameInstance->GetSubsystem<UALEJOSubsystem>();
    
    // Set up test event handler
    FVoiceResultHandler ResultHandler;
    ResultHandler.BindLambda([this](const FString& Result, bool bSuccess)
    {
        // Check if result contains expected command interpretation
        if (Result.Contains(TEXT("open inventory")))
        {
            TestTrue(TEXT("Voice command correctly recognized"), true);
        }
        else
        {
            TestTrue(TEXT("Voice command incorrectly recognized"), false);
            TestFalse(TEXT("Expected 'open inventory', got: ") + Result, true);
        }
    });
    
    // Register test result handler
    ALEJOSubsystem->OnVoiceProcessingResult.AddLambda([&ResultHandler](const FString& Result)
    {
        ResultHandler.Execute(Result, true);
    });
    
    // Simulate voice command with test audio file
    FString TestAudioPath = FPaths::Combine(FPaths::AutomationDir(), TEXT("VoiceTests"), TEXT("OpenInventory.wav"));
    ALEJOSubsystem->SendCustomEvent(TEXT("test.voice.simulate"), FString::Printf(TEXT("{\"audioPath\":\"%s\"}"), *TestAudioPath));
    
    // Wait for processing
    ADD_LATENT_AUTOMATION_COMMAND(FWaitLatentCommand(1.0f));
    
    return true;
}
```

## Troubleshooting Voice Integration

### Common Issues and Solutions

1. **Voice commands not recognized**
   - Check microphone connection and permissions
   - Verify WebSocket connection to bridge server
   - Ensure voice recognition models are loaded

2. **Voice recognition quality issues**
   - Adjust microphone position
   - Reduce background noise
   - Try different voice activation methods
   - Check if speech impairment accommodations are needed

3. **Voice activity feedback not showing**
   - Verify `bShowVoiceActivityFeedback` is set to true
   - Check if voice activity icon is positioned within visible area
   - Ensure WebSocket connection is established

4. **Performance issues during voice processing**
   - Monitor resource usage during voice recognition
   - Consider adjusting resource mode to match device capabilities
   - Implement fallback to simpler recognition models on low-end devices

### Debugging Voice Issues

```cpp
// Enable detailed voice logging
ALEJOSubsystem->SendCustomEvent(TEXT("log.level.set"), TEXT("{\"module\":\"voice\",\"level\":\"debug\"}"));

// Retrieve voice processing diagnostics
ALEJOSubsystem->SendCustomEvent(TEXT("voice.diagnostics.get"), TEXT("{}"));

// Register diagnostic handler
ALEJOSubsystem->OnCustomEvent.AddLambda([](const FString& EventName, const FString& EventData)
{
    if (EventName == TEXT("voice.diagnostics.result"))
    {
        // Log diagnostic information
        UE_LOG(LogALEJO, Log, TEXT("Voice Diagnostics: %s"), *EventData);
    }
});
```

## Advanced Customization

### 1. Custom Voice Processing Models

```cpp
// Load a custom voice recognition model
void UMyGameInstance::LoadCustomVoiceModel(const FString& ModelPath)
{
    UALEJOSubsystem* ALEJOSubsystem = GetSubsystem<UALEJOSubsystem>();
    if (!ALEJOSubsystem)
    {
        return;
    }
    
    // Prepare model loading parameters
    TMap<FString, FString> ModelParams;
    ModelParams.Add(TEXT("modelPath"), ModelPath);
    ModelParams.Add(TEXT("modelType"), TEXT("voice_recognition"));
    
    // Convert to JSON
    FString ParamsJson = FJsonObjectConverter::UStructToJsonObjectString(ModelParams);
    
    // Send custom event to load model
    ALEJOSubsystem->SendCustomEvent(TEXT("model.load"), ParamsJson);
    
    // Register for model loading result
    ALEJOSubsystem->OnCustomEvent.AddUObject(this, &UMyGameInstance::OnModelLoadingResult);
}

// Handle model loading result
void UMyGameInstance::OnModelLoadingResult(const FString& EventName, const FString& EventData)
{
    if (EventName == TEXT("model.load.result"))
    {
        // Parse result JSON
        TSharedPtr<FJsonObject> JsonObject;
        TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(EventData);
        if (FJsonSerializer::Deserialize(Reader, JsonObject))
        {
            bool bSuccess = JsonObject->GetBoolField(TEXT("success"));
            if (bSuccess)
            {
                UE_LOG(LogALEJO, Log, TEXT("Custom voice model loaded successfully"));
            }
            else
            {
                FString ErrorMessage = JsonObject->GetStringField(TEXT("error"));
                UE_LOG(LogALEJO, Error, TEXT("Failed to load custom voice model: %s"), *ErrorMessage);
            }
        }
    }
}
```

### 2. Domain-Specific Commands

Add game-specific vocabulary to improve recognition accuracy:

```cpp
// Register game-specific vocabulary
void UMyGameInstance::RegisterGameVocabulary()
{
    UALEJOSubsystem* ALEJOSubsystem = GetSubsystem<UALEJOSubsystem>();
    if (!ALEJOSubsystem)
    {
        return;
    }
    
    // Create vocabulary entries
    TArray<FVocabularyEntry> VocabularyEntries;
    
    // Add character names
    VocabularyEntries.Add(FVocabularyEntry(TEXT("Azatoth"), TEXT("AZ-ah-thoth")));
    VocabularyEntries.Add(FVocabularyEntry(TEXT("Nyarlathotep"), TEXT("nee-AR-la-tho-tep")));
    
    // Add location names
    VocabularyEntries.Add(FVocabularyEntry(TEXT("R'lyeh"), TEXT("ruh-LIE-eh")));
    VocabularyEntries.Add(FVocabularyEntry(TEXT("Yuggoth"), TEXT("YUG-goth")));
    
    // Add item names
    VocabularyEntries.Add(FVocabularyEntry(TEXT("Necronomicon"), TEXT("neck-ro-NOM-i-con")));
    
    // Convert to JSON
    FString VocabJson = FJsonObjectConverter::UStructToJsonObjectString(VocabularyEntries);
    
    // Register vocabulary
    ALEJOSubsystem->SendCustomEvent(TEXT("voice.vocabulary.register"), VocabJson);
}
```

## Security and Privacy

ALEJO's voice integration prioritizes user privacy through several mechanisms:

1. **Local Processing**: All voice processing happens on the user's device
2. **No External Dependencies**: No cloud services or API keys required
3. **Data Protection**: Voice data is not stored persistently
4. **User Control**: Clear feedback when voice recording is active
5. **Consent Management**: Users can disable voice features entirely

## Conclusion

ALEJO's voice integration for Unreal Engine provides a powerful, accessible, and privacy-preserving way to add voice commands to your game. By following this guide, you can create voice interactions that work for all users while maintaining ALEJO's commitment to local processing and user privacy.

## Additional Resources

- [ALEJO Main Documentation](../README.md)
- [ALEJO Accessibility Guide](./accessibility-guide.md)
- [Unreal Engine Input Documentation](https://docs.unrealengine.com/5.0/en-US/input-in-unreal-engine/)
- [Web Speech API Reference](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
