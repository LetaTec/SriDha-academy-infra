import cx from 'classnames/bind';

import {
  SAMPLE_TEST_TEXT as TEXT,
  type SampleTestFigure,
} from '@constants/assessment';

import { QuestionDiagram } from '../QuestionDiagram/QuestionDiagram';
import styles from './QuestionFigure.module.css';

const cn = cx.bind(styles);

// Room round the plotted region, in drawing units
const PLOT = {
  width: 320,
  height: 210,
  left: 34,
  right: 14,
  top: 14,
  bottom: 30,
};

type RegionFigure = Extract<SampleTestFigure, { kind: 'region' }>;

// A feasible region drawn on x and y axes, its corners marked and labelled
const RegionPlot = ({ corners, xMax, yMax }: RegionFigure) => {
  const innerWidth = PLOT.width - PLOT.left - PLOT.right;
  const innerHeight = PLOT.height - PLOT.top - PLOT.bottom;
  const toX = (x: number) => PLOT.left + (x / xMax) * innerWidth;
  const toY = (y: number) => PLOT.top + innerHeight - (y / yMax) * innerHeight;
  const xTicks = Array.from({ length: xMax + 1 }, (_, index) => index);
  const yTicks = Array.from({ length: yMax + 1 }, (_, index) => index);
  const label = corners.map(([x, y]) => `(${x}, ${y})`).join(', ');

  return (
    <svg
      viewBox={`0 0 ${PLOT.width} ${PLOT.height}`}
      className={cn('drawing')}
      role="img"
      aria-label={TEXT.regionLabel(label)}
    >
      <polygon
        points={corners.map(([x, y]) => `${toX(x)},${toY(y)}`).join(' ')}
        className={cn('region')}
      />
      <line
        x1={toX(0)}
        y1={toY(0)}
        x2={toX(xMax)}
        y2={toY(0)}
        className={cn('axis')}
      />
      <line
        x1={toX(0)}
        y1={toY(0)}
        x2={toX(0)}
        y2={toY(yMax)}
        className={cn('axis')}
      />
      {xTicks.slice(1).map(tick => (
        <text key={tick} x={toX(tick)} y={toY(0) + 16} className={cn('tick')}>
          {tick}
        </text>
      ))}
      {yTicks.slice(1).map(tick => (
        <text
          key={tick}
          x={toX(0) - 8}
          y={toY(tick) + 4}
          className={cn('tick', 'tickY')}
        >
          {tick}
        </text>
      ))}
      <text x={toX(0) - 8} y={toY(0) + 16} className={cn('tick', 'tickY')}>
        0
      </text>
      <text x={toX(xMax)} y={toY(0) - 6} className={cn('axisName')}>
        x
      </text>
      <text x={toX(0) + 6} y={toY(yMax) + 4} className={cn('axisName')}>
        y
      </text>
      {corners.map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <circle cx={toX(x)} cy={toY(y)} r={3} className={cn('corner')} />
          {x > 0 && y > 0 ? (
            <text x={toX(x) + 6} y={toY(y) - 6} className={cn('cornerLabel')}>
              ({x}, {y})
            </text>
          ) : null}
        </g>
      ))}
    </svg>
  );
};

export type QuestionFigureProps = {
  figure: SampleTestFigure;
};

// The table, matrices, graph or diagram a question refers to, drawn in the
// paper's own style under the prompt.
export const QuestionFigure = ({ figure }: QuestionFigureProps) => {
  if (figure.kind === 'table') {
    return (
      <div className={cn('figure', 'tableWrap')}>
        <table className={cn('table')}>
          <thead>
            <tr>
              {figure.head.map(cell => (
                <th key={cell} scope="col">
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {figure.rows.map(row => (
              <tr key={row.join('|')}>
                {row.map((cell, index) => (
                  <td key={`${index}-${cell}`}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (figure.kind === 'matrices') {
    return (
      <div className={cn('figure', 'matrices')} aria-label={TEXT.matricesLabel}>
        {figure.items.map(item => (
          <div key={item.name} className={cn('matrixItem')}>
            <span className={cn('matrixName')}>{item.name} =</span>
            <span
              className={cn('matrix', {
                determinant: item.determinant,
                brackets: !item.determinant,
              })}
              style={{
                gridTemplateColumns: `repeat(${item.rows[0].length}, auto)`,
              }}
            >
              {item.rows.flatMap((row, rowIndex) =>
                row.map((cell, cellIndex) => (
                  <span key={`${rowIndex}-${cellIndex}`} className={cn('cell')}>
                    {cell}
                  </span>
                )),
              )}
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (figure.kind === 'region') {
    return (
      <div className={cn('figure')}>
        <RegionPlot {...figure} />
      </div>
    );
  }

  return (
    <div className={cn('figure')}>
      <QuestionDiagram name={figure.name} />
    </div>
  );
};
