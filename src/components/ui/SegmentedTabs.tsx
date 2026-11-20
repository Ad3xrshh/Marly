import React from 'react';
import { cn } from '../../lib/cn';

export interface SegmentedTabOption<T extends string> {
  value: T;
  label: string;
  count?: number;
  href?: string;
}

interface SegmentedTabsProps<T extends string> {
  options: SegmentedTabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  variant?: 'pill-filter' | 'surface';
  className?: string;
}

export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
  variant = 'surface',
  className,
}: SegmentedTabsProps<T>) {
  const handleTabLinkClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    tabValue: T
  ) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }
    e.preventDefault();
    onChange(tabValue);
  };

  if (variant === 'pill-filter') {
    return (
      <div className={cn('flex flex-wrap items-center gap-2', className)} role="tablist">
        {options.map((option) => {
          const active = option.value === value;
          const classes = cn(
            'inline-flex h-9 items-center gap-1.5 rounded-full border px-4 text-xs font-medium whitespace-nowrap shrink-0 transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E59585]',
            active
              ? 'border-[#F2F2F2] bg-transparent text-[#F2F2F2]'
              : 'border-white/[0.12] bg-transparent text-[#A3A3A8] hover:border-white/25 hover:text-[#F2F2F2]'
          );

          const inner = (
            <>
              <span>{option.label}</span>
              {typeof option.count === 'number' && (
                <span className="font-mono tabular-nums text-[11px] opacity-80">({option.count})</span>
              )}
            </>
          );

          if (option.href) {
            return (
              <a
                key={option.value}
                href={option.href}
                role="tab"
                aria-selected={active}
                onClick={(e) => handleTabLinkClick(e, option.value)}
                className={classes}
              >
                {inner}
              </a>
            );
          }

          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(option.value)}
              className={classes}
            >
              {inner}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex flex-wrap items-center gap-1 rounded-xl border border-white/[0.07] bg-[#1A1A1A] p-1',
        className
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        const classes = cn(
          'inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-xs font-medium whitespace-nowrap shrink-0 transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E59585]',
          active
            ? 'bg-[#292929] text-[#F2F2F2] shadow-sm'
            : 'text-[#A3A3A8] hover:text-[#F2F2F2]'
        );

        const inner = (
          <>
            <span>{option.label}</span>
            {typeof option.count === 'number' && (
              <span className="font-mono tabular-nums text-[11px] text-[#737378]">{option.count}</span>
            )}
          </>
        );

        if (option.href) {
          return (
            <a
              key={option.value}
              href={option.href}
              role="tab"
              aria-selected={active}
              onClick={(e) => handleTabLinkClick(e, option.value)}
              className={classes}
            >
              {inner}
            </a>
          );
        }

        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={classes}
          >
            {inner}
          </button>
        );
      })}
    </div>
  );
}
