import { describe, it, expect } from 'vitest';
import {
  buildCaptionUserPrompt,
  buildReviewResponseUserPrompt,
  CAPTION_SYSTEM_PROMPT,
  REVIEW_RESPONSE_SYSTEM_PROMPT,
} from '../../../src/services/claude/prompts.js';

describe('Claude prompts', () => {
  describe('caption prompts', () => {
    it('should include business details in the user prompt', () => {
      const prompt = buildCaptionUserPrompt(
        'New boiler install',
        'plumber',
        'Smith Plumbing',
        'Surrey',
      );

      expect(prompt).toContain('Smith Plumbing');
      expect(prompt).toContain('plumber');
      expect(prompt).toContain('Surrey');
      expect(prompt).toContain('New boiler install');
    });

    it('should have GBP character limit in system prompt', () => {
      expect(CAPTION_SYSTEM_PROMPT).toContain('1500');
    });

    it('should prohibit hashtags in system prompt', () => {
      expect(CAPTION_SYSTEM_PROMPT).toContain('hashtag');
    });
  });

  describe('review response prompts', () => {
    it('should include all review context in the user prompt', () => {
      const prompt = buildReviewResponseUserPrompt(
        'Great work on the bathroom!',
        5,
        'Dave W.',
        'Smith Plumbing',
        'plumber',
        'Surrey',
      );

      expect(prompt).toContain('Dave W.');
      expect(prompt).toContain('5-star');
      expect(prompt).toContain('Smith Plumbing');
      expect(prompt).toContain('plumber');
      expect(prompt).toContain('Surrey');
      expect(prompt).toContain('Great work on the bathroom!');
    });

    it('should mention non-defensive approach for negative reviews in system prompt', () => {
      expect(REVIEW_RESPONSE_SYSTEM_PROMPT).toContain('defensive');
    });

    it('should have GBP reply character limit in system prompt', () => {
      expect(REVIEW_RESPONSE_SYSTEM_PROMPT).toContain('4096');
    });
  });
});
