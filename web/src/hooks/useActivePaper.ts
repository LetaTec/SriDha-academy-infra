import { useSyncExternalStore } from 'react';

// The paper a student is in the middle of: which one, where it lives, when
// its clock runs out and the answers so far. Kept in this browser, so the
// clock keeps running when the student opens another page (or reloads),
// and the header can offer "Continue your paper". Only one paper is in
// progress at a time; starting another replaces it.
export type ActivePaper = {
  // Identifies the paper, e.g. "topic:topic_accounts_gst_class_11"
  key: string;
  // Shown on the header card, e.g. "GST · Class 11"
  title: string;
  // The page the paper is on, with its query, e.g. "/topic-tests/…"
  href: string;
  // When the clock runs out, in milliseconds since the epoch
  endsAt: number;
  answers: Record<string, string>;
};

const STORAGE_KEY = 'sridha-active-paper';
// A paper whose time ran out more than a day ago is forgotten, so an
// unfinished paper does not linger on the header for good
const FORGET_AFTER_MS = 24 * 60 * 60 * 1000;

const listeners = new Set<() => void>();
// Read once per change, so every subscriber sees the same object
let cached: ActivePaper | null | undefined;

const isActivePaper = (value: unknown): value is ActivePaper => {
  if (typeof value !== 'object' || value === null) return false;
  const paper = value as Partial<ActivePaper>;
  return (
    typeof paper.key === 'string' &&
    typeof paper.title === 'string' &&
    typeof paper.href === 'string' &&
    typeof paper.endsAt === 'number' &&
    typeof paper.answers === 'object' &&
    paper.answers !== null
  );
};

const load = (): ActivePaper | null => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isActivePaper(parsed)) return null;
    return parsed.endsAt + FORGET_AFTER_MS > Date.now() ? parsed : null;
  } catch {
    // Storage blocked (private mode, site settings) or unreadable
    return null;
  }
};

const notify = () => {
  cached = undefined;
  listeners.forEach(listener => listener());
};

export const readActivePaper = (): ActivePaper | null => {
  if (cached === undefined) cached = load();
  return cached;
};

export const saveActivePaper = (paper: ActivePaper) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(paper));
  } catch {
    // Without storage the paper still works; it just is not kept
  }
  notify();
};

// Ends the paper in progress, or only the given one
export const clearActivePaper = (key?: string) => {
  if (key && readActivePaper()?.key !== key) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing was kept
  }
  notify();
};

// Papers on screen right now, by key, so the header's "Continue your
// paper" card hides while its paper is open (whatever the address)
const onScreen = new Map<string, number>();
let onScreenKeys = '';

const updateOnScreen = () => {
  onScreenKeys = [...onScreen.keys()].join('|');
  listeners.forEach(listener => listener());
};

// Marks a paper as on screen; returns the function that unmarks it
export const showPaperOnScreen = (key: string) => {
  onScreen.set(key, (onScreen.get(key) ?? 0) + 1);
  updateOnScreen();
  return () => {
    const count = (onScreen.get(key) ?? 1) - 1;
    if (count > 0) onScreen.set(key, count);
    else onScreen.delete(key);
    updateOnScreen();
  };
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  // Another tab started, answered or finished a paper
  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) notify();
  };
  window.addEventListener('storage', handleStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', handleStorage);
  };
};

export const useActivePaper = (): ActivePaper | null =>
  useSyncExternalStore(subscribe, readActivePaper, () => null);

export const useIsPaperOnScreen = (key: string | null) =>
  useSyncExternalStore(
    subscribe,
    () => key !== null && onScreenKeys.split('|').includes(key),
    () => false,
  );
