import { Settings, CheckCircle2, Building, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/axios';
import useAuthStore from '@/app/store/authStore';

import React, { useState, useEffect } from 'react';

export default function TaxSettingsPage() {
  const user = useAuthStore(s => s.user);
  const canEdit = user?.role === 'MAIN_MASTER';
  // Company profile states
  const [companyName, setCompanyName] = useState('Leonex pvt limited');
  const [companyAddress, setCompanyAddress] = useState('Factory / Registered Office Address');
  const [companyGstin, setCompanyGstin] = useState('33AABCL0702C1ZG');
  const [companyPan, setCompanyPan] = useState('AABCL0702C');
  const [companyMobile, setCompanyMobile] = useState('+91 9360163523');
  const [success, setSuccess] = useState(false);

  // Load company details from backend API on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await api.get('/setup/tax');
        const data = response.data;
        if (data) {
          setCompanyName(data.companyName || 'Leonex pvt limited');
          setCompanyAddress(data.companyAddress || 'Factory / Registered Office Address');
          setCompanyGstin(data.companyGstin || '33AABCL0702C1ZG');
          setCompanyPan(data.companyPan || 'AABCL0702C');
          setCompanyMobile(data.companyMobile || '+91 9360163523');
        }
      } catch (err) {
        console.error('Failed to load company settings from backend, trying localStorage fallback:', err);
        const saved = localStorage.getItem('leonex_erp_tax_settings');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            setCompanyName(parsed.companyName || 'Leonex pvt limited');
            setCompanyAddress(parsed.companyAddress || 'Factory / Registered Office Address');
            setCompanyGstin(parsed.companyGstin || '33AABCL0702C1ZG');
            setCompanyPan(parsed.companyPan || 'AABCL0702C');
            setCompanyMobile(parsed.companyMobile || '+91 9360163523');
          } catch (e) {
            console.error('Error loading fallback tax settings', e);
          }
        }
      }
    };
    fetchSettings();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!companyName.trim()) {
      alert('Company Name is required.');
      return;
    }
    if (!companyAddress.trim()) {
      alert('Company Address is required.');
      return;
    }
    if (!companyGstin.trim()) {
      alert('GSTIN is required.');
      return;
    }
    if (!companyPan.trim()) {
      alert('PAN is required.');
      return;
    }

    const settings = {
      companyName: companyName.trim(),
      companyAddress: companyAddress.trim(),
      companyGstin: companyGstin.trim(),
      companyPan: companyPan.trim(),
      companyMobile: companyMobile.trim()
    };

    try {
      await api.post('/setup/tax', settings);
      localStorage.setItem('leonex_erp_tax_settings', JSON.stringify(settings));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save settings to backend:', err);
      alert('Failed to save settings to backend. Saving locally instead.');
      localStorage.setItem('leonex_erp_tax_settings', JSON.stringify(settings));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }
  };

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4 mx-auto transition-all duration-300 text-xs">
      {!canEdit && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-955/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl text-amber-800 dark:text-amber-300 text-sm font-medium mb-4">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>You have <strong>Read-Only access</strong> to Company Settings. Modifying business parameters is restricted.</span>
        </div>
      )}
      {/* Page Title */}
      <div className="pb-3 border-b border-slate-205 dark:border-slate-800">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center">
          <Building className="w-5.5 h-5.5 mr-2 text-indigo-650 shrink-0" />
          Company Details Settings
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
          Configure business profile details, GSTIN, PAN, and contact number. These details are updated across all invoices.
        </p>
      </div>

      {success && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-650 dark:text-emerald-400 font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span className="text-xs">Company details saved successfully and applied across all invoices!</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        
        {/* Company Settings Card */}
        <Card className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-805 rounded-2xl shadow-xs overflow-hidden text-xs">
          <CardContent className="p-5 space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-2">
              <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5 text-slate-500">
                <Building className="w-4 h-4 text-indigo-500" />
                Company Details
              </h2>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Company Name <span className="text-red-500">*</span>
                </label>
                <Input
                  disabled={!canEdit}
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Leonex pvt limited"
                  className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl h-9 text-xs font-semibold disabled:opacity-75 disabled:cursor-not-allowed"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Company Address <span className="text-red-500">*</span>
                </label>
                <Input
                  disabled={!canEdit}
                  required
                  value={companyAddress}
                  onChange={(e) => setCompanyAddress(e.target.value)}
                  placeholder="e.g. Factory / Registered Office Address"
                  className="bg-white dark:bg-slate-950 border border-slate-205 dark:border-slate-700 rounded-xl h-9 text-xs font-semibold disabled:opacity-75 disabled:cursor-not-allowed"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    GSTIN <span className="text-red-500">*</span>
                  </label>
                  <Input
                    disabled={!canEdit}
                    required
                    value={companyGstin}
                    onChange={(e) => setCompanyGstin(e.target.value)}
                    placeholder="e.g. 33AABCL0702C1ZG"
                    className="bg-white dark:bg-slate-950 border border-slate-205 dark:border-slate-700 rounded-xl font-mono h-9 text-xs font-bold uppercase disabled:opacity-75 disabled:cursor-not-allowed"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    PAN <span className="text-red-500">*</span>
                  </label>
                  <Input
                    disabled={!canEdit}
                    required
                    value={companyPan}
                    onChange={(e) => setCompanyPan(e.target.value)}
                    placeholder="e.g. AABCL0702C"
                    className="bg-white dark:bg-slate-950 border border-slate-205 dark:border-slate-700 rounded-xl font-mono h-9 text-xs font-bold uppercase disabled:opacity-75 disabled:cursor-not-allowed"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Company Mobile <span className="text-red-500">*</span>
                  </label>
                  <Input
                    disabled={!canEdit}
                    required
                    value={companyMobile}
                    onChange={(e) => setCompanyMobile(e.target.value)}
                    placeholder="e.g. +91 9360163523"
                    className="bg-white dark:bg-slate-950 border border-slate-205 dark:border-slate-700 rounded-xl h-9 text-xs font-bold disabled:opacity-75 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Controls */}
        <div className="flex justify-end items-center gap-3 pt-2">
          <Button
            type="button"
            onClick={() => window.history.back()}
            className="bg-rose-600 hover:bg-rose-700 dark:bg-rose-700 dark:hover:bg-rose-800 text-white font-bold rounded-xl px-6 py-2.5 shadow-md transition-all text-xs cursor-pointer h-9"
          >
            Cancel
          </Button>
          {canEdit && (
            <Button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center gap-1.5 px-6 py-2.5 shadow-md shadow-indigo-500/15 hover:shadow-indigo-500/25 transition-all text-xs cursor-pointer h-9"
            >
              Save Configuration
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
