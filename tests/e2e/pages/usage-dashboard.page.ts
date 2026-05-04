import { expect, type Locator, type Page } from '@playwright/test';

export class UsageDashboardPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly subtitle: Locator;
  readonly periodSelector: Locator;
  readonly periodTabs: Locator;
  readonly tab7d: Locator;
  readonly tab30d: Locator;
  readonly tab90d: Locator;
  readonly statCards: Locator;
  readonly totalTokensCard: Locator;
  readonly dailyAvgCard: Locator;
  readonly activeDaysCard: Locator;
  readonly chart: Locator;
  readonly chartTitle: Locator;
  readonly noDataState: Locator;
  readonly noDataMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByTestId('usage-heading');
    this.subtitle = page.getByText('LLM token consumption over time');
    this.periodSelector = page.getByTestId('period-selector');
    this.periodTabs = this.periodSelector.locator('[role="tab"]');
    this.tab7d = this.periodSelector.locator('[role="tab"]').filter({ hasText: '7 days' });
    this.tab30d = this.periodSelector.locator('[role="tab"]').filter({ hasText: '30 days' });
    this.tab90d = this.periodSelector.locator('[role="tab"]').filter({ hasText: '90 days' });
    this.statCards = page.getByTestId('stat-card');
    this.totalTokensCard = page.getByText('Total Tokens').locator('..');
    this.dailyAvgCard = page.getByText('Daily Average').locator('..');
    this.activeDaysCard = page.getByText('Active Days').locator('..');
    this.chart = page.getByTestId('usage-chart');
    this.chartTitle = page.getByText('Daily Token Usage');
    this.noDataState = page.getByTestId('usage-no-data');
    this.noDataMessage = page.getByText('Usage metering not configured');
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

  async hasMeteredData(): Promise<boolean> {
    return !(await this.noDataState.isVisible({ timeout: 5_000 }).catch(() => false));
  }

  async getStatCardValue(label: string): Promise<string> {
    const card = this.page.locator('[data-testid="stat-card"]').filter({ hasText: label });
    const valueEl = card.locator('.text-2xl');
    return valueEl.innerText({ timeout: 10_000 });
  }

  async getActiveTab(): Promise<string> {
    const active = this.periodSelector.locator('[data-state="active"]');
    return active.innerText({ timeout: 5_000 });
  }
}
