import React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leadingIcon?: React.ReactNode;
  onClear?: () => void;
}

export function Input({
  label,
  error,
  leadingIcon,
  onClear,
  className,
  id,
  value,
  ...props
}: InputProps) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  const showClear = Boolean(onClear && typeof value === 'string' && value.length > 0);

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-xs font-medium text-[#A3A3A8]">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {leadingIcon && (
          <span className="pointer-events-none absolute left-3.5 text-[#737378]">
            {leadingIcon}
          </span>
        )}
        <input
          id={inputId}
          value={value}
          className={cn(
            'h-10 w-full rounded-xl border bg-[#262626] text-sm text-[#F2F2F2] placeholder:text-[#737378] transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#E59585]/70',
            error ? 'border-[#E06C75]/60' : 'border-white/[0.08] focus:border-white/20',
            leadingIcon ? 'pl-10' : 'pl-3.5',
            showClear ? 'pr-9' : 'pr-3.5',
            className
          )}
          {...props}
        />
        {showClear && onClear && (
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear input"
            className="absolute right-2.5 rounded-md p-1 text-[#737378] transition-colors hover:bg-white/10 hover:text-[#F2F2F2] cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-[#E06C75]">{error}</p>}
    </div>
  );
}
