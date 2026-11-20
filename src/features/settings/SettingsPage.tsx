import React, { useState } from 'react';
import { Globe, Palette, Shield } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  PreviewNotice,
  ProgressRing,
  SegmentedTabs,
  Skeleton,
} from '../../components/ui';

type ShowcaseState = 'populated' | 'loading' | 'empty' | 'error';

export function SettingsPage() {
  const { pushToast } = useToast();
  const [showcaseState, setShowcaseState] = useState<ShowcaseState>('populated');
  const [sampleInput, setSampleInput] = useState('America/Los_Angeles');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-[#F2F2F2]">
          Settings & Design System
        </h2>
        <p className="mt-1 text-sm text-[#A3A3A8]">
          Workspace configuration previews and reusable Phase 1 UI state primitives.
        </p>
      </div>

      <PreviewNotice
        accent="blue"
        title="Settings Persistence Deferred"
        phaseLabel="Phase 3+ Backend"
        description="Account profile, Firebase Authentication, and timezone persistence will be wired in Phase 3+. Below you can inspect Marly's reusable UI kit states."
      />

      {/* Settings Preview Cards */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card tone="surface" padding="lg">
          <div className="flex items-center gap-2.5 text-sm font-semibold text-[#F2F2F2]">
            <Globe className="h-4 w-4 text-[#A9C8E9]" />
            <span>Timezone & Local Dates</span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[#A3A3A8]">
            Habit logs use explicit local calendar dates (<code className="font-mono">YYYY-MM-DD</code>) rather than UTC timestamps.
          </p>
          <div className="mt-4">
            <Input
              label="Preview Timezone (local only)"
              value={sampleInput}
              onChange={(e) => setSampleInput(e.target.value)}
              onClear={() => setSampleInput('')}
            />
          </div>
        </Card>

        <Card tone="surface" padding="lg">
          <div className="flex items-center gap-2.5 text-sm font-semibold text-[#F2F2F2]">
            <Palette className="h-4 w-4 text-[#E59585]" />
            <span>Theme & Tokens</span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[#A3A3A8]">
            Dark-first `#151515` canvas · `#202020` surface · Manrope + JetBrains Mono.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              { name: 'Coral', hex: '#E59585' },
              { name: 'Mint', hex: '#96D2C5' },
              { name: 'Orange', hex: '#F19A50' },
              { name: 'Blue', hex: '#A9C8E9' },
              { name: 'Purple', hex: '#8C82E8' },
            ].map((swatch) => (
              <div
                key={swatch.name}
                className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[#262626] px-2.5 py-1.5 text-xs"
              >
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: swatch.hex }}
                />
                <span className="text-[#F2F2F2]">{swatch.name}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card tone="surface" padding="lg">
          <div className="flex items-center gap-2.5 text-sm font-semibold text-[#F2F2F2]">
            <Shield className="h-4 w-4 text-[#96D2C5]" />
            <span>Authentication Boundary</span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[#A3A3A8]">
            No auth is active in Phase 1. Future phases will enforce per-user ownership server-side via Firebase Auth + PostgreSQL.
          </p>
          <div className="mt-4">
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                pushToast({
                  title: 'Toast system check',
                  description: 'Phase 1 notification stack is active.',
                  variant: 'demo',
                })
              }
            >
              Test Toast Notification
            </Button>
          </div>
        </Card>
      </div>

      {/* Interactive UI Kit & State Showcase */}
      <Card tone="surface" padding="lg">
        <div className="flex flex-col justify-between gap-4 border-b border-white/[0.07] pb-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-base font-semibold text-[#F2F2F2]">
              Reusable UI Kit · State Showcase
            </h3>
            <p className="text-xs text-[#A3A3A8]">
              Switch states to verify Marly's standardized loading, empty, error, and populated components.
            </p>
          </div>
          <SegmentedTabs
            options={[
              { value: 'populated', label: 'Populated' },
              { value: 'loading', label: 'Loading' },
              { value: 'empty', label: 'Empty' },
              { value: 'error', label: 'Error' },
            ]}
            value={showcaseState}
            onChange={setShowcaseState}
          />
        </div>

        <div className="mt-5">
          {showcaseState === 'populated' && (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-[#262626] p-4">
              <div className="flex items-center gap-4">
                <ProgressRing value={82} tone="mint" size={52} />
                <div>
                  <p className="text-sm font-semibold text-[#F2F2F2]">
                    Design System Primitives Verified
                  </p>
                  <p className="text-xs text-[#A3A3A8]">
                    Buttons, cards, checkboxes, rings, dialogs, toasts, and state fallbacks ready.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" size="sm">Primary</Button>
                <Button variant="coral" size="sm">Coral</Button>
                <Button variant="mint" size="sm">Mint</Button>
                <Button variant="secondary" size="sm">Secondary</Button>
              </div>
            </div>
          )}

          {showcaseState === 'loading' && (
            <div className="space-y-3 rounded-xl border border-white/[0.07] bg-[#1A1A1A] p-4">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-5/6" />
            </div>
          )}

          {showcaseState === 'empty' && (
            <EmptyState
              title="No items logged yet"
              description="Empty states clearly explain what will appear once real data exists and provide a calm primary next step."
              actionLabel="Return to Populated"
              onAction={() => setShowcaseState('populated')}
            />
          )}

          {showcaseState === 'error' && (
            <ErrorState
              title="Failed to fetch records"
              description="Error states surface the issue plainly without breaking surrounding layout structure."
              onRetry={() => setShowcaseState('populated')}
            />
          )}
        </div>
      </Card>
    </div>
  );
}
