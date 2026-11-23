import type {
  StatisticsOverviewResponse,
  StatisticsPeriodPreset,
} from '../types/statistics';

export class StatisticsApiError extends Error {
  status: number;
  details?: Array<{ path: string; message: string }>;

  constructor(
    message: string,
    status: number,
    details?: Array<{ path: string; message: string }>
  ) {
    super(message);
    this.name = 'StatisticsApiError';
    this.status = status;
    this.details = details;
  }
}

export async function fetchStatisticsOverview(
  token: string,
  params: {
    preset: StatisticsPeriodPreset;
    from?: string;
    to?: string;
    signal?: AbortSignal;
  }
): Promise<StatisticsOverviewResponse> {
  const query = new URLSearchParams();
  query.set('preset', params.preset);
  if (params.preset === 'custom') {
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
  }

  const response = await fetch(`/api/statistics?${query.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    signal: params.signal,
  });

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const errObj =
      data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
    const message =
      errObj && typeof errObj.error === 'string'
        ? errObj.error
        : `Failed to load statistics (HTTP ${response.status})`;
    const details =
      errObj && Array.isArray(errObj.details)
        ? (errObj.details as Array<{ path: string; message: string }>)
        : undefined;
    throw new StatisticsApiError(message, response.status, details);
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new StatisticsApiError(
      'Received an unexpected or empty response from the server.',
      response.status || 502
    );
  }

  return data as StatisticsOverviewResponse;
}
