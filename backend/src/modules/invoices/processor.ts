import { PrismaClient, InvoiceStatus, LogLevel } from '@prisma/client';

const prisma = new PrismaClient();

interface GovApiResponse {
  httpStatus: number;
  success: boolean;
  message: string;
}

/**
 * Simulates POST /government-api/invoices (Part G)
 * Randomly returns 200 OK, 503 Unavailable, 400 Invalid, or Timeout.
 */
async function mockGovernmentApi(): Promise<GovApiResponse> {
  // Simulate 2 to 3.5 seconds of network latency
  const latency = Math.floor(Math.random() * 1500) + 2000;
  await new Promise((resolve) => setTimeout(resolve, latency));

  const rand = Math.random();

  if (rand < 0.50) {
    // 50% chance of Success
    return {
      httpStatus: 200,
      success: true,
      message: 'HTTP 200 OK: Invoice validated and registered by Government Service.',
    };
  } else if (rand < 0.75) {
    // 25% chance of Temporary Failure
    return {
      httpStatus: 503,
      success: false,
      message: 'HTTP 503 Service Unavailable: Government invoicing service is temporarily overloaded.',
    };
  } else if (rand < 0.90) {
    // 15% chance of Invalid Invoice
    return {
      httpStatus: 400,
      success: false,
      message: 'HTTP 400 Bad Request: Customer Tax ID rejected by government validation rules.',
    };
  } else {
    // 10% chance of Network Timeout
    return {
      httpStatus: 504,
      success: false,
      message: 'Timeout: No response received from Government API within expected period.',
    };
  }
}

/**
 * Asynchronous Background Worker (Parts H & L)
 * Transitions PENDING -> PROCESSING -> SUBMITTED / FAILED
 */
export async function processInvoiceAsync(invoiceId: string): Promise<void> {
  const startedAt = new Date().toISOString();

  try {
    // Count previous attempts to track attempt number (Part L)
    const previousAttempts = await prisma.processingLog.count({
      where: {
        invoiceId,
        message: { startsWith: '[Attempt #' },
      },
    });
    const attemptNumber = previousAttempts + 1;

    // 1. Mark status as PROCESSING
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: InvoiceStatus.PROCESSING,
        logs: {
          create: {
            level: LogLevel.INFO,
            message: `Attempt #${attemptNumber} started: Dispatching invoice to POST /government-api/invoices...`,
            metadata: { attemptNumber, startedAt },
          },
        },
      },
    });

    // 2. Call external mock Government API
    const result = await mockGovernmentApi();
    const endedAt = new Date().toISOString();

    // 3. Record outcome & transition state to SUBMITTED or FAILED
    const nextStatus = result.success ? InvoiceStatus.SUBMITTED : InvoiceStatus.FAILED;
    const logLevel = result.success ? LogLevel.INFO : LogLevel.ERROR;

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: nextStatus,
        logs: {
          create: {
            level: logLevel,
            message: `[Attempt #${attemptNumber}] ${result.message}`,
            metadata: {
              attemptNumber,
              startedAt,
              endedAt,
              httpResponse: result.httpStatus,
              processingStatus: nextStatus,
            },
          },
        },
      },
    });
  } catch (err: any) {
    console.error(`[Worker Error] Failed processing invoice ${invoiceId}:`, err);
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: InvoiceStatus.FAILED,
        logs: {
          create: {
            level: LogLevel.ERROR,
            message: `Internal worker failure: ${err.message || 'Unknown error'}`,
          },
        },
      },
    });
  }
}