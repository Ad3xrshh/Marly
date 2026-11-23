import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Compass,
  LogIn,
  PanelLeft,
  Plus,
  RefreshCw,
  Send,
} from 'lucide-react';
import {
  Button,
  Card,
  Dialog,
  ErrorState,
  Skeleton,
} from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useCalendarContext } from '../../context/CalendarContext';
import { useFitnessRoutinesContext } from '../../context/FitnessRoutinesContext';
import { useHabitsContext } from '../../context/HabitsContext';
import { useProjectsGoalsContext } from '../../context/ProjectsGoalsContext';
import { useTasksContext } from '../../context/TasksContext';
import { useToast } from '../../context/ToastContext';
import {
  approveThinkActionRequest,
  createThinkConversationRequest,
  deleteThinkConversationRequest,
  fetchThinkConversationDetail,
  fetchThinkConversations,
  rejectThinkActionRequest,
  sendThinkMessageRequest,
  ThinkApiError,
  updateThinkConversationContextRequest,
} from '../../services/thinkApi';
import type {
  ThinkActionRecordDTO,
  ThinkActionType,
  ThinkContextSource,
  ThinkConversationSummary,
  ThinkMessageDTO,
  ThinkQuotaStatus,
} from '../../types/think';
import { ConversationSidebar } from './components/ConversationSidebar';
import { MessageList } from './components/MessageList';
import type { ThinkEntityOptions } from './components/PlanActionEditor';
import {
  getContextSourceOption,
  THINK_CONTEXT_SOURCE_OPTIONS,
} from './utils/groundingUi';

const MAX_PROMPT_LENGTH = 2000;

interface ThinkPageProps {
  onNavigate?: (path: string) => void;
}

