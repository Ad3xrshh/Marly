import React from 'react';
import { CalendarRange, LogIn, RefreshCw } from 'lucide-react';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  SegmentedTabs,
  Skeleton,
} from '../../components/ui';
import { useStatisticsData } from '../../hooks/useStatisticsData';
import type { StatisticsPeriodPreset } from '../../types/statistics';
import { LiveAnalyticsSection } from './components/LiveAnalyticsSection';
import { OverviewKpiGrid } from './components/OverviewKpiGrid';
import { PlanAnalyticsSection } from './components/PlanAnalyticsSection';

interface StatisticsPageProps {
  onNavigate?: (path: string) => void;
}

const PERIOD_TABS: Array<{ value: StatisticsPeriodPreset; label: string }> = [
  { value: '7d', label: 'Last 7d' },
  { value: 'week', label: 'Current Week' },
  { value: '30d', label: 'Last 30d' },
  { value: 'month', label: 'Current Month' },
  { value: '90d', label: 'Last 90d' },
  { value: 'ytd', label: 'Year to Date' },
  { value: 'custom', label: 'Custom' },
];

export function StatisticsPage({ onNavigate }: StatisticsPageProps) {
  const {
    isAuthenticated,
    isAuthLoading,
    isSigningIn,
    signInWithGoogle,
    preset,
    selectPreset,
    customFrom,
    setCustomFrom,
    customTo,
    setCustomTo,
    customValidationError,
    data,
    isLoading,
    error,
    refresh,
  } = useStatisticsData();

  if (isAuthLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#F2F2F2]">
            STATISTICS · Unified Progress
          </h2>
          <p className="mt-1 text-sm text-[#A3A3A8]">
            Cross-pillar analytics uniting PLAN execution and LIVE consistency across your persisted history.
          </p>
        </div>

        <Card tone="surface" padding="lg">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-lg font-semibold text-[#F2F2F2]">
                Sign in to view your statistics
              </h3>
              <p className="mt-1 max-w-xl text-sm text-[#A3A3A8]">
                Analyze your real task throughput, scheduled due-date follow-through, project &amp; goal momentum, schedule-aware habit adherence, workout volume, and routine step consistency.
              </p>
            </div>
            <Button
              variant="coral"
              size="md"
              leadingIcon={<LogIn className="h-4 w-4" />}
              disabled={isSigningIn}
              onClick={() => void signInWithGoogle()}
            >
              {isSigningIn ? 'Signing in...' : 'Sign in with Google'}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const hasZeroDataAcrossAccount =
    data !== null &&
    data.overview.tasks.completedInWindow === 0 &&
    data.overview.tasks.dueCohortTotal === 0 &&
    data.plan.tasks.currentOpenSnapshot.totalOpen === 0 &&
    data.plan.projects.statusCounts.active === 0 &&
    data.plan.projects.statusCounts.planned === 0 &&
    data.plan.projects.statusCounts.completed === 0 &&
    data.plan.goals.statusCounts.active === 0 &&
    data.plan.goals.statusCounts.planned === 0 &&
    data.plan.goals.statusCounts.completed === 0 &&
    data.live.habits.activeCount === 0 &&
    data.live.fitness.totalSessions === 0 &&
    data.live.routines.activeCount === 0 &&
    data.live.routines.totalLogsInWindow === 0;

  return (
    <div className="space-y-6">
      {/* Header & Period Controls */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#F2F2F2]">
            STATISTICS · Unified Progress
          </h2>
          <p className="mt-1 text-sm text-[#A3A3A8]">
            {data
              ? `${data.meta.from} to ${data.meta.to} (${data.meta.spanDays} days) · Timezone: ${data.meta.timezone}`
              : 'Cross-pillar analytics across PLAN commitments and LIVE consistency.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SegmentedTabs
            options={PERIOD_TABS}
            value={preset}
            onChange={(val) => selectPreset(val)}
          />
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={
              <RefreshCw
                className={isLoading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'}
              />
            }
            disabled={isLoading || Boolean(customValidationError)}
            onClick={() => void refresh()}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Custom Date Range Controls */}
      {preset === 'custom' && (
        <Card tone="surface" padding="md">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex items-center gap-2 self-center text-xs font-medium text-[#A3A3A8]">
              <CalendarRange className="h-4 w-4 text-[#F19A50]" />
              <span>Custom Range (max 366 days)</span>
            </div>
            <div className="w-40">
              <Input
                label="From"
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
            </div>
            <div className="w-40">
              <Input
                label="To"
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </div>
            {customValidationError && (
              <p className="self-center text-xs text-[#E06C75]">
                {customValidationError}
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Comparison note when suppressed */}
      {data && !data.meta.comparison.eligible && data.meta.comparison.reason && (
        <p className="text-xs text-[#737378]">
          {data.meta.comparison.reason}
        </p>
      )}

      {/* Error State */}
      {error && (
        <ErrorState
          title="Could not load statistics"
          description={error}
          onRetry={() => void refresh()}
        />
      )}

      {/* Loading Skeleton */}
      {isLoading && !data && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Skeleton className="h-36 w-full" />
            <Skeleton className="h-36 w-full" />
            <Skeleton className="h-36 w-full" />
            <Skeleton className="h-36 w-full" />
          </div>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            <Skeleton className="h-72 w-full lg:col-span-7" />
            <Skeleton className="h-72 w-full lg:col-span-5" />
          </div>
          <Skeleton className="h-72 w-full" />
        </div>
      )}

      {/* Empty Account State */}
      {data && hasZeroDataAcrossAccount && (
        <EmptyState
          title="No tracked activity yet"
          description="Start by adding tasks, projects, or goals in PLAN, or creating habits, workouts, and routines in LIVE. Your unified analytics will appear automatically."
          actionLabel={onNavigate ? 'Go to PLAN Tasks' : undefined}
          onAction={onNavigate ? () => onNavigate('/plan/tasks') : undefined}
        />
      )}

      {/* Main Analytics Content */}
      {data && !hasZeroDataAcrossAccount && (
        <div className="space-y-8">
          <OverviewKpiGrid
            overview={data.overview}
            comparison={data.meta.comparison}
          />
          <PlanAnalyticsSection
            plan={data.plan}
            granularity={data.meta.granularity}
            onNavigate={onNavigate}
          />
          <LiveAnalyticsSection
            live={data.live}
            granularity={data.meta.granularity}
            onNavigate={onNavigate}
          />
        </div>
      )}
    </div>
  );
}
