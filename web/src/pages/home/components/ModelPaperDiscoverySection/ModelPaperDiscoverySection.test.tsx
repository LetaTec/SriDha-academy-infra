import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ModelPaperDiscoverySection } from './ModelPaperDiscoverySection';

describe('ModelPaperDiscoverySection', () => {
  it('renders both past papers and sample papers distinctly', () => {
    render(<ModelPaperDiscoverySection onJoinWaitlist={vi.fn()} />);

    expect(
      screen.getByRole('heading', { level: 2, name: /Past board papers/i }),
    ).toBeInTheDocument();

    // Column 1: Verified PYQs
    expect(
      screen.getByRole('heading', {
        level: 3,
        name: /Past 5 Years' Board Questions/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Authentic Archives/i)).toBeInTheDocument();
    const pyqLink = screen.getByRole('link', {
      name: /Explore Topics with PYQs/i,
    });
    expect(pyqLink).toHaveAttribute('href', '#topics');

    // Column 2: Sample papers
    expect(
      screen.getByRole('heading', {
        level: 3,
        name: /Reviewed Sample Papers/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/In Development · Waitlist Open/i),
    ).toBeInTheDocument();
  });

  it('triggers onJoinWaitlist when clicking Join Sample Paper Waitlist', () => {
    const handleJoinWaitlist = vi.fn();

    render(<ModelPaperDiscoverySection onJoinWaitlist={handleJoinWaitlist} />);

    const waitlistButton = screen.getByRole('button', {
      name: /Join Sample Paper Waitlist/i,
    });
    fireEvent.click(waitlistButton);

    expect(handleJoinWaitlist).toHaveBeenCalledTimes(1);
  });
});
