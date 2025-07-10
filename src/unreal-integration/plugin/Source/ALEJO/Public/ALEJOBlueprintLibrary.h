// Copyright ALEJO Team. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "ALEJOAccessibilitySettings.h"
#include "ALEJOBlueprintLibrary.generated.h"

/**
 * Blueprint function library for ALEJO integration
 * Makes ALEJO functionality easily accessible from Blueprint visual scripting
 */
UCLASS()
class ALEJO_API UALEJOBlueprintLibrary : public UBlueprintFunctionLibrary
{
	GENERATED_BODY()

public:
	/** Create a new ALEJO accessibility settings object with default settings */
	UFUNCTION(BlueprintCallable, Category = "ALEJO|Accessibility")
	static UALEJOAccessibilitySettings* CreateAccessibilitySettings();
	
	/** Process text input through ALEJO */
	UFUNCTION(BlueprintCallable, Category = "ALEJO|Text", meta = (WorldContext = "WorldContextObject"))
	static void ProcessTextInput(UObject* WorldContextObject, const FString& TextInput, const TMap<FString, FString>& Context);
	
	/** Process voice command through ALEJO */
	UFUNCTION(BlueprintCallable, Category = "ALEJO|Voice", meta = (WorldContext = "WorldContextObject"))
	static void ProcessVoiceCommand(UObject* WorldContextObject, const FString& VoiceCommand, const TMap<FString, FString>& Context);
	
	/** Update accessibility settings in ALEJO */
	UFUNCTION(BlueprintCallable, Category = "ALEJO|Accessibility", meta = (WorldContext = "WorldContextObject"))
	static void UpdateAccessibilitySettings(UObject* WorldContextObject, UALEJOAccessibilitySettings* Settings);
	
	/** Send custom event to ALEJO */
	UFUNCTION(BlueprintCallable, Category = "ALEJO|Events", meta = (WorldContext = "WorldContextObject"))
	static void SendCustomEvent(UObject* WorldContextObject, const FString& EventType, const FString& EventData);
	
	/** Check if connected to ALEJO bridge */
	UFUNCTION(BlueprintPure, Category = "ALEJO", meta = (WorldContext = "WorldContextObject"))
	static bool IsConnectedToALEJO(UObject* WorldContextObject);
	
	/** Connect to ALEJO bridge */
	UFUNCTION(BlueprintCallable, Category = "ALEJO", meta = (WorldContext = "WorldContextObject"))
	static void ConnectToALEJO(UObject* WorldContextObject, const FString& ServerURL = TEXT("ws://localhost:3030"));
	
	/** Disconnect from ALEJO bridge */
	UFUNCTION(BlueprintCallable, Category = "ALEJO", meta = (WorldContext = "WorldContextObject"))
	static void DisconnectFromALEJO(UObject* WorldContextObject);

	/** Helper to get the ALEJO subsystem */
	static class UALEJOSubsystem* GetALEJOSubsystem(UObject* WorldContextObject);
};
