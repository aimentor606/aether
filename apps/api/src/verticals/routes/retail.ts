import { Hono } from 'hono';
import { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';
import { retailService } from '../services/retail';
import { getAccountId, formatZodError, pagination } from '../middleware/account-context';
import {
  createInventoryItemSchema,
  updateInventoryItemSchema,
  createSaleSchema,
  createLoyaltyProgramSchema,
} from '../schemas/retail';

const retailRoutes = new Hono();

// ─── Inventory ─────────────────────────────────────────────────────────────────

retailRoutes.get('/inventory', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const { limit, offset } = pagination(c);
    const inventory = await retailService.listInventory(accountId);
    return c.json({ success: true, data: inventory, meta: { limit, offset } });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    return c.json({ success: false, error: 'Failed to list inventory' }, 500);
  }
});

retailRoutes.post('/inventory', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const body = await c.req.json();
    const validated = createInventoryItemSchema.parse(body);
    const item = await retailService.createInventoryItem(accountId, validated);
    return c.json({ success: true, data: item }, 201);
  } catch (error) {
    if (error instanceof ZodError) {
      return c.json(formatZodError(error), 400);
    }
    if (error instanceof HTTPException) throw error;
    return c.json({ success: false, error: 'Failed to create inventory item' }, 400);
  }
});

retailRoutes.get('/inventory/:id', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const id = c.req.param('id');
    const item = await retailService.getInventoryItem(accountId, id!);
    if (!item) {
      return c.json({ success: false, error: 'Inventory item not found' }, 404);
    }
    return c.json({ success: true, data: item });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    return c.json({ success: false, error: 'Failed to retrieve inventory item' }, 500);
  }
});

retailRoutes.put('/inventory/:id', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const id = c.req.param('id');
    const body = await c.req.json();
    const validated = updateInventoryItemSchema.parse(body);
    const item = await retailService.updateInventoryItem(accountId, id!, validated);
    return c.json({ success: true, data: item });
  } catch (error) {
    if (error instanceof ZodError) {
      return c.json(formatZodError(error), 400);
    }
    if (error instanceof HTTPException) throw error;
    return c.json({ success: false, error: 'Failed to update inventory item' }, 400);
  }
});

retailRoutes.delete('/inventory/:id', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const id = c.req.param('id');
    await retailService.deleteInventoryItem(accountId, id!);
    return c.json({ success: true });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    return c.json({ success: false, error: 'Failed to delete inventory item' }, 500);
  }
});

// ─── Sales ─────────────────────────────────────────────────────────────────────

retailRoutes.get('/sales', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const { limit, offset } = pagination(c);
    const sales = await retailService.listSales(accountId);
    return c.json({ success: true, data: sales, meta: { limit, offset } });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    return c.json({ success: false, error: 'Failed to list sales' }, 500);
  }
});

retailRoutes.post('/sales', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const body = await c.req.json();
    const validated = createSaleSchema.parse(body);
    const sale = await retailService.createSale(accountId, validated);
    return c.json({ success: true, data: sale }, 201);
  } catch (error) {
    if (error instanceof ZodError) {
      return c.json(formatZodError(error), 400);
    }
    if (error instanceof HTTPException) throw error;
    return c.json({ success: false, error: 'Failed to create sale' }, 400);
  }
});

// ─── Loyalty Programs ──────────────────────────────────────────────────────────

retailRoutes.get('/loyalty', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const { limit, offset } = pagination(c);
    const programs = await retailService.listLoyaltyPrograms(accountId);
    return c.json({ success: true, data: programs, meta: { limit, offset } });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    return c.json({ success: false, error: 'Failed to list loyalty programs' }, 500);
  }
});

retailRoutes.post('/loyalty', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const body = await c.req.json();
    const validated = createLoyaltyProgramSchema.parse(body);
    const program = await retailService.createLoyaltyProgram(accountId, validated);
    return c.json({ success: true, data: program }, 201);
  } catch (error) {
    if (error instanceof ZodError) {
      return c.json(formatZodError(error), 400);
    }
    if (error instanceof HTTPException) throw error;
    return c.json({ success: false, error: 'Failed to create loyalty program' }, 400);
  }
});

export { retailRoutes };
