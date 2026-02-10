import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { desc, eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { activityLog, clients } from '../../db/schema.js';
import { activityLogPage, activityRowsPartial } from '../views/activity-log.js';

const PAGE_SIZE = 50;

export async function activityRoutes(app: FastifyInstance) {
  app.get('/activity', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { clientId?: string };
    const { activities, hasMore } = await getActivities(query.clientId, 1);
    const allClients = await db.select().from(clients).all();

    reply
      .type('text/html')
      .send(activityLogPage(activities, allClients, { clientId: query.clientId, page: 1 }, hasMore));
  });

  // Partial for htmx pagination
  app.get('/activity/page', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { clientId?: string; page?: string };
    const page = parseInt(query.page ?? '1', 10);
    const { activities, hasMore } = await getActivities(query.clientId, page);

    reply
      .type('text/html')
      .send(activityRowsPartial(activities, { clientId: query.clientId, page }, hasMore));
  });
}

async function getActivities(clientId: string | undefined, page: number) {
  const offset = (page - 1) * PAGE_SIZE;

  let query = db
    .select()
    .from(activityLog)
    .leftJoin(clients, eq(activityLog.clientId, clients.id))
    .orderBy(desc(activityLog.createdAt))
    .limit(PAGE_SIZE + 1)
    .offset(offset);

  if (clientId) {
    query = query.where(eq(activityLog.clientId, parseInt(clientId, 10))) as typeof query;
  }

  const rows = await query.all();
  const hasMore = rows.length > PAGE_SIZE;
  const activities = rows.slice(0, PAGE_SIZE).map((r) => ({
    ...r.activity_log,
    client: r.clients,
  }));

  return { activities, hasMore };
}
