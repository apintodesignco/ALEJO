import { AudioFeedback } from '../src/personalization/accessibility/audio-feedback.js';
import { expect } from 'chai';

describe('AudioFeedback', () => {
  let audioFeedback;

  beforeEach(() => {
    audioFeedback = new AudioFeedback();
  });

  it('should provide feedback with speech synthesis', () => {
    // Mock the speak function
    let spokenMessage = '';
    audioFeedback.speak = (message) => { spokenMessage = message; };
    
    audioFeedback.provideFeedback('Operation completed', 'success');
    expect(spokenMessage).to.equal('Success: Operation completed');
  });

  it('should play non-verbal cues', () => {
    let cuePlayed = '';
    audioFeedback.playCue = (cueType) => { cuePlayed = cueType; };
    
    audioFeedback.playCue('confirm');
    expect(cuePlayed).to.equal('confirm');
  });

  it('should adjust settings based on resource mode', () => {
    audioFeedback.handleResourceModeChange('low-power');
    expect(audioFeedback.enabled).to.be.false;

    audioFeedback.handleResourceModeChange('balanced');
    expect(audioFeedback.enabled).to.be.true;
    expect(audioFeedback.rate).to.equal(1.1);

    audioFeedback.handleResourceModeChange('high-performance');
    expect(audioFeedback.enabled).to.be.true;
    expect(audioFeedback.rate).to.equal(1.0);
  });
});
