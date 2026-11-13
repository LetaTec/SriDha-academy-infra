import { expect, test, type Page } from '@playwright/test';

const SCREENSHOT_DIR = 'test-results/screenshots';
// The next GST batch still open; the November one started on 1 November
const OPEN_BATCH = 'batch_gst_class_11_december';
const GST_TOPIC = 'topic_accounts_gst_class_11';

const uniqueEmail = (label: string) =>
  `${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

const book = (page: Page) => page.locator('[aria-roledescription="book"]');

const bookBox = async (page: Page) => {
  const box = await book(page).boundingBox();
  expect(box).not.toBeNull();
  const scrollY = await page.evaluate(() => window.scrollY);
  // Document coordinates rounded to 0.1px, so ordinary scrolling and
  // sub-pixel measurement noise do not count as movement.
  const round = (value: number) => Math.round(value * 10) / 10;
  return {
    x: round(box!.x),
    y: round(box!.y + scrollY),
    width: round(box!.width),
    height: round(box!.height),
  };
};

test.describe('open site', () => {
  test('visitors land on the topic search without an account', async ({
    page,
  }, testInfo) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole('heading', { level: 1, name: /search your\s*topic/i }),
    ).toBeVisible();
    // Students have no accounts, so the header has no account links
    await expect(
      page.getByRole('banner').getByRole('link', { name: 'My learning' }),
    ).toHaveCount(0);

    const search = page.getByRole('searchbox', { name: 'Search your topic' });
    await search.fill('gst');
    const results = page
      .locator('#home')
      .getByRole('region', { name: 'Matching topics and batches' });
    await expect(
      results.getByRole('button', { name: /^GST.*₹129/ }),
    ).toBeVisible();
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/${testInfo.project.name}-search.png`,
    });

    await search.press('Enter');
    await expect(page).toHaveURL(new RegExp(`/checkout\\?topic=${GST_TOPIC}`));
    await expect(
      page.getByRole('heading', { level: 1, name: /review your\s*seat/i }),
    ).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('old account links open the homepage', async ({ page }) => {
    for (const path of ['/login', '/my-learning']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/$/);
      await expect(
        page.getByRole('heading', { level: 1, name: /search your\s*topic/i }),
      ).toBeVisible();
    }
  });
});

test.describe('homepage', () => {
  test('renders every section without horizontal scrolling', async ({
    page,
  }, testInfo) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { level: 1, name: /search your\s*topic/i }),
    ).toBeVisible();
    // The topic search is on the page itself; the header has none
    await expect(
      page.getByRole('searchbox', { name: 'Search your topic' }),
    ).toBeVisible();
    await expect(page.getByRole('banner').getByRole('searchbox')).toHaveCount(
      0,
    );

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/${testInfo.project.name}-hero.png`,
    });

    // Reveal every section before the full-page capture.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 400) {
        window.scrollTo({ top: y, behavior: 'instant' });
        await new Promise(resolve => setTimeout(resolve, 60));
      }
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
    await page.waitForTimeout(900);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/${testInfo.project.name}-home-full.png`,
      fullPage: true,
    });
  });
});

