import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FeatureSection } from './FeatureSection';

describe('FeatureSection', () => {
  it('renders section introduction with exact approved copy', () => {
    render(<FeatureSection />);

    expect(screen.getByText('In three chapters')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'How SriDha Academy works.',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Every big subject becomes easier when you take it one step at a time. Here’s how we help you move from understanding a concept to feeling confident about it.',
      ),
    ).toBeInTheDocument();
  });

  it('renders Chapter 01 with exact approved copy', () => {
    render(<FeatureSection />);

    expect(screen.getByText('Chapter 01')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: 'Learn at your pace' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Understand it. Don’t just memorise it.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Some topics take a little longer to click. That’s perfectly fine. Our topic-wise live classes break difficult concepts into smaller, clearer lessons, so you can ask questions, clear your doubts, and learn at a pace that works for you.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'One topic at a time. One step closer to understanding.',
      ),
    ).toBeInTheDocument();
  });

  it('renders Chapter 02 with exact approved copy', () => {
    render(<FeatureSection />);

    expect(screen.getByText('Chapter 02')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        level: 3,
        name: 'Put your learning to the test',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Because understanding feels better when you can prove it.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Once you’ve learnt a topic, it’s time to see how well it has stayed with you. Practise with topic-wise questions, check your answers, and discover where you need a little more practice.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Learn it. Try it. Understand it better.'),
    ).toBeInTheDocument();
  });

  it('renders Chapter 03 with exact approved copy', () => {
    render(<FeatureSection />);

    expect(screen.getByText('Chapter 03')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        level: 3,
        name: 'Walk into your exam prepared',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Practise today. Face tomorrow with confidence.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Get familiar with the way questions appear in exams through previous-year question papers and carefully reviewed sample papers. Learn to recognise question patterns, manage your time, and approach your preparation with greater clarity.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Preparation isn’t about knowing everything at once. It’s about knowing what to do next.',
      ),
    ).toBeInTheDocument();
  });
});
