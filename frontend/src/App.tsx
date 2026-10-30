import React, { useState, useEffect } from 'react';
import { api } from './api';
import { Invoice, InvoiceItem, User } from './types';
import { LoginPage } from './features/auth/login-page';
import { InvoiceDashboard } from './features/invoices/invoice-dashboard';
import { CreateInvoicePage } from './features/invoices/create-invoice-page';
import { InvoiceDetailsPage } from './features/invoices/invoice-details-page';

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

  const fillDemoAccount = (demoEmail: string, demoPassword: string) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
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

  // 1. LOGIN SCREEN
  if (!user) {
    return (
      <LoginPage
        error={error}
        email={email}
        password={password}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        onSubmit={handleLogin}
        onFillAccount={fillDemoAccount}
      />
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

        {view === 'DASHBOARD' && (
          <InvoiceDashboard
            invoices={invoices}
            loading={loading}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            onViewDetails={openDetails}
          />
        )}

        {view === 'CREATE' && (
          <CreateInvoicePage
            invoiceNumber={invoiceNumber}
            onInvoiceNumberChange={setInvoiceNumber}
            invoiceDate={invoiceDate}
            onInvoiceDateChange={setInvoiceDate}
            currency={currency}
            onCurrencyChange={setCurrency}
            customerName={customerName}
            onCustomerNameChange={setCustomerName}
            customerTaxId={customerTaxId}
            onCustomerTaxIdChange={setCustomerTaxId}
            customerEmail={customerEmail}
            onCustomerEmailChange={setCustomerEmail}
            items={items}
            onUpdateItem={updateItem}
            onAddItem={addItem}
            onRemoveItem={removeItem}
            onSubmit={handleCreateInvoice}
            onCancel={() => setView('DASHBOARD')}
          />
        )}

        {view === 'DETAILS' && selectedInvoice && (
          <InvoiceDetailsPage
            invoice={selectedInvoice}
            onBack={() => setView('DASHBOARD')}
            onRetry={handleRetry}
          />
        )}
      </main>
    </div>
  );
}
