import { expect, type Locator, type Page } from '@playwright/test';

export class SettingsCredentialsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly addButton: Locator;
  readonly filterInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByTestId('credentials-heading');
    this.addButton = page.getByTestId('add-credential-button');
    this.filterInput = page.getByTestId('credential-search');
  }

  async goto() {
    await this.page.goto('/settings/credentials');
    await expect(this.heading).toBeVisible({ timeout: 15_000 });
  }

  async assertLoaded() {
    await expect(this.heading).toBeVisible();
  }
}
