import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import useAuthStore from '@/app/store/authStore';
import { format } from 'date-fns';
import DatePicker from '@/components/ui/DatePicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Plus, Search, FileSearch, CheckCircle2, Clock, X, Eye,
  ArrowLeft, Loader2, AlertTriangle, ChevronDown, Building2,
  Percent, Hash, Calendar, Package, BarChart3, Shield, Trash2, Edit,
  ShoppingCart
} from 'lucide-react';
import Swal from 'sweetalert2';

const GST_RATES = [0, 5, 12, 18, 28];
const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'];
const PAYMENT_MODES = ['Bank Transfer (NEFT)', 'Bank Transfer (RTGS)', 'Cheque', 'DD', 'Online Portal', 'Letter of Credit', 'Cash/Direct'];

const STATUS_STYLES = {
  Draft: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  Sent: 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border-blue-200 dark:border-blue-900/50',
  Received: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200 dark:border-amber-900/50',
  Evaluated: 'bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400 border-violet-200 dark:border-violet-900/50',
  'PO Issued': 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50',
  Expired: 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border-rose-200 dark:border-rose-900/50',
};

function PQDetailModal({ pq, onClose }) {
  const totalBeforeTax = Number(pq.subtotal || 0);
  const gstAmount = Number(pq.taxAmount || 0);
  const cgst = Number(pq.cgst || 0);
  const sgst = Number(pq.sgst || 0);
  const igst = Number(pq.igst || 0);
  const discount = Number(pq.discount || 0);
  const shippingCharges = Number(pq.shippingCharges || 0);
  const otherCharges = Number(pq.otherCharges || 0);
  const roundOff = Number(pq.roundOff || 0);
  const grandTotal = Number(pq.grandTotal || 0);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200/60 dark:border-slate-800 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-6 py-4 flex items-center justify-between z-10 rounded-t-3xl">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white font-mono">{pq.pqNo}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{pq.vendorName} • {format(new Date(pq.createdAt), 'dd MMM yyyy')}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${STATUS_STYLES[pq.status] || STATUS_STYLES.Draft}`}>{pq.status}</span>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-slate-50/50 dark:bg-slate-800/20 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/60">
            {[
              { label: 'Vendor Name', value: pq.vendorName },
              { label: 'GSTIN', value: pq.vendorGstin || '—' },
              { label: 'Currency', value: pq.currency },
              { label: 'Payment Terms', value: pq.paymentTerms },
              { label: 'Payment Mode', value: pq.paymentMode || '—' },
              { label: 'Validity Date', value: pq.validityDate ? format(new Date(pq.validityDate), 'dd MMM yyyy') : '—' },
              { label: 'Expected Delivery Date', value: pq.expectedDelivery ? format(new Date(pq.expectedDelivery), 'dd MMM yyyy') : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
                <p className="font-semibold text-slate-850 dark:text-slate-200 text-xs truncate" title={value}>{value}</p>
              </div>
            ))}
          </div>

          {pq.items && pq.items.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800">
                  <tr>
                    {['Item Description', 'HSN/SAC', 'Qty', 'Unit', 'Unit Price', 'GST%', 'GST Amt', 'Total'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {pq.items.map((item, i) => (
                    <tr key={i} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                      <td className="px-3 py-2.5 font-medium text-slate-800 dark:text-slate-200">{item.itemDescription}</td>
                      <td className="px-3 py-2.5 font-mono text-slate-500">{item.hsnSac}</td>
                      <td className="px-3 py-2.5">{item.quantity}</td>
                      <td className="px-3 py-2.5">{item.unit}</td>
                      <td className="px-3 py-2.5">₹{Number(item.unitPrice).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-3 py-2.5">{item.gstRate}%</td>
                      <td className="px-3 py-2.5">₹{Number(item.gstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-3 py-2.5 font-bold">₹{Number(item.totalWithGst).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-700">
                  <tr>
                    <td colSpan={6} className="px-3 py-2 text-right font-bold text-slate-550 text-xs">Taxable Value:</td>
                    <td colSpan={2} className="px-3 py-2 font-bold text-slate-900 dark:text-white">₹{totalBeforeTax.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                  {igst > 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-2 text-right font-bold text-slate-550 text-xs">IGST:</td>
                      <td colSpan={2} className="px-3 py-2 font-bold text-slate-900 dark:text-white">₹{igst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  ) : (
                    <>
                      <tr>
                        <td colSpan={6} className="px-3 py-2 text-right font-bold text-slate-550 text-xs">CGST:</td>
                        <td colSpan={2} className="px-3 py-2 font-bold text-slate-900 dark:text-white">₹{cgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                      <tr>
                        <td colSpan={6} className="px-3 py-2 text-right font-bold text-slate-550 text-xs">SGST:</td>
                        <td colSpan={2} className="px-3 py-2 font-bold text-slate-900 dark:text-white">₹{sgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                    </>
                  )}
                  {shippingCharges > 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-2 text-right font-bold text-slate-550 text-xs">Freight Charges:</td>
                      <td colSpan={2} className="px-3 py-2 font-bold text-slate-900 dark:text-white">₹{shippingCharges.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  )}
                  {Number(pq.loadingCharges || 0) > 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-2 text-right font-bold text-slate-550 text-xs">Loading Charges:</td>
                      <td colSpan={2} className="px-3 py-2 font-bold text-slate-900 dark:text-white">₹{Number(pq.loadingCharges).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  )}
                  {Number(pq.unloadingCharges || 0) > 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-2 text-right font-bold text-slate-550 text-xs">Unloading Charges:</td>
                      <td colSpan={2} className="px-3 py-2 font-bold text-slate-900 dark:text-white">₹{Number(pq.unloadingCharges).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  )}
                  {Number(pq.packingCharges || 0) > 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-2 text-right font-bold text-slate-550 text-xs">Packing Charges:</td>
                      <td colSpan={2} className="px-3 py-2 font-bold text-slate-900 dark:text-white">₹{Number(pq.packingCharges).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  )}
                  {Number(pq.insurance || 0) > 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-2 text-right font-bold text-slate-550 text-xs">Insurance:</td>
                      <td colSpan={2} className="px-3 py-2 font-bold text-slate-900 dark:text-white">₹{Number(pq.insurance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  )}
                  {otherCharges > 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-2 text-right font-bold text-slate-550 text-xs">Other Charges:</td>
                      <td colSpan={2} className="px-3 py-2 font-bold text-slate-900 dark:text-white">₹{otherCharges.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  )}
                  {discount > 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-2 text-right font-bold text-rose-500 text-xs">Discount:</td>
                      <td colSpan={2} className="px-3 py-2 font-bold text-rose-600">-₹{discount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  )}
                  {roundOff !== 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-2 text-right font-bold text-slate-550 text-xs">Round Off:</td>
                      <td colSpan={2} className="px-3 py-2 font-bold text-slate-900 dark:text-white">{(roundOff >= 0 ? '+' : '')}₹{roundOff.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  )}
                  <tr className="border-t-2 border-slate-300 dark:border-slate-600 bg-indigo-50/50 dark:bg-indigo-950/20">
                    <td colSpan={6} className="px-3 py-3.5 text-right text-xs font-black text-slate-650 dark:text-slate-300 uppercase tracking-wider">Grand Total:</td>
                    <td colSpan={2} className="px-3 py-3.5 font-black text-base text-indigo-600 dark:text-indigo-400">₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {pq.termsAndConditions && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Terms & Conditions</p>
              <p className="text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl">{pq.termsAndConditions}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const CATEGORY_MAP = {
  'IT Equipment': { hsn: '8471', gst: 18 },
  'Machinery & Plant': { hsn: '8422', gst: 18 },
  'Furniture & Fixtures': { hsn: '9403', gst: 18 },
  'Vehicles': { hsn: '8703', gst: 28 },
  'Infrastructure': { hsn: '7308', gst: 18 },
  'Office Equipment': { hsn: '8472', gst: 18 },
  'Intangible Assets': { hsn: '9973', gst: 18 }
};

import QuickAddSupplierModal from '@/components/forms/QuickAddSupplierModal';
const AddSupplierInline = QuickAddSupplierModal;

// Searchable Supplier Dropdown Component
function SupplierSelect({ suppliers, value, onChange, onAddNew }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = React.useRef(null);

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    (s.phone && s.phone.toLowerCase().includes(search.toLowerCase()))
  );

  React.useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="flex gap-2 w-full">
      <div ref={containerRef} className="relative flex-1">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={`w-full px-4 h-[42px] border rounded-xl text-left flex items-center justify-between transition-all duration-200 shadow-sm ${
            open ? 'bg-indigo-50/50 border-indigo-400 ring-4 ring-indigo-500/10 dark:bg-indigo-900/10 dark:border-indigo-500' : 'bg-slate-50/50 dark:bg-slate-900/50 border-slate-300 dark:border-slate-700 hover:border-indigo-400 hover:bg-white dark:hover:bg-slate-800'
          }`}
        >
          <span className={value ? 'text-slate-900 dark:text-white truncate font-medium text-sm' : 'text-slate-500 dark:text-slate-400 text-sm'}>
            {value ? `${value.name} (${value.phone || 'N/A'})` : 'Select Supplier...'}
          </span>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180 text-indigo-500' : ''}`} />
        </button>
        {open && (
          <div className="absolute z-50 mt-2 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="p-2 border-b border-slate-100 dark:border-slate-700 relative bg-slate-50/50 dark:bg-slate-900/50">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search Supplier Name or Phone..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all dark:text-white"
                autoFocus
              />
            </div>
            <ul className="max-h-60 overflow-y-auto p-1">
              {filtered.length === 0 ? (
                <li className="px-4 py-8 text-sm text-slate-500 flex flex-col items-center justify-center">
                  <Search className="w-6 h-6 text-slate-300 mb-2" />
                  No suppliers found
                </li>
              ) : (
                filtered.map(s => (
                  <li
                    key={s.id}
                    onMouseDown={() => { onChange(s); setOpen(false); setSearch(''); }}
                    className="px-4 py-2.5 mx-1 my-0.5 rounded-lg text-sm cursor-pointer hover:bg-indigo-50 hover:text-indigo-700 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300 transition-colors flex items-center justify-between group"
                  >
                    <span className="font-medium text-slate-700 group-hover:text-indigo-700 dark:text-slate-300 dark:group-hover:text-indigo-300">{s.name}</span>
                    <span className="text-xs text-slate-400 group-hover:text-indigo-500/70">{s.phone}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>
      <Button type="button" onClick={onAddNew} className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 px-4 rounded-xl shadow-sm shadow-indigo-600/20 transition-all hover:shadow-md h-[42px]">
        <Plus className="w-5 h-5" />
      </Button>
    </div>
  );
}

function PRSelect({ prs = [], value, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = React.useRef(null);

  const sortedPRs = [...prs].sort((a, b) => {
    if (a.createdAt && b.createdAt) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    }
    return b.prNo.localeCompare(a.prNo);
  });

  const filtered = sortedPRs.filter(p =>
    p.prNo.toLowerCase().includes(search.toLowerCase()) ||
    (p.assetName && p.assetName.toLowerCase().includes(search.toLowerCase()))
  );

  React.useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full px-4 h-10 border rounded-xl text-left flex items-center justify-between transition-all duration-200 shadow-sm ${
          open ? 'bg-indigo-50/50 border-indigo-400 ring-4 ring-indigo-500/10 dark:bg-indigo-900/10 dark:border-indigo-500' : 'bg-slate-50/50 dark:bg-slate-900/50 border-slate-300 dark:border-slate-700 hover:border-indigo-400 hover:bg-white dark:hover:bg-slate-800'
        }`}
      >
        <span className={value ? 'text-slate-900 dark:text-white truncate font-medium text-sm' : 'text-slate-500 dark:text-slate-400 text-sm'}>
          {value ? `${value.prNo} — ${value.assetName || 'Asset Request'}` : 'Select Purchase Request...'}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180 text-indigo-500' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-2 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-2 border-b border-slate-100 dark:border-slate-700 relative bg-slate-50/50 dark:bg-slate-900/50">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search PR No or Asset Name..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all dark:text-white"
              autoFocus
            />
          </div>
          <ul className="max-h-60 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <li className="px-4 py-8 text-sm text-slate-500 flex flex-col items-center justify-center">
                <Search className="w-6 h-6 text-slate-300 mb-2" />
                No purchase requests found
              </li>
            ) : (
              filtered.map(p => (
                <li
                  key={p.id}
                  onMouseDown={() => { onChange(p); setOpen(false); setSearch(''); }}
                  className="px-4 py-2.5 mx-1 my-0.5 rounded-lg text-sm cursor-pointer hover:bg-indigo-50 hover:text-indigo-700 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300 transition-colors flex flex-col justify-start group"
                >
                  <span className="font-semibold text-slate-700 dark:text-slate-300 group-hover:text-indigo-700 dark:group-hover:text-indigo-300">{p.prNo}</span>
                  <span className="text-xs text-slate-400 mt-0.5">{p.assetName} • Qty {p.quantity} • {p.preferredVendor || 'No Preferred Vendor'}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function ChargeRow({ label, fieldKey, value, gstChecked, isInterState, onChange, onGstChange }) {
  const numVal = Number(value || 0);
  const gstLabel = isInterState ? 'IGST 18%' : 'GST 18% (CGST+SGST)';
  const gstAmt = gstChecked && numVal > 0 ? numVal * 0.18 : 0;
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/60 rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{label}</Label>
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={gstChecked}
            onChange={e => onGstChange(e.target.checked)}
            className="w-3.5 h-3.5 rounded accent-indigo-600"
          />
          <span className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400">{gstLabel}</span>
        </label>
      </div>
      <Input
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="0.00"
        className="h-8 rounded-lg text-sm"
      />
      {gstChecked && numVal > 0 && (
        <p className="text-[10px] text-indigo-500 font-medium">
          + GST: ₹{gstAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </p>
      )}
    </div>
  );
}

function CreatePQForm({ onBack, isReadOnly, editPQId }) {
  const [isInterState, setIsInterState] = useState(false);
  const [form, setForm] = useState({
    prId: '',
    prNo: 'Direct',
    vendorName: '',
    vendorGstin: '',
    vendorPan: '',
    vendorAddress: '',
    phone: '',
    email: '',
    contactPerson: '',
    currency: 'INR',
    paymentTerms: 'Net 30',
    paymentMode: 'Bank Transfer (NEFT)',
    validityDate: null,
    expectedDelivery: null,
    discount: '',
    shippingCharges: '', // freight
    loadingCharges: '',
    unloadingCharges: '',
    packingCharges: '',
    insurance: '',
    otherCharges: '',
    applyGst: true,
    termsAndConditions: '',
    items: [{ category: 'IT Equipment', itemDescription: '', hsnSac: '8471', quantity: 1, unit: 'Nos', unitPrice: '', gstRate: 18 }],
  });

  const [chargeGstStates, setChargeGstStates] = useState({
    shippingCharges: false,
    loadingCharges: false,
    unloadingCharges: false,
    packingCharges: false,
    insurance: false,
    otherCharges: false,
  });

  const [error, setError] = useState('');
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const qc = useQueryClient();
  const isPrLinked = form.prNo && form.prNo !== 'Direct';

  const { data: prs = [] } = useQuery({
    queryKey: ['asset-prs-approved'],
    queryFn: () => api.get('/asset-management/requests').then(r => r.data.filter(p => p.status === 'Approved')),
  });

  const { data: suppliers = [], refetch: refetchSuppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api.get('/parties/suppliers').then(r => r.data?.data || r.data || []),
  });

  const { data: editPQ } = useQuery({
    queryKey: ['asset-pq', editPQId],
    queryFn: () => api.get(`/asset-management/quotations/${editPQId}`).then(r => r.data),
    enabled: !!editPQId,
  });

  useEffect(() => {
    if (editPQ) {
      const supplier = suppliers.find(s => s.name.toLowerCase() === editPQ.vendorName.toLowerCase());
      setIsInterState(editPQ.stateCode ? editPQ.stateCode !== '27' : (editPQ.vendorGstin ? editPQ.vendorGstin.substring(0, 2) !== '27' : false));
      setForm({
        prId: prs.find(p => p.prNo === editPQ.prNo)?.id || '',
        prNo: editPQ.prNo || 'Direct',
        vendorName: editPQ.vendorName || '',
        vendorGstin: editPQ.vendorGstin || supplier?.gstin || '',
        vendorPan: editPQ.vendorPan || supplier?.pan || '',
        vendorAddress: editPQ.address || supplier?.address || '',
        phone: editPQ.phone || supplier?.phone || '',
        email: editPQ.email || supplier?.email || '',
        contactPerson: editPQ.contactPerson || supplier?.contactPerson || '',
        currency: editPQ.currency || 'INR',
        paymentTerms: editPQ.paymentTerms || 'Net 30',
        paymentMode: editPQ.paymentMode || 'Bank Transfer (NEFT)',
        validityDate: editPQ.validityDate ? new Date(editPQ.validityDate) : null,
        expectedDelivery: editPQ.expectedDelivery ? new Date(editPQ.expectedDelivery) : null,
        discount: editPQ.discount !== undefined ? String(editPQ.discount) : '',
        shippingCharges: editPQ.shippingCharges !== undefined ? String(editPQ.shippingCharges) : '',
        loadingCharges: editPQ.loadingCharges !== undefined ? String(editPQ.loadingCharges) : '',
        unloadingCharges: editPQ.unloadingCharges !== undefined ? String(editPQ.unloadingCharges) : '',
        packingCharges: editPQ.packingCharges !== undefined ? String(editPQ.packingCharges) : '',
        insurance: editPQ.insurance !== undefined ? String(editPQ.insurance) : '',
        otherCharges: editPQ.otherCharges !== undefined ? String(editPQ.otherCharges) : '',
        applyGst: editPQ.applyGst !== undefined ? Boolean(editPQ.applyGst) : true,
        termsAndConditions: editPQ.termsAndConditions || '',
        items: editPQ.items?.map(item => ({
          category: item.category,
          itemDescription: item.itemDescription,
          hsnSac: item.hsnSac,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: String(item.unitPrice),
          gstRate: Number(item.gstRate)
        })) || [],
      });

      if (editPQ.chargeGstStates) {
        try {
          const parsed = typeof editPQ.chargeGstStates === 'string'
            ? JSON.parse(editPQ.chargeGstStates)
            : editPQ.chargeGstStates;
          setChargeGstStates({
            shippingCharges: !!parsed.shippingCharges,
            loadingCharges: !!parsed.loadingCharges,
            unloadingCharges: !!parsed.unloadingCharges,
            packingCharges: !!parsed.packingCharges,
            insurance: !!parsed.insurance,
            otherCharges: !!parsed.otherCharges,
          });
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, [editPQ, prs, suppliers]);

  useEffect(() => {
    if (form.vendorGstin && form.vendorGstin.trim().length >= 2) {
      const stateCode = form.vendorGstin.trim().substring(0, 2);
      if (/^\d+$/.test(stateCode)) {
        setIsInterState(stateCode !== '27');
      }
    }
  }, [form.vendorGstin]);

  const calcTotals = (item) => {
    const base = Number(item.quantity) * Number(item.unitPrice || 0);
    const gst = form.applyGst ? base * (Number(item.gstRate) / 100) : 0;
    return { totalBeforeTax: base, gstAmount: gst, totalWithGst: base + gst };
  };

  const totals = form.items.reduce((acc, item) => {
    const c = calcTotals(item);
    return {
      taxable: acc.taxable + c.totalBeforeTax,
      gst: acc.gst + c.gstAmount,
      total: acc.total + c.totalWithGst
    };
  }, { taxable: 0, gst: 0, total: 0 });

  const freight = Number(form.shippingCharges || 0);
  const loadingCharges = Number(form.loadingCharges || 0);
  const unloadingCharges = Number(form.unloadingCharges || 0);
  const packingCharges = Number(form.packingCharges || 0);
  const insurance = Number(form.insurance || 0);
  const otherCharges = Number(form.otherCharges || 0);
  const discount = Number(form.discount || 0);

  const calcChargeGst = (val, key) => chargeGstStates[key] && Number(val) > 0 ? Number(val) * 0.18 : 0;
  const extraGst = form.applyGst ? (
    calcChargeGst(freight, 'shippingCharges') +
    calcChargeGst(loadingCharges, 'loadingCharges') +
    calcChargeGst(unloadingCharges, 'unloadingCharges') +
    calcChargeGst(packingCharges, 'packingCharges') +
    calcChargeGst(insurance, 'insurance') +
    calcChargeGst(otherCharges, 'otherCharges')
  ) : 0;

  const preRoundTotal = totals.taxable + totals.gst + extraGst + freight + loadingCharges + unloadingCharges + packingCharges + insurance + otherCharges - discount;
  const grandTotal = Math.round(preRoundTotal);
  const roundOff = grandTotal - preRoundTotal;

  const mutation = useMutation({
    mutationFn: data => {
      if (editPQId) {
        return api.put(`/asset-management/quotations/${editPQId}`, data).then(r => r.data);
      }
      return api.post('/asset-management/quotations', data).then(r => r.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asset-pqs'] });
      const text = editPQId ? 'Purchase Quotation updated successfully.' : 'Purchase Quotation recorded successfully.';
      Swal.fire({ icon: 'success', title: editPQId ? 'Quotation Updated!' : 'Quotation Saved!', text, confirmButtonColor: '#4f46e5' }).then(() => onBack());
    },
    onError: err => setError(err.response?.data?.error || 'Failed to save'),
  });

  const handleSubmit = e => {
    e.preventDefault();
    setError('');
    if (!form.vendorName) { setError('Vendor name is required'); return; }
    if (form.items.some(i => !i.itemDescription || !i.unitPrice)) { setError('All item fields are required'); return; }
    const payload = {
      ...form,
      stateCode: isInterState ? (form.vendorGstin && form.vendorGstin.length >= 2 ? form.vendorGstin.substring(0, 2) : '29') : '27',
      isInterState,
      discount: Number(form.discount || 0),
      shippingCharges: Number(form.shippingCharges || 0),
      loadingCharges: Number(form.loadingCharges || 0),
      unloadingCharges: Number(form.unloadingCharges || 0),
      packingCharges: Number(form.packingCharges || 0),
      insurance: Number(form.insurance || 0),
      otherCharges: Number(form.otherCharges || 0),
      chargeGstStates,
      items: form.items.map(i => {
        const c = calcTotals(i);
        return {
          ...i,
          baseAmount: c.totalBeforeTax,
          gstAmount: c.gstAmount,
          cgst: isInterState ? 0 : c.gstAmount / 2,
          sgst: isInterState ? 0 : c.gstAmount / 2,
          igst: isInterState ? c.gstAmount : 0,
          discountedPrice: Number(i.unitPrice),
          lineTotal: c.totalWithGst,
          specMatch: 'Yes'
        };
      }),
    };
    mutation.mutate(payload);
  };

  const update = (f, v) => setForm(p => ({ ...p, [f]: v }));
  const updateItem = (idx, f, v) => setForm(p => ({ ...p, items: p.items.map((item, i) => i === idx ? { ...item, [f]: v } : item) }));
  const addItem = () => setForm(p => ({ ...p, items: [...p.items, { category: 'IT Equipment', itemDescription: '', hsnSac: '8471', quantity: 1, unit: 'Nos', unitPrice: '', gstRate: 18 }] }));
  const removeItem = idx => setForm(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));

  const handleCategoryChange = (idx, category) => {
    const mapDetails = CATEGORY_MAP[category] || { hsn: '8471', gst: 18 };
    setForm(p => ({
      ...p,
      items: p.items.map((item, i) => i === idx ? {
        ...item,
        category,
        hsnSac: mapDetails.hsn,
        gstRate: mapDetails.gst
      } : item)
    }));
  };

  const handlePRSelection = (prId) => {
    update('prId', prId);
    if (!prId) {
      update('prNo', 'Direct');
      return;
    }
    const pr = prs.find(p => p.id === prId);
    if (!pr) return;

    // Find the preferred vendor details in the suppliers list
    const supplier = pr.preferredVendor
      ? suppliers.find(s => s.name.toLowerCase() === pr.preferredVendor.toLowerCase())
      : null;
    
    let pqItems = [];
    if (pr.items && Array.isArray(pr.items) && pr.items.length > 0) {
      pqItems = pr.items.map(item => {
        const catDetails = CATEGORY_MAP[item.category] || { hsn: '8471', gst: 18 };
        return {
          category: item.category,
          itemDescription: item.assetName,
          hsnSac: item.hsnCode || catDetails.hsn,
          quantity: item.quantity,
          unit: item.uom || 'Nos',
          unitPrice: Number(item.estimatedUnitCost),
          gstRate: catDetails.gst
        };
      });
    } else {
      const catDetails = CATEGORY_MAP[pr.category] || { hsn: '8471', gst: 18 };
      pqItems = [{
        category: pr.category,
        itemDescription: pr.assetName,
        hsnSac: pr.hsnCode || catDetails.hsn,
        quantity: pr.quantity,
        unit: pr.uom || 'Nos',
        unitPrice: Number(pr.estimatedUnitCost),
        gstRate: catDetails.gst
      }];
    }

    setForm(prev => ({
      ...prev,
      prId,
      prNo: pr.prNo,
      vendorName: pr.preferredVendor || prev.vendorName,
      vendorAddress: supplier?.address || '',
      vendorGstin: supplier?.gstin || '',
      vendorPan: supplier?.pan || '',
      phone: supplier?.phone || '',
      email: supplier?.email || '',
      contactPerson: supplier?.contactPerson || '',
      items: pqItems
    }));
  };

  return (
    <div className="space-y-6 w-full">
      {showAddSupplier && (
        <AddSupplierInline
          onClose={() => setShowAddSupplier(false)}
          onAdded={(newSup) => {
            setShowAddSupplier(false);
            refetchSuppliers().then(() => {
              setForm(prev => ({
                ...prev,
                vendorName: newSup.name,
                vendorAddress: newSup.address || '',
                vendorGstin: newSup.gstin || '',
                vendorPan: newSup.pan || '',
                phone: newSup.phone || '',
                email: newSup.email || '',
                contactPerson: newSup.contactPerson || ''
              }));
            });
          }}
        />
      )}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">{editPQId ? 'Edit Purchase Quotation' : 'New Purchase Quotation'}</h2>
          <p className="text-sm text-slate-500">{editPQId ? `Modifying quotation details` : 'SAP B1 Asset Procurement — Step 2 of 8'}</p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-2xl text-rose-700 dark:text-rose-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Link to PR */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <FileSearch className="w-4 h-4 text-indigo-500" /> Link to Purchase Request (Optional)
          </h3>
          <div className="max-w-md">
            <PRSelect
              prs={prs}
              value={prs.find(p => p.id === form.prId) || null}
              onChange={pr => handlePRSelection(pr.id)}
            />
          </div>
        </div>

        {/* Vendor Details */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-500" /> Vendor Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Vendor Name <span className="text-rose-500">*</span></Label>
              <SupplierSelect
                suppliers={suppliers}
                value={suppliers.find(s => s.name === form.vendorName) || null}
                onChange={s => {
                  setForm(prev => ({
                    ...prev,
                    vendorName: s.name,
                    vendorAddress: s.address || '',
                    vendorGstin: s.gstin || '',
                    vendorPan: s.pan || '',
                    phone: s.phone || '',
                    email: s.email || '',
                    contactPerson: s.contactPerson || ''
                  }));
                }}
                onAddNew={() => setShowAddSupplier(true)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>GSTIN</Label>
              <Input value={form.vendorGstin} onChange={e => update('vendorGstin', e.target.value)} placeholder="22AAAAA0000A1Z5" className="h-10 rounded-xl font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label>PAN</Label>
              <Input value={form.vendorPan} onChange={e => update('vendorPan', e.target.value)} placeholder="AAAAA0000A" className="h-10 rounded-xl font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="Phone number" className="h-10 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="email@example.com" className="h-10 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Contact Person</Label>
              <Input value={form.contactPerson} onChange={e => update('contactPerson', e.target.value)} placeholder="John Doe" className="h-10 rounded-xl" />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label>Vendor Address</Label>
              <Input value={form.vendorAddress} onChange={e => update('vendorAddress', e.target.value)} placeholder="Full registered address" className="h-10 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <div className="relative">
                <select value={form.currency} onChange={e => update('currency', e.target.value)}
                  className="w-full h-10 px-3 pr-8 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                  {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
              </div>
            </div>
          </div>
          {/* Inter-state toggle */}
          <div className="mt-4 flex items-center gap-3">
            <button type="button" onClick={() => setIsInterState(p => !p)}
              className={`relative w-10 h-5 rounded-full transition-colors ${isInterState ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isInterState ? 'translate-x-5' : ''}`} />
            </button>
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Inter-state Supply (IGST applicable)</p>
              <p className="text-xs text-slate-500">{isInterState ? 'IGST will be applied (no CGST/SGST)' : 'CGST + SGST will be applied (intra-state)'}</p>
            </div>
          </div>
        </div>

        {/* Dates & Terms */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-500" /> Validity & Terms
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <DatePicker label="Validity Date" value={form.validityDate} onChange={d => update('validityDate', d)} placeholder="Quote valid until" />
            <DatePicker label="Expected Delivery" value={form.expectedDelivery} onChange={d => update('expectedDelivery', d)} placeholder="Expected delivery" />
            <div className="space-y-1.5">
              <Label>Payment Terms</Label>
              <div className="relative">
                <select value={form.paymentTerms} onChange={e => update('paymentTerms', e.target.value)}
                  className="w-full h-10 px-3 pr-8 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                  {['Net 30', 'Net 45', 'Net 60', '100% Advance', '50% Advance', 'LC/Bank'].map(t => <option key={t}>{t}</option>)}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Payment Mode</Label>
              <div className="relative">
                <select value={form.paymentMode} onChange={e => update('paymentMode', e.target.value)}
                  className="w-full h-10 px-3 pr-8 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                  {PAYMENT_MODES.map(m => <option key={m}>{m}</option>)}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Package className="w-4 h-4 text-indigo-500" /> Line Items
            </h3>
            {!isPrLinked && (
              <Button type="button" variant="outline" size="sm" onClick={addItem} className="h-8 rounded-lg text-xs gap-1 border-indigo-200 dark:border-indigo-900 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30">
                <Plus className="w-3.5 h-3.5" /> Add Item
              </Button>
            )}
          </div>
          <div className="space-y-3">
            {form.items.map((item, idx) => {
              const { totalBeforeTax, gstAmount, totalWithGst } = calcTotals(item);
              return (
                <div key={idx} className="bg-slate-50/60 dark:bg-slate-800/30 rounded-xl p-4 border border-slate-200/60 dark:border-slate-800/60">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Category</Label>
                      <div className="relative">
                        <select
                          disabled={isPrLinked}
                          value={item.category || 'IT Equipment'}
                          onChange={e => handleCategoryChange(idx, e.target.value)}
                          className="w-full h-9 px-2 pr-7 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100/50 dark:disabled:bg-slate-800/50"
                        >
                          {['IT Equipment', 'Machinery & Plant', 'Furniture & Fixtures', 'Vehicles', 'Infrastructure', 'Office Equipment', 'Intangible Assets'].map(c => <option key={c}>{c}</option>)}
                        </select>
                        {!isPrLinked && <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-3 pointer-events-none" />}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Description <span className="text-rose-500">*</span></Label>
                      <Input
                        disabled={isPrLinked}
                        value={item.itemDescription}
                        onChange={e => updateItem(idx, 'itemDescription', e.target.value)}
                        placeholder="Item/asset description"
                        className="h-9 rounded-lg text-sm disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100/50 dark:disabled:bg-slate-800/50"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">HSN / SAC Code</Label>
                      <Input
                        disabled={isPrLinked}
                        value={item.hsnSac}
                        onChange={e => updateItem(idx, 'hsnSac', e.target.value)}
                        placeholder="84713020"
                        className="h-9 rounded-lg text-sm font-mono disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100/50 dark:disabled:bg-slate-800/50"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Unit</Label>
                      <div className="relative">
                        <select
                          disabled={isPrLinked}
                          value={item.unit}
                          onChange={e => updateItem(idx, 'unit', e.target.value)}
                          className="w-full h-9 px-2 pr-7 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100/50 dark:disabled:bg-slate-800/50"
                        >
                          {['Nos', 'Pcs', 'Set', 'Kg', 'Ltr', 'Mtr', 'Box'].map(u => <option key={u}>{u}</option>)}
                        </select>
                        {!isPrLinked && <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-3 pointer-events-none" />}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Quantity</Label>
                      <Input
                        disabled={isPrLinked}
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={e => updateItem(idx, 'quantity', e.target.value)}
                        className="h-9 rounded-lg text-sm disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100/50 dark:disabled:bg-slate-800/50"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Unit Price (₹) <span className="text-rose-500">*</span></Label>
                      <Input type="number" min="0" value={item.unitPrice} onChange={e => updateItem(idx, 'unitPrice', e.target.value)} placeholder="0.00" className="h-9 rounded-lg text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">GST Rate</Label>
                      <div className="relative">
                        <select value={item.gstRate} onChange={e => updateItem(idx, 'gstRate', Number(e.target.value))} className="w-full h-9 px-2 pr-7 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                          {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                        </select>
                        <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-3 pointer-events-none" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Line Total (incl. GST)</Label>
                      <div className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center text-sm font-bold text-indigo-600 dark:text-indigo-400">
                        ₹{totalWithGst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                  {!isPrLinked && form.items.length > 1 && (
                    <div className="flex justify-end mt-2">
                      <button type="button" onClick={() => removeItem(idx)} className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Totals + Other Charges */}
          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-4">
              {/* GST Toggles */}
              <div className="bg-slate-50/50 dark:bg-slate-800/10 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">GST Applicability</span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" id="applyGst" checked={form.applyGst} onChange={e => update('applyGst', e.target.checked)} className="w-4 h-4 rounded accent-indigo-600 border-slate-300" />
                    <Label htmlFor="applyGst" className="text-xs font-medium cursor-pointer">
                      {form.applyGst ? `Apply GST (${isInterState ? 'IGST' : 'CGST + SGST'})` : 'Exempt / No GST'}
                    </Label>
                  </label>
                </div>
              </div>

              {/* Discount */}
              <div className="bg-white dark:bg-slate-900 border border-rose-200/60 dark:border-rose-900/30 rounded-xl p-3">
                <Label className="text-xs font-semibold text-rose-600 dark:text-rose-400">Discount (₹)</Label>
                <Input type="number" min="0" step="0.01" value={form.discount} onChange={e => update('discount', e.target.value)} placeholder="0.00" className="h-8 rounded-lg text-sm mt-1.5" />
              </div>

              {/* Charge rows with GST checkbox */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: 'Freight (₹)', key: 'shippingCharges' },
                  { label: 'Loading Charges (₹)', key: 'loadingCharges' },
                  { label: 'Unloading Charges (₹)', key: 'unloadingCharges' },
                  { label: 'Packing Charges (₹)', key: 'packingCharges' },
                  { label: 'Insurance (₹)', key: 'insurance' },
                  { label: 'Other Charges (₹)', key: 'otherCharges' },
                ].map(({ label, key }) => (
                  <ChargeRow
                    key={key}
                    label={label}
                    fieldKey={key}
                    value={form[key]}
                    gstChecked={chargeGstStates[key]}
                    isInterState={isInterState}
                    onChange={v => update(key, v)}
                    onGstChange={checked => setChargeGstStates(prev => ({ ...prev, [key]: checked }))}
                  />
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30 rounded-2xl p-4 space-y-2 text-sm h-fit">
              {[
                { label: 'Taxable Value', value: totals.taxable },
                ...(form.applyGst ? (
                  isInterState ? [{ label: 'IGST', value: totals.gst + extraGst }] : [
                    { label: 'CGST', value: (totals.gst + extraGst) / 2 },
                    { label: 'SGST', value: (totals.gst + extraGst) / 2 }
                  ]
                ) : [{ label: 'GST (Exempted)', value: 0 }]),
                { label: 'Freight', value: freight },
                { label: 'Loading', value: loadingCharges },
                { label: 'Unloading', value: unloadingCharges },
                { label: 'Packing', value: packingCharges },
                { label: 'Insurance', value: insurance },
                { label: 'Other Charges', value: otherCharges },
                { label: 'Discount', value: -discount },
                { label: 'Round Off', value: roundOff },
              ].map(({ label, value }) => {
                const formatted = Math.abs(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                let textClass = 'text-slate-800 dark:text-slate-200';
                let prefix = '₹';
                if (label === 'Discount' && value < 0) {
                  textClass = 'text-rose-500 font-bold';
                  prefix = '-₹';
                } else if (label === 'Round Off') {
                  if (value > 0) {
                    prefix = '+₹';
                  } else if (value < 0) {
                    prefix = '-₹';
                  }
                }
                return (
                  <div key={label} className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>{label}</span>
                    <span className={`font-semibold ${textClass}`}>
                      {prefix}{formatted}
                    </span>
                  </div>
                );
              })}
              <div className="pt-2 border-t border-indigo-200 dark:border-indigo-900/50 flex justify-between font-black text-lg text-indigo-700 dark:text-indigo-400">
                <span>Quotation Total (Rounded)</span>
                <span>₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </div>

        {/* T&C */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-500" /> Terms & Conditions
          </h3>
          <textarea value={form.termsAndConditions} onChange={e => update('termsAndConditions', e.target.value)} rows={3}
            placeholder="e.g. Warranty 1 year onsite, free delivery, MSME vendor, DDP terms..."
            className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none" />
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onBack} className="rounded-xl px-6 h-11">Cancel</Button>
          <Button type="submit" disabled={mutation.isPending || isReadOnly} className="rounded-xl px-6 h-11 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 gap-2">
            {mutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><FileSearch className="w-4 h-4" /> {editPQId ? 'Update Quotation' : 'Save Quotation'}</>}
          </Button>
        </div>
      </form>
    </div>
  );
}

function CompareQuotationsView({ onBack }) {
  const [selectedPrNo, setSelectedPrNo] = useState('');
  const navigate = useNavigate();

  const { data: prs = [] } = useQuery({
    queryKey: ['asset-prs-for-compare'],
    queryFn: () => api.get('/asset-management/requests').then(r => r.data),
  });

  const { data: pos = [] } = useQuery({
    queryKey: ['asset-pos'],
    queryFn: () => api.get('/asset-management/purchase-orders').then(r => r.data),
  });

  const { data: comparisonData, isLoading, error } = useQuery({
    queryKey: ['pq-comparison', selectedPrNo],
    queryFn: () => api.get(`/asset-management/quotations/compare/${selectedPrNo}`).then(r => r.data),
    enabled: !!selectedPrNo,
  });

  const isPOAlreadyRaised = pos.some(po => po.prNo === selectedPrNo && po.status !== 'Cancelled');

  const handleCreatePO = (pq) => {
    navigate('/asset-management/orders', { state: { openCreate: true, prefillPQId: pq.id, prefillFromPQ: pq } });
  };

  const quotations = comparisonData?.quotations || [];
  const recommendedVendorId = comparisonData?.recommendedVendorId;
  const recommendation = comparisonData?.recommendation;
  const warning = comparisonData?.warning;

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full border border-slate-200 dark:border-slate-700">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Compare Vendor Quotations</h2>
          <p className="text-sm text-slate-500">TCO Evaluation & L1 Procurement Compliance Check (Step 2.5 of 8)</p>
        </div>
      </div>

      {/* Select Purchase Request */}
      <div className="bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-3xl p-5">
        <div className="max-w-md space-y-1.5">
          <Label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Select Purchase Request (PR) to Compare</Label>
          <div className="relative">
            <select
              value={selectedPrNo}
              onChange={e => setSelectedPrNo(e.target.value)}
              className="w-full h-[42px] pl-4 pr-10 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="">-- Choose a Purchase Request --</option>
              {prs.map(p => (
                <option key={p.id} value={p.prNo}>{p.prNo} — {p.itemName || p.description || 'Asset Request'}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3.5 pointer-events-none" />
          </div>
        </div>
      </div>

      {!selectedPrNo ? (
        <div className="border border-slate-200/60 dark:border-slate-800/60 rounded-3xl p-16 text-center text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 flex flex-col items-center justify-center gap-3">
          <FileSearch className="w-12 h-12 text-slate-300 dark:text-slate-700 animate-pulse" />
          <div>
            <p className="font-semibold text-slate-700 dark:text-slate-300">No PR Selected</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">Choose a Purchase Request from the dropdown above to display side-by-side quotations for comparison.</p>
          </div>
        </div>
      ) : isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-[400px] w-full rounded-2xl" />
        </div>
      ) : error ? (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-2xl text-rose-700 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> Failed to load quotation comparison data.
        </div>
      ) : quotations.length === 0 ? (
        <div className="border border-slate-200/60 dark:border-slate-800/60 rounded-3xl p-16 text-center text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 flex flex-col items-center justify-center gap-3">
          <AlertTriangle className="w-12 h-12 text-amber-500 animate-bounce" />
          <div>
            <p className="font-semibold text-slate-700 dark:text-slate-300">No Quotations Found</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">There are no vendor quotations currently recorded for this Purchase Request ({selectedPrNo}).</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Warning Banner if any */}
          {warning && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl text-amber-800 dark:text-amber-300 text-sm animate-in fade-in">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Procurement Compliance Warning</p>
                <p className="text-xs mt-0.5">{warning}</p>
              </div>
            </div>
          )}

          {/* Recommendation Banner */}
          {recommendation && (
            <div className="flex items-start gap-3 p-5 bg-emerald-50 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-900/50 rounded-3xl text-emerald-800 dark:text-emerald-300 text-sm animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-base">Recommended Procurement Action</p>
                <p className="text-xs mt-1 text-slate-600 dark:text-slate-300">{recommendation}</p>
              </div>
            </div>
          )}

          {/* Comparison Matrix Table */}
          <div className="overflow-x-auto rounded-3xl border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900 shadow-sm">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                  <th className="px-6 py-4 text-left font-bold text-slate-500 uppercase tracking-wider text-xs border-r border-slate-100 dark:border-slate-800 w-64 bg-slate-50/80 dark:bg-slate-800/80 sticky left-0 z-10">Evaluation Parameter</th>
                  {quotations.map(q => {
                    const isRecommended = q.id === recommendedVendorId;
                    return (
                      <th key={q.id} className={`px-6 py-4 text-center font-bold text-sm min-w-[250px] relative ${
                        isRecommended ? 'bg-indigo-50/40 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300 border-x-2 border-indigo-500' : ''
                      }`}>
                        {isRecommended && (
                          <span className="absolute -top-1 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-sm">
                            Best Choice
                          </span>
                        )}
                        <div className="font-mono text-xs text-slate-400 mt-2">{q.pqNo}</div>
                        <div className="font-bold text-base truncate mt-0.5">{q.vendorName}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {/* Parameter rows */}
                {[
                  { label: 'Total Cost of Ownership (TCO)', key: 'tco', fmt: v => `₹${Number(v).toLocaleString('en-IN')}`, isBold: true, highlight: true },
                  { label: 'Quote Grand Total', key: 'grandTotal', fmt: v => `₹${Number(v).toLocaleString('en-IN')}` },
                  { label: 'AMC Cost per Year', key: 'amcCost', fmt: (v, q) => q.amcAvailable ? `₹${Number(v).toLocaleString('en-IN')}` : 'Not Available' },
                  { label: 'Lead Time (Delivery)', key: 'leadTime', fmt: v => `${v} Days` },
                  { label: 'Warranty Period', key: 'warrantyPeriod', fmt: v => `${v} Months` },
                  { label: 'Payment Terms', key: 'paymentTerms' },
                  { label: 'Delivery Terms', key: 'deliveryTerms' },
                  { label: 'Valid Until', key: 'validityDate', fmt: v => v ? format(new Date(v), 'dd MMM yyyy') : '—' },
                  { label: 'Exchange Rate', key: 'exchangeRate', fmt: (v, q) => `${q.currency} @ ${v}` },
                  { label: 'Status', key: 'status', badge: true },
                ].map(row => (
                  <tr key={row.label} className={row.highlight ? 'bg-indigo-50/20 dark:bg-indigo-950/10' : 'hover:bg-slate-50/30'}>
                    <td className={`px-6 py-4 text-left border-r border-slate-100 dark:border-slate-800 sticky left-0 z-10 bg-white dark:bg-slate-900 font-medium ${
                      row.isBold ? 'font-bold text-slate-900 dark:text-white' : 'text-slate-500'
                    }`}>{row.label}</td>
                    {quotations.map(q => {
                      const isRecommended = q.id === recommendedVendorId;
                      const rawValue = q[row.key];
                      let rendered = row.fmt ? row.fmt(rawValue, q) : rawValue || '—';
                      if (row.badge) {
                        rendered = (
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${STATUS_STYLES[rawValue] || STATUS_STYLES.Draft}`}>
                            {rawValue}
                          </span>
                        );
                      }
                      return (
                        <td key={q.id} className={`px-6 py-4 text-center ${
                          row.isBold ? 'font-black text-indigo-600 dark:text-indigo-400 text-lg' : 'text-slate-700 dark:text-slate-300 font-medium'
                        } ${isRecommended ? 'bg-indigo-50/30 dark:bg-indigo-950/15 border-x-2 border-indigo-500' : ''}`}>
                          {rendered}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                
                {/* Actions row */}
                <tr>
                  <td className="px-6 py-4 border-r border-slate-100 dark:border-slate-800 sticky left-0 bg-white dark:bg-slate-900"></td>
                  {quotations.map(q => {
                    const isRecommended = q.id === recommendedVendorId;
                    const isPOIssued = q.status === 'PO Issued' || isPOAlreadyRaised;
                    return (
                      <td key={q.id} className={`px-6 py-5 text-center ${isRecommended ? 'bg-indigo-50/30 dark:bg-indigo-950/15 border-x-2 border-indigo-500 border-b-2' : ''}`}>
                        <Button
                          onClick={() => handleCreatePO(q)}
                          disabled={isPOIssued}
                          className={`w-full py-2 px-4 rounded-xl text-xs font-bold transition-all shadow-sm ${
                            isPOIssued
                              ? 'bg-slate-150 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed border-none'
                              : isRecommended
                                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20 hover:shadow-md'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {isPOIssued ? 'PO Issued' : 'Convert to PO'}
                        </Button>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PurchaseQuotationsView() {
  const user = useAuthStore(s => s.user);
  const isReadOnly = user?.role === 'SUPERVISOR';
  const [view, setView] = useState('list');
  const [search, setSearch] = useState('');
  const [selectedPQ, setSelectedPQ] = useState(null);

  const [editPQId, setEditPQId] = useState(null);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: id => api.delete(`/asset-management/quotations/${id}`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asset-pqs'] });
      Swal.fire({
        icon: 'success',
        title: 'Deleted!',
        text: 'Purchase Quotation has been deleted.',
        timer: 1500,
        showConfirmButton: false,
        customClass: { popup: 'rounded-3xl border border-slate-200' }
      });
    },
    onError: err => Swal.fire({
      icon: 'error',
      title: 'Error',
      text: err.response?.data?.error || 'Failed to delete quotation',
      confirmButtonColor: '#4f46e5'
    })
  });

  const handleDeletePQ = (id) => {
    Swal.fire({
      title: 'Are you sure?',
      text: "This will permanently delete this purchase quotation.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed) {
        deleteMutation.mutate(id);
      }
    });
  };

  const { data: pqs = [], isLoading } = useQuery({
    queryKey: ['asset-pqs'],
    queryFn: () => api.get('/asset-management/quotations').then(r => r.data),
  });

  const { data: pos = [] } = useQuery({
    queryKey: ['asset-pos'],
    queryFn: () => api.get('/asset-management/purchase-orders').then(r => r.data),
  });

  const handleCreatePO = (pq) => {
    navigate('/asset-management/orders', { state: { openCreate: true, prefillPQId: pq.id, prefillFromPQ: pq } });
  };

  const filtered = pqs.filter(pq =>
    pq.vendorName?.toLowerCase().includes(search.toLowerCase()) ||
    pq.pqNo?.toLowerCase().includes(search.toLowerCase()) ||
    pq.prNo?.toLowerCase().includes(search.toLowerCase())
  );

  if (view === 'create') return <CreatePQForm onBack={() => { setView('list'); setEditPQId(null); }} isReadOnly={isReadOnly} editPQId={editPQId} />;
  if (view === 'compare') return <CompareQuotationsView onBack={() => setView('list')} />;

  const totalValue = pqs.reduce((s, p) => s + Number(p.grandTotal || p.items?.reduce((a, i) => a + Number(i.totalWithGst), 0) || 0), 0);

  // Group PQs by prNo
  const groupedPqs = filtered.reduce((groups, pq) => {
    const prKey = pq.prNo || 'Direct / General';
    if (!groups[prKey]) {
      groups[prKey] = [];
    }
    groups[prKey].push(pq);
    return groups;
  }, {});

  return (
    <div className="space-y-6">
      {selectedPQ && <PQDetailModal pq={selectedPQ} onClose={() => setSelectedPQ(null)} />}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Purchase Quotations</h2>
          <p className="text-sm text-slate-500 mt-0.5">Compare & evaluate vendor quotes (RFQ/PQ) with GST compliance</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setView('compare')} variant="outline" className="gap-2 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl h-10 px-5 hover:bg-slate-50 dark:hover:bg-slate-800">
            <BarChart3 className="w-4 h-4" /> Compare Quotes
          </Button>
          {!isReadOnly && (
            <Button onClick={() => setView('create')} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md shadow-indigo-600/10 h-10 px-5">
              <Plus className="w-4 h-4" /> New Quotation
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Quotes', value: pqs.length, icon: FileSearch, bg: 'bg-indigo-50 dark:bg-indigo-950/30', clr: 'text-indigo-600 dark:text-indigo-400' },
          { label: 'Vendors', value: [...new Set(pqs.map(p => p.vendorName))].length, icon: Building2, bg: 'bg-violet-50 dark:bg-violet-950/30', clr: 'text-violet-600 dark:text-violet-400' },
          { label: 'PO Issued', value: pqs.filter(p => p.status === 'PO Issued').length, icon: CheckCircle2, bg: 'bg-emerald-50 dark:bg-emerald-950/30', clr: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Quote Value', value: `₹${(totalValue / 100000).toFixed(1)}L`, icon: BarChart3, bg: 'bg-amber-50 dark:bg-amber-950/30', clr: 'text-amber-600 dark:text-amber-400' },
        ].map(({ label, value, icon: Icon, bg, clr }) => (
          <div key={label} className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bg} ${clr}`}><Icon className="w-5 h-5" /></div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-slate-50/60 dark:bg-slate-800/20 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by PQ number, vendor or PR..." className="pl-9 h-9 rounded-xl bg-white dark:bg-slate-900" />
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200/60 dark:border-slate-800/60">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/80 dark:bg-slate-800/50">
            <tr>
              {['PQ No.', 'Vendor', 'GSTIN', 'Items', 'Currency', 'Grand Total', 'Payment Terms', 'Validity', 'Status', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {isLoading ? Array.from({ length: 3 }).map((_, i) => (
              <tr key={i}>{Array.from({ length: 10 }).map((_, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full rounded" /></td>)}</tr>
            )) : filtered.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-16 text-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                    <FileSearch className="w-7 h-7 text-slate-400" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-700 dark:text-slate-300">No quotations recorded</p>
                    <p className="text-xs text-slate-400 mt-1">Add vendor quotations to compare and evaluate</p>
                  </div>
                </div>
              </td></tr>
            ) : Object.entries(groupedPqs).map(([prNo, items]) => (
              <React.Fragment key={prNo}>
                <tr className="bg-indigo-50/40 dark:bg-indigo-950/20">
                  <td colSpan={10} className="px-4 py-2 text-xs font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
                    Purchase Request: {prNo} ({items.length} {items.length === 1 ? 'Quotation' : 'Quotations'})
                  </td>
                </tr>
                {items.map(pq => {
                  const total = pq.grandTotal !== undefined ? Number(pq.grandTotal) : (pq.items?.reduce((s, i) => s + Number(i.totalWithGst), 0) || 0);
                  return (
                    <tr key={pq.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <button onClick={() => setSelectedPQ(pq)} className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs hover:underline">{pq.pqNo}</button>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">{pq.vendorName}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{pq.vendorGstin || '—'}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{pq.items?.length || 0} items</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{pq.currency}</td>
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">₹{total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{pq.paymentTerms}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{pq.validityDate ? format(new Date(pq.validityDate), 'dd MMM yyyy') : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${STATUS_STYLES[pq.status] || STATUS_STYLES.Draft}`}>{pq.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setSelectedPQ(pq)} className="h-8 w-8 rounded-lg text-slate-400 hover:text-indigo-600" title="View Details">
                            <Eye className="w-4 h-4" />
                          </Button>
                          {!isReadOnly && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => { setEditPQId(pq.id); setView('create'); }}
                                disabled={pq.status === 'PO Issued' || pos.some(po => po.prNo === pq.prNo && po.status !== 'Cancelled')}
                                className="h-8 w-8 rounded-lg text-slate-400 hover:text-amber-600 disabled:opacity-40"
                                title={pq.status === 'PO Issued' || pos.some(po => po.prNo === pq.prNo && po.status !== 'Cancelled') ? "Cannot edit: PO already issued" : "Edit Quotation"}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeletePQ(pq.id)}
                                disabled={pq.status === 'PO Issued' || pos.some(po => po.prNo === pq.prNo && po.status !== 'Cancelled')}
                                className="h-8 w-8 rounded-lg text-slate-400 hover:text-rose-600 disabled:opacity-40"
                                title={pq.status === 'PO Issued' || pos.some(po => po.prNo === pq.prNo && po.status !== 'Cancelled') ? "Cannot delete: PO already issued" : "Delete Quotation"}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          {!isReadOnly && (
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={pq.status === 'PO Issued' || pos.some(po => po.prNo === pq.prNo && po.status !== 'Cancelled')}
                              onClick={() => handleCreatePO(pq)}
                              className="h-8 w-8 rounded-lg text-slate-400 hover:text-indigo-600 disabled:opacity-30"
                              title={pq.status === 'PO Issued' || pos.some(po => po.prNo === pq.prNo && po.status !== 'Cancelled') ? "PO Already Issued" : "Convert to PO"}
                            >
                              <ShoppingCart className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
