import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import type { ThinkHistoryTurn } from '../lib/gemini.ts';
import type {
  ContextDomainKey,
  ContextIntentCategory,
  PreviousTurnContextMeta,
} from '../lib/thinkContext/types.ts';
import type { StatisticsPeriodPreset } from '../types/statistics.ts';
import {
  assertUserDailyQuotaAvailable,
  getUserDailyQuotaStatus,
  lockUserQuotaTransaction,
} from '../lib/thinkRateLimit.ts';
import type {
  ThinkActionRecordDTO,
  ThinkContextSource,
  ThinkConversationDetail,
  ThinkConversationSummary,
  ThinkMessageDTO,
  ThinkQuotaStatus,
} from '../types/think.ts';
import type {
  CreateConversationInputValidated,
  NormalizedCandidateAction,
} from '../validators/thinkValidator.ts';
import { db } from './index.ts';
import {
  aiActionRecords,
  aiConversations,
  aiMessages,
  type AiConversationRecord,
  type AiMessageRecord,
  type ThinkMessageMeta,
} from './schema.ts';
import {
  listThinkActionsGroupedByMessage,
  serializeThinkActionRecord,
} from './thinkActions.ts';

export const DEFAULT_CONVERSATION_TITLE = 'New thread';
export const MAX_GEMINI_HISTORY_MESSAGES = 12;

export function serializeThinkMessage(
  record: AiMessageRecord,
  actions: ThinkActionRecordDTO[] = []
): ThinkMessageDTO {
  return {
    id: record.id,
    conversationId: record.conversationId,
    role: record.role,
    content: record.content,
    meta: record.responseMeta ?? null,
    actions,
    createdAt: record.createdAt.toISOString(),
  };
}

export function serializeThinkConversation(
  record: AiConversationRecord,
  stats?: { messageCount: number; lastMessagePreview: string | null }
): ThinkConversationSummary {
  return {
    id: record.id,
    title: record.title,
    contextSource: record.contextSource,
    messageCount: stats?.messageCount ?? 0,
    lastMessagePreview: stats?.lastMessagePreview ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function buildPreviewSnippet(text: string): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= 90) return collapsed;
  return `${collapsed.slice(0, 87).trimEnd()}...`;
}

function deriveFallbackTitle(prompt: string): string {
  const collapsed = prompt.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= 52) return collapsed || DEFAULT_CONVERSATION_TITLE;
  return `${collapsed.slice(0, 49).trimEnd()}...`;
}

export async function listUserThinkConversations(
  userId: number
): Promise<ThinkConversationSummary[]> {
  try {
    const convRows = await db
      .select()
      .from(aiConversations)
      .where(eq(aiConversations.userId, userId))
      .orderBy(desc(aiConversations.updatedAt), desc(aiConversations.id));

    if (convRows.length === 0) return [];

    const convIds = convRows.map((c) => c.id);
    const msgRows = await db
      .select({
        id: aiMessages.id,
        conversationId: aiMessages.conversationId,
        content: aiMessages.content,
        createdAt: aiMessages.createdAt,
      })
      .from(aiMessages)
      .where(and(eq(aiMessages.userId, userId), inArray(aiMessages.conversationId, convIds)))
      .orderBy(asc(aiMessages.createdAt), asc(aiMessages.id));

    const statsByConv = new Map<
      number,
      { messageCount: number; lastMessagePreview: string | null }
    >();
    for (const msg of msgRows) {
      const current = statsByConv.get(msg.conversationId) ?? {
        messageCount: 0,
        lastMessagePreview: null,
      };
      current.messageCount += 1;
      current.lastMessagePreview = buildPreviewSnippet(msg.content);
      statsByConv.set(msg.conversationId, current);
    }

    return convRows.map((conv) => serializeThinkConversation(conv, statsByConv.get(conv.id)));
  } catch (error) {
    console.error('Failed to list THINK conversations:', error);
    throw new Error('Unable to load THINK conversations right now.', { cause: error });
  }
}

