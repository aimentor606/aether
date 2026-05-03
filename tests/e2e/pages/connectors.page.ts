import { expect, type Locator, type Page } from '@playwright/test';

export class ConnectorsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly searchInput: Locator;
  readonly availableAppsGrid: Locator;
  readonly connectedSection: Locator;
  readonly connectorRegistry: Locator;
  readonly appCards: Locator;
  readonly connectButtons: Locator;
  readonly emptyState: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByText('Connectors', { exact: false }).first();
    this.searchInput = page.locator('input[placeholder*="Search apps"]');
    this.availableAppsGrid = page.getByText('Available Apps', { exact: false }).first();
    this.connectedSection = page.getByText('Connected', { exact: false }).first();
    this.connectorRegistry = page.getByText('Your Connectors', { exact: false }).first();
    this.appCards = page.locator('[class*="grid"] [class*="spotlight-card"], [class*="grid"] [class*="bg-card"]').filter({ has: page.locator('h3') });
    this.connectButtons = page.getByRole('button', { name: /Connect/i });
    this.emptyState = page.getByText(/No apps found|No channels yet/i).first();
  }

  async goto() {
    await this.page.goto('/connectors');
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  async assertLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 15_000 });
  }

  async searchApps(query: string) {
    await this.searchInput.fill(query);
  }

  async getConnectedCount(): Promise<number> {
    const connectedSection = this.page.locator('div').filter({ hasText: /^Connected$/ }).first();
    const badge = connectedSection.locator('[class*="badge"], [data-slot="badge"]');
    const isVisible = await badge.isVisible({ timeout: 3_000 }).catch(() => false);
    if (!isVisible) return 0;
    const text = await badge.textContent();
    return parseInt(text ?? '0', 10) || 0;
  }
}
