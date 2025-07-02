/**
 * privacy-guard.js
 * Encrypts and decrypts personal data using Web Crypto API.
 */
import { publish } from '../../../core/events.js';

let cryptoKey = null;

export async function initialize(options = {}) {
  if (!cryptoKey) {
    cryptoKey = await window.crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }
  publish('security:privacy-guard:initialized', {});
  return !!cryptoKey;
}

export async function encryptData(rawData) {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(rawData));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    data
  );
  const combined = new Uint8Array(iv.byteLength + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.byteLength);
  return btoa(String.fromCharCode(...combined));
}

export async function decryptData(encryptedBase64) {
  const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    data
  );
  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(decrypted));
}
