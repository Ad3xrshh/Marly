import { Router } from 'express';
import type { Response } from 'express';
import {
  createUserThinkConversation,
  deleteUserThinkConversation,
  getBoundedConversationHistoryForGemini,
  getLatestAssistantPreviousTurnMeta,
  getOwnedThinkConversation,
  getUserThinkConversationDetail,
  listUserThinkConversations,
  persistThinkTurnWithQuotaCheck,
  updateUserThinkConversationContextSource,
} from '../db/think.ts';
import {
  approveAndExecuteThinkAction,
  listUserActionTargetContextAndRefs,
  rejectThinkAction,
  ThinkActionError,
} from '../db/thinkActions.ts';
import {
  GeminiApiError,
  generateThinkReply,
  type ThinkGenerateContentOverride,
} from '../lib/gemini.ts';
import {
  assembleThinkContext,
  type AssembleThinkContextLoaders,
} from '../lib/thinkContext/assembleContext.ts';
import { verifyAndCanonicalizeGrounding } from '../lib/thinkContext/verifyGrounding.ts';
import {
  acquireUserBurstGuard,
  assertUserDailyQuotaAvailable,
  getUserDailyQuotaStatus,
  ThinkRateLimitError,
} from '../lib/thinkRateLimit.ts';
import { requireAuth } from '../middleware/auth.ts';
import type { AuthRequest } from '../middleware/auth.ts';
import { formatZodError } from '../validators/taskValidator.ts';
import {
  actionIdParamSchema,
  approveThinkActionSchema,
  conversationIdParamSchema,
  createConversationSchema,
  normalizeAndFilterGeminiProposedActions,
  sendThinkMessageSchema,
  updateConversationContextSchema,
} from '../validators/thinkValidator.ts';

const router = Router();

router.use(requireAuth);

function resolveUserTimeZone(req: AuthRequest): string {
  return req.dbUser?.timezone || 'UTC';
}

router.get('/conversations', async (req: AuthRequest, res: Response) => {
  if (!req.dbUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const [conversations, quota] = await Promise.all([
      listUserThinkConversations(req.dbUser.id),
      getUserDailyQuotaStatus(req.dbUser.id),
    ]);
    res.json({ conversations, quota });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to load THINK conversations right now.';
    res.status(500).json({ error: message });
  }
});

