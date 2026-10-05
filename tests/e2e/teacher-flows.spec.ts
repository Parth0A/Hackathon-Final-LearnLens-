import { test, expect } from '@playwright/test';
import { login, TEACHER } from './support';

test.describe('teacher flows', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, TEACHER, "teacher");
  });

  test('teacher launcher shows the feature grid', async ({ page }) => {
    await expect(page.getByTestId('home-feature-grid')).toBeVisible();
    await expect(page.getByTestId('home-feature-teacher')).toBeVisible();
    await expect(page.getByTestId('home-feature-classrooms')).toBeVisible();
  });

  test('teacher dashboard loads live class analytics', async ({ page }) => {
    await page.getByTestId('home-feature-teacher').click();

    await expect(page.getByTestId('teacher-radar-view')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('overview-students-enrolled')).toBeVisible();
    await expect(page.getByTestId('overview-class-mastery')).toBeVisible();
    await expect(page.getByTestId('student-activity-section')).toBeVisible();
    await expect(page.getByTestId('common-gaps-card')).toBeVisible();

    // Values come from the API — they must be populated, not placeholders.
    await expect(page.getByTestId('overview-students-enrolled')).not.toContainText('—');
  });

  test('teacher can create a classroom and get a join code', async ({ page }) => {
    test.setTimeout(120_000);
    const roomName = `E2E Room ${Date.now()}`;

    await page.getByTestId('home-feature-classrooms').click();
    await expect(page.getByTestId('classrooms-view')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('classrooms-title')).toHaveText('Manage your classrooms.');
    await expect(page.getByTestId('create-classroom-card')).toBeVisible();

    await page.getByTestId('classroom-name-input').fill(roomName);
    await page.getByTestId('classroom-subject-input').fill('Data Structures');
    await page.getByTestId('classroom-division-input').fill('E2E');
    await page.getByTestId('classroom-year-input').fill('2026');
    await page.getByTestId('create-classroom-button').click();

    const entry = page.getByTestId(/classroom-select-/).filter({ hasText: roomName });
    await expect(entry.first()).toBeVisible({ timeout: 20_000 });
    await entry.first().click();

    // Detail panel exposes the one-time join code the student flow needs.
    await expect(page.getByTestId('classroom-detail-card')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('active-classroom-name')).toHaveText(roomName);
    await expect(page.getByTestId('classroom-join-code')).toHaveText(/^[A-Z0-9]{7}$/);
    await expect(page.getByTestId('classroom-join-link')).toContainText('/join/');
    await expect(page.getByTestId('classroom-roster-card')).toBeVisible();
  });
});
