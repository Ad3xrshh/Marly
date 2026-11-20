import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '../../lib/cn';

interface CheckboxProps {
  checked: boolean;
  onChange: () => void;
  label?: string;
  shape?: 'circle' | 'square';
  tone?: 'dark-accent' | 'mint' | 'blue' | 'coral';
  size?: 'sm' | 'md';
  hitTarget?: 'row' | 'cell';
  disabled?: boolean;
  ariaLabel?: string;
}

export function Checkbox({
  checked,
  onChange,
  label,
  shape = 'circle',
  tone = 'mint',
  size = 'md',
  hitTarget = 'row',
  disabled = false,
  ariaLabel,
}: CheckboxProps) {
  const sizeClass = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  const radiusClass = shape === 'circle' ? 'rounded-full' : 'rounded-md';

  const toneChecked = {
    'dark-accent': 'bg-[#151515] border-[#151515] text-[#E59585]',
    mint: 'bg-[#96D2C5] border-[#96D2C5] text-[#151515]',
    blue: 'bg-[#A9C8E9] border-[#A9C8E9] text-[#151515]',
    coral: 'bg-[#E59585] border-[#E59585] text-[#151515]',
  };

  const toneUnchecked = {
    'dark-accent': 'border-[#151515]/55 bg-transparent hover:border-[#151515]',
    mint: 'border-white/25 bg-transparent hover:border-[#96D2C5]',
    blue: 'border-white/25 bg-transparent hover:border-[#A9C8E9]',
    coral: 'border-white/25 bg-transparent hover:border-[#E59585]',
  };

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel || label}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        'inline-flex items-center rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E59585] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50',
        label
          ? 'min-h-9 min-w-0 flex-1 gap-2.5'
          : hitTarget === 'cell'
            ? 'min-h-10 min-w-10 justify-center'
            : 'min-h-9 min-w-9 -m-2 justify-center'
      )}
    >
      <span
        className={cn(
          'inline-flex items-center justify-center shrink-0 border-[1.5px] transition-all duration-150',
          sizeClass,
          radiusClass,
          checked ? toneChecked[tone] : toneUnchecked[tone]
        )}
      >
        {checked && (
          <Check className={size === 'sm' ? 'h-2.5 w-2.5 stroke-[3]' : 'h-3 w-3 stroke-[3]'} />
        )}
      </span>
      {label && <span className="min-w-0 flex-1 truncate text-sm text-current">{label}</span>}
    </button>
  );
}
