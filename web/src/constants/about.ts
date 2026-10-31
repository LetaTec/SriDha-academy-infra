import {
  READY_TOPIC_COUNT,
  SIGN_IN_TOPIC_COUNT,
  TOPIC_PREVIEWS,
} from './topics';
import type { StudentPhotoKey } from './photos';

// Copy for the About page. Tutor names and photographs are published here
// once each topic team is confirmed.
export const ABOUT_PAGE_TEXT = {
  hero: {
    eyebrow: 'About / SriDha Academy',
    title: 'Big subjects,',
    titleEmphasis: 'one page at a time.',
    lead: 'SriDha Academy teaches the way students actually get stuck: one topic at a time. We break each subject into chapters and topics, teach them live in focused batches and help every student see their progress',
    photo: 'classroom' satisfies StudentPhotoKey,
  },
  motive: {
    title: 'Our',
    titleEmphasis: 'motive.',
    description:
      'Three ideas sit behind every batch, every lesson list and every test paper we prepare',
    items: [
      {
        label: '01',
        title: 'Topics, not textbooks',
        description:
          'Students rarely struggle with a whole subject. They struggle with one chapter or one topic, so that is exactly what we teach',
      },
      {
        label: '02',
        title: 'Progress you can see',
        description:
          'Every batch lists the lessons it covers, and test papers show where a student stands once a topic is done',
      },
      {
        label: '03',
        title: 'Within reach',
        description:
          'Topic-sized batches keep fees small, so good teaching is not reserved for students who can afford a full course',
      },
    ],
  },
  inspiration: {
    title: 'The',
    titleEmphasis: 'inspiration.',
    quote:
      'A student rarely fails a subject. They get stuck on one topic, and everything after it feels harder.',
    paragraphs: [
      'Ask a student what is difficult about Accounts and the answer is almost never “Accounts”. It is GST, or the trial balance, or one chapter that never quite clicked.',
      'So we built the opposite of a full-syllabus course: one topic, one focused batch, a clear list of lessons and a way to check the result. Big subjects become a series of small victories.',
    ],
    photo: 'slate' satisfies StudentPhotoKey,
  },
  approach: {
    title: 'How we',
    titleEmphasis: 'teach.',
    description: 'Four steps, repeated for every topic a student chooses',
    steps: [
      {
        label: '01',
        title: 'Choose one topic',
        description:
          'Pick the topic you need, from GST to bank reconciliation, instead of buying a whole subject',
      },
      {
        label: '02',
        title: 'Learn it live',
        description:
          'Join a scheduled online batch of up to 100 students, with every lesson listed in advance',
      },
      {
        label: '03',
        title: 'Practise',
        description:
          'Take an AI test paper made for you, so no two students sit the same questions',
      },
      {
        label: '04',
        title: 'Revise with confidence',
        description:
          'Before the exam, revise with a teacher-reviewed model paper built from past papers',
      },
    ],
  },
  tutors: {
    title: 'Meet your',
    titleEmphasis: 'tutors.',
    description:
      'Every topic is taught by a specialist in that topic. Full tutor profiles appear here as each topic team is confirmed',
    status: 'Tutor profile coming soon',
    // One tutor card per topic on the sign-in page
    items: TOPIC_PREVIEWS.slice(0, SIGN_IN_TOPIC_COUNT).map(topic => ({
      initial: topic.title.charAt(0),
      name: topic.title,
      focus: topic.level,
    })),
  },
  stats: [
    { value: '03', label: 'Learning paths' },
    {
      value: READY_TOPIC_COUNT,
      label: 'Topics ready',
    },
    { value: '100', label: 'Students / batch' },
  ],
  cta: {
    eyebrow: 'Start here / 01',
    title: 'Your next small victory',
    titleEmphasis: 'is one topic away.',
    action: 'Browse topics',
  },
} as const;
