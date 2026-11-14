import cx from 'classnames/bind';

import styles from './HeroScene.module.css';

const cn = cx.bind(styles);

export type HeroSceneName =
  'studyGroup' | 'atTheBoard' | 'bookStack' | 'celebrate';

export type HeroSceneProps = {
  scene: HeroSceneName;
  className?: string;
};

// Flat, static scenes of students learning together. Each has its own
// backdrop shape and cast, drawn from shared parts (a head with one of
// several hairstyles, a bust with one of several poses) so the set still
// reads as one illustration system. Colours are the brand's illustration
// tokens.

const C = {
  ink: 'var(--color-text-primary)',
  paper: 'var(--color-illus-paper)',
  forest: 'var(--color-bg-inverse)',
  gold: 'var(--color-accent)',
  rust: 'var(--color-illus-rust)',
  sky: 'var(--color-illus-sky)',
  sand: 'var(--color-illus-sand)',
  sage: 'var(--color-illus-sage)',
  blush: 'var(--color-illus-blush)',
  lilac: 'var(--color-illus-lilac)',
  cheek: 'var(--color-illus-cheek)',
} as const;

const SKIN = {
  fair: 'var(--color-illus-skin-fair)',
  warm: 'var(--color-illus-skin)',
  deep: 'var(--color-illus-skin-deep)',
  rich: 'var(--color-illus-skin-rich)',
} as const;

const HAIR = {
  black: 'var(--color-illus-hair)',
  brown: 'var(--color-illus-hair-brown)',
  auburn: 'var(--color-illus-hair-auburn)',
} as const;

type HairStyle = 'short' | 'swoop' | 'curly' | 'bun' | 'long' | 'ponytail';

type Look = {
  skin: string;
  hair: string;
  style: HairStyle;
  shirt: string;
  glasses?: boolean;
};

type Pose = 'rest' | 'raiseRight' | 'raiseLeft' | 'raiseBoth';

// Head centred on 0,0; the face is 30 wide and 34 tall
const Head = ({ look }: { look: Look }) => (
  <g>
    {look.style === 'long' ? (
      <path d="M-17 -2 Q-21 26 -11 31 L11 31 Q21 26 17 -2 Z" fill={look.hair} />
    ) : null}
    {look.style === 'ponytail' ? (
      <path d="M11 -12 Q31 -6 25 24 Q20 10 12 4 Z" fill={look.hair} />
    ) : null}
    {look.style === 'bun' ? (
      <circle cx="0" cy="-21" r="7.5" fill={look.hair} />
    ) : null}
    <rect x="-5" y="11" width="10" height="12" rx="3" fill={look.skin} />
    <circle cx="-15" cy="2" r="3.2" fill={look.skin} />
    <circle cx="15" cy="2" r="3.2" fill={look.skin} />
    <ellipse cx="0" cy="0" rx="15" ry="17" fill={look.skin} />
    <circle cx="-9" cy="7" r="2.4" fill={C.cheek} opacity="0.45" />
    <circle cx="9" cy="7" r="2.4" fill={C.cheek} opacity="0.45" />
    <circle cx="-5.5" cy="1" r="1.5" fill={C.ink} />
    <circle cx="5.5" cy="1" r="1.5" fill={C.ink} />
    <path
      d="M-8.5 -4 Q-5.5 -6 -2.5 -4 M2.5 -4 Q5.5 -6 8.5 -4"
      className={cn('line')}
    />
    <path d="M-4.5 8 Q0 11.5 4.5 8" className={cn('line')} />
    <FrontHair look={look} />
    {look.glasses ? (
      <g className={cn('glasses')}>
        <circle cx="-5.5" cy="1" r="4.6" />
        <circle cx="5.5" cy="1" r="4.6" />
        <path d="M-0.9 1 L0.9 1" />
      </g>
    ) : null}
  </g>
);

