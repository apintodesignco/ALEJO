// Copyright ALEJO Team. All Rights Reserved.

#include "ALEJOSubsystem.h"
#include "WebSocketsModule.h"
#include "ALEJOAccessibilitySettings.h"
#include "JsonObjectConverter.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "Dom/JsonValue.h"
#include "Dom/JsonObject.h"

void UALEJOSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Super::Initialize(Collection);
	LogDebug(TEXT("ALEJO Subsystem Initialized"));
	
	// Auto-connect to local ALEJO bridge on startup
	FTimerHandle ConnectTimerHandle;
	GetWorld()->GetTimerManager().SetTimer(
		ConnectTimerHandle, 
		[this]() { Connect(); }, 
		2.0f, // 2 seconds delay to ensure Node.js server is ready
		false
	);
}

void UALEJOSubsystem::Deinitialize()
{
	Disconnect();
	Super::Deinitialize();
	LogDebug(TEXT("ALEJO Subsystem Deinitialized"));
}

void UALEJOSubsystem::Connect(const FString& ServerURL)
{
	// Don't reconnect if already connected
	if (IsConnected())
	{
		LogDebug(TEXT("Already connected to ALEJO bridge"));
		return;
	}
	
	// Ensure WebSockets module is loaded
	if (!FModuleManager::Get().IsModuleLoaded("WebSockets"))
	{
		FModuleManager::Get().LoadModule("WebSockets");
	}
	
	ConnectToWebSocket(ServerURL);
}

void UALEJOSubsystem::Disconnect()
{
	if (WebSocket.IsValid() && WebSocket->IsConnected())
	{
		WebSocket->Close();
		WebSocket = nullptr;
		LogDebug(TEXT("Disconnected from ALEJO bridge"));
	}
}

bool UALEJOSubsystem::IsConnected() const
{
	return WebSocket.IsValid() && WebSocket->IsConnected();
}

void UALEJOSubsystem::ProcessText(const FString& Text, const TMap<FString, FString>& Context)
{
	if (!IsConnected())
	{
		OnError.Broadcast(TEXT("Not connected to ALEJO bridge"));
		return;
	}
	
	// Create JSON message
	TSharedPtr<FJsonObject> MessageObj = MakeShareable(new FJsonObject);
	MessageObj->SetStringField(TEXT("text"), Text);
	
	// Add context if provided
	if (Context.Num() > 0)
	{
		TSharedPtr<FJsonObject> ContextObj = MakeShareable(new FJsonObject);
		for (const TPair<FString, FString>& Pair : Context)
		{
			ContextObj->SetStringField(Pair.Key, Pair.Value);
		}
		MessageObj->SetObjectField(TEXT("context"), ContextObj);
	}
	
	// Convert to string and send
	FString MessageString;
	TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&MessageString);
	FJsonSerializer::Serialize(MessageObj.ToSharedRef(), Writer);
	
	WebSocket->Send(MessageString);
	LogDebug(FString::Printf(TEXT("Text sent to ALEJO: %s"), *Text));
}

void UALEJOSubsystem::ProcessVoiceCommand(const FString& Command, const TMap<FString, FString>& Context)
{
	if (!IsConnected())
	{
		OnError.Broadcast(TEXT("Not connected to ALEJO bridge"));
		return;
	}
	
	// Create JSON message
	TSharedPtr<FJsonObject> MessageObj = MakeShareable(new FJsonObject);
	MessageObj->SetStringField(TEXT("command"), Command);
	
	// Add context if provided
	if (Context.Num() > 0)
	{
		TSharedPtr<FJsonObject> ContextObj = MakeShareable(new FJsonObject);
		for (const TPair<FString, FString>& Pair : Context)
		{
			ContextObj->SetStringField(Pair.Key, Pair.Value);
		}
		MessageObj->SetObjectField(TEXT("context"), ContextObj);
	}
	
	// Convert to string and send
	FString MessageString;
	TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&MessageString);
	FJsonSerializer::Serialize(MessageObj.ToSharedRef(), Writer);
	
	WebSocket->Send(MessageString);
	LogDebug(FString::Printf(TEXT("Voice command sent to ALEJO: %s"), *Command));
}

void UALEJOSubsystem::UpdateAccessibilitySettings(const UALEJOAccessibilitySettings* Settings)
{
	if (!IsConnected() || !Settings)
	{
		OnError.Broadcast(TEXT("Not connected or invalid settings"));
		return;
	}
	
	FString SettingsJson = Settings->ToJsonString();
	WebSocket->Send(SettingsJson);
	LogDebug(TEXT("Accessibility settings updated"));
}

