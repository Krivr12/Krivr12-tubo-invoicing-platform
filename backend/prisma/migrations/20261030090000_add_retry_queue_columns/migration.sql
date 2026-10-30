-- CreateEnum
CREATE TYPE "FailureType" AS ENUM ('RETRYABLE', 'PERMANENT');

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "attemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "failureType" "FailureType",
ADD COLUMN     "lockedUntil" TIMESTAMP(3),
ADD COLUMN     "maxAttempts" INTEGER NOT NULL DEFAULT 8,
ADD COLUMN     "nextRetryAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "processing_logs" ADD COLUMN     "attemptNumber" INTEGER,
ADD COLUMN     "endedAt" TIMESTAMP(3),
ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "httpStatus" INTEGER,
ADD COLUMN     "processingStatus" "InvoiceStatus",
ADD COLUMN     "startedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "invoices_status_nextRetryAt_idx" ON "invoices"("status", "nextRetryAt");

-- CreateIndex
CREATE UNIQUE INDEX "processing_logs_invoiceId_attemptNumber_key" ON "processing_logs"("invoiceId", "attemptNumber");

-- Backfill rows created before the worker existed, so they are not left stuck.
-- Attempts completed under the old code were logged with a "[Attempt #" message prefix.
UPDATE "invoices" i
SET "attemptCount" = (
  SELECT COUNT(*) FROM "processing_logs" l
  WHERE l."invoiceId" = i."id" AND l."message" LIKE '[Attempt #%'
);

-- PENDING: due immediately, the worker picks them up.
UPDATE "invoices"
SET "nextRetryAt" = (now() AT TIME ZONE 'UTC')
WHERE "status" = 'PENDING';

-- PROCESSING: the old in-process submission is gone, so make the lease already expired.
UPDATE "invoices"
SET "lockedUntil" = (now() AT TIME ZONE 'UTC')
WHERE "status" = 'PROCESSING';

-- FAILED: allow manual retry, but no automatic retry (nextRetryAt stays NULL).
UPDATE "invoices"
SET "failureType" = 'RETRYABLE'
WHERE "status" = 'FAILED';
