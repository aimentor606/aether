import { Hono } from 'hono';
import { Context } from 'hono';
import { financeService } from '../services/finance';

const financeRoutes = new Hono();

financeRoutes.get('/invoices', async (c: Context) => {
  try {
    const invoices = await financeService.listInvoices();
    return c.json({ success: true, data: invoices });
  } catch (error) {
    return c.json(
      { success: false, error: 'Failed to list invoices' },
      500
    );
  }
});

financeRoutes.post('/invoices', async (c: Context) => {
  try {
    const body = await c.req.json();
    const invoice = await financeService.createInvoice(body);
    return c.json({ success: true, data: invoice }, 201);
  } catch (error) {
    return c.json(
      { success: false, error: 'Failed to create invoice' },
      400
    );
  }
});

financeRoutes.get('/invoices/:id', async (c: Context) => {
  try {
    const id = c.req.param('id');
    const invoice = await financeService.getInvoice(id);
    if (!invoice) {
      return c.json({ success: false, error: 'Invoice not found' }, 404);
    }
    return c.json({ success: true, data: invoice });
  } catch (error) {
    return c.json(
      { success: false, error: 'Failed to retrieve invoice' },
      500
    );
  }
});

financeRoutes.put('/invoices/:id', async (c: Context) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const invoice = await financeService.updateInvoice(id, body);
    return c.json({ success: true, data: invoice });
  } catch (error) {
    return c.json(
      { success: false, error: 'Failed to update invoice' },
      400
    );
  }
});

financeRoutes.delete('/invoices/:id', async (c: Context) => {
  try {
    const id = c.req.param('id');
    await financeService.deleteInvoice(id);
    return c.json({ success: true });
  } catch (error) {
    return c.json(
      { success: false, error: 'Failed to delete invoice' },
      500
    );
  }
});

financeRoutes.get('/ledger', async (c: Context) => {
  try {
    const entries = await financeService.getLedgerEntries();
    return c.json({ success: true, data: entries });
  } catch (error) {
    return c.json(
      { success: false, error: 'Failed to retrieve ledger' },
      500
    );
  }
});

financeRoutes.post('/ledger', async (c: Context) => {
  try {
    const body = await c.req.json();
    const entry = await financeService.createLedgerEntry(body);
    return c.json({ success: true, data: entry }, 201);
  } catch (error) {
    return c.json(
      { success: false, error: 'Failed to create ledger entry' },
      400
    );
  }
});

financeRoutes.get('/budgets', async (c: Context) => {
  try {
    const budgets = await financeService.listBudgets();
    return c.json({ success: true, data: budgets });
  } catch (error) {
    return c.json(
      { success: false, error: 'Failed to list budgets' },
      500
    );
  }
});

financeRoutes.post('/budgets', async (c: Context) => {
  try {
    const body = await c.req.json();
    const budget = await financeService.createBudget(body);
    return c.json({ success: true, data: budget }, 201);
  } catch (error) {
    return c.json(
      { success: false, error: 'Failed to create budget' },
      400
    );
  }
});

financeRoutes.get('/compliance', async (c: Context) => {
  try {
    const report = await financeService.getComplianceReport();
    return c.json({ success: true, data: report });
  } catch (error) {
    return c.json(
      { success: false, error: 'Failed to retrieve compliance report' },
      500
    );
  }
});

export { financeRoutes };
