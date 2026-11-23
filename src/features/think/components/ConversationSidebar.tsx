import React from 'react';
import { MessageSquare, Plus, Trash2, X } from 'lucide-react';
import { cn } from '../../../lib/cn';
import type { ThinkConversationSummary, ThinkQuotaStatus } from '../../../types/think';
import { Button, Skeleton } from '../../../components/ui';
import { getContextSourceOption } from '../utils/groundingUi';

interface ConversationSidebarProps {
  conversations: ThinkConversationSummary[];
  activeConversationId: number | null;
  quota: ThinkQuotaStatus | null;
  isLoading: boolean;
  isCreating: boolean;
  onSelectConversation: (conversationId: number) => void;
  onCreateConversation: () => void;
  onRequestDeleteConversation: (conversation: ThinkConversationSummary) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

function formatConversationTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function ConversationSidebar({
  conversations,
  activeConversationId,
  quota,
  isLoading,
  isCreating,
  onSelectConversation,
  onCreateConversation,
  onRequestDeleteConversation,
  mobileOpen,
  onCloseMobile,
}: ConversationSidebarProps) {
  const renderPanelContent = (isDrawer: boolean) => (
    <div className="flex h-full flex-col bg-[#202020]">
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] px-4 py-3.5">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-[#F2F2F2]">Threads</h3>
          <p className="text-[11px] text-[#737378]">
            {conversations.length}{' '}
            {conversations.length === 1 ? 'conversation' : 'conversations'}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={<Plus className="h-3.5 w-3.5 text-[#8C82E8]" />}
            disabled={isCreating}
            onClick={() => {
              onCreateConversation();
              if (isDrawer) onCloseMobile();
            }}
            className="border-[#8C82E8]/35 bg-[#8C82E8]/12 text-[#F2F2F2] hover:bg-[#8C82E8]/20"
          >
            New
          </Button>
          {isDrawer && (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close threads drawer"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#A3A3A8] hover:bg-white/[0.06] hover:text-[#F2F2F2] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2.5 space-y-1">
        {isLoading ? (
          <div className="space-y-2 p-1.5">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <MessageSquare className="mx-auto h-5 w-5 text-[#737378]" />
            <p className="mt-2 text-xs font-medium text-[#A3A3A8]">No saved threads yet</p>
            <p className="mt-1 text-[11px] leading-relaxed text-[#737378]">
              Start a conversation on the right or create a new thread.
            </p>
          </div>
        ) : (
          conversations.map((conv) => {
            const isActive = conv.id === activeConversationId;
            return (
              <div
                key={conv.id}
                className={cn(
                  'group flex items-start justify-between gap-2 rounded-xl px-3 py-2.5 transition-colors',
                  isActive
                    ? 'bg-[#292929] border border-[#8C82E8]/35'
                    : 'border border-transparent hover:bg-[#262626]'
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    onSelectConversation(conv.id);
                    if (isDrawer) onCloseMobile();
                  }}
                  className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C82E8] rounded-lg cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        'truncate text-xs font-semibold',
                        isActive ? 'text-[#F2F2F2]' : 'text-[#D6D6DA]'
                      )}
                    >
                      {conv.title}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] tabular-nums text-[#737378]">
                      {formatConversationTimestamp(conv.updatedAt)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-[11px] text-[#737378]">
                    {conv.contextSource !== 'general' && (
                      <span className="font-medium text-[#A69FF0]">
                        {getContextSourceOption(conv.contextSource).shortLabel}
                        {' · '}
                      </span>
                    )}
                    {conv.lastMessagePreview || 'Empty thread · ready for your prompt'}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => onRequestDeleteConversation(conv)}
                  aria-label={`Delete conversation "${conv.title}"`}
                  title="Delete conversation"
                  className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#737378] opacity-80 transition-colors hover:bg-[#E06C75]/15 hover:text-[#E06C75] hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E06C75] cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {quota && (
        <div className="border-t border-white/[0.08] px-4 py-3">
          <div className="flex items-center justify-between text-[11px] text-[#A3A3A8]">
            <span>24h message quota</span>
            <span className="font-mono tabular-nums text-[#F2F2F2]">
              {quota.usedToday}/{quota.dailyLimit}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#292929]">
            <div
              className="h-full rounded-full bg-[#8C82E8] transition-all duration-300"
              style={{
                width: `${Math.min(
                  100,
                  quota.dailyLimit > 0 ? Math.round((quota.usedToday / quota.dailyLimit) * 100) : 0
                )}%`,
              }}
            />
          </div>
          <p className="mt-1 font-mono text-[10px] tabular-nums text-[#737378]">
            {quota.remaining} remaining in rolling 24h window
          </p>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop persistent thread rail */}
      <aside className="hidden lg:block lg:w-[280px] lg:shrink-0 border-r border-white/[0.08]">
        {renderPanelContent(false)}
      </aside>

      {/* Tablet & Mobile slide-over conversation drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="THINK conversations"
        >
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-[2px]"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full w-[300px] max-w-[85vw] border-r border-white/[0.1] shadow-2xl">
            {renderPanelContent(true)}
          </div>
        </div>
      )}
    </>
  );
}
