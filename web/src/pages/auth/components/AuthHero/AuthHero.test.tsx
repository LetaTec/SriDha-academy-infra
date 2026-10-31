import { act, fireEvent, render, screen, within } from '@testing-library/react';

import { BATCH_AVAILABILITY } from '@constants/catalogue';
import type { Subject } from '@services/catalogue';

import { AuthHero } from './AuthHero';
import { HERO_ROTATION_MS } from './useHeroRotation';

const subject = (
  id: string,
  slug: string,
  name: string,
  description: string,
  withTopics: boolean,
): Subject => ({
  id,
  slug,
  name,
  description,
  status: 'AVAILABLE',
  listPrice: null,
  chapters: withTopics
    ? [
        {
          id: `${id}-chapter`,
          title: 'Fundamentals',
          topics: [
            {
              id: `${id}-gst`,
              title: 'Learn GST for Class 11',
              summary: 'Input tax credit and invoice rules',
              level: 'Class 11',
              price: { amountPaise: 12900, currency: 'INR', taxLabel: null },
              lessons: [
                { id: 'l1', title: 'What is GST', durationMinutes: null },
              ],
              batches: [
                {
                  id: `${id}-batch`,
                  name: 'November batch',
                  scheduleLabel: '1st & 2nd November',
                  startDate: '2026-11-01',
                  startTime: '10:00',
                  sessionCount: 2,
                  sessionDurationMinutes: null,
                  instructorName: null,
                  capacity: 100,
                  seatsRemaining: 4,
                  availability: BATCH_AVAILABILITY.OPEN,
                },
              ],
            },
            {
              id: `${id}-rectification`,
              title: 'Rectification of errors',
              summary: 'Correcting ledger mistakes',
              level: 'Class 11',
              price: { amountPaise: 12900, currency: 'INR', taxLabel: null },
              lessons: [],
              batches: [],
            },
          ],
        },
      ]
    : [],
});

const SUBJECTS: Subject[] = [
  subject(
    'subject_accounts',
    'accounts',
    'Accounts',
    'Class 11 & 12 commerce learning',
    true,
  ),
  subject(
    'subject_economics',
    'economics',
    'Economics',
    'Focused sessions designed around clear concepts',
    false,
  ),
];

const frontCard = () => screen.getByRole('article');

const advanceCards = (steps = 1) => {
  for (let step = 0; step < steps; step += 1) {
    act(() => {
      vi.advanceTimersByTime(HERO_ROTATION_MS + 10);
    });
  }
};

const renderHero = (onSelect = vi.fn()) =>
  render(
    <AuthHero
      subjects={SUBJECTS}
      isLoading={false}
      hasError={false}
      onSelect={onSelect}
    />,
  );

