import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { desc, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { pendingReviews, clients, activityLog } from '../../db/schema.js';
import { reviewsListPage, reviewRow } from '../views/reviews-list.js';
import { createChildLogger } from '../../lib/logger.js';

const log = createChildLogger('admin:reviews');

export async function reviewRoutes(app: FastifyInstance) {
  // List all reviews (pending first, then recent)
  app.get('/reviews', async (_request: FastifyRequest, reply: FastifyReply) => {
    const rows = await db
      .select()
      .from(pendingReviews)
      .leftJoin(clients, eq(pendingReviews.clientId, clients.id))
      .orderBy(desc(pendingReviews.createdAt))
      .limit(100)
      .all();

    const reviews = rows.map((r) => ({
      ...r.pending_reviews,
      client: r.clients,
    }));

    reply.type('text/html').send(reviewsListPage(reviews));
  });

  // Approve review
  app.post('/reviews/:id/approve', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const reviewId = parseInt(id, 10);

    const review = await db
      .select()
      .from(pendingReviews)
      .leftJoin(clients, eq(pendingReviews.clientId, clients.id))
      .where(eq(pendingReviews.id, reviewId))
      .get();

    if (!review) {
      reply.status(404).send('Review not found');
      return;
    }

    await db
      .update(pendingReviews)
      .set({ status: 'approved' })
      .where(eq(pendingReviews.id, reviewId));

    await db.insert(activityLog).values({
      clientId: review.pending_reviews.clientId,
      type: 'review_responded',
      payload: JSON.stringify({
        reviewId: review.pending_reviews.reviewId,
        reply: review.pending_reviews.suggestedReply,
        approvedVia: 'admin',
      }),
      status: 'success',
    });

    log.info({ reviewId }, 'Review approved via admin dashboard');

    const updated = { ...review.pending_reviews, status: 'approved' as const, client: review.clients };
    reply.type('text/html').send(reviewRow(updated));
  });

  // Reject review
  app.post('/reviews/:id/reject', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const reviewId = parseInt(id, 10);

    const review = await db
      .select()
      .from(pendingReviews)
      .leftJoin(clients, eq(pendingReviews.clientId, clients.id))
      .where(eq(pendingReviews.id, reviewId))
      .get();

    if (!review) {
      reply.status(404).send('Review not found');
      return;
    }

    await db
      .update(pendingReviews)
      .set({ status: 'rejected' })
      .where(eq(pendingReviews.id, reviewId));

    log.info({ reviewId }, 'Review rejected via admin dashboard');

    const updated = { ...review.pending_reviews, status: 'rejected' as const, client: review.clients };
    reply.type('text/html').send(reviewRow(updated));
  });

  // Expire review
  app.post('/reviews/:id/expire', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const reviewId = parseInt(id, 10);

    const review = await db
      .select()
      .from(pendingReviews)
      .leftJoin(clients, eq(pendingReviews.clientId, clients.id))
      .where(eq(pendingReviews.id, reviewId))
      .get();

    if (!review) {
      reply.status(404).send('Review not found');
      return;
    }

    await db
      .update(pendingReviews)
      .set({ status: 'expired' })
      .where(eq(pendingReviews.id, reviewId));

    log.info({ reviewId }, 'Review expired via admin dashboard');

    const updated = { ...review.pending_reviews, status: 'expired' as const, client: review.clients };
    reply.type('text/html').send(reviewRow(updated));
  });
}
