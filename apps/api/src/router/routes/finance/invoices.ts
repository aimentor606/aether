import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { invoicesService } from '@aether/vertical-finance';
import { createInvoiceSchema, updateInvoiceSchema } from '@aether/db';
import type { AppContext } from '../../../types';

const invoicesRoutes = new Hono<{ Variables: AppContext }>()
  .post('/', async (c) => {
    const accountId = c.get('accountId');
    const body = await c.req.json();
    const parseResult = createInvoiceSchema.safeParse(body);

    if (!parseResult.success) {
      throw new HTTPException(400, {
        message: `Validation error: ${parseResult.error.message}`,
      });
    }

    try {
      const invoice = await invoicesService.create(accountId, parseResult.data);
      return c.json({ success: true, data: invoice });
    } catch (error) {
      throw new HTTPException(500, {
        message: error instanceof Error ? error.message : 'Failed to create invoice',
      });
    }
  })
  .get('/', async (c) => {
    const accountId = c.get('accountId');
    try {
      const invoices = await invoicesService.listAll(accountId);
      return c.json({ success: true, data: invoices });
    } catch (error) {
      throw new HTTPException(500, {
        message: error instanceof Error ? error.message : 'Failed to list invoices',
      });
    }
  })
  .get('/:id', async (c) => {
    const accountId = c.get('accountId');
    const id = c.req.param('id');
    try {
      const invoice = await invoicesService.getById(accountId, id);
      return c.json({ success: true, data: invoice });
    } catch (error) {
      throw new HTTPException(404, {
        message: error instanceof Error ? error.message : 'Invoice not found',
      });
    }
  })
  .patch('/:id', async (c) => {
    const accountId = c.get('accountId');
    const id = c.req.param('id');
    const body = await c.req.json();
    const parseResult = updateInvoiceSchema.safeParse(body);

    if (!parseResult.success) {
      throw new HTTPException(400, {
        message: `Validation error: ${parseResult.error.message}`,
      });
    }

    try {
      const invoice = await invoicesService.update(accountId, id, parseResult.data);
      return c.json({ success: true, data: invoice });
    } catch (error) {
      throw new HTTPException(
        error instanceof Error && error.message.includes('not found') ? 404 : 500,
        {
          message: error instanceof Error ? error.message : 'Failed to update invoice',
        }
      );
    }
  })
  .delete('/:id', async (c) => {
    const accountId = c.get('accountId');
    const id = c.req.param('id');
    try {
      await invoicesService.delete(accountId, id);
      return c.json({ success: true, data: null });
    } catch (error) {
      throw new HTTPException(
        error instanceof Error && error.message.includes('not found') ? 404 : 500,
        {
          message: error instanceof Error ? error.message : 'Failed to delete invoice',
        }
      );
    }
  });

export default invoicesRoutes;
