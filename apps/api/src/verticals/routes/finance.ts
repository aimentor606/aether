import { Hono } from 'hono';
import { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';
import { financeService } from '../services/finance';
import { getAccountId, formatZodError, pagination } from '../middleware/account-context';
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  createExpenseSchema,
  createBudgetSchema,
  createLedgerSchema,
} from '@aether/db/schema/finance';

const financeRoutes = new Hono();

// ─── Invoices ────────────────────────────────────────────────────────────────

financeRoutes.get('/invoices', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const { limit, offset } = pagination(c);
    const invoices = await financeService.listInvoices(accountId, { limit, offset });
    return c.json({ success: true, data: invoices, meta: { limit, offset } });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    return c.json({ success: false, error: 'Failed to list invoices' }, 500);
  }
});

financeRoutes.post('/invoices', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const body = await c.req.json();
    const validated = createInvoiceSchema.parse(body);
    const invoice = await financeService.createInvoice(accountId, validated);
    return c.json({ success: true, data: invoice }, 201);
  } catch (error) {
    if (error instanceof ZodError) {
      return c.json(formatZodError(error), 400);
    }
    if (error instanceof HTTPException) throw error;
    return c.json({ success: false, error: 'Failed to create invoice' }, 400);
  }
});

financeRoutes.get('/invoices/:id', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const id = c.req.param('id');
    const invoice = await financeService.getInvoice(accountId, id!);
    if (!invoice) {
      return c.json({ success: false, error: 'Invoice not found' }, 404);
    }
    return c.json({ success: true, data: invoice });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    return c.json({ success: false, error: 'Failed to retrieve invoice' }, 500);
  }
});

financeRoutes.put('/invoices/:id', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const id = c.req.param('id');
    const body = await c.req.json();
    const validated = updateInvoiceSchema.parse(body);
    const invoice = await financeService.updateInvoice(accountId, id!, validated);
    return c.json({ success: true, data: invoice });
  } catch (error) {
    if (error instanceof ZodError) {
      return c.json(formatZodError(error), 400);
    }
    if (error instanceof HTTPException) throw error;
    return c.json({ success: false, error: 'Failed to update invoice' }, 400);
  }
});

financeRoutes.delete('/invoices/:id', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const id = c.req.param('id');
    await financeService.deleteInvoice(accountId, id!);
    return c.json({ success: true });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    return c.json({ success: false, error: 'Failed to delete invoice' }, 500);
  }
});

// ─── Expenses ────────────────────────────────────────────────────────────────

financeRoutes.get('/expenses', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const { limit, offset } = pagination(c);
    const expenses = await financeService.listExpenses(accountId, { limit, offset });
    return c.json({ success: true, data: expenses, meta: { limit, offset } });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    return c.json({ success: false, error: 'Failed to list expenses' }, 500);
  }
});

financeRoutes.post('/expenses', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const body = await c.req.json();
    const validated = createExpenseSchema.parse(body);
    const expense = await financeService.createExpense(accountId, validated);
    return c.json({ success: true, data: expense }, 201);
  } catch (error) {
    if (error instanceof ZodError) {
      return c.json(formatZodError(error), 400);
    }
    if (error instanceof HTTPException) throw error;
    return c.json({ success: false, error: 'Failed to create expense' }, 400);
  }
});

// ─── Ledger ──────────────────────────────────────────────────────────────────

financeRoutes.get('/ledger', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const { limit, offset } = pagination(c);
    const entries = await financeService.listLedgerEntries(accountId, { limit, offset });
    return c.json({ success: true, data: entries, meta: { limit, offset } });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    return c.json({ success: false, error: 'Failed to retrieve ledger' }, 500);
  }
});

financeRoutes.post('/ledger', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const body = await c.req.json();
    const validated = createLedgerSchema.parse(body);
    const entry = await financeService.createLedgerEntry(accountId, validated);
    return c.json({ success: true, data: entry }, 201);
  } catch (error) {
    if (error instanceof ZodError) {
      return c.json(formatZodError(error), 400);
    }
    if (error instanceof HTTPException) throw error;
    return c.json({ success: false, error: 'Failed to create ledger entry' }, 400);
  }
});

// ─── Budgets ─────────────────────────────────────────────────────────────────

financeRoutes.get('/budgets', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const { limit, offset } = pagination(c);
    const budgets = await financeService.listBudgets(accountId, { limit, offset });
    return c.json({ success: true, data: budgets, meta: { limit, offset } });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    return c.json({ success: false, error: 'Failed to list budgets' }, 500);
  }
});

financeRoutes.post('/budgets', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const body = await c.req.json();
    const validated = createBudgetSchema.parse(body);
    const budget = await financeService.createBudget(accountId, validated);
    return c.json({ success: true, data: budget }, 201);
  } catch (error) {
    if (error instanceof ZodError) {
      return c.json(formatZodError(error), 400);
    }
    if (error instanceof HTTPException) throw error;
    return c.json({ success: false, error: 'Failed to create budget' }, 400);
  }
});

export { financeRoutes };
