import { Page, expect } from '@playwright/test';

export const STUDENT = {
  email: process.env.DEMO_STUDENT_EMAIL ?? 'student@learnlens.demo',
  password: process.env.DEMO_STUDENT_PASSWORD ?? 'LearnLens#Student1',
};

export const TEACHER = {
  email: process.env.DEMO_TEACHER_EMAIL ?? 'teacher@learnlens.demo',
  password: process.env.DEMO_TEACHER_PASSWORD ?? 'LearnLens#Teacher1',
};

export async function gotoLogin(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('login-page')).toBeVisible();
}

export async function login(page: Page, creds: { email: string; password: string }, role: "student" | "teacher" = "student") {
  await gotoLogin(page);
  await page.getByTestId('auth-email-input').fill(creds.email);
  await page.getByTestId('auth-password-input').fill(creds.password);
  if (role === "teacher") {
    await page.getByTestId("auth-role-teacher").click();
  }
  await page.getByTestId('auth-submit-button').click();
  await expect(page.getByTestId('home-launcher')).toBeVisible({ timeout: 15_000 });
}

export async function logout(page: Page) {
  await page.getByTestId('profile-drawer-open-button').click();
  await expect(page.getByTestId('profile-drawer')).toBeVisible();
  await page.getByTestId('profile-logout-button').click();
  await expect(page.getByTestId('login-page')).toBeVisible({ timeout: 15_000 });
}
