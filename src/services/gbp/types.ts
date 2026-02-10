export interface GbpReview {
  name: string; // Resource name: accounts/{id}/locations/{id}/reviews/{id}
  reviewId: string;
  reviewer: {
    displayName: string;
    profilePhotoUrl?: string;
  };
  starRating: 'ONE' | 'TWO' | 'THREE' | 'FOUR' | 'FIVE';
  comment?: string;
  createTime: string;
  updateTime: string;
  reviewReply?: {
    comment: string;
    updateTime: string;
  };
}

export interface GbpReviewsResponse {
  reviews: GbpReview[];
  averageRating: number;
  totalReviewCount: number;
  nextPageToken?: string;
}

export interface GbpLocalPost {
  name?: string;
  languageCode: string;
  summary: string;
  media?: Array<{
    mediaFormat: 'PHOTO';
    sourceUrl: string;
  }>;
  topicType: 'STANDARD';
}

export interface GbpMediaItem {
  name: string;
  mediaFormat: string;
  googleUrl: string;
}

export interface GbpPerformanceMetrics {
  impressions: number;
  websiteClicks: number;
  callClicks: number;
  directionRequests: number;
}

export interface GbpTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp
}

export function starRatingToNumber(
  rating: GbpReview['starRating'],
): number {
  const map: Record<string, number> = {
    ONE: 1,
    TWO: 2,
    THREE: 3,
    FOUR: 4,
    FIVE: 5,
  };
  return map[rating] ?? 0;
}
