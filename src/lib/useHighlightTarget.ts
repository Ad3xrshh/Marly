import { useEffect, useState } from 'react';

export function parsePositiveIdQueryParam(search: string, paramName: string): number | null {
  if (!search) return null;
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
  const raw = params.get(paramName);
  if (!raw || !/^\d+$/.test(raw.trim())) return null;
  const parsed = Number(raw.trim());
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function buildUrlWithoutQueryParams(
  pathname: string,
  search: string,
  hash: string,
  paramNames: string[]
): string {
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
  let changed = false;
  for (const name of paramNames) {
    if (params.has(name)) {
      params.delete(name);
      changed = true;
    }
  }
  if (!changed) {
    return `${pathname}${search}${hash}`;
  }
  const nextSearch = params.toString();
  return `${pathname}${nextSearch ? `?${nextSearch}` : ''}${hash}`;
}

export function stripQueryParamsFromBrowserUrl(paramNames: string[]): void {
  if (typeof window === 'undefined') return;
  const nextUrl = buildUrlWithoutQueryParams(
    window.location.pathname,
    window.location.search,
    window.location.hash,
    paramNames
  );
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (nextUrl !== currentUrl) {
    window.history.replaceState({}, '', nextUrl);
    window.dispatchEvent(new Event('marly:searchchange'));
  }
}

export function scrollElementIntoViewSafe(element: HTMLElement | null): void {
  if (!element || typeof window === 'undefined') return;
  const prefersReducedMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  element.scrollIntoView({
    behavior: prefersReducedMotion ? 'auto' : 'smooth',
    block: 'center',
  });
}

export function useTemporaryEntityHighlight(params: {
  targetId: number | null;
  paramNamesToStrip: string[];
  isReady: boolean;
  entityExists: boolean;
  selectorPrefix: string;
  durationMs?: number;
}): number | null {
  const {
    targetId,
    paramNamesToStrip,
    isReady,
    entityExists,
    selectorPrefix,
    durationMs = 2800,
  } = params;
  const [activeHighlightId, setActiveHighlightId] = useState<number | null>(null);

  useEffect(() => {
    if (targetId === null || !isReady) return;
    setActiveHighlightId(entityExists ? targetId : null);
    stripQueryParamsFromBrowserUrl(paramNamesToStrip);
  }, [targetId, isReady, entityExists, paramNamesToStrip]);

  useEffect(() => {
    if (activeHighlightId === null || typeof window === 'undefined') return;
    const rafId = window.requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(
        `[data-think-target="${selectorPrefix}-${activeHighlightId}"]`
      );
      scrollElementIntoViewSafe(el);
    });
    const timerId = window.setTimeout(() => {
      setActiveHighlightId((current) => (current === activeHighlightId ? null : current));
    }, durationMs);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timerId);
    };
  }, [activeHighlightId, selectorPrefix, durationMs]);

  return activeHighlightId;
}
