import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { verifyPassword, setSessionCookie, clearSessionCookie } from '../middleware/auth.js';
import { loginPage } from '../views/login.js';

export async function authRoutes(app: FastifyInstance) {
  app.get('/login', async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.type('text/html').send(loginPage());
  });

  app.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const { password } = request.body as { password?: string };

    if (!password || !verifyPassword(password)) {
      reply.type('text/html').send(loginPage('Invalid password'));
      return;
    }

    setSessionCookie(reply);
    reply.redirect('/admin/clients');
  });

  app.get('/logout', async (_request: FastifyRequest, reply: FastifyReply) => {
    clearSessionCookie(reply);
    reply.redirect('/admin/login');
  });
}
