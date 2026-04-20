import { z } from 'zod';

export const createInventoryItemSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  sku: z.string().min(1, 'SKU is required'),
  quantity: z.number().int().min(0).default(0),
  price: z.number().min(0).optional(),
  category: z.string().optional(),
  description: z.string().optional(),
});

export const updateInventoryItemSchema = z.object({
  name: z.string().min(1).optional(),
  sku: z.string().min(1).optional(),
  quantity: z.number().int().min(0).optional(),
  price: z.number().min(0).optional(),
  category: z.string().optional(),
  description: z.string().optional(),
});

export const createSaleSchema = z.object({
  itemId: z.string().min(1, 'Item ID is required'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  totalPrice: z.number().min(0).optional(),
  customerName: z.string().optional(),
});

export const createLoyaltyProgramSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  pointsPerDollar: z.number().min(0).default(1),
  minimumPurchase: z.number().min(0).default(0),
  description: z.string().optional(),
});
