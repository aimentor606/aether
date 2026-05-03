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
    this.heading = page.getByTestId('connectors-heading');
    this.searchInput = page.getByTestId('connectors-search');
    this.availableAppsGrid = page.getByTestId('available-apps');
    this.connectedSection = page.getByTestId('connected-section');
    this.connectorRegistry = page.getByTestId('connector-registry');
    this.appCards = page.getByTestId('app-card');
    this.connectButtons = page.getByTestId('connect-button');
    this.emptyState = page.getByTestId('connectors-empty');
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
    const connectedSection = this.connectedSection;
    const badge = connectedSection.locator('[class*="badge"], [data-slot="badge"]');
    const isVisible = await badge.isVisible({ timeout: 3_000 }).catch(() => false);
    if (!isVisible) return 0;
    const text = await badge.textContent();
    return parseInt(text ?? '0', 10) || 0;
  }
}
