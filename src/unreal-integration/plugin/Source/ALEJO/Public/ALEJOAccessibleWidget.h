// Copyright ALEJO Team. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "ALEJOUIHelper.h"
#include "ALEJOAccessibilitySettings.h"
#include "ALEJOAccessibleWidget.generated.h"

/**
 * Base widget class for creating accessible UIs with ALEJO integration.
 * This widget handles accessibility features like screen reader support,
 * high contrast mode, font scaling, and keyboard navigation.
 */
UCLASS(Abstract, BlueprintType, Blueprintable)
class ALEJO_API UALEJOAccessibleWidget : public UUserWidget
{
    GENERATED_BODY()

public:
    UALEJOAccessibleWidget(const FObjectInitializer& ObjectInitializer);
    
    virtual void NativeConstruct() override;
    virtual void NativeDestruct() override;
    virtual FReply NativeOnKeyDown(const FGeometry& InGeometry, const FKeyEvent& InKeyEvent) override;
    virtual FNavigationReply NativeOnNavigation(const FGeometry& MyGeometry, const FNavigationEvent& InNavigationEvent, const FNavigationReply& InDefaultReply) override;
    virtual void NativeTick(const FGeometry& MyGeometry, float InDeltaTime) override;
    
    /** Set accessibility settings and apply them to this widget */
    UFUNCTION(BlueprintCallable, Category = "ALEJO|UI|Accessibility")
    void SetAccessibilitySettings(UALEJOAccessibilitySettings* InSettings);
    
    /** Get current accessibility settings */
    UFUNCTION(BlueprintPure, Category = "ALEJO|UI|Accessibility")
    UALEJOAccessibilitySettings* GetAccessibilitySettings() const;
    
    /** Apply current accessibility settings to this widget */
    UFUNCTION(BlueprintCallable, Category = "ALEJO|UI|Accessibility")
    void ApplyAccessibilitySettings();
    
    /** Announce a message to screen readers */
    UFUNCTION(BlueprintCallable, Category = "ALEJO|UI|Accessibility")
    void AnnounceToScreenReader(const FString& Message, bool bInterrupt = false);
    
    /** Process voice input event */
    UFUNCTION(BlueprintCallable, Category = "ALEJO|UI|Voice")
    void OnVoiceInputReceived(const FString& VoiceCommand);
    
    /** Called when ALEJO connection status changes */
    UFUNCTION(BlueprintNativeEvent, Category = "ALEJO|Connection")
    void OnConnectionStatusChanged(bool bIsConnected);
    
    /** Called when a text processing result is received */
    UFUNCTION(BlueprintNativeEvent, Category = "ALEJO|Text")
    void OnTextProcessingResult(const FString& Result);
    
    /** Called when a voice processing result is received */
    UFUNCTION(BlueprintNativeEvent, Category = "ALEJO|Voice")
    void OnVoiceProcessingResult(const FString& Result);
    
    /** Called when resource mode changes */
    UFUNCTION(BlueprintNativeEvent, Category = "ALEJO|Resources")
    void OnResourceModeChanged(const FString& ResourceMode);

protected:
    /** ALEJO UI Helper for accessibility features */
    UPROPERTY(BlueprintReadOnly, Category = "ALEJO|UI")
    UALEJOUIHelper* UIHelper;
    
    /** Current accessibility settings */
    UPROPERTY(BlueprintReadOnly, Category = "ALEJO|UI")
    UALEJOAccessibilitySettings* AccessibilitySettings;
    
    /** True when waiting for voice input */
    UPROPERTY(BlueprintReadOnly, Category = "ALEJO|Voice")
    bool bIsWaitingForVoiceInput;
    
    /** Current connection status */
    UPROPERTY(BlueprintReadOnly, Category = "ALEJO|Connection")
    bool bIsConnected;
    
    /** Last time a screen reader announcement was made */
    UPROPERTY(BlueprintReadOnly, Category = "ALEJO|UI")
    float LastAnnouncementTime;
    
    /** Apply high contrast mode */
    UFUNCTION(BlueprintCallable, Category = "ALEJO|UI|Accessibility")
    void SetHighContrastMode(bool bEnable);
    
    /** Apply font scaling */
    UFUNCTION(BlueprintCallable, Category = "ALEJO|UI|Accessibility")
    void ApplyFontScaling(float ScaleFactor);
    
    /** Show visual feedback for voice activity */
    UFUNCTION(BlueprintImplementableEvent, Category = "ALEJO|Voice")
    void ShowVoiceActivityFeedback(bool bActive);
    
    /** Initialize this widget from the ALEJOSubsystem */
    void InitializeFromSubsystem();
    
    /** Register for ALEJO events */
    void RegisterForEvents();
    
    /** Unregister from ALEJO events */
    void UnregisterFromEvents();
    
    /** Handle keyboard shortcut for voice commands */
    bool HandleVoiceCommandShortcut(const FKeyEvent& InKeyEvent);
};
