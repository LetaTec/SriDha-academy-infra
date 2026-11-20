import { type JSX, useId } from 'react';
import cx from 'classnames/bind';

import {
  SAMPLE_TEST_TEXT as TEXT,
  type SampleTestDiagram,
} from '@constants/assessment';

import styles from './QuestionDiagram.module.css';

const cn = cx.bind(styles);

type DrawingProps = { arrow: string };

// Light falls on the cathode; electrons cross the tube to the mesh anode
const Photocell = ({ arrow }: DrawingProps) => (
  <>
    <rect
      x={30}
      y={40}
      width={280}
      height={90}
      rx={45}
      className={cn('line')}
    />
    <path
      d="M42 6 q6 -6 12 0 t12 0 t12 0 M48 18 q6 -6 12 0 t12 0 t12 0"
      transform="rotate(38 60 12)"
      className={cn('line')}
    />
    <line
      x1={60}
      y1={28}
      x2={66}
      y2={56}
      markerEnd={`url(#${arrow})`}
      className={cn('line')}
    />
    <text x={96} y={20} className={cn('label')}>
      Light (λₚₕ)
    </text>
    <rect x={62} y={60} width={10} height={50} className={cn('plate')} />
    <rect x={262} y={60} width={16} height={50} className={cn('line')} />
    {[266, 270, 274].map(x => (
      <line key={x} x1={x} y1={60} x2={x} y2={110} className={cn('thin')} />
    ))}
    {[70, 80, 90, 100].map(y => (
      <line key={y} x1={262} y1={y} x2={278} y2={y} className={cn('thin')} />
    ))}
    {[96, 136, 176, 216].map(x => (
      <line
        key={x}
        x1={x}
        y1={85}
        x2={x + 24}
        y2={85}
        markerEnd={`url(#${arrow})`}
        className={cn('line')}
      />
    ))}
    <line
      x1={284}
      y1={85}
      x2={372}
      y2={85}
      markerEnd={`url(#${arrow})`}
      className={cn('line')}
    />
    <text x={318} y={110} className={cn('label')}>
      Electrons
    </text>
    <line x1={67} y1={122} x2={270} y2={122} className={cn('thin', 'dashed')} />
    <text x={168} y={118} className={cn('label', 'middle')}>
      d
    </text>
    <polyline points="67,110 67,165 163,165" className={cn('line')} />
    <polyline points="177,165 270,165 270,110" className={cn('line')} />
    <line x1={164} y1={157} x2={164} y2={173} className={cn('line')} />
    <line x1={176} y1={150} x2={176} y2={180} className={cn('line')} />
    <text x={158} y={152} className={cn('label', 'end')}>
      −
    </text>
    <text x={182} y={152} className={cn('label')}>
      +
    </text>
    <text x={170} y={142} className={cn('label', 'middle')}>
      V
    </text>
  </>
);

const BALLS = [64, 82, 100, 118, 136, 154, 172, 190];

// A closed cylinder with conducting end plates, balls on the bottom plate,
// a high voltage source and an ammeter in the circuit
const ChargedBalls = ({ arrow }: DrawingProps) => (
  <>
    <line x1={40} y1={60} x2={40} y2={180} className={cn('line')} />
    <line x1={220} y1={60} x2={220} y2={180} className={cn('line')} />
    <ellipse cx={130} cy={60} rx={90} ry={14} className={cn('plateLine')} />
    <ellipse cx={130} cy={180} rx={90} ry={14} className={cn('plateLine')} />
    {BALLS.map((x, index) => (
      <circle
        key={x}
        cx={x}
        cy={index % 2 ? 176 : 182}
        r={6}
        className={cn('ball')}
      />
    ))}
    <line
      x1={18}
      y1={120}
      x2={18}
      y2={62}
      markerEnd={`url(#${arrow})`}
      className={cn('thin')}
    />
    <line
      x1={18}
      y1={120}
      x2={18}
      y2={178}
      markerEnd={`url(#${arrow})`}
      className={cn('thin')}
    />
    <text x={10} y={124} className={cn('label', 'end')}>
      h
    </text>
    <polyline points="130,46 130,20 203,20" className={cn('line')} />
    <circle cx={215} cy={20} r={12} className={cn('line')} />
    <text x={215} y={24} className={cn('label', 'middle')}>
      A
    </text>
    <polyline points="227,20 300,20 300,95" className={cn('line')} />
    <rect x={284} y={95} width={32} height={50} className={cn('line')} />
    <text x={300} y={124} className={cn('label', 'middle')}>
      HV
    </text>
    <text x={322} y={104} className={cn('label')}>
      −
    </text>
    <text x={322} y={144} className={cn('label')}>
      +
    </text>
    <polyline points="300,145 300,214 130,214 130,194" className={cn('line')} />
    <text x={232} y={56} className={cn('label')}>
      −V₀
    </text>
    <text x={232} y={190} className={cn('label')}>
      +V₀
    </text>
  </>
);

