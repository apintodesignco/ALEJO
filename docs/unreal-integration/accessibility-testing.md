# ALEJO Unreal Engine Accessibility Testing Guide

This guide outlines procedures for testing the accessibility features implemented in the ALEJO Unreal Engine integration.

## 1. Screen Reader Integration Tests

### 1.1 Announcement Testing

Test `UALEJOUIHelper::AnnounceToScreenReader` functionality:

```cpp
// Example test code
IMPLEMENT_SIMPLE_AUTOMATION_TEST(FALEJOScreenReaderTest, "ALEJO.Accessibility.ScreenReader", 
  EAutomationTestFlags::EditorContext | EAutomationTestFlags::ProductFilter)

bool FALEJOScreenReaderTest::RunTest(const FString& Parameters)
{
  // Create test game instance
  UWorld* World = UEditorUtilities::CreateGameWorld(TEXT("ALEJOAccessibilityTest"), false);
  UGameInstance* GameInstance = World->GetGameInstance();
  
  // Get ALEJO subsystem
  UALEJOSubsystem* ALEJOSubsystem = GameInstance->GetSubsystem<UALEJOSubsystem>();
  TestNotNull("ALEJOSubsystem should exist", ALEJOSubsystem);
  
  // Get UI Helper
  UALEJOUIHelper* UIHelper = UALEJOUIHelper::GetInstance(World);
  TestNotNull("UIHelper should exist", UIHelper);
  
  // Test announcement
  bool bAnnouncementSent = false;
  
  // Register for screen reader event
  ALEJOSubsystem->OnScreenReaderAnnouncementSent.AddLambda([&bAnnouncementSent](const FString& Text, bool Interrupt) {
    bAnnouncementSent = true;
  });
  
  // Send announcement
  UIHelper->AnnounceToScreenReader(TEXT("Test announcement"), true);
  
  // Wait for async completion
  ADD_LATENT_AUTOMATION_COMMAND(FWaitLatentCommand(0.5f));
  
  // Verify announcement was sent
  TestTrue("Screen reader announcement should be triggered", bAnnouncementSent);
  
  return true;
}
```

### 1.2 Manual Screen Reader Testing

1. Enable your system's screen reader (NVDA, JAWS, VoiceOver, etc.)
2. Launch your Unreal application with ALEJO integration
3. Navigate through UI elements and verify announcements
4. Test dynamic content updates and verify they're announced

**Testing checklist:**
- [ ] Static text is properly announced
- [ ] Buttons and interactive elements announce their purpose
- [ ] State changes (enabled/disabled, expanded/collapsed) are announced
- [ ] Important events are announced without interrupting critical actions
- [ ] Focus management properly moves between elements

## 2. High Contrast Mode Tests

### 2.1 Automated Color Contrast Testing

Test `UALEJOUIHelper::CalculateContrastRatio` and `UALEJOUIHelper::ApplyHighContrastMode`:

```cpp
IMPLEMENT_SIMPLE_AUTOMATION_TEST(FALEJOContrastTest, "ALEJO.Accessibility.ColorContrast", 
  EAutomationTestFlags::EditorContext | EAutomationTestFlags::ProductFilter)

bool FALEJOContrastTest::RunTest(const FString& Parameters)
{
  // Get UI Helper
  UALEJOUIHelper* UIHelper = UALEJOUIHelper::GetInstance();
  TestNotNull("UIHelper should exist", UIHelper);
  
  // Test color contrast calculation
  FLinearColor Black = FLinearColor(0, 0, 0, 1);
  FLinearColor White = FLinearColor(1, 1, 1, 1);
  
  float ContrastRatio = UIHelper->CalculateContrastRatio(Black, White);
  TestTrue("Black/white contrast should meet WCAG AAA standards", ContrastRatio >= 7.0f);
  
  // Test accessible color pair
  FLinearColor Background = FLinearColor(0.2f, 0.3f, 0.8f, 1.0f);
  FLinearColor AccessibleText = UIHelper->GetAccessibleTextColor(Background);
  
  ContrastRatio = UIHelper->CalculateContrastRatio(Background, AccessibleText);
  TestTrue("Accessible text should have sufficient contrast", ContrastRatio >= 4.5f);
  
  return true;
}
```

