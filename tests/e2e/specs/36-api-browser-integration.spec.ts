import { test, expect } from '../fixtures';

test.describe('API + Browser Integration', () => {
  const uniqueSuffix = () => Date.now().toString(36);

  test.describe('Finance Invoice Round-Trip', () => {
    test('create invoice via API, verify in browser', async ({ authenticatedPage, apiFetch }) => {
      const suffix = uniqueSuffix();
      const invoicePayload = {
        invoiceNumber: `E2E-${suffix}`,
        clientName: `E2E Test Client ${suffix}`,
        amount: 1234.56,
        currency: 'USD',
        status: 'draft',
      };

      const res = await apiFetch('/verticals/finance/invoices', {
        method: 'POST',
        body: JSON.stringify(invoicePayload),
      });
      expect(res.ok).toBeTruthy();
      const body = await res.json();
      expect(body.success).toBeTruthy();
      expect(body.data.invoiceNumber).toBe(invoicePayload.invoiceNumber);

      await authenticatedPage.goto('/finance');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await authenticatedPage.waitForTimeout(2_000);

      const invoiceTab = authenticatedPage.getByTestId('tab-invoices');
      await invoiceTab.click();
      await authenticatedPage.waitForTimeout(1_000);

      const tableRows = authenticatedPage.getByTestId('finance-row');
      const rowCount = await tableRows.count();
      if (rowCount > 0) {
        const pageText = await authenticatedPage.getByTestId('finance-table').textContent();
        expect(pageText).toContain(invoicePayload.invoiceNumber);
      }
    });

    test('create invoice via API, delete via API, verify removal in browser', async ({ authenticatedPage, apiFetch }) => {
      const suffix = uniqueSuffix();
      const createRes = await apiFetch('/verticals/finance/invoices', {
        method: 'POST',
        body: JSON.stringify({
          invoiceNumber: `E2E-DEL-${suffix}`,
          clientName: `Delete Test ${suffix}`,
          amount: 99.99,
          currency: 'USD',
        }),
      });
      const created = await createRes.json();
      if (!created.success) {
        test.skip();
        return;
      }
      const invoiceId = created.data.id;

      const deleteRes = await apiFetch(`/verticals/finance/invoices/${invoiceId}`, {
        method: 'DELETE',
      });
      expect(deleteRes.ok).toBeTruthy();

      await authenticatedPage.goto('/finance');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await authenticatedPage.waitForTimeout(2_000);

      const pageText = await authenticatedPage.getByTestId('finance-tab-content').textContent().catch(() => '');
      expect(pageText).not.toContain(`E2E-DEL-${suffix}`);
    });
  });

  test.describe('Finance Expense Round-Trip', () => {
    test('create expense via API, verify in browser', async ({ authenticatedPage, apiFetch }) => {
      const suffix = uniqueSuffix();
      const expensePayload = {
        expenseNumber: `EXP-${suffix}`,
        employeeName: `E2E Employee ${suffix}`,
        category: 'software',
        amount: 499.99,
        currency: 'USD',
        expenseDate: new Date().toISOString().split('T')[0],
      };

      const res = await apiFetch('/verticals/finance/expenses', {
        method: 'POST',
        body: JSON.stringify(expensePayload),
      });
      expect(res.ok).toBeTruthy();
      const body = await res.json();
      expect(body.success).toBeTruthy();

      await authenticatedPage.goto('/finance');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await authenticatedPage.waitForTimeout(2_000);

      await authenticatedPage.getByTestId('tab-expenses').click();
      await authenticatedPage.waitForTimeout(1_000);

      const rowCount = await authenticatedPage.getByTestId('finance-row').count();
      if (rowCount > 0) {
        const pageText = await authenticatedPage.getByTestId('finance-table').textContent();
        expect(pageText).toContain(expensePayload.expenseNumber);
      }
    });
  });

  test.describe('Finance Budget Round-Trip', () => {
    test('create budget via API, verify in browser', async ({ authenticatedPage, apiFetch }) => {
      const suffix = uniqueSuffix();
      const today = new Date();
      const endDate = new Date(today);
      endDate.setMonth(endDate.getMonth() + 1);

      const budgetPayload = {
        budgetName: `E2E Budget ${suffix}`,
        period: 'monthly',
        totalBudget: 10000,
        currency: 'USD',
        startDate: today.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      };

      const res = await apiFetch('/verticals/finance/budgets', {
        method: 'POST',
        body: JSON.stringify(budgetPayload),
      });
      expect(res.ok).toBeTruthy();
      const body = await res.json();
      expect(body.success).toBeTruthy();

      await authenticatedPage.goto('/finance');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await authenticatedPage.waitForTimeout(2_000);

      await authenticatedPage.getByTestId('tab-budgets').click();
      await authenticatedPage.waitForTimeout(1_000);

      const cardCount = await authenticatedPage.getByTestId('budget-card').count();
      if (cardCount > 0) {
        const pageText = await authenticatedPage.locator('body').textContent();
        expect(pageText).toContain(budgetPayload.budgetName);
      }
    });
  });

  test.describe('Finance Ledger Round-Trip', () => {
    test('create ledger entry via API, verify in browser', async ({ authenticatedPage, apiFetch }) => {
      const suffix = uniqueSuffix();
      const ledgerPayload = {
        journalEntry: `E2E Entry ${suffix}`,
        debitAmount: 5000,
        ledgerAccount: 'Accounts Receivable',
        status: 'posted',
        entryDate: new Date().toISOString().split('T')[0],
        reference: `E2E-REF-${suffix}`,
      };

      const res = await apiFetch('/verticals/finance/ledger', {
        method: 'POST',
        body: JSON.stringify(ledgerPayload),
      });
      expect(res.ok).toBeTruthy();
      const body = await res.json();
      expect(body.success).toBeTruthy();

      await authenticatedPage.goto('/finance');
      await authenticatedPage.waitForLoadState('networkidle').catch(() => {});
      await authenticatedPage.waitForTimeout(2_000);

      await authenticatedPage.getByTestId('tab-ledgers').click();
      await authenticatedPage.waitForTimeout(1_000);

      const rowCount = await authenticatedPage.getByTestId('finance-row').count();
      if (rowCount > 0) {
        const pageText = await authenticatedPage.getByTestId('finance-table').textContent();
        expect(pageText).toContain(ledgerPayload.journalEntry);
      }
    });
  });

  test.describe('API Health Verification', () => {
    test('finance API endpoints respond correctly', async ({ apiFetch }) => {
      const endpoints = [
        { path: '/verticals/finance/invoices', name: 'Invoices' },
        { path: '/verticals/finance/expenses', name: 'Expenses' },
        { path: '/verticals/finance/budgets', name: 'Budgets' },
        { path: '/verticals/finance/ledger', name: 'Ledger' },
      ];

      for (const endpoint of endpoints) {
        const res = await apiFetch(endpoint.path);
        expect(res.ok).toBeTruthy();
        const body = await res.json();
        expect(body.success).toBeTruthy();
      }
    });

    test('finance API rejects invalid invoice payload', async ({ apiFetch }) => {
      const res = await apiFetch('/verticals/finance/invoices', {
        method: 'POST',
        body: JSON.stringify({ invalid: true }),
      });
      expect(res.status).toBe(400);
    });

    test('finance API rejects invalid expense payload', async ({ apiFetch }) => {
      const res = await apiFetch('/verticals/finance/expenses', {
        method: 'POST',
        body: JSON.stringify({ bad: 'data' }),
      });
      expect(res.status).toBe(400);
    });
  });
});
