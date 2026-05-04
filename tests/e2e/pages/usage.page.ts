import { expect, type Locator, type Page } from '@playwright/test';

export class UsagePage {
  readonly page: Page;
  readonly heading: Locator;
  readonly periodSelector: Locator;
  readonly statCards: Locator;
  readonly chart: Locator;
  readonly noDataState: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByTestId('usage-heading');
    this.periodSelector = page.getByTestId('period-selector');
    this.statCards = page.getByTestId('stat-card');
    this.chart = page.getByTestId('usage-chart');
    this.noDataState = page.getByTestId('usage-no-data');
  }

  async goto() {
    await this.page.goto('/usage');
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  async assertLoaded() {
    const hasHeading = await this.heading.isVisible({ timeout: 15_000 }).catch(() => false);
    if (!hasHeading) {
      await expect(this.noDataState).toBeVisible({ timeout: 10_000 });
    }
  }
}

export class ChangelogPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly currentVersion: Locator;
  readonly filterTabs: Locator;
  readonly versionCards: Locator;
  readonly devToggle: Locator;
  readonly updateAvailable: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByTestId('changelog-heading');
    this.currentVersion = page.getByTestId('current-version');
    this.filterTabs = page.getByTestId('version-filter');
    this.versionCards = page.getByTestId('version-card');
    this.devToggle = page.getByTestId('dev-toggle');
    this.updateAvailable = page.getByRole('button', { name: /Update to/i });
  }

  async goto() {
    await this.page.goto('/changelog');
    await this.heading.waitFor({ timeout: 15_000 }).catch(() => {});
  }

  async assertLoaded() {
    const hasHeading = await this.heading.isVisible({ timeout: 15_000 }).catch(() => false);
    if (!hasHeading) {
      await expect(this.page.locator('body')).toContainText(/Versions|version history/i);
    }
  }
}
