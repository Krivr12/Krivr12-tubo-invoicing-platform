import type { Invoice } from '../../types';
import { StatusBadge } from '../../components/status-badge';

interface InvoiceDashboardProps {
  invoices: Invoice[];
  loading: boolean;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  onViewDetails: (id: string) => void;
}

export function InvoiceDashboard({
  invoices,
  loading,
  statusFilter,
  onStatusFilterChange,
  onViewDetails,
}: InvoiceDashboardProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200">
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="text-lg font-semibold">Invoices</h2>
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm"
        >
          <option value="">All Statuses</option>
          <option value="PENDING">PENDING</option>
          <option value="PROCESSING">PROCESSING</option>
          <option value="SUBMITTED">SUBMITTED</option>
          <option value="FAILED">FAILED</option>
        </select>
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-500">Loading invoices...</div>
      ) : invoices.length === 0 ? (
        <div className="p-8 text-center text-slate-500">No invoices found.</div>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b text-slate-600">
            <tr>
              <th className="py-3 px-4">Invoice Number</th>
              <th className="py-3 px-4">Customer</th>
              <th className="py-3 px-4">Invoice Date</th>
              <th className="py-3 px-4">Amount</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-slate-50">
                <td className="py-3 px-4 font-medium">{inv.invoiceNumber}</td>
                <td className="py-3 px-4">{inv.customerName}</td>
                <td className="py-3 px-4">
                  {new Date(inv.invoiceDate).toLocaleDateString()}
                </td>
                <td className="py-3 px-4">
                  {inv.currency} {Number(inv.totalAmount).toFixed(2)}
                </td>
                <td className="py-3 px-4">
                  <StatusBadge status={inv.status} />
                </td>
                <td className="py-3 px-4 text-right">
                  <button
                    onClick={() => onViewDetails(inv.id)}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    View Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
