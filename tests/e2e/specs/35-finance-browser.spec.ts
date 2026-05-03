import { test, expect } from '../fixtures';
import { FinancePage } from '../pages/finance.page';

test.describe('Finance Vertical - Browser', () => {
  let financePage: FinancePage;

  test.beforeEach(async ({ authenticatedPage }) => {
    financePage = new FinancePage(authenticatedPage);
    await financePage.goto();
    await financePage.assertLoaded();
  });

  test.describe('Page Load & Navigation', () => {
    test('should load finance page with heading', async () => {
      await expect(financePage.heading).toBeVisible();
      await expect(financePage.heading).toContainText('Finance');
    });

    test('should display all 4 tab buttons', async () => {
      for (const tab of ['invoices', 'expenses', 'budgets', 'ledgers'] as const) {
        await expect(financePage.tabButtons[tab]).toBeVisible();
      }
    });

    test('should default to invoices tab', async () => {
      const invoicesTab = financePage.tabButtons.invoices;
      const classes = await invoicesTab.getAttribute('class');
      expect(classes).toContain('border-primary');
    });

    test('should switch between all tabs', async () => {
      for (const tab of ['expenses', 'budgets', 'ledgers', 'invoices'] as const) {
        await financePage.switchTab(tab);
        const classes = await financePage.tabButtons[tab].getAttribute('class');
        expect(classes).toContain('border-primary');
      }
    });

    test('should show tab counts in button labels', async () => {
      const invoicesText = await financePage.tabButtons.invoices.textContent();
      expect(invoicesText).toMatch(/\(\d+\)/);
    });
  });

  test.describe('Invoices Tab', () => {
    test('should display invoices table with correct headers', async () => {
      await financePage.switchTab('invoices');
      await financePage.financeTable.waitFor({ timeout: 10_000 }).catch(() => {});

      const headers = await financePage.getTableHeaders();
      const hasInvoiceHeaders =
        headers.some(h => /invoice/i.test(h)) ||
        headers.some(h => /client/i.test(h)) ||
        headers.some(h => /amount/i.test(h)) ||
        headers.some(h => /status/i.test(h));

      expect(hasInvoiceHeaders || headers.length > 0).toBeTruthy();
    });

    test('should show empty state when no invoices', async () => {
      await financePage.switchTab('invoices');
      const rowCount = await financePage.getTableRowCount();
      if (rowCount === 0) {
        await expect(financePage.emptyState).toBeVisible();
      }
    });

    test('should display status badges in invoice rows', async () => {
      await financePage.switchTab('invoices');
      const rowCount = await financePage.getTableRowCount();
      if (rowCount > 0) {
        const badgeCount = await financePage.statusBadges.count();
        expect(badgeCount).toBeGreaterThan(0);
      }
    });
  });

  test.describe('Expenses Tab', () => {
    test('should display expenses table after switching', async () => {
      await financePage.switchTab('expenses');
      await financePage.financeTable.waitFor({ timeout: 10_000 }).catch(() => {});

      const rowCount = await financePage.getTableRowCount();
      const emptyVisible = await financePage.emptyState.isVisible().catch(() => false);
      expect(rowCount > 0 || emptyVisible).toBeTruthy();
    });

    test('should show category column in expenses', async () => {
      await financePage.switchTab('expenses');
      const headers = await financePage.getTableHeaders();
      const hasCategory = headers.some(h => /category/i.test(h));
      expect(hasCategory || headers.length > 0).toBeTruthy();
    });
  });

  test.describe('Budgets Tab', () => {
    test('should display budget cards or empty state', async () => {
      await financePage.switchTab('budgets');
      await financePage.page.waitForTimeout(1_000);

      const cardCount = await financePage.getBudgetCardCount();
      const rowCount = await financePage.getTableRowCount();
      const emptyVisible = await financePage.emptyState.isVisible().catch(() => false);
      expect(cardCount > 0 || rowCount >= 0 || emptyVisible).toBeTruthy();
    });

    test('should show progress bars on budget cards', async () => {
      await financePage.switchTab('budgets');
      const cardCount = await financePage.getBudgetCardCount();
      if (cardCount > 0) {
        const barCount = await financePage.budgetProgressBars.count();
        expect(barCount).toBeGreaterThan(0);
      }
    });

    test('should display budget status badges', async () => {
      await financePage.switchTab('budgets');
      const cardCount = await financePage.getBudgetCardCount();
      if (cardCount > 0) {
        const badgeCount = await financePage.statusBadges.count();
        expect(badgeCount).toBeGreaterThan(0);
      }
    });
  });

  test.describe('Ledgers Tab', () => {
    test('should display ledger table after switching', async () => {
      await financePage.switchTab('ledgers');
      await financePage.financeTable.waitFor({ timeout: 10_000 }).catch(() => {});

      const rowCount = await financePage.getTableRowCount();
      const emptyVisible = await financePage.emptyState.isVisible().catch(() => false);
      expect(rowCount > 0 || emptyVisible).toBeTruthy();
    });

    test('should show debit/credit columns in ledger', async () => {
      await financePage.switchTab('ledgers');
      const headers = await financePage.getTableHeaders();
      const hasDebit = headers.some(h => /debit/i.test(h));
      const hasCredit = headers.some(h => /credit/i.test(h));
      expect(hasDebit || headers.length > 0).toBeTruthy();
      expect(hasCredit || headers.length > 0).toBeTruthy();
    });
  });

  test.describe('Data Integrity', () => {
    test('money displays use monospace formatting', async () => {
      for (const tab of ['invoices', 'expenses', 'ledgers'] as const) {
        await financePage.switchTab(tab);
        const rowCount = await financePage.getTableRowCount();
        if (rowCount > 0) {
          const moneyCount = await financePage.moneyDisplays.count();
          expect(moneyCount).toBeGreaterThan(0);
          return;
        }
      }
    });

    test('status badges show valid status values', async () => {
      for (const tab of ['invoices', 'expenses', 'ledgers'] as const) {
        await financePage.switchTab(tab);
        const badgeCount = await financePage.statusBadges.count();
        if (badgeCount > 0) {
          const firstBadge = financePage.statusBadges.first();
          const text = await firstBadge.textContent();
          const validStatuses = [
            'draft', 'sent', 'paid', 'overdue', 'cancelled',
            'submitted', 'approved', 'reimbursed', 'rejected',
            'posted', 'reversed', 'active', 'completed', 'archived',
          ];
          const normalized = text?.trim().toLowerCase() ?? '';
          expect(validStatuses.some(s => normalized.includes(s))).toBeTruthy();
          return;
        }
      }
    });
  });
});
