/**
 * Behavior Module Security Integration Tests
 * 
 * This test suite validates the integration between ALEJO's behavior personalization
 * components and security systems, particularly:
 * - RBAC (Role-Based Access Control)
 * - Audit Trail
 * - Privacy Guard
 * - Consent Management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as behaviorModule from '../../../src/personalization/behavior/index.js';
import { auditTrail } from '../../../src/security/audit-trail.js';
import { privacyGuard } from '../../../src/security/privacy-guard.js';
import { consentManager } from '../../../src/security/consent-manager.js';
import { rbac } from '../../../src/security/rbac.js';
import { eventBus } from '../../../src/core/event-bus.js';

// Mock dependencies
vi.mock('../../../src/security/audit-trail.js', () => ({
  auditTrail: {
    log: vi.fn(),
    getLogs: vi.fn().mockResolvedValue([])
  }
}));

vi.mock('../../../src/security/privacy-guard.js', () => ({
  privacyGuard: {
    encryptData: vi.fn(data => `encrypted:${JSON.stringify(data)}`),
    decryptData: vi.fn(data => {
      const encryptedStr = String(data);
      if (encryptedStr.startsWith('encrypted:')) {
        return JSON.parse(encryptedStr.substring(10));
      }
      return data;
    }),
    sanitizeData: vi.fn(data => data),
    isDataAllowed: vi.fn().mockReturnValue(true),
    applyDataRetentionPolicy: vi.fn()
  }
}));

vi.mock('../../../src/security/consent-manager.js', () => ({
  consentManager: {
    hasConsent: vi.fn().mockReturnValue(true),
    requestConsent: vi.fn().mockResolvedValue(true),
    revokeConsent: vi.fn().mockResolvedValue(true),
    getConsentStatus: vi.fn().mockReturnValue({
      personalization: true,
      behaviorAnalysis: true,
      preferenceTracking: true
    })
  }
}));

vi.mock('../../../src/security/rbac.js', () => ({
  rbac: {
    hasPermission: vi.fn().mockReturnValue(true),
    getUserRoles: vi.fn().mockReturnValue(['user']),
    checkPermission: vi.fn().mockImplementation((userId, permission) => {
      // Deny specific permissions for testing
      if (permission === 'behavior:reset' && userId === 'restricted-user') {
        return false;
      }
      if (permission === 'preferences:write' && userId === 'read-only-user') {
        return false;
      }
      return true;
    }),
    enforcePermission: vi.fn().mockImplementation((userId, permission) => {
      if (!rbac.checkPermission(userId, permission)) {
        throw new Error(`Permission denied: ${permission}`);
      }
    })
  }
}));

vi.mock('../../../src/core/event-bus.js', () => ({
  eventBus: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn()
  }
}));

// Mock behavior module components
vi.mock('../../../src/personalization/behavior/pattern-learner.js', () => ({
  initialize: vi.fn().mockResolvedValue(true),
  shutdown: vi.fn().mockResolvedValue(true),
  recordMessage: vi.fn().mockResolvedValue(true),
  getStyleMetrics: vi.fn().mockResolvedValue({
    formality: 0.7,
    verbosity: 0.5,
    emotionality: 0.3,
    complexity: 0.6,
    directness: 0.8,
    politeness: 0.7,
    humor: 0.4,
    questionFrequency: 0.2
  }),
  resetPatterns: vi.fn().mockResolvedValue(true)
}));

vi.mock('../../../src/personalization/behavior/adaptor.js', () => ({
  initialize: vi.fn().mockResolvedValue(true),
  shutdown: vi.fn().mockResolvedValue(true),
  adaptResponse: vi.fn().mockImplementation((userId, response) => {
    return Promise.resolve(`[Adapted for ${userId}] ${response}`);
  })
}));

vi.mock('../../../src/personalization/behavior/preference-model.js', () => ({
  initialize: vi.fn().mockResolvedValue(true),
  shutdown: vi.fn().mockResolvedValue(true),
  detectPreferencesFromMessage: vi.fn().mockResolvedValue(true),
  getPreferenceModel: vi.fn().mockResolvedValue({
    preferences: {
      'content:news': { value: 'technology', confidence: 0.8 },
      'interface:theme': { value: 'dark', confidence: 0.9 }
    }
  }),
  setPreference: vi.fn().mockResolvedValue(true),
  getPreference: vi.fn().mockImplementation((userId, key, defaultValue) => {
    const mockPreferences = {
      'content:news': 'technology',
      'interface:theme': 'dark'
    };
    return Promise.resolve(mockPreferences[key] || defaultValue);
  })
}));

describe('Behavior Module Security Integration', () => {
  const regularUserId = 'regular-user-123';
  const restrictedUserId = 'restricted-user';
  const readOnlyUserId = 'read-only-user';
  
  beforeEach(async () => {
    vi.clearAllMocks();
    await behaviorModule.initialize();
  });
  
  afterEach(async () => {
    await behaviorModule.shutdown();
  });
  
  describe('RBAC Integration', () => {
    it('should allow pattern reset for users with proper permissions', async () => {
      // Regular user should have permission
      const result = await behaviorModule.resetPatterns(regularUserId);
      
      expect(result).toBe(true);
      expect(rbac.checkPermission).toHaveBeenCalledWith(regularUserId, 'behavior:reset');
    });
    
    it('should deny pattern reset for users without proper permissions', async () => {
      // Mock RBAC to deny permission for restricted user
      rbac.checkPermission.mockImplementationOnce((userId, permission) => {
        return !(userId === restrictedUserId && permission === 'behavior:reset');
      });
      
      await expect(behaviorModule.resetPatterns(restrictedUserId))
        .rejects.toThrow('Permission denied');
      
      expect(rbac.checkPermission).toHaveBeenCalledWith(restrictedUserId, 'behavior:reset');
    });
    
    it('should allow preference setting for users with proper permissions', async () => {
      const result = await behaviorModule.setPreference(
        regularUserId,
        'interface:theme',
        'light',
        'INTERFACE'
      );
      
      expect(result).toBe(true);
      expect(rbac.checkPermission).toHaveBeenCalledWith(regularUserId, 'preferences:write');
    });
    
    it('should deny preference setting for users without proper permissions', async () => {
      // Mock RBAC to deny permission for read-only user
      rbac.checkPermission.mockImplementationOnce((userId, permission) => {
        return !(userId === readOnlyUserId && permission === 'preferences:write');
      });
      
      await expect(behaviorModule.setPreference(
        readOnlyUserId,
        'interface:theme',
        'light',
        'INTERFACE'
      )).rejects.toThrow('Permission denied');
      
      expect(rbac.checkPermission).toHaveBeenCalledWith(readOnlyUserId, 'preferences:write');
    });
    
    it('should allow reading preferences regardless of write permissions', async () => {
      // Even read-only users should be able to read preferences
      const preference = await behaviorModule.getPreference(readOnlyUserId, 'interface:theme', 'default');
      
      expect(preference).toBe('dark');
      expect(rbac.checkPermission).toHaveBeenCalledWith(readOnlyUserId, 'preferences:read');
    });
  });
  
  describe('Consent Management Integration', () => {
    it('should check for consent before recording user messages', async () => {
      const message = "This is a test message";
      
      // Mock consent check
      consentManager.hasConsent.mockReturnValueOnce(true);
      
      const result = await behaviorModule.recordUserMessage(regularUserId, message);
      
      expect(result).toBe(true);
      expect(consentManager.hasConsent).toHaveBeenCalledWith(
        regularUserId,
        'behaviorAnalysis'
      );
    });
    
    it('should not record messages if consent is not given', async () => {
      const message = "This message should not be recorded";
      
      // Mock consent check to fail
      consentManager.hasConsent.mockReturnValueOnce(false);
      
      await expect(behaviorModule.recordUserMessage(regularUserId, message))
        .rejects.toThrow('Consent required');
      
      expect(consentManager.hasConsent).toHaveBeenCalledWith(
        regularUserId,
        'behaviorAnalysis'
      );
    });
    
    it('should check for consent before adapting responses', async () => {
      const response = "Original response";
      
      // Mock consent check
      consentManager.hasConsent.mockReturnValueOnce(true);
      
      const adaptedResponse = await behaviorModule.adaptResponse(regularUserId, response);
      
      expect(adaptedResponse).toContain('Adapted for');
      expect(consentManager.hasConsent).toHaveBeenCalledWith(
        regularUserId,
        'personalization'
      );
    });
    
    it('should return original response if consent for personalization is not given', async () => {
      const response = "Original response";
      
      // Mock consent check to fail
      consentManager.hasConsent.mockReturnValueOnce(false);
      
      const adaptedResponse = await behaviorModule.adaptResponse(regularUserId, response);
      
      expect(adaptedResponse).toBe(response); // Should return original
      expect(consentManager.hasConsent).toHaveBeenCalledWith(
        regularUserId,
        'personalization'
      );
    });
  });
  
  describe('Privacy Guard Integration', () => {
    it('should encrypt sensitive user data', async () => {
      const message = "This is a sensitive message";
      
      await behaviorModule.recordUserMessage(regularUserId, message);
      
      // Check that privacy guard was used to encrypt data
      expect(privacyGuard.encryptData).toHaveBeenCalled();
    });
    
    it('should decrypt user data when retrieving preferences', async () => {
      await behaviorModule.getPreferenceModel(regularUserId);
      
      // Check that privacy guard was used to decrypt data
      expect(privacyGuard.decryptData).toHaveBeenCalled();
    });
    
    it('should sanitize data before processing', async () => {
      const message = "Message with potentially unsafe content";
      
      await behaviorModule.recordUserMessage(regularUserId, message);
      
      // Check that privacy guard was used to sanitize data
      expect(privacyGuard.sanitizeData).toHaveBeenCalled();
    });
    
    it('should apply data retention policies', async () => {
      // Trigger a function that would apply retention policies
      await behaviorModule.resetPatterns(regularUserId);
      
      // Check that privacy guard applied retention policies
      expect(privacyGuard.applyDataRetentionPolicy).toHaveBeenCalled();
    });
  });
  
  describe('Audit Trail Integration', () => {
    it('should log initialization events', async () => {
      // Re-initialize to trigger logs
      await behaviorModule.initialize();
      
      // Check that audit trail logged initialization
      expect(auditTrail.log).toHaveBeenCalledWith(
        'behavior_module:initializing',
        expect.any(Object)
      );
      
      expect(auditTrail.log).toHaveBeenCalledWith(
        'behavior_module:initialized',
        expect.any(Object)
      );
    });
    
    it('should log message recording events', async () => {
      const message = "Message for audit testing";
      
      await behaviorModule.recordUserMessage(regularUserId, message);
      
      // Check that audit trail logged message recording
      expect(auditTrail.log).toHaveBeenCalledWith(
        'behavior:message_recorded',
        expect.objectContaining({
          userId: regularUserId
        })
      );
    });
    
    it('should log preference changes', async () => {
      await behaviorModule.setPreference(
        regularUserId,
        'interface:theme',
        'light',
        'INTERFACE'
      );
      
      // Check that audit trail logged preference change
      expect(auditTrail.log).toHaveBeenCalledWith(
        'preferences:set',
        expect.objectContaining({
          userId: regularUserId,
          key: 'interface:theme',
          value: 'light'
        })
      );
    });
    
    it('should log pattern reset events', async () => {
      await behaviorModule.resetPatterns(regularUserId);
      
      // Check that audit trail logged pattern reset
      expect(auditTrail.log).toHaveBeenCalledWith(
        'behavior:patterns_reset',
        expect.objectContaining({
          userId: regularUserId
        })
      );
    });
    
    it('should log security-related errors', async () => {
      // Force a security error
      rbac.checkPermission.mockReturnValueOnce(false);
      
      try {
        await behaviorModule.resetPatterns(regularUserId);
      } catch (error) {
        // Expected error
      }
      
      // Check that audit trail logged security error
      expect(auditTrail.log).toHaveBeenCalledWith(
        'security:permission_denied',
        expect.objectContaining({
          userId: regularUserId,
          permission: 'behavior:reset'
        })
      );
    });
  });
  
  describe('Event Bus Integration', () => {
    it('should emit events when patterns are updated', async () => {
      const message = "Message to update patterns";
      
      await behaviorModule.recordUserMessage(regularUserId, message);
      
      // Check that event bus emitted pattern update event
      expect(eventBus.emit).toHaveBeenCalledWith(
        'behavior:patterns_updated',
        expect.objectContaining({
          userId: regularUserId
        })
      );
    });
    
    it('should emit events when preferences are detected', async () => {
      const message = "Message with preference indicators";
      
      await behaviorModule.recordUserMessage(regularUserId, message);
      
      // Check that event bus emitted preference detection event
      expect(eventBus.emit).toHaveBeenCalledWith(
        'preferences:detected',
        expect.any(Object)
      );
    });
    
    it('should emit events when preferences are explicitly set', async () => {
      await behaviorModule.setPreference(
        regularUserId,
        'interface:theme',
        'light',
        'INTERFACE'
      );
      
      // Check that event bus emitted preference set event
      expect(eventBus.emit).toHaveBeenCalledWith(
        'preferences:set',
        expect.objectContaining({
          userId: regularUserId,
          key: 'interface:theme',
          value: 'light'
        })
      );
    });
    
    it('should emit events when patterns are reset', async () => {
      await behaviorModule.resetPatterns(regularUserId);
      
      // Check that event bus emitted pattern reset event
      expect(eventBus.emit).toHaveBeenCalledWith(
        'behavior:patterns_reset',
        expect.objectContaining({
          userId: regularUserId
        })
      );
    });
  });
});
