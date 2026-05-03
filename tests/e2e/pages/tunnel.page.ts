import { expect, type Locator, type Page } from '@playwright/test';

export class TunnelOverviewPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly connectionCards: Locator;
  readonly createButton: Locator;
  readonly emptyState: Locator;
  readonly onlineIndicators: Locator;
  readonly offlineIndicators: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByText('Tunnel');
    this.connectionCards = page.locator('[role="button"][aria-label="View tunnel details"]');
    this.createButton = page.getByRole('button', { name: /Add Connection|Add/i });
    this.emptyState = page.getByText('Connect your machine');
    this.onlineIndicators = page.getByText('Online');
    this.offlineIndicators = page.getByText('Offline');
  }

  async goto() {
    await this.page.goto('/tunnel');
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  async assertLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 15_000 });
  }
}

export class TunnelDetailPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly copyUrlButton: Locator;
  readonly permissionsSection: Locator;
  readonly auditTable: Locator;
  readonly settingsButton: Locator;
  readonly scopeEditors: Locator;
  readonly backButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator('h1').first();
    this.copyUrlButton = page.getByRole('button', { name: /Copy/i });
    this.permissionsSection = page.getByRole('tab', { name: /Permissions/i });
    this.auditTable = page.getByRole('tab', { name: /Audit Log/i });
    this.settingsButton = page.getByRole('button', { name: /Settings/i });
    this.scopeEditors = page.locator('[class*="scope"]');
    this.backButton = page.getByRole('button', { name: /Back/i });
  }

  async goto(tunnelId: string) {
    await this.page.goto(`/tunnel/${tunnelId}`);
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  async assertLoaded() {
    await expect(this.backButton.or(this.page.getByText('Tunnel connection not found'))).toBeVisible({ timeout: 15_000 });
  }
}
