import React from 'react';
import { AlertTriangle, FlaskConical, Inbox, RotateCcw } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Button } from './Button';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.1] bg-[#1A1A1A]/60 px-6 py-10 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[#292929] text-[#A3A3A8]">
        {icon || <Inbox className="h-5 w-5" />}
      </div>
      <h3 className="text-sm font-semibold text-[#F2F2F2]">{title}</h3>
      <p className="mt-1 max-w-sm text-xs leading-relaxed text-[#A3A3A8]">{description}</p>
      {actionLabel && onAction && (
        <Button variant="secondary" size="sm" onClick={onAction} className="mt-4">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  description: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Unable to load section',
  description,
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-[#E06C75]/30 bg-[#E06C75]/[0.06] p-5 sm:flex-row sm:items-center">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E06C75]/15 text-[#E06C75]">
          <AlertTriangle className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[#F2F2F2]">{title}</h3>
          <p className="mt-0.5 text-xs text-[#A3A3A8]">{description}</p>
        </div>
      </div>
      {onRetry && (
        <Button
          variant="secondary"
          size="sm"
          leadingIcon={<RotateCcw className="h-3.5 w-3.5" />}
          onClick={onRetry}
        >
          Retry
        </Button>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-lg bg-white/[0.06]', className)}
    />
  );
}

interface PreviewNoticeProps {
  phaseLabel: string;
  title: string;
  description: string;
  accent?: 'coral' | 'mint' | 'orange' | 'blue' | 'purple';
  action?: React.ReactNode;
}

const NOTICE_ACCENTS = {
  coral: 'border-[#E59585]/25 bg-[#E59585]/[0.06]',
  mint: 'border-[#96D2C5]/25 bg-[#96D2C5]/[0.06]',
  orange: 'border-[#F19A50]/25 bg-[#F19A50]/[0.06]',
  blue: 'border-[#A9C8E9]/25 bg-[#A9C8E9]/[0.06]',
  purple: 'border-[#8C82E8]/30 bg-[#8C82E8]/[0.08]',
};

const ICON_ACCENTS = {
  coral: 'text-[#E59585]',
  mint: 'text-[#96D2C5]',
  orange: 'text-[#F19A50]',
  blue: 'text-[#A9C8E9]',
  purple: 'text-[#8C82E8]',
};

export function PreviewNotice({
  phaseLabel,
  title,
  description,
  accent = 'mint',
  action,
}: PreviewNoticeProps) {
  return (
    <div
      className={cn(
        'flex flex-col justify-between gap-3 rounded-2xl border px-4 py-3.5 sm:flex-row sm:items-center',
        NOTICE_ACCENTS[accent]
      )}
    >
      <div className="flex items-start gap-3">
        <FlaskConical className={cn('mt-0.5 h-4 w-4 shrink-0', ICON_ACCENTS[accent])} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-[#F2F2F2]">{title}</span>
            <span className="text-[#737378]" aria-hidden="true">·</span>
            <span className={cn('font-mono font-medium', ICON_ACCENTS[accent])}>{phaseLabel}</span>
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-[#A3A3A8]">{description}</p>
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
