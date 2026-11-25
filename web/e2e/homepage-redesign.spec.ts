import { expect, test } from '@playwright/test';

const SCREENSHOT_DIR = 'test-results/screenshots';

const VIEWPORTS = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'narrow-mobile-320', width: 320, height: 600 },
];

test.describe('Homepage Redesign Responsiveness and Quality', () => {
  for (const vp of VIEWPORTS) {
    test(`renders perfectly with 0 overflow at ${vp.name} (${vp.width}x${vp.height})`, async ({
      page,
    }) => {
      // No account needed: the homepage opens on the topic search
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');

      const hero = page.locator('#home');
      await expect(hero.getByRole('heading', { level: 1 })).toContainText(
        'Search your topic',
      );
      const search = hero.getByRole('searchbox', {
        name: 'Search your topic',
      });
      await expect(search).toBeVisible();
      // Popular topics come from the catalogue
      await expect(
        hero.getByRole('button', { name: 'Business cycles' }),
      ).toBeVisible();

      // The search box is a comfortable touch target at every size
      const searchBox = await search.boundingBox();
      expect(searchBox).not.toBeNull();
      expect(searchBox!.height).toBeGreaterThanOrEqual(44);

      // Results drop down over the page instead of being cut off
      await search.fill('class 11');
      const results = hero.getByRole('region', {
        name: 'Matching topics and batches',
      });
      await expect(results).toBeVisible();
      const resultsBox = await results.boundingBox();
      expect(resultsBox).not.toBeNull();
      expect(resultsBox!.x).toBeGreaterThanOrEqual(0);
      expect(resultsBox!.x + resultsBox!.width).toBeLessThanOrEqual(
        vp.width + 1,
      );
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/${vp.name}-hero.png`,
      });
      await search.fill('');

      // Verify ZERO horizontal overflow
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      if (overflow > 0) {
        const overflowing = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('*'))
            .filter(
              el => el.getBoundingClientRect().right > window.innerWidth + 1,
            )
            .map(
              el =>
                `${el.tagName}.${el.className}#${el.id} (right: ${el.getBoundingClientRect().right})`,
            );
        });
        console.log('OVERFLOWING ELEMENTS AT ' + vp.name + ':', overflowing);
      }
      expect(overflow).toBeLessThanOrEqual(0);

      // Verify Learning Journey section
      const journeySection = page.locator('#learning-journey');
      await expect(journeySection).toBeVisible();
      await expect(
        journeySection.getByRole('heading', { level: 2 }),
      ).toContainText('How it works');
      await expect(
        journeySection.getByRole('link', { name: 'Topic Test Paper' }),
      ).toHaveAttribute('href', '/topic-tests');

      // Only what students can use today: no model paper promises
      await expect(page.locator('section#model-paper')).toHaveCount(0);
      const programs = page.locator('#programs');
      await expect(
        programs.getByRole('link', { name: 'Take a topic test' }),
      ).toHaveAttribute('href', '/topic-tests');
    });
  }
});
