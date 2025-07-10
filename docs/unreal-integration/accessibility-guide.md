# ALEJO Unreal Engine Accessibility Implementation Guide

This guide provides detailed instructions for implementing accessibility features in your Unreal Engine project using the ALEJO integration.

## Core Accessibility Principles

ALEJO follows these accessibility principles:
- **Perceivable**: Information must be presentable to all users
- **Operable**: Interface elements must be navigable by all users
- **Understandable**: Information and operation must be comprehensible
- **Robust**: Content must be compatible with assistive technologies

## Implementing UALEJOAccessibleWidget

The `UALEJOAccessibleWidget` class is the foundation for accessible UMG widgets:

### Setup in Blueprint

1. Create a new Blueprint Widget that inherits from `UALEJOAccessibleWidget`
2. Override the key event functions:

```
- NativeConstruct()
- NativeDestruct() 
- OnConnectionStatusChanged(bool bIsConnected)
- OnTextProcessingResult(const FString& Result)
- OnVoiceProcessingResult(const FString& Result)
- OnResourceModeChanged(const FString& ResourceMode)
- OnAccessibilitySettingsUpdated(const UALEJOAccessibilitySettings* Settings)
```

### Implementing Voice Command Support

```cpp
// In your ALEJOAccessibleWidget subclass:
void UMyAccessibleWidget::NativeConstruct()
{
    Super::NativeConstruct();
    
    // Enable voice command support with Ctrl+Space shortcut
    bEnableVoiceShortcut = true;
    VoiceActivationKeys.Add(EKeys::LeftControl);
    VoiceActivationKeys.Add(EKeys::SpaceBar);
    
    // Show visual feedback when voice is active
    bShowVoiceActivityFeedback = true;
}

// Override voice result handling
void UMyAccessibleWidget::OnVoiceProcessingResult_Implementation(const FString& Result)
{
    // Process voice command
    if (Result.Contains(TEXT("button")))
    {
        if (MyButton)
        {
            // Focus and announce the button
            FocusWidget(MyButton);
            AnnounceToScreenReader(TEXT("Button focused"));
        }
    }
}
```

## Using UALEJOUIHelper for Accessibility

The `UALEJOUIHelper` provides essential functions for accessibility:

### Screen Reader Support

```cpp
// Create UI Helper instance
UALEJOUIHelper* UIHelper = NewObject<UALEJOUIHelper>();

// Announce text to screen reader
UIHelper->AnnounceToScreenReader(TEXT("Welcome to the game"), true);

// Get text for different screen readers
FString NVDAText = UIHelper->GetScreenReaderSpecificText(TEXT("Base message"), TEXT("NVDA"));
```

### High Contrast Mode

```cpp
// Apply high contrast mode to a widget hierarchy
UIHelper->ApplyHighContrastMode(RootWidget, true);

// Get accessible color pairs that meet contrast requirements
FLinearColor BackgroundColor, ForegroundColor;
UIHelper->GetAccessibleColorPair(BackgroundColor, ForegroundColor, true);

// Calculate contrast ratio between colors
float ContrastRatio = UIHelper->CalculateContrastRatio(Color1, Color2);
bool bIsAccessible = ContrastRatio >= 4.5f; // WCAG AA standard
```

### Font Scaling

```cpp
// Apply font scaling to a widget hierarchy
UIHelper->ApplyFontScaling(RootWidget, 1.5f);

// Exclude specific elements from scaling
UIHelper->SetExcludeFromFontScaling(IconWidget, true);
```

### Color Blindness Accommodations

```cpp
// Apply color blind friendly palette
TArray<FLinearColor> ColorBlindPalette;
UIHelper->GetColorBlindFriendlyPalette(ColorBlindPalette, EALEJOColorBlindType::Deuteranopia);

// Convert a color to be color blind friendly
FLinearColor OriginalColor = FLinearColor::Red;
FLinearColor AdaptedColor = UIHelper->GetColorBlindFriendlyColor(
    OriginalColor, 
    EALEJOColorBlindType::Deuteranopia
);
```

### Reduced Motion Support

