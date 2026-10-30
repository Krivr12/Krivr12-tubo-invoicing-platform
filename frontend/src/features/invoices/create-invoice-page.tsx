import type { FormEvent } from 'react';
import type { InvoiceItem } from '../../types';

interface CreateInvoicePageProps {
  invoiceNumber: string;
  onInvoiceNumberChange: (value: string) => void;
  invoiceDate: string;
  onInvoiceDateChange: (value: string) => void;
  currency: string;
  onCurrencyChange: (value: string) => void;
  customerName: string;
  onCustomerNameChange: (value: string) => void;
  customerTaxId: string;
  onCustomerTaxIdChange: (value: string) => void;
  customerEmail: string;
  onCustomerEmailChange: (value: string) => void;
  items: InvoiceItem[];
  onUpdateItem: (index: number, field: keyof InvoiceItem, value: string | number) => void;
  onAddItem: () => void;
  onRemoveItem: (index: number) => void;
  onSubmit: (e: FormEvent) => void;
  onCancel: () => void;
}

export function CreateInvoicePage({
  invoiceNumber,
  onInvoiceNumberChange,
  invoiceDate,
  onInvoiceDateChange,
  currency,
  onCurrencyChange,
  customerName,
  onCustomerNameChange,
  customerTaxId,
  onCustomerTaxIdChange,
  customerEmail,
  onCustomerEmailChange,
  items,
  onUpdateItem,
  onAddItem,
  onRemoveItem,
  onSubmit,
  onCancel,
}: CreateInvoicePageProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
      <h2 className="text-lg font-semibold mb-4">Create New Invoice</h2>
      <form onSubmit={onSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
              Invoice Number *
            </label>
            <input
              type="text"
              placeholder="INV-10005"
              value={invoiceNumber}
              onChange={(e) => onInvoiceNumberChange(e.target.value)}
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
              onChange={(e) => onInvoiceDateChange(e.target.value)}
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
              onChange={(e) => onCurrencyChange(e.target.value.toUpperCase())}
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
              onChange={(e) => onCustomerNameChange(e.target.value)}
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
              onChange={(e) => onCustomerTaxIdChange(e.target.value)}
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
              onChange={(e) => onCustomerEmailChange(e.target.value)}
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
              onClick={onAddItem}
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
                    onChange={(e) => onUpdateItem(idx, 'description', e.target.value)}
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
                    onChange={(e) => onUpdateItem(idx, 'quantity', Number(e.target.value))}
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
                    onChange={(e) => onUpdateItem(idx, 'unitPrice', Number(e.target.value))}
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
                    onChange={(e) => onUpdateItem(idx, 'tax', Number(e.target.value))}
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
                      onClick={() => onRemoveItem(idx)}
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
            onClick={onCancel}
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
  );
}
