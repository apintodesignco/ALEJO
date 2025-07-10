// Copyright ALEJO Team. All Rights Reserved.

#include "ALEJOAccessibleWidget.h"
#include "ALEJOSubsystem.h"
#include "Components/PanelWidget.h"
#include "Components/Button.h"
#include "Components/TextBlock.h"
#include "InputCoreTypes.h"
#include "Kismet/GameplayStatics.h"
#include "Accessibility/Accessibility.h"

UALEJOAccessibleWidget::UALEJOAccessibleWidget(const FObjectInitializer& ObjectInitializer)
    : Super(ObjectInitializer)
    , bIsWaitingForVoiceInput(false)
    , bIsConnected(false)
    , LastAnnouncementTime(0.0f)
{
    UIHelper = NewObject<UALEJOUIHelper>(this);
}

void UALEJOAccessibleWidget::NativeConstruct()
{
    Super::NativeConstruct();
    
    // Initialize UI helper
    if (!UIHelper)
    {
        UIHelper = NewObject<UALEJOUIHelper>(this);
    }
    
    // Initialize from subsystem
    InitializeFromSubsystem();
    
    // Register for events
    RegisterForEvents();
    
    // Apply initial accessibility settings
    ApplyAccessibilitySettings();
    
    // Make widget accessible to screen readers
    FAccessibilitySettings::SetCachedIsAccessibleToPlatform(true);
}

void UALEJOAccessibleWidget::NativeDestruct()
{
    // Unregister from events
    UnregisterFromEvents();
    
    Super::NativeDestruct();
}

void UALEJOAccessibleWidget::InitializeFromSubsystem()
{
    if (UGameInstance* GameInstance = GetGameInstance())
    {
        if (UALEJOSubsystem* ALEJOSubsystem = GameInstance->GetSubsystem<UALEJOSubsystem>())
        {
            // Get current accessibility settings
            UALEJOAccessibilitySettings* CurrentSettings = ALEJOSubsystem->GetAccessibilitySettings();
            if (CurrentSettings)
            {
                SetAccessibilitySettings(CurrentSettings);
            }
            else
            {
                // Create default settings if none exist
                AccessibilitySettings = NewObject<UALEJOAccessibilitySettings>(this);
                UIHelper->Initialize(AccessibilitySettings);
            }
            
            // Get current connection status
            bIsConnected = ALEJOSubsystem->IsConnected();
            OnConnectionStatusChanged(bIsConnected);
        }
    }
}

void UALEJOAccessibleWidget::RegisterForEvents()
{
    if (UGameInstance* GameInstance = GetGameInstance())
    {
        if (UALEJOSubsystem* ALEJOSubsystem = GameInstance->GetSubsystem<UALEJOSubsystem>())
        {
            // Register for connection status changes
            ALEJOSubsystem->OnConnectionStatusChanged.AddDynamic(this, &UALEJOAccessibleWidget::OnConnectionStatusChanged);
            
            // Register for text processing results
            ALEJOSubsystem->OnTextProcessingResult.AddDynamic(this, &UALEJOAccessibleWidget::OnTextProcessingResult);
            
            // Register for voice processing results
            ALEJOSubsystem->OnVoiceProcessingResult.AddDynamic(this, &UALEJOAccessibleWidget::OnVoiceProcessingResult);
            
            // Register for resource mode changes
            ALEJOSubsystem->OnResourceModeChanged.AddDynamic(this, &UALEJOAccessibleWidget::OnResourceModeChanged);
            
            // Register for accessibility settings changes
            ALEJOSubsystem->OnAccessibilitySettingsChanged.AddUObject(this, &UALEJOAccessibleWidget::SetAccessibilitySettings);
        }
    }
}

void UALEJOAccessibleWidget::UnregisterFromEvents()
{
    if (UGameInstance* GameInstance = GetGameInstance())
    {
        if (UALEJOSubsystem* ALEJOSubsystem = GameInstance->GetSubsystem<UALEJOSubsystem>())
        {
            // Unregister from all events
            ALEJOSubsystem->OnConnectionStatusChanged.RemoveAll(this);
            ALEJOSubsystem->OnTextProcessingResult.RemoveAll(this);
            ALEJOSubsystem->OnVoiceProcessingResult.RemoveAll(this);
            ALEJOSubsystem->OnResourceModeChanged.RemoveAll(this);
            ALEJOSubsystem->OnAccessibilitySettingsChanged.RemoveAll(this);
        }
    }
}

