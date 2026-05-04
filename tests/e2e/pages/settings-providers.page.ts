import { expect, type Locator, type Page } from '@playwright/test';

export class SettingsProvidersPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly addProviderButton: Locator;
  readonly providerList: Locator;
  readonly emptyState: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByTestId('providers-heading');
    this.addProviderButton = page.getByTestId('add-provider-button');
    this.providerList = page.getByTestId('provider-list');
    this.emptyState = page.getByText(/No providers connected/i);
  }

  async goto() {
    await this.page.goto('/settings/providers');
    await expect(this.heading).toBeVisible({ timeout: 15_000 });
  }

  async assertLoaded() {
    await expect(this.heading).toBeVisible();
  }

  async hasProviders(): Promise<boolean> {
    return this.emptyState.isVisible({ timeout: 3_000 }).then(() => false).catch(() => true);
  }
}
