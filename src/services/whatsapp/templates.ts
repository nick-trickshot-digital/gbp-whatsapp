/**
 * Format a review alert message for WhatsApp.
 */
export function formatReviewAlert(
  reviewerName: string,
  starRating: number,
  reviewText: string,
  suggestedReply: string,
): string {
  const stars = '\u2B50'.repeat(starRating);

  const parts = [
    `${stars} New review from ${reviewerName}`,
    '',
    `"${reviewText}"`,
    '',
    'Suggested reply:',
    `"${suggestedReply}"`,
  ];

  return parts.join('\n');
}

/**
 * Format a weekly performance digest message.
 */
export function formatWeeklyDigest(params: {
  businessName: string;
  impressions: number;
  websiteClicks: number;
  callClicks: number;
  directionRequests: number;
  newReviews: number;
  photosPosted: number;
  reviewsResponded: number;
}): string {
  const lines = [
    `Weekly Report for ${params.businessName}`,
    '',
    `Google Profile Views: ${params.impressions}`,
    `Website Clicks: ${params.websiteClicks}`,
    `Phone Calls: ${params.callClicks}`,
    `Direction Requests: ${params.directionRequests}`,
    '',
    `This week: ${params.photosPosted} photos posted, ${params.reviewsResponded} reviews replied to`,
  ];

  if (params.newReviews > 0) {
    lines.push(`${params.newReviews} new review${params.newReviews > 1 ? 's' : ''} received`);
  }

  return lines.join('\n');
}
