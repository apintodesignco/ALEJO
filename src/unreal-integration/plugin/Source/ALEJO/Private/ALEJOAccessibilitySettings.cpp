// Copyright ALEJO Team. All Rights Reserved.

#include "ALEJOAccessibilitySettings.h"
#include "JsonObjectConverter.h"
#include "Serialization/JsonWriter.h"
#include "Serialization/JsonSerializer.h"
#include "Dom/JsonObject.h"

UALEJOAccessibilitySettings::UALEJOAccessibilitySettings()
{
    // Initialize with accessibility-friendly defaults
    
    // Visual settings
    bHighContrastMode = false;
    FontScaleFactor = 1.0f;
    bColorBlindMode = false;
    ColorBlindnessType = TEXT("None");
    bScreenReaderEnabled = false;
    
    // Hearing settings
    bVisualAlternativesToAudio = false;
    bSignLanguageEnabled = false;
    SignLanguagePreference = TEXT("ASL");
    bCaptionsEnabled = true; // Captions enabled by default
    CaptionScaleFactor = 1.0f;
    
    // Motor settings
    bHapticFeedbackEnabled = true;
    InputHoldDuration = 0.3f;
    bSimplifiedGestureControls = false;
    
    // Cognitive settings
    bSimplifiedLanguage = false;
    bReducedMotion = false;
    bFocusAssistance = false;
    ReadingSpeedFactor = 1.0f;
}

FString UALEJOAccessibilitySettings::ToJsonString() const
{
    // Create JSON object for settings
    TSharedPtr<FJsonObject> JsonObject = MakeShareable(new FJsonObject);
    
    // Visual settings
    JsonObject->SetBoolField(TEXT("highContrastMode"), bHighContrastMode);
    JsonObject->SetNumberField(TEXT("fontScaleFactor"), FontScaleFactor);
    JsonObject->SetBoolField(TEXT("colorBlindMode"), bColorBlindMode);
    JsonObject->SetStringField(TEXT("colorBlindnessType"), ColorBlindnessType);
    JsonObject->SetBoolField(TEXT("screenReaderEnabled"), bScreenReaderEnabled);
    
    // Hearing settings
    JsonObject->SetBoolField(TEXT("visualAlternativesToAudio"), bVisualAlternativesToAudio);
    JsonObject->SetBoolField(TEXT("signLanguageEnabled"), bSignLanguageEnabled);
    JsonObject->SetStringField(TEXT("signLanguagePreference"), SignLanguagePreference);
    JsonObject->SetBoolField(TEXT("captionsEnabled"), bCaptionsEnabled);
    JsonObject->SetNumberField(TEXT("captionScaleFactor"), CaptionScaleFactor);
    
    // Motor settings
    JsonObject->SetBoolField(TEXT("hapticFeedbackEnabled"), bHapticFeedbackEnabled);
    JsonObject->SetNumberField(TEXT("inputHoldDuration"), InputHoldDuration);
    JsonObject->SetBoolField(TEXT("simplifiedGestureControls"), bSimplifiedGestureControls);
    
    // Cognitive settings
    JsonObject->SetBoolField(TEXT("simplifiedLanguage"), bSimplifiedLanguage);
    JsonObject->SetBoolField(TEXT("reducedMotion"), bReducedMotion);
    JsonObject->SetBoolField(TEXT("focusAssistance"), bFocusAssistance);
    JsonObject->SetNumberField(TEXT("readingSpeedFactor"), ReadingSpeedFactor);
    
    // Serialize to string
    FString OutputString;
    TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&OutputString);
    FJsonSerializer::Serialize(JsonObject.ToSharedRef(), Writer);
    
    return OutputString;
}

bool UALEJOAccessibilitySettings::FromJsonString(const FString& JsonString)
{
    // Parse JSON string
    TSharedPtr<FJsonObject> JsonObject;
    TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(JsonString);
    if (!FJsonSerializer::Deserialize(Reader, JsonObject) || !JsonObject.IsValid())
    {
        return false;
    }
    
    // Visual settings
    JsonObject->TryGetBoolField(TEXT("highContrastMode"), bHighContrastMode);
    JsonObject->TryGetNumberField(TEXT("fontScaleFactor"), FontScaleFactor);
    JsonObject->TryGetBoolField(TEXT("colorBlindMode"), bColorBlindMode);
    JsonObject->TryGetStringField(TEXT("colorBlindnessType"), ColorBlindnessType);
    JsonObject->TryGetBoolField(TEXT("screenReaderEnabled"), bScreenReaderEnabled);
    
    // Hearing settings
    JsonObject->TryGetBoolField(TEXT("visualAlternativesToAudio"), bVisualAlternativesToAudio);
    JsonObject->TryGetBoolField(TEXT("signLanguageEnabled"), bSignLanguageEnabled);
    JsonObject->TryGetStringField(TEXT("signLanguagePreference"), SignLanguagePreference);
    JsonObject->TryGetBoolField(TEXT("captionsEnabled"), bCaptionsEnabled);
    JsonObject->TryGetNumberField(TEXT("captionScaleFactor"), CaptionScaleFactor);
    
    // Motor settings
    JsonObject->TryGetBoolField(TEXT("hapticFeedbackEnabled"), bHapticFeedbackEnabled);
    JsonObject->TryGetNumberField(TEXT("inputHoldDuration"), InputHoldDuration);
    JsonObject->TryGetBoolField(TEXT("simplifiedGestureControls"), bSimplifiedGestureControls);
    
    // Cognitive settings
    JsonObject->TryGetBoolField(TEXT("simplifiedLanguage"), bSimplifiedLanguage);
    JsonObject->TryGetBoolField(TEXT("reducedMotion"), bReducedMotion);
    JsonObject->TryGetBoolField(TEXT("focusAssistance"), bFocusAssistance);
    JsonObject->TryGetNumberField(TEXT("readingSpeedFactor"), ReadingSpeedFactor);
    
    return true;
}
