import React from 'react';
import { cn } from '../../lib/cn';

interface BrandMarkProps {
  className?: string;
  size?: number;
}

/**
 * Restrained abstract lily-inspired emblem:
 * Three converging geometric petals symbolizing PLAN, LIVE, and THINK.
 */
export function BrandMark({ className, size = 28 }: BrandMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn('shrink-0', className)}
    >
      {/* Center upright petal */}
      <path
        d="M16 4C18.8 8.5 19.6 13.8 16 19.5C12.4 13.8 13.2 8.5 16 4Z"
        stroke="#F2F2F2"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      {/* Left unfolding petal (PLAN / Coral hint) */}
      <path
        d="M15.4 20.5C10.5 18.8 6.8 14.8 5.5 9.8C10.3 10.6 13.9 14.3 15.4 20.5Z"
        stroke="#E59585"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      {/* Right unfolding petal (LIVE / Mint hint) */}
      <path
        d="M16.6 20.5C21.5 18.8 25.2 14.8 26.5 9.8C21.7 10.6 18.1 14.3 16.6 20.5Z"
        stroke="#96D2C5"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      {/* Stem / grounding arc */}
      <path
        d="M11 25.5C12.8 23.6 14.3 22.8 16 22.8C17.7 22.8 19.2 23.6 21 25.5"
        stroke="#A3A3A8"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
