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
    this.heading = page.getByRole('heading', { name: /Usage Dashboard/i });
    this.periodSelector = page.locator('[role="tablist"]').filter({ hasText: /days/i });
    this.statCards = page.locator('[class*="card"]').filter({ has: page.locator('[class*="font-medium"]') });
    this.chart = page.locator('.recharts-area-chart').or(page.locator('[data-chart-container]'));
    this.noDataState = page.getByText(/Usage metering not configured/i);
  }

  async goto() {
    await this.page.goto('/usage');
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  async assertLoaded() {
    // Page is loaded when either the heading or the no-data fallback is visible
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
    this.heading = page.getByRole('heading', { name: /Versions/i });
    this.currentVersion = page.getByText(/Running/i).locator('..');
    this.filterTabs = page.locator('[data-state]').filter({ hasText: /All|Stable|Dev/ });
    this.versionCards = page.locator('[class*="card"]').filter({ has: page.locator('span.font-mono') });
    this.devToggle = page.getByRole('button', { name: /Dev builds|Hide dev builds/i });
    this.updateAvailable = page.getByRole('button', { name: /Update to/i });
  }

  async goto() {
    await this.page.goto('/changelog');
    await this.heading.waitFor({ timeout: 15_000 }).catch(() => {});
  }

  async assertLoaded() {
    const hasHeading = await this.heading.isVisible({ timeout: 15_000 }).catch(() => false);
    if (!hasHeading) {
      // Fallback: any content rendered on the changelog route
      await expect(this.page.locator('body')).toContainText(/Versions|version history/i);
    }
  }
}
