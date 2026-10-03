import { test, expect } from '@playwright/test';

test('login page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('login-page')).toBeVisible();
  await expect(page.getByRole('heading', { name: /one size doesn’t fit all/i })).toBeVisible();
});
