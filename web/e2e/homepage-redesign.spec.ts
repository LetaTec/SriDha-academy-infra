import { expect, test } from '@playwright/test';

const SCREENSHOT_DIR = 'test-results/screenshots';
const PASSWORD = 'correct-horse-1';

const uniqueEmail = (label: string) =>
  `redesign-${label}-${Date.now()}@example.com`;

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
      const email = uniqueEmail(vp.name);

      // Register and establish session on page.context
      const res = await page.request.post('/api/auth/register', {
        data: {
          fullName: 'Asha Verma',
          email,
          password: PASSWORD,
          dateOfBirth: '2008-04-12',
          mobile: '9876543210',
          standard: 'CLASS_11',
          stream: 'COMMERCE',
          address: null,
        },
      });
      expect(res.status()).toBe(201);

      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');

      // Verify approved headline
      const headline = page.getByRole('heading', { level: 1 });
      await expect(headline).toContainText("A subject isn't learned in a day");
      await expect(headline).toContainText(
        "It's mastered one concept at a time",
      );

      // Verify hero actions
      const hero = page.locator('#home');
      const exploreBtn = hero.getByRole('link', { name: 'Explore Subjects' });
      await expect(exploreBtn).toBeVisible();
      await expect(exploreBtn).toHaveAttribute('href', '#topics');

      const registerBtn = hero.getByRole('link', {
        name: 'Create Your Student Account',
      });
      await expect(registerBtn).toBeVisible();
      await expect(registerBtn).toHaveAttribute('href', '/register');

      // Verify interactive concept map rendered
      const conceptMap = page.getByRole('region', {
        name: 'Interactive concept map',
      });
      await expect(conceptMap).toBeVisible();

      // Concept map initial state is Partnership Accounts
      await expect(
        page.getByRole('tab', { name: 'Partnership Accounts' }),
      ).toBeVisible();
      await expect(
        page.getByRole('tab', { name: /Partnership Fundamentals/i }),
      ).toBeVisible();

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

      // Verify touch target sizes for nodes (min 40px height)
      const firstNode = page.getByRole('tab', {
        name: /Partnership Fundamentals/i,
      });
      const box = await firstNode.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(40);

      // Screenshot hero at this viewport
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/${vp.name}-hero.png`,
      });

      // Interactive test: click another node
      const admissionTab = page.getByRole('tab', {
        name: /Admission of a Partner/i,
      });
      await admissionTab.click();
      await expect(
        page.getByRole('heading', {
          level: 3,
          name: /Admission of a Partner/i,
        }),
      ).toBeVisible();

      // Interactive test: Switch subject to GST
      const gstTab = page.getByRole('tab', {
        name: /Goods & Services Tax/i,
      });
      await gstTab.click();
      await expect(
        page.getByRole('tab', { name: /What is GST/i }),
      ).toBeVisible();

      // Verify Learning Journey section
      const journeySection = page.locator('#learning-journey');
      await expect(journeySection).toBeVisible();
      await expect(
        journeySection.getByRole('heading', { level: 2 }),
      ).toContainText('How true mastery happens');

      // Click learning journey stage 4 (Topic assessment)
      const stage4Tab = page.getByRole('tab', {
        name: /4\. Topic assessment/i,
      });
      await stage4Tab.click();
      await expect(
        journeySection.getByRole('heading', {
          level: 3,
          name: /Take a topic-wise assessment/i,
        }),
      ).toBeVisible();

      // Verify Model Paper Discovery section
      const modelPaperSection = page.locator('section#model-paper');
      await expect(modelPaperSection).toBeVisible();
      await expect(
        modelPaperSection.getByRole('heading', {
          level: 3,
          name: /Past 5 Years' Board Questions/i,
        }),
      ).toBeVisible();
      await expect(
        modelPaperSection.getByRole('heading', {
          level: 3,
          name: /AI-Synthesised Model Papers/i,
        }),
      ).toBeVisible();
    });
  }
});
