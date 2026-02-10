import pino from 'pino';
import { config } from '../config/env.js';

const transport =
  config.NODE_ENV === 'development'
    ? pino.transport({ target: 'pino-pretty', options: { colorize: true } })
    : undefined;

export const logger = pino(
  {
    level: config.LOG_LEVEL,
    name: 'localengine',
  },
  transport,
);

export function createChildLogger(service: string) {
  return logger.child({ service });
}
