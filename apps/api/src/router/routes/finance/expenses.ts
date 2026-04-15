import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { expensesService } from '@aether/vertical-finance';
import { createExpenseSchema, updateExpenseSchema } from '@aether/db';
import type { AppContext } from '../../../types';

const expensesRoutes = new Hono<{ Variables: AppContext }>()
  .post('/', async (c) => {
    const accountId = c.get('accountId');
    const body = await c.req.json();
    const parseResult = createExpenseSchema.safeParse(body);

    if (!parseResult.success) {
      throw new HTTPException(400, {
        message: `Validation error: ${parseResult.error.message}`,
      });
    }

    try {
      const record = await expensesService.create(accountId, parseResult.data);
      return c.json({ success: true, data: record });
    } catch (error) {
      throw new HTTPException(500, {
        message: error instanceof Error ? error.message : 'Failed to create expense',
      });
    }
  })
  .get('/', async (c) => {
    const accountId = c.get('accountId');
    try {
      const records = await expensesService.listAll(accountId);
      return c.json({ success: true, data: records });
    } catch (error) {
      throw new HTTPException(500, {
        message: error instanceof Error ? error.message : 'Failed to list expenses',
      });
    }
  })
  .get('/:id', async (c) => {
    const accountId = c.get('accountId');
    const id = c.req.param('id');
    try {
      const record = await expensesService.getById(accountId, id);
      return c.json({ success: true, data: record });
    } catch (error) {
      throw new HTTPException(404, {
        message: error instanceof Error ? error.message : 'Expense not found',
      });
    }
  })
  .patch('/:id', async (c) => {
    const accountId = c.get('accountId');
    const id = c.req.param('id');
    const body = await c.req.json();
    const parseResult = updateExpenseSchema.safeParse(body);

    if (!parseResult.success) {
      throw new HTTPException(400, {
        message: `Validation error: ${parseResult.error.message}`,
      });
    }

    try {
      const record = await expensesService.update(accountId, id, parseResult.data);
      return c.json({ success: true, data: record });
    } catch (error) {
      throw new HTTPException(
        error instanceof Error && error.message.includes('not found') ? 404 : 500,
        {
          message: error instanceof Error ? error.message : 'Failed to update expense',
        }
      );
    }
  })
  .delete('/:id', async (c) => {
    const accountId = c.get('accountId');
    const id = c.req.param('id');
    try {
      await expensesService.delete(accountId, id);
      return c.json({ success: true, data: null });
    } catch (error) {
      throw new HTTPException(
        error instanceof Error && error.message.includes('not found') ? 404 : 500,
        {
          message: error instanceof Error ? error.message : 'Failed to delete expense',
        }
      );
    }
  });

export default expensesRoutes;
