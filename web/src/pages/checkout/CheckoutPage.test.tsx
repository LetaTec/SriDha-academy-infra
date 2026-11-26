import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { QUERY_KEY } from '@/app/queryClient';
import { AuthProvider } from '@context/AuthContext';
import { ToastProvider } from '@context/ToastContext';
import { getCurrentSession, signUpStudent } from '@services/auth/api';
import { getCatalogue } from '@services/catalogue/api';
import { createCheckout } from '@services/payments/api';
import { catalogueFixture, openBatch } from '@/test/catalogueFixture';

import CheckoutPage from './CheckoutPage';

vi.mock('@services/catalogue/api', () => ({ getCatalogue: vi.fn() }));
vi.mock('@services/payments/api', () => ({
  createCheckout: vi.fn(),
  verifyPayment: vi.fn(),
}));
vi.mock('@services/payments/razorpay', () => ({ payWithRazorpay: vi.fn() }));
vi.mock('@services/auth/api', () => ({
  getCurrentSession: vi.fn(),
  logoutStudent: vi.fn(),
  signInStudent: vi.fn(),
  signUpStudent: vi.fn(),
}));

const signedInStudent = {
  id: 'user_1',
  email: 'meera@example.com',
  role: 'STUDENT' as const,
  name: 'Meera Iyer',
  contact: {
    mobile: '+91 98765 43210',
    state: 'Karnataka' as const,
    city: 'Bengaluru',
    pinCode: '560001',
  },
  student: null,
};

const signedOut = () =>
  Object.assign(new Error('Unauthorized'), {
    isAxiosError: true,
    response: {
      status: 401,
      data: { message: 'Sign in', code: 'UNAUTHENTICATED', details: null },
    },
  });

const GST_TOPIC_ID = 'topic_accounts_gst_class_11';
const RAJASTHAN_GSTIN = '08AAGCL9166P1ZL';

const renderCheckout = (path = `/checkout?topic=${GST_TOPIC_ID}`) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  queryClient.setQueryData(QUERY_KEY.catalogue, catalogueFixture);

  const router = createMemoryRouter(
    [
      {
        path: '/checkout',
        element: <CheckoutPage />,
      },
    ],
    { initialEntries: [path] },
  );

  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
};

