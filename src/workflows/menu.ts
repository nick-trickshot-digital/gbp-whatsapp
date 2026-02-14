import { eq, and, gte } from 'drizzle-orm';
import { WhatsAppService } from '../services/whatsapp/client.js';
import { fetchWeeklyMetrics } from '../services/gbp/performance.js';
import { db } from '../db/client.js';
import { clients, activityLog, pendingPosts } from '../db/schema.js';
import { createChildLogger } from '../lib/logger.js';
import {
  startGbpPost,
  handlePostEdit,
} from './gbp-post.js';
import {
  startOfferPost,
  handleOfferEdit,
} from './offer-post.js';
import type { InferSelectModel } from 'drizzle-orm';
import type { ListSection } from '../services/whatsapp/types.js';

const log = createChildLogger('menu');

type Client = InferSelectModel<typeof clients>;

const whatsapp = new WhatsAppService();

/**
 * Send the main menu to a tradesperson.
 * Personalised with their business name.
 */
export async function sendMainMenu(
  client: Client,
  from: string,
  greeting?: string,
): Promise<void> {
  const bodyText = greeting
    ? `${greeting}\n\nI'm your LocalEngine assistant for ${client.businessName}. What would you like to do?`
    : `Hi! I'm your LocalEngine assistant for ${client.businessName}.\n\nWhat would you like to do?`;

  const sections: ListSection[] = [
    {
      title: 'Google Profile',
      rows: [
        {
          id: 'menu_post',
          title: 'Create a Post',
          description: "I'll draft something for your Google profile",
        },
        {
          id: 'menu_offer',
          title: 'Create an Offer',
          description: 'Promote a deal on Google Maps',
        },
        {
          id: 'menu_stats',
          title: 'View My Stats',
          description: 'See your profile performance this week',
        },
      ],
    },
    {
      title: 'Reviews',
      rows: [
        {
          id: 'menu_review_link',
          title: 'Get Review Link',
          description: 'Share with customers to get more reviews',
        },
      ],
    },
    {
      title: 'Help',
      rows: [
        {
          id: 'menu_help',
          title: 'What Can You Do?',
          description: 'See everything I can help with',
        },
      ],
    },
  ];

  await whatsapp.sendListMessage(from, bodyText, 'Open Menu', sections);
}

/**
 * Send a confirmation message followed by the menu.
 * Used after every completed action to always show the menu.
 */
export async function sendConfirmationWithMenu(
  client: Client,
  from: string,
  confirmationText: string,
): Promise<void> {
  const menuSuffix = "\n\nI'm always here — what would you like to do next?";
  const combinedBody = `${confirmationText}${menuSuffix}`;

  const sections: ListSection[] = [
    {
      title: 'Google Profile',
      rows: [
        { id: 'menu_post', title: 'Create a Post', description: "I'll draft something for your Google profile" },
        { id: 'menu_offer', title: 'Create an Offer', description: 'Promote a deal on Google Maps' },
        { id: 'menu_stats', title: 'View My Stats', description: 'See your profile performance this week' },
      ],
    },
    {
      title: 'Reviews',
      rows: [
        { id: 'menu_review_link', title: 'Get Review Link', description: 'Share with customers to get more reviews' },
      ],
    },
  ];

  // WhatsApp list body max is 1024 chars — split if needed
  if (combinedBody.length <= 1024) {
    await whatsapp.sendListMessage(from, combinedBody, 'Open Menu', sections);
  } else {
    await whatsapp.sendTextMessage(from, confirmationText);
    await whatsapp.sendListMessage(from, "What would you like to do next?", 'Open Menu', sections);
  }
}

/**
 * Handle a menu selection from the list message.
 * Routes to the correct workflow based on the selected option.
 */
export async function handleMenuSelection(
  client: Client,
  listId: string,
  from: string,
): Promise<void> {
  log.info({ clientId: client.id, listId }, 'Menu selection');

  switch (listId) {
    case 'menu_post': {
      // Set pending state so next text message is routed to post creation
      await db.insert(pendingPosts).values({
        clientId: client.id,
        prompt: '__awaiting_input__',
        suggestedText: '',
        status: 'awaiting_edit',
        postType: 'standard',
      });

      await whatsapp.sendTextMessage(
        from,
        "What would you like to post about? Just describe it in your own words — e.g. 'just finished a kitchen refit in Drumcondra' or 'we're now offering emergency callouts'",
      );
      break;
    }

    case 'menu_offer': {
      // Set pending state for offer creation
      await db.insert(pendingPosts).values({
        clientId: client.id,
        prompt: '__awaiting_offer_input__',
        suggestedText: '',
        status: 'awaiting_edit',
        postType: 'offer',
      });

      await whatsapp.sendTextMessage(
        from,
        "What's the offer? Just describe it in your own words — e.g. '10% off boiler servicing' or 'free quote on all fencing jobs this month'",
      );
      break;
    }

    case 'menu_stats': {
      await handleStatsRequest(client, from);
      break;
    }

    case 'menu_review_link': {
      await handleReviewLinkRequest(client, from);
      break;
    }

    case 'menu_help': {
      await handleHelpRequest(client, from);
      break;
    }

    default:
      log.warn({ listId }, 'Unknown menu selection');
      await sendMainMenu(client, from);
  }
}

