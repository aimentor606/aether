import { type Locator, type Page } from '@playwright/test';

type TabKey = 'invoices' | 'expenses' | 'budgets' | 'ledgers';

export class FinancePage {
  readonly page: Page;
  readonly heading: Locator;
  readonly tabButtons: Record<TabKey, Locator>;
  readonly tabContent: Locator;
  readonly financeTable: Locator;
  readonly tableRows: Locator;
  readonly emptyState: Locator;
  readonly budgetCards: Locator;
  readonly budgetProgressBars: Locator;
  readonly statusBadges: Locator;
  readonly moneyDisplays: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByTestId('finance-heading');
    this.tabButtons = {
      invoices: page.getByTestId('tab-invoices'),
      expenses: page.getByTestId('tab-expenses'),
      budgets: page.getByTestId('tab-budgets'),
      ledgers: page.getByTestId('tab-ledgers'),
    };
    this.tabContent = page.getByTestId('finance-tab-content');
    this.financeTable = page.getByTestId('finance-table');
    this.tableRows = page.getByTestId('finance-row');
    this.emptyState = page.getByTestId('finance-empty');
    this.budgetCards = page.getByTestId('budget-card');
    this.budgetProgressBars = page.getByTestId('budget-progress');
    this.statusBadges = page.getByTestId('status-badge');
    this.moneyDisplays = page.getByTestId('money-display');
  }

  async goto() {
    await this.page.goto('/finance');
  }

  async assertLoaded() {
    await this.heading.waitFor({ timeout: 15_000 });
  }

  async switchTab(tab: TabKey) {
    await this.tabButtons[tab].click();
  }

  async getTableRowCount(): Promise<number> {
    return this.tableRows.count();
  }

  async getBudgetCardCount(): Promise<number> {
    return this.budgetCards.count();
  }

  async getTabCount(tab: TabKey): Promise<string> {
    const text = await this.tabButtons[tab].textContent();
    const match = text?.match(/\((\d+)\)/);
    return match ? match[1] : '0';
  }

  async clickTableRow(index: number) {
    await this.tableRows.nth(index).click();
  }

  async clickBudgetCard(index: number) {
    await this.budgetCards.nth(index).click();
  }

  async getTableHeaders(): Promise<string[]> {
    const headers = this.financeTable.locator('th');
    const count = await headers.count();
    const result: string[] = [];
    for (let i = 0; i < count; i++) {
      result.push((await headers.nth(i).textContent())?.trim() ?? '');
    }
    return result;
  }
}
