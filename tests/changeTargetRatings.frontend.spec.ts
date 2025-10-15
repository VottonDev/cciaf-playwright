/**
📁 /tests/changeTargetRatings.frontend.spec.ts

# Headed | watch in the browser 
▶️ npx playwright test ./tests/changeTargetRatings.frontend.spec.ts --project=chromium-frontend --headed
*/

import { test, expect } from '@playwright/test';
import { axeScan } from '../utils/axeScan';

const RATING_ORDER = ['In development', 'Good', 'Better', 'Best'] as const;
type Rating = typeof RATING_ORDER[number];

const STRATEGY: 'same' | 'up' = 'up';

const originalRatings: Rating[] = [];
const targetRatings: Rating[] = [];

function normaliseRating(text: string): Rating {
  const firstWord = text.trim().split(/\s+/)[0].toLowerCase();
  if (firstWord.startsWith('in')) return 'In development';
  if (firstWord === 'good') return 'Good';
  if (firstWord === 'better') return 'Better';
  if (firstWord === 'best') return 'Best';
  return 'In development';
}

function selectTarget(current: Rating): Rating {
  if (STRATEGY === 'same') return current;
  const index = RATING_ORDER.indexOf(current);
  return RATING_ORDER[Math.min(index + 1, RATING_ORDER.length - 1)];
}

test.describe.configure({ mode: 'serial' });

test('Step 1: Capture current ratings', async ({ page }) => {
  await page.goto('https://cogcg--autotests.sandbox.my.site.com/cciaf');
  await page.getByRole('link', { name: 'Xansium QA - October' }).click();
  await page.getByRole('link', { name: 'Cover sheet', exact: true }).click();
  await axeScan(page, 'coversheet-readview');
  const targetHeading = page.getByRole('heading', { name: 'Target ratings' });
  await expect(targetHeading).toBeVisible();
  const screenshot1 = await page.screenshot({ fullPage: true });
  await test.info().attach('1-coversheet-before-changes', {
    body: screenshot1,
    contentType: 'image/png'
  });
  await targetHeading.getByRole('link', { name: 'Change' }).click();
  await expect(page.getByRole('heading', { name: /Change target ratings/i })).toBeVisible();
  await page.waitForLoadState('networkidle');
  const screenshot2 = await page.screenshot({ fullPage: true });
  await test.info().attach('2-edit-form-original-ratings', {
    body: screenshot2,
    contentType: 'image/png'
  });
  await axeScan(page, 'target-ratings-edit-form', { softFail: true });
  const selects = page.locator('select[name$=":ambition"]');
  const count = await selects.count();
  expect(count).toBeGreaterThan(0);
  originalRatings.length = 0;
  targetRatings.length = 0;
  for (let i = 0; i < count; i++) {
    const select = selects.nth(i);
    await select.waitFor({ state: 'visible' });
    const container = select.locator('xpath=ancestor::dl[contains(@class,"govuk-summary-list")]').first();
    const currentRatingText = await container
      .locator('xpath=.//dt[contains(normalize-space(),"Current rating")]/following-sibling::dd[1]')
      .innerText();
    const currentRating = normaliseRating(currentRatingText);
    const originalTargetText = await select.locator('option:checked').innerText();
    const originalTarget = originalTargetText.trim() as Rating;
    const newTarget = selectTarget(currentRating);
    originalRatings.push(originalTarget);
    targetRatings.push(newTarget);
  }

});

test('Step 2: Update target ratings based on current ratings', async ({ page }) => {
  await page.goto('https://cogcg--autotests.sandbox.my.site.com/cciaf/cciafassessprevious');
  await page.getByRole('link', { name: 'Xansium QA - October' }).click();
  await page.getByRole('link', { name: 'Cover sheet', exact: true }).click();
  const targetHeading = page.getByRole('heading', { name: 'Target ratings' });
  await targetHeading.getByRole('link', { name: 'Change' }).click();
  await page.waitForLoadState('networkidle');
  const selects = page.locator('select[name$=":ambition"]');
  const count = await selects.count();
  for (let i = 0; i < count; i++) {
    const select = selects.nth(i);
    const newTarget = targetRatings[i];
    await select.waitFor({ state: 'visible' });
    await select.scrollIntoViewIfNeeded();
    try {
      await select.selectOption({ label: newTarget });
    } catch (error) {
      await select.selectOption({ value: newTarget });
    }
    const selectedText = await select.locator('option:checked').innerText();
    expect(selectedText.trim()).toBe(newTarget);
    await page.waitForTimeout(100);
  }
  const screenshot3 = await page.screenshot({ fullPage: true });
  await test.info().attach('3-edit-form-updated-ratings-before-save', {
    body: screenshot3,
    contentType: 'image/png'
  });
  await page.getByRole('link', { name: /Save changes/i }).click();
  await page.waitForLoadState('networkidle');
  const successVisible = await page.getByRole('heading', { name: 'Success' }).isVisible().catch(() => false);
  if (successVisible) {
    const screenshot4 = await page.screenshot({ fullPage: true });
    await test.info().attach('4-success-message-after-save', {
      body: screenshot4,
      contentType: 'image/png'
    });
    await axeScan(page, 'target-ratings-success');
  }
});

