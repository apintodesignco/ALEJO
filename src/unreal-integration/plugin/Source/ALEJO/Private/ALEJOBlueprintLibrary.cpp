// Copyright ALEJO Team. All Rights Reserved.

#include "ALEJOBlueprintLibrary.h"
#include "ALEJOSubsystem.h"
#include "Engine/Engine.h"
#include "Kismet/GameplayStatics.h"

UALEJOAccessibilitySettings* UALEJOBlueprintLibrary::CreateAccessibilitySettings()
{
    return NewObject<UALEJOAccessibilitySettings>();
}

void UALEJOBlueprintLibrary::ProcessTextInput(UObject* WorldContextObject, const FString& TextInput, const TMap<FString, FString>& Context)
{
    UALEJOSubsystem* Subsystem = GetALEJOSubsystem(WorldContextObject);
    if (Subsystem)
    {
        Subsystem->ProcessText(TextInput, Context);
    }
    else
    {
        UE_LOG(LogTemp, Warning, TEXT("ALEJO: Cannot process text input, subsystem not found"));
    }
}

void UALEJOBlueprintLibrary::ProcessVoiceCommand(UObject* WorldContextObject, const FString& VoiceCommand, const TMap<FString, FString>& Context)
{
    UALEJOSubsystem* Subsystem = GetALEJOSubsystem(WorldContextObject);
    if (Subsystem)
    {
        Subsystem->ProcessVoiceCommand(VoiceCommand, Context);
    }
    else
    {
        UE_LOG(LogTemp, Warning, TEXT("ALEJO: Cannot process voice command, subsystem not found"));
    }
}

void UALEJOBlueprintLibrary::UpdateAccessibilitySettings(UObject* WorldContextObject, UALEJOAccessibilitySettings* Settings)
{
    if (!Settings)
    {
        UE_LOG(LogTemp, Warning, TEXT("ALEJO: Cannot update accessibility settings, settings object is null"));
        return;
    }

    UALEJOSubsystem* Subsystem = GetALEJOSubsystem(WorldContextObject);
    if (Subsystem)
    {
        Subsystem->UpdateAccessibilitySettings(Settings);
    }
    else
    {
        UE_LOG(LogTemp, Warning, TEXT("ALEJO: Cannot update accessibility settings, subsystem not found"));
    }
}

void UALEJOBlueprintLibrary::SendCustomEvent(UObject* WorldContextObject, const FString& EventType, const FString& EventData)
{
    UALEJOSubsystem* Subsystem = GetALEJOSubsystem(WorldContextObject);
    if (Subsystem)
    {
        Subsystem->SendCustomEvent(EventType, EventData);
    }
    else
    {
        UE_LOG(LogTemp, Warning, TEXT("ALEJO: Cannot send custom event, subsystem not found"));
    }
}

bool UALEJOBlueprintLibrary::IsConnectedToALEJO(UObject* WorldContextObject)
{
    UALEJOSubsystem* Subsystem = GetALEJOSubsystem(WorldContextObject);
    return Subsystem ? Subsystem->IsConnected() : false;
}

void UALEJOBlueprintLibrary::ConnectToALEJO(UObject* WorldContextObject, const FString& ServerURL)
{
    UALEJOSubsystem* Subsystem = GetALEJOSubsystem(WorldContextObject);
    if (Subsystem)
    {
        Subsystem->Connect(ServerURL);
    }
    else
    {
        UE_LOG(LogTemp, Warning, TEXT("ALEJO: Cannot connect, subsystem not found"));
    }
}

void UALEJOBlueprintLibrary::DisconnectFromALEJO(UObject* WorldContextObject)
{
    UALEJOSubsystem* Subsystem = GetALEJOSubsystem(WorldContextObject);
    if (Subsystem)
    {
        Subsystem->Disconnect();
    }
    else
    {
        UE_LOG(LogTemp, Warning, TEXT("ALEJO: Cannot disconnect, subsystem not found"));
    }
}

UALEJOSubsystem* UALEJOBlueprintLibrary::GetALEJOSubsystem(UObject* WorldContextObject)
{
    UWorld* World = GEngine->GetWorldFromContextObject(WorldContextObject, EGetWorldErrorMode::LogAndReturnNull);
    return World ? World->GetGameInstance()->GetSubsystem<UALEJOSubsystem>() : nullptr;
}