/**
 * Handle text messages when in a pending menu state.
 * Returns true if consumed, false if the message should be handled elsewhere.
 */
export async function handlePendingMenuAction(
  client: Client,
  text: string,
  from: string,
): Promise<boolean> {
  // Check for pending post input (standard post)
  const pendingStandard = await db
    .select()
    .from(pendingPosts)
    .where(
      and(
        eq(pendingPosts.clientId, client.id),
        eq(pendingPosts.status, 'awaiting_edit'),
        eq(pendingPosts.postType, 'standard'),
        eq(pendingPosts.prompt, '__awaiting_input__'),
      ),
    )
    .limit(1)
    .then((r) => r[0]);

  if (pendingStandard) {
    // Clean up the placeholder and start the real post flow
    await db
      .update(pendingPosts)
      .set({ status: 'skipped' })
      .where(eq(pendingPosts.id, pendingStandard.id));

    await startGbpPost(client, text, from);
    return true;
  }

  // Check for pending offer input
  const pendingOffer = await db
    .select()
    .from(pendingPosts)
    .where(
      and(
        eq(pendingPosts.clientId, client.id),
        eq(pendingPosts.status, 'awaiting_edit'),
        eq(pendingPosts.postType, 'offer'),
        eq(pendingPosts.prompt, '__awaiting_offer_input__'),
      ),
    )
    .limit(1)
    .then((r) => r[0]);

  if (pendingOffer) {
    // Clean up the placeholder and start the offer flow
    await db
      .update(pendingPosts)
      .set({ status: 'skipped' })
      .where(eq(pendingPosts.id, pendingOffer.id));

    await startOfferPost(client, text, from);
    return true;
  }

  return false;
}

async function handleStatsRequest(client: Client, from: string): Promise<void> {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const metrics = await fetchWeeklyMetrics(
      client.id,
      client.gbpLocationId,
      startDate,
      endDate,
    );

    // Get activity summary
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weeklyActivity = await db
      .select()
      .from(activityLog)
      .where(
        and(
          eq(activityLog.clientId, client.id),
          gte(activityLog.createdAt, weekAgo),
          eq(activityLog.status, 'success'),
        ),
      );

    const photosPosted = weeklyActivity.filter((a) => a.type === 'photo_posted').length;
    const reviewsResponded = weeklyActivity.filter((a) => a.type === 'review_responded').length;
    const postsPublished = weeklyActivity.filter(
      (a) => a.type === 'gbp_post' || a.type === 'offer_posted',
    ).length;

    const statsText = [
      `${client.businessName} — Last 7 Days`,
      '',
      `Profile Views: ${metrics.impressions}`,
      `Website Clicks: ${metrics.websiteClicks}`,
      `Phone Calls: ${metrics.callClicks}`,
      `Direction Requests: ${metrics.directionRequests}`,
      '',
      `This week: ${photosPosted} photo${photosPosted !== 1 ? 's' : ''} posted, ${postsPublished} post${postsPublished !== 1 ? 's' : ''} published, ${reviewsResponded} review${reviewsResponded !== 1 ? 's' : ''} replied to`,
    ].join('\n');

    await sendConfirmationWithMenu(client, from, statsText);
  } catch (err) {
    log.error({ err, clientId: client.id }, 'Failed to fetch stats');
    await sendConfirmationWithMenu(
      client,
      from,
      "Sorry, I couldn't fetch your stats right now. Please try again later.",
    );
  }
}

async function handleReviewLinkRequest(client: Client, from: string): Promise<void> {
  if (!client.googlePlaceId) {
    await sendConfirmationWithMenu(
      client,
      from,
      "Your review link hasn't been set up yet. Ask your account manager to add your Google Place ID.",
    );
    return;
  }

  const reviewLink = `https://search.google.com/local/writereview?placeid=${client.googlePlaceId}`;

  const message = [
    "Here's your Google review link — forward this to any happy customer:",
    '',
    reviewLink,
    '',
    "Tip: The best time to ask is right after finishing a job, while they're still impressed!",
  ].join('\n');

  await sendConfirmationWithMenu(client, from, message);
}

async function handleHelpRequest(client: Client, from: string): Promise<void> {
  const helpText = [
    `Here's everything I can do for ${client.businessName}:`,
    '',
    'Send a photo with a caption and I\'ll post it to your Google profile and website.',
    '',
    'From the menu:',
    '• Create a Post — tell me what to post about and I\'ll draft it for you',
    '• Create an Offer — promote a deal that shows up on Google Maps',
    '• View My Stats — see how your Google profile performed this week',
    '• Get Review Link — get a link to share with customers for Google reviews',
    '',
    "I also handle your Google reviews automatically — when a new review comes in, I'll draft a reply and send it to you for approval.",
    '',
    'Every Monday morning you\'ll get a weekly performance report.',
  ].join('\n');

  await sendConfirmationWithMenu(client, from, helpText);
}
