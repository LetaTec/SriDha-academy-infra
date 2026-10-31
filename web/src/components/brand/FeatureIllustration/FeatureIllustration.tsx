import cx from 'classnames/bind';

import styles from './FeatureIllustration.module.css';

const cn = cx.bind(styles);

export type FeatureIllustrationVariant = 'live' | 'test' | 'model';

export type FeatureIllustrationProps = {
  variant: FeatureIllustrationVariant;
};

// Small hand-drawn product scenes for the "how it works" cards. Purely
// decorative: the card text carries the meaning.
export const FeatureIllustration = ({ variant }: FeatureIllustrationProps) => (
  <svg
    viewBox="0 0 448 300"
    aria-hidden="true"
    className={cn('illustration', variant)}
  >
    <rect width="448" height="300" rx="10" className={cn('panel')} />

    {variant === 'live' ? (
      <g>
        <rect
          x="40"
          y="34"
          width="368"
          height="196"
          rx="8"
          className={cn('window')}
        />
        <circle cx="62" cy="54" r="6" className={cn('brand')} />
        <rect
          x="64"
          y="96"
          width="16"
          height="70"
          rx="2"
          className={cn('muted')}
        />
        <rect
          x="90"
          y="116"
          width="16"
          height="50"
          rx="2"
          className={cn('muted')}
        />
        <rect
          x="116"
          y="130"
          width="16"
          height="36"
          rx="2"
          className={cn('muted')}
        />
        <rect
          x="142"
          y="106"
          width="16"
          height="60"
          rx="2"
          className={cn('muted')}
        />
        <rect
          x="236"
          y="72"
          width="148"
          height="84"
          rx="6"
          className={cn('tile')}
        />
        <circle cx="310" cy="102" r="16" className={cn('person')} />
        <path
          d="M278 156c4-24 18-34 32-34s28 10 32 34z"
          className={cn('person')}
        />
        <circle cx="246" cy="176" r="5" className={cn('accentDot')} />
        <rect
          x="258"
          y="172"
          width="80"
          height="8"
          rx="4"
          className={cn('line')}
        />
        <circle cx="246" cy="196" r="5" className={cn('brandDot')} />
        <rect
          x="258"
          y="192"
          width="56"
          height="8"
          rx="4"
          className={cn('line')}
        />
        <rect
          x="96"
          y="212"
          width="256"
          height="54"
          rx="27"
          className={cn('tray')}
        />
        <g>
          <circle cx="132" cy="239" r="16" className={cn('reaction')} />
          <path
            d="M126 246v-12M131 244v-16M136 244v-14M141 246v-10"
            className={cn('glyph')}
          />
          <circle cx="178" cy="239" r="16" className={cn('reaction')} />
          <path d="M170 236h16M178 228v16" className={cn('glyph')} />
          <circle cx="224" cy="239" r="16" className={cn('reaction')} />
          <path d="M216 240l6 6 10-12" className={cn('glyph')} />
          <circle cx="270" cy="239" r="16" className={cn('reaction')} />
          <path d="M264 248l6-18 6 18M266 242h8" className={cn('glyph')} />
          <circle cx="316" cy="239" r="16" className={cn('reaction')} />
          <text x="316" y="247" textAnchor="middle" className={cn('glyphText')}>
            ?
          </text>
        </g>
      </g>
    ) : null}

    {variant === 'test' ? (
      <g>
        {[
          { x: 64, label: 'MCQ', rotate: -12 },
          { x: 156, label: 'LIVE', rotate: 0 },
          { x: 248, label: 'TIMED', rotate: 14 },
          { x: 336, label: 'SCORE', rotate: 6 },
        ].map(tag => (
          <g
            key={tag.label}
            transform={`rotate(${tag.rotate} ${tag.x + 34} 62)`}
          >
            <rect
              x={tag.x}
              y="40"
              width="68"
              height="44"
              rx="8"
              className={cn('tag')}
            />
            <text
              x={tag.x + 34}
              y="69"
              textAnchor="middle"
              className={cn('tagText')}
            >
              {tag.label}
            </text>
            <path
              d={`M${tag.x + 34} 88c0 14-10 18-4 34`}
              className={cn('dash')}
            />
          </g>
        ))}
        <rect
          x="72"
          y="134"
          width="304"
          height="166"
          rx="8"
          className={cn('window')}
        />
        <circle cx="94" cy="154" r="6" className={cn('brand')} />
        {[0, 1, 2].map(row => (
          <g key={row} transform={`translate(0 ${row * 44})`}>
            <rect
              x="92"
              y="176"
              width="110"
              height="10"
              rx="5"
              className={cn('line')}
            />
            {[0, 1, 2, 3].map(option => (
              <circle
                key={option}
                cx={230 + option * 34}
                cy="181"
                r="11"
                className={cn(
                  option === (row + 1) % 4 ? 'bubbleFilled' : 'bubble',
                )}
              />
            ))}
          </g>
        ))}
      </g>
    ) : null}

    {variant === 'model' ? (
      <g>
        <rect
          x="96"
          y="60"
          width="200"
          height="220"
          rx="6"
          className={cn('sheetBack')}
          transform="rotate(-6 196 170)"
        />
        <rect
          x="112"
          y="48"
          width="200"
          height="232"
          rx="6"
          className={cn('window')}
        />
        <text x="136" y="92" className={cn('sheetTitle')}>
          Sample paper
        </text>
        <rect
          x="136"
          y="104"
          width="120"
          height="6"
          rx="3"
          className={cn('accentLine')}
        />
        {[0, 1, 2, 3].map(row => (
          <g key={row} transform={`translate(0 ${row * 36})`}>
            <circle cx="146" cy="140" r="9" className={cn('check')} />
            <path d="M141 140l4 4 7-8" className={cn('checkMark')} />
            <rect
              x="164"
              y="135"
              width={row % 2 ? 96 : 124}
              height="10"
              rx="5"
              className={cn('line')}
            />
          </g>
        ))}
        <g transform="rotate(8 360 150)">
          <rect
            x="300"
            y="96"
            width="112"
            height="118"
            rx="8"
            className={cn('calendar')}
          />
          <rect
            x="300"
            y="96"
            width="112"
            height="30"
            rx="8"
            className={cn('calendarTop')}
          />
          <text
            x="356"
            y="172"
            textAnchor="middle"
            className={cn('calendarDay')}
          >
            7
          </text>
          <text
            x="356"
            y="196"
            textAnchor="middle"
            className={cn('calendarLabel')}
          >
            days to exam
          </text>
        </g>
      </g>
    ) : null}
  </svg>
);