const WATER_LINES = [52, 66, 80, 94, 108, 122];

// The cooler and the device it cools, joined by a hot and a cold pipe
const WaterCooler = ({ arrow }: DrawingProps) => (
  <>
    <text x={70} y={22} className={cn('label', 'middle')}>
      Cooler
    </text>
    <rect x={20} y={30} width={100} height={110} className={cn('line')} />
    {WATER_LINES.map(y => (
      <line
        key={y}
        x1={28}
        y1={y}
        x2={112}
        y2={y}
        className={cn('thin', 'dashed')}
      />
    ))}
    <text x={275} y={22} className={cn('label', 'middle')}>
      Device
    </text>
    <rect x={230} y={30} width={90} height={110} className={cn('line')} />
    <polyline
      points="230,60 290,60 250,70 290,80 250,90 290,100 230,110"
      className={cn('line')}
    />
    <line x1={120} y1={55} x2={230} y2={55} className={cn('line')} />
    <line x1={120} y1={65} x2={230} y2={65} className={cn('line')} />
    <line x1={120} y1={105} x2={230} y2={105} className={cn('line')} />
    <line x1={120} y1={115} x2={230} y2={115} className={cn('line')} />
    <line
      x1={200}
      y1={44}
      x2={150}
      y2={44}
      markerEnd={`url(#${arrow})`}
      className={cn('line')}
    />
    <text x={175} y={38} className={cn('label', 'middle')}>
      Hot
    </text>
    <line
      x1={150}
      y1={128}
      x2={200}
      y2={128}
      markerEnd={`url(#${arrow})`}
      className={cn('line')}
    />
    <text x={175} y={146} className={cn('label', 'middle')}>
      Cold
    </text>
  </>
);

type Chromosome = { letter: string; long: boolean; dark: boolean };

// One chromosome: long for pair A, short for pair B; dark for one parent
const ChromosomeShape = ({
  x,
  y,
  chromosome,
}: {
  x: number;
  y: number;
  chromosome: Chromosome;
}) => {
  const height = chromosome.long ? 26 : 16;
  return (
    <rect
      x={x - 4}
      y={y - height / 2}
      width={8}
      height={height}
      rx={4}
      className={cn(chromosome.dark ? 'chromosomeDark' : 'chromosomeLight')}
    />
  );
};

const POSSIBILITIES: readonly {
  title: string;
  left: readonly [Chromosome, Chromosome];
  right: readonly [Chromosome, Chromosome];
  combinations: readonly [string, string];
}[] = [
  {
    title: 'Possibility 1',
    left: [
      { letter: 'A', long: true, dark: true },
      { letter: 'B', long: false, dark: true },
    ],
    right: [
      { letter: 'a', long: true, dark: false },
      { letter: 'b', long: false, dark: false },
    ],
    combinations: ['Combination 1', 'Combination 2'],
  },
  {
    title: 'Possibility 2',
    left: [
      { letter: 'A', long: true, dark: true },
      { letter: 'b', long: false, dark: false },
    ],
    right: [
      { letter: 'a', long: true, dark: false },
      { letter: 'B', long: false, dark: true },
    ],
    combinations: ['Combination 3', 'Combination 4'],
  },
];