test.describe('interactive book', () => {
  test('stays anchored under pointer movement, scrolling and rapid page turns', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(book(page)).toBeVisible();
    await expect(page.getByText(/spread 1 of/i)).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const initial = await bookBox(page);

    for (const [x, y] of [
      [10, 10],
      [700, 400],
      [1200, 800],
      [300, 650],
    ]) {
      await page.mouse.move(x, y, { steps: 5 });
    }
    await book(page).hover();
    expect(await bookBox(page)).toEqual(initial);

    await page.mouse.wheel(0, 500);
    await page.mouse.wheel(0, -500);
    await page.waitForTimeout(300);
    expect(await bookBox(page)).toEqual(initial);

    const next = page.getByRole('button', { name: 'Turn to the next page' });
    await next.click();
    await next.click({ force: true });
    await next.click({ force: true });
    // Only the first click is accepted while a page is turning.
    await expect(page.getByText(/spread 2 of/i)).toBeVisible();
    await page.waitForTimeout(1400);
    await expect(page.getByText(/spread 2 of/i)).toBeVisible();
    expect(await bookBox(page)).toEqual(initial);

    await page.getByRole('button', { name: 'Turn back one page' }).click();
    await expect(page.getByText(/spread 1 of/i)).toBeVisible();
    await page.waitForTimeout(1400);
    expect(await bookBox(page)).toEqual(initial);

    await page.keyboard.press('ArrowRight');
    await expect(page.getByText(/spread 2 of/i)).toBeVisible();
  });

  test('selects a batch from the book and explores more batches', async ({
    page,
  }, testInfo) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Turn to the next page' }).click();
    const selectInBook = book(page).getByRole('button', {
      name: /select batch: learn gst for class 11, 8th & 9th december/i,
    });
    await expect(selectInBook).toBeVisible();
    await page.waitForTimeout(1300);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/${testInfo.project.name}-book-batch-spread.png`,
    });

    await selectInBook.click();
    const review = page.getByRole('dialog', {
      name: /review your\s*selection/i,
    });
    await expect(review).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`batch=${OPEN_BATCH}`));
    await review.getByRole('button', { name: 'Close' }).click();

    await book(page)
      .getByRole('link', { name: /explore more batches/i })
      .click();
    await expect(page).toHaveURL(/\/batches$/);
    await expect(page.getByText('8th & 9th December')).toBeVisible();
  });
});

test.describe('student journey', () => {
  test('reserve a seat with just the payment details, no account', async ({
    page,
  }, testInfo) => {
    await page.goto('/#topics');
    const enrol = page.getByRole('button', {
      name: 'Enrol now: GST, Class 11',
    });
    await expect(enrol).toBeEnabled();
    await enrol.click();

    // Enrol now opens the checkout page
    await expect(page).toHaveURL(/\/checkout\?topic=/);
    await expect(
      page.getByRole('heading', { level: 1, name: /review your\s*seat/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('radio', { name: /December batch/ }),
    ).toBeChecked();
    await expect(page.getByText('What is GST')).toBeVisible();
    // Nothing asks for a password or an account
    await expect(page.getByLabel('Password')).toHaveCount(0);
    await page.getByLabel('Full name').fill('Asha Verma');
    await page
      .getByLabel('Email ID')
      .fill(uniqueEmail(`${testInfo.project.name}-journey`));
    await page.getByLabel('Mobile number').fill('+91 98765 43210');
    await page.getByLabel('State', { exact: true }).selectOption('Rajasthan');
    await page.getByLabel('City', { exact: true }).fill('Jaipur');
    await page.getByRole('checkbox', { name: /I agree to the/ }).check();
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/${testInfo.project.name}-checkout.png`,
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Pay ₹129' }).click();

    // No Razorpay keys in the test API: the seat is held as payment pending
    await expect(page.getByText('Seat saved')).toBeVisible();
    await page.getByRole('link', { name: 'Browse topics' }).click();
    await expect(page).toHaveURL(/\/topics$/);
  });

  test('model paper waitlist sign-ups are stored', async ({ page }) => {
    await page.goto('/#model-paper');
    await expect(
      page.getByRole('heading', { level: 3, name: 'AI Model Paper' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Join waitlist' }).first().click();
    const dialog = page.getByRole('dialog', { name: /prepare\s*ahead/i });
    await dialog.getByLabel(/email/i).fill(uniqueEmail('waitlist'));
    await dialog.getByLabel('Exam').selectOption('NEET');
    await dialog.getByRole('button', { name: /join waitlist/i }).click();
    await expect(
      page.getByText('You have been added to the model paper waitlist'),
    ).toBeVisible();
  });
});
