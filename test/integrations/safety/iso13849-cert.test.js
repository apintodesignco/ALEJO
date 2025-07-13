import { SafetyCertifier } from '../../src/integrations/safety/iso13849-cert';

describe('ISO 13849 Safety Certification', () => {
  const mockRobotSystem = {
    triggerEmergencyStop: jest.fn(() => 'STOPPED'),
    validateCommand: jest.fn(cmd => cmd !== 'OVERRIDE_SAFETY'),
    detectHazardousState: jest.fn(() => true)
  };

  test('runs all required certification tests', () => {
    const certifier = new SafetyCertifier();
    const results = certifier.runCertificationTests(mockRobotSystem);
    
    expect(results['Emergency Stop Response']).toBe(true);
    expect(results['Command Validation']).toBe(true);
    expect(results['Hazardous State Detection']).toBe(true);
  });
});
