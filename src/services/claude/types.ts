export interface CaptionRequest {
  rawCaption: string;
  tradeType: string;
  businessName: string;
  county: string;
}

export interface BusinessContext {
  summary?: string;
  serviceAreas?: string[];
  services?: string[];
}

export interface GbpPostRequest {
  prompt: string;
  tradeType: string;
  businessName: string;
  county: string;
  businessContext?: BusinessContext;
}

export interface OfferPostRequest {
  prompt: string;
  tradeType: string;
  businessName: string;
  county: string;
  businessContext?: BusinessContext;
}

export interface ReviewResponseRequest {
  reviewText: string;
  starRating: number;
  reviewerName: string;
  businessName: string;
  tradeType: string;
  county: string;
}
