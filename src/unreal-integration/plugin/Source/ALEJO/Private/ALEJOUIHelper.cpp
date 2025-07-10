// Copyright ALEJO Team. All Rights Reserved.

#include "ALEJOUIHelper.h"
#include "Components/TextBlock.h"
#include "Components/RichTextBlock.h"
#include "Components/Button.h"
#include "Components/Image.h"
#include "Blueprint/WidgetTree.h"
#include "Accessibility/Accessibility.h"
#include "Styling/SlateColor.h"
#include "ALEJOSubsystem.h"

void UALEJOUIHelper::Initialize(UALEJOAccessibilitySettings* InSettings)
{
    if (InSettings)
    {
        AccessibilitySettings = InSettings;
    }
    else
    {
        // Create default settings if none provided
        AccessibilitySettings = NewObject<UALEJOAccessibilitySettings>(this);
    }
}

void UALEJOUIHelper::UpdateAccessibilitySettings(UALEJOAccessibilitySettings* InSettings)
{
    if (InSettings)
    {
        AccessibilitySettings = InSettings;
    }
}

UALEJOAccessibilitySettings* UALEJOUIHelper::GetAccessibilitySettings() const
{
    return AccessibilitySettings;
}

void UALEJOUIHelper::AnnounceToScreenReader(const FString& Message, bool bInterrupt)
{
    // Skip if screen reader not enabled
    if (!AccessibilitySettings || !AccessibilitySettings->bScreenReaderEnabled)
    {
        return;
    }
    
    // Use Unreal's accessibility system to announce text to screen readers
    if (bInterrupt)
    {
        FAccessibilitySettings::SetCachedIsAccessibleToPlatform(true);
        UAccessibilityBlueprintLibrary::AnnounceTextToScreenReader(Message, FText::GetEmpty(), EAnnounceLayer::Override);
    }
    else
    {
        FAccessibilitySettings::SetCachedIsAccessibleToPlatform(true);
        UAccessibilityBlueprintLibrary::AnnounceTextToScreenReader(Message);
    }
    
    // Also notify ALEJO subsystem about the announcement for coordination
    if (UGameInstance* GameInstance = GetWorld()->GetGameInstance())
    {
        if (UALEJOSubsystem* ALEJOSubsystem = GameInstance->GetSubsystem<UALEJOSubsystem>())
        {
            TMap<FString, FString> EventData;
            EventData.Add(TEXT("message"), Message);
            ALEJOSubsystem->SendCustomEvent(TEXT("ui.screenreader.announce"), FString::Printf(TEXT("{\"message\":\"%s\"}"), *Message));
        }
    }
}

void UALEJOUIHelper::ApplyHighContrastMode(UUserWidget* TargetWidget, bool bHighContrast)
{
    if (!TargetWidget || !TargetWidget->WidgetTree)
    {
        return;
    }
    
    // Apply high contrast mode recursively to all child widgets
    ApplyHighContrastRecursive(TargetWidget->WidgetTree->RootWidget, bHighContrast);
}

void UALEJOUIHelper::ApplyFontScaling(UUserWidget* TargetWidget)
{
    if (!TargetWidget || !TargetWidget->WidgetTree || !AccessibilitySettings)
    {
        return;
    }
    
    // Apply font scaling recursively to all child widgets
    ApplyFontScalingRecursive(TargetWidget->WidgetTree->RootWidget, AccessibilitySettings->FontScaleFactor);
}

