export type InvoiceStatus = 'PENDING' | 'PROCESSING' | 'SUBMITTED' | 'FAILED';

export interface InvoiceItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  tax: number;
  lineTotal: number;
}

export type FailureType = 'RETRYABLE' | 'PERMANENT';

export interface ProcessingLog {
  id: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  createdAt: string;
  attemptNumber?: number | null;
  startedAt?: string | null;
  endedAt?: string | null;
  httpStatus?: number | null;
  errorMessage?: string | null;
  processingStatus?: InvoiceStatus | null;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  customerName: string;
  customerTaxId: string;
  customerEmail: string;
  currency: string;
  subtotal: string | number;
  taxAmount: string | number;
  totalAmount: string | number;
  status: InvoiceStatus;
  failureType?: FailureType | null;
  attemptCount?: number;
  maxAttempts?: number;
  nextRetryAt?: string | null;
  createdAt: string;
  items?: InvoiceItem[];
  logs?: ProcessingLog[];
}

export interface User {
  id: string;
  email: string;
  name: string;
  company: {
    id: string;
    name: string;
  };
}