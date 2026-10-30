import { z } from 'zod';

export const invoiceItemSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  quantity: z.number().int().positive('Quantity must be an integer greater than 0'),
  unitPrice: z.number().nonnegative('Unit price must be non-negative'),
  tax: z.number().nonnegative('Tax must be non-negative'),
  lineTotal: z.number().nonnegative('Line total must be non-negative'),
}).refine(
  (item) => {
    const expected = Number((item.quantity * item.unitPrice + item.tax).toFixed(2));
    return Math.abs(expected - item.lineTotal) < 0.01;
  },
  { message: 'lineTotal must equal (quantity * unitPrice + tax)' }
);

export const createInvoiceSchema = z.object({
  invoiceNumber: z.string().min(1, 'Invoice number is required'),
  invoiceDate: z.string().datetime({ message: 'Must be an ISO 8601 date string' }),
  customerName: z.string().min(1, 'Customer name is required'),
  customerTaxId: z.string().min(1, 'Customer Tax ID is required'),
  customerEmail: z.string().email('Customer email must be valid'),
  currency: z.string().length(3, 'Currency must be a 3-letter ISO code').default('USD'),
  items: z.array(invoiceItemSchema).min(1, 'At least one invoice item is required'),
});

export const listInvoiceQuerySchema = z.object({
  status: z.enum(['PENDING', 'PROCESSING', 'SUBMITTED', 'FAILED']).optional(),
  invoiceDate: z.string().optional(),
  invoiceNumber: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});