void UALEJOUIHelper::GetAccessibleColorPair(FLinearColor& OutBackgroundColor, FLinearColor& OutForegroundColor, bool bIsButtonOrInteractive)
{
    if (!AccessibilitySettings)
    {
        // Default colors with good contrast
        OutBackgroundColor = FLinearColor(0.1f, 0.1f, 0.1f, 1.0f); // Dark gray
        OutForegroundColor = FLinearColor(0.9f, 0.9f, 0.9f, 1.0f); // Light gray
        return;
    }
    
    if (AccessibilitySettings->bHighContrastMode)
    {
        // High contrast mode
        if (bIsButtonOrInteractive)
        {
            OutBackgroundColor = FLinearColor(0.0f, 0.0f, 0.8f, 1.0f); // Dark blue
            OutForegroundColor = FLinearColor(1.0f, 1.0f, 1.0f, 1.0f); // White
        }
        else
        {
            OutBackgroundColor = FLinearColor(0.0f, 0.0f, 0.0f, 1.0f); // Black
            OutForegroundColor = FLinearColor(1.0f, 1.0f, 0.0f, 1.0f); // Yellow
        }
    }
    else if (AccessibilitySettings->bColorBlindMode)
    {
        // Color blind friendly colors
        if (bIsButtonOrInteractive)
        {
            OutBackgroundColor = FLinearColor(0.0f, 0.4f, 0.7f, 1.0f); // Blue (works for most types)
            OutForegroundColor = FLinearColor(1.0f, 1.0f, 1.0f, 1.0f); // White
        }
        else
        {
            OutBackgroundColor = FLinearColor(0.2f, 0.2f, 0.2f, 1.0f); // Dark gray
            OutForegroundColor = FLinearColor(0.95f, 0.95f, 0.95f, 1.0f); // Off-white
        }
    }
    else
    {
        // Standard mode with good contrast
        if (bIsButtonOrInteractive)
        {
            OutBackgroundColor = FLinearColor(0.2f, 0.2f, 0.8f, 1.0f); // Blue
            OutForegroundColor = FLinearColor(1.0f, 1.0f, 1.0f, 1.0f); // White
        }
        else
        {
            OutBackgroundColor = FLinearColor(0.1f, 0.1f, 0.1f, 1.0f); // Dark gray
            OutForegroundColor = FLinearColor(0.9f, 0.9f, 0.9f, 1.0f); // Light gray
        }
    }
}

float UALEJOUIHelper::GetContrastRatio(FLinearColor Color1, FLinearColor Color2)
{
    // Calculate relative luminance according to WCAG 2.0
    auto CalculateLuminance = [](FLinearColor Color) -> float
    {
        float R = Color.R <= 0.03928f ? Color.R / 12.92f : FMath::Pow((Color.R + 0.055f) / 1.055f, 2.4f);
        float G = Color.G <= 0.03928f ? Color.G / 12.92f : FMath::Pow((Color.G + 0.055f) / 1.055f, 2.4f);
        float B = Color.B <= 0.03928f ? Color.B / 12.92f : FMath::Pow((Color.B + 0.055f) / 1.055f, 2.4f);
        
        return 0.2126f * R + 0.7152f * G + 0.0722f * B;
    };
    
    float L1 = CalculateLuminance(Color1);
    float L2 = CalculateLuminance(Color2);
    
    // Calculate contrast ratio
    float LighterL = FMath::Max(L1, L2);
    float DarkerL = FMath::Min(L1, L2);
    
    return (LighterL + 0.05f) / (DarkerL + 0.05f);
}

FString UALEJOUIHelper::GetAccessibleText(const FString& OriginalText)
{
    if (!AccessibilitySettings)
    {
        return OriginalText;
    }
    
    // Apply settings to make text more accessible
    FString ModifiedText = OriginalText;
    
    if (AccessibilitySettings->bSimplifiedLanguage)
    {
        // Simple implementation - in a real system this would use NLP
        // For demo, just indicate simplified text would be here
        ModifiedText = TEXT("[Simplified] ") + ModifiedText;
    }
    
    return ModifiedText;
}

FString UALEJOUIHelper::GetKeyboardShortcutText(const FString& ActionName)
{
    // Map of action names to keyboard shortcuts
    static const TMap<FString, FString> ShortcutMap = {
        { TEXT("Send"), TEXT("Enter") },
        { TEXT("Cancel"), TEXT("Esc") },
        { TEXT("Help"), TEXT("F1") },
        { TEXT("VoiceCommand"), TEXT("Ctrl+Space") },
        { TEXT("NextItem"), TEXT("Tab") },
        { TEXT("PreviousItem"), TEXT("Shift+Tab") },
    };
    
    const FString* ShortcutPtr = ShortcutMap.Find(ActionName);
    return ShortcutPtr ? *ShortcutPtr : FString();
}

