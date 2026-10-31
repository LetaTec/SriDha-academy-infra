import { SUBJECT } from '@constants/topics';
import { toTopicPreviews, type TopicPreview } from '@services/catalogue';
import { topicCatalogueFixture } from '@/test/topicCatalogueFixture';

import {
  countTopicsBySubject,
  filterTopics,
  groupTopicsBySubject,
  hasActiveFilters,
  readTopicFilters,
  type TopicFilters,
} from './topicFilters';

const NO_FILTERS: TopicFilters = {
  query: '',
  classNumber: null,
  subject: null,
  stream: null,
  availability: null,
};

const TOPIC_PREVIEWS = toTopicPreviews(topicCatalogueFixture);

const isGst = (preview: TopicPreview) => preview.title === 'GST';

const titles = (filters: Partial<TopicFilters>) =>
  filterTopics(TOPIC_PREVIEWS, { ...NO_FILTERS, ...filters }, isGst).map(
    preview => preview.title,
  );

describe('topic filters', () => {
  it('reads filters from the URL and ignores unknown values', () => {
    expect(
      readTopicFilters(
        new URLSearchParams('q=optics&class=12&subject=physics&stream=arts'),
      ),
    ).toEqual({
      query: 'optics',
      classNumber: 12,
      subject: SUBJECT.physics,
      stream: null,
      availability: null,
    });
    expect(hasActiveFilters(NO_FILTERS)).toBe(false);
  });

  it('filters by class and subject together', () => {
    const results = filterTopics(
      TOPIC_PREVIEWS,
      { ...NO_FILTERS, classNumber: 12, subject: SUBJECT.biology },
      isGst,
    );
    expect(results.length).toBeGreaterThan(0);
    expect(
      results.every(
        preview =>
          preview.subject === SUBJECT.biology && preview.level === 'Class 12',
      ),
    ).toBe(true);
  });

  it('includes mathematics in both streams', () => {
    expect(titles({ stream: 'commerce' })).toContain('Integrals');
    expect(titles({ stream: 'science' })).toContain('Integrals');
    expect(titles({ stream: 'commerce' })).not.toContain('Ray optics');
  });

  it('filters by whether batches are open', () => {
    expect(titles({ availability: 'open' })).toEqual(['GST']);
    expect(titles({ availability: 'soon' })).not.toContain('GST');
  });

  it('combines the search box with the filters', () => {
    expect(
      titles({ query: 'class 11 gst', subject: SUBJECT.accountancy }),
    ).toEqual(['GST']);
  });

  it('groups topics by subject, then by class with Class 11 first', () => {
    const groups = groupTopicsBySubject(TOPIC_PREVIEWS);
    expect(groups.map(group => group.subject)).toEqual(Object.values(SUBJECT));
    const [accountancy] = groups;
    expect(accountancy.classes.map(row => row.level)).toEqual([
      'Class 11',
      'Class 12',
    ]);
    expect(
      accountancy.classes.every(row =>
        row.topics.every(
          preview =>
            preview.level === row.level &&
            preview.subject === SUBJECT.accountancy,
        ),
      ),
    ).toBe(true);
  });

  it('counts topics per subject for the tabs', () => {
    const counts = countTopicsBySubject(TOPIC_PREVIEWS);
    expect(Object.values(counts).reduce((sum, count) => sum + count, 0)).toBe(
      TOPIC_PREVIEWS.length,
    );
  });
});
