import { useCallback, useEffect, useRef, useState } from 'react';

// How long one card holds before the track glides to the next. The glide
// itself (SLIDE_MS) is part of this, so each card is readable for about 4.6s.
export const HERO_ROTATION_MS = 5500;
export const SLIDE_MS = 900;

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const getPrefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia(REDUCED_MOTION_QUERY).matches;

const isFormField = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && target.closest('form') !== null;

const modulo = (value: number, count: number) =>
  count === 0 ? 0 : ((value % count) + count) % count;

export type HeroRotation = {
  // Unbounded track position: it keeps counting as the carousel loops, so the
  // track only ever slides and never has to jump back.
  position: number;
  activeIndex: number;
  // True when the rotation is stopped on purpose: the student paused it or
  // picked a topic to read.
  isHeld: boolean;
  prefersReducedMotion: boolean;
  // Temporary stops, driven by the pointer and keyboard.
  pause: () => void;
  resume: () => void;
  // Choosing a topic holds the panel on it.
  select: (index: number) => void;
  // The explicit pause/resume control.
  toggle: () => void;
  // Manual steps, used by the controls and by swiping.
  next: () => void;
  previous: () => void;
};

// Drives the rotating topic headline. It advances on a timer, stops for
// hover/focus, holds a topic the student chose, and stays still for
// reduced-motion users.
export const useHeroRotation = (count: number): HeroRotation => {
  const [position, setPosition] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isHeld, setIsHeld] = useState(false);
  const [isHidden, setIsHidden] = useState(
    () => typeof document !== 'undefined' && document.hidden,
  );
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    getPrefersReducedMotion,
  );
  const isStoppedRef = useRef(isPaused || isHeld || isHidden);
  isStoppedRef.current = isPaused || isHeld || isHidden;
  const activeIndex = modulo(position, count);

  useEffect(() => {
    setPosition(value => (count === 0 ? 0 : modulo(value, count)));
  }, [count]);

  // No point sliding cards nobody can see.
  useEffect(() => {
    const sync = () => setIsHidden(document.hidden);
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const media = window.matchMedia(REDUCED_MOTION_QUERY);
    const handleChange = (event: MediaQueryListEvent) =>
      setPrefersReducedMotion(event.matches);

    setPrefersReducedMotion(media.matches);
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  const pause = useCallback(() => setIsPaused(true), []);
  const resume = useCallback(() => setIsPaused(false), []);
  const toggle = useCallback(() => {
    // Resuming through the control also overrides the hover pause, otherwise
    // the pointer sitting on the panel would keep it stopped.
    setIsPaused(false);
    setIsHeld(held => !held);
  }, []);

  const select = useCallback(
    (index: number) => {
      setIsHeld(true);
      setPosition(value => value + modulo(index - value, count));
    },
    [count],
  );

  // Stepping by hand holds the carousel on the card the student chose.
  const next = useCallback(() => {
    setIsHeld(true);
    setPosition(value => value + 1);
  }, []);

  const previous = useCallback(() => {
    setIsHeld(true);
    setPosition(value => value - 1);
  }, []);

  // A rotating panel beside a form is distracting: stop while any form field
  // on the page has focus, and start again when it leaves.
  useEffect(() => {
    const handleFocusIn = (event: FocusEvent) => {
      if (isFormField(event.target)) pause();
    };
    const handleFocusOut = (event: FocusEvent) => {
      if (!isFormField(event.relatedTarget)) resume();
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, [pause, resume]);

  useEffect(() => {
    if (isPaused || isHeld || isHidden || prefersReducedMotion || count < 2) {
      return;
    }

    const timer = window.setTimeout(() => {
      // A pause may have started between scheduling and firing.
      if (isStoppedRef.current) return;
      setPosition(value => value + 1);
    }, HERO_ROTATION_MS);

    return () => window.clearTimeout(timer);
  }, [position, count, isHeld, isHidden, isPaused, prefersReducedMotion]);

  return {
    position,
    activeIndex,
    isHeld,
    prefersReducedMotion,
    pause,
    resume,
    select,
    toggle,
    next,
    previous,
  };
};
