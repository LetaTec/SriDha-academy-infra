import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { SHOWCASE_SUBJECTS, type ShowcaseSubject } from './showcaseData';

export type DeckSlot = 'slot0' | 'slot1' | 'slot2' | 'slot3';

export type DeckCardItem = {
  subject: ShowcaseSubject;
  slot: DeckSlot;
  key: string;
};

export const SELECTOR_SUBJECTS: readonly ShowcaseSubject[] =
  SHOWCASE_SUBJECTS.slice(0, 6);

export const DECK_TIMING = {
  initialDelayMs: 1200,
  intervalMs: 4500,
} as const;

const getPrefersReducedMotion = (): boolean => {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

export const useSubjectShuffle = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    getPrefersReducedMotion,
  );
  const [activeId, setActiveId] = useState<string>(SELECTOR_SUBJECTS[0].id);
  const [isPaused, setIsPaused] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Monitor accessibility preferences
  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return;
    }

    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const pause = useCallback(() => {
    setIsPaused(true);
    clearTimer();
  }, [clearTimer]);

  const resume = useCallback(() => {
    setIsPaused(false);
  }, []);

  const selectSubject = useCallback(
    (id: string) => {
      setActiveId(id);
      // Explicit selection pauses rotation so the user maintains full control
      setIsPaused(true);
      clearTimer();
    },
    [clearTimer],
  );

  const triggerShuffle = useCallback(() => {
    setActiveId(currentId => {
      const currentIndex = SELECTOR_SUBJECTS.findIndex(s => s.id === currentId);
      const nextIndex =
        currentIndex >= 0 ? (currentIndex + 1) % SELECTOR_SUBJECTS.length : 0;
      return SELECTOR_SUBJECTS[nextIndex].id;
    });
  }, []);

  // Automatic rotation scheduling
  useEffect(() => {
    clearTimer();

    if (isPaused || prefersReducedMotion) {
      return;
    }

    timerRef.current = setTimeout(() => {
      triggerShuffle();
    }, DECK_TIMING.intervalMs);

    return () => {
      clearTimer();
    };
  }, [activeId, clearTimer, isPaused, prefersReducedMotion, triggerShuffle]);

  const activeSubject = useMemo(
    () =>
      SHOWCASE_SUBJECTS.find(s => s.id === activeId) ?? SHOWCASE_SUBJECTS[0],
    [activeId],
  );

  // Generate clean deckItems representation with exactly one slot0 hero and companion slots
  const deckItems = useMemo<readonly DeckCardItem[]>(() => {
    const others = SELECTOR_SUBJECTS.filter(s => s.id !== activeSubject.id);
    return [
      { subject: activeSubject, slot: 'slot0', key: activeSubject.id },
      {
        subject: others[0] ?? SHOWCASE_SUBJECTS[1],
        slot: 'slot1',
        key: (others[0] ?? SHOWCASE_SUBJECTS[1]).id,
      },
      {
        subject: others[1] ?? SHOWCASE_SUBJECTS[2],
        slot: 'slot2',
        key: (others[1] ?? SHOWCASE_SUBJECTS[2]).id,
      },
      {
        subject: others[2] ?? SHOWCASE_SUBJECTS[3],
        slot: 'slot3',
        key: (others[2] ?? SHOWCASE_SUBJECTS[3]).id,
      },
    ];
  }, [activeSubject]);

  return {
    activeSubject,
    activeId,
    selectorSubjects: SELECTOR_SUBJECTS,
    selectSubject,
    triggerShuffle,
    isPaused,
    pause,
    resume,
    deckItems,
    prefersReducedMotion,
  };
};
