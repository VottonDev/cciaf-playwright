import { test, expect } from '@playwright/test';

test('populate all criteria for test assessment', async ({ page, context }) => {
  // Set a longer timeout for this dev script (may need to wait for script execution)
  test.setTimeout(120000); // 2 minutes
  
  console.log('🔍 Starting populate all criteria dev script...');
  
  // Step 1: Get the Assessment ID from the frontend (Xansium assessment)
  console.log('📋 Step 1: Authenticating to frontend and retrieving Assessment ID...');
  
  // Create a new page for frontend authentication
  const frontendPage = await context.newPage();
  await frontendPage.goto('https://cogcg--autotests.sandbox.my.site.com/cciaf');
  
  // Authenticate to frontend
  await frontendPage.getByRole('link', { name: 'Sign in / Register' }).click();
  await frontendPage.getByRole('textbox', { name: 'Your email address' }).fill(process.env.GOVUK_EMAIL || '');
  await frontendPage.getByRole('textbox', { name: 'Your password' }).fill(process.env.GOVUK_PASSWORD || '');
  await frontendPage.getByRole('link', { name: 'Sign in', exact: true }).click();
  
  // Wait for successful authentication - redirect to the dashboard
  await frontendPage.waitForURL('**/cciafassessprevious', { timeout: 30000 });
  
  console.log('✅ Authenticated to frontend');
  
  // Find the Xansium assessment link and extract the Assessment ID from its URL
  const xansiumLink = frontendPage.getByRole('link', { name: /^Xansium/ });
  await xansiumLink.waitFor({ timeout: 10000 });
  
  const href = await xansiumLink.getAttribute('href');
  if (!href) {
    throw new Error('Could not find Xansium assessment link');
  }
  
  // Extract Assessment ID from URL (format: ?id=a01dw0000085Bj0AAE)
  const urlParams = new URLSearchParams(href.split('?')[1]);
  const assessmentId = urlParams.get('id');
  
  if (!assessmentId) {
    throw new Error('Could not extract Assessment ID from URL: ' + href);
  }
  
  console.log('✅ Found Assessment ID:', assessmentId);
  await frontendPage.close();
  
  // Step 2: Log in to Salesforce and open Developer Console
  console.log('📋 Step 2: Opening Salesforce Developer Console...');
  
  await page.goto('https://cogcg--autotests.sandbox.my.salesforce.com/');
  
  // Login with environment variables
  await page.getByRole('textbox', { name: 'Username' }).fill(
    process.env.SALESFORCE_USERNAME || ''
  );
  await page.getByRole('textbox', { name: 'Password' }).fill(
    process.env.SALESFORCE_PASSWORD || ''
  );
  await page.getByRole('button', { name: 'Log In to Sandbox' }).click();
  
  // Wait for login to complete
  await page.waitForURL('**/lightning/**', { timeout: 30000 });
  
  console.log('✅ Logged in to Salesforce');
  
  // Open Developer Console
  await page.getByRole('button', { name: 'Setup' }).click();
  const devConsolePromise = page.waitForEvent('popup');
  await page.getByRole('menuitem', { name: 'Developer Console Opens in a' }).click();
  const devConsole = await devConsolePromise;
  
  console.log('✅ Developer Console opened');
  
  // Step 3: Execute the Apex script with dynamic Assessment ID
  console.log('📋 Step 3: Executing Apex script to populate all criteria...');
  
  await devConsole.getByRole('button', { name: 'Debug' }).click();
  await devConsole.getByRole('link', { name: 'Open Execute Anonymous Window' }).click();
  
  // Wait for the Execute Anonymous window to be ready
  await devConsole.locator('#panel-1183-body').getByRole('textbox').waitFor({ timeout: 5000 });
  
  // Build the Apex script with the dynamic Assessment ID
  const apexScript = `//Script to populate all criteria:
List<Assessment_Indicator__c> ai1 = [SELECT Id, Indicator_number__c, Ready_for_peer_review__c, Supporting_evidence__c, Attainment__c FROM Assessment_Indicator__c WHERE Assessment__c = '${assessmentId}'];
List<Assessment_Indicator__c> ai2 = new List<Assessment_Indicator__c>();
for(Assessment_Indicator__c ai3 : ai1){
    ai3.Supporting_evidence__c = 'qwertyuiopqwertyuiopqwertyuiopqwertyuiop';
    ai3.Attainment__c = 'Partially meeting';
    ai3.Ready_for_peer_review__c = true;
    ai2.add(ai3);
}
update ai2;`;
  
  // Fill in the Apex script
  await devConsole.locator('#panel-1183-body').getByRole('textbox').fill(apexScript);
  
  console.log('✅ Apex script populated with Assessment ID:', assessmentId);
  
  // Open log panel and execute
  await devConsole.getByLabel('Open Log').click();
  await devConsole.getByRole('button', { name: 'Execute', exact: true }).click();
  
  // Wait a moment for execution to complete
  await devConsole.waitForTimeout(2000);
  
  console.log('✅ Script executed successfully!');
  console.log('🎉 All criteria populated for Assessment:', assessmentId);
  console.log('💡 You can now run your tests directly without manual edits!');
});