import { PrismaClient, InvoiceStatus, Prisma } from '@prisma/client';
import { z } from 'zod';
import { createInvoiceSchema, listInvoiceQuerySchema } from './schema.js';
import { processInvoiceAsync } from './processor.js'; 

const prisma = new PrismaClient();

export async function createInvoice(
  companyId: string,
  data: z.infer<typeof createInvoiceSchema>
) {
  const subtotal = data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const taxAmount = data.items.reduce((sum, item) => sum + item.tax, 0);
  const totalAmount = Number((subtotal + taxAmount).toFixed(2));

  const invoice = await prisma.$transaction(async (tx) => {
    return await tx.invoice.create({
      data: {
        companyId,
        invoiceNumber: data.invoiceNumber,
        invoiceDate: new Date(data.invoiceDate),
        customerName: data.customerName,
        customerTaxId: data.customerTaxId,
        customerEmail: data.customerEmail,
        currency: data.currency,
        subtotal: new Prisma.Decimal(subtotal.toFixed(2)),
        taxAmount: new Prisma.Decimal(taxAmount.toFixed(2)),
        totalAmount: new Prisma.Decimal(totalAmount.toFixed(2)),
        status: InvoiceStatus.PENDING,
        items: {
          create: data.items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: new Prisma.Decimal(item.unitPrice.toFixed(2)),
            tax: new Prisma.Decimal(item.tax.toFixed(2)),
            lineTotal: new Prisma.Decimal(item.lineTotal.toFixed(2)),
          })),
        },
        logs: {
          create: {
            level: 'INFO',
            message: 'Invoice created successfully and queued for external submission.',
          },
        },
      },
      include: {
        items: true,
        logs: true,
      },
    });
  });

 
  void processInvoiceAsync(invoice.id);

  return invoice;
}

export async function listInvoices(
  companyId: string,
  filters: z.infer<typeof listInvoiceQuerySchema>
) {
  const where: Prisma.InvoiceWhereInput = {
    companyId,
    ...(filters.status && { status: filters.status }),
    ...(filters.invoiceNumber && {
      invoiceNumber: { contains: filters.invoiceNumber, mode: 'insensitive' },
    }),
    ...(filters.invoiceDate && {
      invoiceDate: {
        gte: new Date(new Date(filters.invoiceDate).setHours(0, 0, 0, 0)),
        lte: new Date(new Date(filters.invoiceDate).setHours(23, 59, 59, 999)),
      },
    }),
  };

  const skip = (filters.page - 1) * filters.limit;

  const [totalCount, invoices] = await prisma.$transaction([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      skip,
      take: filters.limit,
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
      },
    }),
  ]);

  return {
    data: invoices,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      totalCount,
      totalPages: Math.ceil(totalCount / filters.limit),
    },
  };
}

export async function getInvoiceById(companyId: string, invoiceId: string) {
  return await prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      companyId,
    },
    include: {
      items: true,
      logs: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });
}

export async function retryFailedInvoice(companyId: string, invoiceId: string) {
  const result = await prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: { id: invoiceId, companyId },
    });

    if (!invoice) {
      return { status: 404, message: 'Invoice not found' };
    }

    if (invoice.status !== InvoiceStatus.FAILED) {
      return {
        status: 400,
        message: `Only invoices in FAILED status can be retried. Current status is ${invoice.status}`,
      };
    }

    const updated = await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        status: InvoiceStatus.PENDING,
        logs: {
          create: {
            level: 'INFO',
            message: 'Manual retry initiated. Resetting status to PENDING.',
          },
        },
      },
      include: {
        items: true,
        logs: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return { status: 200, data: updated };
  });

  
  if (result.status === 200 && result.data) {
    void processInvoiceAsync(result.data.id);
  }

  return result;
}