import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { CHECKOUT_TEXT, TEST_CHECKOUT_TEXT } from '@constants/payments';
import { toTopicPreviews } from '@services/catalogue';
import { catalogueFixture, openBatch } from '@/test/catalogueFixture';

import { CheckoutTopicCard } from './CheckoutTopicCard';

const preview = toTopicPreviews(catalogueFixture).find(
  item => item.catalogueTopicId === 'topic_accounts_gst_class_11',
);

if (!preview) {
  throw new Error('Expected the GST topic preview in the catalogue fixture');
}

describe('CheckoutTopicCard', () => {
  afterEach(cleanup);

  it('omits selected-batch details from the checkout card', () => {
    render(
      <CheckoutTopicCard preview={preview} batch={openBatch} isEnrolment />,
    );

    expect(screen.getByText(preview.title)).toBeInTheDocument();
    expect(screen.queryByText(openBatch.name)).not.toBeInTheDocument();
    expect(
      screen.queryByText(CHECKOUT_TEXT.startsLabel),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(openBatch.scheduleLabel)).not.toBeInTheDocument();
  });

  it('keeps the first-batch notice when no batch is selected', () => {
    render(
      <CheckoutTopicCard preview={preview} batch={null} isEnrolment={false} />,
    );

    expect(screen.getByText(CHECKOUT_TEXT.firstBatchLabel)).toBeInTheDocument();
    expect(screen.getByText(CHECKOUT_TEXT.firstBatchValue)).toBeInTheDocument();
  });

  it('keeps test details visible', () => {
    render(
      <CheckoutTopicCard
        preview={preview}
        batch={null}
        isEnrolment={false}
        test={{ questionCount: 20, minutes: 45 }}
      />,
    );

    expect(
      screen.getByText(TEST_CHECKOUT_TEXT.questionsLabel),
    ).toBeInTheDocument();
    expect(
      screen.getByText(TEST_CHECKOUT_TEXT.minutes(45)),
    ).toBeInTheDocument();
    expect(
      screen.getByText(TEST_CHECKOUT_TEXT.attemptsLabel),
    ).toBeInTheDocument();
  });
});
