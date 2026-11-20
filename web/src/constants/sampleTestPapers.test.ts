import { SAMPLE_TEST_QUESTION_COUNT, SAMPLE_TEST_TRACKS } from './assessment';

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
