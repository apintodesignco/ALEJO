import { TeslaROSBridge } from '../../src/integrations/robotics/tesla-ros-bridge';

jest.mock('roslib', () => ({
  Ros: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    close: jest.fn()
  })),
  Topic: jest.fn().mockImplementation(() => ({
    publish: jest.fn()
  })),
  Message: jest.fn().mockImplementation((data) => data)
}));

describe('TeslaROSBridge', () => {
  let bridge;

  beforeEach(() => {
    bridge = new TeslaROSBridge();
  });

  test('sends valid commands', () => {
    bridge.sendInstruction('robot-1', 'WELD_CHASSIS');
    expect(bridge.assemblyLineTopic.publish).toHaveBeenCalled();
  });

  test('blocks unsafe commands', () => {
    expect(() => {
      bridge.sendInstruction('robot-1', 'OVERRIDE_SAFETY');
    }).toThrow('violates safety protocols');
  });
});
