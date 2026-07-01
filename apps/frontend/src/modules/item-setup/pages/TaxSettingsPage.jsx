import React, { useState, useEffect } from 'react';
import { Settings, CheckCircle2, Building } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/axios';

export default function TaxSettingsPage() {
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
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-800 dark:text-white flex items-center">
          <Building className="w-5 h-5 mr-2 text-indigo-500" />
          Company Details Settings
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 pl-7">
          Configure business profile details, GSTIN, PAN, and contact number. These details are updated across all invoices.
        </p>
      </div>

      {success && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <span className="text-sm font-semibold">Company details saved successfully and applied across all invoices!</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Company Settings Card */}
        <Card className="bg-white dark:bg-slate-800/80 backdrop-blur border border-slate-200 dark:border-slate-700/50 rounded-2xl shadow-sm">
          <CardContent className="p-6 space-y-5">
            <div className="border-b border-slate-100 dark:border-slate-700 pb-3">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Building className="w-4 h-4 text-indigo-500" />
                Company Details
              </h2>
            </div>
            
            <div className="grid grid-cols-1 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Company Name <span className="text-red-500">*</span>
                </label>
                <Input
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Leonex pvt limited"
                  className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Company Address <span className="text-red-500">*</span>
                </label>
                <Input
                  required
                  value={companyAddress}
                  onChange={(e) => setCompanyAddress(e.target.value)}
                  placeholder="e.g. Factory / Registered Office Address"
                  className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    GSTIN <span className="text-red-500">*</span>
                  </label>
                  <Input
                    required
                    value={companyGstin}
                    onChange={(e) => setCompanyGstin(e.target.value)}
                    placeholder="e.g. 33AABCL0702C1ZG"
                    className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    PAN <span className="text-red-500">*</span>
                  </label>
                  <Input
                    required
                    value={companyPan}
                    onChange={(e) => setCompanyPan(e.target.value)}
                    placeholder="e.g. AABCL0702C"
                    className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Company Mobile <span className="text-red-500">*</span>
                  </label>
                  <Input
                    required
                    value={companyMobile}
                    onChange={(e) => setCompanyMobile(e.target.value)}
                    placeholder="e.g. +91 9360163523"
                    className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end">
          <Button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl flex items-center gap-1.5 px-6 py-2.5 shadow-md shadow-indigo-500/15 hover:shadow-indigo-500/25 transition-all"
          >
            Save Configuration
          </Button>
        </div>
      </form>
    </div>
  );
}