// Two equally likely line-ups of two homologous pairs at Metaphase I, and
// the different gametes each gives
const Metaphase = ({ arrow }: DrawingProps) => (
  <>
    {POSSIBILITIES.map((possibility, index) => {
      const cx = index === 0 ? 110 : 330;
      const gametes = [
        { x: cx - 52, pair: possibility.left },
        { x: cx + 52, pair: possibility.right },
      ];
      return (
        <g key={possibility.title}>
          <text x={cx} y={14} className={cn('label', 'middle')}>
            {possibility.title}
          </text>
          <circle cx={cx} cy={72} r={44} className={cn('line')} />
          <line
            x1={cx}
            y1={32}
            x2={cx}
            y2={112}
            className={cn('thin', 'dashed')}
          />
          {possibility.left.map((chromosome, row) => (
            <g key={`l-${chromosome.letter}`}>
              <ChromosomeShape
                x={cx - 11}
                y={row ? 92 : 56}
                chromosome={chromosome}
              />
              <text
                x={cx - 24}
                y={(row ? 92 : 56) + 4}
                className={cn('small', 'end')}
              >
                {chromosome.letter}
              </text>
            </g>
          ))}
          {possibility.right.map((chromosome, row) => (
            <g key={`r-${chromosome.letter}`}>
              <ChromosomeShape
                x={cx + 11}
                y={row ? 92 : 56}
                chromosome={chromosome}
              />
              <text x={cx + 24} y={(row ? 92 : 56) + 4} className={cn('small')}>
                {chromosome.letter}
              </text>
            </g>
          ))}
          {gametes.map((gamete, side) => (
            <g key={gamete.x}>
              <line
                x1={cx + (side ? 20 : -20)}
                y1={114}
                x2={gamete.x}
                y2={150}
                markerEnd={`url(#${arrow})`}
                className={cn('thin')}
              />
              <circle cx={gamete.x} cy={176} r={20} className={cn('line')} />
              <ChromosomeShape
                x={gamete.x - 6}
                y={176}
                chromosome={gamete.pair[0]}
              />
              <ChromosomeShape
                x={gamete.x + 6}
                y={178}
                chromosome={gamete.pair[1]}
              />
              <text x={gamete.x} y={214} className={cn('small', 'middle')}>
                {possibility.combinations[side]}
              </text>
            </g>
          ))}
        </g>
      );
    })}
    <text x={220} y={76} className={cn('small', 'middle')}>
      Metaphase I
    </text>
    <text x={220} y={180} className={cn('small', 'middle')}>
      Gametes
    </text>
  </>
);

const DRAWINGS: Record<
  SampleTestDiagram,
  { viewBox: string; Drawing: (props: DrawingProps) => JSX.Element }
> = {
  photocell: { viewBox: '0 0 380 190', Drawing: Photocell },
  chargedBalls: { viewBox: '0 0 340 230', Drawing: ChargedBalls },
  waterCooler: { viewBox: '0 0 340 160', Drawing: WaterCooler },
  metaphase: { viewBox: '0 0 440 224', Drawing: Metaphase },
};

export type QuestionDiagramProps = {
  name: SampleTestDiagram;
};

// The apparatus or diagram a past-paper question shows, redrawn in the
// paper's style and described for screen readers.
export const QuestionDiagram = ({ name }: QuestionDiagramProps) => {
  const arrow = `${useId()}-arrow`;
  const { viewBox, Drawing } = DRAWINGS[name];

  return (
    <svg
      viewBox={viewBox}
      className={cn('diagram')}
      role="img"
      aria-label={TEXT.diagramLabel[name]}
    >
      <defs>
        <marker
          id={arrow}
          viewBox="0 0 10 10"
          refX={9}
          refY={5}
          markerWidth={6}
          markerHeight={6}
          orient="auto-start-reverse"
        >
          <path d="M0 0 L10 5 L0 10 z" className={cn('arrowHead')} />
        </marker>
      </defs>
      <Drawing arrow={arrow} />
    </svg>
  );
};
