import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LearningJourneySection } from './LearningJourneySection';

describe('LearningJourneySection Interactive Learning Process', () => {
  it('renders the section head and the continuous cycle sequence', () => {
    render(<LearningJourneySection />);

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: /How true mastery happens/i,
      }),
    ).toBeInTheDocument();

    // Continuous cycle indicators
    expect(
      screen.getByText('Understand', { selector: '.cyclePhase' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Learn', { selector: '.cyclePhase' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Practise', { selector: '.cyclePhase' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Assess', { selector: '.cyclePhase' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Review', { selector: '.cyclePhase' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Improve', { selector: '.cyclePhase' }),
    ).toBeInTheDocument();
  });

  it('renders all 6 stage navigator tabs with Stage 1 active by default', () => {
    render(<LearningJourneySection />);

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(6);

    const firstTab = screen.getByRole('tab', {
      name: /1\. Understand concept/i,
    });
    expect(firstTab).toHaveAttribute('aria-selected', 'true');

    expect(
      screen.getByRole('heading', {
        level: 3,
        name: /Deconstruct the core theory/i,
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /Sacrificing Ratio = Old Profit Share − New Profit Share/i,
      ),
    ).toBeInTheDocument();
  });

  it('updates the demonstration panel when selecting Stage 4 (Assessment)', () => {
    render(<LearningJourneySection />);

    const assessTab = screen.getByRole('tab', {
      name: /4\. Topic assessment/i,
    });
    fireEvent.click(assessTab);

    expect(assessTab).toHaveAttribute('aria-selected', 'true');

    expect(
      screen.getByRole('heading', {
        level: 3,
        name: /Take a topic-wise assessment/i,
      }),
    ).toBeInTheDocument();

    expect(screen.getByText(/In-House AI Test Engine/i)).toBeInTheDocument();

    const assessLink = screen.getByRole('link', {
      name: /Try Live Sample Assessment/i,
    });
    expect(assessLink).toHaveAttribute('href', '#ai-test');
  });

  it('updates the demonstration panel when selecting Stage 5 (Past & Model Papers)', () => {
    render(<LearningJourneySection />);

    const reviewTab = screen.getByRole('tab', {
      name: /5\. Past & model papers/i,
    });
    fireEvent.click(reviewTab);

    expect(reviewTab).toHaveAttribute('aria-selected', 'true');

    expect(
      screen.getByRole('heading', {
        level: 3,
        name: /Practise with verified papers & model papers/i,
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Authentic Archives vs Predictive Papers/i),
    ).toBeInTheDocument();
  });
});
