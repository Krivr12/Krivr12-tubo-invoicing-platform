import { Prisma, PrismaClient, FailureType, InvoiceStatus, LogLevel } from '@prisma/client';
import { ENV } from '../../config/env.js';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Government API stand-in (Part G)
// ---------------------------------------------------------------------------

class GovernmentTimeoutError extends Error {}

/**
 * Local stand-in for POST /government-api/invoices.
 * Randomly returns 200, 503, 400, or never answers (timeout).
 * Replace the body of this function with an HTTP call to GOVERNMENT_API_BASE_URL
 * when a real service exists. The idempotency key is sent as the Idempotency-Key
 * header so a repeated submission can be recognized.
 */
async function mockGovernmentApi(_idempotencyKey: string): Promise<{ httpStatus: number }> {
  // Simulate 2 to 3.5 seconds of network latency
  const latency = Math.floor(Math.random() * 1500) + 2000;
  await new Promise((resolve) => setTimeout(resolve, latency));

  const rand = Math.random();
  if (rand < 0.5) return { httpStatus: 200 }; // 50% success
  if (rand < 0.75) return { httpStatus: 503 }; // 25% temporary failure
  if (rand < 0.9) return { httpStatus: 400 }; // 15% invalid invoice
  return new Promise(() => {}); // 10% no response, caught by the timeout below
}

/** Calls the government service and enforces the timeout. httpStatus is null on timeout. */
async function submitToGovernment(idempotencyKey: string): Promise<{ httpStatus: number | null }> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new GovernmentTimeoutError()), ENV.GOVERNMENT_API_TIMEOUT_MS);
  });

  try {
    return await Promise.race([mockGovernmentApi(idempotencyKey), timeout]);
  } catch (err) {
    if (err instanceof GovernmentTimeoutError) return { httpStatus: null };
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Result classification and backoff (pure functions)
// ---------------------------------------------------------------------------

export interface AttemptOutcome {
  status: typeof InvoiceStatus.SUBMITTED | typeof InvoiceStatus.FAILED;
  failureType: FailureType | null;
  httpStatus: number | null;
  errorMessage: string | null;
  summary: string;
}

/** Maps the government result to an invoice outcome. 400 is permanent, everything else that fails is retryable. */
export function classifyGovernmentResult(httpStatus: number | null): AttemptOutcome {
  if (httpStatus === 200) {
    return {
      status: InvoiceStatus.SUBMITTED,
      failureType: null,
      httpStatus,
      errorMessage: null,
      summary: 'Invoice accepted by the government service (HTTP 200).',
    };
  }
  if (httpStatus === 400) {
    return {
      status: InvoiceStatus.FAILED,
      failureType: FailureType.PERMANENT,
      httpStatus,
      errorMessage: 'The government service rejected the invoice as invalid.',
      summary: 'Rejected as invalid (HTTP 400). Not retryable.',
    };
  }
  if (httpStatus === 503) {
    return {
      status: InvoiceStatus.FAILED,
      failureType: FailureType.RETRYABLE,
      httpStatus,
      errorMessage: 'The government service is temporarily unavailable.',
      summary: 'Government service temporarily unavailable (HTTP 503).',
    };
  }
  if (httpStatus === null) {
    return {
      status: InvoiceStatus.FAILED,
      failureType: FailureType.RETRYABLE,
      httpStatus,
      errorMessage: `No response from the government service within ${ENV.GOVERNMENT_API_TIMEOUT_MS} ms.`,
      summary: 'Timed out waiting for the government service.',
    };
  }
  return {
    status: InvoiceStatus.FAILED,
    failureType: FailureType.RETRYABLE,
    httpStatus,
    errorMessage: 'Unexpected response from the government service.',
    summary: `Unexpected response from the government service (HTTP ${httpStatus}).`,
  };
}

/** Exponential backoff with +/-20% jitter, capped at RETRY_MAX_DELAY_SECONDS. */
export function calculateNextRetryAt(attemptNumber: number, now: Date): Date {
  const exponential = ENV.RETRY_BASE_DELAY_SECONDS * 2 ** (attemptNumber - 1);
  const capped = Math.min(exponential, ENV.RETRY_MAX_DELAY_SECONDS);
  const jittered = capped * (0.8 + Math.random() * 0.4);
  return new Date(now.getTime() + jittered * 1000);
}

// ---------------------------------------------------------------------------
// Queue: claim due invoices
// ---------------------------------------------------------------------------

export interface ClaimedAttempt {
  invoiceId: string;
  attemptNumber: number;
}

/**
 * Claims up to `limit` due invoices with FOR UPDATE SKIP LOCKED, so several workers
 * never take the same row. Each claim increments attemptCount, sets a lock lease, and
 * opens one processing_logs row for the attempt, all in one transaction.
 *
 * Due means: PENDING, or FAILED + RETRYABLE with nextRetryAt reached, or PROCESSING
 * with an expired lock (a crashed worker). All require attempts left.
 */
export async function claimDueInvoices(limit: number): Promise<ClaimedAttempt[]> {
  const now = new Date();
  const lockedUntil = new Date(now.getTime() + ENV.WORKER_LOCK_SECONDS * 1000);

  return prisma.$transaction(async (tx) => {
    // Crashed attempts that have no attempts left: fail them so they are not stuck in PROCESSING.
    const exhausted = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
      UPDATE "invoices"
      SET "status" = 'FAILED', "failureType" = 'RETRYABLE', "nextRetryAt" = NULL,
          "lockedUntil" = NULL, "updatedAt" = ${now}
      WHERE "status" = 'PROCESSING' AND "lockedUntil" < ${now} AND "attemptCount" >= "maxAttempts"
      RETURNING "id"
    `);

    const claimed = await tx.$queryRaw<{ id: string; attemptCount: number }[]>(Prisma.sql`
      WITH due AS (
        SELECT "id" FROM "invoices"
        WHERE "attemptCount" < "maxAttempts"
          AND (
            ("status" = 'PENDING' AND "nextRetryAt" <= ${now})
            OR ("status" = 'FAILED' AND "failureType" = 'RETRYABLE' AND "nextRetryAt" <= ${now})
            OR ("status" = 'PROCESSING' AND "lockedUntil" < ${now})
          )
        ORDER BY "nextRetryAt" ASC NULLS LAST
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE "invoices" AS i
      SET "status" = 'PROCESSING', "attemptCount" = i."attemptCount" + 1,
          "lockedUntil" = ${lockedUntil}, "updatedAt" = ${now}
      FROM due
      WHERE i."id" = due."id"
      RETURNING i."id", i."attemptCount"
    `);

    // Close attempts left open by a crashed worker. Must run before the new attempt rows are created.
    const touchedIds = [...exhausted.map((row) => row.id), ...claimed.map((row) => row.id)];
    if (touchedIds.length > 0) {
      await tx.processingLog.updateMany({
        where: {
          invoiceId: { in: touchedIds },
          attemptNumber: { not: null },
          endedAt: null,
          processingStatus: InvoiceStatus.PROCESSING,
        },
        data: {
          level: LogLevel.WARN,
          endedAt: now,
          processingStatus: InvoiceStatus.FAILED,
          errorMessage: 'The worker stopped before recording a result (lock expired).',
        },
      });
    }

    if (claimed.length > 0) {
      await tx.processingLog.createMany({
        data: claimed.map((row) => ({
          invoiceId: row.id,
          level: LogLevel.INFO,
          message: `Attempt #${row.attemptCount} started: dispatching invoice to the government service.`,
          attemptNumber: row.attemptCount,
          startedAt: now,
          processingStatus: InvoiceStatus.PROCESSING,
        })),
      });
    }

    return claimed.map((row) => ({ invoiceId: row.id, attemptNumber: row.attemptCount }));
  });
}