router.post('/conversations', async (req: AuthRequest, res: Response) => {
  if (!req.dbUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsedBody = createConversationSchema.safeParse(req.body ?? {});
  if (!parsedBody.success) {
    res.status(400).json(formatZodError(parsedBody.error));
    return;
  }

  try {
    const conversation = await createUserThinkConversation(req.dbUser.id, parsedBody.data);
    res.status(201).json({ conversation });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to create conversation right now.';
    res.status(500).json({ error: message });
  }
});

router.get('/conversations/:id', async (req: AuthRequest, res: Response) => {
  if (!req.dbUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsedId = conversationIdParamSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json(formatZodError(parsedId.error));
    return;
  }

  try {
    const detail = await getUserThinkConversationDetail(req.dbUser.id, parsedId.data);
    if (!detail) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }
    const quota = await getUserDailyQuotaStatus(req.dbUser.id);
    res.json({
      ...detail,
      quota,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load conversation.';
    res.status(500).json({ error: message });
  }
});

router.patch('/conversations/:id', async (req: AuthRequest, res: Response) => {
  if (!req.dbUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsedId = conversationIdParamSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json(formatZodError(parsedId.error));
    return;
  }

  const parsedBody = updateConversationContextSchema.safeParse(req.body ?? {});
  if (!parsedBody.success) {
    res.status(400).json(formatZodError(parsedBody.error));
    return;
  }

  try {
    const conversation = await updateUserThinkConversationContextSource(
      req.dbUser.id,
      parsedId.data,
      parsedBody.data.contextSource
    );
    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }
    res.json({ conversation });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to update conversation focus right now.';
    res.status(500).json({ error: message });
  }
});

router.delete('/conversations/:id', async (req: AuthRequest, res: Response) => {
  if (!req.dbUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsedId = conversationIdParamSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json(formatZodError(parsedId.error));
    return;
  }

  try {
    const deleted = await deleteUserThinkConversation(req.dbUser.id, parsedId.data);
    if (!deleted) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }
    res.json({ deleted: true, id: deleted.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to delete conversation.';
    res.status(500).json({ error: message });
  }
});

export async function executeThinkMessageTurn(params: {
  userId: number;
  rawUserTimeZone: string | null | undefined;
  conversationId: number;
  userMessage: string;
  generateContentFn?: ThinkGenerateContentOverride;
  contextLoaders?: AssembleThinkContextLoaders;
}) {
  const effectiveTargetTimeZone = params.rawUserTimeZone || 'UTC';
  let releaseGuard: (() => void) | null = null;

  try {
    const conversation = await getOwnedThinkConversation(params.userId, params.conversationId);
    if (!conversation) {
      return null;
    }

    releaseGuard = acquireUserBurstGuard(params.userId);
    await assertUserDailyQuotaAvailable(params.userId);

    const [history, previousTurnMeta, targetRefs] = await Promise.all([
      getBoundedConversationHistoryForGemini(params.userId, params.conversationId),
      getLatestAssistantPreviousTurnMeta(params.userId, params.conversationId),
      listUserActionTargetContextAndRefs(params.userId, effectiveTargetTimeZone),
    ]);

    const contextAssembly = await assembleThinkContext({
      userId: params.userId,
      userTimeZone: params.rawUserTimeZone,
      userMessage: params.userMessage,
      contextSource: conversation.contextSource,
      previousTurnMeta,
      loaders: params.contextLoaders,
    });

    const generated = await generateThinkReply({
      history,
      userMessage: params.userMessage,
      contextSource: conversation.contextSource,
      contextAssembly,
      targetContext: targetRefs.targetContext,
      generateContentFn: params.generateContentFn,
    });

    const verifiedGrounding = verifyAndCanonicalizeGrounding({
      assembly: contextAssembly,
      ownedRefs: targetRefs.ownedRefs,
      candidateReferences: generated.parsed.references,
      candidateEvidence: generated.parsed.evidence,
      candidateInsufficientContext: generated.parsed.insufficientContext,
      candidateUncertaintyNote: generated.parsed.uncertaintyNote,
    });

    const validProposals = normalizeAndFilterGeminiProposedActions(
      generated.parsed.proposedActions,
      targetRefs.ownedRefs,
      contextAssembly.packet.anchor.todayLocalDate
    );

    const persisted = await persistThinkTurnWithQuotaCheck({
      userId: params.userId,
      conversationId: params.conversationId,
      userContent: params.userMessage,
      assistantContent: generated.parsed.reply,
      assistantMeta: {
        highlights: generated.parsed.highlights,
        followUpSuggestions: generated.parsed.followUpSuggestions,
        mode: 'context_grounded',
        references: verifiedGrounding.references,
        evidence: verifiedGrounding.evidence,
        context: verifiedGrounding.context,
        insufficientContext: verifiedGrounding.insufficientContext,
        uncertaintyNote: verifiedGrounding.uncertaintyNote,
      },
      model: generated.model,
      suggestedTitle: generated.parsed.suggestedTitle,
      proposedActions: validProposals,
    });

    return persisted;
  } finally {
    releaseGuard?.();
  }
}

router.post('/conversations/:id/messages', async (req: AuthRequest, res: Response) => {
  if (!req.dbUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsedId = conversationIdParamSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json(formatZodError(parsedId.error));
    return;
  }

  const parsedBody = sendThinkMessageSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json(formatZodError(parsedBody.error));
    return;
  }

  try {
    const persisted = await executeThinkMessageTurn({
      userId: req.dbUser.id,
      rawUserTimeZone: req.dbUser.timezone,
      conversationId: parsedId.data,
      userMessage: parsedBody.data.content,
    });

    if (!persisted) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    res.status(201).json(persisted);
  } catch (error) {
    if (error instanceof ThinkRateLimitError) {
      res.setHeader('Retry-After', String(error.retryAfterSeconds));
      res.status(429).json({
        error: error.message,
        code: error.code,
        retryAfterSeconds: error.retryAfterSeconds,
        ...(error.quota ? { quota: error.quota } : {}),
      });
      return;
    }

    if (error instanceof GeminiApiError) {
      res.status(error.status).json({
        error: error.message,
        code: error.code,
      });
      return;
    }

    console.error('Unexpected THINK message failure:', error);
    res.status(500).json({ error: 'Unable to process your THINK message right now.' });
  }
});

router.post('/actions/:actionId/approve', async (req: AuthRequest, res: Response) => {
  if (!req.dbUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsedActionId = actionIdParamSchema.safeParse(req.params.actionId);
  if (!parsedActionId.success) {
    res.status(400).json(formatZodError(parsedActionId.error));
    return;
  }

  const parsedBody = approveThinkActionSchema.safeParse(req.body ?? {});
  if (!parsedBody.success) {
    res.status(400).json(formatZodError(parsedBody.error));
    return;
  }

  try {
    const action = await approveAndExecuteThinkAction({
      userId: req.dbUser.id,
      userTimeZone: resolveUserTimeZone(req),
      actionId: parsedActionId.data,
      editedPayload: parsedBody.data.editedPayload,
    });
    res.json({ action });
  } catch (error) {
    if (error instanceof ThinkActionError) {
      res.status(error.status).json({
        error: error.message,
        code: error.code,
        ...(error.details ? { details: error.details } : {}),
        ...(error.action ? { action: error.action } : {}),
      });
      return;
    }

    console.error('Unexpected THINK action approval error:', error);
    res.status(500).json({ error: 'Unable to execute the approved action right now.' });
  }
});

router.post('/actions/:actionId/reject', async (req: AuthRequest, res: Response) => {
  if (!req.dbUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsedActionId = actionIdParamSchema.safeParse(req.params.actionId);
  if (!parsedActionId.success) {
    res.status(400).json(formatZodError(parsedActionId.error));
    return;
  }

  try {
    const action = await rejectThinkAction({
      userId: req.dbUser.id,
      actionId: parsedActionId.data,
    });
    res.json({ action });
  } catch (error) {
    if (error instanceof ThinkActionError) {
      res.status(error.status).json({
        error: error.message,
        code: error.code,
        ...(error.action ? { action: error.action } : {}),
      });
      return;
    }

    console.error('Unexpected THINK action rejection error:', error);
    res.status(500).json({ error: 'Unable to reject this action right now.' });
  }
});

export default router;
