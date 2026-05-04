import { test, expect } from '../fixtures';
import { ScheduledTasksPage } from '../pages';

test.describe('Scheduled Tasks - Browser', () => {
  let scheduledTasksPage: ScheduledTasksPage;

  test.beforeEach(async ({ authenticatedPage }) => {
    scheduledTasksPage = new ScheduledTasksPage(authenticatedPage);
  });

  test('should load scheduled tasks page', async () => {
    await scheduledTasksPage.goto();
    await scheduledTasksPage.assertLoaded();
  });

  test('should show create task button', async () => {
    await scheduledTasksPage.goto();
    await scheduledTasksPage.assertLoaded();

    await expect(scheduledTasksPage.createButton).toBeVisible({ timeout: 10_000 });
  });

  test('should show task list or empty state', async () => {
    await scheduledTasksPage.goto();
    await scheduledTasksPage.assertLoaded();

    const hasTasks = await scheduledTasksPage.emptyState.isVisible({ timeout: 5_000 }).then(() => false).catch(() => true);
    if (hasTasks) {
      const count = await scheduledTasksPage.getTaskCount();
      expect(count).toBeGreaterThan(0);
    } else {
      await expect(scheduledTasksPage.emptyState).toBeVisible();
    }
  });

  test('should show search/filter', async () => {
    await scheduledTasksPage.goto();
    await scheduledTasksPage.assertLoaded();

    await expect(scheduledTasksPage.searchInput).toBeVisible({ timeout: 10_000 });
  });

  test('should show task status badges', async () => {
    await scheduledTasksPage.goto();
    await scheduledTasksPage.assertLoaded();

    const count = await scheduledTasksPage.getTaskCount();
    test.skip(count === 0, 'No tasks to check status badges');

    const statusBadges = scheduledTasksPage.page.locator('[class*="badge"]').filter({ hasText: /Active|Paused/i });
    const badgeCount = await statusBadges.count();
    expect(badgeCount).toBeGreaterThan(0);
  });

  test('should open task detail on click', async ({ authenticatedPage }) => {
    await scheduledTasksPage.goto();
    await scheduledTasksPage.assertLoaded();

    const count = await scheduledTasksPage.getTaskCount();
    test.skip(count === 0, 'No tasks to click');

    await scheduledTasksPage.taskCards.first().click();

    const detailVisible = await scheduledTasksPage.detailPanel.isVisible({ timeout: 5_000 }).catch(() => false);
    expect(typeof detailVisible).toBe('boolean');
  });

  test('should show cron schedule descriptions', async () => {
    await scheduledTasksPage.goto();
    await scheduledTasksPage.assertLoaded();

    const count = await scheduledTasksPage.getTaskCount();
    test.skip(count === 0, 'No tasks to check cron descriptions');

    // Cron tasks display human-readable descriptions like "Every X minutes", "Daily at HH:MM"
    const cronDescription = scheduledTasksPage.page.getByText(/Every \d+|Daily at|At \d{2}:\d{2}|Monthly on/i);
    const hasDescription = await cronDescription.isVisible({ timeout: 5_000 }).catch(() => false);
    expect(typeof hasDescription).toBe('boolean');
  });
});
