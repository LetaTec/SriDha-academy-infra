import { catalogueFixture, openBatch } from '@/test/catalogueFixture';

import {
  buildBookLayout,
  type BookLayout,
  type BookPageContent,
} from './bookPages';

const readPages = (layout: BookLayout): BookPageContent[] => [
  layout.leftBase,
  ...layout.leaves.flatMap(leaf => [leaf.front, leaf.back]),
  layout.rightBase,
];

describe('buildBookLayout', () => {
  it('shows the batch spread on facing pages after the topic pages', () => {
    const pages = readPages(
      buildBookLayout({
        subjects: catalogueFixture,
        isLoading: false,
        hasError: false,
      }),
    );

    expect(pages[0].kind).toBe('chapter');
    expect(pages.slice(1, 4).map(page => page.kind)).toEqual([
      'topic',
      'batchList',
      'batchList',
    ]);
    // The first batch page is a left-hand page (even index).
    expect(pages.findIndex(page => page.kind === 'batchList') % 2).toBe(0);
    expect(pages.length % 2).toBe(0);
  });

  it('opens the second featured topic, as the first leads the hero', () => {
    const pages = readPages(
      buildBookLayout({
        subjects: catalogueFixture,
        isLoading: false,
        hasError: false,
      }),
    );
    const topicPage = pages.find(page => page.kind === 'topic');

    expect(topicPage?.kind === 'topic' && topicPage.context.topic.id).toBe(
      'topic_chemistry_bonding_class_11',
    );
  });

  it('lists at most four batches, two per page, with the link on the last page', () => {
    const extraBatches = Array.from({ length: 4 }, (_, index) => ({
      ...openBatch,
      id: `batch-extra-${index}`,
    }));
    const subjects = structuredClone(catalogueFixture);
    subjects[0].chapters[0].topics[0].batches.push(...extraBatches);

    const batchPages = readPages(
      buildBookLayout({ subjects, isLoading: false, hasError: false }),
    ).filter(page => page.kind === 'batchList');

    expect(batchPages).toHaveLength(2);
    expect(
      batchPages.map(page =>
        page.kind === 'batchList' ? page.entries.length : 0,
      ),
    ).toEqual([2, 2]);
    expect(
      batchPages.map(page => page.kind === 'batchList' && page.showMoreLink),
    ).toEqual([false, true]);
  });

  it('pairs pages so every leaf has a front and a back', () => {
    const layout = buildBookLayout({
      subjects: catalogueFixture,
      isLoading: false,
      hasError: false,
    });
    const keys = readPages(layout).map(page => page.key);

    expect(new Set(keys).size).toBe(keys.length);
    expect(layout.leaves.length).toBe(keys.length / 2 - 1);
  });

  it('shows a loading page instead of inventing topics while loading', () => {
    const pages = readPages(
      buildBookLayout({ subjects: [], isLoading: true, hasError: false }),
    );
    expect(pages.some(page => page.kind === 'status')).toBe(true);
    expect(pages.some(page => page.kind === 'topic')).toBe(false);
  });

  it('shows an error page when the catalogue fails to load', () => {
    const pages = readPages(
      buildBookLayout({ subjects: [], isLoading: false, hasError: true }),
    );
    expect(pages).toContainEqual(
      expect.objectContaining({ kind: 'status', status: 'error' }),
    );
  });
});
