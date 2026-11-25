export const APP_ROUTES = {
  HOME: '/',
  BATCHES: '/batches',
  TOPICS: '/topics',
  ABOUT: '/about',
  AI_TEST: '/ai-test',
  TOPIC_TESTS: '/topic-tests',
  TOPIC_TEST: '/topic-tests/:topicId',
  // Retired: model papers became topic tests; old links land on them
  MODEL_PAPER: '/model-paper',
  CHECKOUT: '/checkout',
  // Retired student-account pages, kept so old links still land somewhere
  MY_LEARNING: '/my-learning',
  MY_BATCHES: '/my-batches',
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  ADMIN_SIGN_IN: '/admin-sign-in',
  // Public policy pages, readable with or without an account
  TERMS: '/terms',
  // Retired: there is no refund policy for now; old links go home
  REFUNDS: '/refund-policy',
  CONTACT: '/contact',
  // Super and finance admins
  TEAM_ORDERS: '/team/orders',
  TEAM_REFUNDS: '/team/refunds',
} as const;

// In-page anchors on the homepage, shared by the header, footer and CTAs.
export const HOME_SECTION_ID = {
  home: 'home',
  topics: 'topics',
  journey: 'learning-journey',
  aiTest: 'ai-test',
  modelPaper: 'model-paper',
  programs: 'programs',
  about: 'about',
  team: 'team',
} as const;

// Anchors on the About page.
export const ABOUT_SECTION_ID = {
  tutors: 'tutors',
} as const;

// One topic's test, by its catalogue id
// The Test Paper page's chosen class or exam and subject
export const TEST_PAPER_PARAM = { track: 'track', subject: 'subject' } as const;

export const toTestPaper = (track: string, subject: string) =>
  `${APP_ROUTES.AI_TEST}?${new URLSearchParams({
    [TEST_PAPER_PARAM.track]: track,
    [TEST_PAPER_PARAM.subject]: subject,
  }).toString()}`;

export const toTopicTest = (topicId: string) =>
  APP_ROUTES.TOPIC_TEST.replace(':topicId', encodeURIComponent(topicId));

export const toSectionHref = (sectionId: string) => `#${sectionId}`;

// A link to a section on another page, for router links ("/about#tutors").
export const toPageSection = (pathname: string, sectionId: string) =>
  `${pathname}${toSectionHref(sectionId)}`;