export async function createUserThinkConversation(
  userId: number,
  input: CreateConversationInputValidated
): Promise<ThinkConversationSummary> {
  try {
    const now = new Date();
    const [created] = await db
      .insert(aiConversations)
      .values({
        userId,
        title: input.title ?? DEFAULT_CONVERSATION_TITLE,
        contextSource: input.contextSource ?? 'general',
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return serializeThinkConversation(created, { messageCount: 0, lastMessagePreview: null });
  } catch (error) {
    console.error('Failed to create THINK conversation:', error);
    throw new Error('Unable to create conversation right now.', { cause: error });
  }
}

export async function getOwnedThinkConversation(
  userId: number,
  conversationId: number
): Promise<AiConversationRecord | null> {
  const [row] = await db
    .select()
    .from(aiConversations)
    .where(and(eq(aiConversations.id, conversationId), eq(aiConversations.userId, userId)))
    .limit(1);

  return row ?? null;
}

export async function getUserThinkConversationDetail(
  userId: number,
  conversationId: number
): Promise<ThinkConversationDetail | null> {
  try {
    const conversation = await getOwnedThinkConversation(userId, conversationId);
    if (!conversation) return null;

    const [messages, actionsByMessage] = await Promise.all([
      db
        .select()
        .from(aiMessages)
        .where(and(eq(aiMessages.conversationId, conversationId), eq(aiMessages.userId, userId)))
        .orderBy(asc(aiMessages.createdAt), asc(aiMessages.id)),
      listThinkActionsGroupedByMessage(userId, conversationId),
    ]);

    const lastMsg = messages[messages.length - 1];

    return {
      conversation: serializeThinkConversation(conversation, {
        messageCount: messages.length,
        lastMessagePreview: lastMsg ? buildPreviewSnippet(lastMsg.content) : null,
      }),
      messages: messages.map((msg) =>
        serializeThinkMessage(msg, actionsByMessage.get(msg.id) ?? [])
      ),
    };
  } catch (error) {
    console.error('Failed to load THINK conversation detail:', error);
    throw new Error('Unable to load conversation right now.', { cause: error });
  }
}

export async function updateUserThinkConversationContextSource(
  userId: number,
  conversationId: number,
  contextSource: ThinkContextSource
): Promise<ThinkConversationSummary | null> {
  try {
    const [updated] = await db
      .update(aiConversations)
      .set({ contextSource })
      .where(and(eq(aiConversations.id, conversationId), eq(aiConversations.userId, userId)))
      .returning();

    if (!updated) return null;

    const msgRows = await db
      .select({
        id: aiMessages.id,
        content: aiMessages.content,
      })
      .from(aiMessages)
      .where(and(eq(aiMessages.conversationId, conversationId), eq(aiMessages.userId, userId)))
      .orderBy(asc(aiMessages.createdAt), asc(aiMessages.id));

    const lastMsg = msgRows[msgRows.length - 1];
    return serializeThinkConversation(updated, {
      messageCount: msgRows.length,
      lastMessagePreview: lastMsg ? buildPreviewSnippet(lastMsg.content) : null,
    });
  } catch (error) {
    console.error('Failed to update THINK conversation context source:', error);
    throw new Error('Unable to update conversation focus right now.', { cause: error });
  }
}

export async function deleteUserThinkConversation(
  userId: number,
  conversationId: number
): Promise<{ id: number } | null> {
  try {
    const rows = await db
      .delete(aiConversations)
      .where(and(eq(aiConversations.id, conversationId), eq(aiConversations.userId, userId)))
      .returning({ id: aiConversations.id });

    return rows[0] ?? null;
  } catch (error) {
    console.error('Failed to delete THINK conversation:', error);
    throw new Error('Unable to delete conversation right now.', { cause: error });
  }
}

export async function getBoundedConversationHistoryForGemini(
  userId: number,
  conversationId: number,
  limit = MAX_GEMINI_HISTORY_MESSAGES
): Promise<ThinkHistoryTurn[]> {
  const rows = await db
    .select({
      role: aiMessages.role,
      content: aiMessages.content,
    })
    .from(aiMessages)
    .where(and(eq(aiMessages.conversationId, conversationId), eq(aiMessages.userId, userId)))
    .orderBy(desc(aiMessages.createdAt), desc(aiMessages.id))
    .limit(limit);

  return rows.reverse();
}

const VALID_CONTEXT_INTENTS = new Set<ContextIntentCategory>([
  'scheduling_workload',
  'tasks_projects_goals',
  'habits_consistency',
  'fitness_routines',
  'broad_review',
  'follow_up_continuity',
]);

const VALID_CONTEXT_DOMAINS = new Set<ContextDomainKey>([
  'plan_tasks',
  'plan_calendar',
  'plan_projects_goals',
  'live_habits',
  'live_workouts',
  'live_routines',
  'statistics',
]);

const VALID_STATS_PRESETS = new Set<StatisticsPeriodPreset>([
  '7d',
  'week',
  '30d',
  'month',
  '90d',
  'ytd',
  'custom',
]);

export async function getLatestAssistantPreviousTurnMeta(
  userId: number,
  conversationId: number
): Promise<PreviousTurnContextMeta | null> {
  const [row] = await db
    .select({
      responseMeta: aiMessages.responseMeta,
    })
    .from(aiMessages)
    .where(
      and(
        eq(aiMessages.conversationId, conversationId),
        eq(aiMessages.userId, userId),
        eq(aiMessages.role, 'assistant')
      )
    )
    .orderBy(desc(aiMessages.createdAt), desc(aiMessages.id))
    .limit(1);

  const ctx = row?.responseMeta?.context;
  if (!ctx) return null;

  const intentCategory = VALID_CONTEXT_INTENTS.has(ctx.intentCategory as ContextIntentCategory)
    ? (ctx.intentCategory as ContextIntentCategory)
    : null;

  const selectedDomains = Array.isArray(ctx.selectedDomains)
    ? ctx.selectedDomains.filter((d): d is ContextDomainKey =>
        VALID_CONTEXT_DOMAINS.has(d as ContextDomainKey)
      )
    : null;

  const statsPreset =
    ctx.statsPreset && VALID_STATS_PRESETS.has(ctx.statsPreset as StatisticsPeriodPreset)
      ? (ctx.statsPreset as StatisticsPeriodPreset)
      : null;

  if (!intentCategory && (!selectedDomains || selectedDomains.length === 0) && !statsPreset) {
    return null;
  }

  return {
    intentCategory,
    selectedDomains,
    statsPreset,
  };
}

export async function persistThinkTurnWithQuotaCheck(params: {
  userId: number;
  conversationId: number;
  userContent: string;
  assistantContent: string;
  assistantMeta: ThinkMessageMeta | null;
  model: string;
  suggestedTitle?: string;
  proposedActions?: NormalizedCandidateAction[];
}): Promise<{
  conversation: ThinkConversationSummary;
  userMessage: ThinkMessageDTO;
  assistantMessage: ThinkMessageDTO;
  quota: ThinkQuotaStatus;
} | null> {
  const result = await db.transaction(async (tx) => {
    await lockUserQuotaTransaction(tx, params.userId);
    await assertUserDailyQuotaAvailable(params.userId, tx);

    const [conv] = await tx
      .select()
      .from(aiConversations)
      .where(
        and(eq(aiConversations.id, params.conversationId), eq(aiConversations.userId, params.userId))
      )
      .limit(1);

    if (!conv) return null;

    const userCreatedAt = new Date();
    const assistantCreatedAt = new Date(userCreatedAt.getTime() + 1);

    const [insertedUser] = await tx
      .insert(aiMessages)
      .values({
        conversationId: params.conversationId,
        userId: params.userId,
        role: 'user',
        content: params.userContent,
        responseMeta: null,
        model: null,
        createdAt: userCreatedAt,
      })
      .returning();

    const [insertedAssistant] = await tx
      .insert(aiMessages)
      .values({
        conversationId: params.conversationId,
        userId: params.userId,
        role: 'assistant',
        content: params.assistantContent,
        responseMeta: params.assistantMeta,
        model: params.model,
        createdAt: assistantCreatedAt,
      })
      .returning();

    let insertedActions: ThinkActionRecordDTO[] = [];
    if (params.proposedActions && params.proposedActions.length > 0) {
      const actionRows = await tx
        .insert(aiActionRecords)
        .values(
          params.proposedActions.map((item) => ({
            conversationId: params.conversationId,
            messageId: insertedAssistant.id,
            userId: params.userId,
            actionType: item.actionType,
            status: 'proposed' as const,
            summary: item.summary,
            rationale: item.rationale,
            payload: item.payload,
            editedPayload: null,
            executionResult: null,
            errorMessage: null,
            executedAt: null,
            resolvedAt: null,
            createdAt: assistantCreatedAt,
            updatedAt: assistantCreatedAt,
          }))
        )
        .returning();

      insertedActions = actionRows.map(serializeThinkActionRecord);
    }

    const shouldUpdateTitle = conv.title === DEFAULT_CONVERSATION_TITLE;
    const nextTitle = shouldUpdateTitle
      ? (params.suggestedTitle?.slice(0, 120) || deriveFallbackTitle(params.userContent))
      : conv.title;

    const [updatedConv] = await tx
      .update(aiConversations)
      .set({
        title: nextTitle,
        updatedAt: assistantCreatedAt,
      })
      .where(
        and(eq(aiConversations.id, params.conversationId), eq(aiConversations.userId, params.userId))
      )
      .returning();

    const allMsgs = await tx
      .select({ id: aiMessages.id })
      .from(aiMessages)
      .where(
        and(eq(aiMessages.conversationId, params.conversationId), eq(aiMessages.userId, params.userId))
      );

    const quota = await getUserDailyQuotaStatus(params.userId, tx);

    return {
      conversation: serializeThinkConversation(updatedConv, {
        messageCount: allMsgs.length,
        lastMessagePreview: buildPreviewSnippet(insertedAssistant.content),
      }),
      userMessage: serializeThinkMessage(insertedUser, []),
      assistantMessage: serializeThinkMessage(insertedAssistant, insertedActions),
      quota,
    };
  });

  return result;
}
