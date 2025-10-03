import { test, expect } from '@playwright/test';

test('attach a pdf to a criteria', async ({ page }) => {
  // Navigate directly to the CCIAF dashboard (already authenticated)
  await page.goto('https://cogcg--autotests.sandbox.my.site.com/cciaf/apex/cciafassessprevious');
  
  // Look for anything that begins with 'Xansium' and click it
  await page.getByRole('link', { name: /^Xansium/ }).click();
  await page.getByRole('link', { name: '1.1. Overall commercial' }).click();
  await page.getByRole('link', { name: 'Criteria 1.1.1' }).click();
  await page.getByText('Attach a document').click();
  await page.getByText('Choose files').click();
  await page.getByRole('button', { name: 'Choose files' }).setInputFiles('upload_samples/sample.pdf');
  await page.getByRole('link', { name: 'Save document' }).click();

  // Wait for the URL to contain "cciafassessindicator" (with or without query params)
  await page.waitForURL(url => url.pathname.endsWith('/cciaf/cciafassessindicator'), { timeout: 30000 });

  // Check that the URL contains "cciafassessindicator" (ignore query params)
  await expect(page).toHaveURL(/\/cciaf\/cciafassessindicator(\?.*)?$/);
});