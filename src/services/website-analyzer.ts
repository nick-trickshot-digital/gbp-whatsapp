import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config/env.js';
import { createChildLogger } from '../lib/logger.js';

const log = createChildLogger('website-analyzer');

const anthropic = new Anthropic({
  apiKey: config.ANTHROPIC_API_KEY,
});

export interface WebsiteAnalysis {
  summary: string;
  serviceAreas: string[];
  services: string[];
}

const ANALYSIS_SYSTEM_PROMPT = `You are analyzing a tradesperson's website to extract key business information for automated Google Business Profile posting.

Extract:
1. Service areas (cities, counties, regions they cover)
2. Services offered (specific trade services, not generic descriptions)
3. A concise business summary (2-3 sentences capturing what they do, their specialties, and service approach)

Output JSON only:
{
  "summary": "...",
  "serviceAreas": ["Dublin", "Kildare", ...],
  "services": ["Boiler installation", "Emergency plumbing", ...]
}

Rules:
- Service areas must be actual place names (cities/counties), not "nationwide" or "local"
- Services must be specific trade offerings, not marketing copy
- If info is missing, use empty arrays
- Keep summary under 200 words, factual and professional`;

/**
 * Fetch and analyze a website to extract business context.
 * Uses Claude to parse HTML and extract service areas, services, and summary.
 */
export async function analyzeWebsite(websiteUrl: string): Promise<WebsiteAnalysis> {
  log.info({ websiteUrl }, 'Fetching website for analysis');

  try {
    // Fetch the homepage HTML
    const response = await fetch(websiteUrl, {
      headers: {
        'User-Agent': 'LocalEngine-Bot/1.0 (GBP Automation)',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();

    // Extract text content (very basic HTML stripping for now)
    const textContent = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 15000); // Limit to ~15k chars for Claude

    log.info({ websiteUrl, contentLength: textContent.length }, 'Analyzing website content');

    const result = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1024,
      system: ANALYSIS_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Website: ${websiteUrl}\n\nContent:\n${textContent}`,
        },
      ],
    });

    const analysisText = result.content[0].type === 'text' ? result.content[0].text : '';
    const analysis = JSON.parse(analysisText) as WebsiteAnalysis;

    log.info(
      { websiteUrl, serviceAreas: analysis.serviceAreas.length, services: analysis.services.length },
      'Website analysis complete',
    );

    return analysis;
  } catch (err) {
    log.error({ err, websiteUrl }, 'Failed to analyze website');
    throw err;
  }
}
