import React from 'react';
import { cn } from '../../lib/cn';

export type CardTone = 'surface' | 'elevated' | 'coral' | 'mint' | 'blue' | 'think';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: CardTone;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const TONE_CLASSES: Record<CardTone, string> = {
  surface: 'bg-[#202020] border border-white/[0.07] text-[#F2F2F2]',
  elevated: 'bg-[#292929] border border-white/[0.09] text-[#F2F2F2]',
  coral: 'bg-[#E59585] text-[#151515] border border-transparent',
  mint: 'bg-[#96D2C5] text-[#151515] border border-transparent',
  blue: 'bg-[#A9C8E9] text-[#151515] border border-transparent',
  think: 'bg-[#202020] border border-[#8C82E8]/30 text-[#F2F2F2]',
};

const PADDING_CLASSES = {
  none: 'p-0',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
};

export function Card({
  tone = 'surface',
  padding = 'md',
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl transition-colors duration-150',
        TONE_CLASSES[tone],
        PADDING_CLASSES[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
