export type RainTone = 'forest' | 'gold' | 'charcoal';
export type RainDepth = 'far' | 'mid' | 'near';

export type RainWord = {
  id: string;
  text: string;
  tone: RainTone;
  depth: RainDepth;
  serif: boolean;
  weight: number;
  /** Horizontal start, percent of the viewport width. */
  left: number;
  /** Font size in px at desktop scale. */
  size: number;
  /** Peak opacity of the word while it is on screen. */
  opacity: number;
  durationSeconds: number;
  /** Negative, so the rain is already mid-fall on first paint. */
  delaySeconds: number;
  /** Horizontal drift over one fall, in vw. */
  driftVw: number;
  /** Constant tilt in degrees; most words stay upright. */
  tiltDeg: number;
  /** Resting height in vh, used only by the reduced-motion layout. */
  restVh: number;
};

type RainSubject = readonly [text: string, depth: RainDepth];

// Subjects and topics from the SriDha catalogue, interleaved across Commerce,
// Mathematics, Science and the rest so no discipline clusters together. The
// large foreground words come first: responsive CSS hides words from the end
// of this list, so small screens keep the strongest ones.
export const RAIN_SUBJECTS: readonly RainSubject[] = [
  ['Accountancy', 'near'],
  ['Probability', 'mid'],
  ['Physics', 'mid'],
  ['Economics', 'near'],
  ['GST', 'far'],
  ['Mathematics', 'near'],
  ['English', 'far'],
  ['Cost Accounting', 'mid'],
  ['Chemistry', 'mid'],
  ['Statistics', 'near'],
  ['Income Tax', 'far'],
  ['Biology', 'mid'],
  ['Business Studies', 'mid'],
  ['Calculus', 'far'],
  ['Financial Accounting', 'mid'],
  ['Data Interpretation', 'far'],
  ['Corporate Law', 'far'],
  ['Science', 'near'],
  ['Partnership Accounts', 'mid'],
  ['Quantitative Aptitude', 'far'],
  ['Logical Reasoning', 'mid'],
  ['Banking Reasoning', 'far'],
  ['Business Mathematics', 'far'],
  ['Financial Management', 'mid'],
  ['Journal Entries', 'far'],
  ['Trial Balance', 'mid'],
  ['Bank Reconciliation', 'far'],
  ['Input Tax Credit', 'far'],
];

// Small deterministic generator: the layout is varied but identical on every
// render, so React never re-renders to different markup and tests are stable.
const createRandom = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

type Range = readonly [number, number];

const between = (random: () => number, [min, max]: Range) =>
  min + random() * (max - min);

// Fall time, peak opacity and size per depth layer. Nearer words are larger,
// stronger and faster, which is what gives the rain its depth.
const DEPTH_PROFILE = {
  far: { size: [15, 19], opacity: [0.22, 0.28], duration: [18, 24] },
  mid: { size: [21, 28], opacity: [0.3, 0.38], duration: [12, 17] },
  near: { size: [38, 58], opacity: [0.38, 0.48], duration: [9, 13] },
} as const;

const TONES: readonly RainTone[] = [
  'forest',
  'forest',
  'gold',
  'forest',
  'charcoal',
  'forest',
  'gold',
  'forest',
];

// Slots are spread over the width, then visited with a stride coprime to the
// slot count, so any prefix of the list is still evenly distributed.
const SLOT_STRIDE = 11;

export const buildRainWords = (): RainWord[] => {
  const random = createRandom(20260430);
  const count = RAIN_SUBJECTS.length;

  return RAIN_SUBJECTS.map(([text, depth], index) => {
    const profile = DEPTH_PROFILE[depth];
    const slot = (index * SLOT_STRIDE) % count;
    const duration = between(random, profile.duration);
    const serif = depth === 'near' || index % 3 === 0;
    // About one word in three leans slightly; the rest stay upright.
    const tilt = index % 3 === 1 ? between(random, [-2.5, 2.5]) : 0;

    return {
      id: `${index}-${text}`,
      text,
      tone: TONES[index % TONES.length],
      depth,
      serif,
      weight: serif
        ? depth === 'near'
          ? 600
          : 500
        : depth === 'far'
          ? 400
          : 500,
      left: ((slot + between(random, [0.05, 0.7])) / count) * 92 + 1,
      size: Math.round(between(random, profile.size)),
      opacity: Number(between(random, profile.opacity).toFixed(3)),
      durationSeconds: Number(duration.toFixed(1)),
      delaySeconds: -Number((random() * duration).toFixed(1)),
      driftVw: Number(between(random, [-4, 4]).toFixed(2)),
      tiltDeg: Number(tilt.toFixed(1)),
      restVh: Math.round(between(random, [6, 94])),
    };
  });
};
