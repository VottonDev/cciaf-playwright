import { test, expect } from '@playwright/test';

test('update organisation section coversheet', async ({ page }) => {
  // Navigate directly to the CCIAF dashboard (already authenticated)
  await page.goto('https://cogcg--autotests.sandbox.my.site.com/cciaf/apex/cciafassessprevious');
  
  // Look for anything that begins with 'Xansium' and click it
  await page.getByRole('link', { name: /^Xansium/ }).click();
  await page.getByRole('link', { name: 'Cover sheet', exact: true }).click();
  await page.getByRole('heading', { name: 'Organisation Change' }).getByRole('link').click();
  
  // Update internal reference identifier
  await page.getByRole('textbox', { name: 'Internal reference identifier' }).click();
  await page.getByRole('textbox', { name: 'Internal reference identifier' }).fill('Change');
  await page.getByRole('textbox', { name: 'Internal reference identifier' }).press('ControlOrMeta+a');
  await page.getByRole('textbox', { name: 'Internal reference identifier' }).fill('Internal reference');
  
  // Update organisation overview
  await page.getByRole('textbox', { name: 'Organisation overview (' }).click();
  await page.getByRole('textbox', { name: 'Organisation overview (' }).fill('Organisation overview');
  
  // Update staff number field
  await page.getByRole('textbox', { name: 'Number of staff (optional)' }).click();
  await page.getByRole('textbox', { name: 'Number of staff (optional)' }).press('ControlOrMeta+a');
  await page.getByRole('textbox', { name: 'Number of staff (optional)' }).fill('123');
  
  // Save changes
  await page.getByRole('link', { name: 'Save changes' }).click();

  // Wait for the URL to contain "cciafassesscoversheet" (with or without query params)
  await page.waitForURL(url => url.pathname.endsWith('/cciaf/cciafassesscoversheet'), { timeout: 30000 });

  // Check that the URL contains "cciafassesscoversheet" (ignore query params)
  await expect(page).toHaveURL(/\/cciaf\/cciafassesscoversheet(\?.*)?$/);
});