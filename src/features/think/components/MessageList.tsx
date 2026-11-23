import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  BrainCircuit,
  ChevronDown,
  ChevronUp,
  Compass,
  Info,
  Sparkles,
} from 'lucide-react';
import { Skeleton } from '../../../components/ui';
import type {
  ThinkContextSource,
  ThinkMessageDTO,
  ThinkMessageReferenceDTO,
} from '../../../types/think';
import {
  formatContextSummaryLine,
  formatDomainListLabels,
  formatEntityTypeLabel,
  formatEvidenceDomainLabel,
  getContextSourceOption,
  sanitizeThinkEvidence,
  sanitizeThinkReferences,
} from '../utils/groundingUi';
import { ActionProposalCard } from './ActionProposalCard';
import type { ThinkEntityOptions } from './PlanActionEditor';

interface MessageListProps {
  messages: ThinkMessageDTO[];
  contextSource: ThinkContextSource;
  entityOptions: ThinkEntityOptions;
  busyActionIds: Record<number, boolean>;
  actionErrors: Record<number, string | null>;
  isLoadingMessages: boolean;
  isSending: boolean;
  onSelectStarterPrompt: (prompt: string) => void;
  onApproveAction: (actionId: number, editedPayload?: Record<string, unknown>) => Promise<void>;
  onRejectAction: (actionId: number) => Promise<void>;
  onNavigate?: (path: string) => void;
}

