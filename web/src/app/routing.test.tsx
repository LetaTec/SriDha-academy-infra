import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, AxiosHeaders } from 'axios';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { AuthProvider } from '@context/AuthContext';
import { ToastProvider } from '@context/ToastContext';
import {
  confirmAdminSignIn,
  getCurrentSession,
  loginStudent,
} from '@services/auth/api';
import { getCatalogue } from '@services/catalogue/api';
import { createEnrolment } from '@services/enrolments/api';
import { catalogueFixture, openBatch } from '@/test/catalogueFixture';

import { routes } from './router';

vi.mock('@services/catalogue/api', () => ({ getCatalogue: vi.fn() }));
vi.mock('@services/auth/api', () => ({
  getCurrentSession: vi.fn(),
  loginStudent: vi.fn(),
  registerStudent: vi.fn(),
  logoutStudent: vi.fn(),
  requestPasswordReset: vi.fn(),
  confirmPasswordReset: vi.fn(),
  requestAdminSignIn: vi.fn(),
  confirmAdminSignIn: vi.fn(),
}));
vi.mock('@services/enrolments/api', () => ({
  createEnrolment: vi.fn(),
  listEnrolments: vi.fn(),
}));

const student = {
  id: '6f0a3c1e-0000-4000-8000-000000000001',
  email: 'asha@example.com',
  role: 'STUDENT' as const,
  student: {
    id: '6f0a3c1e-0000-4000-8000-000000000002',
    fullName: 'Asha Verma',
    standard: 'CLASS_11' as const,
    stream: 'COMMERCE' as const,
    streamOther: null,
  },
};

// A super admin signs in with an emailed link and has no student profile.
const superAdmin = {
  id: '6f0a3c1e-0000-4000-8000-000000000009',
  email: 'admin@example.com',
  role: 'SUPER_ADMIN' as const,
  student: null,
};

const unauthenticated = () =>
  new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', undefined, undefined, {
    status: 401,
    statusText: 'Unauthorized',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: {
      message: 'Please sign in to continue',
      code: 'UNAUTHENTICATED',
      details: null,
    },
  });

// Pages are lazy-loaded route chunks; the first load in a test run can take
// longer than Testing Library's default wait.
const LAZY_PAGE_TIMEOUT_MS = 5000;
// The full sign-in journey loads several lazy pages in one test.
const JOURNEY_TEST_TIMEOUT_MS = 20_000;
const GST_TOPIC_ID = 'topic_accounts_gst_class_11';

const renderApp = (initialEntry: string) => {
  const router = createMemoryRouter(routes, { initialEntries: [initialEntry] });

  render(
    <ToastProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ToastProvider>,
  );

  return router;
};

