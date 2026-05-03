import { expect, type Locator, type Page } from '@playwright/test';

export class SettingsCredentialsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly addButton: Locator;
  readonly filterInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Secrets Manager' });
    this.addButton = page.getByRole('button', { name: /Add/i });
    this.filterInput = page.locator('input[placeholder*="Search"], input[placeholder*="Filter"]').or(
      page.locator('input[type="search"]').first(),
    );
  }

  async goto() {
    await this.page.goto('/settings/credentials');
    await expect(this.heading).toBeVisible({ timeout: 15_000 });
  }

  async assertLoaded() {
    await expect(this.heading).toBeVisible();
  }
}
