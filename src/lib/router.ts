import React, { useCallback, useEffect, useState } from 'react';
import { LiveSubTab, PlanSubTab, PrimaryRoute, RouteState } from '../types/marly';

const PLAN_TABS: PlanSubTab[] = ['tasks', 'calendar', 'projects', 'goals'];
const LIVE_TABS: LiveSubTab[] = ['calendar', 'matrix', 'heatmap', 'habits', 'fitness'];

export function parseRoute(pathname: string, search = ''): RouteState {
  const clean = pathname.replace(/\/+$/, '') || '/';
  const segments = clean.split('/').filter(Boolean);
  const normalizedSearch = search && !search.startsWith('?') ? `?${search}` : search;

  if (segments.length === 0) {
    return {
      path: '/',
      search: normalizedSearch,
      section: 'home',
      planTab: 'tasks',
      liveTab: 'calendar',
      isNotFound: false,
    };
  }

  const head = segments[0] as PrimaryRoute;
  const sub = segments[1];

  switch (head) {
    case 'plan': {
      const hasValidSub = !sub || PLAN_TABS.includes(sub as PlanSubTab);
      const planTab = PLAN_TABS.includes(sub as PlanSubTab) ? (sub as PlanSubTab) : 'tasks';
      return {
        path: `/plan/${planTab}`,
        search: normalizedSearch,
        section: 'plan',
        planTab,
        liveTab: 'calendar',
        isNotFound: segments.length > 2 || !hasValidSub,
      };
    }
    case 'live': {
      const hasValidSub = !sub || LIVE_TABS.includes(sub as LiveSubTab);
      const liveTab = LIVE_TABS.includes(sub as LiveSubTab) ? (sub as LiveSubTab) : 'calendar';
      return {
        path: `/live/${liveTab}`,
        search: normalizedSearch,
        section: 'live',
        planTab: 'tasks',
        liveTab,
        isNotFound: segments.length > 2 || !hasValidSub,
      };
    }
    case 'think':
      return {
        path: '/think',
        search: normalizedSearch,
        section: 'think',
        planTab: 'tasks',
        liveTab: 'calendar',
        isNotFound: segments.length > 1,
      };
    case 'statistics':
      return {
        path: '/statistics',
        search: normalizedSearch,
        section: 'statistics',
        planTab: 'tasks',
        liveTab: 'calendar',
        isNotFound: segments.length > 1,
      };
    case 'settings':
      return {
        path: '/settings',
        search: normalizedSearch,
        section: 'settings',
        planTab: 'tasks',
        liveTab: 'calendar',
        isNotFound: segments.length > 1,
      };
    default:
      return {
        path: clean,
        search: normalizedSearch,
        section: 'home',
        planTab: 'tasks',
        liveTab: 'calendar',
        isNotFound: true,
      };
  }
}

export function useMarlyRoute() {
  const [route, setRoute] = useState<RouteState>(() => {
    if (typeof window === 'undefined') {
      return parseRoute('/');
    }
    const parsed = parseRoute(window.location.pathname, window.location.search);
    // Normalize canonical aliases like /plan -> /plan/tasks or /live -> /live/calendar
    if (!parsed.isNotFound && window.location.pathname !== parsed.path) {
      window.history.replaceState(
        {},
        '',
        `${parsed.path}${window.location.search}${window.location.hash}`
      );
    }
    return parsed;
  });

  useEffect(() => {
    const handleLocationSync = () => {
      const parsed = parseRoute(window.location.pathname, window.location.search);
      if (!parsed.isNotFound && window.location.pathname !== parsed.path) {
        window.history.replaceState(
          {},
          '',
          `${parsed.path}${window.location.search}${window.location.hash}`
        );
      }
      setRoute(parsed);
    };
    window.addEventListener('popstate', handleLocationSync);
    window.addEventListener('marly:searchchange', handleLocationSync);
    return () => {
      window.removeEventListener('popstate', handleLocationSync);
      window.removeEventListener('marly:searchchange', handleLocationSync);
    };
  }, []);

  const navigate = useCallback((targetPath: string) => {
    const prevPath = typeof window !== 'undefined' ? window.location.pathname : '';
    const url =
      typeof window !== 'undefined'
        ? new URL(targetPath, window.location.origin)
        : { pathname: targetPath, search: '', hash: '' };
    const next = parseRoute(url.pathname, url.search);
    const fullTarget = `${next.path}${url.search}${url.hash}`;

    if (
      typeof window !== 'undefined' &&
      `${window.location.pathname}${window.location.search}${window.location.hash}` !== fullTarget
    ) {
      window.history.pushState({}, '', fullTarget);
    }
    setRoute(next);
    if (typeof window !== 'undefined' && (!url.search || prevPath !== next.path)) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  return { route, navigate };
}

/**
 * Allows <a href="..."> elements to use client-side navigation on normal clicks
 * while preserving native Cmd/Ctrl/Shift/middle-click new-tab behavior.
 */
export function handleSpaLinkClick(
  event: React.MouseEvent<HTMLAnchorElement>,
  targetPath: string,
  navigate: (path: string) => void,
  afterNavigate?: () => void
) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return;
  }
  event.preventDefault();
  navigate(targetPath);
  afterNavigate?.();
}
