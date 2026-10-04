import { test, expect } from '@playwright/test';
import { login, STUDENT } from './support';

test.describe('library flow', () => {
  test.beforeEach(async ({ page }) => {
    // Library delete uses window.confirm(); accept it for the whole test.
    page.on('dialog', (dialog) => void dialog.accept());
    await login(page, STUDENT);
  });

  test('library opens and reports MongoDB GridFS storage as connected', async ({ page }) => {
    await page.getByTestId('independent-feature-0').click();

    await expect(page.getByTestId('library-view')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('library-title')).toHaveText('Your Library.');
    await expect(page.getByTestId('storage-provider')).toContainText('GridFS');
    await expect(page.getByTestId('storage-connection-badge')).toHaveText('Connected');
    await expect(page.getByTestId('storage-message')).toBeVisible();

    // Storage is enabled, so the upload control must not be disabled.
    await expect(page.getByTestId('upload-file-button')).toBeEnabled();
    await expect(page.getByTestId('create-note-button')).toBeEnabled();
  });

  test('library note can be created, previewed and deleted', async ({ page }) => {
    test.setTimeout(120_000);
    const stamp = Date.now();
    const noteName = `E2E note ${stamp}`;
    const noteBody = `Playwright created this note at ${stamp}.`;

    await page.getByTestId('independent-feature-0').click();
    await expect(page.getByTestId('library-view')).toBeVisible({ timeout: 15_000 });

    // Create.
    await page.getByTestId('create-note-button').click();
    await page.getByTestId('note-name-input').fill(noteName);
    await page.getByTestId('note-content-input').fill(noteBody);
    await page.getByTestId('save-note-button').click();

    const card = page
      .locator('div[data-testid^="library-item-"]:not([data-testid^="library-item-name-"])')
      .filter({ hasText: noteName });
    await expect(card).toBeVisible({ timeout: 20_000 });

    // Preview renders the stored content.
    await card.locator('button[aria-label^="Preview"]').click();
    await expect(page.getByTestId('library-preview-panel')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('note-preview-content')).toContainText(noteBody);
    await page.getByTestId('close-preview-button').click();
    await expect(page.getByTestId('library-preview-panel')).toHaveCount(0);

    // Delete (the app asks for confirmation) and verify it is gone.
    await card.locator('button[aria-label^="Delete"]').click();
    await expect(card).toHaveCount(0, { timeout: 20_000 });

    // Reload to prove the deletion persisted on the server, not just in memory.
    await page.reload();
    await page.getByTestId('independent-feature-0').click();
    await expect(page.getByTestId('library-view')).toBeVisible({ timeout: 15_000 });
    await expect(
      page
        .locator('div[data-testid^="library-item-"]:not([data-testid^="library-item-name-"])')
        .filter({ hasText: noteName }),
    ).toHaveCount(0, { timeout: 15_000 });
  });
});
