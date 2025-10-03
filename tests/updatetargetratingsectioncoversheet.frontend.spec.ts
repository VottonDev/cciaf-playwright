import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  // Navigate directly to the CCIAF dashboard (already authenticated)
  await page.goto('https://cogcg--autotests.sandbox.my.site.com/cciaf/apex/cciafassessprevious');
  
  // Look for anything that begins with 'Xansium' and click it
  await page.getByRole('link', { name: /^Xansium/ }).click();
  await page.getByRole('link', { name: 'Cover sheet', exact: true }).click();

  await page.getByRole('heading', { name: 'Target ratings Change' }).getByRole('link').click();
  await page.locator('select[name="j_id0:j_id2:j_id86:j_id98:0:ambition"]').selectOption('Good');
  await page.locator('select[name="j_id0:j_id2:j_id86:j_id98:1:ambition"]').selectOption('In development');
  await page.locator('select[name="j_id0:j_id2:j_id86:j_id98:2:ambition"]').selectOption('Better');
  await page.locator('select[name="j_id0:j_id2:j_id86:j_id98:3:ambition"]').selectOption('Best');
  await page.locator('select[name="j_id0:j_id2:j_id86:j_id98:4:ambition"]').selectOption('Good');
  await page.locator('select[name="j_id0:j_id2:j_id86:j_id98:5:ambition"]').selectOption('In development');
  await page.locator('select[name="j_id0:j_id2:j_id86:j_id98:6:ambition"]').selectOption('Better');
  await page.locator('dl:nth-child(17) > div:nth-child(2) > .reg-pad.govuk-summary-list__value').click();
  await page.locator('select[name="j_id0:j_id2:j_id86:j_id98:7:ambition"]').selectOption('Good');
  await page.getByRole('link', { name: 'Save changes' }).click();

  // Wait for the URL to contain "cciafassesscoversheet" (with or without query params)
  await page.waitForURL(url => url.pathname.endsWith('/cciaf/cciafassesscoversheet'), { timeout: 30000 });

  // Check that the URL contains "cciafassesscoversheet" (ignore query params)
  await expect(page).toHaveURL(/\/cciaf\/cciafassesscoversheet(\?.*)?$/);
});