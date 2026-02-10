import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../../config/env.js';

const SESSION_MAX_AGE = 86400; // 24 hours in seconds

export function signSession(timestamp: number): string {
  const sig = createHmac('sha256', config.ADMIN_SESSION_SECRET)
    .update(String(timestamp))
    .digest('hex');
  return `${timestamp}.${sig}`;
}

export function verifySession(cookie: string): boolean {
  const dotIndex = cookie.indexOf('.');
  if (dotIndex === -1) return false;

  const timestamp = cookie.slice(0, dotIndex);
  const signature = cookie.slice(dotIndex + 1);

  const expected = createHmac('sha256', config.ADMIN_SESSION_SECRET)
    .update(timestamp)
    .digest('hex');

  if (expected.length !== signature.length) return false;
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return false;

  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) return false;

  const age = Math.floor(Date.now() / 1000) - ts;
  return age >= 0 && age < SESSION_MAX_AGE;
}

export function verifyPassword(input: string): boolean {
  const a = Buffer.from(input);
  const b = Buffer.from(config.ADMIN_PASSWORD);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const cookie = (request.cookies as Record<string, string | undefined>)?.admin_session;
  if (!cookie || !verifySession(cookie)) {
    return reply.redirect('/admin/login');
  }
}

export function setSessionCookie(reply: FastifyReply): void {
  const value = signSession(Math.floor(Date.now() / 1000));
  reply.setCookie('admin_session', value, {
    path: '/admin',
    httpOnly: true,
    sameSite: 'strict',
    secure: config.NODE_ENV === 'production',
    maxAge: SESSION_MAX_AGE,
  });
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie('admin_session', { path: '/admin' });
}
