import {
  ABOUT_SECTION_ID,
  APP_ROUTES,
  HOME_SECTION_ID,
  toPageSection,
} from './routes';
import type { HeroSceneName } from '@components/brand/HeroScene/HeroScene';

import { POLICY_LINKS, POLICY_LINKS_TITLE } from './policies';

export const BRAND = {
  name: 'SriDha Academy',
  footerLead:
    'A focused education platform for topic-wise live classes, test papers and topic test papers',
  copyright: '© 2026 SriDha Academy',
  footerNote: 'Designed as an editorial learning experience',
} as const;

// isSection: a jump to a section of a page, never shown as the current page.
export const NAV_LINKS = [
  { label: 'Topics', to: APP_ROUTES.TOPICS, isSection: false },
  { label: 'Test Paper (Free)', to: APP_ROUTES.AI_TEST, isSection: false },
  { label: 'Topic Test Paper', to: APP_ROUTES.TOPIC_TESTS, isSection: false },
  { label: 'About', to: APP_ROUTES.ABOUT, isSection: false },
] as const;

// The "Now enrolling" ticker at the top of every signed-in page
export const TICKER_TEXT = {
  label: 'Now enrolling',
  regionLabel: 'Batches open for enrolment',
  starts: 'starts',
  // Only for a nearly full batch
  seatsLeft: (seats: number) =>
    `Only ${seats} ${seats === 1 ? 'seat' : 'seats'} left`,
  enrol: 'Enrol',
  enrolLabel: (topic: string, batch: string) => `Enrol in ${topic}, ${batch}`,
  quiet:
    'New batches open every month. Pre-register for any topic to keep a seat',
} as const;

export const HEADER_TEXT = {
  teamOrders: 'Orders',
  teamRefunds: 'Refunds',
  openMenu: 'Open menu',
  closeMenu: 'Close menu',
  primaryNavigation: 'Primary',
  homeLabel: 'SriDha Academy home',
  skipToContent: 'Skip to content',
  // Topic search in the header, with each topic's batches in the results
  searchLabel: 'Find your topic',
  searchPlaceholder: 'Topic or class, e.g. Class 11',
  searchEmpty: 'No topic matches yet. Try GST, Integrals or Class 12',
  // Shown above the results when the query names a class
  searchClassResults: (classLabel: string, count: number) =>
    `${classLabel} · ${count} ${count === 1 ? 'topic' : 'topics'}`,
  searchClassEmpty: (classLabel: string, taught: string) =>
    `No ${classLabel} topics yet. We teach ${taught} right now`,
  searchResultsLabel: 'Matching topics and batches',
  searchSoon: 'Batches opening soon',
  searchSeeAll: (count: number) => `See all ${count} results`,
  searchBatchLabel: (topic: string, batch: string, timing: string) =>
    `Reserve ${topic}, ${batch}, ${timing}`,
} as const;

export const HERO_TEXT = {
  kicker: 'Topic-wise learning',
  title: 'Search your',
  titleEmphasis: 'topic.',
  lead: 'Type a topic or your class to see its fee, lessons and next batches. No account needed to look around',
  popularLabel: 'Popular',
  searchLabel: 'Search your topic',
  highlights: ['Live topic batches', 'Test papers', 'Topic test papers'],
} as const;

// Scenes either side of the search (the first of each side on phones)
export const HERO_ILLUSTRATIONS: {
  start: readonly HeroSceneName[];
  end: readonly HeroSceneName[];
} = {
  start: ['studyGroup', 'bookStack'],
  end: ['atTheBoard', 'celebrate'],
};

export const CONCEPT_MAP_TEXT = {
  eyebrow: 'Interactive Concept Map',
  badge: 'Curriculum Hierarchy',
  instruction:
    'Select any concept node to inspect its syllabus breakdown and batch status',
  subjectLabel: 'Subject',
  conceptsLabel: 'Key concepts in sequence',
  lessonsLabel: 'Core subtopics covered',
  openBatchAction: 'View Batches & Enroll',
  exploreTopicAction: 'Explore in Syllabus',
  switchSubjectLabel: 'Switch subject:',
} as const;

// How studying with SriDha works, in four steps, each one live on the site
export const LEARNING_JOURNEY_TEXT = {
  title: 'How it works.',
  titleEmphasis: 'Four simple steps.',
  description:
    'Study one topic at a time, from the first class to the final test',
  steps: [
    {
      title: 'Pick a topic',
      description:
        'Choose just the topic you need, not a whole subject, and see its lessons and batches',
      action: 'Browse topics',
      to: APP_ROUTES.TOPICS,
    },
    {
      title: 'Join the live classes',
      description:
        'One or two live online sessions on that topic with your teacher, in a batch of up to 300 students',
      action: 'See open batches',
      to: toPageSection(APP_ROUTES.HOME, HOME_SECTION_ID.topics),
    },
    {
      title: 'Practise test papers',
      description:
        'Twenty questions from real Class 12 board, JEE Advanced and NEET papers, marked straight away',
      action: 'Test Paper',
      to: APP_ROUTES.AI_TEST,
    },
    {
      title: 'Take the topic test',
      description:
        'Twenty hard questions on your topic, two hours on the clock and every answer at the end',
      action: 'Topic Test Paper',
      to: APP_ROUTES.TOPIC_TESTS,
    },
  ],
} as const;

