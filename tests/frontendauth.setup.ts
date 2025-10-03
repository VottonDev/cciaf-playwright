import { test as setup, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const authFile = path.join(__dirname, '../playwright/.auth/govuk-frontend.json');

setup('authenticate with GovUK frontend', async ({ page }) => {
  // Set a reasonable timeout for frontend authentication
  setup.setTimeout(60000); // 1 minute
  
  // Navigate to GovUK frontend
  await page.goto('https://cogcg--autotests.sandbox.my.site.com/cciaf');
  
  console.log('🔐 Starting GovUK frontend authentication...');
  
  // Click Sign in / Register
  await page.getByRole('link', { name: 'Sign in / Register' }).click();
  
  // Fill in email
  await page.getByRole('textbox', { name: 'Your email address' }).click();
  await page.getByRole('textbox', { name: 'Your email address' }).fill(process.env.GOVUK_EMAIL || '');
  
  // Fill in password
  await page.getByRole('textbox', { name: 'Your password' }).click();
  await page.getByRole('textbox', { name: 'Your password' }).fill(process.env.GOVUK_PASSWORD || '');
  
  // Click Sign in
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  
  // Wait for successful authentication - redirect to the dashboard
  await page.waitForURL('**/cciafassessprevious', { timeout: 30000 });
  
  console.log('✅ Successfully authenticated with GovUK frontend!');
  
  // Save the authenticated state (including cookies and local storage)
  await page.context().storageState({ path: authFile });
  
  console.log('💾 Authentication state saved to', authFile);
  console.log('🎉 Frontend setup complete! You can now run your tests without logging in each time.');
});