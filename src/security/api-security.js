import { encryptPayload } from './crypto';

export class SecureAPI {
  constructor(baseURL) {
    this.baseURL = baseURL;
  }

  async get(endpoint) {
    const response = await fetch(this.baseURL + endpoint, {
      method: 'GET',
      headers: this._getHeaders()
    });
    return this._handleResponse(response);
  }

  async post(endpoint, body) {
    const response = await fetch(this.baseURL + endpoint, {
      method: 'POST',
      headers: this._getHeaders(),
      body: encryptPayload(JSON.stringify(body))
    });
    return this._handleResponse(response);
  }

  _getHeaders() {
    return {
      'Content-Type': 'application/encrypted-json',
      'Authorization': `Bearer ${this._getAuthToken()}`
    };
  }

  _getAuthToken() {
    // Implementation from secure vault
  }

  async _handleResponse(response) {
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }
    return response.json();
  }
}
