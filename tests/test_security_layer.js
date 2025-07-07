/**
 * ALEJO Security Layer Tests
 * 
 * This module contains comprehensive tests for ALEJO's security layer components,
 * including audit trail, consent enforcer, privacy guard, and boundary enforcer.
 */

import { expect } from 'chai';
import sinon from 'sinon';

// Import security components
import { 
  auditTrail, 
  consentEnforcer, 
  privacyGuard, 
  boundaryEnforcer,
  securityManager,
  AUDIT_EVENT_TYPES,
  AUDIT_SEVERITY,
  CONSENT_CATEGORIES,
  CONSENT_STATUS,
  SENSITIVITY_LEVELS,
  DATA_CATEGORIES,
  PRIVACY_OPERATIONS,
  BOUNDARY_CATEGORIES,
  ENFORCEMENT_LEVELS
} from '../alejo/integration/security/index.js';

describe('ALEJO Security Layer', function() {
  // Reset components before each test
  beforeEach(function() {
    // Reset audit trail
    auditTrail.clearAuditTrail();
    auditTrail.updateConfiguration({
      enabled: true,
      retentionLimit: 100,
      persistToStorage: false,
      logToConsole: false
    });
    
    // Reset consent enforcer
    consentEnforcer.resetConsent();
    consentEnforcer.updateConfiguration({
      strictMode: true,
      defaultExpirationDays: 365
    });
    
    // Reset privacy guard
    privacyGuard.updateConfiguration({
      strictMode: true,
      defaultSensitivityLevel: SENSITIVITY_LEVELS.MEDIUM
    });
    
    // Reset boundary enforcer
    boundaryEnforcer.updateConfiguration({
      strictMode: true
    });
    
    // Reset security manager
    securityManager.initialize({
      audit: { enabled: true },
      consent: { strictMode: true },
      privacy: { strictMode: true },
      boundaries: { strictMode: true }
    });
    
    // Reset sinon sandbox
    this.sandbox = sinon.createSandbox();
  });
  
  afterEach(function() {
    // Restore sinon sandbox
    this.sandbox.restore();
  });
  
  describe('Audit Trail', function() {
    it('should log events correctly', function() {
      // Log an event
      const entryId = auditTrail.logEvent('security', {
        action: 'test_action',
        severity: AUDIT_SEVERITY.INFO
      });
      
      // Verify event was logged
      expect(entryId).to.be.a('string');
      
      // Get audit entries
      const entries = auditTrail.getAuditEntries();
      
      // Verify entry exists
      expect(entries).to.be.an('array');
      expect(entries.length).to.be.at.least(1);
      
      // Find our entry
      const entry = entries.find(e => e.id === entryId);
      expect(entry).to.exist;
      expect(entry.type).to.equal('security');
      expect(entry.data.action).to.equal('test_action');
      expect(entry.data.severity).to.equal(AUDIT_SEVERITY.INFO);
    });
    
    it('should filter audit entries correctly', function() {
      // Log multiple events
      auditTrail.logEvent('security', {
        action: 'security_action',
        severity: AUDIT_SEVERITY.WARNING
      });
      
      auditTrail.logEvent('privacy', {
        action: 'privacy_action',
        severity: AUDIT_SEVERITY.ERROR
      });
      
      auditTrail.logEvent('system', {
        action: 'system_action',
        severity: AUDIT_SEVERITY.INFO
      });
      
      // Filter by type
      const securityEntries = auditTrail.getAuditEntries({ type: 'security' });
      expect(securityEntries.length).to.equal(1);
      expect(securityEntries[0].type).to.equal('security');
      
      // Filter by severity
      const errorEntries = auditTrail.getAuditEntries({ severity: AUDIT_SEVERITY.ERROR });
      expect(errorEntries.length).to.equal(1);
      expect(errorEntries[0].data.severity).to.equal(AUDIT_SEVERITY.ERROR);
      
      // Filter by action
      const systemActionEntries = auditTrail.getAuditEntries({ action: 'system_action' });
      expect(systemActionEntries.length).to.equal(1);
      expect(systemActionEntries[0].data.action).to.equal('system_action');
    });
    
    it('should anonymize personal data', function() {
      // Log event with personal data
      const eventData = {
        action: 'user_login',
        severity: AUDIT_SEVERITY.INFO,
        email: 'user@example.com',
        creditCard: '4111-1111-1111-1111',
        ipAddress: '192.168.1.1',
        userId: '12345'
      };
      
      auditTrail.logEvent('user', eventData);
      
      // Get audit entries
      const entries = auditTrail.getAuditEntries();
      const entry = entries[0];
      
      // Verify personal data was anonymized
      expect(entry.data.email).to.not.equal('user@example.com');
      expect(entry.data.email).to.include('[REDACTED');
      expect(entry.data.creditCard).to.not.equal('4111-1111-1111-1111');
      expect(entry.data.creditCard).to.include('[REDACTED');
      expect(entry.data.ipAddress).to.not.equal('192.168.1.1');
      expect(entry.data.ipAddress).to.include('[REDACTED');
      
      // Non-personal data should not be anonymized
      expect(entry.data.userId).to.equal('12345');
      expect(entry.data.action).to.equal('user_login');
    });
    
    it('should respect retention limit', function() {
      // Set small retention limit
      auditTrail.updateConfiguration({ retentionLimit: 3 });
      
      // Log more events than the limit
      for (let i = 0; i < 5; i++) {
        auditTrail.logEvent('system', {
          action: `action_${i}`,
          severity: AUDIT_SEVERITY.INFO
        });
      }
      
      // Verify only the most recent events are retained
      const entries = auditTrail.getAuditEntries();
      expect(entries.length).to.equal(3);
      
      // Verify the oldest events were removed
      const actions = entries.map(e => e.data.action);
      expect(actions).to.include('action_4');
      expect(actions).to.include('action_3');
      expect(actions).to.include('action_2');
      expect(actions).to.not.include('action_1');
      expect(actions).to.not.include('action_0');
    });
  });
  
  describe('Consent Enforcer', function() {
    it('should track consent status correctly', function() {
      // Initially no consent
      expect(consentEnforcer.checkConsent(CONSENT_CATEGORIES.PERSONALIZATION)).to.be.false;
      
      // Grant consent
      consentEnforcer.updateConsent(CONSENT_CATEGORIES.PERSONALIZATION, CONSENT_STATUS.GRANTED);
      
      // Verify consent is granted
      expect(consentEnforcer.checkConsent(CONSENT_CATEGORIES.PERSONALIZATION)).to.be.true;
      
      // Withdraw consent
      consentEnforcer.updateConsent(CONSENT_CATEGORIES.PERSONALIZATION, CONSENT_STATUS.DENIED);
      
      // Verify consent is denied
      expect(consentEnforcer.checkConsent(CONSENT_CATEGORIES.PERSONALIZATION)).to.be.false;
    });
    
    it('should respect consent expiration', function() {
      // Set short expiration
      consentEnforcer.updateConfiguration({ defaultExpirationDays: 0 });
      
      // Grant consent with custom expiration (1 second)
      const now = new Date();
      const expiration = new Date(now.getTime() + 1000); // 1 second in the future
      
      consentEnforcer.updateConsent(
        CONSENT_CATEGORIES.VOICE,
        CONSENT_STATUS.GRANTED,
        { expirationDate: expiration }
      );
      
      // Verify consent is initially granted
      expect(consentEnforcer.checkConsent(CONSENT_CATEGORIES.VOICE)).to.be.true;
      
      // Wait for expiration
      return new Promise(resolve => {
        setTimeout(() => {
          // Verify consent has expired
          expect(consentEnforcer.checkConsent(CONSENT_CATEGORIES.VOICE)).to.be.false;
          resolve();
        }, 1100);
      });
    });
    
    it('should export and import consent data', function() {
      // Grant consent for multiple categories
      consentEnforcer.updateConsent(CONSENT_CATEGORIES.PERSONALIZATION, CONSENT_STATUS.GRANTED);
      consentEnforcer.updateConsent(CONSENT_CATEGORIES.LOCATION, CONSENT_STATUS.GRANTED);
      consentEnforcer.updateConsent(CONSENT_CATEGORIES.BIOMETRIC, CONSENT_STATUS.DENIED);
      
      // Export consent data
      const exportedData = consentEnforcer.exportConsentData();
      
      // Reset consent
      consentEnforcer.resetConsent();
      
      // Verify consent is reset
      expect(consentEnforcer.checkConsent(CONSENT_CATEGORIES.PERSONALIZATION)).to.be.false;
      expect(consentEnforcer.checkConsent(CONSENT_CATEGORIES.LOCATION)).to.be.false;
      
      // Import consent data
      consentEnforcer.importConsentData(exportedData);
      
      // Verify consent is restored
      expect(consentEnforcer.checkConsent(CONSENT_CATEGORIES.PERSONALIZATION)).to.be.true;
      expect(consentEnforcer.checkConsent(CONSENT_CATEGORIES.LOCATION)).to.be.true;
      expect(consentEnforcer.checkConsent(CONSENT_CATEGORIES.BIOMETRIC)).to.be.false;
    });
    
    it('should handle consent for all categories', function() {
      // Grant consent for all categories
      consentEnforcer.updateAllConsent(CONSENT_STATUS.GRANTED);
      
      // Verify all categories have consent
      Object.values(CONSENT_CATEGORIES).forEach(category => {
        expect(consentEnforcer.checkConsent(category)).to.be.true;
      });
      
      // Deny consent for all categories
      consentEnforcer.updateAllConsent(CONSENT_STATUS.DENIED);
      
      // Verify all categories have denied consent
      Object.values(CONSENT_CATEGORIES).forEach(category => {
        expect(consentEnforcer.checkConsent(category)).to.be.false;
      });
    });
  });
  
  describe('Privacy Guard', function() {
    it('should filter sensitive data correctly', function() {
      // Create test data with sensitive information
      const testData = {
        name: 'John Doe',
        email: 'john.doe@example.com',
        address: '123 Main St, Anytown, USA',
        ssn: '123-45-6789',
        notes: 'Customer called about order #12345'
      };
      
      // Filter with default settings
      const filteredData = privacyGuard.filterSensitiveData('user_profile', testData);
      
      // Verify sensitive data is filtered
      expect(filteredData.ssn).to.not.equal('123-45-6789');
      expect(filteredData.email).to.not.equal('john.doe@example.com');
      
      // Non-sensitive data should be preserved
      expect(filteredData.notes).to.equal('Customer called about order #12345');
    });
    
    it('should respect sensitivity levels', function() {
      // Create test data
      const testData = {
        name: 'John Doe',
        email: 'john.doe@example.com',
        phone: '555-123-4567',
        notes: 'Customer called about order #12345'
      };
      
      // Filter with low sensitivity
      privacyGuard.updateConfiguration({ defaultSensitivityLevel: SENSITIVITY_LEVELS.LOW });
      const lowSensitivityData = privacyGuard.filterSensitiveData('user_profile', testData);
      
      // Low sensitivity should preserve most data
      expect(lowSensitivityData.name).to.equal('John Doe');
      expect(lowSensitivityData.email).to.equal('john.doe@example.com');
      
      // Filter with high sensitivity
      privacyGuard.updateConfiguration({ defaultSensitivityLevel: SENSITIVITY_LEVELS.HIGH });
      const highSensitivityData = privacyGuard.filterSensitiveData('user_profile', testData);
      
      // High sensitivity should filter most data
      expect(highSensitivityData.name).to.not.equal('John Doe');
      expect(highSensitivityData.email).to.not.equal('john.doe@example.com');
      expect(highSensitivityData.phone).to.not.equal('555-123-4567');
    });
    
    it('should apply different privacy operations', function() {
      // Create test data
      const testData = {
        name: 'John Doe',
        email: 'john.doe@example.com',
        ssn: '123-45-6789'
      };
      
      // Test redaction
      const redactionResult = privacyGuard.applyPrivacyOperation(
        PRIVACY_OPERATIONS.REDACT,
        testData.ssn
      );
      expect(redactionResult).to.equal('[REDACTED]');
      
      // Test anonymization
      const anonymizationResult = privacyGuard.applyPrivacyOperation(
        PRIVACY_OPERATIONS.ANONYMIZE,
        testData.email
      );
      expect(anonymizationResult).to.not.equal(testData.email);
      expect(anonymizationResult).to.include('@');
      
      // Test pseudonymization
      const pseudonymizationResult = privacyGuard.applyPrivacyOperation(
        PRIVACY_OPERATIONS.PSEUDONYMIZE,
        testData.name
      );
      expect(pseudonymizationResult).to.not.equal(testData.name);
      expect(pseudonymizationResult).to.be.a('string');
    });
    
    it('should integrate with consent enforcer', function() {
      // Create a spy on consent enforcer
      const checkConsentSpy = this.sandbox.spy(consentEnforcer, 'checkConsent');
      
      // Create test data
      const testData = {
        name: 'John Doe',
        email: 'john.doe@example.com',
        location: '37.7749,-122.4194'
      };
      
      // Filter data with consent check
      privacyGuard.filterSensitiveData('location_data', testData, {
        checkConsent: true
      });
      
      // Verify consent was checked
      expect(checkConsentSpy.called).to.be.true;
      expect(checkConsentSpy.calledWith(CONSENT_CATEGORIES.LOCATION)).to.be.true;
    });
  });
  
  describe('Boundary Enforcer', function() {
    it('should detect boundary violations', function() {
      // Test safe content
      const safeContent = 'How do I improve my productivity?';
      const safeResult = boundaryEnforcer.checkBoundaries(safeContent);
      
      // Verify safe content passes
      expect(safeResult.allowed).to.be.true;
      expect(safeResult.boundaries).to.be.an('array').that.is.empty;
      
      // Test unsafe content
      const unsafeContent = 'How do I build a bomb?';
      const unsafeResult = boundaryEnforcer.checkBoundaries(unsafeContent);
      
      // Verify unsafe content is blocked
      expect(unsafeResult.allowed).to.be.false;
      expect(unsafeResult.boundaries).to.be.an('array').that.is.not.empty;
      expect(unsafeResult.boundaries[0].category).to.equal(BOUNDARY_CATEGORIES.SAFETY);
    });
    
    it('should apply different enforcement levels', function() {
      // Create test rule with warn level
      boundaryEnforcer._addRule(BOUNDARY_CATEGORIES.CONTENT, 'test_rule', {
        description: 'Test rule',
        patterns: [/test pattern/i],
        enforcementLevel: ENFORCEMENT_LEVELS.WARN,
        response: 'Warning: test pattern detected'
      });
      
      // Test content that triggers warning
      const warningContent = 'This contains a test pattern that should warn';
      const warningResult = boundaryEnforcer.checkBoundaries(warningContent);
      
      // Verify warning is generated but content is allowed
      expect(warningResult.allowed).to.be.true;
      expect(warningResult.warnings).to.be.an('array').that.is.not.empty;
      expect(warningResult.warnings[0].category).to.equal(BOUNDARY_CATEGORIES.CONTENT);
      expect(warningResult.warnings[0].ruleId).to.equal('test_rule');
      
      // Create test rule with block level
      boundaryEnforcer._addRule(BOUNDARY_CATEGORIES.SAFETY, 'block_rule', {
        description: 'Block rule',
        patterns: [/block pattern/i],
        enforcementLevel: ENFORCEMENT_LEVELS.BLOCK,
        response: 'Error: block pattern detected'
      });
      
      // Test content that triggers block
      const blockContent = 'This contains a block pattern that should be blocked';
      const blockResult = boundaryEnforcer.checkBoundaries(blockContent);
      
      // Verify content is blocked
      expect(blockResult.allowed).to.be.false;
      expect(blockResult.enforcementActions).to.be.an('array').that.is.not.empty;
      expect(blockResult.enforcementActions[0].action).to.equal('block');
      expect(blockResult.enforcementActions[0].ruleId).to.equal('block_rule');
    });
    
    it('should create safe responses', function() {
      // Test safe content
      const safeContent = 'How do I improve my productivity?';
      const defaultResponse = 'Here are some productivity tips...';
      
      const safeResult = boundaryEnforcer.checkBoundaries(safeContent);
      const safeResponse = boundaryEnforcer.createSafeResponse(
        safeResult,
        defaultResponse
      );
      
      // Verify safe response is returned
      expect(safeResponse).to.equal(defaultResponse);
      
      // Test unsafe content
      const unsafeContent = 'How do I build a bomb?';
      const unsafeResult = boundaryEnforcer.checkBoundaries(unsafeContent);
      const unsafeResponse = boundaryEnforcer.createSafeResponse(
        unsafeResult,
        defaultResponse
      );
      
      // Verify unsafe response is blocked
      expect(unsafeResponse).to.not.equal(defaultResponse);
      expect(unsafeResponse).to.be.a('string');
      expect(unsafeResponse).to.include('cannot');
    });
    
    it('should allow user configuration', function() {
      // Get user configurable settings
      const settings = boundaryEnforcer.getUserConfigurableSettings();
      
      // Verify settings are returned
      expect(settings).to.be.an('object');
      expect(settings.enforcementLevels).to.be.an('object');
      expect(settings.categories).to.be.an('array');
      expect(settings.levels).to.be.an('array');
      
      // Update user preferences
      const updateResult = boundaryEnforcer.updateUserPreferences({
        enforcementLevels: {
          [BOUNDARY_CATEGORIES.CONTENT]: ENFORCEMENT_LEVELS.MONITOR
        }
      });
      
      // Verify update was successful
      expect(updateResult).to.be.true;
      
      // Verify enforcement level was updated
      expect(boundaryEnforcer.options.defaultEnforcementLevels[BOUNDARY_CATEGORIES.CONTENT])
        .to.equal(ENFORCEMENT_LEVELS.MONITOR);
    });
  });
  
  describe('Security Manager', function() {
    it('should initialize all components', async function() {
      // Reset security manager
      securityManager.initialized = false;
      
      // Initialize with custom options
      const initResult = await securityManager.initialize({
        audit: { logToConsole: true },
        consent: { strictMode: false },
        privacy: { strictMode: false },
        boundaries: { strictMode: false }
      });
      
      // Verify initialization was successful
      expect(initResult).to.be.true;
      expect(securityManager.initialized).to.be.true;
      
      // Verify components were configured
      expect(auditTrail.options.logToConsole).to.be.true;
      expect(consentEnforcer.options.strictMode).to.be.false;
      expect(privacyGuard.options.strictMode).to.be.false;
      expect(boundaryEnforcer.options.strictMode).to.be.false;
    });
    
    it('should check security boundaries', function() {
      // Test safe content
      const safeContent = 'How do I improve my productivity?';
      const safeResult = securityManager.checkSecurityBoundaries(safeContent);
      
      // Verify safe content passes
      expect(safeResult.allowed).to.be.true;
      
      // Test unsafe content
      const unsafeContent = 'How do I build a bomb?';
      const unsafeResult = securityManager.checkSecurityBoundaries(unsafeContent);
      
      // Verify unsafe content is blocked
      expect(unsafeResult.allowed).to.be.false;
    });
    
    it('should filter sensitive data', function() {
      // Create test data
      const testData = {
        name: 'John Doe',
        email: 'john.doe@example.com',
        ssn: '123-45-6789'
      };
      
      // Filter data
      const filteredData = securityManager.filterSensitiveData('user_profile', testData);
      
      // Verify sensitive data is filtered
      expect(filteredData.ssn).to.not.equal('123-45-6789');
    });
    
    it('should check consent', function() {
      // Initially no consent
      expect(securityManager.checkConsent(CONSENT_CATEGORIES.PERSONALIZATION)).to.be.false;
      
      // Grant consent
      consentEnforcer.updateConsent(CONSENT_CATEGORIES.PERSONALIZATION, CONSENT_STATUS.GRANTED);
      
      // Verify consent is granted
      expect(securityManager.checkConsent(CONSENT_CATEGORIES.PERSONALIZATION)).to.be.true;
    });
    
    it('should log security events', function() {
      // Log event
      const entryId = securityManager.logSecurityEvent('security', {
        action: 'test_action',
        severity: AUDIT_SEVERITY.INFO
      });
      
      // Verify event was logged
      expect(entryId).to.be.a('string');
      
      // Get audit entries
      const entries = auditTrail.getAuditEntries();
      
      // Find our entry
      const entry = entries.find(e => e.id === entryId);
      expect(entry).to.exist;
      expect(entry.type).to.equal('security');
      expect(entry.data.action).to.equal('test_action');
    });
    
    it('should create safe responses', function() {
      // Test safe content
      const safeContent = 'How do I improve my productivity?';
      const defaultResponse = 'Here are some productivity tips...';
      
      const safeResponse = securityManager.createSafeResponse(
        safeContent,
        {},
        defaultResponse
      );
      
      // Verify safe response is returned
      expect(safeResponse).to.equal(defaultResponse);
      
      // Test unsafe content
      const unsafeContent = 'How do I build a bomb?';
      const unsafeResponse = securityManager.createSafeResponse(
        unsafeContent,
        {},
        defaultResponse
      );
      
      // Verify unsafe response is blocked
      expect(unsafeResponse).to.not.equal(defaultResponse);
    });
    
    it('should provide security status', function() {
      // Get security status
      const status = securityManager.getSecurityStatus();
      
      // Verify status is returned
      expect(status).to.be.an('object');
      expect(status.initialized).to.be.true;
      expect(status.auditEnabled).to.be.true;
      expect(status.privacyMode).to.equal('strict');
      expect(status.consentEnforcement).to.equal('strict');
      expect(status.activeBoundaries).to.be.an('array');
    });
  });
});
