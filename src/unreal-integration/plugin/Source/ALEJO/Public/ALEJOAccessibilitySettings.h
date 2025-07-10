// Copyright ALEJO Team. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "UObject/NoExportTypes.h"
#include "ALEJOAccessibilitySettings.generated.h"

/**
 * Settings class for ALEJO accessibility features
 * Follows ALEJO's accessibility-first design principle
 */
UCLASS(BlueprintType, Blueprintable)
class ALEJO_API UALEJOAccessibilitySettings : public UObject
{
	GENERATED_BODY()

public:
	UALEJOAccessibilitySettings();

	// Visual Accessibility Settings
	
	/** Enable high contrast mode for visually impaired users */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ALEJO|Accessibility|Visual")
	bool bHighContrastMode;
	
	/** Font scale factor (1.0 = normal, 2.0 = double size) */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ALEJO|Accessibility|Visual", meta = (ClampMin = "0.5", ClampMax = "3.0"))
	float FontScaleFactor;
	
	/** Enable color blindness accommodations */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ALEJO|Accessibility|Visual")
	bool bColorBlindMode;
	
	/** Type of color blindness (Protanopia, Deuteranopia, Tritanopia) */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ALEJO|Accessibility|Visual")
	FString ColorBlindnessType;
	
	/** Enable screen reader announcements */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ALEJO|Accessibility|Visual")
	bool bScreenReaderEnabled;

	// Hearing Accessibility Settings
	
	/** Enable visual alternatives to audio cues */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ALEJO|Accessibility|Hearing")
	bool bVisualAlternativesToAudio;
	
	/** Enable sign language support */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ALEJO|Accessibility|Hearing")
	bool bSignLanguageEnabled;
	
	/** Sign language preference (ASL, BSL, etc.) */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ALEJO|Accessibility|Hearing")
	FString SignLanguagePreference;
	
	/** Enable captions for all audio */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ALEJO|Accessibility|Hearing")
	bool bCaptionsEnabled;
	
	/** Caption size scale factor */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ALEJO|Accessibility|Hearing", meta = (ClampMin = "0.5", ClampMax = "3.0"))
	float CaptionScaleFactor;

	// Motor Control Accessibility Settings
	
	/** Enable haptic feedback for touch interactions */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ALEJO|Accessibility|Motor")
	bool bHapticFeedbackEnabled;
	
	/** Input hold duration for confirmation (seconds) */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ALEJO|Accessibility|Motor", meta = (ClampMin = "0.1", ClampMax = "2.0"))
	float InputHoldDuration;
	
	/** Enable simplified gesture controls */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ALEJO|Accessibility|Motor")
	bool bSimplifiedGestureControls;

	// Cognitive Accessibility Settings
	
	/** Enable simplified language mode */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ALEJO|Accessibility|Cognitive")
	bool bSimplifiedLanguage;
	
	/** Reduce motion effects */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ALEJO|Accessibility|Cognitive")
	bool bReducedMotion;
	
	/** Enable focus assistance highlighting */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ALEJO|Accessibility|Cognitive")
	bool bFocusAssistance;
	
	/** Reading speed adjustment (1.0 = normal) */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ALEJO|Accessibility|Cognitive", meta = (ClampMin = "0.5", ClampMax = "2.0"))
	float ReadingSpeedFactor;
	
	// Convert settings to JSON string for transmission
	UFUNCTION(BlueprintCallable, Category = "ALEJO|Accessibility")
	FString ToJsonString() const;
	
	// Apply settings from JSON string
	UFUNCTION(BlueprintCallable, Category = "ALEJO|Accessibility")
	bool FromJsonString(const FString& JsonString);
};
