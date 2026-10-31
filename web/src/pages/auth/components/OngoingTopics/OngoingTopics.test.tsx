import { render, screen, act, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { OngoingTopics } from './OngoingTopics';
import { DECK_TIMING } from './useSubjectShuffle';
import type { Topic } from '@services/catalogue';

describe('OngoingTopics Interactive Subject Explorer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the interactive subject explorer with selector tabs and initial featured subject', () => {
    const mockTopics: Topic[] = [];

    render(
      <BrowserRouter>
        <OngoingTopics catalogueTopics={mockTopics} />
      </BrowserRouter>,
    );

    // Subject tabs in tablist
    expect(screen.getByRole('tab', { name: /GST/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Science/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Accounts/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Economics/i })).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: /Mathematics/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /English/i })).toBeInTheDocument();

    // Exactly one active featured subject preview (GST initially)
    const gstTab = screen.getByRole('tab', { name: /GST/i });
    expect(gstTab).toHaveAttribute('aria-selected', 'true');

    // Featured preview heading
    expect(
      screen.getByRole('heading', { level: 3, name: 'GST' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Input tax credit, returns & invoice rules/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Explore subject/i }),
    ).toBeInTheDocument();
  });

  it('updates the featured preview when a user clicks a different subject tab', () => {
    const mockTopics: Topic[] = [];

    render(
      <BrowserRouter>
        <OngoingTopics catalogueTopics={mockTopics} />
      </BrowserRouter>,
    );

    const scienceTab = screen.getByRole('tab', { name: /Science/i });

    // User clicks the Science tab
    fireEvent.click(scienceTab);

    expect(scienceTab).toHaveAttribute('aria-selected', 'true');
    expect(
      screen.getByRole('heading', { level: 3, name: 'Science' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Core physical concepts & empirical laws/i),
    ).toBeInTheDocument();

    // Click Accounts tab
    const accountsTab = screen.getByRole('tab', { name: /Accounts/i });
    fireEvent.click(accountsTab);

    expect(accountsTab).toHaveAttribute('aria-selected', 'true');
    expect(
      screen.getByRole('heading', { level: 3, name: 'Accounts' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Ledger totals, journal entries & trial balance/i),
    ).toBeInTheDocument();
  });

  it('supports keyboard navigation between subject selector tabs', () => {
    const mockTopics: Topic[] = [];

    render(
      <BrowserRouter>
        <OngoingTopics catalogueTopics={mockTopics} />
      </BrowserRouter>,
    );

    const gstTab = screen.getByRole('tab', { name: /GST/i });

    // Press ArrowRight to move from GST to Science
    fireEvent.keyDown(gstTab, { key: 'ArrowRight' });

    expect(screen.getByRole('tab', { name: /Science/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(
      screen.getByRole('heading', { level: 3, name: 'Science' }),
    ).toBeInTheDocument();

    // Press ArrowLeft to return to GST
    const scienceTab = screen.getByRole('tab', { name: /Science/i });
    fireEvent.keyDown(scienceTab, { key: 'ArrowLeft' });

    expect(screen.getByRole('tab', { name: /GST/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(
      screen.getByRole('heading', { level: 3, name: 'GST' }),
    ).toBeInTheDocument();
  });

  it('automatically advances subject when uninterrupted, and pauses when user interacts', () => {
    const mockTopics: Topic[] = [];

    render(
      <BrowserRouter>
        <OngoingTopics catalogueTopics={mockTopics} />
      </BrowserRouter>,
    );

    // Initial subject is GST
    expect(
      screen.getByRole('heading', { level: 3, name: 'GST' }),
    ).toBeInTheDocument();

    // Advance timer by intervalMs
    act(() => {
      vi.advanceTimersByTime(DECK_TIMING.intervalMs);
    });

    // Subject advances to Science
    expect(
      screen.getByRole('heading', { level: 3, name: 'Science' }),
    ).toBeInTheDocument();

    // User explicitly selects Economics
    const economicsTab = screen.getByRole('tab', { name: /Economics/i });
    fireEvent.click(economicsTab);

    expect(
      screen.getByRole('heading', { level: 3, name: 'Economics' }),
    ).toBeInTheDocument();

    // Advancing time should NOT change the subject because explicit interaction paused auto-rotation
    act(() => {
      vi.advanceTimersByTime(DECK_TIMING.intervalMs * 3);
    });

    expect(
      screen.getByRole('heading', { level: 3, name: 'Economics' }),
    ).toBeInTheDocument();
  });

  it('cleans up timers when component unmounts', () => {
    const mockTopics: Topic[] = [];

    const { unmount } = render(
      <BrowserRouter>
        <OngoingTopics catalogueTopics={mockTopics} />
      </BrowserRouter>,
    );

    unmount();

    // Advancing timers after unmount should execute cleanly without error
    act(() => {
      vi.advanceTimersByTime(10000);
    });
  });

  it('keeps subject stable when prefers-reduced-motion is requested', () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation(query => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const mockTopics: Topic[] = [];

    render(
      <BrowserRouter>
        <OngoingTopics catalogueTopics={mockTopics} />
      </BrowserRouter>,
    );

    // Initial stable subject is GST
    expect(
      screen.getByRole('heading', { level: 3, name: 'GST' }),
    ).toBeInTheDocument();

    // Advancing time should NOT cycle when reduced motion is enabled
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    // Still GST
    expect(
      screen.getByRole('heading', { level: 3, name: 'GST' }),
    ).toBeInTheDocument();

    window.matchMedia = originalMatchMedia;
  });
});