describe('CheckoutPage — B2C & B2B Billing', () => {
  beforeEach(() => {
    vi.mocked(getCurrentSession).mockRejectedValue(signedOut());
    vi.mocked(signUpStudent).mockImplementation(async body => ({
      id: 'user_new',
      email: body.email,
      role: 'STUDENT',
      name: body.fullName,
      contact: {
        mobile: body.mobile,
        state: body.state,
        city: body.city,
        pinCode: body.pinCode,
      },
      student: null,
    }));
    vi.mocked(getCatalogue).mockResolvedValue(catalogueFixture);
    vi.mocked(createCheckout).mockResolvedValue({
      paymentId: 'pay_test_123',
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
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('submits B2C Individual checkout without business fields', async () => {
    const user = userEvent.setup();
    renderCheckout();

    await screen.findByRole('heading', { name: /Review your/ });
    await screen.findByText('Billing details');

    // Individual radio should be checked by default
    const individualRadio = screen.getByRole('radio', {
      name: /Individual/i,
    });
    expect(individualRadio).toBeChecked();

    // Business fields must not be in the document
    expect(
      screen.queryByRole('textbox', { name: /Business legal name/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: /GSTIN/i }),
    ).not.toBeInTheDocument();

    // Fill form
    await user.type(
      screen.getByRole('textbox', { name: /Full name/i }),
      'Asha Verma',
    );
    await user.type(
      screen.getByRole('textbox', { name: /Email ID/i }),
      'asha@example.com',
    );
    await user.type(
      screen.getByRole('textbox', { name: /Mobile number/i }),
      '+91 98765 43210',
    );
    // No street address for an individual
    expect(
      screen.queryByRole('textbox', { name: /Billing address/i }),
    ).not.toBeInTheDocument();
    await user.selectOptions(
      screen.getByRole('combobox', { name: /State/i }),
      'Rajasthan',
    );
    await user.type(screen.getByRole('textbox', { name: /City/i }), 'Jaipur');
    await user.type(
      screen.getByRole('textbox', { name: /PIN code/i }),
      '302006',
    );
    // A visitor's account is made with the order
    await user.type(
      screen.getByLabelText(/Create a password/i),
      'correct-horse-1',
    );
    await user.click(screen.getByRole('checkbox', { name: /I agree to the/i }));

    await user.click(screen.getByRole('button', { name: /Pay ₹129/i }));

    await waitFor(() => {
      expect(createCheckout).toHaveBeenCalledWith({
        kind: 'ENROLMENT',
        batchId: openBatch.id,
        customerType: 'INDIVIDUAL',
        fullName: 'Asha Verma',
        email: 'asha@example.com',
        mobile: '+91 98765 43210',
        state: 'Rajasthan',
        city: 'Jaipur',
        pinCode: '302006',
      });
    });
    expect(signUpStudent).toHaveBeenCalledWith({
      fullName: 'Asha Verma',
      email: 'asha@example.com',
      password: 'correct-horse-1',
      mobile: '+91 98765 43210',
      state: 'Rajasthan',
      city: 'Jaipur',
      pinCode: '302006',
    });
  });

  it('asks a visitor for a password of at least 8 characters before paying', async () => {
    const user = userEvent.setup();
    renderCheckout();

    await screen.findByText('Billing details');
    await user.type(
      screen.getByRole('textbox', { name: /Full name/i }),
      'Asha Verma',
    );
    await user.type(
      screen.getByRole('textbox', { name: /Email ID/i }),
      'asha@example.com',
    );
    await user.type(
      screen.getByRole('textbox', { name: /Mobile number/i }),
      '+91 98765 43210',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: /State/i }),
      'Rajasthan',
    );
    await user.type(screen.getByRole('textbox', { name: /City/i }), 'Jaipur');
    await user.type(
      screen.getByRole('textbox', { name: /PIN code/i }),
      '302006',
    );
    await user.type(screen.getByLabelText(/Create a password/i), 'short');
    await user.click(screen.getByRole('checkbox', { name: /I agree to the/i }));
    await user.click(screen.getByRole('button', { name: /Pay ₹129/i }));

    expect(
      await screen.findByText('Use at least 8 characters'),
    ).toBeInTheDocument();
    expect(signUpStudent).not.toHaveBeenCalled();
    expect(createCheckout).not.toHaveBeenCalled();
  });

  it('sells a signed-in student one ₹5 attempt at a topic test, with no teacher or batch', async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(signedInStudent);
    const user = userEvent.setup();
    renderCheckout(`/checkout?test=${GST_TOPIC_ID}`);

    await screen.findByRole('heading', { name: /Review your/ });
    expect(await screen.findByText('Topic test')).toBeInTheDocument();
    expect(screen.getByText('Test fee')).toBeInTheDocument();
    expect(screen.getByText('45 minutes')).toBeInTheDocument();
    expect(screen.queryByText(/Your tutor/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Choose your batch/i)).not.toBeInTheDocument();

    // Every detail comes from the account; no password is asked for
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: /Full name/i })).toHaveValue(
        'Meera Iyer',
      ),
    );
    expect(screen.getByRole('textbox', { name: /Email ID/i })).toHaveValue(
      'meera@example.com',
    );
    expect(screen.getByRole('textbox', { name: /Mobile number/i })).toHaveValue(
      '+91 98765 43210',
    );
    expect(screen.getByRole('combobox', { name: /State/i })).toHaveValue(
      'Karnataka',
    );
    expect(screen.getByRole('textbox', { name: /City/i })).toHaveValue(
      'Bengaluru',
    );
    expect(screen.getByRole('textbox', { name: /PIN code/i })).toHaveValue(
      '560001',
    );
    expect(
      screen.queryByLabelText(/Create a password/i),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /I agree to the/i }));
    await user.click(screen.getByRole('button', { name: /Pay ₹5/i }));

    await waitFor(() => {
      expect(createCheckout).toHaveBeenCalledWith({
        kind: 'TEST_ATTEMPT',
        topicId: GST_TOPIC_ID,
        customerType: 'INDIVIDUAL',
        fullName: 'Meera Iyer',
        email: 'meera@example.com',
        mobile: '+91 98765 43210',
        state: 'Karnataka',
        city: 'Bengaluru',
        pinCode: '560001',
      });
    });
  });

  it('lets a visitor create their account while buying a topic test', async () => {
    renderCheckout(`/checkout?test=${GST_TOPIC_ID}`);

    expect(
      await screen.findByLabelText(/Create a password/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Already have an account\? Log in/ }),
    ).toBeInTheDocument();
  });

  it('submits B2B Business checkout with legal name, GSTIN and PO reference', async () => {
    const user = userEvent.setup();
    renderCheckout();

    await screen.findByRole('heading', { name: /Review your/ });
    await screen.findByText('Billing details');

    // Switch to Business
    const businessRadio = screen.getByRole('radio', {
      name: /Business \/ Organisation/i,
    });
    await user.click(businessRadio);
    expect(businessRadio).toBeChecked();

    // Business fields must appear
    expect(
      await screen.findByRole('textbox', { name: /Business legal name/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /GSTIN/i })).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', { name: /Purchase order reference/i }),
    ).toBeInTheDocument();

    // Fill contact details, and the address the tax invoice needs
    await user.type(
      screen.getByRole('textbox', { name: /Contact person full name/i }),
      'Asha Verma',
    );
    await user.type(
      screen.getByRole('textbox', { name: /Email ID/i }),
      'accounts@vermalearning.example.com',
    );
    await user.type(
      screen.getByRole('textbox', { name: /Mobile number/i }),
      '+91 98765 43210',
    );
    await user.type(
      screen.getByRole('textbox', { name: /Billing address/i }),
      '4th floor, Tonk Road',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: /State/i }),
      'Rajasthan',
    );
    await user.type(screen.getByRole('textbox', { name: /City/i }), 'Jaipur');
    await user.type(
      screen.getByRole('textbox', { name: /PIN code/i }),
      '302015',
    );
    await user.type(
      screen.getByLabelText(/Create a password/i),
      'correct-horse-1',
    );

    // Fill business fields
    await user.type(
      screen.getByRole('textbox', { name: /Business legal name/i }),
      'Verma Learning Private Limited',
    );
    await user.type(
      screen.getByRole('textbox', { name: /GSTIN/i }),
      RAJASTHAN_GSTIN,
    );
    await user.type(
      screen.getByRole('textbox', { name: /Purchase order reference/i }),
      'PO-2026-0042',
    );

    await user.click(screen.getByRole('checkbox', { name: /I agree to the/i }));
    await user.click(screen.getByRole('button', { name: /Pay ₹129/i }));

    await waitFor(() => {
      expect(createCheckout).toHaveBeenCalledWith({
        kind: 'ENROLMENT',
        batchId: openBatch.id,
        customerType: 'BUSINESS',
        fullName: 'Asha Verma',
        email: 'accounts@vermalearning.example.com',
        mobile: '+91 98765 43210',
        addressLine1: '4th floor, Tonk Road',
        state: 'Rajasthan',
        city: 'Jaipur',
        pinCode: '302015',
        businessLegalName: 'Verma Learning Private Limited',
        gstin: RAJASTHAN_GSTIN,
        purchaseOrderReference: 'PO-2026-0042',
      });
    });
  });

  it('validates PIN code format (requires 6 digits)', async () => {
    const user = userEvent.setup();
    renderCheckout();

    await screen.findByRole('heading', { name: /Review your/ });
    await user.type(
      screen.getByRole('textbox', { name: /PIN code/i }),
      '12345',
    );
    await user.click(screen.getByRole('button', { name: /Pay ₹129/i }));

    expect(
      await screen.findByText('Enter a valid 6-digit PIN code'),
    ).toBeInTheDocument();
    expect(createCheckout).not.toHaveBeenCalled();
  });

  it('validates mandatory business fields when Business is selected', async () => {
    const user = userEvent.setup();
    renderCheckout();

    await screen.findByRole('heading', { name: /Review your/ });

    // Select Business but leave business fields blank
    await user.click(
      screen.getByRole('radio', { name: /Business \/ Organisation/i }),
    );
    await user.click(screen.getByRole('button', { name: /Pay ₹129/i }));

    expect(
      await screen.findByText("Enter the business's legal name"),
    ).toBeInTheDocument();
    expect(screen.getByText('Enter the GSTIN')).toBeInTheDocument();
    expect(createCheckout).not.toHaveBeenCalled();
  });

  it('validates GSTIN format and checksum', async () => {
    const user = userEvent.setup();
    renderCheckout();

    await screen.findByRole('heading', { name: /Review your/ });
    await user.click(
      screen.getByRole('radio', { name: /Business \/ Organisation/i }),
    );

    // Invalid format
    await user.type(
      screen.getByRole('textbox', { name: /GSTIN/i }),
      'INVALID_GSTIN',
    );
    await user.click(screen.getByRole('button', { name: /Pay ₹129/i }));

    expect(
      await screen.findByText(
        /This is not in the GSTIN format|A GSTIN has 15 characters/,
      ),
    ).toBeInTheDocument();

    // Invalid checksum (last char changed from L to A)
    await user.clear(screen.getByRole('textbox', { name: /GSTIN/i }));
    await user.type(
      screen.getByRole('textbox', { name: /GSTIN/i }),
      '08AAGCL9166P1ZA',
    );
    await user.click(screen.getByRole('button', { name: /Pay ₹129/i }));

    expect(
      await screen.findByText(
        'The last character does not match the rest. Please check the GSTIN',
      ),
    ).toBeInTheDocument();
    expect(createCheckout).not.toHaveBeenCalled();
  });

  it('validates that GSTIN state matches selected billing state', async () => {
    const user = userEvent.setup();
    renderCheckout();

    await screen.findByRole('heading', { name: /Review your/ });
    await user.click(
      screen.getByRole('radio', { name: /Business \/ Organisation/i }),
    );

    // State is Delhi, but GSTIN is Rajasthan (08)
    await user.selectOptions(
      screen.getByRole('combobox', { name: /State/i }),
      'Delhi',
    );
    await user.type(
      screen.getByRole('textbox', { name: /GSTIN/i }),
      RAJASTHAN_GSTIN,
    );
    await user.click(screen.getByRole('button', { name: /Pay ₹129/i }));

    expect(
      await screen.findByText(
        'This GSTIN is registered in Rajasthan. Choose Rajasthan as the billing state, or check the GSTIN',
      ),
    ).toBeInTheDocument();
    expect(createCheckout).not.toHaveBeenCalled();
  });
});
