import { SAMPLE_TEST_QUESTION_COUNT, SAMPLE_TEST_TRACKS } from './assessment';
import { finishPrompt } from './paperRows';

describe('finishPrompt', () => {
  it.each([
    ['Cytokinins', 'Cytokinins ______'],
    [
      'Ge is doped with As. Due to doping,',
      'Ge is doped with As. Due to doping, ______',
    ],
    [
      'Which ecosystem has the maximum biomass',
      'Which ecosystem has the maximum biomass?',
    ],
    [
      'Identify the correct equation from the following',
      'Identify the correct equation from the following:',
    ],
    [
      'Statement 1: A. Statement 2: B. Choose the correct alternative',
      'Statement 1: A. Statement 2: B. Choose the correct alternative:',
    ],
    ['Which word is spelt correctly?', 'Which word is spelt correctly?'],
    [
      'The value of M1 would be ₹ ______ crore',
      'The value of M1 would be ₹ ______ crore',
    ],
  ])('ends “%s” so it never looks cut off', (prompt, expected) => {
    expect(finishPrompt(prompt)).toBe(expected);
  });

  it('leaves no displayed prompt ending mid-sentence', () => {
    SAMPLE_TEST_TRACKS.flatMap(track => track.subjects)
      .flatMap(subject => subject.questions)
      .forEach(question =>
        expect(question.prompt).toMatch(/[?.:!…)\]”’"]$|_{3,}/),
      );
  });
});

describe('sample test papers', () => {
  const papers = SAMPLE_TEST_TRACKS.flatMap(track =>
    track.subjects.map(subject => ({
      name: `${track.label} / ${subject.label}`,
      questions: subject.questions,
    })),
  );

  it.each(papers)('$name has a full paper of distinct questions', paper => {
    expect(paper.questions).toHaveLength(SAMPLE_TEST_QUESTION_COUNT);
    const prompts = paper.questions.map(question => question.prompt);
    expect(new Set(prompts).size).toBe(prompts.length);
  });

  it.each(papers)(
    '$name has four distinct, non-empty options per question',
    paper => {
      paper.questions.forEach(question => {
        const labels = question.options.map(option => option.label.trim());
        expect(labels).toHaveLength(4);
        labels.forEach(label => expect(label).not.toBe(''));
        expect(new Set(labels).size).toBe(4);
        expect(question.prompt.trim()).not.toBe('');
      });
    },
  );
});