void UALEJOAccessibleWidget::SetAccessibilitySettings(UALEJOAccessibilitySettings* InSettings)
{
    if (InSettings)
    {
        AccessibilitySettings = InSettings;
        if (UIHelper)
        {
            UIHelper->UpdateAccessibilitySettings(AccessibilitySettings);
        }
        
        // Apply the settings to this widget
        ApplyAccessibilitySettings();
        
        // Announce changes for screen reader users
        if (AccessibilitySettings->bScreenReaderEnabled)
        {
            AnnounceToScreenReader(TEXT("Accessibility settings updated"), true);
        }
    }
}

UALEJOAccessibilitySettings* UALEJOAccessibleWidget::GetAccessibilitySettings() const
{
    return AccessibilitySettings;
}

void UALEJOAccessibleWidget::ApplyAccessibilitySettings()
{
    if (!AccessibilitySettings || !UIHelper)
    {
        return;
    }
    
    // Apply high contrast if needed
    SetHighContrastMode(AccessibilitySettings->bHighContrastMode);
    
    // Apply font scaling
    ApplyFontScaling(AccessibilitySettings->FontScaleFactor);
    
    // Apply reduced motion settings
    if (AccessibilitySettings->bReducedMotion)
    {
        UIHelper->ApplyReducedMotionSettings(this);
    }
    
    // Apply keyboard focus visual indicators if keyboard navigation is enabled
    if (AccessibilitySettings->bKeyboardNavigationEnabled)
    {
        // Set widget as keyboard focusable
        SetKeyboardFocus();
    }
}

void UALEJOAccessibleWidget::SetHighContrastMode(bool bEnable)
{
    if (UIHelper)
    {
        UIHelper->ApplyHighContrastMode(this, bEnable);
    }
}

void UALEJOAccessibleWidget::ApplyFontScaling(float ScaleFactor)
{
    if (UIHelper)
    {
        UIHelper->ApplyFontScaling(this);
    }
}

void UALEJOAccessibleWidget::AnnounceToScreenReader(const FString& Message, bool bInterrupt)
{
    // Prevent spam by enforcing a minimum time between announcements
    float CurrentTime = UGameplayStatics::GetTimeSeconds(this);
    if (CurrentTime - LastAnnouncementTime < 1.0f && !bInterrupt)
    {
        return;
    }
    
    LastAnnouncementTime = CurrentTime;
    
    // Use UI Helper to make announcement
    if (UIHelper)
    {
        UIHelper->AnnounceToScreenReader(Message, bInterrupt);
    }
}

void UALEJOAccessibleWidget::OnVoiceInputReceived(const FString& VoiceCommand)
{
    if (VoiceCommand.IsEmpty())
    {
        return;
    }
    
    bIsWaitingForVoiceInput = false;
    ShowVoiceActivityFeedback(false);
    
    // Announce that voice command was received for screen reader users
    if (AccessibilitySettings && AccessibilitySettings->bScreenReaderEnabled)
    {
        AnnounceToScreenReader(FString::Printf(TEXT("Voice command received: %s"), *VoiceCommand), true);
    }
    
    // Process the voice command through the ALEJO subsystem
    if (UGameInstance* GameInstance = GetGameInstance())
    {
        if (UALEJOSubsystem* ALEJOSubsystem = GameInstance->GetSubsystem<UALEJOSubsystem>())
        {
            TMap<FString, FString> Context;
            Context.Add(TEXT("source"), TEXT("accessible_widget"));
            Context.Add(TEXT("widget_name"), GetName());
            
            ALEJOSubsystem->ProcessVoiceCommand(VoiceCommand, Context);
        }
    }
}

FReply UALEJOAccessibleWidget::NativeOnKeyDown(const FGeometry& InGeometry, const FKeyEvent& InKeyEvent)
{
    // Check for voice command shortcut
    if (HandleVoiceCommandShortcut(InKeyEvent))
    {
        return FReply::Handled();
    }
    
    // Pass to parent handler
    return Super::NativeOnKeyDown(InGeometry, InKeyEvent);
}

