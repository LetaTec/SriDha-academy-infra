import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { LearningJourneySection } from './LearningJourneySection';

describe('LearningJourneySection', () => {
  it('shows four steps, each linking to the part of the site that does it', () => {
    render(
      <MemoryRouter>
        <LearningJourneySection />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { level: 2, name: /How it works/ }),
    ).toBeInTheDocument();
    expect(
      screen
        .getAllByRole('heading', { level: 3 })
        .map(item => item.textContent),
    ).toEqual([
      'Pick a topic',
      'Join the live classes',
      'Practise test papers',
      'Take the topic test',
    ]);
    expect(
      screen
        .getAllByRole('link')
        .map(link => [link.textContent, link.getAttribute('href')]),
    ).toEqual([
      ['Browse topics', '/topics'],
      ['See open batches', '/#topics'],
      ['Test Paper', '/ai-test'],
      ['Topic Test Paper', '/topic-tests'],
    ]);
    // Only what students can use today
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(
      screen.queryByText(/model paper|percentile/i),
    ).not.toBeInTheDocument();
  });
});
