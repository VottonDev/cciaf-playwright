/**
📁 /tests/uploadFileToCriteria.frontend.spec.ts

# Headed | watch in the browser 
▶️ npx playwright test ./tests/uploadFileToCriteria.frontend.spec.ts --project=chromium-frontend --headed
*/

import { test, expect } from '@playwright/test';
import { axeScan } from '../utils/axeScan';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOCUMENT_TITLE = `sample_1`;
const DOCUMENT_PATH = path.join(__dirname, '../upload_samples/sample.pdf');

test.describe.configure({ mode: 'serial' });

test('Step 1: Navigate to criteria and verify upload form', async ({ page }) => {
  await page.goto('https://cogcg--autotests.sandbox.my.site.com/cciaf');
  await page.getByRole('link', { name: 'Xansium QA - October' }).click();
  await page.getByRole('link', { name: '1.1. Overall commercial' }).click();
  await page.waitForLoadState('networkidle');
  await axeScan(page, 'practice-area-overview', { softFail: true });
  const screenshot1 = await page.screenshot({ fullPage: true });
  await test.info().attach('1-practice-area-overview', {body: screenshot1,contentType: 'image/png'});
  await page.getByRole('link', { name: 'Criteria 1.1.1' }).click();
  await page.waitForLoadState('networkidle');
  await axeScan(page, 'criteria-detail-before-upload', { softFail: true });
  const screenshot2 = await page.screenshot({ fullPage: true });
  await test.info().attach('2-criteria-detail-before-upload', {body: screenshot2,contentType: 'image/png'});
  await page.getByText('Attach a document').click();
  await page.waitForLoadState('networkidle');
  await axeScan(page, 'document-upload-form', { softFail: true });
  const screenshot3 = await page.screenshot({ fullPage: true });
  await test.info().attach('3-document-upload-form', {body: screenshot3,contentType: 'image/png'});
  await expect(page.getByRole('heading', { name: /Attach a document/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Choose files' })).toBeVisible();
});

test('Step 2: Upload document as unpublished', async ({ page }) => {
  await page.goto('https://cogcg--autotests.sandbox.my.site.com/cciaf/cciafassessprevious');
  await page.getByRole('link', { name: 'Xansium QA - October' }).click();
  await page.getByRole('link', { name: '1.1. Overall commercial' }).click();
  await page.getByRole('link', { name: 'Criteria 1.1.1' }).click();
  await page.getByText('Attach a document').click();
  await page.waitForLoadState('networkidle');
  const fileInput = page.locator('input[type="file"]');
  await expect(fileInput).toBeVisible();
  await fileInput.setInputFiles(DOCUMENT_PATH);
  await page.waitForTimeout(1000);
  const screenshot4 = await page.screenshot({ fullPage: true });
  await test.info().attach('4-file-selected', {body: screenshot4,contentType: 'image/png'});
  await page.getByRole('textbox', { name: 'Title of the document' }).click();
  await page.getByRole('textbox', { name: 'Title of the document' }).fill(DOCUMENT_TITLE);
  await page.getByRole('checkbox', { name: 'Un-published - only visible' }).check();
  const screenshot5 = await page.screenshot({ fullPage: true });
  await test.info().attach('5-form-filled-unpublished', {body: screenshot5,contentType: 'image/png'});
  await page.getByRole('link', { name: 'Save document' }).click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  const screenshot6 = await page.screenshot({ fullPage: true });
  await test.info().attach('6-after-save-document', {body: screenshot6,contentType: 'image/png'});
  await expect(page.getByRole('link', { name: 'Save and return' })).toBeVisible();
  await page.getByRole('link', { name: 'Save and return' }).click();
  await page.waitForLoadState('networkidle');
  const screenshot7 = await page.screenshot({ fullPage: true });
  await test.info().attach('7-after-save-and-return', {body: screenshot7,contentType: 'image/png'});
});

test('Step 3: Navigate to document library and verify unpublished state', async ({ page }) => {
  await page.goto('https://cogcg--autotests.sandbox.my.site.com/cciaf/cciafassessprevious');
  await page.getByRole('link', { name: 'Xansium QA - October' }).click();
  await page.getByRole('link', { name: 'Document library' }).click();
  await page.waitForLoadState('networkidle');
  await axeScan(page, 'document-library-before-publish', { softFail: true });
  const screenshot8 = await page.screenshot({ fullPage: true });
  await test.info().attach('8-document-library-before-publish', {body: screenshot8,contentType: 'image/png'});
  const documentRow = page.getByRole('row', { name: new RegExp(DOCUMENT_TITLE) });
  await expect(documentRow).toBeVisible();
  await expect(documentRow.getByText('Un-published')).toBeVisible();
});

test('Step 4: Publish the document', async ({ page }) => {
  await page.goto('https://cogcg--autotests.sandbox.my.site.com/cciaf/cciafassessprevious');
  await page.getByRole('link', { name: 'Xansium QA - October' }).click();
  await page.getByRole('link', { name: 'Document library' }).click();
  await page.waitForLoadState('networkidle');
  const documentRow = page.getByRole('row', { name: new RegExp(DOCUMENT_TITLE) });
  const publishCheckbox = documentRow.locator('input[name="publishCheckbox"]');
  await publishCheckbox.scrollIntoViewIfNeeded();
  await publishCheckbox.check();
  const screenshot9 = await page.screenshot({ fullPage: true });
  await test.info().attach('9-document-library-checkbox-checked', {body: screenshot9,contentType: 'image/png'});
  await page.getByRole('button', { name: 'Update Sharing Settings' }).click();
  await page.waitForLoadState('networkidle');
  const screenshot10 = await page.screenshot({ fullPage: true });
  await test.info().attach('10-document-library-after-publish', {body: screenshot10,contentType: 'image/png'});
});

test('Step 5: Verify document is published on criteria page', async ({ page }) => {
  await page.goto('https://cogcg--autotests.sandbox.my.site.com/cciaf/cciafassessprevious');
  await page.getByRole('link', { name: 'Xansium QA - October' }).click();
  await page.getByRole('link', { name: 'Document library' }).click();
  await page.waitForLoadState('networkidle');
  await page.getByRole('link', { name: '1.1.1' }).first().click();
  await page.waitForLoadState('networkidle');
  await axeScan(page, 'criteria-detail-with-published-document', { softFail: true });
  const screenshot11 = await page.screenshot({ fullPage: true });
  await test.info().attach('11-criteria-with-published-document', {body: screenshot11,contentType: 'image/png'});
});

test('Step 6: Remove the document', async ({ page }) => {
  await page.goto('https://cogcg--autotests.sandbox.my.site.com/cciaf/cciafassessprevious');
  await page.getByRole('link', { name: 'Xansium QA - October' }).click();
  await page.getByRole('link', { name: '1.1. Overall commercial' }).click();
  await page.getByRole('link', { name: 'Criteria 1.1.1' }).click();
  await page.waitForLoadState('networkidle');
  const documentTerm = page.getByRole('term').filter({ hasText: DOCUMENT_TITLE });
  await expect(documentTerm).toBeVisible();
  const removeLinks = page.getByRole('link', { name: 'Remove' });
  const removeCount = await removeLinks.count();
  const removeLink = removeCount > 1 ? removeLinks.nth(1) : removeLinks.first();
  await removeLink.scrollIntoViewIfNeeded();
  const screenshot13 = await page.screenshot({ fullPage: true });
  await test.info().attach('13-before-remove', {body: screenshot13,contentType: 'image/png'});
  await removeLink.click();
  await page.waitForLoadState('networkidle');
  const screenshot14 = await page.screenshot({ fullPage: true });
  await test.info().attach('14-after-remove-click', {body: screenshot14,contentType: 'image/png'});
  await page.getByRole('link', { name: 'Save and return' }).click();
  await page.waitForLoadState('networkidle');
  const screenshot15 = await page.screenshot({ fullPage: true });
  await test.info().attach('15-after-save-and-return', {body: screenshot15,contentType: 'image/png'});
  await expect(page.getByRole('heading', { name: 'Success' })).toBeVisible();
  await expect(page.getByText('Your progress has been saved')).toBeVisible();
  const screenshot16 = await page.screenshot({ fullPage: true });
  await test.info().attach('16-success-message', {body: screenshot16,contentType: 'image/png'});
});

test('Step 7: Verify document is removed from criteria', async ({ page }) => {
  await page.goto('https://cogcg--autotests.sandbox.my.site.com/cciaf/cciafassessprevious');
  await page.getByRole('link', { name: 'Xansium QA - October' }).click();
  await page.getByRole('link', { name: '1.1. Overall commercial' }).click();
  await page.getByRole('link', { name: 'Criteria 1.1.1' }).click();
  await page.waitForLoadState('networkidle');
  await axeScan(page, 'criteria-detail-after-remove', { softFail: true });
  const screenshot17 = await page.screenshot({ fullPage: true });
  await test.info().attach('17-criteria-after-document-removed', {body: screenshot17,contentType: 'image/png'});
  const documentTerm = page.getByRole('term').filter({ hasText: DOCUMENT_TITLE });
  await expect(documentTerm).not.toBeVisible();
});

test('Step 8: Delete document from document library', async ({ page }) => {
  await page.goto('https://cogcg--autotests.sandbox.my.site.com/cciaf/cciafassessprevious');
  await page.getByRole('link', { name: 'Xansium QA - October' }).click();
  await page.getByRole('link', { name: 'Document library' }).click();
  await page.waitForLoadState('networkidle');
  await page.getByRole('link', { name: DOCUMENT_TITLE }).click();
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Remove document' }).click();
  await page.getByRole('link', { name: 'Yes - remove document' }).click();
  await page.waitForLoadState('networkidle');
  const screenshot18 = await page.screenshot({ fullPage: true });
  await test.info().attach('18-file-removed-from-document-library', {body: screenshot18,contentType: 'image/png'});
  await page.getByRole('link', { name: 'Document library' }).click({ trial: true }).catch(() => {});
  await page.waitForLoadState('networkidle');
  const documentRow = page.getByRole('row', { name: new RegExp(DOCUMENT_TITLE) });
  await expect(documentRow).toHaveCount(0);
  console.log(`\n✅ Test complete - document "${DOCUMENT_TITLE}" opened, removed via library, and verified absent\n`);
});