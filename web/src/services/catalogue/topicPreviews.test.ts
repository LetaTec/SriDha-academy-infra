import { SUBJECT, SUBJECT_ICON } from '@constants/topics';
import { topicCatalogueFixture } from '@/test/topicCatalogueFixture';

import {
  findTeacher,
  hasBatches,
  listTeachers,
  toTopicPreviews,
} from './topicPreviews';

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

describe('who teaches a batch', () => {
  const demand = byTitle('Demand')!;
  const tutor = {
    id: 'tutor_economics',
    name: 'Default Tutor',
    headline: 'Economics tutor',
    credentials: ['M.A. Economics'],
    photoUrl: null,
  };
  const batch = (instructorName: string | null) => ({
    ...demand.topic.batches[0],
    id: `batch-${instructorName}`,
    instructorName,
  });
  const withBatches = (
    batches: ReturnType<typeof batch>[],
    topicTutor = tutor,
  ) => ({
    ...demand,
    topic: { ...demand.topic, tutor: topicTutor, batches },
  });

  it("names the roster teacher of the chosen batch, not the subject's tutor", () => {
    const preview = withBatches([batch('Anshu Malpani')]);
    expect(findTeacher(preview, batch('Anshu Malpani'))).toEqual({
      id: 'teacher-Anshu Malpani',
      name: 'Anshu Malpani',
      headline: 'Teaches Demand',
      credentials: [],
      photoUrl: null,
    });
  });

  it("uses the batches' one teacher before a batch is chosen", () => {
    const preview = withBatches([batch('Purva'), batch('Purva')]);
    expect(findTeacher(preview, null)?.name).toBe('Purva');
  });

  it("keeps the topic's tutor when batches name no teacher, or several", () => {
    expect(findTeacher(withBatches([batch(null)]), null)).toBe(tutor);
    expect(
      findTeacher(withBatches([batch('Purva'), batch('Sakshi')]), null),
    ).toBe(tutor);
  });

  it('lists each teacher once, with every topic they teach', () => {
    const sets = withBatches([batch('Utkarsh Verma'), batch('Utkarsh Verma')]);
    const polynomials = {
      ...withBatches([batch('Utkarsh Verma')]),
      title: 'Polynomials',
    };
    const market = {
      ...withBatches([batch('Anshu Malpani')]),
      title: 'Market',
    };
    expect(
      listTeachers([sets, polynomials, market]).map(({ tutor, topics }) => [
        tutor.name,
        topics,
      ]),
    ).toEqual([
      ['Utkarsh Verma', ['Demand', 'Polynomials']],
      ['Anshu Malpani', ['Market']],
    ]);
  });
});
