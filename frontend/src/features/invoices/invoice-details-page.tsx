import type { Invoice } from '../../types';
import { StatusBadge } from '../../components/status-badge';

interface InvoiceDetailsPageProps {
  invoice: Invoice;
  onBack: () => void;
  onRetry: (id: string) => void;
}

export function InvoiceDetailsPage({ invoice, onBack, onRetry }: InvoiceDetailsPageProps) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between border-b pb-4 mb-4">
          <div>
            <button
              onClick={onBack}
              className="text-xs text-blue-600 hover:underline mb-1 block"
            >
              &larr; Back to Dashboard
            </button>
            <h2 className="text-xl font-bold">{invoice.invoiceNumber}</h2>
          </div>
          <div className="flex items-center space-x-3">
            <StatusBadge status={invoice.status} />
            {invoice.status === 'FAILED' && invoice.failureType === 'RETRYABLE' && (
              <button
                onClick={() => onRetry(invoice.id)}
                className="bg-amber-600 text-white text-xs px-3 py-1.5 rounded font-medium hover:bg-amber-700"
              >
                Retry Submission
              </button>
            )}
          </div>
        </div>

        {invoice.status === 'FAILED' && invoice.failureType === 'PERMANENT' && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2 mb-4">
            The government service rejected this invoice. It cannot be retried.
          </p>
        )}
        {invoice.status === 'FAILED' && invoice.failureType === 'RETRYABLE' && invoice.nextRetryAt && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mb-4">
            Automatic retry scheduled for {new Date(invoice.nextRetryAt).toLocaleString()}.
          </p>
        )}
        {invoice.attemptCount !== undefined && invoice.attemptCount > 0 && (
          <p className="text-xs text-slate-500 mb-4">
            Submission attempts: {invoice.attemptCount}
          </p>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-6">
          <div>
            <p className="text-slate-500 text-xs">Customer</p>
            <p className="font-medium">{invoice.customerName}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs">Customer Tax ID</p>
            <p className="font-medium">{invoice.customerTaxId}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs">Customer Email</p>
            <p className="font-medium">{invoice.customerEmail}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs">Invoice Date</p>
            <p className="font-medium">
              {new Date(invoice.invoiceDate).toLocaleDateString()}
            </p>
          </div>
        </div>

        <h3 className="text-sm font-semibold mb-2">Line Items</h3>
        <table className="w-full text-left text-sm border mb-4">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="py-2 px-3">Description</th>
              <th className="py-2 px-3">Qty</th>
              <th className="py-2 px-3">Unit Price</th>
              <th className="py-2 px-3">Tax</th>
              <th className="py-2 px-3 text-right">Line Total</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {invoice.items?.map((item) => (
              <tr key={item.id}>
                <td className="py-2 px-3">{item.description}</td>
                <td className="py-2 px-3">{item.quantity}</td>
                <td className="py-2 px-3">{Number(item.unitPrice).toFixed(2)}</td>
                <td className="py-2 px-3">{Number(item.tax).toFixed(2)}</td>
                <td className="py-2 px-3 text-right font-medium">
                  {Number(item.lineTotal).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end">
          <div className="w-64 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Subtotal:</span>
              <span>{Number(invoice.subtotal).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Tax:</span>
              <span>{Number(invoice.taxAmount).toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold border-t pt-1">
              <span>Total ({invoice.currency}):</span>
              <span>{Number(invoice.totalAmount).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Processing Logs */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h3 className="text-sm font-semibold mb-3">Processing & Audit Logs</h3>
        <div className="space-y-2 text-xs">
          {invoice.logs?.map((log) => (
            <div
              key={log.id}
              className="flex items-center justify-between p-2.5 bg-slate-50 rounded border"
            >
              <div>
                <span className="font-mono font-bold mr-2 text-slate-700">[{log.level}]</span>
                <span>{log.message}</span>
                {log.attemptNumber != null && log.httpStatus != null && (
                  <span className="ml-2 text-slate-500">(HTTP {log.httpStatus})</span>
                )}
              </div>
              <span className="text-slate-400">
                {new Date(log.createdAt).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