const FrontHair = ({ look }: { look: Look }) => {
  switch (look.style) {
    case 'curly':
      return (
        <g fill={look.hair}>
          <path d="M-15 -1 Q-15 -16 0 -16 Q15 -16 15 -1 Q8 -10 0 -10 Q-8 -10 -15 -1 Z" />
          <circle cx="-13" cy="-6" r="6" />
          <circle cx="-8" cy="-14" r="7" />
          <circle cx="1" cy="-17" r="7.5" />
          <circle cx="10" cy="-14" r="7" />
          <circle cx="14" cy="-5" r="5.5" />
        </g>
      );
    case 'swoop':
    case 'long':
      return (
        <path
          d="M-15.5 2 Q-17 -21 2 -20 Q17 -19 15.5 1 Q10 -9 -2 -12 Q-10 -6 -15.5 2 Z"
          fill={look.hair}
        />
      );
    case 'bun':
    case 'ponytail':
      return (
        <path
          d="M-15.5 -1 Q-15 -19 0 -19 Q15 -19 15.5 -1 Q8 -13 0 -13 Q-8 -13 -15.5 -1 Z"
          fill={look.hair}
        />
      );
    case 'short':
      return (
        <path
          d="M-15.5 0 Q-17 -20 0 -20 Q17 -20 15.5 0 Q12 -11 0 -11 Q-12 -11 -15.5 0 Z"
          fill={look.hair}
        />
      );
  }
};

// One arm: resting forward on a table, or raised
const RestingArm = ({ look }: { look: Look }) => (
  <g>
    <path d="M24 34 Q30 54 12 54 L10 46 Q18 46 17 36 Z" fill={look.shirt} />
    <circle cx="10" cy="50" r="4.5" fill={look.skin} />
  </g>
);

const RaisedArm = ({ look }: { look: Look }) => (
  <g>
    <path d="M17 30 Q30 10 29 -22 L37 -22 Q39 14 25 38 Z" fill={look.shirt} />
    <circle cx="33" cy="-26" r="5" fill={look.skin} />
  </g>
);

const Arm = ({
  look,
  raised,
  side,
}: {
  look: Look;
  raised: boolean;
  side: 1 | -1;
}) => (
  <g transform={side === -1 ? 'scale(-1 1)' : undefined}>
    {raised ? <RaisedArm look={look} /> : <RestingArm look={look} />}
  </g>
);

type StudentProps = {
  x: number;
  y: number;
  scale?: number;
  look: Look;
  pose?: Pose;
  // How far the torso reaches below the head's centre
  length?: number;
};

const Student = ({
  x,
  y,
  scale = 1,
  look,
  pose = 'rest',
  length = 62,
}: StudentProps) => (
  <g transform={`translate(${x} ${y}) scale(${scale})`}>
    <path
      d={`M-25 ${length} L-25 38 Q-25 23 -10 22 L10 22 Q25 23 25 38 L25 ${length} Z`}
      fill={look.shirt}
    />
    <path d="M-6 22 L0 29 L6 22 Z" fill={C.paper} opacity="0.9" />
    <Head look={look} />
    <Arm
      look={look}
      side={1}
      raised={pose === 'raiseRight' || pose === 'raiseBoth'}
    />
    <Arm
      look={look}
      side={-1}
      raised={pose === 'raiseLeft' || pose === 'raiseBoth'}
    />
  </g>
);

const Star = ({
  x,
  y,
  r,
  fill,
}: {
  x: number;
  y: number;
  r: number;
  fill: string;
}) => (
  <path
    transform={`translate(${x} ${y}) scale(${r / 10})`}
    d="M0 -10 Q1.6 -1.6 10 0 Q1.6 1.6 0 10 Q-1.6 1.6 -10 0 Q-1.6 -1.6 0 -10 Z"
    fill={fill}
  />
);

