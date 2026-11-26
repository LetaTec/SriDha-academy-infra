import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import {
  readActivePaper,
  saveActivePaper,
  showPaperOnScreen,
} from '@hooks/useActivePaper';

import { ContinuePaper } from './ContinuePaper';

const MINUTE_MS = 60 * 1000;

const startPaper = (endsAt: number) =>
  saveActivePaper({
    key: 'topic:topic_accounts_gst_class_11',
    title: 'GST · Class 11',
    href: '/topic-tests/topic_accounts_gst_class_11',
    endsAt,
    answers: {},
  });

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ContinuePaper />
    </MemoryRouter>,
  );

describe('ContinuePaper', () => {
  it('shows nothing when no paper is in progress', () => {
    renderAt('/topics');
    expect(screen.queryByText('Continue your paper')).not.toBeInTheDocument();
  });

  it('offers the paper in progress, with its clock, on any other page', () => {
    startPaper(Date.now() + 90 * MINUTE_MS);
    renderAt('/topics');

    expect(screen.getByText('Continue your paper')).toBeInTheDocument();
    expect(screen.getByText('GST · Class 11')).toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveTextContent(
      /Time left\s*1:(30:00|29:5\d)/,
    );
    expect(screen.getByRole('link', { name: /Continue/ })).toHaveAttribute(
      'href',
      '/topic-tests/topic_accounts_gst_class_11',
    );
  });

  it('stays hidden while the paper itself is on screen', () => {
    startPaper(Date.now() + 90 * MINUTE_MS);
    const hide = showPaperOnScreen('topic:topic_accounts_gst_class_11');
    renderAt('/topic-tests/topic_accounts_gst_class_11');
    expect(screen.queryByText('Continue your paper')).not.toBeInTheDocument();
    act(hide);
    expect(screen.getByText('Continue your paper')).toBeInTheDocument();
  });

  it('leads to the score once the time is up', () => {
    startPaper(Date.now() - 1000);
    renderAt('/');
    expect(screen.getByRole('timer')).toHaveTextContent("Time's up");
    expect(
      screen.getByRole('link', { name: /See your score/ }),
    ).toBeInTheDocument();
  });

  it('closes, putting the paper away', () => {
    startPaper(Date.now() - 1000);
    renderAt('/');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByText('Continue your paper')).not.toBeInTheDocument();
    expect(readActivePaper()).toBeNull();
  });
});
