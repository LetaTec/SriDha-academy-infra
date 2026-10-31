import { ABOUT_SECTION_ID, APP_ROUTES, toPageSection } from './routes';
import { POLICY_LINKS, POLICY_LINKS_TITLE } from './policies';
import { READY_TOPIC_COUNT } from './topics';

export const BRAND = {
  name: 'SriDha Academy',
  footerLead:
    'A simpler way to study, practise and prepare for exams, one topic at a time',
  copyright: '© 2026 SriDha Academy',
  footerNote: 'Designed as an editorial learning experience',
} as const;

// isSection: a jump to a section of a page, never shown as the current page.
export const NAV_LINKS = [
  { label: 'Topics', to: APP_ROUTES.TOPICS, isSection: false },
  { label: 'Practice Tests', to: APP_ROUTES.AI_TEST, isSection: false },
  { label: 'Sample Papers', to: APP_ROUTES.MODEL_PAPER, isSection: false },
  { label: 'About', to: APP_ROUTES.ABOUT, isSection: false },
] as const;

// The "Now enrolling" ticker at the top of every signed-in page
export const TICKER_TEXT = {
  label: 'Now enrolling',
  regionLabel: 'Batches open for enrolment',
  starts: 'Starts',
  seatsLeft: (seats: number) =>
    `${seats} ${seats === 1 ? 'seat' : 'seats'} available`,
  enrol: 'Enrol',
  enrolLabel: (topic: string, batch: string) => `Enrol in ${topic}, ${batch}`,
  quiet:
    'New batches open every month. Pre-register for any topic to keep a seat',
} as const;

export const HEADER_TEXT = {
  myLearning: 'My learning',
  logout: 'Log out',
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
  kicker: 'Topic-Wise Learning',
  title: "A subject isn't learned in a day.",
  titleEmphasis: "It's mastered",
  titleEnd: 'one concept at a time.',
  lead: "Learn topic by topic, practise what you've learned, and build confidence one concept at a time.",
  primaryAction: 'Explore Subjects',
  secondaryAction: 'Create Your Student Account',
  stats: [
    { value: '03', label: 'Learning paths' },
    { value: READY_TOPIC_COUNT, label: 'Topics ready' },
    { value: '100', label: 'Students / batch' },
  ],
} as const;

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

export const LEARNING_JOURNEY_TEXT = {
  eyebrow: '03 / The SriDha Learning Model',
  title: 'How true mastery happens.',
  titleEmphasis: 'Step by step.',
  description:
    'SriDha breaks difficult subjects into manageable single-topic batches. Here is the continuous learning cycle every student follows:',
  cycleLabels: [
    'Understand',
    'Learn',
    'Practise',
    'Assess',
    'Review',
    'Improve',
  ],
} as const;

export const MODEL_PAPER_DISCOVERY_TEXT = {
  eyebrow: '05 / Examination Preparation',
  title: 'Past board papers.',
  titleEmphasis: 'And sample papers.',
  description:
    'Practise with real past-year board questions, then prepare with carefully reviewed sample papers. We keep the two clearly separate',
  pyqBadge: 'Authentic Archives',
  pyqTitle: "Past 5 Years' Board Questions",
  pyqDescription:
    'Class 11 & 12 CBSE, ISC, and Foundation examination papers indexed topic-by-topic. Students practise actual historical questions after mastering each individual topic.',
  pyqItems: [
    'Indexed by topic and examination year',
    'Official marking schemes and step marks',
    'Included in topic practice materials',
  ],
  pyqAction: 'Explore Topics with PYQs',
  modelPaperBadge: 'In Development · Waitlist Open',
  modelPaperTitle: 'Reviewed Sample Papers',
  modelPaperDescription:
    'Prepared from the last five years of papers and the textbook, reviewed by subject teachers, and planned for release seven days before exams. They are practice, not a forecast of the real paper.',
  modelPaperItems: [
    'Weighted to current exam blueprints',
    'Vetted by senior subject faculty',
    'Delivered 7 days before examinations',
  ],
  modelPaperAction: 'Join Sample Paper Waitlist',
} as const;

export const AI_TEST_TEXT = {
  eyebrow: '04 / Practice Tests',
  title: 'Test your understanding.',
  titleEmphasis: 'Without repetition.',
  description:
    'Practise with questions designed around your syllabus. Each student gets a different paper for their topic, followed by instant marking, step-by-step explanations and a view of which topics need more practice',
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

export const PROGRAMS_TEXT = {
  title: 'The',
  titleEmphasis: 'three paths.',
  description:
    'SriDha Academy brings three ways to learn together: topic-wise online classes, practice tests and sample papers',
  items: [
    {
      tag: '01 / Classes',
      title: 'Online',
      titleEnd: 'Classes',
      description:
        'Topic-wise live classes delivered online, with up to 100 students per batch. Each batch lists the exact lessons it covers.',
      action: 'Browse classes',
    },
    {
      tag: '02 / Practice',
      title: 'Practice',
      titleEnd: 'Tests',
      description:
        'Create a profile, take a paper made for your topic and see where you are improving once you finish',
      action: 'See test flow',
    },
    {
      tag: '03 / Preparation',
      title: 'Sample',
      titleEnd: 'Papers',
      description:
        'Sample papers prepared from the last five years of papers and the subject book, reviewed by teachers and planned for release seven days before the exam',
      action: 'Join waitlist',
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
  note: 'Topic-wise online classes · Practice tests · Sample papers',
  readMore: 'Read our story',
} as const;

export const TEAM_TEXT = {
  title: 'People behind',
  titleEmphasis: 'the page.',
  description:
    'Faculty profiles will be published here as each topic team is confirmed',
  meetTutors: 'Meet your tutors',
  members: [
    { initial: 'A', name: 'Accounts Faculty', role: 'Topic Faculty' },
    { initial: 'E', name: 'Economics Faculty', role: 'Topic Faculty' },
    { initial: 'M', name: 'Mathematics Faculty', role: 'Topic Faculty' },
    {
      initial: 'S',
      name: 'SriDha Academy Team',
      role: 'Education & Operations',
    },
  ],
} as const;

export const CTA_TEXT = {
  eyebrow: 'Start here / 01',
  title: 'Turn the next page',
  titleEmphasis: 'with us.',
  action: 'Create Your Student Account',
} as const;

export const FOOTER_COLUMNS = [
  {
    title: 'Explore',
    links: [
      { label: 'Topics', to: APP_ROUTES.TOPICS },
      { label: 'Practice Tests', to: APP_ROUTES.AI_TEST },
      { label: 'Sample Papers', to: APP_ROUTES.MODEL_PAPER },
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

export const FOOTER_STUDENT_TEXT = {
  title: 'Student',
  myLearning: 'My learning',
} as const;

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
      '02 — Practice & tests',
      '03 — Sample papers',
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
  closingPages: [
    {
      label: 'Chapter / 02',
      title: 'Test your',
      titleEmphasis: 'progress.',
      description:
        'Build a profile and practise with a test made from your learning material',
      items: ['Practice tests', 'A new paper each time', 'Topics to revisit'],
    },
    {
      label: 'Chapter / 03',
      title: 'Prepare for',
      titleEmphasis: "what's next.",
      description:
        'Sample papers are planned for release before examinations, with teacher review',
      items: ["Last 5 years' papers", 'Subject material', 'Exam preparation'],
    },
    {
      label: 'Chapter / 04',
      title: 'Begin your',
      titleEmphasis: 'chapter.',
      description:
        'Choose your first topic and start building a stronger study routine',
      items: ['Classes', 'Practice tests', 'Sample papers'],
    },
  ],
} as const;
