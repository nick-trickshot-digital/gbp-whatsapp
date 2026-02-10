import { getAuthenticatedClient } from './auth.js';
import { GBP_PERFORMANCE_API_BASE } from '../../config/constants.js';
import { retry } from '../../lib/retry.js';
import { createChildLogger } from '../../lib/logger.js';
import { GbpApiError } from './posts.js';
import type { GbpPerformanceMetrics } from './types.js';

const log = createChildLogger('gbp-performance');

interface DailyMetricTimeSeries {
  dailyMetric: string;
  timeSeries?: {
    datedValues?: Array<{
      date: { year: number; month: number; day: number };
      value?: string;
    }>;
  };
}

interface PerformanceResponse {
  multiDailyMetricTimeSeries?: Array<{
    dailyMetrics: DailyMetricTimeSeries[];
  }>;
}

/**
 * Fetch performance metrics for a GBP location over a date range.
 * Uses the Business Profile Performance API (v1).
 */
export async function fetchWeeklyMetrics(
  clientId: number,
  gbpLocationId: string,
  startDate: Date,
  endDate: Date,
): Promise<GbpPerformanceMetrics> {
  const auth = await getAuthenticatedClient(clientId);
  const accessToken = (await auth.getAccessToken()).token;

  if (!accessToken) {
    throw new Error('Failed to get GBP access token');
  }

  const formatDate = (d: Date) => ({
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
  });

  log.info({ clientId, gbpLocationId, startDate, endDate }, 'Fetching GBP performance metrics');

  const response = await retry(
    async () => {
      const url = `${GBP_PERFORMANCE_API_BASE}/locations/${gbpLocationId}:fetchMultiDailyMetricsTimeSeries`;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dailyMetrics: [
            'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
            'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
            'WEBSITE_CLICKS',
            'CALL_CLICKS',
            'BUSINESS_DIRECTION_REQUESTS',
          ],
          dailyRange: {
            startDate: formatDate(startDate),
            endDate: formatDate(endDate),
          },
        }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new GbpApiError(res.status, error);
      }

      return (await res.json()) as PerformanceResponse;
    },
    { maxAttempts: 3, baseDelay: 2000 },
  );

  return aggregateMetrics(response);
}

function aggregateMetrics(response: PerformanceResponse): GbpPerformanceMetrics {
  const metrics: GbpPerformanceMetrics = {
    impressions: 0,
    websiteClicks: 0,
    callClicks: 0,
    directionRequests: 0,
  };

  const series = response.multiDailyMetricTimeSeries;
  if (!series) return metrics;

  for (const group of series) {
    for (const metric of group.dailyMetrics) {
      const total = sumDailyValues(metric.timeSeries?.datedValues);

      switch (metric.dailyMetric) {
        case 'BUSINESS_IMPRESSIONS_DESKTOP_MAPS':
        case 'BUSINESS_IMPRESSIONS_MOBILE_MAPS':
          metrics.impressions += total;
          break;
        case 'WEBSITE_CLICKS':
          metrics.websiteClicks += total;
          break;
        case 'CALL_CLICKS':
          metrics.callClicks += total;
          break;
        case 'BUSINESS_DIRECTION_REQUESTS':
          metrics.directionRequests += total;
          break;
      }
    }
  }

  return metrics;
}

function sumDailyValues(
  values?: Array<{ value?: string }>,
): number {
  if (!values) return 0;
  return values.reduce((sum, v) => sum + (parseInt(v.value || '0', 10) || 0), 0);
}
