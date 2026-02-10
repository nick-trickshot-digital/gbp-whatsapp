import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { clients } from '../db/schema.js';

/**
 * Normalize a phone number to a consistent format.
 * WhatsApp sends numbers without the '+' prefix (e.g., "353871234567").
 * We store them the same way — digits only, with country code.
 */
export function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, '');
}

/**
 * Look up a client by their WhatsApp phone number.
 * Returns the client record or undefined if not found.
 */
export async function lookupClientByPhone(phone: string) {
  const normalized = normalizePhone(phone);
  const result = await db
    .select()
    .from(clients)
    .where(eq(clients.whatsappNumber, normalized))
    .limit(1);
  return result[0] ?? null;
}
