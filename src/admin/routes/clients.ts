import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { clients } from '../../db/schema.js';
import { clientsListPage } from '../views/clients-list.js';
import { clientFormPage } from '../views/client-form.js';
import { selectLocationPage } from '../views/select-location.js';
import { listAllLocations } from '../../services/gbp/auth.js';

export async function clientRoutes(app: FastifyInstance) {
  // List all clients
  app.get('/clients', async (_request: FastifyRequest, reply: FastifyReply) => {
    const allClients = await db.select().from(clients).all();
    reply.type('text/html').send(clientsListPage(allClients));
  });

  // New client form
  app.get('/clients/new', async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.type('text/html').send(clientFormPage());
  });

  // Create client
  app.post('/clients', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, string>;

    if (!body.businessName || !body.tradeType || !body.county || !body.whatsappNumber) {
      reply
        .type('text/html')
        .send(clientFormPage(null, 'Please fill in all required fields', body));
      return;
    }

    await db.insert(clients).values({
      businessName: body.businessName,
      tradeType: body.tradeType,
      county: body.county,
      whatsappNumber: body.whatsappNumber.replace(/\D/g, ''),
      gbpAccountId: body.gbpAccountId || 'pending',
      gbpLocationId: body.gbpLocationId || 'pending',
      websiteRepo: body.websiteRepo || 'pending',
    });

    reply.redirect('/admin/clients');
  });

  // Edit client form
  app.get('/clients/:id/edit', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const client = await db.select().from(clients).where(eq(clients.id, parseInt(id, 10))).get();

    if (!client) {
      reply.status(404).type('text/html').send('<h2>Client not found</h2>');
      return;
    }

    reply.type('text/html').send(clientFormPage(client));
  });

  // Update client
  app.post('/clients/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, string>;
    const clientId = parseInt(id, 10);

    const existing = await db.select().from(clients).where(eq(clients.id, clientId)).get();
    if (!existing) {
      reply.status(404).type('text/html').send('<h2>Client not found</h2>');
      return;
    }

    if (!body.businessName || !body.tradeType || !body.county || !body.whatsappNumber) {
      reply
        .type('text/html')
        .send(clientFormPage(existing, 'Please fill in all required fields', body));
      return;
    }

    await db
      .update(clients)
      .set({
        businessName: body.businessName,
        tradeType: body.tradeType,
        county: body.county,
        whatsappNumber: body.whatsappNumber.replace(/\D/g, ''),
        gbpAccountId: body.gbpAccountId || existing.gbpAccountId,
        gbpLocationId: body.gbpLocationId || existing.gbpLocationId,
        websiteRepo: body.websiteRepo || existing.websiteRepo,
        status: (body.status as 'active' | 'paused' | 'onboarding') || existing.status,
      })
      .where(eq(clients.id, clientId));

    reply.redirect('/admin/clients');
  });

  // Delete client
  app.post('/clients/:id/delete', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    await db.delete(clients).where(eq(clients.id, parseInt(id, 10)));
    reply.redirect('/admin/clients');
  });

  // OAuth redirect — reuses existing /oauth/start route
  app.get('/clients/:id/oauth', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    reply.redirect(`/oauth/start?clientId=${id}`);
  });

  // Location selection page — shown after OAuth to pick the GBP location
  app.get('/clients/:id/select-location', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const clientId = parseInt(id, 10);

    const client = await db.select().from(clients).where(eq(clients.id, clientId)).get();
    if (!client) {
      reply.status(404).type('text/html').send('<h2>Client not found</h2>');
      return;
    }

    if (!client.gbpAccessToken) {
      reply.redirect(`/admin/clients/${id}/oauth`);
      return;
    }

    const locations = await listAllLocations(clientId);
    reply.type('text/html').send(selectLocationPage(clientId, client.businessName, locations));
  });

  // Save selected location
  app.post('/clients/:id/select-location', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const clientId = parseInt(id, 10);
    const body = request.body as Record<string, string>;

    let accountId: string;
    let locationId: string;

    if (body.manualAccountId && body.manualLocationId) {
      // Manual entry takes priority
      accountId = body.manualAccountId.trim();
      locationId = body.manualLocationId.trim();
    } else if (body.location) {
      // Radio button selection: "accountId|locationId"
      const [acct, loc] = body.location.split('|');
      accountId = acct;
      locationId = loc;
    } else {
      reply.redirect(`/admin/clients/${id}/select-location`);
      return;
    }

    await db
      .update(clients)
      .set({ gbpAccountId: accountId, gbpLocationId: locationId })
      .where(eq(clients.id, clientId));

    reply.redirect('/admin/clients');
  });
}
