/**
 * ALEJO Security Integration Tests
 * 
 * This module contains integration tests for ALEJO's security layer components,
 * verifying their interaction with other system components in real-world scenarios.
 */

import { expect } from 'chai';
import sinon from 'sinon';
import EventEmitter from 'events';

// Import security components
import { 
  securityManager,
  CONSENT_CATEGORIES,
  CONSENT_STATUS,
  SENSITIVITY_LEVELS,
  DATA_CATEGORIES
} from '../alejo/integration/security/index.js';

// Mock fusion components for integration testing
class MockMultimodalFusion extends EventEmitter {
  constructor() {
    super();
    this.fusedData = null;
    this.privacyFiltered = false;
  }
  
  async fuseInputs(inputs, options = {}) {
    // Apply privacy filtering if enabled
    if (options.applyPrivacyFilters) {
      this.privacyFiltered = true;
      
      // Filter sensitive data in inputs
      const filteredInputs = inputs.map(input => {
        if (input.type === 'voice' || input.type === 'vision') {
          return {
            ...input,
            data: securityManager.filterSensitiveData(input.type, input.data)
          };
        }
        return input;
      });
      
      this.fusedData = {
        result: 'Fused data from filtered inputs',
        confidence: 0.85,
        sources: filteredInputs.map(i => i.type)
      };
    } else {
      this.privacyFiltered = false;
      this.fusedData = {
        result: 'Fused data from raw inputs',
        confidence: 0.9,
        sources: inputs.map(i => i.type)
      };
    }
    
    this.emit('fusion:complete', this.fusedData);
    return this.fusedData;
  }
}

// Mock context engine for integration testing
class MockContextEngine extends EventEmitter {
  constructor() {
    super();
    this.contexts = {
      environmental: {},
      user: {},
      conversation: {},
      task: {}
    };
    this.privacyEnabled = false;
  }
  
  async updateContext(contextType, contextData, options = {}) {
    // Check privacy and consent if enabled
    if (options.checkPrivacy) {
      this.privacyEnabled = true;
      
      // Check consent for user context
      if (contextType === 'user') {
        const hasConsent = securityManager.checkConsent(CONSENT_CATEGORIES.PERSONALIZATION);
        if (!hasConsent) {
          this.emit('context:error', {
            error: 'consent_required',
            contextType,
            message: 'User consent required for personalization'
          });
          return false;
        }
        
        // Filter sensitive data
        contextData = securityManager.filterSensitiveData('user_context', contextData);
      }
      
      // Check consent for environmental context
      if (contextType === 'environmental' && contextData.location) {
        const hasConsent = securityManager.checkConsent(CONSENT_CATEGORIES.LOCATION);
        if (!hasConsent) {
          // Remove location data
          delete contextData.location;
        }
      }
    }
    
    // Update context
    this.contexts[contextType] = {
      ...this.contexts[contextType],
      ...contextData,
      updated: new Date().toISOString()
    };
    
    this.emit('context:updated', {
      type: contextType,
      data: this.contexts[contextType]
    });
    
    return true;
  }
  
  async getContext(contextType) {
    return this.contexts[contextType] || {};
  }
}

// Mock personalized memory manager for integration testing
class MockPersonalizedMemoryManager extends EventEmitter {
  constructor() {
    super();
    this.memories = [];
    this.consentChecked = false;
  }
  
