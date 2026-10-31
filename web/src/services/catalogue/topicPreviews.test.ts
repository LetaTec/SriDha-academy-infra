import { SUBJECT, SUBJECT_ICON } from '@constants/topics';
import { topicCatalogueFixture } from '@/test/topicCatalogueFixture';

import { hasBatches, toTopicPreviews } from './topicPreviews';

const previews = toTopicPreviews(topicCatalogueFixture);
const byTitle = (title: string) =>
  previews.find(preview => preview.title === title);

describe('topic cards from the catalogue', () => {
  it('turns every catalogue topic into a card with its short name', () => {
    // The NEET pathway has no topics; every other subject has some
    expect(previews).toHaveLength(10);
    expect(byTitle('GST')).toMatchObject({
      level: 'Class 11',
      subject: SUBJECT.accountancy,
      icon: 'topicGst',
      subtopics: ['What is GST', 'Input tax credit'],
      catalogueTopicId: 'topic_accounts_gst_class_11',
    });
  });

  it('puts featured topics first in rank order, then subject by subject', () => {
    expect(previews.map(preview => preview.title)).toEqual([
      'GST',
      'Ray optics',
      'Trial balance',
      'Partnership accounts',
      'Nature of management',
      'Demand',
      'Mole concept',
      'Integrals',
      'Cell',
      'Ecosystem',
    ]);
  });

  it("uses the subject's icon when a topic has none the website knows", () => {
    expect(byTitle('Mole concept')?.icon).toBe(SUBJECT_ICON.chemistry);
    expect(byTitle('Demand')?.icon).toBe(SUBJECT_ICON.economics);
  });

  it('knows which topics have batches', () => {
    expect(previews.filter(hasBatches).map(preview => preview.title)).toEqual([
      'GST',
    ]);
  });

  it('returns nothing until the catalogue arrives', () => {
    expect(toTopicPreviews([])).toEqual([]);
  });
});
