import type {
  CalendarEvent,
  CalendarEventFilters,
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
} from '../types/calendar';

export class CalendarApiError extends Error {
  status: number;
  details?: Array<{ path: string; message: string }>;

  constructor(
    message: string,
    status: number,
    details?: Array<{ path: string; message: string }>
  ) {
    super(message);
    this.name = 'CalendarApiError';
    this.status = status;
    this.details = details;
  }
}

async function requestJson<T>(url: string, token: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...init,
    headers,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload && typeof payload.error === 'string'
        ? payload.error
        : `Request failed with status ${response.status}`;
    const details =
      payload && Array.isArray(payload.details) ? payload.details : undefined;
    throw new CalendarApiError(message, response.status, details);
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new CalendarApiError(
      'Received an unexpected or empty response from the server.',
      response.status || 502
    );
  }

  return payload as T;
}

export async function fetchCalendarEvents(
  token: string,
  filters?: CalendarEventFilters
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams();
  if (filters?.fromDate) params.set('fromDate', filters.fromDate);
  if (filters?.toDate) params.set('toDate', filters.toDate);
  if (filters?.rangeStart) params.set('rangeStart', filters.rangeStart);
  if (filters?.rangeEnd) params.set('rangeEnd', filters.rangeEnd);
  if (filters?.category) params.set('category', filters.category);

  const query = params.toString();
  const url = query ? `/api/calendar-events?${query}` : '/api/calendar-events';
  const data = await requestJson<{ events: CalendarEvent[] }>(url, token, { method: 'GET' });
  return data.events;
}

export async function createCalendarEventRequest(
  token: string,
  input: CreateCalendarEventInput
): Promise<CalendarEvent> {
  const data = await requestJson<{ event: CalendarEvent }>('/api/calendar-events', token, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return data.event;
}

export async function updateCalendarEventRequest(
  token: string,
  eventId: number,
  patch: UpdateCalendarEventInput
): Promise<CalendarEvent> {
  const data = await requestJson<{ event: CalendarEvent }>(
    `/api/calendar-events/${eventId}`,
    token,
    {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }
  );
  return data.event;
}

export async function deleteCalendarEventRequest(
  token: string,
  eventId: number
): Promise<{ id: number }> {
  return requestJson<{ deleted: boolean; id: number }>(`/api/calendar-events/${eventId}`, token, {
    method: 'DELETE',
  });
}
