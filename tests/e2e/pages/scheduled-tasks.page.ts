import { expect, type Locator, type Page } from '@playwright/test';

export class ScheduledTasksPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly taskList: Locator;
  readonly taskCards: Locator;
  readonly createButton: Locator;
  readonly searchInput: Locator;
  readonly emptyState: Locator;
  readonly detailPanel: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByText('Triggers');
    this.taskList = page.locator('.space-y-4').filter({ has: page.locator('[role="button"]') });
    this.taskCards = page.locator('[role="button"][aria-label="View task details"]');
    this.createButton = page.getByRole('button', { name: /Add Trigger|Add/i });
    this.searchInput = page.locator('input[placeholder*="Search triggers"]');
    this.emptyState = page.getByText(/Create a trigger/i);
    this.detailPanel = page.locator('.border-l').filter({ has: page.getByText(/Details|Schedule|History/i) });
  }

  async goto() {
    await this.page.goto('/scheduled-tasks');
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  async assertLoaded() {
    // Page is loaded when either the heading or the create button is visible
    const hasHeading = await this.heading.first().isVisible({ timeout: 15_000 }).catch(() => false);
    if (!hasHeading) {
      await expect(this.createButton).toBeVisible({ timeout: 10_000 });
    }
  }

  async getTaskCount(): Promise<number> {
    if (await this.emptyState.isVisible({ timeout: 3_000 }).catch(() => false)) return 0;
    return this.taskCards.count();
  }
}
