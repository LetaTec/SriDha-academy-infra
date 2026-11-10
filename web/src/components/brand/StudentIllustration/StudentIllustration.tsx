import type { CSSProperties } from 'react';
import cx from 'classnames/bind';

import styles from './StudentIllustration.module.css';

const cn = cx.bind(styles);

export type StudentScene =
  'ledger' | 'charts' | 'molecule' | 'equations' | 'reading' | 'puzzle';

export type StudentPalette = 'forest' | 'gold' | 'sage';

export type StudentIllustrationProps = {
  scene: StudentScene;
  palette?: StudentPalette;
  // Decorative by default. Pass a label when the picture carries meaning the
  // surrounding text does not.
  label?: string;
  className?: string;
};

// One student, one desk, one prop per subject. Every scene shares the same
// figure so the set reads as a single illustration system; only the palette,
// hair and prop change.
const PALETTE: Record<StudentPalette, Record<string, string>> = {
  forest: {
    '--shirt': 'var(--color-bg-inverse)',
    '--hair': 'var(--color-illus-hair)',
    '--skin': 'var(--color-illus-skin)',
    '--tint': 'var(--color-illus-sage)',
  },
  gold: {
    '--shirt': 'var(--color-accent)',
    '--hair': '#4a3426',
    '--skin': 'var(--color-illus-skin-deep)',
    '--tint': 'var(--color-illus-sand)',
  },
  sage: {
    '--shirt': 'var(--color-text-primary)',
    '--hair': 'var(--color-illus-hair)',
    '--skin': 'var(--color-illus-skin)',
    '--tint': 'var(--color-illus-sky)',
  },
};

const LONG_HAIR: Record<StudentPalette, boolean> = {
  forest: false,
  gold: true,
  sage: false,
};

const Figure = ({ longHair }: { longHair: boolean }) => (
  <g>
    {longHair ? (
      <path
        d="M74 70 Q66 104 76 118 L90 112 L90 70 Z M126 70 Q134 104 124 118 L110 112 L110 70 Z"
        className={cn('hair')}
      />
    ) : null}
    {/* torso and neck */}
    <path
      d="M54 184 L54 134 Q54 112 78 108 L122 108 Q146 112 146 134 L146 184 Z"
      className={cn('shirt')}
    />
    <rect x="91" y="92" width="18" height="20" rx="6" className={cn('skin')} />
    <path d="M90 108 L100 120 L110 108 Z" className={cn('collar')} />
    {/* head */}
    <circle cx="76" cy="78" r="4.5" className={cn('skin')} />
    <circle cx="124" cy="78" r="4.5" className={cn('skin')} />
    <ellipse cx="100" cy="76" rx="24" ry="27" className={cn('skin')} />
    <path
      d="M75 72 Q74 46 100 46 Q126 46 125 72 Q118 58 100 58 Q82 58 75 72 Z"
      className={cn('hair')}
    />
    <circle cx="91" cy="78" r="2.1" className={cn('ink')} />
    <circle cx="109" cy="78" r="2.1" className={cn('ink')} />
    <path
      d="M86 72 Q91 69.5 96 72 M104 72 Q109 69.5 114 72"
      className={cn('stroke')}
    />
    <path d="M93 89 Q100 95 107 89" className={cn('stroke')} />
  </g>
);

// Arms rest on the desk, in front of the torso.
const Arms = () => (
  <g>
    <path
      d="M56 130 Q48 158 80 160 L84 148 Q66 148 66 132 Z"
      className={cn('shirt')}
    />
    <path
      d="M144 130 Q152 158 120 160 L116 148 Q134 148 134 132 Z"
      className={cn('shirt')}
    />
    <circle cx="82" cy="152" r="6" className={cn('skin')} />
    <circle cx="118" cy="152" r="6" className={cn('skin')} />
  </g>
);

const Desk = () => (
  <g>
    <rect
      x="14"
      y="158"
      width="172"
      height="10"
      rx="2"
      className={cn('desk')}
    />
    <rect x="22" y="168" width="156" height="16" className={cn('deskFront')} />
  </g>
);

