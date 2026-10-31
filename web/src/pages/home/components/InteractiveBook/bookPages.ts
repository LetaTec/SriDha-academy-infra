import { BOOK_TEXT } from '@constants/home';
import {
  listTopics,
  type BatchContext,
  type Subject,
  type TopicContext,
} from '@services/catalogue';

// The batch spread shows up to four batches, two per page. The full list is
// on the signed-in batches page linked from the spread.
export const BATCHES_PER_PAGE = 2;
const BATCH_PAGE_COUNT = 2;
// The book opens one topic, then its batches on the next turn; every topic
// is listed in the topics section and on the Topics page.
const TOPIC_PAGE_COUNT = 1;

export type BookChapterContent = {
  label: string;
  title: string;
  titleEmphasis: string;
  description: string;
  items: readonly string[];
};

export type BookPageContent =
  | { kind: 'chapter'; key: string; chapter: BookChapterContent }
  | { kind: 'topic'; key: string; context: TopicContext }
  | {
      kind: 'batchList';
      key: string;
      part: number;
      entries: BatchContext[];
      showMoreLink: boolean;
    }
  | { kind: 'status'; key: string; status: 'loading' | 'error' }
  | { kind: 'blank'; key: string };

export type BookLeaf = {
  key: string;
  front: BookPageContent;
  back: BookPageContent;
};

export type BookLayout = {
  leftBase: BookPageContent;
  rightBase: BookPageContent;
  leaves: BookLeaf[];
};

type CatalogueSnapshot = {
  subjects: readonly Subject[];
  isLoading: boolean;
  hasError: boolean;
};

const chapterPage = (key: string, chapter: BookChapterContent) =>
  ({ kind: 'chapter', key, chapter }) as const;

const getCataloguePages = ({
  subjects,
  isLoading,
  hasError,
}: CatalogueSnapshot): BookPageContent[] => {
  if (isLoading) return [{ kind: 'status', key: 'loading', status: 'loading' }];
  if (hasError) return [{ kind: 'status', key: 'error', status: 'error' }];

  const topics = listTopics(subjects);
  const topicPages: BookPageContent[] = topics
    .slice(0, TOPIC_PAGE_COUNT)
    .map(context => ({
      kind: 'topic',
      key: `topic-${context.topic.id}`,
      context,
    }));
  const batches = topics.flatMap(context =>
    context.topic.batches.map(batch => ({ ...context, batch })),
  );

  // The intro is page 0; pad so the batch spread starts on a left page and
  // both of its pages are seen together.
  const spreadPadding: BookPageContent[] =
    (1 + topicPages.length) % 2 === 1
      ? [{ kind: 'blank', key: 'blank-before-batches' }]
      : [];

  const batchPages = Array.from(
    { length: BATCH_PAGE_COUNT },
    (_, part): BookPageContent => ({
      kind: 'batchList',
      key: `batches-${part + 1}`,
      part: part + 1,
      entries: batches.slice(
        part * BATCHES_PER_PAGE,
        (part + 1) * BATCHES_PER_PAGE,
      ),
      showMoreLink: part === BATCH_PAGE_COUNT - 1,
    }),
  );

  return [...topicPages, ...spreadPadding, ...batchPages];
};

// Pages read left, right, left, right… The first page sits on the left base,
// the last on the right base, and every pair in between is one turning leaf.
export const buildBookLayout = (catalogue: CatalogueSnapshot): BookLayout => {
  const pages: BookPageContent[] = [
    chapterPage('intro', BOOK_TEXT.introPage),
    ...getCataloguePages(catalogue),
    ...BOOK_TEXT.closingPages.map((chapter, index) =>
      chapterPage(`closing-${index}`, chapter),
    ),
  ];

  if (pages.length % 2 === 1) {
    pages.push({ kind: 'blank', key: 'blank' });
  }

  const leaves: BookLeaf[] = [];
  for (let index = 1; index < pages.length - 1; index += 2) {
    leaves.push({
      key: `${pages[index].key}|${pages[index + 1].key}`,
      front: pages[index],
      back: pages[index + 1],
    });
  }

  return {
    leftBase: pages[0],
    rightBase: pages[pages.length - 1],
    leaves,
  };
};
