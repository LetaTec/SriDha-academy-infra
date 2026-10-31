import type {
  StudentPalette,
  StudentScene,
} from '@components/brand/StudentIllustration/StudentIllustration';
import type { UserRole } from '@contracts/auth';

// redirect_to carries the page (including any chosen topic and batch) a
// visitor was heading to, so sign-in returns them there.
export const AUTH_QUERY_PARAM = {
  redirectTo: 'redirect_to',
  resetToken: 'token',
  signInToken: 'token',
} as const;

// Account roles, mirrored from the API. The API decides who holds each role.
export const USER_ROLE = {
  student: 'STUDENT',
  superAdmin: 'SUPER_ADMIN',
} as const satisfies Record<string, UserRole>;

export type { UserRole };

export const USER_ROLE_LABEL: Record<UserRole, string> = {
  STUDENT: 'Student',
  SUPER_ADMIN: 'Super admin',
};

export const AUTH_VIEW = {
  login: 'login',
  register: 'register',
  forgotPassword: 'forgot-password',
} as const;

export type AuthView = (typeof AUTH_VIEW)[keyof typeof AUTH_VIEW];

export const AUTH_ERROR_CODE = {
  unauthenticated: 'UNAUTHENTICATED',
  sessionExpired: 'SESSION_EXPIRED',
  emailAlreadyRegistered: 'EMAIL_ALREADY_REGISTERED',
} as const;

export const PASSWORD_MIN_LENGTH = 8;

export const AUTH_TEXT = {
  resetEyebrow: 'Student / New password',
  resetTitle: 'Choose a new',
  resetTitleEmphasis: 'password.',
  fullNameLabel: 'Student name',
  fullNamePlaceholder: 'Full name',
  dateOfBirthLabel: 'Date of birth',
  mobileLabel: 'Mobile number',
  mobilePlaceholder: '+91',
  emailLabel: 'Email ID',
  emailPlaceholder: 'you@example.com',
  standardLabel: 'Standard / Exam',
  standardPlaceholder: 'Select',
  streamLabel: 'Stream',
  streamPlaceholder: 'Select',
  streamOtherLabel: 'Your stream',
  streamOtherPlaceholder: 'Write your stream',
  streamOtherRequired: 'Tell us your stream',
  addressLabel: 'Address',
  addressPlaceholder: 'City / address',
  passwordLabel: 'Password',
  passwordPlaceholder: '••••••••',
  newPasswordLabel: 'New password',
  confirmPasswordLabel: 'Confirm password',
  rememberMeLabel: 'Keep me signed in',
  hidePasswordLabel: 'Hide password',
  showPasswordLabel: 'Show password',
  registerSubmitLabel: 'Create account',
  loginSubmitLabel: 'Sign in',
  forgotSubmitLabel: 'Send reset link',
  resetSubmitLabel: 'Update password',
  forgotPasswordLink: 'Forgot password?',
  haveAccountPrompt: 'Already have an account?',
  noAccountPrompt: 'New to SriDha Academy?',
  backToLogin: 'Back to sign in',
  registerFootnote:
    'Your details are used only to manage your SriDha Academy account',
  forgotSuccessMessage:
    "If an account exists for that email, you'll receive a reset link shortly",
  resetSuccessMessage: 'Password updated. Sign in with your new password',
  resetMissingToken:
    'This reset link is incomplete. Request a new link from the sign-in screen',
  registeredToast: 'Your student account has been created',
  loggedInToast: 'Signed in',
  loggedOutToast: 'Signed out',
  logoutErrorToast: 'We could not sign you out. Please try again',
  sessionExpiredToast: 'Your session has expired. Please sign in again',
  emailAlreadyRegisteredAction: 'Sign in instead',
  fullNameRequired: 'Enter your full name',
  emailInvalid: 'Enter a valid email address',
  passwordRequired: 'Enter your password',
  passwordMinLength: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
  passwordMismatch: "Passwords don't match",
  dateOfBirthRequired: 'Enter your date of birth',
  mobileInvalid: 'Enter a valid mobile number',
  standardRequired: 'Select your standard or exam',
} as const;

