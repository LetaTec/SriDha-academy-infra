import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import cx from 'classnames/bind';

import { buildRainWords } from './subjectRainData';
import styles from './FallingSubjectRain.module.css';

const cn = cx.bind(styles);

// Words beyond these ranks are hidden by CSS on smaller screens.
const TABLET_WORD_LIMIT = 18;
const MOBILE_WORD_LIMIT = 10;

// Decorative background of slowly falling subject names. Motion is pure CSS
// (transform and opacity) driven by per-word custom properties, so React renders
// once and never per frame. The layer is fixed behind the page content and
// ignores pointer input.
export const FallingSubjectRain = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const words = useMemo(buildRainWords, []);

  // Stop the animation work while the tab is hidden.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const sync = () => {
      root.dataset.paused = String(document.hidden);
    };

    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);

  return (
    <div ref={rootRef} className={cn('rain')} aria-hidden="true">
      {words.map((word, index) => (
        <span
          key={word.id}
          className={cn(
            'word',
            `tone-${word.tone}`,
            word.serif ? 'serif' : 'sans',
            {
              hiddenOnTablet: index >= TABLET_WORD_LIMIT,
              hiddenOnMobile: index >= MOBILE_WORD_LIMIT,
            },
          )}
          style={
            {
              '--left': `${word.left}%`,
              '--size': word.size,
              '--peak': word.opacity,
              '--duration': `${word.durationSeconds}s`,
              '--delay': `${word.delaySeconds}s`,
              '--drift': word.driftVw,
              '--tilt': `${word.tiltDeg}deg`,
              '--weight': word.weight,
              '--rest': `${word.restVh}vh`,
            } as CSSProperties
          }
        >
          {word.text}
        </span>
      ))}
    </div>
  );
};
