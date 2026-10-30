import React, { useState, useEffect } from 'react';
import { api } from './api';
import { Invoice, InvoiceItem, InvoiceStatus, User } from './types';

export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('tubo_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [view, setView] = useState<'DASHBOARD' | 'CREATE' | 'DETAILS'>('DASHBOARD');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{ field: string; message: string }[]>([]);

  // Login State
  const [email, setEmail] = useState('userA@alpha.com');
  const [password, setPassword] = useState('password123');

  // Create Form State
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [customerName, setCustomerName] = useState('');
  const [customerTaxId, setCustomerTaxId] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [items, setItems] = useState<InvoiceItem[]>([
    { description: '', quantity: 1, unitPrice: 0, tax: 0, lineTotal: 0 },
  ]);

  const fetchInvoices = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getInvoices(statusFilter || undefined);
      setInvoices(res.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && view === 'DASHBOARD') {
      fetchInvoices();
    }
  }, [user, view, statusFilter]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await api.login(email, password);
      localStorage.setItem('tubo_token', res.token);
      localStorage.setItem('tubo_user', JSON.stringify(res.user));
      setUser(res.user);
      setView('DASHBOARD');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('tubo_token');
    localStorage.removeItem('tubo_user');
    setUser(null);
  };

  // Dynamic Item Math Calculation
  const updateItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
    const updated = [...items];
    const current = { ...updated[index], [field]: value };

    const qty = Number(current.quantity) || 0;
    const price = Number(current.unitPrice) || 0;
    const tax = Number(current.tax) || 0;
    current.lineTotal = Number((qty * price + tax).toFixed(2));

    updated[index] = current;
    setItems(updated);
  };

  const addItem = () => {
    setItems([...items, { description: '', quantity: 1, unitPrice: 0, tax: 0, lineTotal: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setValidationErrors([]);

    try {
      await api.createInvoice({
        invoiceNumber,
        invoiceDate: new Date(invoiceDate).toISOString(),
        customerName,
        customerTaxId,
        customerEmail,
        currency,
        items: items.map((it) => ({
          description: it.description,
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
          tax: Number(it.tax),
          lineTotal: Number(it.lineTotal),
        })),
      });

      // Reset form & return to dashboard
      setInvoiceNumber('');
      setCustomerName('');
      setCustomerTaxId('');
      setCustomerEmail('');
      setItems([{ description: '', quantity: 1, unitPrice: 0, tax: 0, lineTotal: 0 }]);
      setView('DASHBOARD');
    } catch (err: any) {
      setError(err.message || 'Error creating invoice');
      if (err.errors) {
        setValidationErrors(err.errors);
      }
    }
  };

  const openDetails = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getInvoiceById(id);
      setSelectedInvoice(data);
      setView('DETAILS');
    } catch (err: any) {
      setError(err.message || 'Could not load invoice details');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async (id: string) => {
    setError(null);
    try {
      const updated = await api.retryInvoice(id);
      setSelectedInvoice(updated);
    } catch (err: any) {
      setError(err.message || 'Retry failed');
    }
  };

  const statusBadge = (status: InvoiceStatus) => {
    const colors: Record<InvoiceStatus, string> = {
      PENDING: 'bg-amber-100 text-amber-800',
      PROCESSING: 'bg-blue-100 text-blue-800',
      SUBMITTED: 'bg-emerald-100 text-emerald-800',
      FAILED: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${colors[status]}`}>
        {status}
      </span>
    );
  };

  // 1. LOGIN SCREEN
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md border border-slate-200">
          <h1 className="text-2xl font-bold mb-2">Tubo Invoicing</h1>
          <p className="text-sm text-slate-500 mb-6">Sign in to manage company electronic invoices</p>

          {error && <div className="bg-red-50 text-red-600 p-3 rounded text-sm mb-4">{error}</div>}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-slate-900 text-white py-2 rounded text-sm font-medium hover:bg-slate-800"
            >
              Sign In
            </button>
          </form>

          <div className="mt-6 pt-4 border-t text-xs text-slate-500 space-y-1">
            <p className="font-semibold">Quick Switch Demo Accounts:</p>
            <button
              onClick={() => { setEmail('userA@alpha.com'); setPassword('password123'); }}
              className="text-blue-600 underline block"
            >
              Fill Company A (userA@alpha.com)
            </button>
            <button
              onClick={() => { setEmail('userB@beta.com'); setPassword('password123'); }}
              className="text-blue-600 underline block"
            >
              Fill Company B (userB@beta.com)
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1
            onClick={() => setView('DASHBOARD')}
            className="text-xl font-bold cursor-pointer"
          >
            Tubo
          </h1>
          <span className="text-xs bg-slate-100 px-2.5 py-1 rounded font-medium text-slate-700">
            {user.company.name} ({user.email})
          </span>
        </div>
        <div className="space-x-3">
          <button
            onClick={() => { setError(null); setValidationErrors([]); setView('DASHBOARD'); }}
            className={`text-sm px-3 py-1.5 rounded ${view === 'DASHBOARD' ? 'bg-slate-200 font-medium' : 'hover:bg-slate-100'}`}
          >
            Dashboard
          </button>
          <button
            onClick={() => { setError(null); setValidationErrors([]); setView('CREATE'); }}
            className="text-sm bg-slate-900 text-white px-4 py-1.5 rounded hover:bg-slate-800"
          >
            + Create Invoice
          </button>
          <button
            onClick={handleLogout}
            className="text-sm text-red-600 px-3 py-1.5 hover:bg-red-50 rounded"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded mb-6 text-sm">
            <p className="font-semibold">{error}</p>
            {validationErrors.length > 0 && (
              <ul className="list-disc pl-5 mt-2 space-y-1">
                {validationErrors.map((err, i) => (
                  <li key={i}>
                    <span className="font-mono text-xs">{err.field}:</span> {err.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* 2. INVOICE DASHBOARD */}
        {view === 'DASHBOARD' && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">Invoices</h2>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
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
                      <td className="py-3 px-4">{statusBadge(inv.status)}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => openDetails(inv.id)}
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
        )}

        {/* 3. CREATE INVOICE FORM */}
        {view === 'CREATE' && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Create New Invoice</h2>
            <form onSubmit={handleCreateInvoice} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                    Invoice Number *
                  </label>
                  <input
                    type="text"
                    placeholder="INV-10005"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                    Invoice Date *
                  </label>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                    Currency *
                  </label>
                  <input
                    type="text"
                    maxLength={3}
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                    className="w-full border rounded px-3 py-2 text-sm"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    placeholder="Acme Corp"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                    Customer Tax ID *
                  </label>
                  <input
                    type="text"
                    placeholder="TIN-000-111"
                    value={customerTaxId}
                    onChange={(e) => setCustomerTaxId(e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                    Customer Email *
                  </label>
                  <input
                    type="email"
                    placeholder="billing@acme.com"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm"
                    required
                  />
                </div>
              </div>

              {/* Invoice Line Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold uppercase text-slate-600">
                    Invoice Items
                  </label>
                  <button
                    type="button"
                    onClick={addItem}
                    className="text-xs bg-slate-100 hover:bg-slate-200 px-3 py-1 rounded font-medium"
                  >
                    + Add Item
                  </button>
                </div>

                <div className="space-y-3">
                  {items.map((item, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-12 gap-2 items-end bg-slate-50 p-3 rounded border"
                    >
                      <div className="col-span-4">
                        <label className="block text-xs text-slate-500 mb-1">Description</label>
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateItem(idx, 'description', e.target.value)}
                          className="w-full border rounded px-2 py-1.5 text-sm bg-white"
                          required
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs text-slate-500 mb-1">Qty</label>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value))}
                          className="w-full border rounded px-2 py-1.5 text-sm bg-white"
                          required
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs text-slate-500 mb-1">Unit Price</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(idx, 'unitPrice', Number(e.target.value))}
                          className="w-full border rounded px-2 py-1.5 text-sm bg-white"
                          required
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs text-slate-500 mb-1">Tax</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.tax}
                          onChange={(e) => updateItem(idx, 'tax', Number(e.target.value))}
                          className="w-full border rounded px-2 py-1.5 text-sm bg-white"
                          required
                        />
                      </div>
                      <div className="col-span-1">
                        <label className="block text-xs text-slate-500 mb-1">Total</label>
                        <div className="py-1.5 text-sm font-semibold">
                          {item.lineTotal.toFixed(2)}
                        </div>
                      </div>
                      <div className="col-span-1 text-right">
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            className="text-red-500 hover:text-red-700 text-xs py-1.5"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setView('DASHBOARD')}
                  className="px-4 py-2 border rounded text-sm hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 text-white rounded text-sm font-medium hover:bg-slate-800"
                >
                  Submit Invoice
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 4. INVOICE DETAILS VIEW */}
        {view === 'DETAILS' && selectedInvoice && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between border-b pb-4 mb-4">
                <div>
                  <button
                    onClick={() => setView('DASHBOARD')}
                    className="text-xs text-blue-600 hover:underline mb-1 block"
                  >
                    &larr; Back to Dashboard
                  </button>
                  <h2 className="text-xl font-bold">{selectedInvoice.invoiceNumber}</h2>
                </div>
                <div className="flex items-center space-x-3">
                  {statusBadge(selectedInvoice.status)}
                  {selectedInvoice.status === 'FAILED' && (
                    <button
                      onClick={() => handleRetry(selectedInvoice.id)}
                      className="bg-amber-600 text-white text-xs px-3 py-1.5 rounded font-medium hover:bg-amber-700"
                    >
                      Retry Submission
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-6">
                <div>
                  <p className="text-slate-500 text-xs">Customer</p>
                  <p className="font-medium">{selectedInvoice.customerName}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Customer Tax ID</p>
                  <p className="font-medium">{selectedInvoice.customerTaxId}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Customer Email</p>
                  <p className="font-medium">{selectedInvoice.customerEmail}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Invoice Date</p>
                  <p className="font-medium">
                    {new Date(selectedInvoice.invoiceDate).toLocaleDateString()}
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
                  {selectedInvoice.items?.map((item) => (
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
                    <span>{Number(selectedInvoice.subtotal).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Tax:</span>
                    <span>{Number(selectedInvoice.taxAmount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t pt-1">
                    <span>Total ({selectedInvoice.currency}):</span>
                    <span>{Number(selectedInvoice.totalAmount).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Processing Logs */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <h3 className="text-sm font-semibold mb-3">Processing & Audit Logs</h3>
              <div className="space-y-2 text-xs">
                {selectedInvoice.logs?.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between p-2.5 bg-slate-50 rounded border"
                  >
                    <div>
                      <span className="font-mono font-bold mr-2 text-slate-700">[{log.level}]</span>
                      <span>{log.message}</span>
                    </div>
                    <span className="text-slate-400">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}