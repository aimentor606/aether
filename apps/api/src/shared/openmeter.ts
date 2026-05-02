import { OpenMeter } from '@openmeter/sdk';
import type { Event } from '@openmeter/sdk';
import { config } from '../config';

let _client: OpenMeter | null = null;

function getClient(): OpenMeter | null {
  const url = config.OPENMETER_URL;
  if (!url) return null;

  if (!_client) {
    _client = new OpenMeter({
      baseUrl: url.replace(/\/+$/, ''),
      apiKey: config.OPENMETER_API_KEY || undefined,
    });
  }
  return _client;
}

/**
 * Fire-and-forget CloudEvent emission to OpenMeter.
 * Never throws — errors are silently swallowed to avoid blocking callers.
 */
export function emitCloudEvent(
  type: string,
  subject: string,
  data: Record<string, unknown>,
): void {
  const client = getClient();
  if (!client) return;

  const event: Event = { type, subject, data };

  client.events.ingest(event).catch(() => {
    // fire-and-forget: never block the caller
  });
}

export interface UsageQueryParams {
  subject: string;
  from?: string;
  to?: string;
  windowSize?: 'MINUTE' | 'HOUR' | 'DAY' | 'MONTH';
}

export interface UsageDataPoint {
  value: number;
  windowStart: string;
  windowEnd: string;
  subject: string;
}

/**
 * Query OpenMeter for aggregated usage.
 * Returns null if OpenMeter is not configured or unavailable.
 */
export async function queryUsage(
  meterSlug: string,
  params: UsageQueryParams,
): Promise<UsageDataPoint[] | null> {
  const client = getClient();
  if (!client) return null;

  try {
    const result = await client.meters.query(meterSlug, {
      subject: [params.subject],
      from: params.from ? new Date(params.from) : undefined,
      to: params.to ? new Date(params.to) : undefined,
      windowSize: params.windowSize,
    });

    return result.data.map((row) => ({
      value: row.value,
      windowStart: row.windowStart.toISOString(),
      windowEnd: row.windowEnd.toISOString(),
      subject: row.subject ?? params.subject,
    }));
  } catch {
    return null;
  }
}

/**
 * Query total usage for a subject across all meters.
 * Returns the summed value or null on error.
 */
export async function queryTotalUsage(
  meterSlug: string,
  subject: string,
  from?: string,
): Promise<number | null> {
  const data = await queryUsage(meterSlug, { subject, from, windowSize: 'DAY' });
  if (!data) return null;
  return data.reduce((sum, point) => sum + (point.value ?? 0), 0);
}
