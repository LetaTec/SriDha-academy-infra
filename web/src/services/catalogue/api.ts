import { BATCH_AVAILABILITY } from '@constants/catalogue';
import { API_CLIENT } from '@services/http/api';

import type { Subject } from './types';

// Batches that are not running (kept in the database only because someone
// once started a checkout for them) never reach the website, so every page
// shows live batches only
export const withoutInactiveBatches = (subjects: Subject[]): Subject[] =>
  subjects.map(subject => ({
    ...subject,
    chapters: subject.chapters.map(chapter => ({
      ...chapter,
      topics: chapter.topics.map(topic => ({
        ...topic,
        batches: topic.batches.filter(
          batch => batch.availability !== BATCH_AVAILABILITY.INACTIVE,
        ),
      })),
    })),
  }));

export const getCatalogue = async () =>
  withoutInactiveBatches(
    (await API_CLIENT.get<{ subjects: Subject[] }>('/catalogue')).data.subjects,
  );