describe('AuthHero', () => {
  beforeAll(() => {
    // jsdom's pointer events carry no coordinates; MouseEvent does.
    vi.stubGlobal('PointerEvent', MouseEvent);
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a subject card with its real topics, fee and next date', () => {
    renderHero();
    const card = frontCard();

    expect(
      within(card).getByRole('heading', {
        level: 2,
        name: 'Class 11 Accounts',
      }),
    ).toBeInTheDocument();
    expect(
      within(card).getByText(/Learn GST for Class 11/),
    ).toBeInTheDocument();
    expect(within(card).getByText('₹129')).toBeInTheDocument();
    expect(within(card).getByText('1 Nov 2026')).toBeInTheDocument();
    expect(within(card).getByText('Open for enrolment')).toBeInTheDocument();
    expect(
      within(card).getByRole('button', { name: 'View batches' }),
    ).toBeInTheDocument();
  });

  it('shuffles to the next card on its own', () => {
    renderHero();

    advanceCards();

    expect(
      within(frontCard()).getByRole('heading', {
        level: 2,
        name: 'Class 11 Economics',
      }),
    ).toBeInTheDocument();
  });

  it('marks a subject the catalogue does not list yet as opening soon', () => {
    renderHero();

    advanceCards(2);

    const card = frontCard();
    expect(
      within(card).getByRole('heading', { level: 2, name: 'Class 11 Science' }),
    ).toBeInTheDocument();
    expect(within(card).getByText('Opening soon')).toBeInTheDocument();
    // A card with no catalogue entry still carries content, never blank space.
    expect(
      within(card).getByText(
        'Physics, chemistry and biology topics, opening with the next intake',
      ),
    ).toBeInTheDocument();
    expect(within(card).getByText('Announced soon')).toBeInTheDocument();
    expect(
      within(card).queryByRole('button', { name: 'View batches' }),
    ).not.toBeInTheDocument();
  });

  it('stops and restarts the shuffle from the pause control', () => {
    renderHero();

    fireEvent.click(
      screen.getByRole('button', { name: 'Pause subject shuffle' }),
    );
    advanceCards(2);

    expect(
      within(frontCard()).getByRole('heading', {
        level: 2,
        name: 'Class 11 Accounts',
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Resume subject shuffle' }),
    );
    advanceCards();

    expect(
      within(frontCard()).getByRole('heading', {
        level: 2,
        name: 'Class 11 Economics',
      }),
    ).toBeInTheDocument();
  });

  it('holds the deck while a form field has focus', () => {
    render(
      <>
        <form>
          <label>
            Email
            <input type="email" />
          </label>
        </form>
        <AuthHero
          subjects={SUBJECTS}
          isLoading={false}
          hasError={false}
          onSelect={vi.fn()}
        />
      </>,
    );

    act(() => {
      screen.getByLabelText('Email').focus();
    });
    advanceCards(2);

    expect(
      within(frontCard()).getByRole('heading', {
        level: 2,
        name: 'Class 11 Accounts',
      }),
    ).toBeInTheDocument();
  });

  it('offers a manual next control when motion is reduced', () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) =>
      ({
        matches: query.includes('reduce'),
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList) as typeof window.matchMedia;

    try {
      renderHero();

      // No timer-driven shuffle, but every card stays reachable.
      advanceCards(2);
      expect(
        within(frontCard()).getByRole('heading', {
          level: 2,
          name: 'Class 11 Accounts',
        }),
      ).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Next subject' }));
      expect(
        within(frontCard()).getByRole('heading', {
          level: 2,
          name: 'Class 11 Economics',
        }),
      ).toBeInTheDocument();
    } finally {
      window.matchMedia = original;
    }
  });

  it('steps back and forward by hand and loops around the ends', () => {
    renderHero();

    fireEvent.click(screen.getByRole('button', { name: 'Previous subject' }));
    expect(
      within(frontCard()).getByRole('heading', {
        level: 2,
        name: 'Other subject',
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next subject' }));
    expect(
      within(frontCard()).getByRole('heading', {
        level: 2,
        name: 'Class 11 Accounts',
      }),
    ).toBeInTheDocument();
  });

  it('moves on a horizontal swipe but not on a tap', () => {
    const { container } = renderHero();
    const viewport = container.querySelector('[class*="viewport"]') as Element;

    fireEvent.pointerDown(viewport, { clientX: 300 });
    fireEvent.pointerUp(viewport, { clientX: 290 });
    expect(
      within(frontCard()).getByRole('heading', { name: 'Class 11 Accounts' }),
    ).toBeInTheDocument();

    fireEvent.pointerDown(viewport, { clientX: 300 });
    fireEvent.pointerUp(viewport, { clientX: 200 });
    expect(
      within(frontCard()).getByRole('heading', { name: 'Class 11 Economics' }),
    ).toBeInTheDocument();
  });

  it('keeps neighbouring cards out of the accessibility tree and tab order', () => {
    const { container } = renderHero();
    const slides = container.querySelectorAll('article');

    expect(slides.length).toBeGreaterThan(3);
    expect(container.querySelectorAll('article:not([inert])')).toHaveLength(1);
    expect(screen.getAllByRole('article')).toHaveLength(1);
  });

  it('draws a decorative student illustration on the card', () => {
    renderHero();

    const art = frontCard().querySelector('svg');
    expect(art).toHaveAttribute('aria-hidden', 'true');
  });

  it('selects the topic behind the front card', () => {
    const onSelect = vi.fn();
    renderHero(onSelect);

    fireEvent.click(screen.getByRole('button', { name: 'View batches' }));

    expect(onSelect).toHaveBeenCalledWith('subject_accounts-gst');
  });

  it('shows loading and error states without inventing a subject', () => {
    const { rerender } = render(
      <AuthHero subjects={[]} isLoading hasError={false} onSelect={vi.fn()} />,
    );

    expect(screen.getByText('Loading subjects')).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();

    const onRetry = vi.fn();
    rerender(
      <AuthHero
        subjects={[]}
        isLoading={false}
        hasError
        onSelect={vi.fn()}
        onRetry={onRetry}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalled();
  });
});