### 2.2 Manual High Contrast Testing

1. Enable high contrast mode via the accessibility settings
2. Verify all UI elements maintain clear visibility and readability
3. Test different color combinations

**Testing checklist:**
- [ ] Text has at least 4.5:1 contrast ratio against background
- [ ] Interactive elements are clearly distinguishable
- [ ] Focus indicators are visible
- [ ] Icons and graphics remain recognizable
- [ ] State changes are clearly visible

## 3. Font Scaling Tests

### 3.1 Automated Font Scaling Testing

Test `UALEJOUIHelper::ApplyFontScaling`:

```cpp
IMPLEMENT_SIMPLE_AUTOMATION_TEST(FALEJOFontScalingTest, "ALEJO.Accessibility.FontScaling", 
  EAutomationTestFlags::EditorContext | EAutomationTestFlags::ProductFilter)

bool FALEJOFontScalingTest::RunTest(const FString& Parameters)
{
  // Create test widget
  UWorld* World = UEditorUtilities::CreateGameWorld(TEXT("ALEJOAccessibilityTest"), false);
  UALEJOAccessibleWidget* TestWidget = CreateWidget<UALEJOAccessibleWidget>(World);
  
  // Get UI Helper
  UALEJOUIHelper* UIHelper = UALEJOUIHelper::GetInstance(World);
  
  // Create test text block
  UTextBlock* TextBlock = NewObject<UTextBlock>(TestWidget);
  TextBlock->SetFont(FSlateFontInfo(FPaths::EngineContentDir() / TEXT("Slate/Fonts/Roboto-Regular.ttf"), 12));
  
  // Apply font scaling
  float ScaleFactor = 1.5f;
  UIHelper->ApplyFontScaling(TextBlock, ScaleFactor);
  
  // Check font size
  float NewSize = TextBlock->Font.Size;
  TestEqual("Font size should be scaled", NewSize, 12 * ScaleFactor);
  
  return true;
}
```

### 3.2 Manual Font Scaling Testing

1. Enable font scaling via accessibility settings
2. Test multiple scaling factors (1.0, 1.25, 1.5, 2.0)
3. Navigate through all UI screens

**Testing checklist:**
- [ ] Text remains readable at all scaling levels
- [ ] Layout adapts to larger text without clipping
- [ ] Interactive elements scale appropriately
- [ ] No text overflows its container
- [ ] Line spacing adjusts with font size

## 4. Color Blindness Accommodation Tests

### 4.1 Automated Color Blindness Testing

Test `UALEJOUIHelper::ApplyColorBlindCorrection`:

```cpp
IMPLEMENT_SIMPLE_AUTOMATION_TEST(FALEJOColorBlindTest, "ALEJO.Accessibility.ColorBlindness", 
  EAutomationTestFlags::EditorContext | EAutomationTestFlags::ProductFilter)

bool FALEJOColorBlindTest::RunTest(const FString& Parameters)
{
  // Get UI Helper
  UALEJOUIHelper* UIHelper = UALEJOUIHelper::GetInstance();
  
  // Test color transformations
  FLinearColor TestColor = FLinearColor(0.8f, 0.2f, 0.2f, 1.0f); // Red color
  
  // Test deuteranopia correction
  FLinearColor DeuteranopiaColor = UIHelper->ApplyColorBlindCorrection(
    TestColor, 
    EALEJOColorBlindType::Deuteranopia
  );
  
  // Verify color has been adjusted
  TestNotEqual("Color should be adjusted for deuteranopia", TestColor, DeuteranopiaColor);
  
  // Test protanopia correction
  FLinearColor ProtanopiaColor = UIHelper->ApplyColorBlindCorrection(
    TestColor, 
    EALEJOColorBlindType::Protanopia
  );
  
  // Verify color has been adjusted
  TestNotEqual("Color should be adjusted for protanopia", TestColor, ProtanopiaColor);
  
  return true;
}
```

