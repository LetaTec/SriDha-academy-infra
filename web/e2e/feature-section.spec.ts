import { expect, test } from '@playwright/test';

const SCREENSHOT_DIR = 'test-results/screenshots';

test.describe('FeatureSection - Three Learning Chapters', () => {
  test('displays exact approved copy and correct layout on desktop and mobile', async ({
    page,
  }, testInfo) => {
    await page.goto('/login');

    const featureHeading = page.getByRole('heading', {
      level: 2,
      name: 'How SriDha Academy works.',
    });

    await featureHeading.scrollIntoViewIfNeeded();
    await expect(featureHeading).toBeVisible();

    // Verify Section introduction
    await expect(page.getByText('In three chapters')).toBeVisible();
    await expect(
      page.getByText(
        'Every big subject becomes easier when you take it one step at a time. Here’s how we help you move from understanding a concept to feeling confident about it.',
      ),
    ).toBeVisible();

    // Verify Chapter 01
    await expect(
      page.getByRole('heading', { level: 3, name: 'Learn at your pace' }),
    ).toBeVisible();
    await expect(
      page.getByText('Understand it. Don’t just memorise it.'),
    ).toBeVisible();
    await expect(
      page.getByText(
        'Some topics take a little longer to click. That’s perfectly fine. Our topic-wise live classes break difficult concepts into smaller, clearer lessons, so you can ask questions, clear your doubts, and learn at a pace that works for you.',
      ),
    ).toBeVisible();
    await expect(
      page.getByText('One topic at a time. One step closer to understanding.'),
    ).toBeVisible();

    // Verify Chapter 02
    await expect(
      page.getByRole('heading', {
        level: 3,
        name: 'Put your learning to the test',
      }),
    ).toBeVisible();
    await expect(
      page.getByText(
        'Because understanding feels better when you can prove it.',
      ),
    ).toBeVisible();
    await expect(
      page.getByText(
        'Once you’ve learnt a topic, it’s time to see how well it has stayed with you. Practise with topic-wise questions, check your answers, and discover where you need a little more practice.',
      ),
    ).toBeVisible();
    await expect(
      page.getByText('Learn it. Try it. Understand it better.'),
    ).toBeVisible();

    // Verify Chapter 03
    await expect(
      page.getByRole('heading', {
        level: 3,
        name: 'Walk into your exam prepared',
      }),
    ).toBeVisible();
    await expect(
      page.getByText('Practise today. Face tomorrow with confidence.'),
    ).toBeVisible();
    await expect(
      page.getByText(
        'Get familiar with the way questions appear in exams through previous-year question papers and carefully reviewed sample papers. Learn to recognise question patterns, manage your time, and approach your preparation with greater clarity.',
      ),
    ).toBeVisible();
    await expect(
      page.getByText(
        'Preparation isn’t about knowing everything at once. It’s about knowing what to do next.',
      ),
    ).toBeVisible();

    // Scroll each chapter into view to trigger reveal animation
    const chapters = page.locator('ol > li');
    const count = await chapters.count();
    for (let i = 0; i < count; i++) {
      await chapters.nth(i).scrollIntoViewIfNeeded();
      await page.waitForTimeout(100);
    }

    // Check no horizontal overflow
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    // Screenshot the feature section
    const featureSection = page.locator('section:has(#feature-title)');
    await expect(featureSection).toBeVisible();
    await featureSection.screenshot({
      path: `${SCREENSHOT_DIR}/${testInfo.project.name}-feature-section.png`,
    });
  });
});
