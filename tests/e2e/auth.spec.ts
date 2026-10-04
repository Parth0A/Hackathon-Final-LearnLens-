import { test, expect } from '@playwright/test';
import { gotoLogin, login, logout, STUDENT } from './support';

test.describe('authentication', () => {
  test('login page renders the sign-in form', async ({ page }) => {
    await gotoLogin(page);
    await expect(page.getByTestId('auth-email-input')).toBeVisible();
    await expect(page.getByTestId('auth-password-input')).toBeVisible();
    await expect(page.getByTestId('auth-submit-button')).toBeVisible();
  });

  test('invalid credentials surface an error and do not create a session', async ({ page }) => {
    await gotoLogin(page);
    await page.getByTestId('auth-email-input').fill('nobody@example.com');
    await page.getByTestId('auth-password-input').fill('WrongPassword123!');
    await page.getByTestId('auth-submit-button').click();
    await expect(page.getByTestId('auth-error')).toBeVisible({ timeout: 10_000 });

    const session = await page.request.get('/api/auth/session');
    expect(session.status()).toBe(200);
    expect(await session.json()).toBeNull();
  });

  test('student can sign in and sign out', async ({ page }) => {
    await login(page, STUDENT);
    await logout(page);
  });

  test('session persists across a page reload', async ({ page }) => {
    await login(page, STUDENT);

    const before = await page.request.get('/api/auth/session');
    expect(before.status()).toBe(200);
    const user = await before.json();
    expect(user.email).toBe(STUDENT.email);
    expect(user.role).toBe('student');

    await page.reload();
    await expect(page.getByTestId('home-launcher')).toBeVisible({ timeout: 15_000 });

    const after = await page.request.get('/api/auth/session');
    expect(await after.json()).toMatchObject({ email: STUDENT.email });
  });

  test('logout clears the session and protected routes return to login', async ({ page }) => {
    await login(page, STUDENT);
    await expect(page.getByTestId('home-launcher')).toBeVisible();

    await logout(page);

    // The httpOnly cookie is gone, so the session endpoint reports no user and
    // the client is bounced back to the sign-in screen after a reload.
    const session = await page.request.get('/api/auth/session');
    expect(session.status()).toBe(200);
    expect(await session.json()).toBeNull();

    const protectedRoute = await page.request.get('/api/auth/me');
    expect(protectedRoute.status()).toBe(401);

    await page.reload();
    await expect(page.getByTestId('login-page')).toBeVisible({ timeout: 15_000 });
  });
});
