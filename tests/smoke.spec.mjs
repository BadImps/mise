/* Mise / smoke test.
   Boots the offline app, walks import → cook → scale → list-minded flows and
   checks the page has no console errors. No network fixtures needed — the
   bundled catalogue is enough. One spec, no screenshots. */
import { test, expect } from '@playwright/test';

test('app boots offline; recipe → list → cook flows work', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));
  page.on('console', (msg) => { if (msg.type() === 'error') pageErrors.push(msg.text()); });

  await page.goto('/index.html#/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('a[href="#/"]').first()).toBeVisible();

  // 1. Bundled sample recipe renders, with a publisher-style serving note.
  await page.goto('/index.html#/recipe/chili');
  await expect(page.locator('h1').first()).toBeVisible();
  await expect(page.locator('.ing-amount', { hasText: '2 cups' }).first()).toBeVisible();

  // Unit conversion renders beside the publisher's amount.
  await expect(page.locator('.ing-amount', { hasText: '(473 ml)' }).first()).toBeVisible();

  // 2. Cook mode shows the per-step timer prompt for a step naming a duration.
  await page.goto('/index.html#/cook/chili?step=3');
  await expect(page.locator('.timer-prompt')).toBeVisible();
  await page.locator('[data-action="timer-prompt-dismiss"]').click();
  await expect(page.locator('.timer-prompt')).toHaveCount(0);

  // 3. Shopping list: add a bundled recipe, verify rows and grouping.
  await page.goto('/index.html#/recipe/chili');
  await page.locator('[data-action="add-to-list"]').first().click();
  await page.goto('/index.html#/list');
  await expect(page.locator('h1', { hasText: 'Shopping list' })).toBeVisible();
  await expect(page.locator('.sl-row').first()).toBeVisible();
  await expect(page.locator('[data-action="print-list"]')).toBeVisible();
  await expect(page.locator('[data-action="share-list"]')).toBeVisible();
  await expect(page.locator('.sl-footer')).toContainText('Keep browsing');

  // 4. Clear the test item to leave the browser state clean for the next run.
  await page.locator('[data-action="clear-list-all"]').click();

  // 5. Settings shows the kitchen export controls.
  await page.goto('/index.html#/settings');
  await expect(page.locator('[data-action="export-kitchen"]')).toBeVisible();
  await expect(page.locator('#kitchen-file')).toBeAttached();
  await expect(page.locator('#kitchen-import-text')).toBeAttached();

  expect(pageErrors, 'console errors: ' + pageErrors.join(' | ')).toEqual([]);
});
