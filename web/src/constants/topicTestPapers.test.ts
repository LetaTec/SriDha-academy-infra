import {
  SAMPLE_TEST_QUESTION_COUNT,
  TOPIC_TEST_QUESTION_COUNTS,
} from './assessment';
import { TOPIC_TEST_EXPLANATIONS } from './topicTestExplanations';
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

  // The topic list reads the counts without downloading the questions
  it('lists exactly the topics that have a paper, with their sizes', () => {
    expect(TOPIC_TEST_QUESTION_COUNTS).toEqual(
      Object.fromEntries(
        papers.map(paper => [paper.topicId, paper.questions.length]),
      ),
    );
  });

  it.each(papers)(
    '$topicId explains every answer',
    ({ topicId, questions }) => {
      expect(TOPIC_TEST_EXPLANATIONS[topicId]).toHaveLength(questions.length);
      questions.forEach(question =>
        expect(question.explanation?.trim()).toBeTruthy(),
      );
    },
  );

  it('has no paper for topics not written yet', () => {
    expect(findTopicTest('topic_biology_ecosystem_class_12')).toBeNull();
    expect(findTopicTest('constructor')).toBeNull();
  });
});
