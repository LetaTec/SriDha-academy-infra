// Content for the sign-in landing page.

// The "Big Subjects. Broken Into Small Victories" section under the
// sign-in form.
export const LEARNING_MODEL_TEXT = {
  index: '01 /',
  title: 'Big Subjects. Broken Into',
  titleEmphasis: 'Small Victories.',
  lead: 'Breaking down the model',
  body: 'Learn topic by topic. Build confidence one concept at a time.',
  action: 'Browse topics',
  blocks: [
    {
      index: '01',
      photo: 'overwhelmed',
      title: 'Big Subjects',
      description:
        'Subjects like Mathematics, Accounts, Science, Economics and other subjects related to professional courses can feel overwhelming when students have to learn everything at once',
    },
    {
      index: '02',
      photo: 'reading',
      title: 'Broken Into',
      description:
        'Instead of teaching the entire subject as one big package, you divide it into individual chapters and topics',
    },
    {
      index: '03',
      photo: 'smiling',
      title: 'Small Victories',
      description:
        'Every time a student understands a difficult concept, completes a chapter, or solves a problem independently, they achieve a small win',
    },
    {
      index: '04',
      photo: 'writing',
      title: 'Test Paper',
      description:
        'We develop online test papers for students so they can track their progress. This is done with the help of in-house AI tools.',
    },
  ],
} as const;

export const LANDING_TEXT = {
  // The topics panel beside the sign-in form
  ongoingEyebrow: 'Topics running now',
  ongoingTitle: 'Learn one topic at a time',
  ongoingAction: 'Create your free student ID to explore all batches',
  topicsTitle: 'Pick a topic,',
  topicsTitleEmphasis: 'not a whole subject.',
  searchLabel: 'Search topics',
  searchPlaceholder: 'Type a topic or your class, e.g. Integrals or Class 12',
  topicOpen: 'Batches open',
  topicSoon: 'Batches opening soon',
  topicStarts: (date: string) => `Starts ${date}`,
  // Overlay shown when a topic card is hovered or focused
  overlayTitle: 'What we will teach',
  noTopicsTitle: 'No topics match your search',
  noTopicsMessage:
    'Try another topic name, such as GST, or your class, such as Class 12',
  featuresEyebrow: 'In three chapters',
  featureChapter: (index: number) =>
    `Chapter ${String(index).padStart(2, '0')}`,
  featurePlate: (index: number) => `Plate ${String(index).padStart(2, '0')}`,
  featuresTitle: 'How',
  featuresTitleEmphasis: 'SriDha Academy works.',
  featuresDescription:
    'Every big subject becomes easier when you take it one step at a time. Here’s how we help you move from understanding a concept to feeling confident about it.',
  features: [
    {
      illustration: 'live',
      title: 'Learn at your pace',
      supportingHeading: 'Understand it. Don’t just memorise it.',
      description:
        'Some topics take a little longer to click. That’s perfectly fine. Our topic-wise live classes break difficult concepts into smaller, clearer lessons, so you can ask questions, clear your doubts, and learn at a pace that works for you.',
      closingLine: 'One topic at a time. One step closer to understanding.',
    },
    {
      illustration: 'test',
      title: 'Put your learning to the test',
      supportingHeading:
        'Because understanding feels better when you can prove it.',
      description:
        'Once you’ve learnt a topic, it’s time to see how well it has stayed with you. Practise with topic-wise questions, check your answers, and discover where you need a little more practice.',
      closingLine: 'Learn it. Try it. Understand it better.',
    },
    {
      illustration: 'model',
      title: 'Walk into your exam prepared',
      supportingHeading: 'Practise today. Face tomorrow with confidence.',
      description:
        'Get familiar with the way questions appear in exams through previous-year question papers and carefully structured model papers. Learn to recognise question patterns, manage your time, and approach your preparation with greater clarity.',
      closingLine:
        'Preparation isn’t about knowing everything at once. It’s about knowing what to do next.',
    },
  ],
} as const;

export const AUTH_FOOTER_TEXT = {
  lead: 'SriDha Academy teaches one topic at a time, so students learn a single concept well and build confidence along the way',
  // The first few topics (FOOTER_TOPIC_COUNT), from the catalogue
  topicsTitle: 'Topics',
  accountTitle: 'Account',
  login: 'Log in',
  register: 'Join for free',
  forgotPassword: 'Forgot password',
  copyright: '© 2026 SriDha Academy',
  note: 'Topic-wise learning for school, competitive and professional exams',
} as const;