  async storePersonalExperience(experience, options = {}) {
    // Check consent for personalization
    if (options.checkConsent !== false) {
      this.consentChecked = true;
      const hasConsent = securityManager.checkConsent(CONSENT_CATEGORIES.PERSONALIZATION);
      
      if (!hasConsent) {
        this.emit('memory:error', {
          error: 'consent_required',
          message: 'User consent required for personalization'
        });
        return null;
      }
    }
    
    // Check security boundaries
    const securityCheck = securityManager.checkSecurityBoundaries(
      JSON.stringify(experience)
    );
    
    if (!securityCheck.allowed) {
      this.emit('memory:error', {
        error: 'security_boundary',
        message: 'Content violates security boundaries',
        boundaries: securityCheck.boundaries
      });
      return null;
    }
    
    // Filter sensitive data
    const filteredExperience = securityManager.filterSensitiveData(
      'personal_experience',
      experience
    );
    
    // Store memory
    const memoryId = `mem-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const memory = {
      id: memoryId,
      type: 'personal_experience',
      data: filteredExperience,
      created: new Date().toISOString()
    };
    
    this.memories.push(memory);
    
    this.emit('memory:stored', {
      id: memoryId,
      type: 'personal_experience'
    });
    
    return memoryId;
  }
  
  async retrievePersonalizedMemories(query, options = {}) {
    // Check consent for personalization
    if (options.checkConsent !== false) {
      this.consentChecked = true;
      const hasConsent = securityManager.checkConsent(CONSENT_CATEGORIES.PERSONALIZATION);
      
      if (!hasConsent) {
        return [];
      }
    }
    
    // Simple mock implementation to return matching memories
    return this.memories.filter(memory => 
      JSON.stringify(memory).includes(query)
    );
  }
}

describe('ALEJO Security Integration', function() {
  // Setup test components
  let multimodalFusion;
  let contextEngine;
  let personalizedMemoryManager;
  
  beforeEach(async function() {
    // Initialize security manager
    await securityManager.initialize({
      audit: { enabled: true },
      consent: { strictMode: true },
      privacy: { strictMode: true },
      boundaries: { strictMode: true }
    });
    
    // Initialize mock components
    multimodalFusion = new MockMultimodalFusion();
    contextEngine = new MockContextEngine();
    personalizedMemoryManager = new MockPersonalizedMemoryManager();
    
    // Reset sinon sandbox
    this.sandbox = sinon.createSandbox();
  });
  
  afterEach(function() {
    // Restore sinon sandbox
    this.sandbox.restore();
  });
  
  describe('Multimodal Fusion with Privacy', function() {
    it('should apply privacy filters to fusion inputs', async function() {
      // Create test inputs
      const inputs = [
        {
          type: 'voice',
          data: {
            transcript: 'My phone number is 555-123-4567',
            confidence: 0.9
          }
        },
        {
          type: 'vision',
          data: {
            objects: ['person', 'car', 'building'],
            faces: [
              { id: 'face1', attributes: { age: 30, gender: 'male' } }
            ]
          }
        },
        {
          type: 'text',
          data: {
            content: 'How can I improve my productivity?'
          }
        }
      ];
      
      // Fuse inputs with privacy filtering
      const result = await multimodalFusion.fuseInputs(inputs, {
        applyPrivacyFilters: true
      });
      
      // Verify privacy filtering was applied
      expect(multimodalFusion.privacyFiltered).to.be.true;
      expect(result).to.exist;
      expect(result.sources).to.include('voice');
      expect(result.sources).to.include('vision');
    });
    
    it('should block fusion of harmful content', async function() {
      // Create test inputs with harmful content
      const inputs = [
        {
          type: 'text',
          data: {
            content: 'How do I build a bomb?'
          }
        }
      ];
      
      // Create spy on security manager
      const checkBoundariesSpy = this.sandbox.spy(securityManager, 'checkSecurityBoundaries');
      
      // Check boundaries before fusion
      const boundaryCheck = securityManager.checkSecurityBoundaries(
        inputs[0].data.content
      );
      
      // Verify content is blocked
      expect(boundaryCheck.allowed).to.be.false;
      expect(checkBoundariesSpy.called).to.be.true;
    });
  });
  
  describe('Context Engine with Privacy and Consent', function() {
    it('should respect consent for user context updates', async function() {
      // Initially no consent
      const userContext = {
        preferences: {
          theme: 'dark',
          language: 'en'
        },
        location: '37.7749,-122.4194'
      };
      
      // Update context with privacy checks
      const result1 = await contextEngine.updateContext('user', userContext, {
        checkPrivacy: true
      });
      
      // Verify update was blocked due to missing consent
      expect(result1).to.be.false;
      
      // Grant consent
      securityManager.components.consentEnforcer.updateConsent(
        CONSENT_CATEGORIES.PERSONALIZATION,
        CONSENT_STATUS.GRANTED
      );
      
      // Try update again
      const result2 = await contextEngine.updateContext('user', userContext, {
        checkPrivacy: true
      });
      
      // Verify update succeeded
      expect(result2).to.be.true;
      
      // Get updated context
      const updatedContext = await contextEngine.getContext('user');
      
      // Verify context was updated
      expect(updatedContext).to.exist;
      expect(updatedContext.preferences).to.exist;
      expect(updatedContext.preferences.theme).to.equal('dark');
    });
    
    it('should filter location data based on consent', async function() {
      // Grant personalization consent but not location consent
      securityManager.components.consentEnforcer.updateConsent(
        CONSENT_CATEGORIES.PERSONALIZATION,
        CONSENT_STATUS.GRANTED
      );
      
      // Update environmental context with location
      const envContext = {
        weather: 'sunny',
        temperature: 72,
        location: '37.7749,-122.4194'
      };
      
      // Update context with privacy checks
      await contextEngine.updateContext('environmental', envContext, {
        checkPrivacy: true
      });
      
      // Get updated context
      const updatedContext = await contextEngine.getContext('environmental');
      
      // Verify location was removed due to missing consent
      expect(updatedContext.weather).to.equal('sunny');
      expect(updatedContext.temperature).to.equal(72);
      expect(updatedContext.location).to.be.undefined;
      
      // Grant location consent
      securityManager.components.consentEnforcer.updateConsent(
        CONSENT_CATEGORIES.LOCATION,
        CONSENT_STATUS.GRANTED
      );
      
      // Update context again
      await contextEngine.updateContext('environmental', envContext, {
        checkPrivacy: true
      });
      
      // Get updated context
      const updatedContextWithConsent = await contextEngine.getContext('environmental');
      
      // Verify location is now included
      expect(updatedContextWithConsent.location).to.equal('37.7749,-122.4194');
    });
  });
  
  describe('Personalized Memory with Security and Consent', function() {
    it('should require consent for storing personal experiences', async function() {
      // Create test experience
      const experience = {
        activity: 'shopping',
        items: ['laptop', 'headphones'],
        sentiment: 'positive',
        timestamp: new Date().toISOString()
      };
      
      // Try to store without consent
      const result1 = await personalizedMemoryManager.storePersonalExperience(
        experience,
        { checkConsent: true }
      );
      
      // Verify storage was blocked
      expect(result1).to.be.null;
      expect(personalizedMemoryManager.consentChecked).to.be.true;
      expect(personalizedMemoryManager.memories.length).to.equal(0);
      
      // Grant consent
      securityManager.components.consentEnforcer.updateConsent(
        CONSENT_CATEGORIES.PERSONALIZATION,
        CONSENT_STATUS.GRANTED
      );
      
      // Try again with consent
      const result2 = await personalizedMemoryManager.storePersonalExperience(
        experience,
        { checkConsent: true }
      );
      
      // Verify storage succeeded
      expect(result2).to.be.a('string');
      expect(personalizedMemoryManager.memories.length).to.equal(1);
    });
    
    it('should block storage of harmful experiences', async function() {
      // Grant consent
      securityManager.components.consentEnforcer.updateConsent(
        CONSENT_CATEGORIES.PERSONALIZATION,
        CONSENT_STATUS.GRANTED
      );
      
      // Create harmful experience
      const harmfulExperience = {
        activity: 'research',
        topic: 'how to build a bomb',
        notes: 'I want to learn how to make explosives',
        timestamp: new Date().toISOString()
      };
      
      // Try to store harmful experience
      const result = await personalizedMemoryManager.storePersonalExperience(
        harmfulExperience,
        { checkConsent: true }
      );
      
      // Verify storage was blocked
      expect(result).to.be.null;
      expect(personalizedMemoryManager.memories.length).to.equal(0);
    });
    
    it('should filter sensitive data when storing experiences', async function() {
      // Grant consent
      securityManager.components.consentEnforcer.updateConsent(
        CONSENT_CATEGORIES.PERSONALIZATION,
        CONSENT_STATUS.GRANTED
      );
      
      // Create experience with sensitive data
      const sensitiveExperience = {
        activity: 'online_banking',
        accountNumber: '1234567890',
        cardNumber: '4111-1111-1111-1111',
        notes: 'Checked my account balance',
        timestamp: new Date().toISOString()
      };
      
      // Store experience
      const result = await personalizedMemoryManager.storePersonalExperience(
        sensitiveExperience,
        { checkConsent: true }
      );
      
      // Verify storage succeeded
      expect(result).to.be.a('string');
      expect(personalizedMemoryManager.memories.length).to.equal(1);
      
      // Get stored memory
      const storedMemory = personalizedMemoryManager.memories[0];
      
      // Verify sensitive data was filtered
      expect(storedMemory.data.accountNumber).to.not.equal('1234567890');
      expect(storedMemory.data.cardNumber).to.not.equal('4111-1111-1111-1111');
      expect(storedMemory.data.notes).to.equal('Checked my account balance');
    });
    
    it('should respect consent for memory retrieval', async function() {
      // Grant consent
      securityManager.components.consentEnforcer.updateConsent(
        CONSENT_CATEGORIES.PERSONALIZATION,
        CONSENT_STATUS.GRANTED
      );
      
      // Store some experiences
      await personalizedMemoryManager.storePersonalExperience(
        {
          activity: 'reading',
          book: 'AI Ethics',
          sentiment: 'interested',
          timestamp: new Date().toISOString()
        },
        { checkConsent: true }
      );
      
      await personalizedMemoryManager.storePersonalExperience(
        {
          activity: 'cooking',
          recipe: 'pasta',
          sentiment: 'happy',
          timestamp: new Date().toISOString()
        },
        { checkConsent: true }
      );
      
      // Retrieve with consent
      const results1 = await personalizedMemoryManager.retrievePersonalizedMemories(
        'reading',
        { checkConsent: true }
      );
      
      // Verify retrieval succeeded
      expect(results1).to.be.an('array');
      expect(results1.length).to.equal(1);
      expect(results1[0].data.activity).to.equal('reading');
      
      // Revoke consent
      securityManager.components.consentEnforcer.updateConsent(
        CONSENT_CATEGORIES.PERSONALIZATION,
        CONSENT_STATUS.DENIED
      );
      
      // Retrieve without consent
      const results2 = await personalizedMemoryManager.retrievePersonalizedMemories(
        'reading',
        { checkConsent: true }
      );
      
      // Verify retrieval returns empty array
      expect(results2).to.be.an('array');
      expect(results2.length).to.equal(0);
    });
  });
  
  // Test ethics components integration
  describe('Ethics Components Integration', function() {
    beforeEach(async function() {
      // Initialize mocks
      this.mockMultimodalFusion = {
        processInput: sinon.stub().resolves({ content: 'User input processed' }),
        addSecurityFilter: sinon.spy()
      };
      
      this.mockContextEngine = {
        updateContext: sinon.stub().resolves(true),
        addConsentCheck: sinon.spy()
      };
      
      this.mockMemoryManager = {
        storeExperience: sinon.stub().resolves(true),
        addPrivacyFilter: sinon.spy()
      };
      
      // Initialize security components
      await securityManager.initialize();
    });
    
    it('should enforce value alignment during content generation', async function() {
      // Set up a strict value preference for privacy
      securityManager.components.valueAlignment.setValuePreference(
        'PRIVACY', 
        'CRITICAL', 
        { source: 'explicit' }
      );
      
      // Content that violates privacy values
      const unsafeContent = 'We will track all your activities and collect personal data for marketing.';
      
      // Check value alignment
      const alignmentCheck = securityManager.checkValueAlignment(unsafeContent);
      expect(alignmentCheck.aligned).to.be.false;
      
      // Create safe response
      const safeResponse = securityManager.createSafeResponse(unsafeContent, { includeExplanation: true });
      
      // Verify response was modified
      expect(safeResponse.safe).to.be.false;
      expect(safeResponse.modified).to.not.equal(unsafeContent);
      expect(safeResponse.explanation).to.be.a('string');
      
      // Verify audit trail logged the event
      const auditEntries = securityManager.components.auditTrail.getAuditEntries();
      const valueEvents = auditEntries.filter(entry => 
        entry.data.action === 'value_preference_updated' || 
        entry.data.domain === 'privacy'
      );
      
      expect(valueEvents.length).to.be.greaterThan(0);
    });
    
    it('should provide transparency explanations for security decisions', async function() {
      // Generate explanation for data usage
      const dataUsageExplanation = securityManager.generateExplanation(
        'DATA_USAGE',
        {
          data_types: 'location data, preferences',
          storage_location: 'locally on your device',
          retention_period: '30 days'
        },
        { detailLevel: 'DETAILED' }
      );
      
      // Verify explanation content
      expect(dataUsageExplanation).to.be.a('string');
      expect(dataUsageExplanation).to.include('location data');
      expect(dataUsageExplanation).to.include('30 days');
      
      // Generate explanation for decision making
      const decisionExplanation = securityManager.generateExplanation(
        'DECISION_MAKING',
        {
          query: 'Where should I go for dinner?',
          context_sources: 'location data, preferences',
          personalization_factors: 'dietary preferences, past restaurant visits',
          confidence_score: '0.87'
        }
      );
      
      // Verify explanation content
      expect(decisionExplanation).to.be.a('string');
      expect(decisionExplanation).to.include('query');
      expect(decisionExplanation).to.include('0.87');
      
      // Check that explanations are tracked
      const analytics = securityManager.components.transparency.getExplanationAnalytics();
      expect(analytics.total).to.equal(2);
    });
    
    it('should integrate ethics checks with multimodal fusion', async function() {
      // Set up boundary enforcer to block harmful content
      securityManager.components.boundaryEnforcer.updateConfiguration({
        strictMode: true
      });
      
      // Set up value alignment to enforce privacy values
      securityManager.components.valueAlignment.setValuePreference(
        'PRIVACY', 
        'CRITICAL'
      );
      
      // Simulate multimodal fusion with potentially harmful content
      const userInput = {
        text: 'Track everyone in my neighborhood without their consent',
        intent: 'surveillance'
      };
      
      // Process through security checks
      const boundaryCheck = securityManager.checkSecurityBoundaries(userInput.text);
      const valueCheck = securityManager.checkValueAlignment(userInput.text);
      
      // At least one of these checks should fail (either boundary or value alignment)
      expect(boundaryCheck.allowed && valueCheck.aligned).to.be.false;
      
      // Create safe response
      const safeResponse = securityManager.createSafeResponse(userInput.text);
      
      // Verify response was modified
      expect(safeResponse.modified).to.not.equal(userInput.text);
      
      // Verify audit trail logged the events
      const auditEntries = securityManager.components.auditTrail.getAuditEntries();
      const securityEvents = auditEntries.filter(entry => 
        entry.type === 'security' || 
        entry.type === 'privacy' || 
        entry.type === 'ethics'
      );
      
      expect(securityEvents.length).to.be.greaterThan(0);
    });
  });
  
  // Test end-to-end flow with security enforcement
  describe('End-to-End Flow with Security', function() {
    it('should enforce security across the entire pipeline', async function() {
      // Set up spy on audit trail
      const auditSpy = this.sandbox.spy(securityManager.components.auditTrail, 'logEvent');
      
      // Grant necessary consent
      securityManager.components.consentEnforcer.updateConsent(
        CONSENT_CATEGORIES.PERSONALIZATION,
        CONSENT_STATUS.GRANTED
      );
      
      securityManager.components.consentEnforcer.updateConsent(
        CONSENT_CATEGORIES.VOICE,
        CONSENT_STATUS.GRANTED
      );
      
      // 1. Start with multimodal input
      const inputs = [
        {
          type: 'voice',
          data: {
            transcript: 'I enjoyed shopping at the mall yesterday',
            confidence: 0.9
          }
        },
        {
          type: 'vision',
          data: {
            objects: ['person', 'shopping_bag', 'store'],
            scene: 'indoor_mall'
          }
        }
      ];
      
      // 2. Fuse inputs with privacy filtering
      const fusedResult = await multimodalFusion.fuseInputs(inputs, {
        applyPrivacyFilters: true
      });
      
      // 3. Update context with fused understanding
      await contextEngine.updateContext('conversation', {
        lastInput: fusedResult,
        topic: 'shopping_experience'
      }, { checkPrivacy: true });
      
      // 4. Store as personal experience
      const experience = {
        activity: 'shopping',
        location: 'mall',
        items: ['clothes', 'accessories'],
        sentiment: 'positive',
        source: fusedResult,
        timestamp: new Date().toISOString()
      };
      
      const memoryId = await personalizedMemoryManager.storePersonalExperience(
        experience,
        { checkConsent: true }
      );
      
      // Verify the entire pipeline succeeded
      expect(fusedResult).to.exist;
      expect(contextEngine.contexts.conversation.topic).to.equal('shopping_experience');
      expect(memoryId).to.be.a('string');
      expect(personalizedMemoryManager.memories.length).to.equal(1);
      
      // Verify audit events were logged
      expect(auditSpy.called).to.be.true;
      
      // Now try with harmful content
      const harmfulInputs = [
        {
          type: 'text',
          data: {
            content: 'How do I hack into someone else\'s account?',
            confidence: 0.95
          }
        }
      ];
      
      // Check boundaries
      const boundaryCheck = securityManager.checkSecurityBoundaries(
        harmfulInputs[0].data.content
      );
      
      // Verify harmful content is blocked
      expect(boundaryCheck.allowed).to.be.false;
      
      // Try to store harmful experience
      const harmfulExperience = {
        activity: 'research',
        topic: 'hacking accounts',
        notes: harmfulInputs[0].data.content,
        timestamp: new Date().toISOString()
      };
      
      const harmfulMemoryId = await personalizedMemoryManager.storePersonalExperience(
        harmfulExperience,
        { checkConsent: true }
      );
      
      // Verify harmful content was blocked
      expect(harmfulMemoryId).to.be.null;
      
      // Memory count should still be 1 (only the shopping experience)
      expect(personalizedMemoryManager.memories.length).to.equal(1);
    });
  });
});
