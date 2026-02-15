/**
 * Trade-specific examples for WhatsApp prompts.
 * Shows tradespeople realistic, context-specific examples based on their trade.
 */

interface TradeExamples {
  post: string[];
  offer: string[];
}

const TRADE_EXAMPLES: Record<string, TradeExamples> = {
  electrician: {
    post: [
      'just rewired a house in {area}',
      'emergency callout sorted in {area} — power restored in 2 hours',
      'fitted new consumer unit and EV charger in {area}',
    ],
    offer: [
      'Free electrical safety check with any rewire',
      '€50 off EV charger installation',
      '10% off smoke alarm upgrades',
    ],
  },
  plumber: {
    post: [
      'emergency boiler repair in {area} — back up and running same day',
      'installed new bathroom suite in {area}',
      'sorted a burst pipe in {area} this morning',
    ],
    offer: [
      'Free boiler service with any repair',
      '€100 off bathroom renovations',
      '10% off emergency callouts',
    ],
  },
  carpenter: {
    post: [
      'fitted bespoke wardrobes in {area}',
      'finished a custom kitchen in {area}',
      'decking project completed in {area}',
    ],
    offer: [
      'Free design consultation on wardrobes',
      '10% off kitchen fitting',
      '€200 off decking projects over 20m²',
    ],
  },
  builder: {
    post: [
      'extension completed in {area}',
      'attic conversion finished in {area}',
      'new patio and landscaping done in {area}',
    ],
    offer: [
      'Free quote on extensions',
      '10% off attic conversions',
      '€500 off garden landscaping',
    ],
  },
  roofer: {
    post: [
      'full roof replacement completed in {area}',
      'emergency leak repair in {area}',
      'new flat roof and fascias fitted in {area}',
    ],
    offer: [
      'Free roof inspection',
      '10% off gutter cleaning',
      '€300 off full roof replacements',
    ],
  },
  painter: {
    post: [
      'full house repaint finished in {area}',
      'commercial office painted in {area}',
      'exterior painting and window frame restoration in {area}',
    ],
    offer: [
      'Free colour consultation',
      '10% off exterior painting',
      '€100 off full house repaints',
    ],
  },
  tiler: {
    post: [
      'kitchen and bathroom tiling completed in {area}',
      'wetroom tiling and waterproofing in {area}',
      'porcelain patio laid in {area}',
    ],
    offer: [
      'Free tiling quote',
      '10% off bathroom tiling',
      '€150 off wetroom installations',
    ],
  },
  landscaper: {
    post: [
      'new driveway and front garden landscaping in {area}',
      'decking and raised beds built in {area}',
      'artificial grass laid in {area}',
    ],
    offer: [
      'Free garden design consultation',
      '10% off driveways',
      '€200 off full garden makeovers',
    ],
  },
  'web designer': {
    post: [
      'just launched a new website for a client',
      'helped a local business rank #1 on Google',
      "completed an SEO overhaul that tripled organic traffic",
    ],
    offer: [
      'Free website audit',
      'Free SEO audit',
      '€200 off website packages',
    ],
  },
  'digital marketer': {
    post: [
      'just launched a new website for a client',
      'helped a local business rank #1 on Google',
      "completed an SEO campaign that tripled organic traffic",
    ],
    offer: [
      'Free website audit',
      'Free SEO audit',
      '€200 off digital marketing packages',
    ],
  },
  'web design agency': {
    post: [
      'just launched a new website for a client',
      'helped a local business rank #1 on Google',
      "completed an SEO overhaul that tripled organic traffic",
    ],
    offer: [
      'Free website audit',
      'Free SEO audit',
      '€200 off website packages',
    ],
  },
};

/**
 * Get trade-specific examples for prompts.
 * If serviceAreas are provided, injects first area into examples.
 */
export function getTradeExamples(
  tradeType: string,
  serviceAreas?: string[],
): TradeExamples {
  const examples = TRADE_EXAMPLES[tradeType.toLowerCase()] || {
    post: [
      'just finished a job in {area}',
      'project completed in {area}',
      'now offering emergency callouts in {area}',
    ],
    offer: [
      '10% off this month',
      'Free quote on all jobs',
      '€50 off your first booking',
    ],
  };

  // Replace {area} placeholder with actual service area
  const area = serviceAreas?.[0] || 'your area';

  return {
    post: examples.post.map((ex) => ex.replace('{area}', area)),
    offer: examples.offer,
  };
}
