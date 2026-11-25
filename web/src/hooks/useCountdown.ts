import { useCallback, useEffect, useRef, useState } from 'react';

const TICK_MS = 250;

// A countdown that starts on demand. Remaining time is measured from the
// clock, not by counting ticks, so it stays accurate in background tabs.
export const useCountdown = (durationSeconds: number, onExpire: () => void) => {
  const [secondsLeft, setSecondsLeft] = useState(durationSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const endsAt = useRef(0);
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    if (!isRunning) return undefined;

    const tick = () => {
      const remaining = (endsAt.current - Date.now()) / 1000;
      if (remaining <= 0) {
        setSecondsLeft(0);
        setIsRunning(false);
        onExpireRef.current();
      } else {
        setSecondsLeft(remaining);
      }
    };

    const interval = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(interval);
  }, [isRunning]);

  // Starts a full clock, or carries on one that ends at the given moment
  // (milliseconds since the epoch), e.g. a paper resumed on return.
  // Returns when the clock runs out.
  const start = useCallback(
    (resumeEndsAt?: number) => {
      endsAt.current = resumeEndsAt ?? Date.now() + durationSeconds * 1000;
      setSecondsLeft(Math.max(0, (endsAt.current - Date.now()) / 1000));
      setIsRunning(true);
      return endsAt.current;
    },
    [durationSeconds],
  );

  const stop = useCallback(() => setIsRunning(false), []);

  const reset = useCallback(() => {
    setIsRunning(false);
    setSecondsLeft(durationSeconds);
  }, [durationSeconds]);

  return { secondsLeft, isRunning, start, stop, reset };
};