void UALEJOSubsystem::SendCustomEvent(const FString& EventType, const FString& EventData)
{
	if (!IsConnected())
	{
		OnError.Broadcast(TEXT("Not connected to ALEJO bridge"));
		return;
	}
	
	// Create JSON message
	TSharedPtr<FJsonObject> MessageObj = MakeShareable(new FJsonObject);
	MessageObj->SetStringField(TEXT("type"), EventType);
	
	// Try to parse event data as JSON, otherwise treat as string
	TSharedPtr<FJsonObject> DataObj;
	TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(EventData);
	if (FJsonSerializer::Deserialize(Reader, DataObj))
	{
		MessageObj->SetObjectField(TEXT("data"), DataObj);
	}
	else
	{
		MessageObj->SetStringField(TEXT("data"), EventData);
	}
	
	// Convert to string and send
	FString MessageString;
	TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&MessageString);
	FJsonSerializer::Serialize(MessageObj.ToSharedRef(), Writer);
	
	WebSocket->Send(MessageString);
	LogDebug(FString::Printf(TEXT("Custom event sent to ALEJO: %s"), *EventType));
}

void UALEJOSubsystem::ConnectToWebSocket(const FString& ServerURL)
{
	LogDebug(FString::Printf(TEXT("Connecting to ALEJO bridge at: %s"), *ServerURL));
	
	WebSocket = FWebSocketsModule::Get().CreateWebSocket(ServerURL);
	
	// Set up WebSocket callbacks
	WebSocket->OnConnected().AddLambda([this]()
	{
		LogDebug(TEXT("Connected to ALEJO bridge"));
		OnConnected.Broadcast();
	});
	
	WebSocket->OnConnectionError().AddLambda([this](const FString& Error)
	{
		LogDebug(FString::Printf(TEXT("Connection error: %s"), *Error));
		OnError.Broadcast(Error);
	});
	
	WebSocket->OnClosed().AddLambda([this](int32 StatusCode, const FString& Reason, bool bWasClean)
	{
		LogDebug(FString::Printf(TEXT("Connection closed: %s"), *Reason));
		OnDisconnected.Broadcast();
	});
	
	WebSocket->OnMessage().AddLambda([this](const FString& MessageString)
	{
		HandleWebSocketMessage(MessageString);
	});
	
	// Connect to the server
	WebSocket->Connect();
}

void UALEJOSubsystem::HandleWebSocketMessage(const FString& MessageString)
{
	LogDebug(FString::Printf(TEXT("Message received: %s"), *MessageString));
	
	// Parse the JSON message
	TSharedPtr<FJsonObject> JsonObject = ParseJSON(MessageString);
	if (!JsonObject.IsValid())
	{
		OnError.Broadcast(TEXT("Invalid JSON message received"));
		return;
	}
	
	// Handle different message types
	FString EventType;
	if (JsonObject->TryGetStringField(TEXT("type"), EventType))
	{
		// This is an event message
		FString EventData;
		TSharedPtr<FJsonObject> DataObj = JsonObject->GetObjectField(TEXT("data"));
		if (DataObj.IsValid())
		{
			// Convert data object to string
			FString DataString;
			TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&DataString);
			FJsonSerializer::Serialize(DataObj.ToSharedRef(), Writer);
			EventData = DataString;
		}
		else
		{
			// Try to get data as string
			JsonObject->TryGetStringField(TEXT("data"), EventData);
		}
		
		OnALEJOEvent.Broadcast(EventType, EventData);
		
		// Special case for resource mode changes
		if (EventType == TEXT("resource.mode.changed"))
		{
			FString NewMode;
			if (DataObj.IsValid() && DataObj->TryGetStringField(TEXT("mode"), NewMode))
			{
				OnResourceModeChanged.Broadcast(NewMode);
			}
		}
	}
	else if (JsonObject->HasField(TEXT("response")))
	{
		// This is a text processing response
		FString Response;
		JsonObject->TryGetStringField(TEXT("response"), Response);
		OnTextProcessed.Broadcast(Response);
	}
	else if (JsonObject->HasField(TEXT("command")))
	{
		// This is a voice processing response
		FString Response;
		JsonObject->TryGetStringField(TEXT("response"), Response);
		OnVoiceProcessed.Broadcast(Response);
	}
	else if (JsonObject->HasField(TEXT("error")))
	{
		// This is an error message
		FString ErrorMessage;
		JsonObject->TryGetStringField(TEXT("error"), ErrorMessage);
		OnError.Broadcast(ErrorMessage);
	}
}

TSharedPtr<FJsonObject> UALEJOSubsystem::ParseJSON(const FString& JSONString)
{
	TSharedPtr<FJsonObject> JsonObject;
	TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(JSONString);
	if (!FJsonSerializer::Deserialize(Reader, JsonObject))
	{
		return nullptr;
	}
	return JsonObject;
}

FString UALEJOSubsystem::MapToJSONString(const TMap<FString, FString>& Map)
{
	TSharedPtr<FJsonObject> JsonObject = MakeShareable(new FJsonObject);
	for (const TPair<FString, FString>& Pair : Map)
	{
		JsonObject->SetStringField(Pair.Key, Pair.Value);
	}
	
	FString OutputString;
	TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&OutputString);
	FJsonSerializer::Serialize(JsonObject.ToSharedRef(), Writer);
	
	return OutputString;
}

void UALEJOSubsystem::LogDebug(const FString& Message)
{
	UE_LOG(LogTemp, Log, TEXT("[ALEJO] %s"), *Message);
}
