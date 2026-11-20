import React from 'react';
import { cn } from '../../lib/cn';

export type BadgeTone = 'neutral' | 'coral' | 'mint' | 'orange' | 'blue' | 'purple';

interface BadgeProps {
  tone?: BadgeTone;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const BADGE_STYLES: Record<BadgeTone, string> = {
  neutral: 'bg-white/[0.06] text-[#A3A3A8] border-white/[0.08]',
  coral: 'bg-[#E59585]/12 text-[#E59585] border-[#E59585]/25',
  mint: 'bg-[#96D2C5]/12 text-[#96D2C5] border-[#96D2C5]/25',
  orange: 'bg-[#F19A50]/12 text-[#F19A50] border-[#F19A50]/25',
  blue: 'bg-[#A9C8E9]/12 text-[#A9C8E9] border-[#A9C8E9]/25',
  purple: 'bg-[#8C82E8]/14 text-[#B4ADFF] border-[#8C82E8]/30',
};

/**
 * Semantic status label reserved strictly for explicit state or phase indicators
 * (never used for decorative card metadata).
 */
export function Badge({ tone = 'neutral', icon, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium whitespace-nowrap shrink-0',
        BADGE_STYLES[tone],
        className
      )}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
}
