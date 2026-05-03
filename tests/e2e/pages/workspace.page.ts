import { expect, type Locator, type Page } from '@playwright/test';

export class WorkspacePage {
  readonly page: Page;
  readonly heading: Locator;
  readonly searchInput: Locator;
  readonly kindFilterTabs: Locator;
  readonly scopeFilters: Locator;
  readonly itemCards: Locator;
  readonly quickActionCards: Locator;
  readonly newAgentButton: Locator;
  readonly newSkillButton: Locator;
  readonly newCommandButton: Locator;
  readonly newProjectButton: Locator;
  readonly detailSheet: Locator;
  readonly detailSheetTitle: Locator;
  readonly detailSheetClose: Locator;
  readonly settingsButton: Locator;
  readonly addMcpButton: Locator;
  readonly emptyState: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByText('Workspace', { exact: false }).first();
    this.searchInput = page.locator('input[placeholder="Search..."]').first();
    this.kindFilterTabs = page.locator('[role="tablist"], [data-slot="filter-bar"]').first().locator('button');
    this.scopeFilters = page.locator('[data-slot="filter-bar"]').nth(1).locator('button');
    this.itemCards = page.locator('[class*="spotlight-card"], [class*="bg-card"][class*="border"]').filter({ has: page.locator('h3') });
    this.quickActionCards = page.locator('button[type="button"]').filter({ hasText: /New agent|New skill|New command|New project/ });
    this.newAgentButton = page.getByRole('button', { name: /New agent/i });
    this.newSkillButton = page.getByRole('button', { name: /New skill/i });
    this.newCommandButton = page.getByRole('button', { name: /New command/i });
    this.newProjectButton = page.getByRole('button', { name: /New project/i });
    this.detailSheet = page.locator('[role="dialog"], [data-state="open"]').filter({ has: page.locator('[class*="Sheet"]') }).or(
      page.locator('[role="dialog"]').first(),
    );
    this.detailSheetTitle = page.locator('[role="dialog"] [class*="font-semibold"], [role="dialog"] h2, [role="dialog"] [data-slot="sheet-title"]').first();
    this.detailSheetClose = page.locator('[role="dialog"] button[aria-label="Close"], [role="dialog"] button').filter({ hasText: /close/i }).first();
    this.settingsButton = page.getByRole('button', { name: /Settings/i }).filter({ hasText: /Providers, permissions/ });
    this.addMcpButton = page.getByRole('button', { name: /Add MCP server/i });
    this.emptyState = page.getByText(/Nothing here yet|No items match your filters/i);
  }

  async goto() {
    await this.page.goto('/workspace');
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  async assertLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 15_000 });
  }

  async filterByKind(kind: string) {
    const tab = this.page.locator('button').filter({ hasText: new RegExp(kind, 'i') }).first();
    await tab.click();
    await this.page.waitForTimeout(500);
  }

  async filterByScope(scope: string) {
    const pill = this.page.locator('[data-slot="filter-bar"]').nth(1).locator('button').filter({ hasText: new RegExp(scope, 'i') }).first();
    await pill.click();
    await this.page.waitForTimeout(500);
  }

  async search(query: string) {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(500);
  }

  async getItemCount(): Promise<number> {
    return this.itemCards.count();
  }

  async openItemDetail(index: number) {
    const card = this.itemCards.nth(index);
    await card.click();
    await this.page.waitForTimeout(500);
  }

  async closeDetailSheet() {
    // Try the close button first, then Escape key as fallback
    const closeButton = this.page.locator('[role="dialog"] button[aria-label="Close"]').first();
    const hasClose = await closeButton.isVisible({ timeout: 3_000 }).catch(() => false);
    if (hasClose) {
      await closeButton.click();
    } else {
      await this.page.keyboard.press('Escape');
    }
    await this.page.waitForTimeout(500);
  }
}
