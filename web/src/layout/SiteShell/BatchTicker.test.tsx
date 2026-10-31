import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { openBatch, catalogueFixture } from '@/test/catalogueFixture';
import type { Subject } from '@services/catalogue';

import { BatchTicker } from './BatchTicker';

const openCheckout = vi.fn();
let subjects: Subject[] = catalogueFixture;

vi.mock('@hooks/useCatalogue', () => ({
  useCatalogue: () => ({ subjects, status: 'ready' }),
}));
vi.mock('@hooks/useCheckout', () => ({
  useCheckout: () => ({ openCheckout }),
}));

describe('BatchTicker', () => {
  beforeEach(() => {
    openCheckout.mockClear();
    subjects = catalogueFixture;
  });

  it('shows each open batch with its class, start and real seat count', () => {
    render(<BatchTicker />);

    const region = screen.getByRole('region', {
      name: /batches open for enrolment/i,
    });
    const entry = within(region).getByRole('button', {
      name: /enrol in .*, november batch/i,
    });

    expect(entry).toHaveTextContent('Class 11');
    expect(entry).toHaveTextContent('November batch');
    expect(entry).toHaveTextContent('Starts');
    expect(entry).toHaveTextContent('100 seats available');
    expect(entry).toHaveTextContent('Enrol');
  });

  it('lists only open batches, never full ones', () => {
    render(<BatchTicker />);

    expect(screen.queryByText(/december batch/i)).not.toBeInTheDocument();
  });

  it('hides the repeated copy from screen readers and the keyboard', () => {
    const { container } = render(<BatchTicker />);

    const lists = container.querySelectorAll('ul');
    expect(lists).toHaveLength(2);
    expect(lists[0]).not.toHaveAttribute('aria-hidden');
    expect(lists[1]).toHaveAttribute('aria-hidden', 'true');
    expect(lists[1]).toHaveAttribute('inert');
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('opens checkout for the chosen batch', () => {
    render(<BatchTicker />);

    fireEvent.click(screen.getByRole('button', { name: /enrol in/i }));

    expect(openCheckout).toHaveBeenCalledWith(
      'topic_accounts_gst_class_11',
      openBatch.id,
    );
  });

  it('never invents a seat count when the catalogue does not give one', () => {
    subjects = catalogueFixture.map(subject => ({
      ...subject,
      chapters: subject.chapters.map(chapter => ({
        ...chapter,
        topics: chapter.topics.map(topic => ({
          ...topic,
          batches: topic.batches.map(batch => ({
            ...batch,
            seatsRemaining: null,
          })),
        })),
      })),
    }));

    render(<BatchTicker />);

    expect(screen.queryByText(/seats? available/i)).not.toBeInTheDocument();
  });

  it('shows a quiet message when no batch is open', () => {
    subjects = [];

    render(<BatchTicker />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText(/new batches open every month/i)).toBeVisible();
  });
});
