export interface CaptionRequest {
  rawCaption: string;
  tradeType: string;
  businessName: string;
  county: string;
}

export interface GbpPostRequest {
  prompt: string;
  tradeType: string;
  businessName: string;
  county: string;
}

export interface OfferPostRequest {
  prompt: string;
  tradeType: string;
  businessName: string;
  county: string;
}

export interface ReviewResponseRequest {
  reviewText: string;
  starRating: number;
  reviewerName: string;
  businessName: string;
  tradeType: string;
  county: string;
}
