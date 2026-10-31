import { expect, test, type Page } from '@playwright/test';

const SCREENSHOT_DIR = 'test-results/screenshots';
const NOVEMBER_BATCH = 'batch_gst_class_11_november';
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

test.describe('sign-in gate', () => {
  test('visitors only see the sign-in page until they register', async ({
    page,
  }, testInfo) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole('heading', { name: 'Welcome back' }),
    ).toBeVisible();
    await expect(book(page)).toHaveCount(0);
    await expect(page.getByText('Topics to begin with')).toHaveCount(0);

    // Beside the form: the shuffling subject cards. Below it: our model.
    const hero = page.getByRole('region', { name: 'What we teach' });
    await expect(hero.getByRole('article')).toBeVisible();
    await expect(
      hero.getByRole('heading', {
        level: 2,
        name: /Class 11 Accounts|Class 11 Economics|Class 11 Science|DLT registration|Class 11 Mathematics/,
      }),
    ).toBeVisible();
    await expect(
      hero.getByRole('button', { name: 'Pause subject shuffle' }),
    ).toBeVisible();

    await expect(
      page.getByRole('heading', {
        level: 2,
        name: 'Big Subjects. Broken Into Small Victories.',
      }),
    ).toBeVisible();
    await expect(page.getByText('Breaking down the model')).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/${testInfo.project.name}-login.png`,
      fullPage: true,
    });

    await page.getByRole('link', { name: 'Join for free' }).first().click();
    await expect(page).toHaveURL(/\/register$/);
    await page.getByLabel('Student name').fill('Asha Verma');
    await page.getByLabel('Date of birth').fill('2009-04-12');
    await page.getByLabel('Mobile number').fill('+91 98765 43210');
    await page.getByLabel('Email ID').fill(uniqueEmail(testInfo.project.name));
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByLabel('Standard / Exam').selectOption('CLASS_10');
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/${testInfo.project.name}-register.png`,
      fullPage: true,
    });
    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(book(page)).toBeVisible();
  });

  test('a chosen batch survives the sign-in redirect', async ({
    page,
    request,
  }, testInfo) => {
    const email = uniqueEmail(`${testInfo.project.name}-redirect`);
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

    await page.goto(`/?topic=${GST_TOPIC}&batch=${NOVEMBER_BATCH}`);
    await expect(page).toHaveURL(/\/login\?redirect_to=/);

    await page.getByLabel('Email ID').fill(email);
    await page.getByLabel('Password', { exact: true }).fill('wrong-password');
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await expect(
      page.getByText('The email or password is incorrect'),
    ).toBeVisible();

    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: /^sign in$/i }).click();

    await expect(page).toHaveURL(new RegExp(`batch=${NOVEMBER_BATCH}`));
    await expect(
      page.getByRole('dialog', { name: /review your\s*selection/i }),
    ).toBeVisible();
  });

  test('protected pages redirect to sign-in and back', async ({
    page,
    request,
  }, testInfo) => {
    const email = uniqueEmail(`${testInfo.project.name}-protected`);
    await request.post('/api/auth/register', {
      data: {
        fullName: 'Meera Iyer',
        email,
        password: PASSWORD,
        dateOfBirth: '2008-06-02',
        mobile: '9876543211',
        standard: 'CLASS_11',
        stream: 'COMMERCE',
        address: null,
      },
    });

    await page.goto('/batches');
    await expect(page).toHaveURL(/\/login\?redirect_to=%2Fbatches/);
    await page.getByLabel('Email ID').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: /^sign in$/i }).click();

    await expect(page).toHaveURL(/\/batches$/);
    await expect(
      page.getByRole('heading', { level: 1, name: /all\s*batches/i }),
    ).toBeVisible();
  });
});

test.describe('homepage', () => {
  test('renders every section without horizontal scrolling', async ({
    page,
  }, testInfo) => {
    await signedIn(page, `${testInfo.project.name}-home`);
    await page.goto('/');
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: /a subject isn't learned in a day/i,
      }),
    ).toBeVisible();
    // The topic search lives in the header (inside the menu on phones)
    const menuButton = page.getByRole('button', { name: 'Open menu' });
    if (await menuButton.isVisible()) await menuButton.click();
    await expect(
      page.getByRole('searchbox', { name: 'Find your topic' }),
    ).toBeVisible();
    if (await page.getByRole('button', { name: 'Close menu' }).isVisible()) {
      await page.getByRole('button', { name: 'Close menu' }).click();
    }

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
      name: /select batch: learn gst for class 11, 1st & 2nd november/i,
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
    await expect(page).toHaveURL(new RegExp(`batch=${NOVEMBER_BATCH}`));
    await review.getByRole('button', { name: 'Close' }).click();

    await book(page)
      .getByRole('link', { name: /explore more batches/i })
      .click();
    await expect(page).toHaveURL(/\/batches$/);
    await expect(page.getByText('1st & 2nd November')).toBeVisible();
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

    // The payment panel opens from the right over a dimmed page
    const panel = page.getByRole('dialog', { name: /^GST/ });
    await expect(panel).toBeVisible();
    await expect(
      panel.getByRole('radio', { name: /November batch/ }),
    ).toBeChecked();
    await expect(panel.getByText('What is GST')).toBeVisible();
    await panel.getByLabel('Mobile number').fill('+91 98765 43210');
    await page.waitForTimeout(400);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/${testInfo.project.name}-payment-panel.png`,
    });
    await panel.getByRole('button', { name: 'Pay ₹129' }).click();

    // No Razorpay keys in the test API: the seat is held as payment pending
    await expect(panel.getByText('Seat saved')).toBeVisible();
    await panel.getByRole('button', { name: 'Done' }).click();
    await expect(panel).toBeHidden();

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
    await expect(page).toHaveURL(/\/login$/);

    const response = await page.request.get('/api/enrolments');
    expect(response.status()).toBe(401);

    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('model paper waitlist sign-ups are stored', async ({
    page,
  }, testInfo) => {
    await signedIn(page, `${testInfo.project.name}-waitlist`);
    await page.goto('/#model-paper');
    await expect(
      page.getByRole('heading', {
        level: 3,
        name: 'Sample Papers',
        exact: true,
      }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Join waitlist' }).first().click();
    const dialog = page.getByRole('dialog', { name: /prepare\s*ahead/i });
    await dialog.getByLabel('Exam').selectOption('NEET');
    await dialog.getByRole('button', { name: /join waitlist/i }).click();
    await expect(
      page.getByText('You have been added to the sample paper waitlist'),
    ).toBeVisible();
  });
});