// The sign-in screen visitors see before any other page.
export const AUTH_PAGE_TEXT = {
  kicker: 'Student Access',
  title: 'Master one concept',
  titleEmphasis: 'at a time.',
  titleEnd: '',
  lead: 'Topic-wise classes with scheduled live batches and verifiable concept milestones',
  loginTab: 'Log in',
  registerTab: 'Join for free',
  loginHeading: 'Welcome back',
  registerHeading: 'Create your student account',
  forgotHeading: 'Reset your password',
} as const;

// The cards the sign-in panel shuffles through. Each card names a subject the
// way a student would; the catalogue supplies everything else (topics, fee,
// next batch). A card whose subject is not in the catalogue yet shows as
// opening soon rather than inventing a fee or a date.
export type AuthHeroCardSource = {
  slug: string;
  label: string;
  note?: string;
  // The student illustration that sits on the card.
  scene: StudentScene;
  palette: StudentPalette;
};

export const AUTH_HERO_CARDS: readonly AuthHeroCardSource[] = [
  {
    slug: 'accounts',
    label: 'Class 11 Accounts',
    scene: 'ledger',
    palette: 'forest',
  },
  {
    slug: 'economics',
    label: 'Class 11 Economics',
    scene: 'charts',
    palette: 'gold',
  },
  {
    slug: 'science',
    label: 'Class 11 Science',
    note: 'Physics, chemistry and biology topics, opening with the next intake',
    scene: 'molecule',
    palette: 'sage',
  },
  {
    slug: 'accounts',
    label: 'Class 11th GST',
    note: 'Learn GST entries, input tax credit and practical invoice rules',
    scene: 'equations',
    palette: 'forest',
  },
  {
    slug: 'dlt-registration',
    label: 'DLT registration',
    note: 'Registration walkthroughs, opening with the next intake',
    scene: 'puzzle',
    palette: 'gold',
  },
  {
    slug: 'other-subject',
    label: 'Other subject',
    note: 'Tell us what you want to learn and we will help you find the right path',
    scene: 'reading',
    palette: 'sage',
  },
];

export const AUTH_HERO_TEXT = {
  label: 'What we teach',
  eyebrow: 'What we teach',
  loading: 'Loading subjects',
  loadingNote: 'Reading the live catalogue',
  errorTitle: 'Subjects could not load',
  errorNote: 'Check your connection and try again',
  retry: 'Try again',
  emptyTitle: 'New subjects open soon',
  emptyNote: 'Batches are being scheduled for this term',
  previous: 'Previous subject',
  previousLabel: 'Prev',
  pause: 'Pause subject shuffle',
  resume: 'Resume subject shuffle',
  pauseLabel: 'Pause',
  resumeLabel: 'Resume',
  next: 'Next subject',
  nextLabel: 'Next',
  openForEnrolment: 'Open for enrolment',
  openingSoon: 'Opening soon',
  announcedSoon: 'Announced soon',
  batchesSoon: 'Batches opening soon',
  topicsLabel: 'Topics',
  batchesLabel: 'Batches',
  formatLabel: 'Format',
  formatOnline: 'Live online',
  nextBatchLabel: 'Next batch',
  feeLabel: 'From',
  topicsCount: (count: number) => `${count}`,
  position: (index: number, total: number) =>
    `${String(index).padStart(2, '0')} / ${String(total).padStart(2, '0')}`,
  viewBatches: 'View batches',
} as const;

// Password-free sign-in for the SriDha Academy team (super admins)
export const ADMIN_SIGN_IN_TEXT = {
  eyebrow: 'Team / Sign in',
  title: 'Team',
  titleEmphasis: 'sign-in.',
  description:
    'Enter your team email and we will send you a one-time sign-in link. No password needed',
  submit: 'Email me a sign-in link',
  sentMessage:
    'If this email belongs to a team account, a sign-in link is on its way. It works once and expires in 15 minutes',
  confirming: 'Signing you in',
  linkError: 'This sign-in link could not be used. Request a new one below',
  signedInToast: 'Signed in to your team account',
  footerLink: 'Team sign-in',
} as const;
