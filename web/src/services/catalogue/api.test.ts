import { catalogueFixture, openBatch } from '@/test/catalogueFixture';

import { withoutInactiveBatches } from './api';

describe('the catalogue the website uses', () => {
  it('drops batches that are not running, and keeps every other batch', () => {
    const subjects = structuredClone(catalogueFixture);
    const topic = subjects[0].chapters[0].topics[0];
    topic.batches = [
      { ...openBatch, id: 'live' },
      { ...openBatch, id: 'not-running', availability: 'INACTIVE' },
      { ...openBatch, id: 'full', availability: 'FULL' },
    ];

    const [first] = withoutInactiveBatches(subjects);
    expect(first.chapters[0].topics[0].batches.map(batch => batch.id)).toEqual([
      'live',
      'full',
    ]);
  });
});