describe('app routing', () => {
  beforeEach(() => {
    vi.mocked(getCatalogue).mockResolvedValue(catalogueFixture);
    vi.mocked(loginStudent).mockResolvedValue(student);
    vi.mocked(createEnrolment).mockResolvedValue({
      id: 'enrolment-1',
      status: 'PENDING_PAYMENT',
      createdAt: '2026-10-10T09:00:00Z',
      subject: { id: 'subject_accounts', slug: 'accounts', name: 'Accounts' },
      topic: { ...catalogueFixture[0].chapters[0].topics[0] },
      batch: { ...openBatch, seatsRemaining: 99 },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it(
    'shows only the sign-in page to visitors and returns them to their batch after signing in',
    async () => {
      vi.mocked(getCurrentSession).mockRejectedValue(unauthenticated());
      const user = userEvent.setup();
      const router = renderApp(`/?topic=${GST_TOPIC_ID}&batch=${openBatch.id}`);

      // The homepage is not rendered; the visitor lands on the sign-in page.
      await screen.findByRole(
        'heading',
        { name: 'Welcome back' },
        { timeout: LAZY_PAGE_TIMEOUT_MS },
      );
      expect(router.state.location.pathname).toBe('/login');
      const redirectTo = new URLSearchParams(router.state.location.search).get(
        'redirect_to',
      );
      expect(redirectTo).toBe(`/?topic=${GST_TOPIC_ID}&batch=${openBatch.id}`);
      expect(
        screen.queryByRole('group', {
          name: 'Interactive SriDha Academy book',
        }),
      ).not.toBeInTheDocument();

      // Switching to registration keeps the redirect.
      await user.click(
        screen.getAllByRole('link', { name: 'Join for free' })[0],
      );
      await screen.findByRole('heading', {
        name: 'Create your student account',
      });
      expect(router.state.location.pathname).toBe('/register');
      expect(router.state.location.search).toContain('redirect_to=');

      await user.click(screen.getAllByRole('link', { name: 'Log in' })[0]);
      await screen.findByRole('heading', { name: 'Welcome back' });
      await user.type(screen.getByLabelText('Email ID'), 'asha@example.com');
      await user.type(screen.getByLabelText('Password'), 'correct-horse-1');
      await user.click(screen.getByRole('button', { name: /^sign in$/i }));

      // Signed in: back on the homepage with the chosen batch ready to review.
      const review = await screen.findByRole(
        'dialog',
        { name: /review your\s*selection/i },
        { timeout: LAZY_PAGE_TIMEOUT_MS },
      );
      expect(router.state.location.pathname).toBe('/');
      expect(router.state.location.search).toContain(`batch=${openBatch.id}`);

      await user.click(
        within(review).getByRole('button', { name: /reserve seat/i }),
      );
      await waitFor(() =>
        expect(createEnrolment).toHaveBeenCalledWith({ batchId: openBatch.id }),
      );
      expect(
        await within(review).findByText('Seat reserved — payment pending'),
      ).toBeInTheDocument();
    },
    JOURNEY_TEST_TIMEOUT_MS,
  );

  it('sends a signed-in student past the sign-in page', async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(student);
    const router = renderApp('/login');

    await screen.findByRole(
      'heading',
      { level: 1 },
      { timeout: LAZY_PAGE_TIMEOUT_MS },
    );
    expect(router.state.location.pathname).toBe('/');
  });

  it('opens a topic from the topic cards and keeps topics without batches disabled', async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(student);
    const user = userEvent.setup();
    const router = renderApp('/');

    const gst = await screen.findByRole(
      'button',
      { name: 'View batches for GST' },
      { timeout: LAZY_PAGE_TIMEOUT_MS },
    );
    // Topics without batches stay focusable, so their subtopics can be read,
    // but are marked unavailable.
    const trialBalance = screen.getByRole('button', {
      name: 'View batches for Trial balance',
    });
    expect(trialBalance).toHaveAttribute('aria-disabled', 'true');
    expect(trialBalance).toHaveAccessibleDescription(
      /Trial balance · Class 11.*What we will teach.*Meaning and objectives/,
    );
    // GST opens once the catalogue has loaded; its hover overlay's subtopics
    // double as the card's description.
    await waitFor(() =>
      expect(gst).not.toHaveAttribute('aria-disabled', 'true'),
    );
    expect(gst).toHaveAccessibleDescription(
      /What we will teach.*What is GST.*Input tax credit.*See lessons and batches/,
    );

    await user.click(gst);
    const dialog = await screen.findByRole('dialog', {
      name: /learn gst for class 11/i,
    });
    expect(router.state.location.search).toContain(`topic=${GST_TOPIC_ID}`);
    expect(
      within(dialog).getAllByRole('button', { name: 'Select batch' }),
    ).toHaveLength(2);
  });

  it('searches topics from the header and lists their batches', async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(student);
    const user = userEvent.setup();
    const router = renderApp('/');

    const search = await screen.findByRole(
      'searchbox',
      { name: 'Find your topic' },
      { timeout: LAZY_PAGE_TIMEOUT_MS },
    );
    await user.type(search, 'suspense');
    const results = screen.getByRole('region', {
      name: 'Matching topics and batches',
    });
    expect(
      within(results).getByRole('button', { name: /Rectification of errors/ }),
    ).toBeInTheDocument();
    expect(
      within(results).queryByRole('button', { name: /GST/ }),
    ).not.toBeInTheDocument();

    // An open topic shows its fee and each batch with its timing
    await user.clear(search);
    await user.type(search, 'gst');
    await waitFor(() =>
      expect(
        within(results).getByRole('button', { name: /^GST.*₹129/ }),
      ).toBeInTheDocument(),
    );
    const november = within(results).getByRole('button', {
      name: /Reserve GST, November batch, 1st & 2nd November/,
    });

    // Choosing a batch goes straight to reserving it
    await user.click(november);
    expect(
      await screen.findByRole('dialog', { name: /review your\s*selection/i }),
    ).toBeInTheDocument();
    expect(router.state.location.search).toContain(`batch=${openBatch.id}`);
  });

  it('opens the About page from the header and marks it as the current page', async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(student);
    const user = userEvent.setup();
    const router = renderApp('/');
    const nav = await screen.findByRole(
      'navigation',
      { name: 'Primary' },
      { timeout: LAZY_PAGE_TIMEOUT_MS },
    );

    await user.click(within(nav).getByRole('link', { name: 'About' }));

    await screen.findByRole(
      'heading',
      { level: 1, name: /one page at a time/i },
      { timeout: LAZY_PAGE_TIMEOUT_MS },
    );
    expect(router.state.location.pathname).toBe('/about');
    expect(within(nav).getByRole('link', { name: 'About' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(
      screen.getByRole('heading', { name: /meet your\s*tutors/i }),
    ).toBeInTheDocument();
  });

  it('shows AI test papers as in progress, with progress derived from the milestones', async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(student);
    renderApp('/ai-test');

    const progress = await screen.findByRole(
      'progressbar',
      { name: 'Built so far' },
      { timeout: LAZY_PAGE_TIMEOUT_MS },
    );
    // 2 written + 2 half-written of 6 chapters.
    expect(progress).toHaveAttribute('aria-valuenow', '50');
    expect(screen.getByText('2 of 6 chapters written')).toBeInTheDocument();
    expect(screen.getAllByText('Being written')).toHaveLength(2);
  });

  it('opens the model paper waitlist from the model paper page', async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(student);
    const user = userEvent.setup();
    renderApp('/model-paper');

    await user.click(
      await screen.findByRole(
        'button',
        { name: 'Join the waitlist' },
        { timeout: LAZY_PAGE_TIMEOUT_MS },
      ),
    );

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('signs a super admin in from an emailed link, confirming the link once', async () => {
    vi.mocked(getCurrentSession).mockRejectedValue(unauthenticated());
    vi.mocked(confirmAdminSignIn).mockResolvedValue(superAdmin);
    const router = renderApp('/admin-sign-in?token=one-time-token');

    await screen.findByRole(
      'heading',
      { level: 1 },
      { timeout: LAZY_PAGE_TIMEOUT_MS },
    );
    expect(router.state.location.pathname).toBe('/');
    expect(confirmAdminSignIn).toHaveBeenCalledTimes(1);
    expect(confirmAdminSignIn).toHaveBeenCalledWith({
      token: 'one-time-token',
    });
  });

  it('explains a used or expired sign-in link and offers a new one', async () => {
    vi.mocked(getCurrentSession).mockRejectedValue(unauthenticated());
    vi.mocked(confirmAdminSignIn).mockRejectedValue(
      new AxiosError('Bad Request', 'ERR_BAD_REQUEST', undefined, undefined, {
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config: { headers: new AxiosHeaders() },
        data: {
          message:
            'This sign-in link is invalid or has expired. Request a new one.',
          code: 'INVALID_SIGN_IN_LINK',
          details: null,
        },
      }),
    );
    renderApp('/admin-sign-in?token=used-token');

    expect(
      await screen.findByText(
        'This sign-in link is invalid or has expired. Request a new one.',
        undefined,
        { timeout: LAZY_PAGE_TIMEOUT_MS },
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Email me a sign-in link' }),
    ).toBeInTheDocument();
  });
});
