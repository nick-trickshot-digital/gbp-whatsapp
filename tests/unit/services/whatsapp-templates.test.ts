import { describe, it, expect } from 'vitest';
import {
  formatReviewAlert,
  formatWeeklyDigest,
} from '../../../src/services/whatsapp/templates.js';

describe('WhatsApp message templates', () => {
  describe('formatReviewAlert', () => {
    it('should include star emojis for 5-star review', () => {
      const message = formatReviewAlert(
        'Dave W.',
        5,
        'Brilliant work!',
        'Thanks so much Dave!',
      );

      expect(message).toContain('\u2B50\u2B50\u2B50\u2B50\u2B50');
      expect(message).toContain('Dave W.');
      expect(message).toContain('Brilliant work!');
      expect(message).toContain('Thanks so much Dave!');
    });

    it('should show correct stars for low ratings', () => {
      const message = formatReviewAlert(
        'Jane',
        2,
        'Not great',
        'Sorry to hear that',
      );

      expect(message).toContain('\u2B50\u2B50');
      expect(message).not.toContain('\u2B50\u2B50\u2B50');
    });
  });

  describe('formatWeeklyDigest', () => {
    it('should include all metrics', () => {
      const message = formatWeeklyDigest({
        businessName: 'Smith Plumbing',
        impressions: 47,
        websiteClicks: 12,
        callClicks: 5,
        directionRequests: 3,
        newReviews: 2,
        photosPosted: 1,
        reviewsResponded: 2,
      });

      expect(message).toContain('Smith Plumbing');
      expect(message).toContain('47');
      expect(message).toContain('12');
      expect(message).toContain('5');
      expect(message).toContain('3');
      expect(message).toContain('1 photos posted');
      expect(message).toContain('2 reviews replied to');
    });

    it('should include review count when there are new reviews', () => {
      const message = formatWeeklyDigest({
        businessName: 'Test',
        impressions: 10,
        websiteClicks: 5,
        callClicks: 2,
        directionRequests: 1,
        newReviews: 3,
        photosPosted: 0,
        reviewsResponded: 0,
      });

      expect(message).toContain('3 new reviews');
    });

    it('should not mention reviews when count is 0', () => {
      const message = formatWeeklyDigest({
        businessName: 'Test',
        impressions: 10,
        websiteClicks: 5,
        callClicks: 2,
        directionRequests: 1,
        newReviews: 0,
        photosPosted: 0,
        reviewsResponded: 0,
      });

      expect(message).not.toContain('new review');
    });
  });
});
