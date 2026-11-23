import { and, asc, eq, gte, sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { aiMessages } from '../db/schema.ts';
import type { ThinkQuotaStatus } from '../types/think.ts';

const DEFAULT_DAILY_MESSAGE_LIMIT = 40;
const MAX_CONFIGURED_DAILY_LIMIT = 500;
const QUOTA_WINDOW_HOURS = 24;
const BURST_WINDOW_MS = 60_000;
const BURST_MAX_REQUESTS = 8;
const MIN_COOLDOWN_MS = 1_500;

export const THINK_QUOTA_LOCK_NAMESPACE = 10101;

type DbExecutor = Pick<typeof db, 'select' | 'execute'>;

/**
 * Lightweight in-memory burst & single-flight limiter per server process.
 * Note: This protects a single Node server against overlapping requests and rapid bursts,
 * but resets on restart and is not shared across horizontally scaled instances.
 * The authoritative daily message quota is enforced persistently in PostgreSQL.
 */
const inFlightUsers = new Set<number>();
const recentRequestTimestamps = new Map<number, number[]>();

export class ThinkRateLimitError extends Error {
  status: number;
  code: 'THINK_CONCURRENT_REQUEST' | 'THINK_BURST_LIMIT' | 'THINK_DAILY_QUOTA_EXCEEDED';
  retryAfterSeconds: number;
  quota?: ThinkQuotaStatus;

  constructor(params: {
    message: string;
    code: 'THINK_CONCURRENT_REQUEST' | 'THINK_BURST_LIMIT' | 'THINK_DAILY_QUOTA_EXCEEDED';
    retryAfterSeconds: number;
    quota?: ThinkQuotaStatus;
  }) {
    super(params.message);
    this.name = 'ThinkRateLimitError';
    this.status = 429;
    this.code = params.code;
    this.retryAfterSeconds = params.retryAfterSeconds;
    this.quota = params.quota;
  }
}

export function getConfiguredDailyMessageLimit(): number {
  const raw = process.env.THINK_DAILY_MESSAGE_LIMIT?.trim();
  if (!raw) return DEFAULT_DAILY_MESSAGE_LIMIT;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return DEFAULT_DAILY_MESSAGE_LIMIT;
  }
  return Math.min(parsed, MAX_CONFIGURED_DAILY_LIMIT);
}

export function acquireUserBurstGuard(userId: number): () => void {
  if (inFlightUsers.has(userId)) {
    throw new ThinkRateLimitError({
      message: 'THINK is already processing your previous message. Please wait a moment.',
      code: 'THINK_CONCURRENT_REQUEST',
      retryAfterSeconds: 3,
    });
  }

  const now = Date.now();
  const recent = (recentRequestTimestamps.get(userId) ?? []).filter(
    (ts) => now - ts < BURST_WINDOW_MS
  );

  const latest = recent[recent.length - 1];
  if (latest !== undefined && now - latest < MIN_COOLDOWN_MS) {
    const waitSeconds = Math.max(1, Math.ceil((MIN_COOLDOWN_MS - (now - latest)) / 1000));
    throw new ThinkRateLimitError({
      message: `Please wait ${waitSeconds}s before sending another message.`,
      code: 'THINK_BURST_LIMIT',
      retryAfterSeconds: waitSeconds,
    });
  }

  if (recent.length >= BURST_MAX_REQUESTS) {
    const oldest = recent[0];
    const waitSeconds = Math.max(1, Math.ceil((BURST_WINDOW_MS - (now - oldest)) / 1000));
    throw new ThinkRateLimitError({
      message: `Too many THINK messages in a short window. Try again in ${waitSeconds}s.`,
      code: 'THINK_BURST_LIMIT',
      retryAfterSeconds: waitSeconds,
    });
  }

  recent.push(now);
  recentRequestTimestamps.set(userId, recent);
  inFlightUsers.add(userId);

  return () => {
    inFlightUsers.delete(userId);
  };
}

export async function getUserDailyQuotaStatus(
  userId: number,
  executor: DbExecutor = db
): Promise<ThinkQuotaStatus> {
  const dailyLimit = getConfiguredDailyMessageLimit();
  const now = new Date();
  const windowStart = new Date(now.getTime() - QUOTA_WINDOW_HOURS * 60 * 60 * 1000);

  // Count completed assistant replies so failed Gemini requests never consume user quota.
  const rows = await executor
    .select({ createdAt: aiMessages.createdAt })
    .from(aiMessages)
    .where(
      and(
        eq(aiMessages.userId, userId),
        eq(aiMessages.role, 'assistant'),
        gte(aiMessages.createdAt, windowStart)
      )
    )
    .orderBy(asc(aiMessages.createdAt));

  const usedToday = rows.length;
  const remaining = Math.max(0, dailyLimit - usedToday);
  const oldest = rows[0]?.createdAt ?? null;
  const resetsAt =
    usedToday >= dailyLimit && oldest
      ? new Date(oldest.getTime() + QUOTA_WINDOW_HOURS * 60 * 60 * 1000).toISOString()
      : null;

  return {
    dailyLimit,
    usedToday,
    remaining,
    windowHours: QUOTA_WINDOW_HOURS,
    resetsAt,
  };
}

export async function assertUserDailyQuotaAvailable(
  userId: number,
  executor: DbExecutor = db
): Promise<ThinkQuotaStatus> {
  const quota = await getUserDailyQuotaStatus(userId, executor);
  if (quota.remaining <= 0) {
    const retryAfterSeconds = quota.resetsAt
      ? Math.max(60, Math.ceil((Date.parse(quota.resetsAt) - Date.now()) / 1000))
      : 3600;
    throw new ThinkRateLimitError({
      message: `Daily THINK message limit reached (${quota.usedToday}/${quota.dailyLimit} in 24 hours).`,
      code: 'THINK_DAILY_QUOTA_EXCEEDED',
      retryAfterSeconds,
      quota,
    });
  }
  return quota;
}

export async function lockUserQuotaTransaction(tx: DbExecutor, userId: number): Promise<void> {
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(${THINK_QUOTA_LOCK_NAMESPACE}::integer, ${userId}::integer)`
  );
}
