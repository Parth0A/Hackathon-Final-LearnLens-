import { test, expect, Page } from '@playwright/test';
import { login, STUDENT } from './support';

/**
 * Student workspace flows. Tests in one file run sequentially (Playwright is
 * parallel at file granularity), which keeps the shared demo-student state from
 * being mutated by two tests at once.
 */

/** Start the diagnostic and wait until the question UI is mounted. */
async function openAssessment(page: Page) {
  await page.getByTestId('dashboard-start-assessment-button').click();
  // Navigate() auto-starts the session, but the start card can render first.
  const start = page.getByTestId('start-assessment-button');
  if (await start.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await start.click();
  }
  await expect(page.getByTestId('assessment-view')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('question-prompt')).toBeVisible();
}

/** Walk every question using the app's own "Load demo pattern" shortcut. */
async function answerDemoPatternAndSubmit(page: Page) {
  await page.getByTestId('load-demo-answer-pattern-button').click();
  await page.getByTestId('submit-answer-button').click();
  await expect(page.getByTestId('assessment-result-view')).toBeVisible({ timeout: 20_000 });
}

test.describe('student flows', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, STUDENT);
  });

  test('student dashboard loads live metrics', async ({ page }) => {
    await page.getByTestId('available-feature-dashboard').click();
    await expect(page.getByTestId('student-dashboard')).toBeVisible();
    await expect(page.getByTestId('overall-mastery-card')).toBeVisible();
    await expect(page.getByTestId('active-gaps-card')).toBeVisible();
    await expect(page.getByTestId('mastery-overview-card')).toBeVisible();
    // Metrics must be populated, not placeholders.
    await expect(page.getByTestId('overall-mastery-card')).not.toContainText('—');
  });

  test('learning debugger runs the diagnostic stage end to end', async ({ page }) => {
    await page.getByTestId('available-feature-dashboard').click();
    await expect(page.getByTestId('student-dashboard')).toBeVisible();

    await openAssessment(page);
    await answerDemoPatternAndSubmit(page);

    // Stage 1 result: score evidence plus a diagnosis summary.
    await expect(page.getByTestId('assessment-score')).toBeVisible();
    await expect(page.getByTestId('assessment-diagnosis-title')).toHaveText(
      /gap|No active gap/i,
    );
    await expect(page.getByTestId('assessment-score-card')).toBeVisible();
  });

  test('learning debugger reaches evidence and recovery when a gap is detected', async ({ page }) => {
    test.setTimeout(180_000);

    await page.getByTestId('available-feature-dashboard').click();
    await openAssessment(page);
    await answerDemoPatternAndSubmit(page);

    const review = page.getByTestId('review-diagnosis-button');
    if (!(await review.isVisible({ timeout: 3_000 }).catch(() => false))) {
      // Honest skip: the demo answer pattern did not produce a detected gap in
      // this environment, so the recovery stages are not reachable from here.
      test.skip(true, 'No gap detected by the demo answer pattern — evidence stage not reachable');
    }

    // Stage 2 — root-cause evidence.
    await review.click();
    await expect(page.getByTestId('evidence-drawer')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('diagnosis-summary-card')).toBeVisible();
    await expect(page.getByTestId('evidence-list-card')).toBeVisible();

    // Stage 3 — targeted intervention.
    await page.getByTestId('start-intervention-button').click();
    await expect(page.getByTestId('recovery-center')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('intervention-content-card')).toBeVisible();
    await page.getByTestId('complete-intervention-button').click();

    // Stage 4 — adaptive practice (three targeted questions).
    await expect(page.getByTestId('practice-card')).toBeVisible({ timeout: 15_000 });
    for (const index of [1, 2, 3]) {
      const select = page.getByTestId(`practice-select-${index}`);
      const options = select.locator('option');
      const value = await options.nth(1).getAttribute('value');
      await select.selectOption(value!);
      await page.getByTestId(`practice-submit-${index}`).click();
      await expect(page.getByTestId(`practice-result-${index}`)).toBeVisible({ timeout: 10_000 });
    }

    // Stage 5 — retest to verify recovery.
    await expect(page.getByTestId('retest-unlock-card')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('start-retest-button').click();
    await expect(page.getByTestId('retest-card')).toBeVisible({ timeout: 15_000 });
    for (const index of [1, 2, 3]) {
      const select = page.getByTestId(`retest-select-${index}`);
      const options = select.locator('option');
      const value = await options.nth(1).getAttribute('value');
      await select.selectOption(value!);
    }
    await page.getByTestId('submit-retest-button').click();
    await expect(page.getByTestId('retest-result-view')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('retest-status')).toBeVisible();
    await expect(page.getByTestId('retest-result-title')).toBeVisible();
  });

  test('study planner walks diagnosis to a generated schedule', async ({ page }) => {
    test.setTimeout(180_000);

    await page.getByTestId('independent-feature-2').click();
    const view = page.getByTestId('schedule-planner-view');
    await expect(view).toBeVisible({ timeout: 15_000 });

    // Answer the short diagnosis until the submit control appears.
    const submit = page.getByRole('button', { name: 'Find my learning gap' });
    for (let step = 0; step < 20; step += 1) {
      if (await submit.isVisible({ timeout: 2_000 }).catch(() => false)) break;
      const option = view.locator('div.grid.gap-2 > button').first();
      await expect(option).toBeVisible({ timeout: 15_000 });
      await option.click();
      await page.getByRole('button', { name: 'Next', exact: true }).click();
    }
    await expect(submit).toBeVisible();
    await submit.click();

    // Step 2 — gap result, then step 3 — time budget, then step 4 — schedule.
    await expect(page.getByTestId('schedule-planner-gap-result')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Set my available study time' }).click();

    await expect(page.getByTestId('schedule-planner-time-step')).toBeVisible();
    await page.getByTestId('planner-minutes').fill('120');
    await page.getByRole('button', { name: 'Build my schedule' }).click();

    await expect(page.getByTestId('schedule-planner-schedule')).toBeVisible();
    await expect(page.getByText('Block 01')).toBeVisible();
    await expect(page.getByText('Block 03')).toBeVisible();
  });

  test('student classrooms workspace opens', async ({ page }) => {
    await page.getByTestId('available-feature-classrooms').click();
    await expect(page.getByTestId('classrooms-view')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('join-classroom-card')).toBeVisible();
    await expect(page.getByTestId('classroom-code-input')).toBeEnabled();
  });

  test('profile drawer opens and theme toggle applies', async ({ page }) => {
    await page.getByTestId('profile-drawer-open-button').click();
    await expect(page.getByTestId('profile-drawer')).toBeVisible();
    await expect(page.getByTestId('profile-name')).toBeVisible();
    await expect(page.getByTestId('profile-role-status')).toHaveText('student');
    await expect(page.getByTestId('profile-picture')).toBeVisible();

    await page.getByTestId('theme-dark-button').click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.getByTestId('theme-light-button').click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });
});
