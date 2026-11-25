import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AuthProvider } from '@context/AuthContext';
import { ToastProvider } from '@context/ToastContext';
import { getCurrentSession } from '@services/auth/api';
import type { Enrolment } from '@services/payments';
import { listMyBatches } from '@services/payments/api';
import { openBatch } from '@/test/catalogueFixture';

import MyBatchesPage from './MyBatchesPage';

vi.mock('@services/auth/api', () => ({
  getCurrentSession: vi.fn(),
  logoutStudent: vi.fn(),
  signInStudent: vi.fn(),
  signUpStudent: vi.fn(),
}));
vi.mock('@services/payments/api', () => ({ listMyBatches: vi.fn() }));

const student = {
  id: 'user_1',
  email: 'meera@example.com',
  role: 'STUDENT' as const,
  name: 'Meera Iyer',
  student: null,
};

const enrolment = (
  id: string,
  title: string,
  batch: Partial<Enrolment['batch']>,
  status: Enrolment['status'] = 'CONFIRMED',
): Enrolment => ({
  id,
  status,
  createdAt: '2026-11-20T10:00:00Z',
  subject: { id: 'subject_maths', slug: 'mathematics', name: 'Mathematics' },
  topic: {
    id: `topic_${id}`,
    title,
    shortTitle: title,
    summary: title,
    level: 'Class 10',
    icon: null,
    featuredRank: null,
    price: { amountPaise: 12900, currency: 'INR', taxLabel: null },
    lessons: [],
  },
  batch: { ...openBatch, ...batch },
});

const renderPage = async () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const router = createMemoryRouter(
    [{ path: '/my-batches', element: <MyBatchesPage /> }],
    { initialEntries: ['/my-batches'] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
  await screen.findByRole('heading', { level: 1, name: /My batches/ });
};

describe('MyBatchesPage', () => {
  it('counts down to upcoming batches and lists the ones already taught', async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(student);
    vi.mocked(listMyBatches).mockResolvedValue([
      enrolment('past', 'Polynomials', {
        name: 'Batch 1',
        startDate: '2026-01-10',
        startTime: '20:30',
        sessionCount: 1,
        sessionDurationMinutes: 120,
        instructorName: 'Kamini Jain',
      }),
      enrolment('next', 'Trigonometry', {
        name: 'Batch 2',
        startDate: '2099-01-03',
        startTime: '11:00',
        sessionCount: 2,
        sessionDurationMinutes: 120,
        instructorName: 'Richa Varyani',
      }),
      // Never paid: not shown
      enrolment(
        'unpaid',
        'Logarithms',
        { startDate: '2099-02-01', startTime: '09:00' },
        'PENDING_PAYMENT',
      ),
    ]);
    await renderPage();

    const upcoming = await screen.findByRole('region', {
      name: 'Upcoming batches',
    });
    expect(within(upcoming).getByText('Trigonometry')).toBeInTheDocument();
    expect(
      within(upcoming).getByText('Class 10 · Batch 2'),
    ).toBeInTheDocument();
    expect(within(upcoming).getByRole('timer')).toHaveAccessibleName(
      /^Class starts in \d+ days \d+ hours \d+ minutes$/,
    );
    expect(
      within(upcoming).getByText('Sat, 3 Jan, Sun, 4 Jan'),
    ).toBeInTheDocument();
    expect(
      within(upcoming).getByText('11:00 am – 1:00 pm IST'),
    ).toBeInTheDocument();
    expect(within(upcoming).getByText('Richa Varyani')).toBeInTheDocument();

    const previous = screen.getByRole('region', { name: 'Previous batches' });
    expect(within(previous).getByText('Polynomials')).toBeInTheDocument();
    expect(
      within(previous).getByText('Completed on Sat, 10 Jan'),
    ).toBeInTheDocument();
    expect(within(previous).queryByRole('timer')).not.toBeInTheDocument();

    expect(screen.queryByText('Logarithms')).not.toBeInTheDocument();
  });

  it('points a student with no paid batch to the topics', async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(student);
    vi.mocked(listMyBatches).mockResolvedValue([]);
    await renderPage();

    expect(await screen.findByText('No batches yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Browse topics/ })).toHaveAttribute(
      'href',
      '/topics',
    );
  });
});
