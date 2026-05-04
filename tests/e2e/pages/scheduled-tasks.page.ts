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
    this.heading = page.getByTestId('triggers-heading');
    this.taskList = page.getByTestId('task-list');
    this.taskCards = page.getByTestId('task-card');
    this.createButton = page.getByTestId('create-trigger-button');
    this.searchInput = page.getByTestId('triggers-search');
    this.emptyState = page.getByTestId('triggers-empty');
    this.detailPanel = page.getByTestId('task-detail');
  }

  async goto() {
    await this.page.goto('/scheduled-tasks');
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  async assertLoaded() {
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
