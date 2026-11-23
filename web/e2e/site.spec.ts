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
    // Browsing needs no account, so there is no account page to visit
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

    // The assessment section comes straight after the search
    const sectionIds = await page.evaluate(() =>
      [...document.querySelectorAll('section[id]')].map(section => section.id),
    );
    expect(sectionIds.slice(0, 2)).toEqual(['home', 'ai-test']);

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
    // Who teaches it, before paying
    await expect(
      page.getByRole('region', { name: /^Your tutor, / }),
    ).toBeVisible();
    // Nothing asks for a password or an account
    await expect(page.getByLabel('Password')).toHaveCount(0);
    await page.getByLabel('Full name').fill('Asha Verma');
    await page
      .getByLabel('Email ID')
      .fill(uniqueEmail(`${testInfo.project.name}-journey`));
    await page.getByLabel('Mobile number').fill('+91 98765 43210');
    await page.getByLabel('State', { exact: true }).selectOption('Rajasthan');
    await page.getByLabel('City', { exact: true }).fill('Jaipur');
    // Checkout records the billing address; the PIN code must be 6 digits
    await page.getByLabel('Billing address').fill('12 Civil Lines');
    await page.getByLabel('PIN code').fill('302006');
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

  test('checkout still refuses an invalid PIN code and a missing address', async ({
    page,
  }, testInfo) => {
    await page.goto('/#topics');
    await page
      .getByRole('button', { name: 'Enrol now: GST, Class 11' })
      .click();
    await expect(page).toHaveURL(/\/checkout\?topic=/);
    await page.getByLabel('Full name').fill('Asha Verma');
    await page
      .getByLabel('Email ID')
      .fill(uniqueEmail(`${testInfo.project.name}-badpin`));
    await page.getByLabel('Mobile number').fill('+91 98765 43210');
    await page.getByLabel('State', { exact: true }).selectOption('Rajasthan');
    await page.getByLabel('City', { exact: true }).fill('Jaipur');
    await page.getByLabel('PIN code').fill('12345');
    await page.getByRole('checkbox', { name: /I agree to the/ }).check();
    await page.getByRole('button', { name: 'Pay ₹129' }).click();

    await expect(
      page.getByText('Enter a valid 6-digit PIN code'),
    ).toBeVisible();
    await expect(page.getByText('Seat saved')).toHaveCount(0);
  });

  test('the About page introduces the tutors', async ({ page }, testInfo) => {
    await page.goto('/about#tutors');
    const tutors = page.locator('#tutors');
    await expect(tutors.getByText('Accounts tutor')).toBeVisible();
    await expect(tutors.getByText(/coming soon/i)).toHaveCount(0);
    await tutors.scrollIntoViewIfNeeded();
    await page.waitForTimeout(900);
    await tutors.screenshot({
      path: `${SCREENSHOT_DIR}/${testInfo.project.name}-about-tutors.png`,
    });
  });
});

test.describe('student account', () => {
  test('a visitor signs up on their first answer, then signs out and back in', async ({
    page,
  }, testInfo) => {
    const email = uniqueEmail(`${testInfo.project.name}-account`);
    const password = 'correct-horse-1';
    await page.goto('/ai-test');

    // A visitor sees the paper locked, with sign-up in the middle
    const paper = page.getByRole('region', { name: 'Sample test paper' });
    const lock = paper.getByRole('region', {
      name: 'Sign in to start this paper',
    });
    await expect(lock).toBeVisible();
    await expect(
      lock.getByRole('heading', {
        name: 'Sign up or log in to start the test',
      }),
    ).toBeVisible();
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/${testInfo.project.name}-paper-locked.png`,
    });

    await lock.getByRole('button', { name: 'Sign up' }).click();
    const signUp = page.getByRole('dialog', { name: /Create your/ });
    await signUp.getByLabel('Full name').fill('Meera Iyer');
    await signUp.getByLabel('Email ID').fill(email);
    await signUp.getByLabel('Create a password').fill(password);
    await signUp.getByRole('button', { name: 'Create account' }).click();

    // Signed in: the lock lifts and the paper can be answered
    await expect(signUp).toBeHidden();
    await expect(lock).toBeHidden();
    const firstQuestion = paper.getByRole('radiogroup').first();
    await firstQuestion.locator('label').first().click();
    await expect(paper.getByText('Answered 1 of 20')).toBeVisible();
    await expect(firstQuestion.getByRole('radio').first()).toBeChecked();

    // The profile button shows who is signed in
    const header = page.getByRole('banner');
    await header.getByRole('button', { name: 'Your account' }).click();
    await expect(header.getByText('Meera Iyer')).toBeVisible();
    await expect(header.getByText(email)).toBeVisible();

    // Still signed in after a reload
    await page.reload();
    await expect(
      header.getByRole('button', { name: 'Your account' }),
    ).toBeVisible();

    await header.getByRole('button', { name: 'Your account' }).click();
    await header.getByRole('button', { name: 'Sign out' }).click();
    await expect(
      header.getByRole('button', { name: 'Sign in or create an account' }),
    ).toBeVisible();

    // Back again: sign in with the password, no code to type
    await header
      .getByRole('button', { name: 'Sign in or create an account' })
      .click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Sign in' }).click();
    await dialog.getByLabel('Email ID').fill(email);
    await dialog.getByLabel('Password', { exact: true }).fill(password);
    await dialog.getByRole('button', { name: 'Sign in' }).click();
    await expect(dialog).toBeHidden();
    await expect(
      header.getByRole('button', { name: 'Your account' }),
    ).toBeVisible();

    // Change the password from the profile menu
    const newPassword = 'new-password-2';
    await header.getByRole('button', { name: 'Your account' }).click();
    await header.getByRole('button', { name: 'Change password' }).click();
    const change = page.getByRole('dialog', { name: /Change your/ });
    await change.getByLabel('Current password').fill(password);
    await change.getByLabel('New password').fill(newPassword);
    await change.getByRole('button', { name: 'Save new password' }).click();
    await expect(change).toBeHidden();
    await expect(page.getByText('Password changed')).toBeVisible();

    // The new password works; this device stayed signed in
    await header.getByRole('button', { name: 'Your account' }).click();
    await header.getByRole('button', { name: 'Sign out' }).click();
    await header
      .getByRole('button', { name: 'Sign in or create an account' })
      .click();
    await dialog.getByRole('button', { name: 'Sign in' }).click();
    await dialog.getByLabel('Email ID').fill(email);
    await dialog.getByLabel('Password', { exact: true }).fill(newPassword);
    await dialog.getByRole('button', { name: 'Sign in' }).click();
    await expect(dialog).toBeHidden();
  });
});