void UALEJOUIHelper::ApplyReducedMotionSettings(UUserWidget* TargetWidget)
{
    if (!TargetWidget || !AccessibilitySettings)
    {
        return;
    }
    
    // Apply reduced motion settings to widget animations
    if (AccessibilitySettings->bReducedMotion)
    {
        // Get all animations
        TArray<UWidgetAnimation*> Animations;
        TargetWidget->GetAnimations(Animations);
        
        // Adjust playback rate for all animations
        for (UWidgetAnimation* Animation : Animations)
        {
            if (Animation)
            {
                // Slow down animations or disable them entirely
                TargetWidget->SetAnimationCurrentTime(Animation, 0);
                if (Animation->GetPlayRate() > 0.5f)
                {
                    Animation->SetPlayRate(0.5f);
                }
            }
        }
    }
}

void UALEJOUIHelper::SetFocusHighlight(UUserWidget* WidgetToHighlight, bool bIsFocused)
{
    if (!WidgetToHighlight)
    {
        return;
    }
    
    // Here you would add a focus highlight to the widget
    // This is a stub - in a real implementation, you would add a border or other visual indicator
    
    // For demo purposes, we're just logging
    if (bIsFocused)
    {
        UE_LOG(LogTemp, Log, TEXT("Focus highlight applied to widget %s"), *WidgetToHighlight->GetName());
    }
    else
    {
        UE_LOG(LogTemp, Log, TEXT("Focus highlight removed from widget %s"), *WidgetToHighlight->GetName());
    }
}

void UALEJOUIHelper::ApplyFontScalingRecursive(UWidget* Widget, float ScaleFactor)
{
    if (!Widget)
    {
        return;
    }
    
    // Scale text blocks
    if (UTextBlock* TextBlock = Cast<UTextBlock>(Widget))
    {
        float OriginalSize = TextBlock->Font.Size;
        TextBlock->SetFontSize(FMath::RoundToInt(OriginalSize * ScaleFactor));
    }
    // Scale rich text blocks
    else if (URichTextBlock* RichTextBlock = Cast<URichTextBlock>(Widget))
    {
        // Rich text blocks need more complex handling
        // Just a placeholder implementation
        RichTextBlock->SetMinDesiredWidth(RichTextBlock->MinDesiredWidth * ScaleFactor);
    }
    
    // Scale buttons
    else if (UButton* Button = Cast<UButton>(Widget))
    {
        // Scale padding for better touch targets
        FMargin CurrentPadding = Button->Padding;
        Button->SetPadding(CurrentPadding * ScaleFactor);
    }
    
    // If it's a panel widget, process all its children
    if (UPanelWidget* PanelWidget = Cast<UPanelWidget>(Widget))
    {
        for (int32 i = 0; i < PanelWidget->GetChildrenCount(); ++i)
        {
            ApplyFontScalingRecursive(PanelWidget->GetChildAt(i), ScaleFactor);
        }
    }
}