export const AI_TEST_TEXT = {
  eyebrow: '02 / Practice papers',
  title: 'Test your understanding.',
  titleEmphasis: 'Marked instantly.',
  description:
    'Twenty-question papers for every class and exam, marked the moment you submit. Make a free account with your first answer',
  features: [
    'Real Class 12 board, JEE Advanced and NEET questions',
    'Every right answer shown after marking',
    'Twenty-minute clock, one mark a question',
  ],
  action: 'Start sample test',
} as const;

// Second section of the homepage: the topics on offer, as cards.
export const TOPICS_TEXT = {
  title: 'Topics',
  titleEmphasis: 'to begin with.',
  description:
    'Each topic is a focused batch with its own lessons. Open a topic to see its lessons and batches.',
  seeAll: (count: number) => `See all ${count} topics`,
} as const;

// The three things SriDha Academy offers today
export const PROGRAMS_TEXT = {
  title: 'The',
  titleEmphasis: 'three paths.',
  description:
    'SriDha Academy brings three things together: topic-wise online classes, past-paper practice and topic tests',
  items: [
    {
      tag: '01 / Classes',
      title: 'Online',
      titleEnd: 'Classes',
      description:
        'Topic-wise live classes delivered online, with up to 300 students per batch. Each batch lists the exact lessons it covers.',
      action: 'Browse classes',
      to: APP_ROUTES.TOPICS,
    },
    {
      tag: '02 / Practice',
      title: 'Test',
      titleEnd: 'Paper',
      description:
        'Twenty questions from real Class 12 board, JEE Advanced and NEET papers, with a twenty-minute clock and instant marking.',
      action: 'Practise test papers',
      to: APP_ROUTES.AI_TEST,
    },
    {
      tag: '03 / Topic tests',
      title: 'Topic Test',
      titleEnd: 'Paper',
      description:
        'Twenty hard questions on one topic, two hours on the clock, and every answer shown once the paper is marked.',
      action: 'Take a topic test',
      to: APP_ROUTES.TOPIC_TESTS,
    },
  ],
} as const;

export const ABOUT_TEXT = {
  eyebrow: 'SriDha Academy / About',
  title: 'Built around',
  titleEmphasis: 'learning.',
  paragraphs: [
    'SriDha Academy is designed around a simple proposition: make the path from choosing a topic to preparing for an examination feel coherent',
    'Instead of selling a whole subject at once, we break it into chapters and topics, teach them in focused batches and help students measure progress along the way',
  ],
  note: 'Topic-wise online classes · AI assessment · AI model paper',
  readMore: 'Read our story',
} as const;

export const CTA_TEXT = {
  eyebrow: 'Start here / 01',
  title: 'Turn the next page',
  titleEmphasis: 'with us.',
  action: 'Browse all topics',
} as const;

export const FOOTER_COLUMNS = [
  {
    title: 'Explore',
    links: [
      { label: 'Topics', to: APP_ROUTES.TOPICS },
      { label: 'Test Paper', to: APP_ROUTES.AI_TEST },
      { label: 'Topic Test Paper', to: APP_ROUTES.TOPIC_TESTS },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', to: APP_ROUTES.ABOUT },
      {
        label: 'Meet the tutors',
        to: toPageSection(APP_ROUTES.ABOUT, ABOUT_SECTION_ID.tutors),
      },
    ],
  },
  { title: POLICY_LINKS_TITLE, links: POLICY_LINKS },
] as const;

// Static closing chapters of the interactive book. Topic and batch pages are
// generated from the live catalogue and inserted before these.
export const BOOK_TEXT = {
  ariaLabel: 'Interactive SriDha Academy book',
  instruction: 'Click a page to turn it',
  previousPage: 'Turn back one page',
  nextPage: 'Turn to the next page',
  pagePosition: (current: number, total: number) =>
    `Spread ${current} of ${total}`,
  introPage: {
    label: 'Chapter / 01',
    title: 'Find your',
    titleEmphasis: 'class.',
    description:
      'Every subject is broken into topics. Turn the page to see the topics, lessons and batches open right now.',
    items: [
      '01 — Topic-wise classes',
      '02 — Test papers',
      '03 — Topic test papers',
    ],
  },
  topicLabel: (level: string | null) => (level ? `Topic / ${level}` : 'Topic'),
  lessonsHeading: 'Lessons in this topic',
  batchListLabel: (part: number) =>
    `Batches / ${String(part).padStart(2, '0')}`,
  moreBatchesSoon: 'More batches will be listed here as they open',
  exploreMoreBatches: 'Explore more batches',
  loadingTitle: 'Loading',
  loadingTitleEmphasis: 'topics.',
  errorTitle: 'Topics',
  errorTitleEmphasis: 'unavailable.',
  // Only what students can use today
  closingPages: [
    {
      label: 'Chapter / 02',
      title: 'Real past',
      titleEmphasis: 'papers.',
      description:
        'Twenty questions from Class 12 board, JEE Advanced and NEET papers, marked when you submit',
      items: [
        'Class 12 board papers',
        'JEE Advanced and NEET',
        'Right answers shown after marking',
      ],
    },
    {
      label: 'Chapter / 03',
      title: 'One topic,',
      titleEmphasis: 'one test.',
      description:
        'Twenty hard questions on a single topic, with two hours on the clock',
      items: [
        '20 questions per topic',
        'A two-hour timed paper',
        'Your score and every answer at the end',
      ],
    },
    {
      label: 'Chapter / 04',
      title: 'Begin your',
      titleEmphasis: 'chapter.',
      description:
        'Choose your first topic and start building a stronger study routine',
      items: ['Topic-wise classes', 'Test papers', 'Topic test papers'],
    },
  ],
} as const;