### 4.2 Manual Color Blindness Testing

1. Enable each color blindness mode in accessibility settings:
   - Deuteranopia (red-green)
   - Protanopia (red-green)
   - Tritanopia (blue-yellow)
2. Check all UI elements and game visuals

**Testing checklist:**
- [ ] Information conveyed by color is also available through text or iconography
- [ ] Interactive elements remain distinguishable
- [ ] Status indicators remain clear
- [ ] Critical gameplay elements are visible in all modes
- [ ] Color palettes adjust appropriately for each color blindness type

## 5. Keyboard Navigation Tests

### 5.1 Automated Keyboard Navigation Testing

Test keyboard shortcuts and navigation events:

```cpp
IMPLEMENT_SIMPLE_AUTOMATION_TEST(FALEJOKeyboardTest, "ALEJO.Accessibility.KeyboardNavigation", 
  EAutomationTestFlags::EditorContext | EAutomationTestFlags::ProductFilter)

bool FALEJOKeyboardTest::RunTest(const FString& Parameters)
{
  // Create test widget
  UWorld* World = UEditorUtilities::CreateGameWorld(TEXT("ALEJOAccessibilityTest"), false);
  UALEJOAccessibleWidget* TestWidget = CreateWidget<UALEJOAccessibleWidget>(World);
  
  // Test keyboard focus
  bool bFocusHandled = false;
  
  TestWidget->OnKeyboardFocusReceived.AddLambda([&bFocusHandled]() {
    bFocusHandled = true;
  });
  
  // Simulate focus event
  FKeyboardFocusEvent FocusEvent;
  TestWidget->NativeOnFocusReceived(FocusEvent);
  
  // Verify focus event was handled
  TestTrue("Keyboard focus event should be handled", bFocusHandled);
  
  // Test keyboard shortcuts
  bool bShortcutHandled = false;
  
  TestWidget->RegisterVoiceShortcut(EKeys::V, true, false, false);
  
  // Mock keyboard event
  FKeyEvent KeyEvent(EKeys::V, FModifierKeysState(false, false, true, false), 0, false, 0, 0);
  
  // Process shortcut
  TestWidget->NativeOnKeyDown(KeyEvent);
  
  // Additional tests would verify shortcut was processed
  // This requires more complex test setup with event propagation
  
  return true;
}
```

### 5.2 Manual Keyboard Navigation Testing

1. Disable mouse input
2. Navigate entire UI using only Tab, arrow keys, Enter, and Esc
3. Test all voice shortcuts

