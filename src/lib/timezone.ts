const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function isValidIanaTimeZone(timeZone: string): boolean {
  const trimmed = timeZone.trim();
  if (!trimmed || trimmed.length > 100) return false;
  // Reject loose fixed-offset notations (e.g. "+05:30"); require valid Intl IANA/UTC name
  if (/^[+-]\d{2}:?\d{2}$/.test(trimmed)) return false;
  try {
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone: trimmed });
    const resolved = formatter.resolvedOptions().timeZone;
    return typeof resolved === 'string' && resolved.length > 0;
  } catch {
    return false;
  }
}

export function normalizeTimeZoneOrNull(timeZone: string | null | undefined): string | null {
  if (!timeZone) return null;
  const trimmed = timeZone.trim();
  if (!isValidIanaTimeZone(trimmed)) return null;
  return new Intl.DateTimeFormat('en-US', { timeZone: trimmed }).resolvedOptions().timeZone;
}

export function resolveEffectiveTimeZone(timeZone: string | null | undefined): {
  effectiveTimeZone: string;
  timezoneInitialized: boolean;
} {
  const normalized = normalizeTimeZoneOrNull(timeZone);
  if (normalized) {
    return {
      effectiveTimeZone: normalized,
      timezoneInitialized: true,
    };
  }
  return {
    effectiveTimeZone: 'UTC',
    timezoneInitialized: false,
  };
}

export function isValidCalendarDate(value: string): boolean {
  if (!DATE_ONLY_REGEX.test(value)) return false;
  const [yearStr, monthStr, dayStr] = value.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

export function parseCalendarDate(value: string): { year: number; month: number; day: number } {
  const [yearStr, monthStr, dayStr] = value.split('-');
  return {
    year: Number(yearStr),
    month: Number(monthStr),
    day: Number(dayStr),
  };
}

export function formatCalendarDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function addDaysToLocalDate(localDate: string, deltaDays: number): string {
  const { year, month, day } = parseCalendarDate(localDate);
  const next = new Date(Date.UTC(year, month - 1, day + deltaDays));
  return formatCalendarDate(
    next.getUTCFullYear(),
    next.getUTCMonth() + 1,
    next.getUTCDate()
  );
}

export function diffLocalDays(from: string, to: string): number {
  const fromParts = parseCalendarDate(from);
  const toParts = parseCalendarDate(to);
  const fromMs = Date.UTC(fromParts.year, fromParts.month - 1, fromParts.day);
  const toMs = Date.UTC(toParts.year, toParts.month - 1, toParts.day);
  return Math.round((toMs - fromMs) / 86400000);
}

/**
 * Returns 0 = Sunday .. 6 = Saturday using pure UTC calendar math on YYYY-MM-DD.
 */
export function getDayOfWeekFromLocalDate(localDate: string): number {
  const { year, month, day } = parseCalendarDate(localDate);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/**
 * Returns Monday (YYYY-MM-DD) of the Monday-Sunday week containing `localDate`.
 */
export function getWeekStartMonday(localDate: string): string {
  const dow = getDayOfWeekFromLocalDate(localDate); // 0=Sun..6=Sat
  const offsetFromMonday = (dow + 6) % 7;
  return addDaysToLocalDate(localDate, -offsetFromMonday);
}

export function formatTimestampInTimeZoneToLocalDate(date: Date, timeZone: string): string {
  const safeZone = isValidIanaTimeZone(timeZone) ? timeZone : 'UTC';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: safeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

export function formatTimestampInTimeZoneToLocalParts(
  date: Date,
  timeZone: string
): {
  localDate: string;
  localTime: string;
  hour: number;
  minute: number;
  second: number;
} {
  const safeZone = isValidIanaTimeZone(timeZone) ? timeZone : 'UTC';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: safeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const year = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  const rawHour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const hour = rawHour === 24 ? 0 : rawHour;
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  const second = Number(parts.find((p) => p.type === 'second')?.value ?? 0);

  const localDate = `${year}-${month}-${day}`;
  const localTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  return {
    localDate,
    localTime,
    hour,
    minute,
    second,
  };
}

export function getTodayLocalDateForTimeZone(
  timeZone: string | null | undefined,
  now: Date = new Date()
): string {
  const effectiveZone = timeZone && isValidIanaTimeZone(timeZone) ? timeZone : 'UTC';
  return formatTimestampInTimeZoneToLocalDate(now, effectiveZone);
}

/**
 * Resolves the exact UTC epoch milliseconds corresponding to local midnight (00:00:00)
 * on `localDate` (`YYYY-MM-DD`) in `timeZone`, refining twice to stay accurate across DST transitions.
 */
export function getUtcInstantForLocalMidnight(localDate: string, timeZone: string): number {
  const safeZone = isValidIanaTimeZone(timeZone) ? timeZone : 'UTC';
  const { year, month, day } = parseCalendarDate(localDate);
  let estimate = Date.UTC(year, month - 1, day, 0, 0, 0);

  for (let pass = 0; pass < 2; pass += 1) {
    const parts = formatTimestampInTimeZoneToLocalParts(new Date(estimate), safeZone);
    const renderedParts = parseCalendarDate(parts.localDate);
    const renderedAsUtc = Date.UTC(
      renderedParts.year,
      renderedParts.month - 1,
      renderedParts.day,
      parts.hour,
      parts.minute,
      parts.second
    );
    const targetAsUtc = Date.UTC(year, month - 1, day, 0, 0, 0);
    estimate += targetAsUtc - renderedAsUtc;
  }

  return estimate;
}
