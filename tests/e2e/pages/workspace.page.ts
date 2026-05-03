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
    this.heading = page.getByTestId('workspace-heading');
    this.searchInput = page.getByTestId('workspace-search');
    this.kindFilterTabs = page.getByTestId('kind-filter-bar').locator('button');
    this.scopeFilters = page.getByTestId('scope-filter-bar').locator('button');
    this.itemCards = page.getByTestId('workspace-item');
    this.quickActionCards = page.locator('button[type="button"]').filter({ hasText: /New agent|New skill|New command|New project/ });
    this.newAgentButton = page.getByTestId('new-agent-button');
    this.newSkillButton = page.getByTestId('new-skill-button');
    this.newCommandButton = page.getByTestId('new-command-button');
    this.newProjectButton = page.getByTestId('new-project-button');
    this.detailSheet = page.getByTestId('detail-sheet');
    this.detailSheetTitle = page.getByTestId('detail-sheet-title');
    this.detailSheetClose = page.locator('[role="dialog"] button[aria-label="Close"], [role="dialog"] button').filter({ hasText: /close/i }).first();
    this.settingsButton = page.getByTestId('workspace-settings');
    this.addMcpButton = page.getByTestId('add-mcp-button');
    this.emptyState = page.getByTestId('workspace-empty');
  }

  async goto() {
    await this.page.goto('/workspace');
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  async assertLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 15_000 });
  }

  async filterByKind(kind: string) {
    const tab = this.kindFilterTabs.filter({ hasText: new RegExp(kind, 'i') }).first();
    await tab.click();
    await this.page.waitForTimeout(500);
  }

  async filterByScope(scope: string) {
    const pill = this.scopeFilters.filter({ hasText: new RegExp(scope, 'i') }).first();
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
