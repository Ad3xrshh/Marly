import React from 'react';
import { cn } from '../../lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'coral' | 'mint' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: React.ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-[#F2F2F2] text-[#151515] hover:bg-white active:scale-[0.98] font-semibold',
  secondary:
    'bg-[#292929] text-[#F2F2F2] border border-white/[0.1] hover:bg-[#323232] hover:border-white/[0.18]',
  ghost:
    'bg-transparent text-[#A3A3A8] hover:bg-white/[0.06] hover:text-[#F2F2F2]',
  coral:
    'bg-[#E59585] text-[#151515] hover:bg-[#ECA495] font-semibold',
  mint:
    'bg-[#96D2C5] text-[#151515] hover:bg-[#A8DDD1] font-semibold',
  danger:
    'bg-[#E06C75]/15 text-[#E06C75] border border-[#E06C75]/30 hover:bg-[#E06C75]/25',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5 text-xs rounded-lg gap-1.5',
  md: 'h-10 px-4 text-sm rounded-xl gap-2',
  lg: 'h-11 px-5 text-sm rounded-xl gap-2',
};

export function Button({
  variant = 'primary',
  size = 'md',
  leadingIcon,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap shrink-0 font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E59585] focus-visible:ring-offset-2 focus-visible:ring-offset-[#151515] disabled:pointer-events-none disabled:opacity-45 cursor-pointer',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className
      )}
      {...props}
    >
      {leadingIcon && <span className="shrink-0">{leadingIcon}</span>}
      <span>{children}</span>
    </button>
  );
}

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'light' | 'ghost' | 'on-accent';
  size?: 'sm' | 'md';
  label: string;
}

export function IconButton({
  variant = 'default',
  size = 'md',
  label,
  className,
  children,
  type = 'button',
  ...props
}: IconButtonProps) {
  const styles = {
    default: 'bg-[#292929] text-[#F2F2F2] border border-white/[0.08] hover:bg-[#343434]',
    light: 'bg-[#F2F2F2] text-[#151515] hover:bg-white',
    ghost: 'bg-transparent text-[#A3A3A8] hover:bg-white/[0.06] hover:text-[#F2F2F2]',
    'on-accent': 'bg-[#151515]/10 text-[#151515] hover:bg-[#151515]/20',
  };

  const sizes = {
    sm: 'h-9 w-9 rounded-full',
    md: 'h-10 w-10 rounded-full',
  };

  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex items-center justify-center shrink-0 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E59585] cursor-pointer disabled:opacity-40',
        styles[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