// Three friends around one table, a laptop between them
const StudyGroup = () => (
  <>
    <path d="M28 212 L28 104 A92 92 0 0 1 212 104 L212 212 Z" fill={C.sky} />
    <g fill={C.gold}>
      {[0, 1, 2, 3].flatMap(row =>
        [0, 1, 2, 3].map(col => (
          <circle
            key={`${row}-${col}`}
            cx={14 + col * 8}
            cy={24 + row * 8}
            r="1.6"
          />
        )),
      )}
    </g>
    <Student
      x={72}
      y={112}
      scale={0.95}
      look={{
        skin: SKIN.rich,
        hair: HAIR.black,
        style: 'curly',
        shirt: C.gold,
      }}
    />
    <Student
      x={168}
      y={112}
      scale={0.95}
      look={{
        skin: SKIN.deep,
        hair: HAIR.brown,
        style: 'short',
        shirt: C.rust,
      }}
    />
    <Student
      x={120}
      y={96}
      look={{
        skin: SKIN.warm,
        hair: HAIR.black,
        style: 'bun',
        shirt: C.forest,
        glasses: true,
      }}
    />
    <rect x="14" y="158" width="212" height="9" rx="2" fill={C.gold} />
    <rect x="24" y="167" width="192" height="28" fill={C.forest} />
    <path d="M94 158 L98 124 L142 124 L146 158 Z" className={cn('paper')} />
    <circle cx="120" cy="141" r="3" fill={C.gold} />
    <rect x="30" y="148" width="34" height="10" fill={C.rust} />
    <rect x="34" y="138" width="28" height="10" fill={C.forest} />
    <path d="M37 143 L59 143" stroke={C.gold} strokeWidth="1.4" />
    <path d="M184 140 L198 140 L196 158 L186 158 Z" className={cn('paper')} />
    <path d="M198 145 Q205 147 197 153" className={cn('line')} />
    <rect
      x="174"
      y="40"
      width="54"
      height="28"
      rx="9"
      className={cn('paper')}
    />
    <path d="M186 67 L182 78 L195 67 Z" className={cn('paper')} />
    <rect x="187" y="66" width="7" height="3" fill={C.paper} />
    <text x="183" y="59" className={cn('formula')}>
      a² + b²
    </text>
    <Star x={36} y={88} r={7} fill={C.gold} />
  </>
);

// One student working a problem on the board, another with a question
const AtTheBoard = () => (
  <>
    <path
      d="M40 60 C70 20 150 18 190 46 C228 72 230 140 200 180 C170 214 80 216 46 186 C14 158 12 98 40 60 Z"
      fill={C.sage}
    />
    <rect x="62" y="30" width="146" height="94" rx="4" fill={C.forest} />
    <rect
      x="62"
      y="30"
      width="146"
      height="94"
      rx="4"
      fill="none"
      stroke={C.gold}
      strokeWidth="3"
    />
    <path d="M78 110 L78 46 M78 110 L144 110" className={cn('chalk')} />
    <path d="M84 52 Q108 144 136 52" className={cn('chalkGold')} />
    <path d="M154 104 L188 104 L188 66 Z" className={cn('chalk')} />
    <text x="118" y="50" className={cn('chalkText')}>
      y = x²
    </text>
    <Student
      x={156}
      y={130}
      scale={1.02}
      pose="raiseRight"
      look={{
        skin: SKIN.warm,
        hair: HAIR.auburn,
        style: 'ponytail',
        shirt: C.gold,
      }}
      length={70}
    />
    {/* Her notebook, in the lowered hand */}
    <rect x="134" y="168" width="24" height="28" rx="2" fill={C.forest} />
    <path d="M139 176 L153 176 M139 181 L150 181" className={cn('chalkGold')} />
    <circle cx="146" cy="182" r="4.5" fill={SKIN.warm} />
    <Student
      x={66}
      y={150}
      scale={0.9}
      pose="raiseLeft"
      look={{
        skin: SKIN.fair,
        hair: HAIR.black,
        style: 'swoop',
        shirt: C.rust,
        glasses: true,
      }}
    />
    <rect x="28" y="190" width="88" height="8" rx="2" fill={C.gold} />
    <rect x="34" y="198" width="76" height="16" fill={C.forest} />
    <path d="M14 214 L226 214" className={cn('ground')} />
    <Star x={214} y={34} r={8} fill={C.rust} />
    <circle cx="26" cy="74" r="4" fill={C.gold} />
  </>
);

