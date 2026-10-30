import { ENV } from './config/env.js';
import {
  claimDueInvoices,
  processClaimedInvoice,
  disconnectProcessor,
} from './modules/invoices/processor.js';

/**
 * Worker process. Runs separately from the API (npm run worker), so a worker crash or
 * restart does not stop the API. It polls the invoices table for due work.
 */

let running = true;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requestStop(signal: string): void {
  if (!running) process.exit(1); // second signal: stop immediately
  console.log(`[Worker] ${signal} received. Finishing the current batch, then stopping.`);
  running = false;
}

process.on('SIGINT', () => requestStop('SIGINT'));
process.on('SIGTERM', () => requestStop('SIGTERM'));

async function main(): Promise<void> {
  console.log(
    `[Worker] Started [${ENV.NODE_ENV}] batch=${ENV.WORKER_BATCH_SIZE} poll=${ENV.WORKER_POLL_INTERVAL_MS}ms`
  );

  while (running) {
    try {
      const claims = await claimDueInvoices(ENV.WORKER_BATCH_SIZE);

      if (claims.length === 0) {
        await sleep(ENV.WORKER_POLL_INTERVAL_MS);
        continue;
      }

      console.log(`[Worker] Claimed ${claims.length} invoice(s).`);
      await Promise.all(claims.map((claim) => processClaimedInvoice(claim)));
    } catch (err) {
      // For example the database is unavailable. Back off and keep the loop alive.
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[Worker] Loop error: ${message}`);
      await sleep(ENV.WORKER_POLL_INTERVAL_MS);
    }
  }

  await disconnectProcessor();
  console.log('[Worker] Stopped.');
}

void main();
