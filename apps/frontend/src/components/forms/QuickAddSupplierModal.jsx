import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/axios';
import Swal from 'sweetalert2';

export default function QuickAddSupplierModal({ onAdded, onClose }) {
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');
  const [openingBalance, setOpeningBalance] = useState('0.00');
  const [creditLimit, setCreditLimit] = useState('0.00');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [signatureImage, setSignatureImage] = useState(null);
  const [companySealImage, setCompanySealImage] = useState(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifyingGstin, setIsVerifyingGstin] = useState(false);

  const handleVerifyGSTIN = async () => {
    if (!gstin || !gstin.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'GSTIN Required',
        text: 'Please enter a GSTIN to verify.',
        confirmButtonColor: '#4f46e5'
      });
      return;
    }
    const cleanGstin = gstin.trim().toUpperCase();
    const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (!regex.test(cleanGstin)) {
      Swal.fire({
        icon: 'error',
        title: 'Invalid GSTIN Format',
        text: 'Standard GSTIN format: 2-digit State Code + 10-char PAN + Entity Digit + Z + Check Digit (15 characters total).',
        confirmButtonColor: '#4f46e5'
      });
      return;
    }

    setIsVerifyingGstin(true);
    try {
      const res = await api.get(`/asset-management/verify-gstin/${cleanGstin}`);
      const data = res.data;

      const isLive = data.source === 'live';
      const statusBadge = data.status?.toLowerCase() === 'active'
        ? `<span style="background:#d1fae5;color:#065f46;padding:2px 10px;border-radius:999px;font-weight:700;font-size:11px;">✓ ${data.status?.toUpperCase() || 'ACTIVE'}</span>`
        : `<span style="background:#fee2e2;color:#991b1b;padding:2px 10px;border-radius:999px;font-weight:700;font-size:11px;">✗ ${data.status?.toUpperCase() || 'UNKNOWN'}</span>`;

      const row = (label, value) =>
        value ? `<tr><td style="color:#6b7280;font-size:11px;padding:5px 0;text-align:left;width:48%;">${label}</td><td style="font-size:12px;font-weight:600;color:#111827;text-align:right;">${value}</td></tr>` : '';

      const tableHtml = `
        <div style="text-align:left">
          ${data.warning ? `<div style="background:#fef9c3;border:1px solid #fde68a;border-radius:8px;padding:8px 12px;font-size:11px;color:#92400e;margin-bottom:12px;">⚠️ ${data.warning}</div>` : ''}
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <code style="font-size:13px;font-weight:700;color:#4f46e5;letter-spacing:1px;">${data.gstin}</code>
            ${statusBadge}
          </div>
          <table style="width:100%;border-collapse:collapse;">
            ${row('Legal Name', data.legalName || '<span style="color:#9ca3af;font-style:italic;">Not available (live API required)</span>')}
            ${row('Trade Name', data.tradeName && data.tradeName !== data.legalName ? data.tradeName : '')}
            ${row('PAN', data.pan)}
            ${row('State', `${data.state} (${data.stateCode})`)}
            ${row('Constitution', data.constitutionOfBusiness)}
            ${row('Taxpayer Type', data.taxpayerType)}
            ${row('Registration Date', data.registrationDate)}
            ${row('Last Updated', data.lastUpdatedDate)}
            ${row('Principal Address', data.principalAddress || '<span style="color:#9ca3af;font-style:italic;">Not available (live API required)</span>')}
          </table>
          <div style="margin-top:12px;font-size:10px;color:#9ca3af;text-align:center;">
            ${isLive ? '🟢 Live data from GST Portal' : '🔵 Parsed from GSTIN format (offline mode)'}
          </div>
        </div>
      `;

      const result = await Swal.fire({
        title: '<span style="font-size:15px;">🔍 GST Registry Verification</span>',
        html: tableHtml,
        showCancelButton: true,
        confirmButtonText: 'Apply Details to Form',
        cancelButtonText: 'Close',
        confirmButtonColor: '#4f46e5',
        cancelButtonColor: '#6b7280',
        customClass: {
          popup: 'rounded-2xl',
          htmlContainer: 'text-left'
        },
        width: '500px'
      });

      if (result.isConfirmed) {
        setGstin(cleanGstin);
        setPan(data.pan || '');
        if (data.legalName) setName(data.legalName);
        if (data.principalAddress) setAddress(data.principalAddress);
      }
    } catch (err) {
      console.error('GSTIN verification error:', err);
      const errMsg = err.response?.data?.error || err.message || 'Unable to verify GSTIN. Please try again.';
      Swal.fire({
        icon: 'error',
        title: 'Verification Failed',
        text: errMsg,
        confirmButtonColor: '#ef4444'
      });
    } finally {
      setIsVerifyingGstin(false);
    }
  };

  const handleFileChange = (e, setter) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        Swal.fire({
          icon: 'error',
          title: 'File Too Large',
          text: 'File size must be less than 2MB.'
        });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setter(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!name || !name.trim()) {
      Swal.fire({ icon: 'error', title: 'Validation Error', text: 'Name is required.', confirmButtonColor: '#4f46e5' });
      return;
    }
    if (!email || !email.trim()) {
      Swal.fire({ icon: 'error', title: 'Validation Error', text: 'Email is required.', confirmButtonColor: '#4f46e5' });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Swal.fire({ icon: 'error', title: 'Validation Error', text: 'Please enter a valid email address.', confirmButtonColor: '#4f46e5' });
      return;
    }

    if (!phone || !phone.trim()) {
      Swal.fire({ icon: 'error', title: 'Validation Error', text: 'Phone is required.', confirmButtonColor: '#4f46e5' });
      return;
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    let isValidPhone = false;
    if (cleanPhone.length === 10) {
      isValidPhone = true;
    } else if (cleanPhone.length === 12 && cleanPhone.startsWith('91')) {
      isValidPhone = true;
    }
    if (!isValidPhone) {
      Swal.fire({ icon: 'error', title: 'Validation Error', text: 'Please enter a valid 10-digit phone number.', confirmButtonColor: '#4f46e5' });
      return;
    }

    if (gstin && gstin.trim()) {
      const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstinRegex.test(gstin.trim().toUpperCase())) {
        Swal.fire({ icon: 'error', title: 'Validation Error', text: 'Please enter a valid GSTIN format.', confirmButtonColor: '#4f46e5' });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const res = await api.post('/parties/suppliers', {
        name: name.trim(),
        contactPerson: contactPerson.trim() || name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        gstin: gstin.trim().toUpperCase(),
        pan: pan.trim().toUpperCase(),
        openingBalance: openingBalance ? parseFloat(openingBalance) : 0,
        creditLimit: creditLimit ? parseFloat(creditLimit) : 0,
        address: address.trim(),
        note: note.trim(),
        signatureImage,
        companySealImage,
        balanceType: 'CREDIT'
      });
      
      const isDark = document.documentElement.classList.contains('dark');
      Swal.fire({
        title: `<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Supplier Registered!</span>`,
        html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Supplier "${res.data.name}" has been registered successfully.</p>`,
        icon: 'success',
        iconColor: '#10b981',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3500,
        timerProgressBar: true,
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        color: isDark ? '#f8fafc' : '#0f172a',
        showClass: { popup: 'animate__animated animate__slideInRight animate__faster' },
        hideClass: { popup: 'animate__animated animate__fadeOutRight animate__faster' },
        customClass: {
          popup: 'rounded-2xl border border-emerald-100 dark:border-emerald-950 shadow-xl backdrop-blur-md p-4',
          timerProgressBar: 'bg-emerald-500'
        }
      });

      onAdded(res.data);
    } catch (err) {
      console.error('Failed to add supplier:', err);
      Swal.fire({
        icon: 'error',
        title: 'Oops...',
        text: err.response?.data?.message || 'Failed to add supplier. Check constraints.',
        confirmButtonColor: '#4f46e5'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 transition-all duration-300">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 md:p-8 w-full max-w-2xl shadow-2xl border border-slate-200/60 dark:border-slate-800 max-h-[90vh] overflow-y-auto transform animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Quick Add Supplier</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
            <X className="w-5 h-5" />
          </Button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            
            <div className="space-y-1.5">
              <Label className="text-slate-700 dark:text-slate-300 font-medium">GSTIN</Label>
              <div className="flex gap-2">
                <Input 
                  value={gstin} 
                  onChange={e => setGstin(e.target.value)} 
                  placeholder="GSTIN" 
                  className="h-[42px] rounded-xl border-slate-300 dark:border-slate-700 focus:ring-indigo-500/20 hover:border-indigo-400 transition-colors bg-slate-50/50 dark:bg-slate-900/50 font-mono uppercase text-sm" 
                />
                <button
                  type="button"
                  disabled={isVerifyingGstin}
                  onClick={handleVerifyGSTIN}
                  className="px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors disabled:opacity-50 h-[42px]"
                >
                  {isVerifyingGstin ? 'Verifying...' : 'Fetch'}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-700 dark:text-slate-300 font-medium">Name <span className="text-rose-500">*</span></Label>
              <Input required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Acme Corp" className="h-[42px] rounded-xl border-slate-300 dark:border-slate-700 focus:ring-indigo-500/20 hover:border-indigo-400 transition-colors bg-slate-50/50 dark:bg-slate-900/50" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-700 dark:text-slate-300 font-medium">Contact Person</Label>
              <Input value={contactPerson} onChange={e => setContactPerson(e.target.value)} placeholder="John Doe" className="h-[42px] rounded-xl border-slate-300 dark:border-slate-700 focus:ring-indigo-500/20 hover:border-indigo-400 transition-colors bg-slate-50/50 dark:bg-slate-900/50" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-700 dark:text-slate-300 font-medium">Phone <span className="text-rose-500">*</span></Label>
              <Input required value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone number" className="h-[42px] rounded-xl border-slate-300 dark:border-slate-700 focus:ring-indigo-500/20 hover:border-indigo-400 transition-colors bg-slate-50/50 dark:bg-slate-900/50" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-700 dark:text-slate-300 font-medium">Email <span className="text-rose-500">*</span></Label>
              <Input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" className="h-[42px] rounded-xl border-slate-300 dark:border-slate-700 focus:ring-indigo-500/20 hover:border-indigo-400 transition-colors bg-slate-50/50 dark:bg-slate-900/50" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-700 dark:text-slate-300 font-medium">PAN</Label>
              <Input value={pan} onChange={e => setPan(e.target.value)} placeholder="PAN" className="h-[42px] rounded-xl border-slate-300 dark:border-slate-700 focus:ring-indigo-500/20 hover:border-indigo-400 transition-colors bg-slate-50/50 dark:bg-slate-900/50 font-mono uppercase" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-700 dark:text-slate-300 font-medium">Opening Balance</Label>
              <Input type="number" step="0.01" value={openingBalance} onChange={e => setOpeningBalance(e.target.value)} className="h-[42px] rounded-xl border-slate-300 dark:border-slate-700 focus:ring-indigo-500/20 hover:border-indigo-400 transition-colors bg-slate-50/50 dark:bg-slate-900/50" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-700 dark:text-slate-300 font-medium">Credit Limit</Label>
              <Input type="number" step="0.01" value={creditLimit} onChange={e => setCreditLimit(e.target.value)} className="h-[42px] rounded-xl border-slate-300 dark:border-slate-700 focus:ring-indigo-500/20 hover:border-indigo-400 transition-colors bg-slate-50/50 dark:bg-slate-900/50" />
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <Label className="text-slate-700 dark:text-slate-300 font-medium">Address</Label>
              <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Main St..." className="h-[42px] rounded-xl border-slate-300 dark:border-slate-700 focus:ring-indigo-500/20 hover:border-indigo-400 transition-colors bg-slate-50/50 dark:bg-slate-900/50" />
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <Label className="text-slate-700 dark:text-slate-300 font-medium">Note</Label>
              <textarea 
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 p-3 bg-slate-50/50 dark:bg-slate-900/50 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 hover:border-indigo-400 transition-all text-sm resize-none" 
                rows={3} 
                value={note} 
                onChange={e => setNote(e.target.value)} 
                placeholder="Additional notes..." 
              />
            </div>

            {/* Signature Upload */}
            <div className="space-y-1.5">
              <Label className="text-slate-700 dark:text-slate-300 font-medium">Signature Image (.png/.jpg)</Label>
              <input 
                type="file"
                accept="image/png, image/jpeg"
                onChange={(e) => handleFileChange(e, setSignatureImage)}
                className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-slate-800 dark:file:text-indigo-400"
              />
              {signatureImage && (
                <div className="mt-2 p-2 border rounded-xl dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                  <img src={signatureImage} alt="Signature Preview" className="max-h-20 max-w-full object-contain mx-auto" />
                  <button 
                    type="button" 
                    onClick={() => setSignatureImage(null)} 
                    className="mt-1 text-xs text-rose-500 hover:underline block text-center w-full"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            {/* Company Seal Upload */}
            <div className="space-y-1.5">
              <Label className="text-slate-700 dark:text-slate-300 font-medium">Company Seal Image (.png/.jpg)</Label>
              <input 
                type="file"
                accept="image/png, image/jpeg"
                onChange={(e) => handleFileChange(e, setCompanySealImage)}
                className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-slate-800 dark:file:text-indigo-400"
              />
              {companySealImage && (
                <div className="mt-2 p-2 border rounded-xl dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                  <img src={companySealImage} alt="Seal Preview" className="max-h-20 max-w-full object-contain mx-auto" />
                  <button 
                    type="button" 
                    onClick={() => setCompanySealImage(null)} 
                    className="mt-1 text-xs text-rose-500 hover:underline block text-center w-full"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

          </div>
          <div className="flex justify-end space-x-3 pt-6 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl px-6 h-11 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-slate-200 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white transition-colors">Cancel</Button>
            <Button type="submit" disabled={isSubmitting} className="rounded-xl px-6 h-11 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all font-medium animate-pulse-subtle">
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : 'Add Supplier'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