export function ThinkPage({ onNavigate }: ThinkPageProps) {
  const { user, isAuthLoading, isSigningIn, signInWithGoogle, getAccessToken } = useAuth();
  const { pushToast } = useToast();
  const { tasks, refreshTasks } = useTasksContext();
  const { projects, goals, refreshProjectsAndGoals } = useProjectsGoalsContext();
  const { refreshEvents } = useCalendarContext();
  const { refreshHabits } = useHabitsContext();
  const { refreshFitnessAndRoutines } = useFitnessRoutinesContext();

  const [conversations, setConversations] = useState<ThinkConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ThinkMessageDTO[]>([]);
  const [quota, setQuota] = useState<ThinkQuotaStatus | null>(null);

  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isCreatingThread, setIsCreatingThread] = useState(false);
  const [isUpdatingContext, setIsUpdatingContext] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [busyActionIds, setBusyActionIds] = useState<Record<number, boolean>>({});
  const [actionErrors, setActionErrors] = useState<Record<number, string | null>>({});

  const [listError, setListError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [failedPrompt, setFailedPrompt] = useState<string | null>(null);

  const [draftContextSource, setDraftContextSource] = useState<ThinkContextSource>('general');
  const [composerText, setComposerText] = useState('');
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ThinkConversationSummary | null>(null);

  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const activeConversationIdRef = useRef<number | null>(null);
  activeConversationIdRef.current = activeConversationId;

  const entityOptions: ThinkEntityOptions = useMemo(
    () => ({ tasks, projects, goals }),
    [tasks, projects, goals]
  );

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) ?? null,
    [conversations, activeConversationId]
  );

  const effectiveContextSource: ThinkContextSource =
    activeConversation?.contextSource ?? draftContextSource;
  const activeContextOption = useMemo(
    () => getContextSourceOption(effectiveContextSource),
    [effectiveContextSource]
  );

  const replaceActionInMessages = useCallback((updatedAction: ThinkActionRecordDTO) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== updatedAction.messageId || !msg.actions) return msg;
        return {
          ...msg,
          actions: msg.actions.map((a) => (a.id === updatedAction.id ? updatedAction : a)),
        };
      })
    );
  }, []);

  const refreshWorkspaceForAction = useCallback(
    (actionType: ThinkActionType) => {
      switch (actionType) {
        case 'create_task':
        case 'update_task':
          void refreshTasks();
          void refreshProjectsAndGoals();
          void refreshEvents();
          break;
        case 'create_calendar_event':
          void refreshEvents();
          break;
        case 'create_project_milestone':
        case 'create_goal_milestone':
          void refreshProjectsAndGoals();
          break;
        case 'create_habit':
          void refreshHabits();
          break;
        case 'create_routine':
        case 'create_workout':
          void refreshFitnessAndRoutines();
          break;
      }
    },
    [
      refreshEvents,
      refreshFitnessAndRoutines,
      refreshHabits,
      refreshProjectsAndGoals,
      refreshTasks,
    ]
  );

  const loadConversationDetail = useCallback(
    async (conversationId: number) => {
      const token = await getAccessToken();
      if (!token) return;
      setIsLoadingMessages(true);
      setSendError(null);
      setFailedPrompt(null);
      setActionErrors({});
      try {
        const detail = await fetchThinkConversationDetail(token, conversationId);
        if (activeConversationIdRef.current !== conversationId) return;
        if (!detail || !Array.isArray(detail.messages) || !detail.quota) {
          throw new ThinkApiError({
            message: 'Received an incomplete conversation response from THINK.',
            status: 502,
            code: 'INVALID_RESPONSE',
          });
        }
        const nextMessages = detail.messages;
        const nextQuota = detail.quota;
        setMessages(nextMessages);
        setQuota(nextQuota);
      } catch (error) {
        if (activeConversationIdRef.current !== conversationId) return;
        const msg =
          error instanceof Error ? error.message : 'Unable to load conversation messages.';
        setSendError(msg);
      } finally {
        if (activeConversationIdRef.current === conversationId) {
          setIsLoadingMessages(false);
        }
      }
    },
    [getAccessToken]
  );

  const loadWorkspace = useCallback(async () => {
    if (!user) {
      setConversations([]);
      setActiveConversationId(null);
      setMessages([]);
      setQuota(null);
      setListError(null);
      setSendError(null);
      setActionErrors({});
      return;
    }

    const token = await getAccessToken();
    if (!token) return;

    setIsLoadingList(true);
    setListError(null);
    try {
      const data = await fetchThinkConversations(token);
      if (!data || !Array.isArray(data.conversations) || !data.quota) {
        throw new ThinkApiError({
          message: 'Received an incomplete THINK workspace response.',
          status: 502,
          code: 'INVALID_RESPONSE',
        });
      }
      const nextConversations = data.conversations;
      setConversations(nextConversations);
      setQuota(data.quota);

      if (nextConversations.length > 0) {
        const currentStillExists = nextConversations.some(
          (c) => c.id === activeConversationIdRef.current
        );
        const targetId = currentStillExists
          ? (activeConversationIdRef.current as number)
          : nextConversations[0].id;
        setActiveConversationId(targetId);
        activeConversationIdRef.current = targetId;
        await loadConversationDetail(targetId);
      } else {
        setActiveConversationId(null);
        setMessages([]);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unable to load THINK right now.';
      setListError(msg);
    } finally {
      setIsLoadingList(false);
    }
  }, [user, getAccessToken, loadConversationDetail]);

  useEffect(() => {
    if (!isAuthLoading) {
      void loadWorkspace();
    }
  }, [isAuthLoading, loadWorkspace]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, isSending]);

  const handleSelectConversation = useCallback(
    (conversationId: number) => {
      if (conversationId === activeConversationIdRef.current || isSending) return;
      setActiveConversationId(conversationId);
      activeConversationIdRef.current = conversationId;
      void loadConversationDetail(conversationId);
    },
    [isSending, loadConversationDetail]
  );

  const handleCreateConversation = useCallback(async () => {
    const token = await getAccessToken();
    if (!token || isCreatingThread || isSending) return;

    setIsCreatingThread(true);
    setSendError(null);
    setFailedPrompt(null);
    setActionErrors({});
    try {
      const initialSource = activeConversationIdRef.current ? 'general' : draftContextSource;
      const created = await createThinkConversationRequest(token, {
        contextSource: initialSource,
      });
      if (!created || typeof created.id !== 'number') {
        throw new ThinkApiError({
          message: 'Received an incomplete conversation payload from THINK.',
          status: 502,
          code: 'INVALID_RESPONSE',
        });
      }
      setConversations((prev) => [created, ...prev]);
      setActiveConversationId(created.id);
      activeConversationIdRef.current = created.id;
      setMessages([]);
      setDraftContextSource('general');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unable to start a new thread.';
      pushToast({ title: 'Could not start thread', description: msg, variant: 'warning' });
    } finally {
      setIsCreatingThread(false);
    }
  }, [draftContextSource, getAccessToken, isCreatingThread, isSending, pushToast]);

  const handleChangeContextSource = useCallback(
    async (nextSource: ThinkContextSource) => {
      if (isSending || isUpdatingContext) return;
      const currentId = activeConversationIdRef.current;
      if (!currentId) {
        setDraftContextSource(nextSource);
        return;
      }

      const currentConv = conversations.find((c) => c.id === currentId);
      if (!currentConv || currentConv.contextSource === nextSource) return;

      const token = await getAccessToken();
      if (!token) return;

      setIsUpdatingContext(true);
      try {
        const updated = await updateThinkConversationContextRequest(token, currentId, nextSource);
        if (!updated || typeof updated.id !== 'number') {
          throw new ThinkApiError({
            message: 'Received an incomplete conversation update from THINK.',
            status: 502,
            code: 'INVALID_RESPONSE',
          });
        }
        const updatedId = updated.id;
        setConversations((prev) => prev.map((c) => (c.id === updatedId ? updated : c)));
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : 'Unable to update conversation focus right now.';
        pushToast({ title: 'Could not update focus', description: msg, variant: 'warning' });
      } finally {
        setIsUpdatingContext(false);
      }
    },
    [conversations, getAccessToken, isSending, isUpdatingContext, pushToast]
  );

  const handleConfirmDeleteConversation = useCallback(async () => {
    if (!deleteTarget) return;
    const token = await getAccessToken();
    if (!token) return;

    setIsDeleting(true);
    try {
      await deleteThinkConversationRequest(token, deleteTarget.id);
      const remaining = conversations.filter((c) => c.id !== deleteTarget.id);
      setConversations(remaining);

      if (activeConversationIdRef.current === deleteTarget.id) {
        if (remaining.length > 0) {
          const nextId = remaining[0].id;
          setActiveConversationId(nextId);
          activeConversationIdRef.current = nextId;
          await loadConversationDetail(nextId);
        } else {
          setActiveConversationId(null);
          activeConversationIdRef.current = null;
          setMessages([]);
        }
      }

      pushToast({ title: 'Conversation deleted', variant: 'success' });
      setDeleteTarget(null);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unable to delete conversation.';
      pushToast({ title: 'Could not delete conversation', description: msg, variant: 'warning' });
    } finally {
      setIsDeleting(false);
    }
  }, [deleteTarget, getAccessToken, conversations, loadConversationDetail, pushToast]);

  const handleApproveAction = useCallback(
    async (actionId: number, editedPayload?: Record<string, unknown>) => {
      if (busyActionIds[actionId]) return;
      const token = await getAccessToken();
      if (!token) return;

      setBusyActionIds((prev) => ({ ...prev, [actionId]: true }));
      setActionErrors((prev) => ({ ...prev, [actionId]: null }));

      try {
        const result = await approveThinkActionRequest(token, actionId, editedPayload);
        if (!result || !result.action || typeof result.action.id !== 'number') {
          throw new ThinkApiError({
            message: 'Received an incomplete action approval response from THINK.',
            status: 502,
            code: 'INVALID_RESPONSE',
          });
        }
        const updatedAction = result.action;
        replaceActionInMessages(updatedAction);
        refreshWorkspaceForAction(updatedAction.actionType);
        pushToast({
          title: 'Action applied',
          description: updatedAction.executionResult?.label || updatedAction.summary,
          variant: 'success',
        });
      } catch (error) {
        if (error instanceof ThinkApiError) {
          if (error.action) {
            replaceActionInMessages(error.action);
          }
          setActionErrors((prev) => ({ ...prev, [actionId]: error.message }));
          pushToast({
            title: 'Action could not be applied',
            description: error.message,
            variant: 'warning',
          });
        } else {
          const msg =
            error instanceof Error ? error.message : 'Unable to execute this action right now.';
          setActionErrors((prev) => ({ ...prev, [actionId]: msg }));
          pushToast({ title: 'Action failed', description: msg, variant: 'warning' });
        }
      } finally {
        setBusyActionIds((prev) => ({ ...prev, [actionId]: false }));
      }
    },
    [busyActionIds, getAccessToken, pushToast, refreshWorkspaceForAction, replaceActionInMessages]
  );

  const handleRejectAction = useCallback(
    async (actionId: number) => {
      if (busyActionIds[actionId]) return;
      const token = await getAccessToken();
      if (!token) return;

      setBusyActionIds((prev) => ({ ...prev, [actionId]: true }));
      setActionErrors((prev) => ({ ...prev, [actionId]: null }));

      try {
        const result = await rejectThinkActionRequest(token, actionId);
        if (!result || !result.action || typeof result.action.id !== 'number') {
          throw new ThinkApiError({
            message: 'Received an incomplete action dismissal response from THINK.',
            status: 502,
            code: 'INVALID_RESPONSE',
          });
        }
        replaceActionInMessages(result.action);
        pushToast({ title: 'Action dismissed', variant: 'info' });
      } catch (error) {
        if (error instanceof ThinkApiError) {
          if (error.action) {
            replaceActionInMessages(error.action);
          }
          setActionErrors((prev) => ({ ...prev, [actionId]: error.message }));
          pushToast({
            title: 'Could not dismiss action',
            description: error.message,
            variant: 'warning',
          });
        } else {
          const msg =
            error instanceof Error ? error.message : 'Unable to dismiss this action right now.';
          setActionErrors((prev) => ({ ...prev, [actionId]: msg }));
        }
      } finally {
        setBusyActionIds((prev) => ({ ...prev, [actionId]: false }));
      }
    },
    [busyActionIds, getAccessToken, pushToast, replaceActionInMessages]
  );

  const submitPrompt = useCallback(
    async (rawText: string) => {
      const trimmed = rawText.trim();
      if (!trimmed || isSending) return;
      if (trimmed.length > MAX_PROMPT_LENGTH) {
        setSendError(`Message must be ${MAX_PROMPT_LENGTH} characters or fewer.`);
        return;
      }

      const token = await getAccessToken();
      if (!token) return;

      setIsSending(true);
      setSendError(null);
      setFailedPrompt(null);

      let targetConversationId = activeConversationIdRef.current;

      try {
        if (!targetConversationId) {
          const created = await createThinkConversationRequest(token, {
            contextSource: draftContextSource,
          });
          if (!created || typeof created.id !== 'number') {
            throw new ThinkApiError({
              message: 'Received an incomplete conversation payload from THINK.',
              status: 502,
              code: 'INVALID_RESPONSE',
            });
          }
          setConversations((prev) => [created, ...prev]);
          setActiveConversationId(created.id);
          activeConversationIdRef.current = created.id;
          setMessages([]);
          setDraftContextSource('general');
          targetConversationId = created.id;
        }

        const result = await sendThinkMessageRequest(token, targetConversationId, trimmed);
        if (
          !result ||
          !result.userMessage ||
          !result.assistantMessage ||
          !result.conversation ||
          typeof result.conversation.id !== 'number' ||
          !result.quota
        ) {
          throw new ThinkApiError({
            message: 'Received an incomplete response from THINK. Please retry.',
            status: 502,
            code: 'INVALID_RESPONSE',
          });
        }

        const {
          userMessage,
          assistantMessage,
          conversation: updatedConversation,
          quota: updatedQuota,
        } = result;

        setMessages((prev) => [...prev, userMessage, assistantMessage]);
        setQuota(updatedQuota);
        setConversations((prev) => {
          const filtered = prev.filter((c) => c.id !== updatedConversation.id);
          return [updatedConversation, ...filtered];
        });
        setComposerText('');
      } catch (error) {
        if (error instanceof ThinkApiError) {
          if (error.quota) {
            setQuota(error.quota);
          }
          setSendError(error.message);
        } else {
          setSendError(
            error instanceof Error ? error.message : 'Unable to reach THINK right now.'
          );
        }
        setFailedPrompt(trimmed);
      } finally {
        setIsSending(false);
      }
    },
    [draftContextSource, getAccessToken, isSending]
  );

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submitPrompt(composerText);
  };

  const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submitPrompt(composerText);
    }
  };

  if (isAuthLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-[520px] w-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#F2F2F2]">
            THINK · Personal Intelligence Layer
          </h2>
          <p className="mt-1 text-sm text-[#A3A3A8]">
            Context-grounded reflection and planning workspace with editable, approval-gated PLAN &amp; LIVE actions.
          </p>
        </div>

        <Card tone="surface" padding="lg">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-lg font-semibold text-[#F2F2F2]">
                Sign in to use THINK
              </h3>
              <p className="mt-1 max-w-xl text-sm text-[#A3A3A8]">
                THINK conversations and action proposals are private to your account, stored
                persistently in PostgreSQL, and require your explicit approval before mutating PLAN
                or LIVE data.
              </p>
            </div>
            <Button
              variant="primary"
              size="md"
              leadingIcon={<LogIn className="h-4 w-4" />}
              disabled={isSigningIn}
              onClick={() => void signInWithGoogle()}
              className="bg-[#8C82E8] text-[#151515] hover:bg-[#9D94EE]"
            >
              {isSigningIn ? 'Signing in...' : 'Sign in with Google'}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const trimmedLength = composerText.trim().length;
  const isQuotaExhausted = quota !== null && quota.remaining <= 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#F2F2F2]">
            THINK · Clarity Workspace
          </h2>
          <p className="mt-1 text-xs text-[#A3A3A8] sm:text-sm">
            Grounded workspace reasoning · Editable, approval-gated PLAN &amp; LIVE actions
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={<PanelLeft className="h-3.5 w-3.5 text-[#8C82E8]" />}
            onClick={() => setMobileDrawerOpen(true)}
            className="lg:hidden"
          >
            Threads ({conversations.length})
          </Button>
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={
              <RefreshCw className={isLoadingList ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
            }
            disabled={isLoadingList || isSending}
            onClick={() => void loadWorkspace()}
          >
            Refresh
          </Button>
        </div>
      </div>

      {listError ? (
        <ErrorState
          title="Unable to load THINK workspace"
          description={listError}
          onRetry={() => void loadWorkspace()}
        />
      ) : (
        <Card tone="think" padding="none" className="overflow-hidden">
          <div className="flex min-h-[580px] max-h-[calc(100vh-230px)] flex-col lg:flex-row">
            <ConversationSidebar
              conversations={conversations}
              activeConversationId={activeConversationId}
              quota={quota}
              isLoading={isLoadingList}
              isCreating={isCreatingThread}
              onSelectConversation={handleSelectConversation}
              onCreateConversation={() => void handleCreateConversation()}
              onRequestDeleteConversation={(conv) => setDeleteTarget(conv)}
              mobileOpen={mobileDrawerOpen}
              onCloseMobile={() => setMobileDrawerOpen(false)}
            />

            {/* Main Chat Workspace */}
            <div className="flex min-w-0 flex-1 flex-col bg-[#1B1B1E]">
              {/* Active thread bar */}
              <div className="flex flex-col justify-between gap-3 border-b border-white/[0.08] px-4 py-3 sm:flex-row sm:items-center sm:px-6">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-[#F2F2F2]">
                    {activeConversation ? activeConversation.title : 'New conversation'}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-[#737378]">
                    <span>
                      {activeConversation
                        ? `${activeConversation.messageCount} ${
                            activeConversation.messageCount === 1 ? 'message' : 'messages'
                          }`
                        : 'Ready for your first prompt'}
                    </span>
                    {quota && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {quota.remaining}/{quota.dailyLimit} left today
                        </span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span className="text-[#A3A3A8]">{activeContextOption.description}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <label htmlFor="think-context-source" className="sr-only">
                    Context focus
                  </label>
                  <div className="relative inline-flex items-center">
                    <Compass
                      className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-[#8C82E8]"
                      aria-hidden="true"
                    />
                    <select
                      id="think-context-source"
                      aria-label="Conversation context focus"
                      value={effectiveContextSource}
                      disabled={isSending || isUpdatingContext || isCreatingThread}
                      onChange={(e) =>
                        void handleChangeContextSource(e.target.value as ThinkContextSource)
                      }
                      className="h-8 rounded-lg border border-white/[0.09] bg-[#26262A] pl-8 pr-3 text-xs font-medium text-[#F2F2F2] focus:border-[#8C82E8]/60 focus:outline-none focus:ring-2 focus:ring-[#8C82E8]/50 disabled:opacity-50 cursor-pointer"
                    >
                      {THINK_CONTEXT_SOURCE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          Focus: {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    leadingIcon={<Plus className="h-3.5 w-3.5 text-[#8C82E8]" />}
                    disabled={isCreatingThread || isSending}
                    onClick={() => void handleCreateConversation()}
                    className="hidden sm:inline-flex"
                  >
                    New thread
                  </Button>
                </div>
              </div>

              {/* Scrollable message history */}
              <div className="flex-1 overflow-y-auto">
                <MessageList
                  messages={messages}
                  contextSource={effectiveContextSource}
                  entityOptions={entityOptions}
                  busyActionIds={busyActionIds}
                  actionErrors={actionErrors}
                  isLoadingMessages={isLoadingMessages}
                  isSending={isSending}
                  onSelectStarterPrompt={(prompt) => {
                    setComposerText(prompt);
                    setSendError(null);
                  }}
                  onApproveAction={handleApproveAction}
                  onRejectAction={handleRejectAction}
                  onNavigate={onNavigate}
                />
                <div ref={threadEndRef} />
              </div>

              {/* Error banner with safe retry */}
              {sendError && (
                <div className="border-t border-[#E06C75]/25 bg-[#E06C75]/[0.07] px-4 py-3 sm:px-6">
                  <ErrorState
                    title="THINK request failed"
                    description={sendError}
                    onRetry={
                      failedPrompt && !isSending
                        ? () => {
                            void submitPrompt(failedPrompt);
                          }
                        : undefined
                    }
                  />
                </div>
              )}

              {/* Message Composer */}
              <form
                onSubmit={handleFormSubmit}
                className="border-t border-white/[0.08] bg-[#202020] p-3.5 sm:p-4"
              >
                <div className="flex flex-col gap-2.5 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1">
                    <label htmlFor="think-composer-input" className="sr-only">
                      Ask THINK
                    </label>
                    <textarea
                      id="think-composer-input"
                      rows={2}
                      value={composerText}
                      onChange={(e) => setComposerText(e.target.value)}
                      onKeyDown={handleComposerKeyDown}
                      maxLength={MAX_PROMPT_LENGTH}
                      disabled={isSending || isQuotaExhausted}
                      placeholder={
                        isQuotaExhausted
                          ? 'Daily 24h THINK message quota reached. Please check back later.'
                          : 'Ask THINK to plan tasks, schedule blocks, propose habits/routines, or log workouts... (Enter to send)'
                      }
                      className="w-full resize-none rounded-xl border border-white/[0.09] bg-[#292929] px-3.5 py-2.5 text-sm text-[#F2F2F2] placeholder:text-[#737378] focus:border-[#8C82E8]/60 focus:outline-none focus:ring-2 focus:ring-[#8C82E8]/40 disabled:opacity-50"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                    <span className="font-mono text-[11px] tabular-nums text-[#737378]">
                      {trimmedLength}/{MAX_PROMPT_LENGTH}
                    </span>
                    <Button
                      type="submit"
                      size="md"
                      variant="primary"
                      disabled={
                        isSending ||
                        isQuotaExhausted ||
                        trimmedLength === 0 ||
                        trimmedLength > MAX_PROMPT_LENGTH
                      }
                      leadingIcon={<Send className="h-3.5 w-3.5" />}
                      className="bg-[#8C82E8] text-[#151515] hover:bg-[#9D94EE]"
                    >
                      {isSending ? 'Thinking...' : 'Send'}
                    </Button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </Card>
      )}

      {/* Delete conversation confirmation dialog */}
      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => {
          if (!isDeleting) setDeleteTarget(null);
        }}
        title="Delete conversation"
        subtitle={
          deleteTarget
            ? `Permanently delete "${deleteTarget.title}" and all of its messages?`
            : undefined
        }
        maxWidthClass="max-w-md"
      >
        <p className="text-xs leading-relaxed text-[#A3A3A8]">
          This permanently removes the thread from your PostgreSQL conversation history and cannot
          be undone.
        </p>
        <div className="mt-5 flex items-center justify-end gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            disabled={isDeleting}
            onClick={() => setDeleteTarget(null)}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={isDeleting}
            onClick={() => void handleConfirmDeleteConversation()}
          >
            {isDeleting ? 'Deleting...' : 'Delete thread'}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
