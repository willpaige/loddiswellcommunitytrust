import { test, expect } from '@playwright/test';

test('autosave, conditional 9 MB upload, completion receipt and reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('radio', { name: 'Yes', exact: true }).check();
  await expect(page.getByText('Document required:', { exact: false })).toBeVisible();
  await page.getByLabel('Purpose', { exact: true }).fill('Village event');
  await page.getByLabel('Purpose', { exact: true }).blur();
  await expect(page.getByText('2 of 2 questions saved', { exact: false })).toBeVisible();
  await page.getByLabel('Upload Insurance document').setInputFiles({ name: 'insurance.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(9 * 1024 * 1024, 1) });
  await page.getByRole('button', { name: 'Upload document', exact: true }).click();
  await expect(page.getByText('Required information complete — ready for hire')).toBeVisible();
  expect(await page.evaluate(() => window.uploadedBytes)).toBe(9 * 1024 * 1024);
  await page.reload(); await expect(page.getByText('Required information complete — ready for hire')).toBeVisible();
  await page.getByRole('button', { name: 'Remove insurance.pdf' }).click();
  await expect(page.getByText('Document still needed', { exact: true })).toBeVisible();
  await expect(page.getByText('Required information complete — ready for hire')).not.toBeVisible();
  await page.getByRole('radio', { name: 'No', exact: true }).check();
  await expect(page.getByText('Required information complete — ready for hire')).toBeVisible();
});

test('save and upload failures can be retried without a false completion receipt', async ({ page }) => {
  await page.goto('/'); await page.evaluate(() => { window.failNextSave = true; });
  await page.getByRole('radio', { name: 'Yes', exact: true }).check();
  await expect(page.getByRole('alert')).toContainText('could not be saved');
  await page.getByRole('button', { name: 'Save answers', exact: true }).click();
  await expect(page.getByText('1 of 2 questions saved', { exact: false })).toBeVisible();
  await page.getByLabel('Purpose', { exact: true }).fill('Party'); await page.getByLabel('Purpose', { exact: true }).blur();
  await expect(page.getByText('2 of 2 questions saved', { exact: false })).toBeVisible();
  await page.getByLabel('Upload Insurance document').setInputFiles({ name: 'insurance.pdf', mimeType: 'application/pdf', buffer: Buffer.from('pdf') });
  await page.evaluate(() => { window.failNextUpload = true; });
  await page.getByRole('button', { name: 'Upload document', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('document could not be saved');
  await expect(page.getByText('Required information complete — ready for hire')).not.toBeVisible();
  await page.getByLabel('Upload Insurance document').setInputFiles({ name: 'insurance.pdf', mimeType: 'application/pdf', buffer: Buffer.from('pdf') });
  await page.getByRole('button', { name: 'Upload document', exact: true }).click();
  await expect(page.getByText('Required information complete — ready for hire')).toBeVisible();
});
