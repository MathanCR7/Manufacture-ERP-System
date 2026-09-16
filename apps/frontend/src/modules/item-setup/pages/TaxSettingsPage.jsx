import React, { useState, useEffect } from 'react';
import { Building, CheckCircle2, AlertTriangle, Save, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import useAuthStore from '@/app/store/authStore';
import useCompanyStore from '@/app/store/companyStore';

export default function TaxSettingsPage() {
  const user = useAuthStore((s) => s.user);
  const canEdit = user?.role === 'MAIN_MASTER';

  const { company, updateCompany, fetchCompany, loading } = useCompanyStore();

  // Company profile form states
  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyGstin, setCompanyGstin] = useState('');
  const [companyPan, setCompanyPan] = useState('');
  const [companyMobile, setCompanyMobile] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  // Sync state with company store
  useEffect(() => {
    fetchCompany();
  }, [fetchCompany]);

  useEffect(() => {
    if (company) {
      setCompanyName(company.companyName || '');
      setCompanyAddress(company.companyAddress || '');
      setCompanyGstin(company.companyGstin || '');
      setCompanyPan(company.companyPan || '');
      setCompanyMobile(company.companyMobile || '');
    }
  }, [company]);

  // Derive PAN automatically if GSTIN is entered and PAN is empty
  const handleGstinChange = (val) => {
    const upper = val.toUpperCase().trim();
    setCompanyGstin(upper);
    if (upper.length >= 12 && !companyPan) {
      setCompanyPan(upper.substring(2, 12));
    }
  };

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

    setSaving(true);
    try {
      await updateCompany({
        companyName: companyName.trim(),
        companyAddress: companyAddress.trim(),
        companyGstin: companyGstin.trim().toUpperCase(),
        companyPan: companyPan.trim().toUpperCase(),
        companyMobile: companyMobile.trim()
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (err) {
      console.error('Failed to save settings:', err);
      alert('Failed to save settings to database: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4 mx-auto transition-all duration-300 text-xs">
      {!canEdit && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl text-amber-800 dark:text-amber-300 text-sm font-medium mb-4">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>You have <strong>Read-Only access</strong> to Company Settings. Modifying business parameters is restricted.</span>
        </div>
      )}

      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center">
            <Building className="w-5.5 h-5.5 mr-2 text-indigo-600 dark:text-indigo-400 shrink-0" />
            Company &amp; Tax Settings
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
            Configure business profile details, GSTIN, PAN, and contact information. Stored in PostgreSQL database and updated live across all invoices, purchase orders, and quotes.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => fetchCompany()}
          disabled={loading}
          className="self-start sm:self-auto flex items-center gap-1.5 rounded-xl border-slate-200 dark:border-slate-800 h-9 text-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Data</span>
        </Button>
      </div>

      {success && (
        <div className="flex items-center gap-2 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-semibold shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="text-xs">Company details saved successfully to PostgreSQL database and applied live across all modules!</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Company Settings Card */}
        <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden text-xs">
          <CardContent className="p-5 space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Building className="w-4 h-4 text-indigo-500" />
                Live Business Profile
              </h2>
              <span className="text-[10px] text-slate-400 font-mono">PostgreSQL Live Data</span>
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
                  placeholder="e.g. Acme Manufacturing Pvt Ltd"
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
                  placeholder="e.g. Factory / Registered Office Address, City, State, PIN"
                  className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl h-9 text-xs font-semibold disabled:opacity-75 disabled:cursor-not-allowed"
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
                    onChange={(e) => handleGstinChange(e.target.value)}
                    placeholder="e.g. 33AAAAA0000A1Z5"
                    className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl font-mono h-9 text-xs font-bold uppercase disabled:opacity-75 disabled:cursor-not-allowed"
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
                    onChange={(e) => setCompanyPan(e.target.value.toUpperCase())}
                    placeholder="e.g. AAAAA0000A"
                    className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl font-mono h-9 text-xs font-bold uppercase disabled:opacity-75 disabled:cursor-not-allowed"
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
                    placeholder="e.g. +91 9876543210"
                    className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl h-9 text-xs font-bold disabled:opacity-75 disabled:cursor-not-allowed"
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
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center gap-1.5 px-6 py-2.5 shadow-md shadow-indigo-500/15 hover:shadow-indigo-500/25 transition-all text-xs cursor-pointer h-9"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