const Prop = ({ scene }: { scene: StudentScene }) => {
  switch (scene) {
    case 'ledger':
      return (
        <g>
          <path
            d="M52 158 L100 150 L148 158 L148 142 L100 134 L52 142 Z"
            className={cn('paper')}
          />
          <path d="M100 134 L100 150" className={cn('stroke')} />
          <path
            d="M62 146 L94 141 M62 151 L94 146 M106 141 L138 146 M106 146 L138 151"
            className={cn('rule')}
          />
          <path
            d="M70 142 L70 152 M118 141 L118 151"
            className={cn('goldLine')}
          />
          <path d="M150 140 L170 128" className={cn('pencil')} />
        </g>
      );
    case 'charts':
      return (
        <g>
          <rect
            x="112"
            y="94"
            width="68"
            height="56"
            rx="3"
            className={cn('paper')}
          />
          <rect
            x="112"
            y="94"
            width="68"
            height="56"
            rx="3"
            className={cn('outline')}
          />
          <rect x="122" y="128" width="8" height="14" className={cn('bar')} />
          <rect
            x="136"
            y="118"
            width="8"
            height="24"
            className={cn('barGold')}
          />
          <rect x="150" y="108" width="8" height="34" className={cn('bar')} />
          <path
            d="M122 120 L138 110 L152 114 L170 102"
            className={cn('trend')}
          />
          <path d="M46 156 L92 156 L92 146 L46 146 Z" className={cn('paper')} />
        </g>
      );
    case 'molecule':
      return (
        <g>
          <path
            d="M150 158 L144 136 L148 136 L148 124 L162 124 L162 136 L166 136 L160 158 Z"
            className={cn('glass')}
          />
          <path
            d="M146 146 L164 146 L161 158 L149 158 Z"
            className={cn('liquid')}
          />
          <g className={cn('molecule')}>
            <path
              d="M156 54 L174 40 M156 54 L148 72 M174 40 L190 48"
              className={cn('trend')}
            />
            <circle cx="156" cy="54" r="7" className={cn('atomForest')} />
            <circle cx="174" cy="40" r="5" className={cn('atomGold')} />
            <circle cx="148" cy="72" r="5" className={cn('atomGold')} />
            <circle cx="190" cy="48" r="5" className={cn('atomForest')} />
          </g>
          <path d="M44 158 L84 158 L84 146 L44 146 Z" className={cn('paper')} />
        </g>
      );
    case 'equations':
      return (
        <g>
          <rect
            x="54"
            y="132"
            width="92"
            height="28"
            rx="2"
            className={cn('paper')}
          />
          <text x="62" y="148" className={cn('formula')}>
            x² + 2x = 8
          </text>
          <path d="M62 154 L120 154" className={cn('goldLine')} />
          <rect
            x="132"
            y="104"
            width="46"
            height="34"
            rx="3"
            className={cn('outline')}
          />
          <text x="140" y="127" className={cn('formulaSmall')}>
            π ∑ √
          </text>
        </g>
      );
    case 'reading':
      return (
        <g>
          <path d="M54 158 L54 118 L98 126 L98 158 Z" className={cn('paper')} />
          <path
            d="M146 158 L146 118 L102 126 L102 158 Z"
            className={cn('paper')}
          />
          <path d="M100 126 L100 158" className={cn('stroke')} />
          <path
            d="M62 128 L90 133 M62 135 L90 140 M62 142 L90 147 M110 133 L138 128 M110 140 L138 135 M110 147 L138 142"
            className={cn('rule')}
          />
          <path
            d="M166 158 L166 140 L180 140 L180 158 Z"
            className={cn('barGold')}
          />
        </g>
      );
    case 'puzzle':
      return (
        <g>
          <path d="M52 158 L52 138 L72 138 L72 158 Z" className={cn('bar')} />
          <path
            d="M76 158 L76 128 L98 128 L98 158 Z"
            className={cn('barGold')}
          />
          <path d="M102 158 L116 134 L130 158 Z" className={cn('paper')} />
          <path d="M102 158 L116 134 L130 158 Z" className={cn('outline')} />
          <circle cx="150" cy="148" r="10" className={cn('atomForest')} />
          <path
            d="M150 124 L150 134 M140 128 L144 134 M160 128 L156 134"
            className={cn('goldLine')}
          />
        </g>
      );
  }
};

export const StudentIllustration = ({
  scene,
  palette = 'forest',
  label,
  className,
}: StudentIllustrationProps) => (
  <svg
    viewBox="0 0 200 184"
    className={cn('illustration', className)}
    style={PALETTE[palette] as CSSProperties}
    role={label ? 'img' : undefined}
    aria-label={label}
    aria-hidden={label ? undefined : true}
    focusable="false"
  >
    <ellipse cx="100" cy="96" rx="92" ry="84" className={cn('tint')} />
    <Figure longHair={LONG_HAIR[palette]} />
    <Desk />
    <Arms />
    <Prop scene={scene} />
  </svg>
);
