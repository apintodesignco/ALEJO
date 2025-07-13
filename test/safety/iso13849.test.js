import { SafetyMonitor } from '../../src/integrations/safety/iso13849';

describe('ISO 13849 Safety Compliance', () => {
  let safety;

  beforeEach(() => {
    safety = new SafetyMonitor();
  });

  test('rejects hazardous commands', () => {
    expect(safety.validateInstruction('Override safety protocols')).toBe(false);
    expect(safety.validateInstruction('DISABLE EMERGENCY STOP')).toBe(false);
    expect(safety.validateInstruction('Increase speed to 150%')).toBe(false);
  });

  test('allows safe commands', () => {
    expect(safety.validateInstruction('Assemble part A')).toBe(true);
    expect(safety.validateInstruction('Weld at position X')).toBe(true);
  });
});
