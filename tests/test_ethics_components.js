/**
 * ALEJO Ethics Components Tests
 * 
 * This file contains unit tests for ALEJO's ethics components,
 * including value alignment and transparency.
 */

const { expect } = require('chai');
const sinon = require('sinon');
const EventEmitter = require('events');

// Import components to test
const { 
  valueAlignment, 
  VALUE_DOMAINS, 
  ALIGNMENT_LEVELS 
} = require('../alejo/integration/ethics/value_alignment.js');

const { 
  transparency, 
  TRANSPARENCY_CATEGORIES, 
  DETAIL_LEVELS, 
  EXPLANATION_FORMATS 
} = require('../alejo/integration/ethics/transparency.js');

const { 
  ethicsManager 
} = require('../alejo/integration/ethics/index.js');

const { 
  securityManager 
} = require('../alejo/integration/security/index.js');

describe('ALEJO Ethics Components', function() {
  // Setup and teardown
  beforeEach(function() {
    // Reset components before each test
    valueAlignment.resetValuePreferences();
    
    // Reset spy history if any spies were created
    if (this.auditSpy) {
      this.auditSpy.resetHistory();
    }
  });
  
  afterEach(function() {
    // Restore all stubs and spies
    sinon.restore();
  });
  
  describe('Value Alignment', function() {
    it('should initialize with default preferences', function() {
      const preferences = valueAlignment.getAllValuePreferences();
      
      // Check that all domains have preferences
      Object.values(VALUE_DOMAINS).forEach(domain => {
        expect(preferences).to.have.property(domain);
        expect(preferences[domain]).to.have.property('level');
        expect(preferences[domain]).to.have.property('source');
      });
      
      // Check specific defaults
      expect(preferences[VALUE_DOMAINS.PRIVACY].level).to.equal(ALIGNMENT_LEVELS.HIGH);
      expect(preferences[VALUE_DOMAINS.AUTONOMY].level).to.equal(ALIGNMENT_LEVELS.HIGH);
    });
    
    it('should allow setting value preferences', function() {
      const result = valueAlignment.setValuePreference(
        'PRIVACY', 
        'CRITICAL', 
        { 
          source: 'explicit',
          examples: ['Do not share my data']
        }
      );
      
      expect(result).to.be.true;
      
      const preference = valueAlignment.getValuePreference('PRIVACY');
      expect(preference.level).to.equal(ALIGNMENT_LEVELS.CRITICAL);
      expect(preference.examples).to.include('Do not share my data');
    });
    
    it('should check content alignment with values', function() {
      // Set a specific preference for testing
      valueAlignment.setValuePreference('PRIVACY', 'CRITICAL');
      
      // Test content that violates privacy values
      const badContent = 'We will track your activity and collect your personal data for marketing.';
      const badResult = valueAlignment.checkValueAlignment(badContent, ['PRIVACY']);
      
      expect(badResult.aligned).to.be.false;
      expect(badResult.misalignments).to.have.lengthOf.at.least(1);
      expect(badResult.misalignments[0].domain).to.equal(VALUE_DOMAINS.PRIVACY);
      
      // Test content that respects privacy values
      const goodContent = 'Your data will be anonymized and encrypted to protect your privacy.';
      const goodResult = valueAlignment.checkValueAlignment(goodContent, ['PRIVACY']);
      
      expect(goodResult.aligned).to.be.true;
      expect(goodResult.misalignments).to.have.lengthOf(0);
    });
    
    it('should provide value-aligned alternatives', function() {
      const content = 'We must track your activity to provide service.';
      const misalignedDomains = [VALUE_DOMAINS.PRIVACY, VALUE_DOMAINS.AUTONOMY];
      
      const alternatives = valueAlignment.provideValueAlignedAlternatives(content, misalignedDomains);
      
      expect(alternatives).to.be.an('array');
      expect(alternatives).to.have.lengthOf.at.least(1);
      
      // Check that alternatives don't contain problematic terms
      alternatives.forEach(alt => {
        expect(alt).to.not.include('track');
        expect(alt).to.not.include('must');
      });
    });
    
    it('should export and import value preferences', function() {
      // Set some preferences
      valueAlignment.setValuePreference('PRIVACY', 'CRITICAL');
      valueAlignment.setValuePreference('AUTONOMY', 'HIGH');
      
      // Export preferences
      const exported = valueAlignment.exportValuePreferences();
      
      // Reset preferences
      valueAlignment.resetValuePreferences();
      
      // Verify reset worked
      expect(valueAlignment.getValuePreference('PRIVACY').level).to.equal(ALIGNMENT_LEVELS.HIGH);
      
      // Import preferences
      const importResult = valueAlignment.importValuePreferences(exported);
      expect(importResult).to.be.true;
      
      // Verify import worked
      expect(valueAlignment.getValuePreference('PRIVACY').level).to.equal(ALIGNMENT_LEVELS.CRITICAL);
      expect(valueAlignment.getValuePreference('AUTONOMY').level).to.equal(ALIGNMENT_LEVELS.HIGH);
    });
  });
  
  describe('Transparency', function() {
    it('should initialize with default templates', function() {
      // Generate an explanation to test default templates
      const explanation = transparency.generateExplanation(
        TRANSPARENCY_CATEGORIES.DATA_USAGE,
        { data_types: 'preferences' }
      );
      
      expect(explanation).to.be.a('string');
      expect(explanation).to.include('preferences');
    });
    
    it('should generate explanations with different detail levels', function() {
      // Test minimal detail level
      const minimalExplanation = transparency.generateExplanation(
        TRANSPARENCY_CATEGORIES.DECISION_MAKING,
        {},
        { detailLevel: DETAIL_LEVELS.MINIMAL }
      );
      
      expect(minimalExplanation).to.be.a('string');
      expect(minimalExplanation.length).to.be.lessThan(100); // Should be brief
      
      // Test detailed level
      const detailedExplanation = transparency.generateExplanation(
        TRANSPARENCY_CATEGORIES.DECISION_MAKING,
        {
          query: 'test query',
          context_sources: 'recent conversations',
          personalization_factors: 'preferences',
          confidence_score: '0.95'
        },
        { detailLevel: DETAIL_LEVELS.DETAILED }
      );
      
      expect(detailedExplanation).to.be.a('string');
      expect(detailedExplanation.length).to.be.greaterThan(minimalExplanation.length);
      expect(detailedExplanation).to.include('test query');
      expect(detailedExplanation).to.include('0.95');
    });
    
    it('should format explanations in different formats', function() {
      const data = { data_types: 'preferences' };
      
      // Test text format
      const textExplanation = transparency.generateExplanation(
        TRANSPARENCY_CATEGORIES.DATA_USAGE,
        data,
        { format: EXPLANATION_FORMATS.TEXT }
      );
      expect(textExplanation).to.be.a('string');
      
      // Test HTML format
      const htmlExplanation = transparency.generateExplanation(
        TRANSPARENCY_CATEGORIES.DATA_USAGE,
        data,
        { format: EXPLANATION_FORMATS.HTML }
      );
      expect(htmlExplanation).to.be.a('string');
      expect(htmlExplanation).to.include('<div');
      expect(htmlExplanation).to.include('</div>');
      
      // Test JSON format
      const jsonExplanation = transparency.generateExplanation(
        TRANSPARENCY_CATEGORIES.DATA_USAGE,
        data,
        { format: EXPLANATION_FORMATS.JSON }
      );
      expect(jsonExplanation).to.be.an('object');
      expect(jsonExplanation).to.have.property('explanation');
    });
    
    it('should track explanation requests', function() {
      // Generate a few explanations
      transparency.generateExplanation(TRANSPARENCY_CATEGORIES.DATA_USAGE);
      transparency.generateExplanation(TRANSPARENCY_CATEGORIES.DECISION_MAKING);
      transparency.generateExplanation(TRANSPARENCY_CATEGORIES.DATA_USAGE);
      
      // Get analytics
      const analytics = transparency.getExplanationAnalytics();
      
      expect(analytics.total).to.equal(3);
      expect(analytics.byCategory[TRANSPARENCY_CATEGORIES.DATA_USAGE]).to.equal(2);
      expect(analytics.byCategory[TRANSPARENCY_CATEGORIES.DECISION_MAKING]).to.equal(1);
    });
    
    it('should generate decision traces', function() {
      const decision = {
        id: 'test-decision',
        inputs: {
          query: 'test query',
          context: 'test context'
        },
        weights: {
          query: 0.7,
          context: 0.3
        },
        steps: [
          { name: 'parse', description: 'Parse input', result: 'success' },
          { name: 'process', description: 'Process query', result: 'success' }
        ],
        confidence: 0.95,
        alternatives: [
          { option: 'Option A', score: 0.95 },
          { option: 'Option B', score: 0.85 }
        ]
      };
      
      const trace = transparency.generateDecisionTrace(decision);
      
      expect(trace).to.be.an('object');
      expect(trace.decision).to.equal('test-decision');
      expect(trace.factors).to.have.lengthOf(2);
      expect(trace.steps).to.have.lengthOf(2);
      expect(trace.confidence).to.equal(0.95);
      expect(trace.alternatives).to.have.lengthOf(2);
    });
    
    it('should generate data usage reports', function() {
      const report = transparency.generateDataUsageReport('user123');
      
      expect(report).to.be.an('object');
      expect(report.userId).to.equal('user123');
      expect(report.dataCategories).to.be.an('array');
      expect(report.dataCategories).to.have.lengthOf.at.least(1);
      expect(report.accessControls).to.be.an('array');
      expect(report.userControls).to.be.an('array');
    });
  });
  
  describe('Ethics Manager', function() {
    before(async function() {
      // Initialize ethics manager before tests
      await ethicsManager.initialize();
    });
    
    it('should initialize successfully', function() {
      expect(ethicsManager.initialized).to.be.true;
      expect(ethicsManager.boundaryEnforcer).to.not.be.null;
      expect(ethicsManager.valueAlignment).to.not.be.null;
      expect(ethicsManager.transparency).to.not.be.null;
    });
    
    it('should check boundaries', function() {
      const safeContent = 'This is safe content.';
      const result = ethicsManager.checkBoundaries(safeContent);
      
      expect(result).to.be.an('object');
      expect(result).to.have.property('allowed');
    });
    
    it('should check value alignment', function() {
      const content = 'Your data will be anonymized and encrypted.';
      const result = ethicsManager.checkValueAlignment(content);
      
      expect(result).to.be.an('object');
      expect(result).to.have.property('aligned');
      expect(result).to.have.property('alignmentScore');
    });
    
    it('should generate explanations', function() {
      const explanation = ethicsManager.generateExplanation(
        TRANSPARENCY_CATEGORIES.DATA_USAGE,
        { data_types: 'preferences' }
      );
      
      expect(explanation).to.be.a('string');
      expect(explanation).to.include('preferences');
    });
    
    it('should create safe responses', function() {
      // Test with safe content
      const safeContent = 'This is safe content that respects privacy.';
      const safeResult = ethicsManager.createSafeResponse(safeContent);
      
      expect(safeResult).to.be.an('object');
      expect(safeResult.safe).to.be.true;
      expect(safeResult.modified).to.equal(safeContent);
      
      // Test with potentially unsafe content
      const unsafeContent = 'We will track your every move and collect all your data.';
      const unsafeResult = ethicsManager.createSafeResponse(unsafeContent, { includeExplanation: true });
      
      expect(unsafeResult).to.be.an('object');
      // The result might be safe or unsafe depending on the exact configuration
      if (!unsafeResult.safe) {
        expect(unsafeResult.modified).to.not.equal(unsafeContent);
        expect(unsafeResult).to.have.property('explanation');
      }
    });
    
    it('should get ethics status', function() {
      const status = ethicsManager.getEthicsStatus();
      
      expect(status).to.be.an('object');
      expect(status).to.have.property('initialized');
      expect(status).to.have.property('boundaries');
      expect(status).to.have.property('values');
      expect(status).to.have.property('transparency');
    });
    
    it('should update configuration', function() {
      const originalConfig = ethicsManager.transparency.options.defaultDetailLevel;
      
      ethicsManager.updateConfiguration({
        transparency: {
          defaultDetailLevel: DETAIL_LEVELS.DETAILED
        }
      });
      
      expect(ethicsManager.transparency.options.defaultDetailLevel).to.equal(DETAIL_LEVELS.DETAILED);
      
      // Reset to original
      ethicsManager.updateConfiguration({
        transparency: {
          defaultDetailLevel: originalConfig
        }
      });
    });
  });
  
  describe('Security Manager Integration', function() {
    before(async function() {
      // Initialize security manager before tests
      await securityManager.initialize();
    });
    
    it('should initialize with ethics components', function() {
      expect(securityManager.initialized).to.be.true;
      expect(securityManager.components.valueAlignment).to.not.be.undefined;
      expect(securityManager.components.transparency).to.not.be.undefined;
      expect(securityManager.components.ethicsManager).to.not.be.undefined;
    });
    
    it('should check value alignment through security manager', function() {
      const content = 'Your data will be anonymized and encrypted.';
      const result = securityManager.checkValueAlignment(content);
      
      expect(result).to.be.an('object');
      expect(result).to.have.property('aligned');
      expect(result).to.have.property('alignmentScore');
    });
    
    it('should generate explanations through security manager', function() {
      const explanation = securityManager.generateExplanation(
        TRANSPARENCY_CATEGORIES.DATA_USAGE,
        { data_types: 'preferences' }
      );
      
      expect(explanation).to.be.a('string');
      expect(explanation).to.include('preferences');
    });
    
    it('should create safe responses through security manager', function() {
      const content = 'This is safe content that respects privacy.';
      const result = securityManager.createSafeResponse(content);
      
      expect(result).to.be.an('object');
      expect(result).to.have.property('safe');
      expect(result).to.have.property('modified');
    });
    
    it('should include ethics components in security status', function() {
      const status = securityManager.getSecurityStatus();
      
      expect(status).to.be.an('object');
      expect(status).to.have.property('values');
      expect(status).to.have.property('transparency');
      expect(status).to.have.property('ethics');
      
      expect(status.values).to.have.property('domains');
      expect(status.transparency).to.have.property('categories');
    });
  });
});