```cpp
// Apply reduced motion settings
UIHelper->ApplyReducedMotionSettings(AnimatedWidget, true);

// Check if reduced motion is enabled
if (UIHelper->IsReducedMotionEnabled())
{
    // Use simpler transitions
    SimpleFadeTransition();
}
else
{
    // Use full animation
    ComplexAnimatedTransition();
}
```

### Keyboard Navigation

```cpp
// Get keyboard shortcut text
FString ShortcutText = UIHelper->GetKeyboardShortcutText(
    TArray<FKey>{EKeys::Control, EKeys::S}, 
    TEXT("Save game")
);

// Enhance tab navigation
UIHelper->EnhanceKeyboardNavigation(FormWidget);

// Set tab order
UIHelper->SetWidgetTabOrder(TArray<UWidget*>{FirstWidget, SecondWidget, ThirdWidget});
```

## Accessibility Settings Management

### Creating and Updating Settings

```cpp
// Get the ALEJOSubsystem
UALEJOSubsystem* ALEJOSubsystem = GetGameInstance()->GetSubsystem<UALEJOSubsystem>();

// Create accessibility settings
UALEJOAccessibilitySettings* Settings = ALEJOSubsystem->CreateAccessibilitySettings();

// Configure settings
Settings->bScreenReaderEnabled = true;
Settings->bHighContrastMode = true;
Settings->FontScaleFactor = 1.5f;
Settings->ColorBlindType = EALEJOColorBlindType::Protanopia;
Settings->bReducedMotion = true;
Settings->bKeyboardNavigationEnabled = true;
Settings->bSimplifiedLanguage = true;
Settings->bVisualAudioCues = true;

// Update subsystem settings
ALEJOSubsystem->UpdateAccessibilitySettings(Settings);

// Listen for settings changes
ALEJOSubsystem->OnAccessibilitySettingsUpdated.AddDynamic(
    this, 
    &UMyClass::HandleAccessibilitySettingsUpdated
);
```

### Creating an Accessibility Settings Menu

```cpp
// In your settings widget
void UAccessibilitySettingsWidget::NativeConstruct()
{
    Super::NativeConstruct();
    
    // Get current settings
    UALEJOSubsystem* ALEJOSubsystem = GetGameInstance()->GetSubsystem<UALEJOSubsystem>();
    UALEJOAccessibilitySettings* CurrentSettings = ALEJOSubsystem->GetAccessibilitySettings();
    
    // Populate UI controls
    ScreenReaderCheckBox->SetIsChecked(CurrentSettings->bScreenReaderEnabled);
    HighContrastCheckBox->SetIsChecked(CurrentSettings->bHighContrastMode);
    FontScaleSlider->SetValue(CurrentSettings->FontScaleFactor);
    
    // Bind UI events
    ScreenReaderCheckBox->OnCheckStateChanged.AddDynamic(this, &UAccessibilitySettingsWidget::OnSettingChanged);
    HighContrastCheckBox->OnCheckStateChanged.AddDynamic(this, &UAccessibilitySettingsWidget::OnSettingChanged);
    FontScaleSlider->OnValueChanged.AddDynamic(this, &UAccessibilitySettingsWidget::OnSettingChanged);
}

void UAccessibilitySettingsWidget::OnSettingChanged()
{
    // Get subsystem
    UALEJOSubsystem* ALEJOSubsystem = GetGameInstance()->GetSubsystem<UALEJOSubsystem>();
    
    // Create new settings
    UALEJOAccessibilitySettings* NewSettings = ALEJOSubsystem->CreateAccessibilitySettings();
    
    // Update from UI
    NewSettings->bScreenReaderEnabled = ScreenReaderCheckBox->IsChecked();
    NewSettings->bHighContrastMode = HighContrastCheckBox->IsChecked();
    NewSettings->FontScaleFactor = FontScaleSlider->GetValue();
    
    // Apply settings
    ALEJOSubsystem->UpdateAccessibilitySettings(NewSettings);
    
    // Announce change
    AnnounceToScreenReader(TEXT("Settings updated"), true);
}
```

## Best Practices for Accessible UMG Widgets

### General Guidelines

