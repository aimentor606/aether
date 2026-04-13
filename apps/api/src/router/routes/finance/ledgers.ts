import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ledgersService } from '@acme/vertical-finance';
import { createLedgerSchema, updateLedgerSchema } from '@acme/db';
import type { AppContext } from '../../../types';

const ledgersRoutes = new Hono<{ Variables: AppContext }>()
  .post('/', async (c) => {
    const accountId = c.get('accountId');
    const body = await c.req.json();
    const parseResult = createLedgerSchema.safeParse(body);

    if (!parseResult.success) {
      throw new HTTPException(400, {
        message: `Validation error: ${parseResult.error.message}`,
      });
    }

    try {
      const record = await ledgersService.create(accountId, parseResult.data);
      return c.json({ success: true, data: record });
    } catch (error) {
      throw new HTTPException(500, {
        message: error instanceof Error ? error.message : 'Failed to create ledger',
      });
    }
  })
  .get('/', async (c) => {
    const accountId = c.get('accountId');
    try {
      const records = await ledgersService.listAll(accountId);
      return c.json({ success: true, data: records });
    } catch (error) {
      throw new HTTPException(500, {
        message: error instanceof Error ? error.message : 'Failed to list ledgers',
      });
    }
  })
  .get('/:id', async (c) => {
    const accountId = c.get('accountId');
    const id = c.req.param('id');
    try {
      const record = await ledgersService.getById(accountId, id);
      return c.json({ success: true, data: record });
    } catch (error) {
      throw new HTTPException(404, {
        message: error instanceof Error ? error.message : 'Ledger not found',
      });
    }
  })
  .patch('/:id', async (c) => {
    const accountId = c.get('accountId');
    const id = c.req.param('id');
    const body = await c.req.json();
    const parseResult = updateLedgerSchema.safeParse(body);

    if (!parseResult.success) {
      throw new HTTPException(400, {
        message: `Validation error: ${parseResult.error.message}`,
      });
    }

    try {
      const record = await ledgersService.update(accountId, id, parseResult.data);
      return c.json({ success: true, data: record });
    } catch (error) {
      throw new HTTPException(
        error instanceof Error && error.message.includes('not found') ? 404 : 500,
        {
          message: error instanceof Error ? error.message : 'Failed to update ledger',
        }
      );
    }
  })
  .delete('/:id', async (c) => {
    const accountId = c.get('accountId');
    const id = c.req.param('id');
    try {
      await ledgersService.delete(accountId, id);
      return c.json({ success: true, data: null });
    } catch (error) {
      throw new HTTPException(
        error instanceof Error && error.message.includes('not found') ? 404 : 500,
        {
          message: error instanceof Error ? error.message : 'Failed to delete ledger',
        }
      );
    }
  });

export default ledgersRoutes;