bool UALEJOAccessibleWidget::HandleVoiceCommandShortcut(const FKeyEvent& InKeyEvent)
{
    // Check for Ctrl+Space (common voice command activation shortcut)
    if (InKeyEvent.IsControlDown() && InKeyEvent.GetKey() == EKeys::SpaceBar)
    {
        // Toggle voice input mode
        bIsWaitingForVoiceInput = !bIsWaitingForVoiceInput;
        ShowVoiceActivityFeedback(bIsWaitingForVoiceInput);
        
        // Announce voice mode for screen reader users
        if (AccessibilitySettings && AccessibilitySettings->bScreenReaderEnabled)
        {
            if (bIsWaitingForVoiceInput)
            {
                AnnounceToScreenReader(TEXT("Voice command mode activated. Please speak now."), true);
            }
            else
            {
                AnnounceToScreenReader(TEXT("Voice command mode deactivated."), true);
            }
        }
        
        // If activating voice mode, notify the ALEJO subsystem
        if (bIsWaitingForVoiceInput)
        {
            if (UGameInstance* GameInstance = GetGameInstance())
            {
                if (UALEJOSubsystem* ALEJOSubsystem = GameInstance->GetSubsystem<UALEJOSubsystem>())
                {
                    // Send custom event to start voice input
                    ALEJOSubsystem->SendCustomEvent(TEXT("voice.listening.start"), TEXT("{}"));
                }
            }
        }
        
        return true;
    }
    
    return false;
}

FNavigationReply UALEJOAccessibleWidget::NativeOnNavigation(const FGeometry& MyGeometry, const FNavigationEvent& InNavigationEvent, const FNavigationReply& InDefaultReply)
{
    // If keyboard navigation is enabled, handle it here
    if (AccessibilitySettings && AccessibilitySettings->bKeyboardNavigationEnabled)
    {
        // Let the default navigation system handle it
        return InDefaultReply;
    }
    
    return Super::NativeOnNavigation(MyGeometry, InNavigationEvent, InDefaultReply);
}

void UALEJOAccessibleWidget::NativeTick(const FGeometry& MyGeometry, float InDeltaTime)
{
    Super::NativeTick(MyGeometry, InDeltaTime);
    
    // Update voice activity feedback if needed
    if (bIsWaitingForVoiceInput)
    {
        ShowVoiceActivityFeedback(true);
    }
}

void UALEJOAccessibleWidget::OnConnectionStatusChanged_Implementation(bool bIsConnected)
{
    this->bIsConnected = bIsConnected;
    
    // Announce connection status for screen reader users
    if (AccessibilitySettings && AccessibilitySettings->bScreenReaderEnabled)
    {
        if (bIsConnected)
        {
            AnnounceToScreenReader(TEXT("ALEJO connected"), false);
        }
        else
        {
            AnnounceToScreenReader(TEXT("ALEJO disconnected"), false);
        }
    }
}

void UALEJOAccessibleWidget::OnTextProcessingResult_Implementation(const FString& Result)
{
    // Base implementation - announce result for screen reader users
    if (AccessibilitySettings && AccessibilitySettings->bScreenReaderEnabled)
    {
        AnnounceToScreenReader(FString::Printf(TEXT("Text result: %s"), *Result), false);
    }
}

void UALEJOAccessibleWidget::OnVoiceProcessingResult_Implementation(const FString& Result)
{
    // Base implementation - announce result for screen reader users
    if (AccessibilitySettings && AccessibilitySettings->bScreenReaderEnabled)
    {
        AnnounceToScreenReader(FString::Printf(TEXT("Voice result: %s"), *Result), false);
    }
}

void UALEJOAccessibleWidget::OnResourceModeChanged_Implementation(const FString& ResourceMode)
{
    // Base implementation - adjust UI based on resource mode
    if (ResourceMode == TEXT("low"))
    {
        // Simplify UI for low resource mode
        // Disable animations, reduce visual effects
    }
    else if (ResourceMode == TEXT("medium"))
    {
        // Balanced UI for medium resource mode
    }
    else if (ResourceMode == TEXT("high"))
    {
        // Full UI features for high resource mode
    }
    
    // Announce resource mode change for screen reader users
    if (AccessibilitySettings && AccessibilitySettings->bScreenReaderEnabled)
    {
        AnnounceToScreenReader(FString::Printf(TEXT("Resource mode changed to %s"), *ResourceMode), false);
    }
}
