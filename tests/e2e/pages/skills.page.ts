import { expect, type Locator, type Page } from '@playwright/test';

export class SkillsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly searchInput: Locator;
  readonly filterTabs: Locator;
  readonly skillCards: Locator;
  readonly installButtons: Locator;
  readonly emptyState: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByTestId('marketplace-heading');
    this.searchInput = page.getByTestId('marketplace-search');
    this.filterTabs = page.getByTestId('marketplace-filters');
    this.skillCards = page.getByTestId('skill-card');
    this.installButtons = page.getByTestId('install-button');
    this.emptyState = page.getByTestId('marketplace-empty');
  }

  async goto() {
    await this.page.goto('/skills');
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  async assertLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 15_000 });
  }

  async filterBy(filterName: string) {
    const filterTab = this.filterTabs.locator(`[data-state]`).filter({ hasText: new RegExp(`^${filterName}`, 'i') }).first();
    await filterTab.click();
  }

  async search(query: string) {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(500);
  }

  async getItemCount(): Promise<number> {
    const isEmpty = await this.emptyState.isVisible({ timeout: 3_000 }).catch(() => false);
    if (isEmpty) return 0;
    return this.skillCards.count();
  }
}
