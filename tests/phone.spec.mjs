import { test, expect } from '@playwright/test';

for (const width of [320, 390, 430]) {
  test(`main screens fit a ${width}px phone`, async ({ page }) => {
    await page.setViewportSize({ width, height: 740 });
    const failures = [];
    for (const route of ['/', '/kitchen', '/kitchen/dinner', '/library', '/library?tab=catalogue',
      '/recipe/chili', '/cook/chili?step=3', '/list', '/settings']) {
      await page.goto('/index.html#' + route);
      await expect(page.locator('#view .page').first()).toBeVisible();
      const overflow = await page.locator('#view .page').first().evaluate(page => {
        const { left, right } = page.getBoundingClientRect();
        return [...page.querySelectorAll('.panel, .hub-card, .btn, input, select, h1, h2')]
          .filter(el => el.getClientRects().length && !el.closest('[hidden]'))
          .filter(el => {
            const rect = el.getBoundingClientRect();
            return rect.right > right + 1 || rect.left < left - 1;
          }).slice(0, 5).map(el => el.className || el.tagName);
      });
      if (overflow.length) failures.push(`${route}: ${overflow.join(', ')}`);
      const extraWidth = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (extraWidth > 1) failures.push(`${route}: ${extraWidth}px horizontal page overflow`);
    }
    expect(failures).toEqual([]);
  });
}
