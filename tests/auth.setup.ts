import { test as setup, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const authFile = path.join(__dirname, '../playwright/.auth/salesforce.json');

setup('authenticate with Salesforce', async ({ page }) => {
  // Set a longer timeout for this setup test to allow time for manual 2FA entry
  setup.setTimeout(180000); // 3 minutes
  // Navigate to Salesforce login
  await page.goto('https://cogcg--autotests.sandbox.my.salesforce.com/');
  
  // Perform authentication steps
  await page.getByRole('textbox', { name: 'Username' }).fill(process.env.SALESFORCE_USERNAME || '');
  await page.getByRole('textbox', { name: 'Password' }).fill(process.env.SALESFORCE_PASSWORD || '');
  await page.getByRole('button', { name: 'Log In to Sandbox' }).click();
  
  // Wait for 2FA verification code page to appear
  console.log('⏳ Waiting for 2FA verification page...');
  const verificationCodeInput = page.getByRole('textbox', { name: 'Verification Code' });
  await verificationCodeInput.waitFor({ state: 'visible', timeout: 30000 });
  
  console.log('🔐 2FA page detected. Please check your email/phone for the verification code.');
  console.log('📝 You have 2 minutes to enter the verification code and click Verify.');
  
  // Wait for successful authentication by checking if we've navigated to the Lightning interface
  // This will wait until you manually enter the verification code and click Verify
  // Salesforce redirects through /one/one.app to /lightning/page/home
  // Pattern matches both production and sandbox URLs
  await page.waitForURL('**/lightning/**', { timeout: 120000 }); // 2 minutes to allow for manual 2FA entry
  
  console.log('✅ Successfully authenticated!');
  
  // Save the authenticated state (including cookies and local storage)
  await page.context().storageState({ path: authFile });
  
  console.log('💾 Authentication state saved to', authFile);
  console.log('🎉 Setup complete! You can now run your tests without logging in each time.');
});

