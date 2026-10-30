import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { createInvoiceSchema, listInvoiceQuerySchema } from './schema.js';
import * as invoiceService from './service.js';

export async function create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const companyId = req.user!.companyId;
    const validatedData = createInvoiceSchema.parse(req.body);
    const invoice = await invoiceService.createInvoice(companyId, validatedData);
    // 202: the invoice is accepted and stored. Government submission happens later, in the worker.
    res.status(202).json(invoice);
  } catch (error) {
    next(error);
  }
}

export async function list(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const companyId = req.user!.companyId;
    const validatedQuery = listInvoiceQuerySchema.parse(req.query);
    const result = await invoiceService.listInvoices(companyId, validatedQuery);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const companyId = req.user!.companyId;
    const { id } = req.params;
    const invoice = await invoiceService.getInvoiceById(companyId, id);

    if (!invoice) {
      res.status(404).json({ message: 'Invoice not found' });
      return;
    }

    res.status(200).json(invoice);
  } catch (error) {
    next(error);
  }
}

export async function retry(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const companyId = req.user!.companyId;
    const { id } = req.params;
    const result = await invoiceService.retryFailedInvoice(companyId, id);

    if (result.status !== 200) {
      res.status(result.status).json({ code: result.code, message: result.message });
      return;
    }

    res.status(200).json(result.data);
  } catch (error) {
    next(error);
  }
}