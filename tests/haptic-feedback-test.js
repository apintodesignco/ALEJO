import { HapticFeedback } from '../src/personalization/accessibility/haptic-feedback.js';
import { expect } from 'chai';

describe('HapticFeedback', () => {
  let hapticFeedback;

  beforeEach(() => {
    hapticFeedback = new HapticFeedback();
    // Mock navigator.vibrate
    navigator.vibrate = (pattern) => {
      // Store the pattern for assertion
      this.lastVibration = pattern;
    };
    this.lastVibration = null;
  });

  it('should play vibration patterns', () => {
    hapticFeedback.play('confirm');
    expect(this.lastVibration).to.deep.equal([100]);

    hapticFeedback.play('alert');
    expect(this.lastVibration).to.deep.equal([200, 100, 200]);
  });

  it('should not play in low-power mode', () => {
    hapticFeedback.handleResourceModeChange('low-power');
    hapticFeedback.play('confirm');
    expect(this.lastVibration).to.be.null;
  });
});
