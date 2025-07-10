// Copyright ALEJO Team. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "ALEJOAccessibilitySettings.h"
#include "ALEJOUIHelper.generated.h"

/**
 * Helper class for ALEJO UI accessibility features in Unreal Engine
 * Provides Blueprint-callable functions for creating accessible UIs
 */
UCLASS(BlueprintType, Blueprintable)
class ALEJO_API UALEJOUIHelper : public UObject
{
    GENERATED_BODY()

public:
    /** Initialize with accessibility settings */
    UFUNCTION(BlueprintCallable, Category = "ALEJO|UI|Accessibility")
    void Initialize(UALEJOAccessibilitySettings* InSettings);
    
    /** Update with new accessibility settings */
    UFUNCTION(BlueprintCallable, Category = "ALEJO|UI|Accessibility")
    void UpdateAccessibilitySettings(UALEJOAccessibilitySettings* InSettings);
    
    /** Get current accessibility settings */
    UFUNCTION(BlueprintPure, Category = "ALEJO|UI|Accessibility")
    UALEJOAccessibilitySettings* GetAccessibilitySettings() const;
    
    /** Announce text to screen readers */
    UFUNCTION(BlueprintCallable, Category = "ALEJO|UI|Accessibility")
    void AnnounceToScreenReader(const FString& Message, bool bInterrupt = false);
    
    /** Apply high contrast mode to UI elements */
    UFUNCTION(BlueprintCallable, Category = "ALEJO|UI|Accessibility", meta = (DisplayName = "Apply High Contrast Mode"))
    void ApplyHighContrastMode(UUserWidget* TargetWidget, bool bHighContrast);
    
    /** Apply font scaling based on current accessibility settings */
    UFUNCTION(BlueprintCallable, Category = "ALEJO|UI|Accessibility")
    void ApplyFontScaling(UUserWidget* TargetWidget);
    
    /** Create a color combination suitable for the current accessibility settings */
    UFUNCTION(BlueprintPure, Category = "ALEJO|UI|Accessibility")
    void GetAccessibleColorPair(FLinearColor& OutBackgroundColor, FLinearColor& OutForegroundColor, bool bIsButtonOrInteractive = false);
    
    /** Check if the contrast ratio between two colors meets accessibility guidelines */
    UFUNCTION(BlueprintPure, Category = "ALEJO|UI|Accessibility")
    float GetContrastRatio(FLinearColor Color1, FLinearColor Color2);
    
    /** Convert text to be more accessible based on current settings */
    UFUNCTION(BlueprintPure, Category = "ALEJO|UI|Accessibility")
    FString GetAccessibleText(const FString& OriginalText);
    
    /** Get keyboard shortcut text for a given action */
    UFUNCTION(BlueprintPure, Category = "ALEJO|UI|Accessibility")
    FString GetKeyboardShortcutText(const FString& ActionName);
    
    /** Apply reduced motion settings to animation components */
    UFUNCTION(BlueprintCallable, Category = "ALEJO|UI|Accessibility")
    void ApplyReducedMotionSettings(UUserWidget* TargetWidget);
    
    /** Create a focus border to highlight keyboard-focused elements */
    UFUNCTION(BlueprintCallable, Category = "ALEJO|UI|Accessibility")
    void SetFocusHighlight(UUserWidget* WidgetToHighlight, bool bIsFocused);

private:
    /** Current accessibility settings */
    UPROPERTY()
    UALEJOAccessibilitySettings* AccessibilitySettings;
    
    /** Helper function to recursively apply font scaling */
    void ApplyFontScalingRecursive(UWidget* Widget, float ScaleFactor);
    
    /** Helper function to recursively apply high contrast colors */
    void ApplyHighContrastRecursive(UWidget* Widget, bool bHighContrast);
    
    /** Helper to get a color suitable for color blind users */
    FLinearColor GetColorBlindFriendlyColor(const FLinearColor& OriginalColor);
};
