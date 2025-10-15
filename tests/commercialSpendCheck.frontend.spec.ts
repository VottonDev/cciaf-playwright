/**
📁 /tests/commercialSpendCheck.frontend.spec.ts
# Headed | watch in the browser
▶️ npx playwright test ./tests/commercialSpendCheck.frontend.spec.ts --project=chromium-frontend --headed
*/
import { test, expect } from '@playwright/test';
import { axeScan } from '../utils/axeScan';

test.describe.configure({ mode: 'serial' });

test('Step 1: Peer reviewer verifies Commercial Spend is blank', async ({ browser }) => {
  const peerContext = await browser.newContext({ storageState: 'playwright/.auth/govuk-pr.json' });
  const peerPage = await peerContext.newPage();
  await peerPage.goto('https://cogcg--autotests.sandbox.my.site.com/cciaf');
  await peerPage.getByRole('link', { name: 'External peer reviews' }).click();
  await peerPage.getByRole('link', { name: 'Xansium QA - October' }).click();
  await peerPage.getByRole('link', { name: 'Cover sheet', exact: true }).click();
  await peerPage.waitForLoadState('networkidle');
  await axeScan(peerPage, 'coversheet-readview-peer');
  const screenshot1 = await peerPage.screenshot({ fullPage: true });
  await test.info().attach('1-peer-reviewer-commercial-spend-empty', {body: screenshot1,contentType: 'image/png'});
  const spendValue = await peerPage.getByRole('definition').filter({ hasText: '£' }).textContent();
  const cleanedInitialValue = spendValue?.replace(/\s+/g, '').replace(/·/g, '').trim() || '';
  expect(cleanedInitialValue).toMatch(/^£$/);
  console.log('✓ Initial spend value is blank:', cleanedInitialValue);
  await peerContext.close();
});

test('Step 2: Org user updates Commercial Spend to £35,000,000', async ({ browser }) => {
  const orgContext = await browser.newContext({ storageState: 'playwright/.auth/govuk-frontend.json' });
  const orgPage = await orgContext.newPage();
  await orgPage.goto('https://cogcg--autotests.sandbox.my.site.com/cciaf');
  await orgPage.getByRole('link', { name: 'Xansium QA - October' }).click();
  await orgPage.getByRole('link', { name: 'Cover sheet', exact: true }).click();
  await orgPage.waitForLoadState('networkidle');
  await axeScan(orgPage, 'coversheet-before-edit-org');
  await orgPage.getByRole('heading', { name: 'Commercial Spend Under' }).getByRole('link').click();
  await orgPage.waitForLoadState('networkidle');
  await axeScan(orgPage, 'coversheet-edit-form-org');
  const screenshot2 = await orgPage.screenshot({ fullPage: true });
  await test.info().attach('2-org-user-edit-form-before', {body: screenshot2,contentType: 'image/png'});
  await orgPage.getByRole('textbox', { name: 'Third party spend covered by' }).clear();
  await orgPage.getByRole('textbox', { name: 'Third party spend covered by' }).fill('35000000');
  const screenshot3 = await orgPage.screenshot({ fullPage: true });
  await test.info().attach('3-org-user-edit-form-filled', {body: screenshot3,contentType: 'image/png'});
  await orgPage.getByRole('link', { name: 'Save changes' }).click();
  await orgPage.waitForLoadState('networkidle');
  await expect(orgPage.getByRole('heading', { name: 'Success' })).toBeVisible();
  await axeScan(orgPage, 'coversheet-success-org');
  const screenshot4 = await orgPage.screenshot({ fullPage: true });
  await test.info().attach('4-org-user-save-success', {body: screenshot4,contentType: 'image/png'});
  console.log('✓ Org user updated spend to £35,000,000');
  await orgContext.close();
});

test('Step 3: Peer reviewer verifies Commercial Spend is £35,000,000', async ({ browser }) => {
  const peerContext = await browser.newContext({ storageState: 'playwright/.auth/govuk-pr.json' });
  const peerPage = await peerContext.newPage();
  await peerPage.goto('https://cogcg--autotests.sandbox.my.site.com/cciaf');
  await peerPage.getByRole('link', { name: 'External peer reviews' }).click();
  await peerPage.getByRole('link', { name: 'Xansium QA - October' }).click();
  await peerPage.getByRole('link', { name: 'Cover sheet', exact: true }).click();
  await peerPage.waitForLoadState('networkidle');
  await axeScan(peerPage, 'coversheet-readview-peer-after-update');
  const screenshot5 = await peerPage.screenshot({ fullPage: true });
  await test.info().attach('5-peer-reviewer-commercial-spend-updated', {body: screenshot5,contentType: 'image/png'});
  const updatedSpendValue = await peerPage.getByRole('definition').filter({ hasText: '£' }).textContent();
  const cleanedUpdatedValue = updatedSpendValue?.replace(/\s+/g, '').replace(/·/g, '').trim() || '';
  expect(cleanedUpdatedValue).toMatch(/£35,?000,?000(\.00)?/);
  console.log('✓ Peer reviewer verified spend:', cleanedUpdatedValue);
  await peerContext.close();
});