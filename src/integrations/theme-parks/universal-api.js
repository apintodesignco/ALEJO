import { SecureAPI } from '../../security/api-security';

export class UniversalIntegration {
  constructor() {
    this.api = new SecureAPI('https://api.universalstudios.com');
    this.virtualQueueEndpoint = '/queue/v2';
    this.characterInteractionEndpoint = '/interactions';
  }

  async joinVirtualQueue(guestId, attractionId) {
    return this.api.post(`${this.virtualQueueEndpoint}/join`, { guestId, attractionId });
  }

  async scheduleCharacterInteraction(guestId, characterId, timeSlot) {
    return this.api.post(`${this.characterInteractionEndpoint}/schedule`, { 
      guestId, 
      characterId, 
      timeSlot 
    });
  }
}
