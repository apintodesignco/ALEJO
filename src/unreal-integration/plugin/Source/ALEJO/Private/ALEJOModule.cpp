// Copyright ALEJO Team. All Rights Reserved.

#include "ALEJOModule.h"
#include "Misc/MessageDialog.h"
#include "Modules/ModuleManager.h"
#include "ALEJOSubsystem.h"

#define LOCTEXT_NAMESPACE "FALEJOModule"

void FALEJOModule::StartupModule()
{
	// This code will execute after your module is loaded into memory; the exact timing is specified in the .uplugin file per-module
	UE_LOG(LogTemp, Log, TEXT("ALEJO Module Started"));
}

void FALEJOModule::ShutdownModule()
{
	// This function may be called during shutdown to clean up your module.
	// For modules that support dynamic reloading, we call this function before unloading the module.
	UE_LOG(LogTemp, Log, TEXT("ALEJO Module Shutdown"));
}

#undef LOCTEXT_NAMESPACE
	
IMPLEMENT_MODULE(FALEJOModule, ALEJO)
