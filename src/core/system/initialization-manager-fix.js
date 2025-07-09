// Export utility functions for initialization status and component access
export function getInitializationStatus() {
  return {
    isInitializing: initState.isInitializing,
    startTime: initState.startTime,
    endTime: initState.endTime,
    completedComponents: [...initState.completedComponents],
    failedComponents: [...initState.failedComponents],
    pendingComponents: [...initState.pendingComponents]
  };
}

export function getRegisteredComponents() {
  return Array.from(componentRegistry.values());
}

export function getInitializedComponent(id) {
  const component = componentRegistry.get(id);
  return component && component.instance;
}