// Reading on top of a stack of giant books, beside a plant
const BookStack = () => (
  <>
    <rect
      x="46"
      y="26"
      width="152"
      height="152"
      rx="28"
      transform="rotate(-8 122 102)"
      fill={C.blush}
    />
    <Star x={50} y={44} r={9} fill={C.gold} />
    <Star x={204} y={60} r={6} fill={C.forest} />
    <circle cx="196" cy="34" r="3" fill={C.rust} />
    <circle cx="30" cy="112" r="3" fill={C.gold} />
    <Student
      x={122}
      y={74}
      look={{
        skin: SKIN.fair,
        hair: HAIR.brown,
        style: 'long',
        shirt: C.sky,
      }}
      length={56}
    />
    {/* Crossed legs, a lap in front of the body, shoes at either knee */}
    <path
      d="M86 140 Q86 124 104 122 L140 122 Q158 124 158 140 Z"
      fill={C.lilac}
    />
    <path d="M104 131 Q122 136 140 131" className={cn('line')} />
    <ellipse cx="88" cy="137" rx="7" ry="4" fill={C.ink} />
    <ellipse cx="156" cy="137" rx="7" ry="4" fill={C.ink} />
    <path d="M100 132 L100 110 L121 115 L121 137 Z" className={cn('paper')} />
    <path d="M142 132 L142 110 L121 115 L121 137 Z" className={cn('paper')} />
    <path
      d="M104 117 L117 120 M104 122 L117 125 M125 120 L138 117 M125 125 L138 122"
      className={cn('rule')}
    />
    <rect x="78" y="138" width="90" height="18" rx="2" fill={C.rust} />
    <rect x="70" y="156" width="106" height="20" rx="2" fill={C.gold} />
    <rect x="76" y="161" width="94" height="3" fill={C.paper} opacity="0.8" />
    <rect x="60" y="176" width="124" height="22" rx="2" fill={C.forest} />
    <path d="M70 187 L174 187" stroke={C.gold} strokeWidth="1.6" />
    <path d="M186 198 L182 178 L206 178 L202 198 Z" fill={C.rust} />
    <ellipse
      cx="188"
      cy="164"
      rx="5"
      ry="13"
      transform="rotate(-24 188 164)"
      fill={C.forest}
    />
    <ellipse
      cx="200"
      cy="162"
      rx="5"
      ry="14"
      transform="rotate(20 200 162)"
      fill={C.forest}
    />
    <ellipse cx="194" cy="156" rx="4" ry="12" fill={C.gold} />
    <path d="M24 198 L222 198" className={cn('ground')} />
  </>
);

// Two friends celebrating a result, with confetti
const Celebrate = () => (
  <>
    <path d="M22 196 A98 98 0 0 1 218 196 Z" fill={C.sand} />
    <Student
      x={90}
      y={110}
      pose="raiseBoth"
      look={{
        skin: SKIN.deep,
        hair: HAIR.black,
        style: 'short',
        shirt: C.forest,
      }}
      length={86}
    />
    <Student
      x={156}
      y={114}
      scale={0.98}
      look={{
        skin: SKIN.rich,
        hair: HAIR.black,
        style: 'long',
        shirt: C.gold,
      }}
      length={84}
    />
    <g transform="rotate(-6 156 164)">
      <rect
        x="134"
        y="146"
        width="44"
        height="36"
        rx="2"
        className={cn('paper')}
      />
      <text x="143" y="170" className={cn('grade')}>
        A+
      </text>
    </g>
    <path d="M14 196 L226 196" className={cn('ground')} />
    <rect
      x="40"
      y="40"
      width="7"
      height="4"
      rx="1"
      fill={C.rust}
      transform="rotate(30 43 42)"
    />
    <rect
      x="196"
      y="58"
      width="7"
      height="4"
      rx="1"
      fill={C.forest}
      transform="rotate(-24 199 60)"
    />
    <rect
      x="128"
      y="34"
      width="6"
      height="4"
      rx="1"
      fill={C.gold}
      transform="rotate(50 131 36)"
    />
    <path d="M58 70 L64 60 L68 72 Z" fill={C.gold} />
    <path d="M182 34 L190 30 L188 40 Z" fill={C.rust} />
    <circle cx="210" cy="96" r="3" fill={C.gold} />
    <circle cx="30" cy="104" r="3" fill={C.forest} />
    <path d="M150 52 Q154 46 158 52 T166 52" className={cn('squiggle')} />
    <Star x={204} y={128} r={7} fill={C.gold} />
  </>
);

const SCENES: Record<HeroSceneName, () => React.ReactElement> = {
  studyGroup: StudyGroup,
  atTheBoard: AtTheBoard,
  bookStack: BookStack,
  celebrate: Celebrate,
};

export const HeroScene = ({ scene, className }: HeroSceneProps) => {
  const Scene = SCENES[scene];
  return (
    <svg
      viewBox="0 0 240 220"
      className={cn('scene', className)}
      aria-hidden="true"
      focusable="false"
    >
      <Scene />
    </svg>
  );
};
