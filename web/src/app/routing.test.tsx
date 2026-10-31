import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, AxiosHeaders } from 'axios';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AuthProvider } from '@context/AuthContext';
import { ToastProvider } from '@context/ToastContext';
import {
  confirmAdminSignIn,
  getCurrentSession,
  loginStudent,
} from '@services/auth/api';
import { getCatalogue } from '@services/catalogue/api';
import { listTeamOrders } from '@services/admin/api';
import { listEnrolments } from '@services/enrolments/api';
import { createCheckout, listPreRegistrations } from '@services/payments/api';
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
vi.mock('@services/payments/api', () => ({
  createCheckout: vi.fn(),
  verifyPayment: vi.fn(),
  listPreRegistrations: vi.fn(),
}));
vi.mock('@services/admin/api', () => ({ listTeamOrders: vi.fn() }));
vi.mock('@services/enrolments/api', () => ({
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
// The Topics page renders all 156 topic cards on first load
const TOPICS_PAGE_TIMEOUT_MS = 15_000;
const GST_TOPIC_ID = 'topic_accounts_gst_class_11';

const renderApp = (initialEntry: string) => {
  const router = createMemoryRouter(routes, { initialEntries: [initialEntry] });

  // A fresh cache per test, so each one fetches the catalogue itself;
  // failures are not retried, so error states show at once
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );

  return router;
};

describe('app routing', () => {
  beforeEach(() => {
    vi.mocked(getCatalogue).mockResolvedValue(catalogueFixture);
    vi.mocked(listPreRegistrations).mockResolvedValue([]);
    vi.mocked(loginStudent).mockResolvedValue(student);
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

      // Seats are only taken through payment: the review hands over to the
      // payment panel with the chosen batch preselected
      await user.click(
        within(review).getByRole('button', { name: 'Continue to payment' }),
      );
      const panel = await screen.findByRole('dialog', { name: /^GST/ });
      expect(router.state.location.search).toContain(
        `checkout=${GST_TOPIC_ID}`,
      );
      expect(router.state.location.search).toContain(
        `checkoutBatch=${openBatch.id}`,
      );
      expect(router.state.location.search).not.toContain('topic=');
      expect(
        within(panel).getByRole('radio', { name: /November batch/ }),
      ).toBeChecked();
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

  it(
    'enrols from a topic card through the payment panel',
    async () => {
      vi.mocked(getCurrentSession).mockResolvedValue(student);
      vi.mocked(createCheckout).mockResolvedValue({
        paymentId: 'payment_1',
        status: 'CREATED',
        kind: 'ENROLMENT',
        amount: { amountPaise: 12900, currency: 'INR', taxLabel: null },
        topic: {
          id: GST_TOPIC_ID,
          title: 'Learn GST for Class 11',
          level: 'Class 11',
        },
        batch: {
          id: openBatch.id,
          name: openBatch.name,
          scheduleLabel: openBatch.scheduleLabel,
        },
        provider: { name: 'TEST', orderId: 'order_test_1', keyId: null },
      });
      const user = userEvent.setup();
      const router = renderApp('/');

      const enrol = await screen.findByRole(
        'button',
        { name: 'Enrol now: GST, Class 11' },
        { timeout: LAZY_PAGE_TIMEOUT_MS },
      );
      await waitFor(() => expect(enrol).toBeEnabled());
      // The hover overlay's subtopics double as the button's description
      expect(enrol).toHaveAccessibleDescription(
        /What we will teach.*What is GST.*GST entries/,
      );
      // Topics without batches are priced and open for pre-registration
      expect(
        screen.getByRole('button', {
          name: 'Pre-register now: Ray optics, Class 12',
        }),
      ).toBeEnabled();

      await user.click(enrol);
      const panel = await screen.findByRole('dialog', { name: /^GST/ });
      expect(router.state.location.search).toContain(
        `checkout=${GST_TOPIC_ID}`,
      );
      expect(
        within(panel).getByRole('radio', { name: /November batch/ }),
      ).toBeChecked();
      expect(
        within(panel).getByRole('radio', { name: /December batch/ }),
      ).toBeDisabled();

      await user.type(
        within(panel).getByRole('textbox', { name: 'Mobile number' }),
        '+91 98765 43210',
      );
      await user.click(screen.getByRole('button', { name: 'Pay ₹129' }));

      expect(createCheckout).toHaveBeenCalledWith({
        kind: 'ENROLMENT',
        batchId: openBatch.id,
        fullName: 'Asha Verma',
        email: 'asha@example.com',
        mobile: '+91 98765 43210',
      });
      // Without Razorpay keys the seat is held until payment is collected
      expect(await within(panel).findByText('Seat saved')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Done' }));
      expect(router.state.location.search).not.toContain('checkout=');
    },
    JOURNEY_TEST_TIMEOUT_MS,
  );

  it('searches topics from the header and lists their batches', async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(student);
    const user = userEvent.setup();
    const router = renderApp('/');

    const search = await screen.findByRole(
      'searchbox',
      { name: 'Find your topic' },
      { timeout: LAZY_PAGE_TIMEOUT_MS },
    );
    await user.type(search, 'hybridisation');
    const results = screen.getByRole('region', {
      name: 'Matching topics and batches',
    });
    expect(
      within(results).getByRole('button', { name: /Chemical bonding/ }),
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

  it(
    'opens the Topics page from the header and filters topics by class',
    async () => {
      vi.mocked(getCurrentSession).mockResolvedValue(student);
      const user = userEvent.setup();
      const router = renderApp('/');
      const nav = await screen.findByRole(
        'navigation',
        { name: 'Primary' },
        { timeout: LAZY_PAGE_TIMEOUT_MS },
      );

      await user.click(within(nav).getByRole('link', { name: 'Topics' }));

      await screen.findByRole(
        'heading',
        { level: 1, name: /every topic/i },
        { timeout: TOPICS_PAGE_TIMEOUT_MS },
      );
      expect(router.state.location.pathname).toBe('/topics');
      expect(within(nav).getByRole('link', { name: 'Topics' })).toHaveAttribute(
        'aria-current',
        'page',
      );

      // Pasted in one go: typing re-renders every card on each keystroke
      await user.click(
        screen.getByRole('searchbox', { name: 'Search topics' }),
      );
      await user.paste('class 12');
      expect(
        screen.getByRole('button', {
          name: 'Pre-register now: Ray optics, Class 12',
        }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Enrol now: GST, Class 11' }),
      ).not.toBeInTheDocument();

      // Filters narrow the subject groups and are kept in the URL
      await user.click(screen.getByRole('button', { name: /^Biology/ }));
      expect(
        screen.getByRole('heading', { level: 2, name: 'Biology' }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('heading', { level: 2, name: 'Physics' }),
      ).not.toBeInTheDocument();
      expect(router.state.location.search).toContain('subject=biology');

      // Class, stream and availability live in a side panel
      await user.click(screen.getByRole('button', { name: /^Filters/ }));
      const panel = await screen.findByRole('dialog', {
        name: 'Filter topics',
      });
      await user.click(within(panel).getByRole('radio', { name: 'Class 12' }));
      expect(router.state.location.search).toContain('class=12');
      await user.click(
        within(panel).getByRole('button', { name: /^Show \d+ topics?$/ }),
      );
      expect(
        screen.queryByRole('dialog', { name: 'Filter topics' }),
      ).not.toBeInTheDocument();

      // Each applied filter shows as a chip that removes it
      await user.click(
        screen.getByRole('button', { name: 'Remove filter: Class 12' }),
      );
      expect(router.state.location.search).not.toContain('class=');
    },
    JOURNEY_TEST_TIMEOUT_MS,
  );

  it('shows the policy pages to signed-out visitors', async () => {
    vi.mocked(getCurrentSession).mockRejectedValue(unauthenticated());
    renderApp('/contact');

    expect(
      await screen.findByRole(
        'heading',
        { level: 1, name: /contact\s*us/i },
        { timeout: LAZY_PAGE_TIMEOUT_MS },
      ),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('link', { name: 'sridhaacademy1@gmail.com' })[0],
    ).toHaveAttribute('href', 'mailto:sridhaacademy1@gmail.com');
    // Every policy page is linked from the footer
    const help = screen.getByRole('navigation', { name: 'Help' });
    expect(
      within(help).getByRole('link', { name: 'Terms and conditions' }),
    ).toHaveAttribute('href', '/terms');
    expect(
      within(help).getByRole('link', { name: 'Refund and cancellation' }),
    ).toHaveAttribute('href', '/refund-policy');
  });

  it('lets students pay for a pending pre-registration from My learning', async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(student);
    vi.mocked(listEnrolments).mockResolvedValue([]);
    vi.mocked(listPreRegistrations).mockResolvedValue([
      {
        id: 'pre-1',
        status: 'PENDING_PAYMENT',
        createdAt: '2026-10-28T09:00:00Z',
        topic: {
          id: 'topic_physics_ray_optics_class_12',
          title: 'Learn Ray optics for Class 12',
          level: 'Class 12',
          price: { amountPaise: 12900, currency: 'INR', taxLabel: null },
        },
      },
    ]);
    const user = userEvent.setup();
    const router = renderApp('/my-learning');

    expect(
      await screen.findByRole(
        'heading',
        { level: 2, name: 'Pre-registered topics' },
        { timeout: LAZY_PAGE_TIMEOUT_MS },
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Payment pending')).toBeInTheDocument();
    // Students never see the team's orders link
    expect(
      screen.queryByRole('link', { name: /orders and payments/i }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: 'Complete payment: Learn Ray optics for Class 12',
      }),
    );
    expect(router.state.location.search).toContain(
      'checkout=topic_physics_ray_optics_class_12',
    );
  });

  it('keeps orders and payments for the team', async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(student);
    renderApp('/team/orders');
    expect(
      await screen.findByText(
        'This page is for the SriDha Academy team',
        undefined,
        { timeout: LAZY_PAGE_TIMEOUT_MS },
      ),
    ).toBeInTheDocument();
    expect(listTeamOrders).not.toHaveBeenCalled();
    cleanup();

    vi.mocked(getCurrentSession).mockResolvedValue(superAdmin);
    vi.mocked(listTeamOrders).mockResolvedValue([
      {
        id: 'payment-1',
        createdAt: '2026-10-28T08:00:00Z',
        status: 'PAID',
        provider: 'RAZORPAY',
        amountPaise: 12900,
        providerOrderId: 'order_1',
        providerPaymentId: 'pay_1',
        kind: 'ENROLMENT',
        topic: 'Learn GST for Class 11',
        batch: 'November batch',
        seatStatus: 'CONFIRMED',
        student: {
          accountEmail: 'asha@example.com',
          name: 'Asha Verma',
          email: 'asha@example.com',
          mobile: '+91 73035 48162',
        },
      },
    ]);
    renderApp('/team/orders');

    const table = await screen.findByRole(
      'table',
      { name: 'Orders, newest first' },
      { timeout: LAZY_PAGE_TIMEOUT_MS },
    );
    expect(within(table).getByText('Asha Verma')).toBeInTheDocument();
    expect(within(table).getByText('pay_1')).toBeInTheDocument();
    expect(within(table).getByText('Paid')).toBeInTheDocument();
    expect(screen.getByText('Paid orders')).toBeInTheDocument();
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
