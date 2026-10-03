import React, { useState } from 'react';
import { X, Loader2, UserPlus, Building2, Phone, Mail, MapPin, ShieldCheck, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/axios';
import Swal from 'sweetalert2';

export default function QuickAddCustomerModal({ onAdded, onClose }) {
  const [name, setName] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [customerType, setCustomerType] = useState('B2B'); // B2B | RETAIL
  const [gstin, setGstin] = useState('');
  const [address, setAddress] = useState('');
  const [state, setState] = useState('Tamil Nadu');
  const [creditLimit, setCreditLimit] = useState('0');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-fill state and pan from GSTIN if entered
  const handleGstinChange = (e) => {
    const val = e.target.value.toUpperCase();
    setGstin(val);
    if (val.length >= 2) {
      const code = val.substring(0, 2);
      if (code === '33') setState('Tamil Nadu (33)');
      else if (code === '29') setState('Karnataka (29)');
      else if (code === '32') setState('Kerala (32)');
      else if (code === '37') setState('Andhra Pradesh (37)');
      else if (code === '36') setState('Telangana (36)');
      else if (code === '27') setState('Maharashtra (27)');
      else if (code === '07') setState('Delhi (07)');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      Swal.fire({ icon: 'warning', title: 'Name Required', text: 'Please enter customer or party name.', timer: 2000 });
      return;
    }
    const cleanPhoneDigits = phone.replace(/[^0-9]/g, '');
    if (!cleanPhoneDigits || cleanPhoneDigits.length < 7) {
      Swal.fire({ icon: 'warning', title: 'Phone Required', text: 'Please enter a valid mobile number.', timer: 2000 });
      return;
    }

    const fullPhone = phone.trim().startsWith('+') 
      ? phone.trim() 
      : `${countryCode} ${phone.trim()}`;

    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        contactPerson: name.trim(),
        phone: fullPhone,
        email: email.trim() || undefined,
        customerType,
        gstin: gstin.trim() || undefined,
        address: address.trim() || undefined,
        creditLimit: parseFloat(creditLimit) || 0,
        openingBalance: parseFloat(openingBalance) || 0,
        note: note.trim() || undefined
      };

      const res = await api.post('/parties/customers', payload);
      const newCustomer = res.data;

      Swal.fire({
        icon: 'success',
        title: 'Customer Added!',
        text: `${newCustomer.name} has been saved successfully.`,
        timer: 1500,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });

      if (onAdded) onAdded(newCustomer);
      if (onClose) onClose();
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: 'error',
        title: 'Failed to Add Customer',
        text: err?.response?.data?.message || err?.response?.data?.error || err.message,
        confirmButtonColor: '#4f46e5'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate__animated animate__fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col my-6">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Quick Add Customer</h3>
              <p className="text-[11px] text-slate-500">Create client party for retail or B2B billing</p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="sm:col-span-2 space-y-1">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Customer Name / Entity *
              </Label>
              <Input
                placeholder="e.g. Ramesh Agencies / John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="text-xs h-9 bg-white dark:bg-slate-950"
                autoFocus
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <Phone className="w-3 h-3 text-slate-400" /> Mobile / WhatsApp *
              </Label>
              <div className="flex gap-1.5">
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="w-24 h-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2 text-xs font-mono font-bold text-slate-800 dark:text-slate-200 focus:outline-none shrink-0"
                >
                  <option value="+91">+91 (IN)</option>
                  <option value="+1">+1 (US)</option>
                  <option value="+44">+44 (UK)</option>
                  <option value="+971">+971 (AE)</option>
                  <option value="+65">+65 (SG)</option>
                  <option value="+60">+60 (MY)</option>
                  <option value="+61">+61 (AU)</option>
                </select>
                <Input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="text-xs h-9 font-mono bg-white dark:bg-slate-950 flex-1"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <Mail className="w-3 h-3 text-slate-400" /> Email (Optional)
              </Label>
              <Input
                type="email"
                placeholder="client@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="text-xs h-9 bg-white dark:bg-slate-950"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Customer Type
              </Label>
              <select
                value={customerType}
                onChange={(e) => setCustomerType(e.target.value)}
                className="w-full h-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="B2B">B2B (Business / Distributor / Wholesale)</option>
                <option value="RETAIL">Customer / Retail (Individual / Walk-In)</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                GSTIN / Tax ID
              </Label>
              <Input
                placeholder="33AAAAA0000A1Z5"
                value={gstin}
                onChange={handleGstinChange}
                maxLength={15}
                className="text-xs h-9 font-mono uppercase bg-white dark:bg-slate-950"
              />
            </div>

            <div className="sm:col-span-2 space-y-1">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-400" /> Shipping & Billing Address
              </Label>
              <Input
                placeholder="Destination address, street, city, pincode..."
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="text-xs h-9 bg-white dark:bg-slate-950"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Credit Limit (₹)
              </Label>
              <Input
                type="number"
                min="0"
                step="500"
                placeholder="0"
                value={creditLimit}
                onChange={(e) => setCreditLimit(e.target.value)}
                className="text-xs h-9 font-mono bg-white dark:bg-slate-950"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Opening Balance (₹)
              </Label>
              <Input
                type="number"
                step="100"
                placeholder="0"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                className="text-xs h-9 font-mono bg-white dark:bg-slate-950"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="text-xs font-bold rounded-xl h-9 px-4 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="text-xs font-bold rounded-xl h-9 px-5 bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-sm flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Save & Select
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
