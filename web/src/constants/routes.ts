export const APP_ROUTES = {
  HOME: '/',
  BATCHES: '/batches',
  TOPICS: '/topics',
  ABOUT: '/about',
  AI_TEST: '/ai-test',
  MODEL_PAPER: '/model-paper',
  CHECKOUT: '/checkout',
  // Retired student-account pages, kept so old links still land somewhere
  MY_LEARNING: '/my-learning',
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  ADMIN_SIGN_IN: '/admin-sign-in',
  // Public policy pages, readable with or without an account
  TERMS: '/terms',
  REFUNDS: '/refund-policy',
  CONTACT: '/contact',
  // Super admins only
  TEAM_ORDERS: '/team/orders',
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

export const toSectionHref = (sectionId: string) => `#${sectionId}`;

// A link to a section on another page, for router links ("/about#tutors").
export const toPageSection = (pathname: string, sectionId: string) =>
  `${pathname}${toSectionHref(sectionId)}`;