// ---------------------------------------------------------------------------
// Process one claimed attempt
// ---------------------------------------------------------------------------

/**
 * Submits one claimed invoice and records the result on the invoice and on its attempt row.
 * If recording fails (for example the database is down), the invoice stays PROCESSING and
 * is reclaimed once its lock expires. The Idempotency-Key (the invoice id) lets the
 * government service recognize the repeated submission.
 */
export async function processClaimedInvoice(claim: ClaimedAttempt): Promise<void> {
  const { invoiceId, attemptNumber } = claim;

  try {
    const result = await submitToGovernment(invoiceId);
    const outcome = classifyGovernmentResult(result.httpStatus);
    await recordAttemptResult(claim, outcome);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[Worker] Attempt #${attemptNumber} for invoice ${invoiceId} was not recorded: ${message}`);
  }
}

async function recordAttemptResult(claim: ClaimedAttempt, outcome: AttemptOutcome): Promise<void> {
  const { invoiceId, attemptNumber } = claim;
  const endedAt = new Date();

  await prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
      select: { maxAttempts: true },
    });

    const isRetryable = outcome.failureType === FailureType.RETRYABLE;
    const willRetry = isRetryable && attemptNumber < invoice.maxAttempts;
    const nextRetryAt = willRetry ? calculateNextRetryAt(attemptNumber, endedAt) : null;

    // Only write if this attempt still owns the invoice. If the lock expired and another
    // worker reclaimed it, this late result is discarded.
    const updated = await tx.invoice.updateMany({
      where: { id: invoiceId, status: InvoiceStatus.PROCESSING, attemptCount: attemptNumber },
      data: {
        status: outcome.status,
        failureType: outcome.failureType,
        nextRetryAt,
        lockedUntil: null,
      },
    });
    if (updated.count === 0) return;

    let message = `[Attempt #${attemptNumber}] ${outcome.summary}`;
    if (willRetry && nextRetryAt) message += ` Retry scheduled for ${nextRetryAt.toISOString()}.`;
    if (isRetryable && !willRetry) message += ' Retry limit reached. A manual retry is allowed.';

    const level =
      outcome.status === InvoiceStatus.SUBMITTED ? LogLevel.INFO : willRetry ? LogLevel.WARN : LogLevel.ERROR;

    await tx.processingLog.update({
      where: { invoiceId_attemptNumber: { invoiceId, attemptNumber } },
      data: {
        level,
        message,
        endedAt,
        httpStatus: outcome.httpStatus,
        errorMessage: outcome.errorMessage,
        processingStatus: outcome.status,
        metadata: { failureType: outcome.failureType, nextRetryAt: nextRetryAt?.toISOString() ?? null },
      },
    });
  });
}

export async function disconnectProcessor(): Promise<void> {
  await prisma.$disconnect();
}
