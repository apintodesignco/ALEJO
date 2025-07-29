import { UnrealEngineBridge } from '@unrealjs/web-integration';

class UnrealUI {
  constructor() {
    this.bridge = new UnrealEngineBridge();
    this.isConnected = false;
  }

  async connect() {
    try {
      await this.bridge.connect();
      this.isConnected = true;
      console.log('Connected to Unreal Engine');
      return true;
    } catch (error) {
      console.error('Failed to connect to Unreal Engine:', error);
      this.isConnected = false;
      return false;
    }
  }

  renderScene(sceneData) {
    if (!this.isConnected) {
      console.warn('Not connected to Unreal Engine');
      return false;
    }
    
    try {
      this.bridge.sendCommand('RENDER_SCENE', sceneData);
      return true;
    } catch (error) {
      console.error('Failed to render scene:', error);
      return false;
    }
  }

  updateCamera(cameraSettings) {
    if (!this.isConnected) {
      console.warn('Not connected to Unreal Engine');
      return false;
    }
    
    try {
      this.bridge.sendCommand('UPDATE_CAMERA', cameraSettings);
      return true;
    } catch (error) {
      console.error('Failed to update camera:', error);
      return false;
    }
  }

  loadAsset(assetPath) {
    if (!this.isConnected) {
      console.warn('Not connected to Unreal Engine');
      return false;
    }
    
    try {
      this.bridge.sendCommand('LOAD_ASSET', { assetPath });
      return true;
    } catch (error) {
      console.error('Failed to load asset:', error);
      return false;
    }
  }

  // Add more methods as needed for UI interactions
}

// Singleton instance
export const unrealUI = new UnrealUI();
