import { PrismaClient, InvoiceStatus, FailureType, Prisma } from '@prisma/client';
import { z } from 'zod';
import { createInvoiceSchema, listInvoiceQuerySchema } from './schema.js';
import { ENV } from '../../config/env.js';

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
        nextRetryAt: new Date(), // due immediately; the worker claims it
        maxAttempts: ENV.MAX_RETRY_ATTEMPTS,
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

  // Government submission never runs in the request. The worker process picks the row up.
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

export type RetryResult =
  | { status: 200; data: NonNullable<Awaited<ReturnType<typeof getInvoiceById>>> }
  | { status: 404 | 409; code: 'INVOICE_NOT_FOUND' | 'RETRY_NOT_ALLOWED'; message: string };

/**
 * Manual retry. Allowed only for FAILED invoices with failureType RETRYABLE.
 * The invoice goes back to PENDING and the worker picks it up. Attempt numbers keep
 * counting up, and maxAttempts is raised so the new cycle gets a full set of attempts.
 */
export async function retryFailedInvoice(companyId: string, invoiceId: string): Promise<RetryResult> {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: { id: invoiceId, companyId },
      select: { attemptCount: true },
    });

    if (!invoice) {
      return { status: 404, code: 'INVOICE_NOT_FOUND', message: 'Invoice not found' } as const;
    }

    // Conditional update: if the worker changed the row in the meantime, nothing matches.
    const updated = await tx.invoice.updateMany({
      where: {
        id: invoiceId,
        companyId,
        status: InvoiceStatus.FAILED,
        failureType: FailureType.RETRYABLE,
      },
      data: {
        status: InvoiceStatus.PENDING,
        failureType: null,
        nextRetryAt: new Date(),
        lockedUntil: null,
        maxAttempts: invoice.attemptCount + ENV.MAX_RETRY_ATTEMPTS,
      },
    });

    if (updated.count === 0) {
      return {
        status: 409,
        code: 'RETRY_NOT_ALLOWED',
        message: 'Only FAILED invoices with a retryable failure can be retried.',
      } as const;
    }

    await tx.processingLog.create({
      data: {
        invoiceId,
        level: 'INFO',
        message: 'Manual retry requested. The invoice is queued for another submission.',
      },
    });

    const data = await tx.invoice.findFirstOrThrow({
      where: { id: invoiceId, companyId },
      include: { items: true, logs: { orderBy: { createdAt: 'desc' } } },
    });

    return { status: 200, data } as const;
  });
}