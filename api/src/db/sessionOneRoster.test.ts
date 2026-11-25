import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CATALOGUE_SEED } from './catalogueSeed.js';
import {
  SESSION_ONE_ROSTER,
  sessionOneBatchesByTopic,
} from './sessionOneRoster.js';

const seededTopics = CATALOGUE_SEED.flatMap(subject =>
  subject.chapters.flatMap(chapter => chapter.topics),
);

const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

describe('December–January roster', () => {
  it('has every class from the roster: 57 classes in 43 batches over 16 topics', () => {
    const classes = SESSION_ONE_ROSTER.flatMap(topic =>
      topic.batches.flatMap(batch => batch.classes),
    );
    assert.equal(classes.length, 57);
    const byTopic = sessionOneBatchesByTopic();
    assert.equal(byTopic.size, 16);
    assert.equal(
      [...byTopic.values()].reduce((sum, list) => sum + list.length, 0),
      43,
    );
  });

  it('puts every batch on a topic the website lists', () => {
    const ids = new Set(seededTopics.map(topic => topic.id));
    for (const topicId of sessionOneBatchesByTopic().keys()) {
      assert.ok(ids.has(topicId), `${topicId} is not in the catalogue`);
    }
  });

  it('seeds the batches as the roster sets them out', () => {
    const timeAndWork = seededTopics.find(
      topic => topic.id === 'topic_mathematics_time_and_work_ca_cpt',
    )!;
    assert.deepEqual(timeAndWork.batches[0], {
      id: 'batch_mathematics_time_and_work_ca_cpt_b1',
      name: 'Batch 1',
      scheduleLabel: '21st & 22nd December',
      startDate: '2026-12-21',
      startTime: '20:30',
      sessionCount: 2,
      sessionDurationMinutes: 90,
      instructorName: 'Utkarsh Verma',
      capacity: 300,
      status: 'OPEN',
    });

    const alphabet = seededTopics.find(
      topic => topic.id === 'topic_mathematics_alphabet_test_class_8',
    )!;
    assert.deepEqual(
      alphabet.batches.map(batch => [
        batch.name,
        batch.startDate,
        batch.startTime,
      ]),
      [
        ['Batch 1', '2026-12-19', '15:00'],
        ['Batch 2', '2026-12-20', '15:00'],
        ['Batch 3', '2026-12-25', '13:00'],
      ],
    );

    const quadratic = seededTopics.find(
      topic => topic.id === 'topic_mathematics_quadratic_equations_class_10',
    )!;
    assert.equal(quadratic.batches[2].scheduleLabel, '1st & 2nd January');
    assert.ok(
      seededTopics
        .flatMap(topic => topic.batches)
        .filter(batch => batch.instructorName !== null)
        .every(batch => batch.capacity === 300),
    );
  });

  it('never books two classes into the one studio at the same time', () => {
    const slots = SESSION_ONE_ROSTER.flatMap(topic =>
      topic.batches.flatMap(batch =>
        batch.classes.map(item => ({
          date: item.date,
          start: toMinutes(topic.startTime),
          end: toMinutes(topic.startTime) + topic.durationMinutes,
          topic: topic.topicId,
        })),
      ),
    );
    for (const [index, a] of slots.entries()) {
      for (const b of slots.slice(index + 1)) {
        const overlaps =
          a.date === b.date && a.start < b.end && b.start < a.end;
        assert.ok(!overlaps, `${a.topic} and ${b.topic} overlap on ${a.date}`);
      }
    }
  });
});
