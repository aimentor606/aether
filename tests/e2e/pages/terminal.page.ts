import { expect, type Locator, type Page } from '@playwright/test';

export class TerminalPage {
  readonly page: Page;
  readonly newTerminalButton: Locator;
  readonly emptyState: Locator;
  readonly loadingState: Locator;
  readonly terminalContainer: Locator;
  readonly tabBar: Locator;
  readonly terminalTabs: Locator;
  readonly refreshButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.newTerminalButton = page.getByTestId('new-terminal-button');
    this.emptyState = page.getByText(/No terminal sessions/i);
    this.loadingState = page.getByText(/Loading terminals/i);
    this.terminalContainer = page.getByTestId('terminal-container').first();
    this.tabBar = page.locator('[class*="tab"]').filter({ has: page.locator('[class*="dot"]') });
    this.terminalTabs = page.getByTestId('terminal-tab');
    this.refreshButton = page.getByTestId('terminal-refresh');
  }

  async gotoViaId(terminalId: string) {
    await this.page.goto(`/terminal/${terminalId}`);
  }

  async assertEmptyState() {
    await expect(this.emptyState).toBeVisible({ timeout: 10_000 });
  }

  async assertLoading() {
    await expect(this.loadingState).toBeVisible({ timeout: 5_000 });
  }

  async assertTerminalVisible() {
    await expect(this.terminalContainer).toBeVisible({ timeout: 15_000 });
  }

  async assertNewTerminalButton() {
    await expect(this.newTerminalButton).toBeVisible({ timeout: 10_000 });
  }

  async getTabCount(): Promise<number> {
    return this.terminalTabs.count();
  }

  async typeInTerminal(text: string) {
    await this.terminalContainer.click();
    await this.page.keyboard.type(text);
  }

  async getTerminalOutput(): Promise<string> {
    const rows = this.page.locator('.xterm-rows');
    if (await rows.isVisible({ timeout: 5_000 }).catch(() => false)) {
      return rows.textContent() ?? '';
    }
    return '';
  }
}