function renderInlineMarkdown(text: string): React.ReactNode[] {
  const segments = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return segments.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-[#F2F2F2]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={idx}
          className="rounded bg-[#151515] px-1.5 py-0.5 font-mono text-[12px] text-[#8C82E8]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

function FormattedReplyBody({ content }: { content: string }) {
  const blocks = content.split(/\n{2,}/);

  return (
    <div className="space-y-3 text-sm leading-relaxed text-[#E3E3E7]">
      {blocks.map((block, blockIndex) => {
        const lines = block
          .split('\n')
          .map((l) => l.trimEnd())
          .filter((l) => l.trim().length > 0);

        if (lines.length === 0) return null;

        const isBulletList = lines.every((l) => /^[-*]\s+/.test(l.trim()));
        if (isBulletList) {
          return (
            <ul key={blockIndex} className="space-y-1.5 pl-4">
              {lines.map((line, i) => (
                <li key={i} className="list-disc text-[#D6D6DC]">
                  {renderInlineMarkdown(line.trim().replace(/^[-*]\s+/, ''))}
                </li>
              ))}
            </ul>
          );
        }

        const isOrderedList = lines.every((l) => /^\d+\.\s+/.test(l.trim()));
        if (isOrderedList) {
          return (
            <ol key={blockIndex} className="space-y-1.5 pl-5">
              {lines.map((line, i) => (
                <li key={i} className="list-decimal text-[#D6D6DC]">
                  {renderInlineMarkdown(line.trim().replace(/^\d+\.\s+/, ''))}
                </li>
              ))}
            </ol>
          );
        }

        if (lines.length === 1 && /^#{1,3}\s+/.test(lines[0].trim())) {
          const headingText = lines[0].trim().replace(/^#{1,3}\s+/, '');
          return (
            <h4 key={blockIndex} className="pt-1 text-sm font-semibold text-[#F2F2F2]">
              {renderInlineMarkdown(headingText)}
            </h4>
          );
        }

        return (
          <p key={blockIndex} className="whitespace-pre-wrap">
            {renderInlineMarkdown(lines.join('\n'))}
          </p>
        );
      })}
    </div>
  );
}

function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

interface AssistantGroundingBlockProps {
  message: ThinkMessageDTO;
  onNavigate?: (path: string) => void;
}

function AssistantGroundingBlock({ message, onNavigate }: AssistantGroundingBlockProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  const meta = message.meta;
  if (!meta) return null;

  const references = sanitizeThinkReferences(meta.references);
  const evidence = sanitizeThinkEvidence(meta.evidence);
  const context = meta.context;
  const summaryLine = formatContextSummaryLine(context);
  const consultedLabels = formatDomainListLabels(context?.domainsConsulted);
  const selectedLabels = formatDomainListLabels(context?.selectedDomains);
  const truncatedLabels = formatDomainListLabels(context?.truncatedDomains);
  const degradedLabels = formatDomainListLabels(context?.degradedDomains);

  const insufficientContext = meta.insufficientContext === true;
  const uncertaintyNote =
    typeof meta.uncertaintyNote === 'string' && meta.uncertaintyNote.trim().length > 0
      ? meta.uncertaintyNote.trim()
      : null;
  const isDegraded = context?.degraded === true;

  const hasNotice = insufficientContext || uncertaintyNote !== null || isDegraded;
  const hasTransparencyDetails =
    evidence.length > 0 ||
    summaryLine !== null ||
    truncatedLabels.length > 0 ||
    Boolean(context?.timezone);

  if (references.length === 0 && !hasNotice && !hasTransparencyDetails) {
    return null;
  }

  const refLookup = new Map<string, ThinkMessageReferenceDTO>();
  for (const ref of references) {
    refLookup.set(`${ref.entityType}:${ref.entityId}`, ref);
  }

  return (
    <div className="mt-4 space-y-3 border-t border-white/[0.08] pt-3.5">
      {/* Grounded Notice: Insufficient Context / Uncertainty / Degraded Retrieval */}
      {hasNotice && (
        <div
          role="note"
          className="flex items-start gap-2.5 rounded-xl border border-[#F19A50]/25 bg-[#F19A50]/[0.06] px-3 py-2.5 text-xs leading-relaxed text-[#E9C8A6]"
        >
          {isDegraded ? (
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#F19A50]" />
          ) : (
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#F19A50]" />
          )}
          <div className="space-y-1">
            {isDegraded && (
              <p>
                <span className="font-medium text-[#F5D9BC]">Partial workspace context:</span>{' '}
                {degradedLabels.length > 0
                  ? `${degradedLabels.join(', ')} could not be fully loaded for this turn.`
                  : 'Some workspace data could not be loaded for this turn.'}
              </p>
            )}
            {uncertaintyNote ? (
              <p>{uncertaintyNote}</p>
            ) : (
              insufficientContext && (
                <p>
                  Available workspace data did not fully cover this request; recommendations reflect
                  what was loaded.
                </p>
              )
            )}
          </div>
        </div>
      )}

      {/* Verified Navigable Workspace References */}
      {references.length > 0 && (
        <div>
          <div className="text-[11px] font-medium text-[#A3A3A8]">
            Referenced in your workspace
          </div>
          <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {references.map((ref) => {
              const typeLabel = formatEntityTypeLabel(ref.entityType);
              return (
                <button
                  key={`${ref.entityType}-${ref.entityId}`}
                  type="button"
                  disabled={!onNavigate}
                  onClick={() => onNavigate?.(ref.targetRoute)}
                  className="group flex items-center justify-between gap-2.5 rounded-xl border border-white/[0.08] bg-[#1D1D21] px-3 py-2 text-left transition-colors hover:border-[#8C82E8]/45 hover:bg-[#24242B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C82E8] disabled:cursor-default disabled:hover:border-white/[0.08] cursor-pointer"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="font-medium text-[#A69FF0]">{typeLabel}</span>
                      {ref.detail && (
                        <>
                          <span className="text-[#737378]" aria-hidden="true">
                            ·
                          </span>
                          <span className="truncate font-mono text-[10px] tabular-nums text-[#737378]">
                            {ref.detail}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="mt-0.5 truncate text-xs font-medium text-[#F2F2F2]">
                      {ref.label}
                    </div>
                  </div>
                  {onNavigate && (
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[#737378] transition-colors group-hover:text-[#8C82E8]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Context & Evidence Transparency */}
      {hasTransparencyDetails && (
        <div className="rounded-xl border border-white/[0.06] bg-[#1E1E22] px-3 py-2">
          <button
            type="button"
            aria-expanded={detailsOpen}
            onClick={() => setDetailsOpen((prev) => !prev)}
            className="flex w-full items-center justify-between gap-2 text-left text-[11px] text-[#A3A3A8] transition-colors hover:text-[#F2F2F2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C82E8] rounded cursor-pointer"
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <Compass className="h-3.5 w-3.5 shrink-0 text-[#8C82E8]" />
              <span className="truncate font-mono text-[11px] tabular-nums">
                {summaryLine ?? 'Context & Evidence'}
              </span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-[#8C82E8]">
              <span>{detailsOpen ? 'Hide details' : 'Context & Evidence'}</span>
              {detailsOpen ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </span>
          </button>

          {detailsOpen && (
            <div className="mt-2.5 space-y-2.5 border-t border-white/[0.06] pt-2.5 text-xs">
              {evidence.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-medium text-[#A3A3A8]">
                    Supporting Evidence
                  </div>
                  <ul className="space-y-1.5">
                    {evidence.map((ev, idx) => {
                      const linkedRef =
                        ev.entityType && ev.entityId
                          ? refLookup.get(`${ev.entityType}:${ev.entityId}`)
                          : undefined;
                      return (
                        <li
                          key={idx}
                          className="flex items-start justify-between gap-2 rounded-lg bg-[#17171A] px-2.5 py-2 text-[#D6D6DC]"
                        >
                          <div className="min-w-0 flex-1 leading-relaxed">
                            <span className="mr-1.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-[#A69FF0]">
                              {formatEvidenceDomainLabel(ev.sourceDomain)}
                            </span>
                            <span>{ev.claim}</span>
                          </div>
                          {linkedRef && onNavigate && (
                            <button
                              type="button"
                              onClick={() => onNavigate(linkedRef.targetRoute)}
                              aria-label={`Open ${linkedRef.label}`}
                              className="inline-flex shrink-0 items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-medium text-[#8C82E8] hover:bg-[#8C82E8]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C82E8] cursor-pointer"
                            >
                              <span>Open</span>
                              <ArrowUpRight className="h-3 w-3" />
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {context && (
                <div className="space-y-1 text-[11px] text-[#737378]">
                  {consultedLabels.length > 0 && (
                    <div>
                      <span className="text-[#A3A3A8]">Consulted:</span>{' '}
                      <span>{consultedLabels.join(', ')}</span>
                      {selectedLabels.length > consultedLabels.length && (
                        <span> (selected: {selectedLabels.join(', ')})</span>
                      )}
                    </div>
                  )}
                  <div className="font-mono tabular-nums">
                    {context.windowLabel && <span>Window: {context.windowLabel}</span>}
                    {context.windowLabel && context.timezone && <span aria-hidden="true"> · </span>}
                    {context.timezone && (
                      <span>
                        Timezone:{' '}
                        {context.timezoneInitialized
                          ? context.timezone
                          : `${context.timezone} (default)`}
                      </span>
                    )}
                  </div>
                  {truncatedLabels.length > 0 && (
                    <div className="text-[#A3A3A8]">
                      Bounded snapshot applied for {truncatedLabels.join(', ')} to keep context
                      focused.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function MessageList({
  messages,
  contextSource,
  entityOptions,
  busyActionIds,
  actionErrors,
  isLoadingMessages,
  isSending,
  onSelectStarterPrompt,
  onApproveAction,
  onRejectAction,
  onNavigate,
}: MessageListProps) {
  if (isLoadingMessages) {
    return (
      <div className="space-y-4 p-5 sm:p-6">
        <Skeleton className="ml-auto h-16 w-2/3 max-w-md" />
        <Skeleton className="h-32 w-4/5 max-w-xl" />
        <Skeleton className="ml-auto h-14 w-1/2 max-w-sm" />
      </div>
    );
  }

  if (messages.length === 0 && !isSending) {
    const contextOption = getContextSourceOption(contextSource);

    return (
      <div className="flex flex-1 flex-col items-center justify-center px-5 py-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#8C82E8]/35 bg-[#8C82E8]/12 text-[#8C82E8]">
          <BrainCircuit className="h-6 w-6" />
        </div>
        <h3 className="mt-4 text-base font-semibold text-[#F2F2F2]">
          {contextOption.value === 'general'
            ? 'Plan and reflect with your live Marly workspace'
            : `Focused on ${contextOption.shortLabel}`}
        </h3>
        <p className="mt-1.5 max-w-md text-xs leading-relaxed text-[#A3A3A8]">
          {contextOption.description} Every proposed task, event, milestone, habit, routine, or
          workout remains approval-gated before saving.
        </p>

        <div className="mt-6 grid w-full max-w-xl grid-cols-1 gap-2.5 text-left">
          {contextOption.starterPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onSelectStarterPrompt(prompt)}
              className="group flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#262626] px-4 py-3 text-left text-xs leading-relaxed text-[#D6D6DC] transition-colors hover:border-[#8C82E8]/45 hover:bg-[#2C2C32] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C82E8] cursor-pointer"
            >
              <span>{prompt}</span>
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[#737378] transition-colors group-hover:text-[#8C82E8]" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4 sm:p-6">
      {messages.map((msg) => {
        const isUser = msg.role === 'user';
        if (isUser) {
          return (
            <div key={msg.id} className="flex flex-col items-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-sm border border-[#8C82E8]/30 bg-[#8C82E8]/14 px-4 py-3 text-sm leading-relaxed text-[#F2F2F2] sm:max-w-[75%]">
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
              <span className="mt-1 font-mono text-[10px] tabular-nums text-[#737378]">
                You · {formatMessageTime(msg.createdAt)}
              </span>
            </div>
          );
        }

        const highlights = Array.isArray(msg.meta?.highlights) ? msg.meta.highlights : [];
        const followUps = Array.isArray(msg.meta?.followUpSuggestions)
          ? msg.meta.followUpSuggestions
          : [];
        const actions = msg.actions ?? [];

        return (
          <div key={msg.id} className="flex flex-col items-start gap-3">
            <div className="w-full max-w-[92%] rounded-2xl rounded-bl-sm border border-white/[0.08] bg-[#252528] px-4 py-4 sm:max-w-[84%] sm:px-5">
              <div className="mb-2.5 flex items-center gap-2 text-[11px] font-medium text-[#8C82E8]">
                <Sparkles className="h-3.5 w-3.5" />
                <span>THINK</span>
                <span className="text-[#737378]" aria-hidden="true">
                  ·
                </span>
                <span className="font-mono tabular-nums text-[#737378]">
                  {formatMessageTime(msg.createdAt)}
                </span>
              </div>

              <FormattedReplyBody content={msg.content} />

              {highlights.length > 0 && (
                <div className="mt-4 border-t border-white/[0.08] pt-3">
                  <div className="text-[11px] font-semibold text-[#A3A3A8]">Key Takeaways</div>
                  <ul className="mt-2 space-y-1.5 pl-4">
                    {highlights.map((item, idx) => (
                      <li
                        key={idx}
                        className="list-disc text-xs leading-relaxed text-[#D6D6DC] marker:text-[#8C82E8]"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <AssistantGroundingBlock message={msg} onNavigate={onNavigate} />

              {followUps.length > 0 && (
                <div className="mt-4 border-t border-white/[0.08] pt-3">
                  <div className="text-[11px] text-[#737378]">Continue exploring</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {followUps.map((suggestion, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => onSelectStarterPrompt(suggestion)}
                        className="rounded-xl border border-white/[0.09] bg-[#1D1D20] px-3 py-1.5 text-left text-xs text-[#D6D6DC] transition-colors hover:border-[#8C82E8]/45 hover:text-[#F2F2F2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C82E8] cursor-pointer"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {actions.length > 0 && (
              <div className="w-full max-w-[92%] space-y-2.5 sm:max-w-[84%]">
                <div className="flex items-center gap-2 px-1 text-[11px] font-medium text-[#A3A3A8]">
                  <span>Proposed Actions ({actions.length})</span>
                  <span className="text-[#737378]" aria-hidden="true">
                    ·
                  </span>
                  <span className="text-[#737378]">Review or edit before applying</span>
                </div>
                {actions.map((action) => (
                  <ActionProposalCard
                    key={action.id}
                    action={action}
                    entityOptions={entityOptions}
                    isBusy={Boolean(busyActionIds[action.id])}
                    inlineError={actionErrors[action.id]}
                    onApprove={onApproveAction}
                    onReject={onRejectAction}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {isSending && (
        <div className="flex items-start">
          <div className="rounded-2xl rounded-bl-sm border border-[#8C82E8]/25 bg-[#252528] px-4 py-3.5">
            <div className="flex items-center gap-2.5 text-xs text-[#A3A3A8]">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#8C82E8]" />
              <span>THINK is gathering workspace context and composing a grounded reply...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
