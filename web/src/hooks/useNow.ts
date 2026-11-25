import { useEffect, useState } from 'react';

const SECOND_MS = 1000;

// The time now (milliseconds since the epoch), updated every second while
// ticking, for clocks that count down
export const useNow = (isTicking = true) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isTicking) return undefined;
    const interval = window.setInterval(() => setNow(Date.now()), SECOND_MS);
    return () => window.clearInterval(interval);
  }, [isTicking]);

  return now;
};
