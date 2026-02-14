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
    enum: ['photo_posted', 'review_alert', 'review_responded', 'digest_sent', 'gbp_post'],
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
