import { test, expect } from '@playwright/test';

test('update organisation section coversheet', async ({ page }) => {
  // Navigate directly to the CCIAF dashboard (already authenticated)
  await page.goto('https://cogcg--autotests.sandbox.my.site.com/cciaf/apex/cciafassessprevious');
  
  // Look for anything that begins with 'Xansium' and click it
  const orgLink = page.getByRole('link', { name: /^Xansium/ });

  // If the organisation isn't visible for the signed-in user (e.g. peer-reviewer),
  // fail with a helpful message and capture a screenshot for diagnostics.
  try {
    // Wait a short time for the organisation link to become visible
    await orgLink.first().waitFor({ state: 'visible', timeout: 5000 });
  } catch (e) {
    const file = `test-results/no-xansium-visible-${Date.now()}.png`;
    await page.screenshot({ path: file, fullPage: true });
    throw new Error(`Organisation link matching /^Xansium/ was not visible for the current user. ` +
      `This likely means the signed-in account (peer-reviewer) does not have access to the Xansium organisation or the page did not fully load. ` +
      `Captured screenshot: ${file}`);
  }

  await orgLink.first().click();
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