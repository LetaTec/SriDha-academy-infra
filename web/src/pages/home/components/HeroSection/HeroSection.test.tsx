import { fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { HERO_TEXT } from '@constants/home';

import { HeroSection } from './HeroSection';

describe('HeroSection Two-Column Balanced Hero', () => {
  it('renders the approved hero headline, supporting text, and actions', () => {
    render(
      <BrowserRouter>
        <HeroSection />
      </BrowserRouter>,
    );

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent(/A subject isn't learned in a day/i);
    expect(heading).toHaveTextContent(/It's mastered one concept at a time/i);

    expect(
      screen.getByText(
        /Learn topic by topic, practise what you've learned, and build confidence one concept at a time/i,
      ),
    ).toBeInTheDocument();

    const exploreLink = screen.getByRole('link', {
      name: new RegExp(HERO_TEXT.primaryAction, 'i'),
    });
    expect(exploreLink).toBeInTheDocument();
    expect(exploreLink).toHaveAttribute('href', '#topics');

    const registerLink = screen.getByRole('link', {
      name: new RegExp(HERO_TEXT.secondaryAction, 'i'),
    });
    expect(registerLink).toBeInTheDocument();
    expect(registerLink).toHaveAttribute('href', '/register');
  });

  it('renders the interactive concept map with Partnership Accounts by default', () => {
    render(
      <BrowserRouter>
        <HeroSection />
      </BrowserRouter>,
    );

    // Initial subject is Partnership Accounts
    expect(
      screen.getByRole('tab', { name: /Partnership Accounts/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: /Partnership Fundamentals/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: /Admission of a Partner/i }),
    ).toBeInTheDocument();

    // Default details panel shows Fundamentals
    expect(
      screen.getByRole('heading', {
        level: 3,
        name: /Partnership Fundamentals/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Core provisions of the Indian Partnership Act/i),
    ).toBeInTheDocument();
  });

  it('updates the concept details panel when another concept node is selected', () => {
    render(
      <BrowserRouter>
        <HeroSection />
      </BrowserRouter>,
    );

    const admissionNode = screen.getByRole('tab', {
      name: /Admission of a Partner/i,
    });
    fireEvent.click(admissionNode);

    expect(
      screen.getByRole('heading', {
        level: 3,
        name: /Admission of a Partner/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Accounting for new partner capital/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Premium for goodwill allocation/i),
    ).toBeInTheDocument();
  });

  it('switches to Goods & Services Tax (GST) and invokes onOpenTopic for live catalogue topics', () => {
    const handleOpenTopic = vi.fn();

    render(
      <BrowserRouter>
        <HeroSection onOpenTopic={handleOpenTopic} />
      </BrowserRouter>,
    );

    const gstTab = screen.getByRole('tab', {
      name: /Goods & Services Tax \(GST\)/i,
    });
    fireEvent.click(gstTab);

    // GST nodes appear
    expect(
      screen.getByRole('tab', { name: /What is GST/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: /What is GST/i }),
    ).toBeInTheDocument();

    // Live batch button triggers handleOpenTopic
    const batchButton = screen.getByRole('button', {
      name: /View Batches & Enroll/i,
    });
    fireEvent.click(batchButton);

    expect(handleOpenTopic).toHaveBeenCalledWith('topic_accounts_gst_class_11');
  });
});