- Use semantic widget types (buttons for actions, checkboxes for toggles, etc.)
- Ensure all interactive elements are keyboard navigable
- Provide screen reader announcements for state changes
- Use sufficient color contrast (minimum 4.5:1 for normal text, 3:1 for large text)
- Don't rely solely on color to convey information
- Support font scaling without breaking layouts
- Create reduced motion alternatives for animations

### Button Implementation

```cpp
// In a button widget blueprint:
void UAccessibleButton::NativeConstruct()
{
    Super::NativeConstruct();
    
    // Set accessible properties
    SetAccessibleText(ButtonText->GetText().ToString());
    SetAccessibleDescription(TEXT("Opens the inventory menu"));
    
    // Add sound feedback
    ClickSound = LoadObject<USoundBase>(nullptr, TEXT("/Game/Sounds/UI/ButtonClick"));
}

void UAccessibleButton::OnButtonClicked()
{
    // Announce action
    AnnounceToScreenReader(TEXT("Opening inventory menu"));
    
    // Play sound feedback
    if (ClickSound && !GetAccessibilitySettings()->bScreenReaderEnabled)
    {
        UGameplayStatics::PlaySound2D(this, ClickSound);
    }
    
    // Execute action
    OpenInventoryMenu();
}
```

### Dialog Implementation

```cpp
// In a dialog widget blueprint:
void UAccessibleDialog::NativeConstruct()
{
    Super::NativeConstruct();
    
    // Announce dialog opening
    AnnounceToScreenReader(TEXT("Dialog opened: ") + DialogTitle->GetText().ToString());
    
    // Focus the first interactive element
    FocusWidget(FirstButton);
    
    // Set accessible properties
    SetAccessibleText(DialogTitle->GetText().ToString());
    SetAccessibleDescription(DialogContent->GetText().ToString());
    
    // Set tab order
    UALEJOUIHelper* UIHelper = NewObject<UALEJOUIHelper>();
    UIHelper->SetWidgetTabOrder(TArray<UWidget*>{FirstButton, SecondButton, CloseButton});
}
```

## Testing Accessibility Features

### Keyboard-Only Navigation Test

1. Disconnect your mouse
2. Navigate through your UI using Tab, Shift+Tab, Arrow keys, Space, and Enter
3. Ensure all interactive elements can be focused and activated
4. Verify that focus indicators are visible and clear

### Screen Reader Testing

1. Enable a screen reader (NVDA on Windows, VoiceOver on Mac)
2. Navigate through your UI
3. Verify that all text content is read correctly
4. Check that state changes are announced
5. Ensure custom actions are properly labeled

### Color Contrast Testing

1. Use the `CalculateContrastRatio` function to verify text contrast meets WCAG standards
2. Test with `bHighContrastMode` enabled
3. Use the color blind simulation options to check for issues

### Font Scaling Test

1. Set `FontScaleFactor` to various values (1.0, 1.5, 2.0)
2. Verify that text remains readable and doesn't overflow containers
3. Check that layouts adjust appropriately

## Common Pitfalls and Solutions

### Problem: Screen reader doesn't announce dynamic content
**Solution**: Use `AnnounceToScreenReader` for all dynamic updates

### Problem: Keyboard focus gets trapped in a widget
**Solution**: Implement proper focus management with `SetUserFocus` and `FocusWidget`

### Problem: Font scaling breaks layouts
**Solution**: Use auto-sizing containers and min/max constraints instead of fixed sizes

### Problem: Animations cause discomfort for some users
**Solution**: Implement `ApplyReducedMotionSettings` and provide static alternatives

### Problem: Color scheme isn't accessible for color blind users
**Solution**: Use `GetColorBlindFriendlyPalette` and don't rely solely on color for information

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/TR/WCAG21/)
- [Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/)
- [Unreal Engine Accessibility Documentation](https://docs.unrealengine.com/5.0/en-US/accessibility-in-unreal-engine/)

## Next Steps

After implementing basic accessibility features, consider these advanced enhancements:

1. **Customizable Controls**: Allow players to rebind controls and adjust sensitivity
2. **Difficulty Options**: Provide multiple difficulty levels and gameplay assistance
3. **Time Controls**: Add options to adjust game speed or pause automatically
4. **Text-to-Speech for All Text**: Not just UI but also in-game documents and dialogue
5. **Advanced Haptic Feedback**: For critical game events and directional cues
