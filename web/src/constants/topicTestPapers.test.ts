import { SAMPLE_TEST_QUESTION_COUNT } from './assessment';
import { findTopicTest, TOPIC_TEST_BANK } from './topicTestPapers';

describe('topic test papers', () => {
  const papers = Object.entries(TOPIC_TEST_BANK).map(
    ([topicId, questions]) => ({
      topicId,
      questions,
    }),
  );

  it('has a paper for each of the eight featured topics', () => {
    expect(papers).toHaveLength(8);
    papers.forEach(paper =>
      expect(paper.topicId).toMatch(/^topic_[a-z0-9_]+_class_1[12]$/),
    );
  });

  it.each(papers)(
    '$topicId has 20 distinct questions, each with four distinct options',
    ({ questions }) => {
      expect(questions).toHaveLength(SAMPLE_TEST_QUESTION_COUNT);
      expect(new Set(questions.map(question => question.prompt)).size).toBe(
        SAMPLE_TEST_QUESTION_COUNT,
      );
      questions.forEach(question => {
        const labels = question.options.map(option => option.label.trim());
        expect(new Set(labels).size).toBe(4);
        labels.forEach(label => expect(label).not.toBe(''));
        expect(
          question.options.filter(option => option.key === question.answer),
        ).toHaveLength(1);
        expect(question.prompt).toMatch(/[?.:!…)\]”’"]$|_{3,}/);
      });
      // The right answer is not always in the same place
      expect(
        new Set(questions.map(question => question.answer)).size,
      ).toBeGreaterThan(2);
    },
  );

  it('has no paper for topics not written yet', () => {
    expect(findTopicTest('topic_biology_ecosystem_class_12')).toBeNull();
    expect(findTopicTest('constructor')).toBeNull();
  });
});
