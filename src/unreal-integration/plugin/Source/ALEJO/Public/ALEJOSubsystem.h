// Copyright ALEJO Team. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "IWebSocket.h"
#include "Dom/JsonObject.h"
#include "Delegates/DelegateCombinations.h"
#include "ALEJOSubsystem.generated.h"

// Forward declarations
class UALEJOAccessibilitySettings;

// Delegates for callback events
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FALEJOTextProcessedDelegate, const FString&, Response);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FALEJOVoiceProcessedDelegate, const FString&, Response);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FALEJOEventDelegate, const FString&, EventType, const FString&, EventData);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FALEJOResourceModeChangedDelegate, const FString&, NewMode);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FALEJOConnectedDelegate);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FALEJODisconnectedDelegate);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FALEJOErrorDelegate, const FString&, ErrorMessage);

/**
 * Game instance subsystem for ALEJO integration with Unreal Engine
 * Handles WebSocket communication with the ALEJO Node.js bridge
 */
UCLASS()
class ALEJO_API UALEJOSubsystem : public UGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	// Begin USubsystem
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;
	virtual void Deinitialize() override;
	// End USubsystem

	/** Connect to the ALEJO bridge server */
	UFUNCTION(BlueprintCallable, Category = "ALEJO")
	void Connect(const FString& ServerURL = TEXT("ws://localhost:3030"));

	/** Disconnect from the ALEJO bridge server */
	UFUNCTION(BlueprintCallable, Category = "ALEJO")
	void Disconnect();

	/** Check if connected to ALEJO bridge server */
	UFUNCTION(BlueprintPure, Category = "ALEJO")
	bool IsConnected() const;

	/** Process text input and get response from ALEJO */
	UFUNCTION(BlueprintCallable, Category = "ALEJO|Text")
	void ProcessText(const FString& Text, const TMap<FString, FString>& Context);

	/** Process voice command and get response from ALEJO */
	UFUNCTION(BlueprintCallable, Category = "ALEJO|Voice")
	void ProcessVoiceCommand(const FString& Command, const TMap<FString, FString>& Context);

	/** Update accessibility settings in ALEJO */
	UFUNCTION(BlueprintCallable, Category = "ALEJO|Accessibility")
	void UpdateAccessibilitySettings(const UALEJOAccessibilitySettings* Settings);

	/** Send custom event to ALEJO */
	UFUNCTION(BlueprintCallable, Category = "ALEJO|Events")
	void SendCustomEvent(const FString& EventType, const FString& EventData);

	/** Delegate for text processing responses */
	UPROPERTY(BlueprintAssignable, Category = "ALEJO|Delegates")
	FALEJOTextProcessedDelegate OnTextProcessed;

	/** Delegate for voice processing responses */
	UPROPERTY(BlueprintAssignable, Category = "ALEJO|Delegates")
	FALEJOVoiceProcessedDelegate OnVoiceProcessed;

	/** Delegate for ALEJO events */
	UPROPERTY(BlueprintAssignable, Category = "ALEJO|Delegates")
	FALEJOEventDelegate OnALEJOEvent;

	/** Delegate for resource mode changes */
	UPROPERTY(BlueprintAssignable, Category = "ALEJO|Delegates")
	FALEJOResourceModeChangedDelegate OnResourceModeChanged;

	/** Delegate for successful connection to ALEJO bridge */
	UPROPERTY(BlueprintAssignable, Category = "ALEJO|Delegates")
	FALEJOConnectedDelegate OnConnected;

	/** Delegate for disconnection from ALEJO bridge */
	UPROPERTY(BlueprintAssignable, Category = "ALEJO|Delegates")
	FALEJODisconnectedDelegate OnDisconnected;

	/** Delegate for errors in ALEJO communication */
	UPROPERTY(BlueprintAssignable, Category = "ALEJO|Delegates")
	FALEJOErrorDelegate OnError;

private:
	/** WebSocket instance for communication with ALEJO bridge */
	TSharedPtr<IWebSocket> WebSocket;

	/** Connect to the WebSocket server */
	void ConnectToWebSocket(const FString& ServerURL);

	/** Handle incoming WebSocket messages */
	void HandleWebSocketMessage(const FString& MessageString);

	/** Parse JSON message */
	TSharedPtr<FJsonObject> ParseJSON(const FString& JSONString);

	/** Convert TMap to JSON string */
	FString MapToJSONString(const TMap<FString, FString>& Map);

	/** Log debug messages */
	void LogDebug(const FString& Message);
};
