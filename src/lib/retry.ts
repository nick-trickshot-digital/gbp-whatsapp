import { createChildLogger } from './logger.js';

const log = createChildLogger('retry');

export interface RetryOptions {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  shouldRetry?: (error: unknown) => boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  shouldRetry: (error: unknown) => {
    if (error instanceof Error && 'statusCode' in error) {
      const code = (error as { statusCode: number }).statusCode;
      return [429, 500, 502, 503, 504].includes(code);
    }
    return true;
  },
};

export async function retry<T>(
  fn: () => Promise<T>,
  opts?: RetryOptions,
): Promise<T> {
  const options = { ...DEFAULT_OPTIONS, ...opts };

  let lastError: unknown;
  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === options.maxAttempts || !options.shouldRetry(error)) {
        throw error;
      }

      const delay = Math.min(
        options.baseDelay * Math.pow(2, attempt - 1),
        options.maxDelay,
      );

      log.warn(
        { attempt, maxAttempts: options.maxAttempts, delay, error },
        'Retrying after error',
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
