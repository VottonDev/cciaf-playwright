import { test as setup, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const authFile = path.join(__dirname, '../playwright/.auth/govuk-frontend.json');
const prAuthFile = path.join(__dirname, '../playwright/.auth/govuk-pr.json');

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

setup('authenticate with GovUK peer-reviewer', async ({ browser }) => {
  // Set a reasonable timeout for peer-reviewer authentication
  setup.setTimeout(60000); // 1 minute
  
  console.log('🔐 Starting GovUK peer-reviewer authentication...');
  
  try {
    // Create a new context for peer reviewer
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Navigate to GovUK frontend
    await page.goto('https://cogcg--autotests.sandbox.my.site.com/cciaf', { 
      waitUntil: 'domcontentloaded', // Don't wait for full load
      timeout: 30000 
    });
    
    // Click Sign in / Register
    await page.getByRole('link', { name: 'Sign in / Register' }).click();
    
    // Fill in peer reviewer email
    await page.getByRole('textbox', { name: 'Your email address' }).fill(process.env.GOVUK_PR_EMAIL || '');
    
    // Fill in peer reviewer password
    await page.getByRole('textbox', { name: 'Your password' }).fill(process.env.GOVUK_PR_PASSWORD || '');
    
    // Click Sign in
    await page.getByRole('link', { name: 'Sign in', exact: true }).click();
    
    // Wait for successful authentication - redirect to the dashboard
    await page.waitForURL('**/cciafassessprevious', { timeout: 30000 });
    
    console.log('✅ Successfully authenticated with GovUK peer-reviewer!');
    
    // Save the peer-reviewer authenticated state
    await context.storageState({ path: prAuthFile });
    
    console.log('💾 Peer-reviewer authentication state saved to', prAuthFile);
    console.log('🎉 Peer-reviewer frontend setup complete!');
    
    await context.close();
    
  } catch (error) {
    console.error('⚠️ Peer-reviewer auth setup failed:', error);
    throw error; // Re-throw to fail the setup properly
  }
});