void UALEJOUIHelper::ApplyHighContrastRecursive(UWidget* Widget, bool bHighContrast)
{
    if (!Widget)
    {
        return;
    }
    
    if (bHighContrast)
    {
        // Apply high contrast colors
        if (UTextBlock* TextBlock = Cast<UTextBlock>(Widget))
        {
            TextBlock->SetColorAndOpacity(FSlateColor(FLinearColor(1.0f, 1.0f, 0.0f, 1.0f))); // Yellow text
        }
        else if (UButton* Button = Cast<UButton>(Widget))
        {
            // Set button background to dark blue
            Button->SetBackgroundColor(FLinearColor(0.0f, 0.0f, 0.8f, 1.0f));
            
            // Increase border thickness for visibility
            Button->WidgetStyle.Normal.OutlineSettings.Width = 2.0f;
            Button->WidgetStyle.Hovered.OutlineSettings.Width = 3.0f;
            Button->WidgetStyle.Pressed.OutlineSettings.Width = 3.0f;
            
            // Set outline color to white
            Button->WidgetStyle.Normal.OutlineSettings.Color = FLinearColor(1.0f, 1.0f, 1.0f, 1.0f);
            Button->WidgetStyle.Hovered.OutlineSettings.Color = FLinearColor(1.0f, 1.0f, 1.0f, 1.0f);
            Button->WidgetStyle.Pressed.OutlineSettings.Color = FLinearColor(1.0f, 1.0f, 1.0f, 1.0f);
        }
        else if (UImage* Image = Cast<UImage>(Widget))
        {
            // Increase contrast for images
            Image->SetColorAndOpacity(FLinearColor(1.0f, 1.0f, 1.0f, 1.0f)); // Full opacity
            
            // Add a border around images for better visibility
            // In a real implementation, you would add a border widget around the image
        }
    }
    else
    {
        // Restore normal colors
        if (UTextBlock* TextBlock = Cast<UTextBlock>(Widget))
        {
            TextBlock->SetColorAndOpacity(FSlateColor(FLinearColor(0.9f, 0.9f, 0.9f, 1.0f))); // Light gray
        }
        else if (UButton* Button = Cast<UButton>(Widget))
        {
            // Restore default button appearance
            Button->SetBackgroundColor(FLinearColor(0.2f, 0.2f, 0.2f, 1.0f)); // Dark gray
            
            // Reset border thickness
            Button->WidgetStyle.Normal.OutlineSettings.Width = 0.0f;
            Button->WidgetStyle.Hovered.OutlineSettings.Width = 1.0f;
            Button->WidgetStyle.Pressed.OutlineSettings.Width = 1.0f;
        }
        else if (UImage* Image = Cast<UImage>(Widget))
        {
            // Restore normal image appearance
            Image->SetColorAndOpacity(FLinearColor(1.0f, 1.0f, 1.0f, 1.0f));
        }
    }
    
    // Process children recursively
    if (UPanelWidget* PanelWidget = Cast<UPanelWidget>(Widget))
    {
        for (int32 i = 0; i < PanelWidget->GetChildrenCount(); ++i)
        {
            ApplyHighContrastRecursive(PanelWidget->GetChildAt(i), bHighContrast);
        }
    }
}

FLinearColor UALEJOUIHelper::GetColorBlindFriendlyColor(const FLinearColor& OriginalColor)
{
    if (!AccessibilitySettings || !AccessibilitySettings->bColorBlindMode)
    {
        return OriginalColor;
    }
    
    // Implement color blind friendly transformations based on the type
    if (AccessibilitySettings->ColorBlindnessType == TEXT("Protanopia"))
    {
        // Red-blind: Avoid red, use blues and yellows
        // This is a simplified approach
        return FLinearColor(
            OriginalColor.B * 0.4f + OriginalColor.G * 0.6f,
            OriginalColor.G,
            OriginalColor.B,
            OriginalColor.A
        );
    }
    else if (AccessibilitySettings->ColorBlindnessType == TEXT("Deuteranopia"))
    {
        // Green-blind: Avoid green, use blues and reds
        return FLinearColor(
            OriginalColor.R,
            OriginalColor.R * 0.4f + OriginalColor.B * 0.6f,
            OriginalColor.B,
            OriginalColor.A
        );
    }
    else if (AccessibilitySettings->ColorBlindnessType == TEXT("Tritanopia"))
    {
        // Blue-blind: Avoid blue, use reds and greens
        return FLinearColor(
            OriginalColor.R,
            OriginalColor.G,
            OriginalColor.R * 0.3f + OriginalColor.G * 0.7f,
            OriginalColor.A
        );
    }
    
    // Default: use a color palette that works for most types
    // Blue/orange is generally safe for most color blindness types
    FLinearColor safeColor = OriginalColor;
    
    // Push colors towards a safer blue/orange palette
    // This is a simplified approach
    if (safeColor.R > 0.5f && safeColor.G > 0.5f && safeColor.B < 0.5f)
    {
        // Yellow-like colors become more orange
        safeColor.G *= 0.8f;
    }
    else if (safeColor.R < 0.5f && safeColor.G > 0.5f)
    {
        // Green-like colors become more blue-green
        safeColor.B += 0.3f;
    }
    
    return safeColor;
}
