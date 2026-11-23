import type { SampleTestFigure, SampleTestQuestion } from './assessment';

// How every paper on the site is written: each row gives the right answer
// first, then three wrong options; toPaper shuffles them the same way every
// time, so the answer is not always (a).

export type PaperRow = readonly [
  prompt: string,
  answer: string,
  wrong1: string,
  wrong2: string,
  wrong3: string,
  // Shown under the prompt, when the question needs one
  figure?: SampleTestFigure,
];

const OPTION_KEYS = ['a', 'b', 'c', 'd'] as const;

// A stable position for the right answer, from the prompt's letters
const answerSlot = (prompt: string) =>
  [...prompt].reduce((sum, char) => sum + char.charCodeAt(0), 0) %
  OPTION_KEYS.length;

const ASKS = /^(which|what|who|whom|whose|how|why|where|when)\b/i;
const INSTRUCTS =
  /^(identify|select|choose|match|pick|arrange|find|name|read|classify)\b/i;

// Papers write many stems to be finished by the options ("Cytokinins").
// On screen they get an ending so they never look cut off: a question mark
// for questions, a colon for instructions, a blank to fill otherwise.
export const finishPrompt = (prompt: string) => {
  const text = prompt.trimEnd();
  // Already ended, or already has its blank to fill (“₹ ______ crore”)
  if (/[?.:!…)\]”’"]$/.test(text) || /_{3,}/.test(text)) return text;
  const lastSentence = text.split(/(?<=[.?!])\s+(?=[A-Z“‘(])/).pop() ?? text;
  if (ASKS.test(lastSentence)) return `${text}?`;
  if (INSTRUCTS.test(lastSentence)) return `${text}:`;
  return `${text} ______`;
};

// explanations, when given, are in the same order as the rows
export const toPaper = (
  paperId: string,
  rows: readonly PaperRow[],
  explanations: readonly string[] = [],
): readonly SampleTestQuestion[] =>
  rows.map(([prompt, answer, wrong1, wrong2, wrong3, figure], index) => {
    // Placed from the prompt as written, so answers never move
    const slot = answerSlot(prompt);
    const labels = [wrong1, wrong2, wrong3];
    labels.splice(slot, 0, answer);
    return {
      id: `${paperId}-${index + 1}`,
      prompt: finishPrompt(prompt),
      options: labels.map((label, position) => ({
        key: OPTION_KEYS[position],
        label,
      })),
      answer: OPTION_KEYS[slot],
      ...(figure ? { figure } : {}),
      ...(explanations[index] ? { explanation: explanations[index] } : {}),
    };
  });
