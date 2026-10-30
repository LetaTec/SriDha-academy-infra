import { render } from '@testing-library/react';

import { FallingSubjectRain } from './FallingSubjectRain';
import { buildRainWords, RAIN_SUBJECTS } from './subjectRainData';

const FALL_SECONDS = {
  far: [18, 24],
  mid: [12, 17],
  near: [9, 13],
} as const;

describe('FallingSubjectRain', () => {
  it('is decorative and renders every subject once', () => {
    const { container } = render(<FallingSubjectRain />);
    const root = container.firstElementChild as HTMLElement;

    expect(root).toHaveAttribute('aria-hidden', 'true');
    expect(root.children).toHaveLength(RAIN_SUBJECTS.length);
  });

  it('pauses while the tab is hidden and resumes when visible', () => {
    const { container } = render(<FallingSubjectRain />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.dataset.paused).toBe('false');

    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(root.dataset.paused).toBe('true');

    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(root.dataset.paused).toBe('false');
  });

  it('keeps words inside the viewport width, staggered and low-contrast', () => {
    const words = buildRainWords();

    for (const word of words) {
      expect(word.left).toBeGreaterThanOrEqual(0);
      expect(word.left).toBeLessThan(95);
      expect(word.delaySeconds).toBeLessThanOrEqual(0);
      expect(word.opacity).toBeGreaterThanOrEqual(0.22);
      expect(word.opacity).toBeLessThanOrEqual(0.48);
    }
    expect(
      new Set(words.map(word => word.durationSeconds)).size,
    ).toBeGreaterThan(words.length / 2);
  });

  it('uses each subject once and falls within the layer timing', () => {
    const words = buildRainWords();

    expect(new Set(words.map(word => word.text)).size).toBe(words.length);
    for (const word of words) {
      const [min, max] = FALL_SECONDS[word.depth];
      expect(word.durationSeconds).toBeGreaterThanOrEqual(min);
      expect(word.durationSeconds).toBeLessThanOrEqual(max);
    }
  });
});
