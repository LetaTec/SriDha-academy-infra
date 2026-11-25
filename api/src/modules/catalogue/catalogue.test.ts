import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import type { Subject, Topic } from '../../contracts/catalogue.js';
import { TOPIC_LIBRARY } from '../../db/topicLibrary.js';
import { startTestServer } from '../../test/testServer.js';

const allTopics = (subjects: Subject[]): Topic[] =>
  subjects.flatMap(subject =>
    subject.chapters.flatMap(chapter => chapter.topics),
  );

describe('catalogue', () => {
  let server: Awaited<ReturnType<typeof startTestServer>>;
  let topics: Topic[];

  before(async () => {
    server = await startTestServer();
    const response = await server
      .createClient()
      .request('GET', '/api/catalogue');
    assert.equal(response.status, 200);
    topics = allTopics(response.body.subjects);
  });

  after(async () => {
    await server.close();
  });

  it('invents no tutors: each roster batch names its real teacher', () => {
    // The placeholder subject tutors are gone (migration 026)
    assert.ok(topics.every(topic => topic.tutor === null));
    const sets = topics.find(
      topic => topic.id === 'topic_mathematics_sets_class_11',
    );
    assert.ok(
      sets?.batches.length &&
        sets.batches.every(batch => batch.instructorName === 'Utkarsh Verma'),
    );
  });

  it("has only the roster's batches, none invented", () => {
    const batchIds = topics.flatMap(topic =>
      topic.batches.map(batch => batch.id),
    );
    assert.equal(batchIds.length, 43);
    assert.ok(batchIds.every(id => /_b\d+$/.test(id)));
  });

  it('lists each topic once: no two share a name and class', () => {
    const keys = topics.map(topic => `${topic.shortTitle} / ${topic.level}`);
    assert.deepEqual(
      keys.filter((key, index) => keys.indexOf(key) !== index),
      [],
    );
  });

  it('serves every topic in the topic library, which the website reads', () => {
    const served = new Set(topics.map(topic => topic.id));

    assert.equal(
      TOPIC_LIBRARY.filter(topic => !served.has(topic.id)).length,
      0,
    );
  });

  it('gives each topic its card name, icon and featured rank from the library', () => {
    const gst = topics.find(
      topic => topic.id === 'topic_accounts_gst_class_11',
    );

    assert.equal(gst?.title, 'Learn GST for Class 11');
    assert.equal(gst?.shortTitle, 'GST');
    assert.equal(gst?.icon, 'topicGst');
    // GST has no roster batches, so it is not featured
    assert.equal(gst?.featuredRank, null);
    const businessCycles = topics.find(
      topic => topic.id === 'topic_economics_business_cycles_ca_cpt',
    );
    assert.equal(businessCycles?.featuredRank, 1);

    const library = new Map(TOPIC_LIBRARY.map(topic => [topic.id, topic]));
    for (const topic of topics) {
      const entry = library.get(topic.id);
      if (!entry) continue;
      assert.equal(topic.shortTitle, entry.title, topic.id);
      assert.equal(topic.icon, entry.icon ?? null, topic.id);
      assert.equal(topic.featuredRank, entry.featuredRank ?? null, topic.id);
    }
  });

  it('ranks exactly the featured topics, without gaps', () => {
    const ranks = topics
      .map(topic => topic.featuredRank)
      .filter((rank): rank is number => rank !== null)
      .sort((a, b) => a - b);

    assert.deepEqual(
      ranks,
      ranks.map((_, index) => index + 1),
    );
    assert.equal(ranks.length, 8);
    // Only topics students can book now are featured
    assert.ok(
      topics
        .filter(topic => topic.featuredRank !== null)
        .every(topic => topic.batches.length > 0),
    );
  });
});
