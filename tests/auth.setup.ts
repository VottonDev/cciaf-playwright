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
  
  // Check if 2FA is required or if we're redirected directly to the Lightning interface
  console.log('⏳ Checking for 2FA requirement...');
  
  // Race between 2FA page appearing and direct redirect to Lightning
  const verificationCodeInput = page.getByRole('textbox', { name: 'Verification Code' });
  
  try {
    // Wait up to 10 seconds to see if 2FA page appears
    await verificationCodeInput.waitFor({ state: 'visible', timeout: 10000 });
    
    console.log('🔐 2FA page detected. Please check your email/phone for the verification code.');
    console.log('📝 You have 2 minutes to enter the verification code and click Verify.');
    
    // Wait for successful authentication after manual 2FA entry
    await page.waitForURL('**/lightning/**', { timeout: 120000 }); // 2 minutes to allow for manual 2FA entry
    
  } catch (error) {
    // 2FA page didn't appear - check if we're already at Lightning
    console.log('ℹ️  2FA page not detected, checking if already authenticated...');
    
    // Wait for Lightning interface (with a shorter timeout since we expect to be there already)
    await page.waitForURL('**/lightning/**', { timeout: 30000 });
    
    console.log('✅ Authentication succeeded without 2FA (already trusted device).');
  }
  
  console.log('✅ Successfully authenticated!');
  
  // Save the authenticated state (including cookies and local storage)
  await page.context().storageState({ path: authFile });
  
  console.log('💾 Authentication state saved to', authFile);
  console.log('🎉 Setup complete! You can now run your tests without logging in each time.');
});

