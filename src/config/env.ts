import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  BASE_URL: z.string().url(),

  // Database
  DATABASE_PATH: z.string().default('./data/localengine.sqlite'),

  // WhatsApp Cloud API
  WHATSAPP_PHONE_NUMBER_ID: z.string().min(1),
  WHATSAPP_ACCESS_TOKEN: z.string().min(1),
  WHATSAPP_VERIFY_TOKEN: z.string().min(1),
  WHATSAPP_APP_SECRET: z.string().min(1),

  // Google Business Profile OAuth
  GBP_CLIENT_ID: z.string().min(1),
  GBP_CLIENT_SECRET: z.string().min(1),
  GBP_REDIRECT_URI: z.string().url(),

  // Token encryption key (64 hex chars = 32 bytes)
  TOKEN_ENCRYPTION_KEY: z.string().length(64).regex(/^[0-9a-f]+$/i),

  // Claude / Anthropic
  ANTHROPIC_API_KEY: z.string().min(1),

  // GitHub
  GITHUB_TOKEN: z.string().min(1),

  // Admin dashboard
  ADMIN_PASSWORD: z.string().min(8),
  ADMIN_SESSION_SECRET: z.string().min(32),

  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const config = parsed.data;
export type Config = z.infer<typeof envSchema>;
