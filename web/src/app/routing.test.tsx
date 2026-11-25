import {
  act,
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
import { confirmAdminSignIn, getCurrentSession } from '@services/auth/api';
import { getCatalogue } from '@services/catalogue/api';
import { listTeamOrders } from '@services/admin/api';
import { createCheckout, verifyPayment } from '@services/payments/api';
import { payWithRazorpay } from '@services/payments/razorpay';
import { catalogueFixture, openBatch } from '@/test/catalogueFixture';

import { routes } from './router';

vi.mock('@services/catalogue/api', () => ({ getCatalogue: vi.fn() }));
vi.mock('@services/auth/api', () => ({
  getCurrentSession: vi.fn(),
  logoutStudent: vi.fn(),
  requestAdminSignIn: vi.fn(),
  confirmAdminSignIn: vi.fn(),
}));
vi.mock('@services/payments/api', () => ({
  createCheckout: vi.fn(),
  verifyPayment: vi.fn(),
}));
// Razorpay's own checkout window (an external script) is never loaded
vi.mock('@services/payments/razorpay', () => ({ payWithRazorpay: vi.fn() }));
vi.mock('@services/admin/api', () => ({ listTeamOrders: vi.fn() }));
vi.mock('@services/finance/refunds', () => ({
  listRefunds: vi.fn().mockResolvedValue({
    refunds: [],
    summary: {
      totalCount: 0,
      requiresReviewCount: 0,
      requiresReviewPaise: 0,
      pendingCount: 0,
      pendingPaise: 0,
      processedCount: 0,
      processedPaise: 0,
      failedCount: 0,
      failedPaise: 0,
    },
    total: 0,
    limit: 25,
    offset: 0,
  }),
  getRefundDetail: vi.fn(),
  resolveRefundException: vi.fn(),
}));

const student = {
  id: '6f0a3c1e-0000-4000-8000-000000000001',
  email: 'asha@example.com',
  role: 'STUDENT' as const,
  name: 'Asha Verma',
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
  name: null,
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

const findCheckoutPage = () =>
  screen.findByRole(
    'heading',
    { level: 1, name: /review your\s*seat/i },
    { timeout: LAZY_PAGE_TIMEOUT_MS },
  );

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
    vi.mocked(listTeamOrders).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it(
    'lets visitors browse and pay without an account',
    async () => {
      vi.mocked(getCurrentSession).mockRejectedValue(unauthenticated());
      const user = userEvent.setup();
      const router = renderApp(`/?topic=${GST_TOPIC_ID}&batch=${openBatch.id}`);

      // The homepage opens for a visitor, chosen batch and all
      const review = await screen.findByRole(
        'dialog',
        { name: /review your\s*selection/i },
        { timeout: LAZY_PAGE_TIMEOUT_MS },
      );
      expect(router.state.location.pathname).toBe('/');
      // Students have no accounts, so the header has no account links
      expect(
        within(screen.getByRole('banner')).queryByRole('link', {
          name: 'My learning',
        }),
      ).not.toBeInTheDocument();

      // Seats are only taken through payment: the review hands over to the
      // checkout page with the chosen batch preselected
      await user.click(
        within(review).getByRole('button', { name: 'Continue to payment' }),
      );
      await findCheckoutPage();
      expect(router.state.location.pathname).toBe('/checkout');
      expect(router.state.location.search).toContain(`topic=${GST_TOPIC_ID}`);
      expect(router.state.location.search).toContain(`batch=${openBatch.id}`);
      expect(
        screen.getByRole('radio', { name: /November batch/ }),
      ).toBeChecked();

      // No sign-in or sign-up: just the payment details and the Pay button
      expect(
        screen.queryByRole('heading', { name: 'Sign in to continue' }),
      ).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
      for (const field of ['Full name', 'Email ID', 'Mobile number', 'City']) {
        expect(screen.getByRole('textbox', { name: field })).toHaveValue('');
      }
      expect(screen.getByRole('combobox', { name: 'State' })).toHaveValue('');
      expect(
        screen.getByRole('button', { name: 'Pay ₹129' }),
      ).toBeInTheDocument();
    },
    JOURNEY_TEST_TIMEOUT_MS,
  );

  it('opens the homepage on the topic search', async () => {
    vi.mocked(getCurrentSession).mockRejectedValue(unauthenticated());
    const user = userEvent.setup();
    const router = renderApp('/');

    expect(
      await screen.findByRole(
        'heading',
        { level: 1, name: /search your\s*topic/i },
        { timeout: LAZY_PAGE_TIMEOUT_MS },
      ),
    ).toBeInTheDocument();
    const search = screen.getByRole('searchbox', { name: 'Search your topic' });
    await user.type(search, 'gst');
    await user.keyboard('{Enter}');

    await findCheckoutPage();
    expect(router.state.location.pathname).toBe('/checkout');
    expect(router.state.location.search).toContain(`topic=${GST_TOPIC_ID}`);
  });

  it.each([
    '/register',
    '/my-learning',
    '/reset-password?token=old',
    '/refund-policy',
  ])('sends the retired link %s to the homepage', async path => {
    vi.mocked(getCurrentSession).mockRejectedValue(unauthenticated());
    const router = renderApp(path);

    await screen.findByRole(
      'heading',
      { level: 1, name: /search your\s*topic/i },
      { timeout: LAZY_PAGE_TIMEOUT_MS },
    );
    expect(router.state.location.pathname).toBe('/');
  });

  it('sends a signed-in student from an old sign-in link to the homepage', async () => {
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
    'enrols from a topic card on the checkout page, with no account',
    async () => {
      vi.mocked(getCurrentSession).mockRejectedValue(unauthenticated());
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
      // Only topics with batches are classes; one with a topic test and no
      // batch (Ray optics) is not listed for enrolment
      expect(
        screen.queryByRole('button', {
          name: 'Pre-register now: Ray optics, Class 12',
        }),
      ).not.toBeInTheDocument();

      await user.click(enrol);
      await findCheckoutPage();
      expect(router.state.location.pathname).toBe('/checkout');
      expect(router.state.location.search).toContain(`topic=${GST_TOPIC_ID}`);
      expect(
        screen.getByRole('radio', { name: /November batch/ }),
      ).toBeChecked();
      expect(
        screen.getByRole('radio', { name: /December batch/ }),
      ).toBeDisabled();
      // No refund policy for now: a note instead, and the box names only the terms
      expect(
        screen.getByText(/Please check the topic and batch before you pay/),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: /refund/i }),
      ).not.toBeInTheDocument();
      // The student sees who teaches the topic before paying
      const tutor = screen.getByRole('region', {
        name: 'Your tutor, Neha Agarwal',
      });
      expect(within(tutor).getByText('Accounts tutor')).toBeInTheDocument();
      expect(within(tutor).getByText('M.Com, Accountancy')).toBeInTheDocument();

      await user.type(
        screen.getByRole('textbox', { name: 'Full name' }),
        'Asha Verma',
      );
      await user.type(
        screen.getByRole('textbox', { name: 'Email ID' }),
        'asha@example.com',
      );
      await user.type(
        screen.getByRole('textbox', { name: 'Mobile number' }),
        '+91 98765 43210',
      );
      // Paying needs the state, the city, address, PIN and the terms ticked first
      await user.click(screen.getByRole('button', { name: 'Pay ₹129' }));
      expect(
        await screen.findByText('Tick the box to agree before paying'),
      ).toBeInTheDocument();
      expect(screen.getAllByText('Select your state').length).toBeGreaterThan(
        1,
      );
      expect(screen.getByText('Enter your city')).toBeInTheDocument();
      expect(
        screen.getByText('Enter your billing address'),
      ).toBeInTheDocument();
      expect(
        screen.getByText('Enter a valid 6-digit PIN code'),
      ).toBeInTheDocument();
      expect(createCheckout).not.toHaveBeenCalled();

      await user.type(
        screen.getByRole('textbox', { name: 'Billing address' }),
        '12 Civil Lines',
      );
      await user.selectOptions(
        screen.getByRole('combobox', { name: 'State' }),
        'Rajasthan',
      );
      await user.type(screen.getByRole('textbox', { name: 'City' }), 'Jaipur');
      await user.type(
        screen.getByRole('textbox', { name: 'PIN code' }),
        '302006',
      );
      await user.click(
        screen.getByRole('checkbox', { name: /I agree to the/ }),
      );
      await user.click(screen.getByRole('button', { name: 'Pay ₹129' }));

      expect(createCheckout).toHaveBeenCalledWith({
        kind: 'ENROLMENT',
        batchId: openBatch.id,
        customerType: 'INDIVIDUAL',
        fullName: 'Asha Verma',
        email: 'asha@example.com',
        mobile: '+91 98765 43210',
        addressLine1: '12 Civil Lines',
        state: 'Rajasthan',
        city: 'Jaipur',
        pinCode: '302006',
      });
      // Without Razorpay keys the seat is held until payment is collected
      expect(await screen.findByText('Seat saved')).toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: /my learning/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: 'Browse topics' }),
      ).toHaveAttribute('href', '/topics');
    },
    JOURNEY_TEST_TIMEOUT_MS,
  );

  it(
    'says a payment is being confirmed, not paid, until Razorpay reports the capture',
    async () => {
      vi.mocked(getCurrentSession).mockRejectedValue(unauthenticated());
      vi.mocked(createCheckout).mockResolvedValue({
        paymentId: 'payment_2',
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
        provider: {
          name: 'RAZORPAY',
          orderId: 'order_2',
          keyId: 'rzp_test_key',
        },
      });
      vi.mocked(payWithRazorpay).mockResolvedValue({
        status: 'paid',
        verification: {
          paymentId: 'payment_2',
          providerOrderId: 'order_2',
          providerPaymentId: 'pay_2',
          signature: 'signed-by-razorpay',
        },
      });
      // Signed, but Razorpay has not reported it captured yet
      vi.mocked(verifyPayment).mockResolvedValue({
        paymentId: 'payment_2',
        status: 'AUTHORIZED',
      });
      const user = userEvent.setup();
      renderApp(`/checkout?topic=${GST_TOPIC_ID}`);
      await findCheckoutPage();

      // Opened directly, the form appears once the catalogue has loaded
      await user.type(
        await screen.findByRole(
          'textbox',
          { name: 'Full name' },
          { timeout: LAZY_PAGE_TIMEOUT_MS },
        ),
        'Asha Verma',
      );
      await user.type(
        screen.getByRole('textbox', { name: 'Email ID' }),
        'asha@example.com',
      );
      await user.type(
        screen.getByRole('textbox', { name: 'Mobile number' }),
        '+91 98765 43210',
      );
      await user.type(
        screen.getByRole('textbox', { name: 'Billing address' }),
        '12 Civil Lines',
      );
      await user.selectOptions(
        screen.getByRole('combobox', { name: 'State' }),
        'Rajasthan',
      );
      await user.type(screen.getByRole('textbox', { name: 'City' }), 'Jaipur');
      await user.type(
        screen.getByRole('textbox', { name: 'PIN code' }),
        '302006',
      );
      await user.click(
        screen.getByRole('checkbox', { name: /I agree to the/ }),
      );
      await user.click(screen.getByRole('button', { name: 'Pay ₹129' }));

      expect(
        await screen.findByText('Confirming your payment'),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/We will email asha@example.com as soon as/),
      ).toBeInTheDocument();
      expect(screen.queryByText('Payment received')).not.toBeInTheDocument();
      expect(
        screen.queryByText(/Your seat in the .* is confirmed/),
      ).not.toBeInTheDocument();
    },
    JOURNEY_TEST_TIMEOUT_MS,
  );

  it(
    'searches topics at the top of the Topics page and lists their batches',
    async () => {
      vi.mocked(getCurrentSession).mockResolvedValue(student);
      const user = userEvent.setup();
      const router = renderApp('/topics');

      const search = await screen.findByRole(
        'searchbox',
        { name: 'Search topics' },
        { timeout: TOPICS_PAGE_TIMEOUT_MS },
      );
      // The header has no search of its own any more
      expect(
        within(screen.getByRole('banner')).queryByRole('searchbox'),
      ).not.toBeInTheDocument();

      // Pasted in one go: typing re-renders every card on each keystroke
      await user.click(search);
      await user.paste('ecosystem');
      const results = screen.getByRole('region', {
        name: 'Matching topics and batches',
      });
      // The topic and its batch
      expect(
        within(results).getAllByRole('button', { name: /Ecosystem/ }).length,
      ).toBeGreaterThan(0);
      expect(
        within(results).queryByRole('button', { name: /GST/ }),
      ).not.toBeInTheDocument();
      // A topic with no batch (Chemical bonding) is not a class to find
      await user.clear(search);
      await user.paste('hybridisation');
      expect(
        within(results).queryByRole('button', { name: /Chemical bonding/ }),
      ).not.toBeInTheDocument();

      // An open topic shows its fee and each batch with its timing
      await user.clear(search);
      await user.paste('gst');
      await waitFor(() =>
        expect(
          within(results).getByRole('button', { name: /^GST.*₹129/ }),
        ).toBeInTheDocument(),
      );
      const november = within(results).getByRole('button', {
        name: /Reserve GST, November batch, 1st & 2nd November/,
      });

      // Choosing a batch goes straight to its checkout page
      await user.click(november);
      await findCheckoutPage();
      expect(router.state.location.pathname).toBe('/checkout');
      expect(router.state.location.search).toContain(`batch=${openBatch.id}`);
    },
    JOURNEY_TEST_TIMEOUT_MS,
  );

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
          name: 'Enrol now: Ecosystem, Class 12',
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

  it(
    'shows the Terms and Conditions the team wrote',
    async () => {
      vi.mocked(getCurrentSession).mockRejectedValue(unauthenticated());
      renderApp('/terms');

      expect(
        await screen.findByRole(
          'heading',
          { level: 1, name: /terms and\s*conditions/i },
          { timeout: LAZY_PAGE_TIMEOUT_MS },
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText('Effective date: 13 November 2026'),
      ).toBeInTheDocument();
      // All 17 numbered sections, in order
      const headings = screen
        .getAllByRole('heading', { level: 2 })
        .map(heading => heading.textContent);
      expect(headings[0]).toBe('1. Introduction');
      expect(headings[16]).toBe('17. Contact and Grievance Redressal');
      // A paragraph that follows a list is kept
      expect(
        screen.getByText(/^The availability and nature of services may vary/),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          /^Legal Entity: LETATEC AI technologies Private Limited/,
        ),
      ).toBeInTheDocument();
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
      within(help).queryByRole('link', { name: /refund/i }),
    ).not.toBeInTheDocument();
  });

  it('keeps orders and payments for the team', async () => {
    // Signed out: the team's emailed-link sign-in, never a student one
    vi.mocked(getCurrentSession).mockRejectedValue(unauthenticated());
    renderApp('/team/orders');
    expect(
      await screen.findByRole(
        'button',
        { name: 'Email me a sign-in link' },
        { timeout: LAZY_PAGE_TIMEOUT_MS },
      ),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    expect(listTeamOrders).not.toHaveBeenCalled();
    cleanup();

    // An older student account sees no orders
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
          state: 'Rajasthan',
          city: 'Jaipur',
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
    // The header takes the team back to orders and refunds from anywhere
    expect(
      within(screen.getByRole('banner')).getAllByRole('link', {
        name: 'Orders',
      })[0],
    ).toHaveAttribute('href', '/team/orders');
    expect(
      within(screen.getByRole('banner')).getAllByRole('link', {
        name: 'Refunds',
      })[0],
    ).toHaveAttribute('href', '/team/refunds');
  });

  it(
    'leads the AI test page with a past paper to take, opened on Class 12',
    async () => {
      vi.mocked(getCurrentSession).mockResolvedValue(student);
      renderApp('/ai-test');

      expect(
        await screen.findByRole(
          'heading',
          { level: 1, name: /real past papers/ },
          { timeout: LAZY_PAGE_TIMEOUT_MS },
        ),
      ).toBeInTheDocument();
      const paper = screen.getByRole('region', { name: 'Sample test paper' });
      expect(
        within(paper).getByRole('button', { name: 'Class 12' }),
      ).toHaveAttribute('aria-pressed', 'true');
      // Questions download separately from the page
      expect(
        await within(paper).findAllByRole(
          'radiogroup',
          {},
          { timeout: LAZY_PAGE_TIMEOUT_MS },
        ),
      ).toHaveLength(20);
      // The header names the page after what is on it
      expect(
        within(screen.getByRole('banner')).getAllByRole('link', {
          name: 'PYQ Test Paper',
        })[0],
      ).toHaveAttribute('href', '/ai-test');
      // Real papers, not a feature in the workshop
      expect(screen.queryByText('In progress')).not.toBeInTheDocument();
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    },
    JOURNEY_TEST_TIMEOUT_MS,
  );

  it(
    'lists topic tests, ready ones first, and takes a two-hour topic test',
    async () => {
      vi.mocked(getCurrentSession).mockResolvedValue(student);
      const user = userEvent.setup();
      // Old model paper links land on the topic tests
      const router = renderApp('/model-paper');

      expect(
        await screen.findByRole(
          'heading',
          { level: 1, name: /one topic at a time/ },
          { timeout: LAZY_PAGE_TIMEOUT_MS },
        ),
      ).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/topic-tests');
      expect(
        within(screen.getByRole('banner')).getAllByRole('link', {
          name: 'Topic Test Paper',
        })[0],
      ).toHaveAttribute('href', '/topic-tests');

      const ready = await screen.findByRole('region', {
        name: 'Tests ready to take',
      });
      expect(within(ready).getAllByRole('link')).toHaveLength(3);
      const soon = screen.getByRole('region', { name: 'Tests coming soon' });
      expect(within(soon).getByText('Ecosystem')).toBeInTheDocument();
      expect(within(soon).getByText('Test coming soon')).toBeInTheDocument();
      expect(within(soon).queryByRole('link')).not.toBeInTheDocument();

      await user.click(
        within(ready).getByRole('link', {
          name: 'Take the Ray optics test, Class 12',
        }),
      );
      expect(
        await screen.findByRole(
          'heading',
          { level: 1, name: /Ray optics/ },
          { timeout: LAZY_PAGE_TIMEOUT_MS },
        ),
      ).toBeInTheDocument();
      expect(router.state.location.pathname).toBe(
        '/topic-tests/topic_physics_ray_optics_class_12',
      );
      // The clock waits for the student
      expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();

      // Awaited act: the questions are their own download
      await act(async () => {
        await user.click(
          screen.getByRole('button', { name: 'Start the test' }),
        );
      });
      const paper = screen.getByRole('region', { name: 'Topic test paper' });
      // Questions download separately from the page
      expect(
        await within(paper).findAllByRole(
          'radiogroup',
          {},
          { timeout: LAZY_PAGE_TIMEOUT_MS },
        ),
      ).toHaveLength(20);
      expect(within(paper).getByText(/^Time left (2:00:00|1:59:5\d)$/));

      // Once marked, every question says why its answer is right
      await user.click(within(paper).getAllByRole('radio')[0]);
      await user.click(
        within(paper).getByRole('button', { name: 'Submit answers' }),
      );
      expect(within(paper).getAllByText(/^Why: /)).toHaveLength(20);
    },
    JOURNEY_TEST_TIMEOUT_MS,
  );

  it('says when a topic’s test is not ready yet', async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(student);
    renderApp('/topic-tests/topic_biology_ecosystem_class_12');

    expect(
      await screen.findByRole(
        'heading',
        { level: 1, name: 'This test is not ready yet' },
        { timeout: LAZY_PAGE_TIMEOUT_MS },
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'All topic tests' }),
    ).toHaveAttribute('href', '/topic-tests');
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
    // The team signs in to see orders, so the link opens them
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/team/orders'),
    );
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
