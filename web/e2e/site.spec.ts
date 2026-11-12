import { expect, test, type Page } from '@playwright/test';

const SCREENSHOT_DIR = 'test-results/screenshots';
// The next GST batch still open; the November one started on 1 November
const OPEN_BATCH = 'batch_gst_class_11_december';
const GST_TOPIC = 'topic_accounts_gst_class_11';
const PASSWORD = 'correct-horse-1';

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

const registerViaApi = async (page: Page, email: string) => {
  const response = await page.request.post('/api/auth/register', {
    data: {
      fullName: 'Asha Verma',
      email,
      password: PASSWORD,
      dateOfBirth: '2009-04-12',
      mobile: '9876543210',
      standard: 'CLASS_11',
      stream: 'COMMERCE',
      address: null,
    },
  });
  expect(response.status()).toBe(201);
};

// Registers through the API, which also signs this browser context in.
const signedIn = async (page: Page, label: string) => {
  await registerViaApi(page, uniqueEmail(label));
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
    // No account links in the header until there is an account
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

  test('paying asks for an account on the checkout page', async ({
    page,
  }, testInfo) => {
    await page.goto(`/?topic=${GST_TOPIC}&batch=${OPEN_BATCH}`);
    const review = page.getByRole('dialog', {
      name: /review your\s*selection/i,
    });
    await review.getByRole('button', { name: 'Continue to payment' }).click();

    await expect(page).toHaveURL(/\/checkout\?topic=/);
    await expect(
      page.getByRole('heading', { name: 'Sign in to continue' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /^Pay / })).toHaveCount(0);

    // A new student registers without leaving the page
    await page.getByRole('button', { name: 'Create an account' }).click();
    await page.getByLabel('Student name').fill('Asha Verma');
    await page.getByLabel('Date of birth').fill('2009-04-12');
    await page.getByLabel('Mobile number').fill('+91 98765 43210');
    await page.getByLabel('Email ID').fill(uniqueEmail(testInfo.project.name));
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByLabel('Standard / Exam').selectOption('CLASS_11');
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/${testInfo.project.name}-checkout-register.png`,
      fullPage: true,
    });
    await page.getByRole('button', { name: /create account/i }).click();

    // Signed in: the same page and batch, ready to pay
    await expect(page.getByLabel('Full name')).toHaveValue('Asha Verma');
    await expect(
      page.getByRole('radio', { name: /December batch/ }),
    ).toBeChecked();
    await expect(page.getByRole('button', { name: 'Pay ₹129' })).toBeVisible();
  });

  test('My learning asks a signed-out visitor to sign in on the page', async ({
    page,
    request,
  }, testInfo) => {
    const email = uniqueEmail(`${testInfo.project.name}-learning`);
    const register = await request.post('/api/auth/register', {
      data: {
        fullName: 'Ravi Shah',
        email,
        password: PASSWORD,
        dateOfBirth: '2008-01-20',
        mobile: '9876543210',
        standard: 'CLASS_12',
        stream: 'COMMERCE',
        address: null,
      },
    });
    expect(register.status()).toBe(201);

    await page.goto('/my-learning');
    await page.getByLabel('Email ID').fill(email);
    await page.getByLabel('Password', { exact: true }).fill('wrong-password');
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await expect(
      page.getByText('The email or password is incorrect'),
    ).toBeVisible();

    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await expect(page).toHaveURL(/\/my-learning$/);
    await expect(page.getByText('Signed in as Ravi Shah')).toBeVisible();
  });

  test('old sign-in links open the homepage', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole('heading', { level: 1, name: /search your\s*topic/i }),
    ).toBeVisible();
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
  }, testInfo) => {
    await signedIn(page, `${testInfo.project.name}-book`);
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
    await signedIn(page, `${testInfo.project.name}-spread`);
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
  test('reserve a seat, restore the session and log out', async ({
    page,
  }, testInfo) => {
    await signedIn(page, `${testInfo.project.name}-journey`);
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
    await page.getByLabel('Mobile number').fill('+91 98765 43210');
    await page.getByRole('checkbox', { name: /I agree to the/ }).check();
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/${testInfo.project.name}-checkout.png`,
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Pay ₹129' }).click();

    // No Razorpay keys in the test API: the seat is held as payment pending
    await expect(page.getByText('Seat saved')).toBeVisible();
    await page.getByRole('link', { name: 'Go to My learning' }).click();

    await page.goto('/my-learning');
    await expect(page).toHaveURL(/\/my-learning$/);
    await expect(page.getByText('Signed in as Asha Verma')).toBeVisible();

    // Session restoration after a full page reload.
    await page.reload();
    await expect(page.getByText('Signed in as Asha Verma')).toBeVisible();

    if (testInfo.project.name === 'mobile') {
      await page.getByRole('button', { name: 'Open menu' }).click();
    }
    await page.getByRole('button', { name: 'Log out' }).first().click();
    await expect(page).toHaveURL(/\/$/);

    const response = await page.request.get('/api/enrolments');
    expect(response.status()).toBe(401);

    // Signed out, the site stays open
    await page.goto('/');
    await expect(
      page.getByRole('heading', { level: 1, name: /search your\s*topic/i }),
    ).toBeVisible();
  });

  test('model paper waitlist sign-ups are stored', async ({
    page,
  }, testInfo) => {
    await signedIn(page, `${testInfo.project.name}-waitlist`);
    await page.goto('/#model-paper');
    await expect(
      page.getByRole('heading', { level: 3, name: 'AI Model Paper' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Join waitlist' }).first().click();
    const dialog = page.getByRole('dialog', { name: /prepare\s*ahead/i });
    await dialog.getByLabel('Exam').selectOption('NEET');
    await dialog.getByRole('button', { name: /join waitlist/i }).click();
    await expect(
      page.getByText('You have been added to the model paper waitlist'),
    ).toBeVisible();
  });
});
