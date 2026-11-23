import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  RefundDetailResponse,
  RefundsListResponse,
  ResolveRefundExceptionResponse,
} from '@contracts/finance';
import { REFUND_DESK_TEXT as TEXT } from '@constants/refunds';
import { AuthProvider } from '@context/AuthContext';
import { ToastProvider } from '@context/ToastContext';
import { getCurrentSession } from '@services/auth/api';
import {
  getRefundDetail,
  listRefunds,
  resolveRefundException,
} from '@services/finance/refunds';

import RefundsPage from './RefundsPage';

vi.mock('@services/auth/api', () => ({
  getCurrentSession: vi.fn(),
  logoutStudent: vi.fn(),
}));

vi.mock('@services/finance/refunds', () => ({
  listRefunds: vi.fn(),
  getRefundDetail: vi.fn(),
  resolveRefundException: vi.fn(),
}));

const financeAdmin = {
  id: 'user_fa_001',
  email: 'finance@sridha.test',
  role: 'FINANCE_ADMIN' as const,
  name: null,
  student: null,
};

const studentUser = {
  id: 'user_st_001',
  email: 'student@example.com',
  role: 'STUDENT' as const,
  name: 'Rahul Sharma',
  student: {
    id: 'st_001',
    fullName: 'Rahul Sharma',
    standard: 'CLASS_11' as const,
    stream: 'COMMERCE' as const,
    streamOther: null,
  },
};

const mockSummary = {
  totalCount: 2,
  requiresReviewCount: 1,
  requiresReviewPaise: 50000,
  pendingCount: 0,
  pendingPaise: 0,
  processedCount: 1,
  processedPaise: 75000,
  failedCount: 0,
  failedPaise: 0,
};

const mockListResponse: RefundsListResponse = {
  refunds: [
    {
      id: 'rfnd_test_001',
      paymentId: 'pay_test_001',
      amountPaise: 50000,
      currency: 'INR',
      status: 'REQUIRES_REVIEW',
      source: 'FINANCE_ADMIN',
      providerRefundId: null,
      reason: 'Course withdrawal',
      reviewReason: 'Gateway timeout during refund creation',
      failureReason: null,
      createdAt: '2026-11-17T10:00:00Z',
      customerName: 'Rahul Sharma',
      customerEmail: 'rahul@example.com',
      paymentStatus: 'PAID',
      paymentAmountPaise: 50000,
      providerPaymentId: 'pay_rzp_111',
      providerOrderId: 'order_test_001',
    },
    {
      id: 'rfnd_test_002',
      paymentId: 'pay_test_002',
      amountPaise: 75000,
      currency: 'INR',
      status: 'PROCESSED',
      source: 'FINANCE_ADMIN',
      providerRefundId: 'rfnd_rzp_99999',
      reason: 'Duplicate payment',
      reviewReason: null,
      failureReason: null,
      createdAt: '2026-11-17T09:00:00Z',
      customerName: 'Priya Patel',
      customerEmail: 'priya@example.com',
      paymentStatus: 'REFUNDED',
      paymentAmountPaise: 75000,
      providerPaymentId: 'pay_rzp_222',
      providerOrderId: 'order_test_002',
    },
  ],
  summary: mockSummary,
  total: 2,
  limit: 25,
  offset: 0,
};

const mockDetailResponse: RefundDetailResponse = {
  refund: {
    id: 'rfnd_test_001',
    paymentId: 'pay_test_001',
    amountPaise: 50000,
    currency: 'INR',
    status: 'REQUIRES_REVIEW',
    source: 'FINANCE_ADMIN',
    providerRefundId: null,
    reason: 'Course withdrawal',
    reviewReason: 'Gateway timeout during refund creation',
    failureReason: null,
    createdAt: '2026-11-17T10:00:00Z',
  },
  payment: {
    id: 'pay_test_001',
    status: 'PAID',
    amountPaise: 50000,
    currency: 'INR',
    provider: 'RAZORPAY',
    providerPaymentId: 'pay_rzp_111',
    providerOrderId: 'order_test_001',
    paidAt: '2026-11-17T08:05:00Z',
    customerEmail: 'rahul@example.com',
    customerName: 'Rahul Sharma',
    createdAt: '2026-11-17T08:00:00Z',
  },
  auditEntries: [
    {
      id: 'audit_001',
      occurredAt: '2026-11-17T10:00:00Z',
      action: 'PAYMENT_REFUND_REQUESTED',
      entityType: 'PAYMENT_REFUND',
      entityId: 'rfnd_test_001',
      actorRole: 'SUPER_ADMIN',
      actorUserId: 'admin-1',
      requestId: 'req_test_001',
      details: { amountPaise: 50000 },
    },
  ],
  mismatches: [],
};

const renderRefundsPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  const router = createMemoryRouter(
    [
      {
        path: '/team/refunds',
        element: <RefundsPage />,
      },
    ],
    { initialEntries: ['/team/refunds'] },
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

describe('RefundsPage — Operational Refund Desk & Exceptions', () => {
  beforeEach(() => {
    vi.mocked(getCurrentSession).mockResolvedValue(financeAdmin);
    vi.mocked(listRefunds).mockResolvedValue(mockListResponse);
    vi.mocked(getRefundDetail).mockResolvedValue(mockDetailResponse);
    vi.mocked(resolveRefundException).mockResolvedValue({
      resolved: true,
      refund: {
        ...mockDetailResponse.refund,
        status: 'PROCESSED',
        providerRefundId: 'rfnd_support_verified_123',
      },
    } satisfies ResolveRefundExceptionResponse);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders forbidden state for unauthenticated or student users', async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(studentUser);
    renderRefundsPage();

    await screen.findByText(TEXT.forbiddenTitle);
    expect(screen.getByText(TEXT.forbiddenMessage)).toBeInTheDocument();
  });

  it('renders KPI metrics and refunds table for finance administrators', async () => {
    renderRefundsPage();

    await screen.findByRole('heading', { level: 1, name: /Refund management/ });
    expect(screen.getByText(TEXT.eyebrow)).toBeInTheDocument();

    // Verify KPI cards rendered
    await screen.findByText(TEXT.kpiRequiresReview);
    expect(screen.getAllByText('₹500').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(TEXT.kpiProcessedAmount)).toBeInTheDocument();
    expect(screen.getAllByText('₹750').length).toBeGreaterThanOrEqual(1);

    // Verify table records
    expect(screen.getByText('rfnd_test_001')).toBeInTheDocument();
    expect(screen.getByText('rfnd_test_002')).toBeInTheDocument();
    expect(
      screen.getByText(/Gateway timeout during refund creation/),
    ).toBeInTheDocument();
  });

  it('filters by status and searches refunds', async () => {
    const user = userEvent.setup();
    renderRefundsPage();

    await screen.findByText('rfnd_test_001');

    // Click "Exceptions Only" toggle button
    const exceptionsButton = screen.getByRole('button', {
      name: 'Exceptions Only',
    });
    await user.click(exceptionsButton);

    expect(listRefunds).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'REQUIRES_REVIEW' }),
    );

    // Search query typing
    const searchInput = screen.getByLabelText(TEXT.searchLabel);
    await user.type(searchInput, 'Rahul');

    expect(searchInput).toHaveValue('Rahul');
  });

  it('opens drawer and inspects refund details with audit trail', async () => {
    const user = userEvent.setup();
    renderRefundsPage();

    await screen.findByText('rfnd_test_001');

    const inspectButtons = screen.getAllByRole('button', {
      name: TEXT.inspectAction,
    });
    await user.click(inspectButtons[0]);

    // Drawer should open and load detail
    await waitFor(() => {
      expect(getRefundDetail).toHaveBeenCalledWith('rfnd_test_001');
    });

    await screen.findByRole('heading', {
      level: 3,
      name: /Action Required: Manual Review Exception/,
    });
    expect(screen.getAllByText('pay_rzp_111').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('PAYMENT_REFUND_REQUESTED')).toBeInTheDocument();
  });

  it('resolves a REQUIRES_REVIEW exception with verified evidence and notes', async () => {
    const user = userEvent.setup();
    renderRefundsPage();

    await screen.findByText('rfnd_test_001');

    const inspectButtons = screen.getAllByRole('button', {
      name: TEXT.inspectAction,
    });
    await user.click(inspectButtons[0]);

    await screen.findByRole('heading', {
      level: 3,
      name: /Action Required: Manual Review Exception/,
    });

    // Fill in the resolution form
    const evidenceInput = screen.getByLabelText(TEXT.resolveEvidenceLabel);
    const notesInput = screen.getByLabelText(TEXT.resolveNotesLabel);
    const providerRefundIdInput = screen.getByLabelText(
      TEXT.resolveProviderRefundIdLabel,
    );

    await user.type(evidenceInput, 'Razorpay ARN: 20261117-TEST-ARN');
    await user.type(
      notesInput,
      'Confirmed with Razorpay merchant support ticket #1234',
    );
    await user.type(providerRefundIdInput, 'rfnd_support_verified_123');

    const submitButton = screen.getByRole('button', {
      name: TEXT.resolveSubmitConfirm,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(resolveRefundException).toHaveBeenCalledWith('rfnd_test_001', {
        action: 'CONFIRM_PROCESSED',
        evidenceReference: 'Razorpay ARN: 20261117-TEST-ARN',
        notes: 'Confirmed with Razorpay merchant support ticket #1234',
        providerRefundId: 'rfnd_support_verified_123',
      });
    });

    await screen.findByText(new RegExp(TEXT.resolveSuccess));
  });
  describe('marking a refund failed (R31-09)', () => {
    const openResolution = async () => {
      const user = userEvent.setup();
      renderRefundsPage();
      await screen.findByText('rfnd_test_001');
      await user.click(
        screen.getAllByRole('button', { name: TEXT.inspectAction })[0],
      );
      await screen.findByRole('heading', {
        level: 3,
        name: /Action Required: Manual Review Exception/,
      });
      await user.type(
        screen.getByLabelText(TEXT.resolveEvidenceLabel),
        'Razorpay dashboard: refund failed',
      );
      await user.type(
        screen.getByLabelText(TEXT.resolveNotesLabel),
        'Checked the dashboard, no money returned',
      );
      return user;
    };

    it('asks for confirmation first and sends nothing until it is given', async () => {
      const user = await openResolution();
      await user.selectOptions(
        screen.getByLabelText(TEXT.resolveActionLabel),
        'MARK_FAILED',
      );
      await user.click(
        screen.getByRole('button', { name: TEXT.resolveSubmitFail }),
      );

      const dialog = await screen.findByRole('dialog', {
        name: TEXT.resolveFailTitle,
      });
      expect(dialog).toBeInTheDocument();
      expect(resolveRefundException).not.toHaveBeenCalled();

      await user.click(
        within(dialog).getByRole('button', { name: TEXT.resolveFailBack }),
      );
      expect(resolveRefundException).not.toHaveBeenCalled();
    });

    it('sends the failure only after confirmation, and never a provider refund id', async () => {
      const user = await openResolution();
      // An id typed for CONFIRM_PROCESSED must not travel with MARK_FAILED
      await user.type(
        screen.getByLabelText(TEXT.resolveProviderRefundIdLabel),
        'rfnd_typed_earlier',
      );
      await user.selectOptions(
        screen.getByLabelText(TEXT.resolveActionLabel),
        'MARK_FAILED',
      );
      expect(
        screen.queryByLabelText(TEXT.resolveProviderRefundIdLabel),
      ).not.toBeInTheDocument();
      await user.click(
        screen.getByRole('button', { name: TEXT.resolveSubmitFail }),
      );
      const dialog = await screen.findByRole('dialog', {
        name: TEXT.resolveFailTitle,
      });
      await user.click(
        within(dialog).getByRole('button', { name: TEXT.resolveFailConfirm }),
      );

      await waitFor(() => {
        expect(resolveRefundException).toHaveBeenCalledTimes(1);
      });
      const [, body] = vi.mocked(resolveRefundException).mock.calls[0];
      expect(body).toEqual({
        action: 'MARK_FAILED',
        evidenceReference: 'Razorpay dashboard: refund failed',
        notes: 'Checked the dashboard, no money returned',
      });
      expect(body).not.toHaveProperty('providerRefundId');
    });

    it('does not ask for confirmation when confirming a refund as processed', async () => {
      const user = await openResolution();
      await user.type(
        screen.getByLabelText(TEXT.resolveProviderRefundIdLabel),
        'rfnd_support_verified_123',
      );
      await user.click(
        screen.getByRole('button', { name: TEXT.resolveSubmitConfirm }),
      );
      await waitFor(() => {
        expect(resolveRefundException).toHaveBeenCalledTimes(1);
      });
      // The confirmation dialog never opens
      expect(screen.queryByText(TEXT.resolveFailTitle)).not.toBeInTheDocument();
    });

    it("shows the server's own message when it refuses the evidence", async () => {
      vi.mocked(resolveRefundException).mockRejectedValueOnce(
        Object.assign(new Error('Request failed with status code 409'), {
          isAxiosError: true,
          response: {
            status: 409,
            data: {
              message: 'Provider refund receipt does not match this refund',
              code: 'PAYMENT_VERIFICATION_FAILED',
              details: null,
            },
          },
        }),
      );
      const user = await openResolution();
      await user.selectOptions(
        screen.getByLabelText(TEXT.resolveActionLabel),
        'MARK_FAILED',
      );
      await user.click(
        screen.getByRole('button', { name: TEXT.resolveSubmitFail }),
      );
      const dialog = await screen.findByRole('dialog', {
        name: TEXT.resolveFailTitle,
      });
      await user.click(
        within(dialog).getByRole('button', { name: TEXT.resolveFailConfirm }),
      );

      expect(
        await screen.findByText(
          'Provider refund receipt does not match this refund',
        ),
      ).toBeInTheDocument();
      expect(
        screen.queryByText('Request failed with status code 409'),
      ).not.toBeInTheDocument();
    });
  });
});
