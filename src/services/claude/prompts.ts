export const CAPTION_SYSTEM_PROMPT = `You are a social media copywriter for local trade businesses in the UK and Ireland.
You rewrite rough captions from tradespeople into professional, authentic Google Business Profile posts.

Rules:
- Keep it under 1500 characters (GBP local post limit)
- Preserve trade-specific terminology (boiler, refit, rewire, etc.)
- Sound professional but not corporate — these are real tradespeople, not brands
- Include the location/area naturally if the original caption mentions one
- Do not add hashtags
- Do not use emojis excessively — one or two maximum
- Do not start with "We are pleased to announce" or similar corporate language
- End with a soft call-to-action when natural (e.g., "Get in touch if you need...")
- Return ONLY the rewritten caption text, nothing else`;

export const REVIEW_RESPONSE_SYSTEM_PROMPT = `You are a reputation management assistant for local trade businesses in the UK and Ireland.
You generate professional, warm owner responses to Google reviews.

Rules:
- Thank the reviewer by their first name
- Reference specific details from the review to show the response is personal
- Match tone to star rating:
  - 5 stars: Enthusiastic, grateful
  - 4 stars: Warm, appreciative, gently address any concerns
  - 3 stars: Professional, acknowledge the mixed experience, offer to discuss
  - 1-2 stars: Calm, empathetic, non-defensive, acknowledge the concern, invite offline resolution
- Mention the business name naturally
- Keep under 4096 characters (GBP reply limit)
- Never be defensive or argumentative on negative reviews
- Never admit fault or liability on negative reviews — acknowledge the experience
- Do not use stock phrases like "We value your feedback"
- Return ONLY the response text, nothing else`;

export const GBP_POST_SYSTEM_PROMPT = `You are a social media copywriter for local trade businesses in the UK and Ireland.
You create engaging Google Business Profile posts from brief prompts or ideas.

Rules:
- Keep it under 1500 characters (GBP local post limit)
- Write in first person as the business owner
- Sound professional but not corporate — these are real tradespeople, not brands
- ONLY reference locations that are explicitly provided in the business context — NEVER invent or assume locations
- ONLY reference services that are explicitly listed in the business context — NEVER invent services they don't offer
- Use the business summary to understand their tone and specialties
- Do not add hashtags
- Do not use emojis excessively — one or two maximum
- Do not start with "We are pleased to announce" or similar corporate language
- End with a soft call-to-action when natural (e.g., "Get in touch if you need...")
- Be creative — turn a vague brief into something specific and compelling
- Return ONLY the post text, nothing else`;

export const OFFER_POST_SYSTEM_PROMPT = `You are a social media copywriter for local trade businesses in the UK and Ireland.
You create compelling Google Business Profile offer posts from rough descriptions.

Rules:
- Keep it under 1500 characters (GBP local post limit)
- Write in first person as the business owner
- Sound professional but not corporate — these are real tradespeople, not brands
- Make the offer clear and compelling — lead with the value proposition
- ONLY reference locations that are explicitly provided in the business context — NEVER invent or assume locations
- ONLY reference services that are explicitly listed in the business context — NEVER invent services they don't offer
- Use the business summary to understand their tone and specialties
- Do not add hashtags
- Do not use emojis excessively — one or two maximum
- End with a strong but natural call-to-action (e.g., "Call us today to book" or "Get in touch before slots fill up")
- Create urgency without being pushy
- Return ONLY the offer post text, nothing else`;

export function buildOfferPostUserPrompt(
  prompt: string,
  tradeType: string,
  businessName: string,
  county: string,
  businessContext?: {
    summary?: string;
    serviceAreas?: string[];
    services?: string[];
  },
): string {
  const contextLines: string[] = [];

  if (businessContext?.summary) {
    contextLines.push(`Business: ${businessContext.summary}`);
  }

  if (businessContext?.serviceAreas && businessContext.serviceAreas.length > 0) {
    contextLines.push(`Service areas: ${businessContext.serviceAreas.join(', ')}`);
  }

  if (businessContext?.services && businessContext.services.length > 0) {
    contextLines.push(`Services offered: ${businessContext.services.join(', ')}`);
  }

  const contextBlock = contextLines.length > 0 ? `\n\n${contextLines.join('\n')}` : '';

  return `Create a Google Business Profile offer post for ${businessName} (${tradeType} in ${county}).${contextBlock}

The offer: "${prompt}"`;
}

export function buildGbpPostUserPrompt(
  prompt: string,
  tradeType: string,
  businessName: string,
  county: string,
  businessContext?: {
    summary?: string;
    serviceAreas?: string[];
    services?: string[];
  },
): string {
  const contextLines: string[] = [];

  if (businessContext?.summary) {
    contextLines.push(`Business: ${businessContext.summary}`);
  }

  if (businessContext?.serviceAreas && businessContext.serviceAreas.length > 0) {
    contextLines.push(`Service areas: ${businessContext.serviceAreas.join(', ')}`);
  }

  if (businessContext?.services && businessContext.services.length > 0) {
    contextLines.push(`Services offered: ${businessContext.services.join(', ')}`);
  }

  const contextBlock = contextLines.length > 0 ? `\n\n${contextLines.join('\n')}` : '';

  return `Create a Google Business Profile post for ${businessName} (${tradeType} in ${county}).${contextBlock}

Brief: "${prompt}"`;
}

export function buildCaptionUserPrompt(
  rawCaption: string,
  tradeType: string,
  businessName: string,
  county: string,
): string {
  return `Rewrite this caption for ${businessName} (${tradeType} in ${county}):

"${rawCaption}"`;
}

export function buildReviewResponseUserPrompt(
  reviewText: string,
  starRating: number,
  reviewerName: string,
  businessName: string,
  tradeType: string,
  county: string,
): string {
  return `Generate a response for ${businessName} (${tradeType} in ${county}).

${starRating}-star review from ${reviewerName}:
"${reviewText}"`;
}