**Testing checklist:**
- [ ] All interactive elements can be reached via keyboard
- [ ] Focus indicator is clearly visible
- [ ] Tab order is logical and follows visual layout
- [ ] Keyboard shortcuts work consistently
- [ ] No keyboard traps (focus can't move away from an element)
- [ ] Voice command shortcuts activate properly

## 6. Reduced Motion Tests

### 6.1 Automated Reduced Motion Testing

Test `UALEJOUIHelper::ApplyReducedMotion`:

```cpp
IMPLEMENT_SIMPLE_AUTOMATION_TEST(FALEJOReducedMotionTest, "ALEJO.Accessibility.ReducedMotion", 
  EAutomationTestFlags::EditorContext | EAutomationTestFlags::ProductFilter)

bool FALEJOReducedMotionTest::RunTest(const FString& Parameters)
{
  // Get UI Helper
  UALEJOUIHelper* UIHelper = UALEJOUIHelper::GetInstance();
  
  // Create test animation
  UWorld* World = UEditorUtilities::CreateGameWorld(TEXT("ALEJOAccessibilityTest"), false);
  UALEJOAccessibleWidget* TestWidget = CreateWidget<UALEJOAccessibleWidget>(World);
  
  // Create a dummy animation
  UWidgetAnimation* TestAnimation = NewObject<UWidgetAnimation>(TestWidget);
  TestAnimation->SetPlaybackSpeed(1.0f);
  
  // Apply reduced motion
  bool bReducedMotionApplied = UIHelper->ApplyReducedMotion(TestAnimation, true);
  
  // Verify animation was modified
  TestTrue("Reduced motion should be applied", bReducedMotionApplied);
  TestLessThan("Animation playback speed should be reduced", 
               TestAnimation->GetPlaybackSpeed(), 1.0f);
  
  return true;
}
```

### 6.2 Manual Reduced Motion Testing

1. Enable reduced motion setting in accessibility options
2. Navigate through UI and game screens with animations

**Testing checklist:**
- [ ] UI animations are slowed or disabled
- [ ] No flashing or rapid visual changes
- [ ] Transitions are smooth and gradual
- [ ] Auto-scrolling content can be paused
- [ ] Motion-heavy effects have alternatives

## 7. Voice Command Accessibility Tests

### 7.1 Automated Voice Command Testing

Test voice command integration:

```cpp
IMPLEMENT_SIMPLE_AUTOMATION_TEST(FALEJOVoiceAccessibilityTest, "ALEJO.Accessibility.VoiceCommands", 
  EAutomationTestFlags::EditorContext | EAutomationTestFlags::ProductFilter)

bool FALEJOVoiceAccessibilityTest::RunTest(const FString& Parameters)
{
  // Create test environment
  UWorld* World = UEditorUtilities::CreateGameWorld(TEXT("ALEJOAccessibilityTest"), false);
  UGameInstance* GameInstance = World->GetGameInstance();
  
  // Get ALEJO subsystem
  UALEJOSubsystem* ALEJOSubsystem = GameInstance->GetSubsystem<UALEJOSubsystem>();
  UALEJOAccessibleWidget* TestWidget = CreateWidget<UALEJOAccessibleWidget>(World);
  
  // Setup test tracking
  bool bVoiceCommandReceived = false;
  
  // Register for voice command results
  TestWidget->OnVoiceProcessingResult.AddLambda(
    [&bVoiceCommandReceived](const FALEJOVoiceResult& Result) {
      bVoiceCommandReceived = true;
    }
  );
  
  // Register widget with ALEJO subsystem
  TestWidget->NativeConstruct();
  
  // Simulate voice command result
  FALEJOVoiceResult TestResult;
  TestResult.Result = TEXT("Test voice command");
  TestResult.Confidence = 0.95f;
  ALEJOSubsystem->BroadcastVoiceResult(TestResult);
  
  // Verify voice command was received
  TestTrue("Voice command should be received by widget", bVoiceCommandReceived);
  
  return true;
}
```

### 7.2 Manual Voice Command Testing

1. Enable voice commands in the application
2. Test common voice commands for UI navigation and control
3. Test with different voice patterns (speaking speed, pitch, accent)

**Testing checklist:**
- [ ] Voice commands are recognized accurately
- [ ] Visual feedback indicates voice processing status
- [ ] Commands work consistently across different users
- [ ] Alternative methods exist for all voice functions
- [ ] Voice command help/documentation is available
- [ ] Keyboard shortcuts can trigger voice mode

## 8. Accessibility Settings Persistence Tests

### 8.1 Automated Settings Persistence Testing

Test settings serialization and persistence:

```cpp
IMPLEMENT_SIMPLE_AUTOMATION_TEST(FALEJOSettingsPersistenceTest, "ALEJO.Accessibility.SettingsPersistence", 
  EAutomationTestFlags::EditorContext | EAutomationTestFlags::ProductFilter)

bool FALEJOSettingsPersistenceTest::RunTest(const FString& Parameters)
{
  // Create test game instance
  UWorld* World = UEditorUtilities::CreateGameWorld(TEXT("ALEJOAccessibilityTest"), false);
  UGameInstance* GameInstance = World->GetGameInstance();
  
  // Get ALEJO subsystem
  UALEJOSubsystem* ALEJOSubsystem = GameInstance->GetSubsystem<UALEJOSubsystem>();
  
  // Get current settings
  UALEJOAccessibilitySettings* Settings = ALEJOSubsystem->GetAccessibilitySettings();
  
  // Modify settings
  Settings->bScreenReaderEnabled = true;
  Settings->bHighContrastMode = true;
  Settings->FontScaleFactor = 1.5f;
  Settings->ColorBlindType = EALEJOColorBlindType::Deuteranopia;
  Settings->bReducedMotion = true;
  
  // Save settings
  bool bSaveSuccess = ALEJOSubsystem->SaveAccessibilitySettings();
  TestTrue("Settings should save successfully", bSaveSuccess);
  
  // Create new subsystem instance to test loading
  UALEJOSubsystem* NewSubsystem = NewObject<UALEJOSubsystem>();
  NewSubsystem->Initialize(FSubsystemCollectionBase());
  
  // Load settings
  bool bLoadSuccess = NewSubsystem->LoadAccessibilitySettings();
  TestTrue("Settings should load successfully", bLoadSuccess);
  
  // Verify settings were preserved
  UALEJOAccessibilitySettings* LoadedSettings = NewSubsystem->GetAccessibilitySettings();
  TestEqual("Screen reader setting should persist", LoadedSettings->bScreenReaderEnabled, true);
  TestEqual("High contrast setting should persist", LoadedSettings->bHighContrastMode, true);
  TestEqual("Font scale factor should persist", LoadedSettings->FontScaleFactor, 1.5f);
  TestEqual("Color blind setting should persist", LoadedSettings->ColorBlindType, EALEJOColorBlindType::Deuteranopia);
  TestEqual("Reduced motion setting should persist", LoadedSettings->bReducedMotion, true);
  
  return true;
}
```

### 8.2 Manual Settings Persistence Testing

1. Configure all accessibility settings
2. Close and reopen the application
3. Verify settings are preserved

**Testing checklist:**
- [ ] All accessibility settings persist between sessions
- [ ] Settings UI correctly reflects current state
- [ ] Changing settings has immediate effect
- [ ] Default settings are appropriate for first-time users
- [ ] Settings reset function works correctly

## 9. Accessibility Compliance Verification

### 9.1 WCAG 2.1 AA Checklist

Test against Web Content Accessibility Guidelines (WCAG) 2.1 AA standards adapted for gaming:

- **Perceivable**
  - [ ] Text alternatives for non-text content
  - [ ] Captions and audio descriptions
  - [ ] Content distinguishable without color alone
  - [ ] Text readable with minimum contrast ratio of 4.5:1
  - [ ] Text resizable up to 200% without loss of functionality

- **Operable**
  - [ ] All functionality operable through keyboard
  - [ ] Users can control time limits
  - [ ] No content that flashes more than 3 times per second
  - [ ] Navigation is consistent and predictable

- **Understandable**
  - [ ] UI operation is predictable
  - [ ] Input assistance provided
  - [ ] Error messages are clear and helpful

- **Robust**
  - [ ] Compatible with current and future assistive technologies

### 9.2 Manual Compliance Testing

1. For each component in your UI, verify it meets relevant WCAG criteria
2. Conduct testing with assistive technology
3. Create a compliance report identifying any issues

## 10. Documentation Testing

Verify the following documentation exists and is accurate:

- [ ] Keyboard shortcut list
- [ ] Voice command list
- [ ] Accessibility features overview
- [ ] Setup instructions for assistive technology
- [ ] Troubleshooting guide for accessibility features

## Conclusion

Regular accessibility testing should be integrated into your development workflow. Automated tests can catch many issues, but manual testing, especially with actual assistive technology users, is invaluable for ensuring ALEJO's Unreal Engine integration is truly accessible.

Remember that accessibility is not a one-time effort but an ongoing commitment to inclusive design.
