import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const clients = sqliteTable('clients', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  businessName: text('business_name').notNull(),
  tradeType: text('trade_type').notNull(),
  county: text('county').notNull(),
  whatsappNumber: text('whatsapp_number').notNull().unique(),
  gbpAccountId: text('gbp_account_id').notNull(),
  gbpLocationId: text('gbp_location_id').notNull(),
  websiteRepo: text('website_repo').notNull(),
  gbpRefreshToken: text('gbp_refresh_token'),
  gbpAccessToken: text('gbp_access_token'),
  gbpTokenExpiresAt: integer('gbp_token_expires_at'),
  googlePlaceId: text('google_place_id'),
  websiteUrl: text('website_url'),
  websiteSummary: text('website_summary'),
  serviceAreas: text('service_areas', { mode: 'json' }).$type<string[]>(),
  services: text('services', { mode: 'json' }).$type<string[]>(),
  status: text('status', { enum: ['active', 'paused', 'onboarding'] })
    .notNull()
    .default('active'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const activityLog = sqliteTable('activity_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  clientId: integer('client_id')
    .notNull()
    .references(() => clients.id),
  type: text('type', {
    enum: ['photo_posted', 'review_alert', 'review_responded', 'digest_sent', 'gbp_post', 'offer_posted'],
  }).notNull(),
  payload: text('payload', { mode: 'json' }),
  status: text('status', { enum: ['success', 'failed', 'pending'] }).notNull(),
  errorMessage: text('error_message'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const pendingReviews = sqliteTable('pending_reviews', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  clientId: integer('client_id')
    .notNull()
    .references(() => clients.id),
  reviewId: text('review_id').notNull().unique(),
  reviewerName: text('reviewer_name'),
  reviewText: text('review_text'),
  starRating: integer('star_rating').notNull(),
  suggestedReply: text('suggested_reply').notNull(),
  status: text('status', {
    enum: [
      'pending',
      'awaiting_custom_reply',
      'approved',
      'rejected',
      'custom_reply',
      'expired',
    ],
  })
    .notNull()
    .default('pending'),
  customReplyText: text('custom_reply_text'),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const pendingPosts = sqliteTable('pending_posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  clientId: integer('client_id')
    .notNull()
    .references(() => clients.id),
  prompt: text('prompt').notNull(),
  suggestedText: text('suggested_text').notNull(),
  postType: text('post_type', { enum: ['standard', 'offer'] })
    .notNull()
    .default('standard'),
  offerEndDate: integer('offer_end_date', { mode: 'timestamp' }),
  ctaType: text('cta_type'),
  status: text('status', {
    enum: ['pending', 'awaiting_edit', 'approved', 'edited', 'skipped', 'awaiting_photo'],
  })
    .notNull()
    .default('pending'),
  customText: text('custom_text'),
  awaitingPhoto: integer('awaiting_photo', { mode: 'boolean' })
    .notNull()
    .default(false),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const nudges = sqliteTable('nudges', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  clientId: integer('client_id')
    .notNull()
    .references(() => clients.id),
  type: text('type', {
    enum: ['review_link', 'post_activity', 'holiday_hours', 'profile_audit'],
  }).notNull(),
  sentAt: integer('sent_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  responded: integer('responded', { mode: 'boolean' })
    .notNull()
    .default(false),
});

export const metricsHistory = sqliteTable('metrics_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  clientId: integer('client_id')
    .notNull()
    .references(() => clients.id),
  impressions: integer('impressions').notNull().default(0),
  websiteClicks: integer('website_clicks').notNull().default(0),
  callClicks: integer('call_clicks').notNull().default(0),
  directionRequests: integer('direction_requests').notNull().default(0),
  weekStart: integer('week_start', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const processedWebhooks = sqliteTable('processed_webhooks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  messageId: text('message_id').notNull().unique(),
  processedAt: integer('processed_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});
