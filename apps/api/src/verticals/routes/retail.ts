import { Hono } from 'hono';
import { Context } from 'hono';
import { retailService } from '../services/retail';

const retailRoutes = new Hono();

retailRoutes.get('/inventory', async (c: Context) => {
  try {
    const inventory = await retailService.listInventory();
    return c.json({ success: true, data: inventory });
  } catch (error) {
    return c.json(
      { success: false, error: 'Failed to list inventory' },
      500
    );
  }
});

retailRoutes.post('/inventory', async (c: Context) => {
  try {
    const body = await c.req.json();
    const item = await retailService.createInventoryItem(body);
    return c.json({ success: true, data: item }, 201);
  } catch (error) {
    return c.json(
      { success: false, error: 'Failed to create inventory item' },
      400
    );
  }
});

retailRoutes.get('/inventory/:id', async (c: Context) => {
  try {
    const id = c.req.param('id');
    const item = await retailService.getInventoryItem(id);
    if (!item) {
      return c.json({ success: false, error: 'Inventory item not found' }, 404);
    }
    return c.json({ success: true, data: item });
  } catch (error) {
    return c.json(
      { success: false, error: 'Failed to retrieve inventory item' },
      500
    );
  }
});

retailRoutes.put('/inventory/:id', async (c: Context) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const item = await retailService.updateInventoryItem(id, body);
    return c.json({ success: true, data: item });
  } catch (error) {
    return c.json(
      { success: false, error: 'Failed to update inventory item' },
      400
    );
  }
});

retailRoutes.delete('/inventory/:id', async (c: Context) => {
  try {
    const id = c.req.param('id');
    await retailService.deleteInventoryItem(id);
    return c.json({ success: true });
  } catch (error) {
    return c.json(
      { success: false, error: 'Failed to delete inventory item' },
      500
    );
  }
});

retailRoutes.get('/sales', async (c: Context) => {
  try {
    const sales = await retailService.listSales();
    return c.json({ success: true, data: sales });
  } catch (error) {
    return c.json(
      { success: false, error: 'Failed to list sales' },
      500
    );
  }
});

retailRoutes.post('/sales', async (c: Context) => {
  try {
    const body = await c.req.json();
    const sale = await retailService.createSale(body);
    return c.json({ success: true, data: sale }, 201);
  } catch (error) {
    return c.json(
      { success: false, error: 'Failed to create sale' },
      400
    );
  }
});

retailRoutes.get('/loyalty', async (c: Context) => {
  try {
    const programs = await retailService.listLoyaltyPrograms();
    return c.json({ success: true, data: programs });
  } catch (error) {
    return c.json(
      { success: false, error: 'Failed to list loyalty programs' },
      500
    );
  }
});

retailRoutes.post('/loyalty', async (c: Context) => {
  try {
    const body = await c.req.json();
    const program = await retailService.createLoyaltyProgram(body);
    return c.json({ success: true, data: program }, 201);
  } catch (error) {
    return c.json(
      { success: false, error: 'Failed to create loyalty program' },
      400
    );
  }
});

retailRoutes.get('/compliance', async (c: Context) => {
  try {
    const report = await retailService.getComplianceReport();
    return c.json({ success: true, data: report });
  } catch (error) {
    return c.json(
      { success: false, error: 'Failed to retrieve compliance report' },
      500
    );
  }
});

export { retailRoutes };
