import { SecureAPI } from '../../security/api-security';

export class DisneyIntegration {
  constructor() {
    this.api = new SecureAPI('https://api.disney.com');
    this.rideControlEndpoint = '/v1/rides';
    this.guestManagementEndpoint = '/v1/guests';
  }

  async controlRide(rideId, action) {
    return this.api.post(`${this.rideControlEndpoint}/${rideId}/actions`, { action });
  }

  async getGuestPreferences(guestId) {
    return this.api.get(`${this.guestManagementEndpoint}/${guestId}/preferences`);
  }

  async updateGuestExperience(guestId, experience) {
    return this.api.patch(`${this.guestManagementEndpoint}/${guestId}`, { experience });
  }
}
