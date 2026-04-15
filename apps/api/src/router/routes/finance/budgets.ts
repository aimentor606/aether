import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { budgetsService } from '@aether/vertical-finance';
import { createBudgetSchema, updateBudgetSchema } from '@aether/db';
import type { AppContext } from '../../../types';

const budgetsRoutes = new Hono<{ Variables: AppContext }>()
  .post('/', async (c) => {
    const accountId = c.get('accountId');
    const body = await c.req.json();
    const parseResult = createBudgetSchema.safeParse(body);

    if (!parseResult.success) {
      throw new HTTPException(400, {
        message: `Validation error: ${parseResult.error.message}`,
      });
    }

    try {
      const record = await budgetsService.create(accountId, parseResult.data);
      return c.json({ success: true, data: record });
    } catch (error) {
      throw new HTTPException(500, {
        message: error instanceof Error ? error.message : 'Failed to create budget',
      });
    }
  })
  .get('/', async (c) => {
    const accountId = c.get('accountId');
    try {
      const records = await budgetsService.listAll(accountId);
      return c.json({ success: true, data: records });
    } catch (error) {
      throw new HTTPException(500, {
        message: error instanceof Error ? error.message : 'Failed to list budgets',
      });
    }
  })
  .get('/:id', async (c) => {
    const accountId = c.get('accountId');
    const id = c.req.param('id');
    try {
      const record = await budgetsService.getById(accountId, id);
      return c.json({ success: true, data: record });
    } catch (error) {
      throw new HTTPException(404, {
        message: error instanceof Error ? error.message : 'Budget not found',
      });
    }
  })
  .patch('/:id', async (c) => {
    const accountId = c.get('accountId');
    const id = c.req.param('id');
    const body = await c.req.json();
    const parseResult = updateBudgetSchema.safeParse(body);

    if (!parseResult.success) {
      throw new HTTPException(400, {
        message: `Validation error: ${parseResult.error.message}`,
      });
    }

    try {
      const record = await budgetsService.update(accountId, id, parseResult.data);
      return c.json({ success: true, data: record });
    } catch (error) {
      throw new HTTPException(
        error instanceof Error && error.message.includes('not found') ? 404 : 500,
        {
          message: error instanceof Error ? error.message : 'Failed to update budget',
        }
      );
    }
  })
  .delete('/:id', async (c) => {
    const accountId = c.get('accountId');
    const id = c.req.param('id');
    try {
      await budgetsService.delete(accountId, id);
      return c.json({ success: true, data: null });
    } catch (error) {
      throw new HTTPException(
        error instanceof Error && error.message.includes('not found') ? 404 : 500,
        {
          message: error instanceof Error ? error.message : 'Failed to delete budget',
        }
      );
    }
  });

export default budgetsRoutes;
