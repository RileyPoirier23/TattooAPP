// Minimal client-side router built on the History API.
import React, { useSyncExternalStore } from 'react';

const listeners = new Set<() => void>();
const notify = () => listeners.forEach(l => l());

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

const getLocation = () => window.location.pathname + window.location.search;

let leaveGuard: (() => boolean) | null = null;
let current = getLocation();

/** Registers a check that runs before leaving the page, e.g. "Leave without saving?". Return false to stay. */
export function setLeaveGuard(guard: (() => boolean) | null) {
  leaveGuard = guard;
}

/** Goes to another page of the site. Returns false if the visitor chose to stay (unsaved changes). */
export function navigate(to: string, opts: { replace?: boolean } = {}): boolean {
  if (to === getLocation()) return true;
  if (leaveGuard && !leaveGuard()) return false;
  if (opts.replace) window.history.replaceState({}, '', to);
  else window.history.pushState({}, '', to);
  current = getLocation();
  if (!opts.replace) window.scrollTo(0, 0);
  notify();
  return true;
}

// Back/forward buttons: the address has already changed, so put it back if the visitor decides to stay.
window.addEventListener('popstate', () => {
  const next = getLocation();
  if (next !== current && leaveGuard && !leaveGuard()) {
    window.history.pushState({}, '', current);
    return;
  }
  current = next;
  notify();
});

export function useLocation() {
  const loc = useSyncExternalStore(subscribe, getLocation);
  const url = new URL(loc, window.location.origin);
  return { path: url.pathname, query: url.searchParams, href: loc };
}

/** Matches "/artists/:id" style patterns; returns params or null. */
export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split('/').filter(Boolean);
  const s = path.split('/').filter(Boolean);
  if (p.length !== s.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(s[i]);
    else if (p[i] !== s[i]) return null;
  }
  return params;
}

export const Link: React.FC<React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }> = ({ to, onClick, children, ...rest }) => (
  <a
    href={to}
    onClick={e => {
      onClick?.(e);
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0 || rest.target === '_blank') return;
      e.preventDefault();
      navigate(to);
    }}
    {...rest}
  >
    {children}
  </a>
);
