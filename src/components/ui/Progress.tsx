import React from 'react';
import { cn } from '../../lib/cn';

interface ProgressBarProps {
  value: number;
  tone?: 'mint' | 'coral' | 'orange' | 'blue' | 'purple';
  trackClassName?: string;
  height?: 'sm' | 'md';
  showLabel?: boolean;
}

const BAR_TONES = {
  mint: 'bg-[#96D2C5]',
  coral: 'bg-[#E59585]',
  orange: 'bg-[#F19A50]',
  blue: 'bg-[#A9C8E9]',
  purple: 'bg-[#8C82E8]',
};

export function ProgressBar({
  value,
  tone = 'mint',
  trackClassName,
  height = 'sm',
  showLabel = false,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));

  return (
    <div className="flex items-center gap-3 w-full">
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        className={cn(
          'flex-1 overflow-hidden rounded-full bg-white/[0.08]',
          height === 'sm' ? 'h-1.5' : 'h-2.5',
          trackClassName
        )}
      >
        <div
          className={cn('h-full rounded-full transition-all duration-300', BAR_TONES[tone])}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span className="font-mono text-xs font-medium text-[#A3A3A8] tabular-nums w-9 text-right shrink-0">
          {clamped}%
        </span>
      )}
    </div>
  );
}

interface ProgressRingProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  tone?: 'mint' | 'coral' | 'orange' | 'blue';
  label?: string;
}

const RING_STROKE = {
  mint: '#96D2C5',
  coral: '#E59585',
  orange: '#F19A50',
  blue: '#A9C8E9',
};

export function ProgressRing({
  value,
  size = 56,
  strokeWidth = 5,
  tone = 'mint',
  label,
}: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={RING_STROKE[tone]}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-300"
        />
      </svg>
      <span className="absolute font-mono text-xs font-semibold text-[#F2F2F2] tabular-nums">
        {label ?? `${clamped}%`}
      </span>
    </div>
  );
}
