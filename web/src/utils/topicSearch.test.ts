import { SUBJECT } from '@constants/topics';
import type { TopicPreview } from '@services/catalogue';
import { buildTopic } from '@/test/topicCatalogueFixture';

import { parseClassQuery } from './classLevel';
import { listTopicClasses, searchTopicPreviews } from './topicSearch';

const preview = (
  title: string,
  level: string,
  subtopics: string[] = [],
): TopicPreview => ({
  title,
  level,
  icon: 'search',
  subtopics,
  subject: SUBJECT.accountancy,
  catalogueTopicId: `topic_${title}`,
  topic: buildTopic(`topic_${title}`, title, level),
});

const PREVIEWS = [
  preview('GST', 'Class 11', ['Input tax credit']),
  preview('Trial balance', 'Class 11'),
  preview('Partnership accounts', 'Class 12'),
];

const titles = (query: string) =>
  searchTopicPreviews(PREVIEWS, query).results.map(item => item.title);

describe('parseClassQuery', () => {
  it.each([
    'class 11',
    'Class 11',
    'class11',
    '11',
    '11th',
    '11 th',
    '11th class',
    'std 11',
    'grade 11',
    'XI',
    'class xi',
    'eleventh',
  ])('reads "%s" as Class 11', text => {
    expect(parseClassQuery(text)).toMatchObject({ classNumber: 11, rest: '' });
  });

  it('keeps the words around the class', () => {
    expect(parseClassQuery('class 12 accounts')).toMatchObject({
      classNumber: 12,
      rest: 'accounts',
    });
  });

  it('ignores numbers that are not a school class', () => {
    expect(parseClassQuery('2026').classNumber).toBeNull();
  });

  it('treats a lone class word as the start of a class', () => {
    expect(parseClassQuery('class').isClassPrefix).toBe(true);
    expect(parseClassQuery('cla').isClassPrefix).toBe(true);
    expect(parseClassQuery('gst').isClassPrefix).toBe(false);
  });
});

describe('searchTopicPreviews', () => {
  it('lists every topic of the class asked for, whatever the subject', () => {
    expect(titles('class 11')).toEqual(['GST', 'Trial balance']);
    expect(titles('12th')).toEqual(['Partnership accounts']);
  });

  it('narrows a class to the topic words', () => {
    expect(titles('class 11 gst')).toEqual(['GST']);
    expect(titles('trial balance 11th')).toEqual(['Trial balance']);
  });

  it('matches subtopics and search keywords', () => {
    expect(titles('input tax')).toEqual(['GST']);
    expect(titles('accounts class 11')).toEqual(['GST', 'Trial balance']);
  });

  it('reports the class even when it has no topics', () => {
    expect(searchTopicPreviews(PREVIEWS, 'class 10')).toEqual({
      classNumber: 10,
      results: [],
    });
  });

  it('shows everything while a class word is being typed', () => {
    expect(titles('class')).toHaveLength(PREVIEWS.length);
  });

  it('lists the classes taught', () => {
    expect(listTopicClasses(PREVIEWS)).toEqual([11, 12]);
  });
});