test('Step 3: Verify updated ratings persisted correctly', async ({ page }) => {
  await page.goto('https://cogcg--autotests.sandbox.my.site.com/cciaf/cciafassessprevious');
  await page.getByRole('link', { name: 'Xansium QA - October' }).click();
  await page.getByRole('link', { name: 'Cover sheet', exact: true }).click();
  const screenshot5 = await page.screenshot({ fullPage: true });
  await test.info().attach('5-coversheet-with-updated-ratings', {
    body: screenshot5,
    contentType: 'image/png'
  });
  await axeScan(page, 'coversheet-after-update');
  const targetHeading = page.getByRole('heading', { name: 'Target ratings' });
  await targetHeading.getByRole('link', { name: 'Change' }).click();
  await page.waitForLoadState('networkidle');
  const selects = page.locator('select[name$=":ambition"]');
  const count = await selects.count();
  for (let i = 0; i < count; i++) {
    const select = selects.nth(i);
    await select.waitFor({ state: 'visible' });
    const selectedText = await select.locator('option:checked').innerText();
    const selectedRating = selectedText.trim();
    const expectedRating = targetRatings[i];
    expect(selectedRating).toBe(expectedRating);
  }
  const screenshot6 = await page.screenshot({ fullPage: true });
  await test.info().attach('6-edit-form-verified-updated-ratings', {
    body: screenshot6,
    contentType: 'image/png'
  });
});

test('Step 4: Reset target ratings to original state', async ({ page }) => {
  await page.goto('https://cogcg--autotests.sandbox.my.site.com/cciaf/cciafassessprevious');
  await page.getByRole('link', { name: 'Xansium QA - October' }).click();
  await page.getByRole('link', { name: 'Cover sheet', exact: true }).click();
  const targetHeading = page.getByRole('heading', { name: 'Target ratings' });
  await targetHeading.getByRole('link', { name: 'Change' }).click();
  await page.waitForLoadState('networkidle');
  const selects = page.locator('select[name$=":ambition"]');
  const count = await selects.count();
  for (let i = 0; i < count; i++) {
    const select = selects.nth(i);
    const originalTarget = originalRatings[i];
    await select.waitFor({ state: 'visible' });
    await select.scrollIntoViewIfNeeded();
    try {
      await select.selectOption({ label: originalTarget });
    } catch (error) {
      await select.selectOption({ value: originalTarget });
    }
    const selectedText = await select.locator('option:checked').innerText();
    expect(selectedText.trim()).toBe(originalTarget);
    await page.waitForTimeout(100);
  }
  const screenshot7 = await page.screenshot({ fullPage: true });
  await test.info().attach('7-edit-form-reset-ratings-before-save', {
    body: screenshot7,
    contentType: 'image/png'
  });
  await page.getByRole('link', { name: /Save changes/i }).click();
  await page.waitForLoadState('networkidle');
});

test('Step 5: Final verification of reset', async ({ page }) => {
  await page.goto('https://cogcg--autotests.sandbox.my.site.com/cciaf/cciafassessprevious');
  await page.getByRole('link', { name: 'Xansium QA - October' }).click();
  await page.getByRole('link', { name: 'Cover sheet', exact: true }).click();
  const screenshot8 = await page.screenshot({ fullPage: true });
  await test.info().attach('8-coversheet-after-reset', {
    body: screenshot8,
    contentType: 'image/png'
  });
  await axeScan(page, 'coversheet-reset-complete');
  const targetHeading = page.getByRole('heading', { name: 'Target ratings' });
  await targetHeading.getByRole('link', { name: 'Change' }).click();
  await page.waitForLoadState('networkidle');
  const selects = page.locator('select[name$=":ambition"]');
  const count = await selects.count();
  for (let i = 0; i < count; i++) {
    const select = selects.nth(i);
    await select.waitFor({ state: 'visible' });
    const selectedText = await select.locator('option:checked').innerText();
    const selectedRating = selectedText.trim();
    const originalRating = originalRatings[i];
    expect(selectedRating).toBe(originalRating);
  }
  const screenshot9 = await page.screenshot({ fullPage: true });
  await test.info().attach('9-edit-form-final-verification', {
    body: screenshot9,
    contentType: 'image/png'
  });

  console.log(`\n✅ Test complete - all data reset and verified\n`);
});