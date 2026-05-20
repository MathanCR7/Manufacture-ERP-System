import React, { useState, useEffect } from 'react';
import { Settings, Plus, Trash2, CheckCircle2, Building } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function TaxSettingsPage() {
  // Company state fields requested by the user
  const [companyName, setCompanyName] = useState('Kulfi ERP System Ltd.');
  const [companyAddress, setCompanyAddress] = useState('12, Ice Cream Industrial Zone, Mumbai, Maharashtra');
  const [companyGstin, setCompanyGstin] = useState('27AABC1234F1Z5');

  // Tax configuration fields
  const [collectTax, setCollectTax] = useState('Yes');
  const [taxRegNo, setTaxRegNo] = useState('27AABC1234F1Z5');
  const [taxType, setTaxType] = useState('Exclusive Tax');
  const [taxes, setTaxes] = useState([
    { name: 'CGST', rate: '9.00' },
    { name: 'SGST', rate: '9.00' },
    { name: 'IGST', rate: '18.00' }
  ]);
  const [success, setSuccess] = useState(false);

  // Load settings from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('kulfi_erp_tax_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setCompanyName(parsed.companyName || 'Kulfi ERP System Ltd.');
        setCompanyAddress(parsed.companyAddress || '12, Ice Cream Industrial Zone, Mumbai, Maharashtra');
        setCompanyGstin(parsed.companyGstin || '27AABC1234F1Z5');
        
        setCollectTax(parsed.collectTax || 'Yes');
        setTaxRegNo(parsed.taxRegNo || '27AABC1234F1Z5');
        setTaxType(parsed.taxType || 'Exclusive Tax');
        if (parsed.taxes && Array.isArray(parsed.taxes)) {
          setTaxes(parsed.taxes);
        }
      } catch (e) {
        console.error('Error loading tax settings', e);
      }
    }
  }, []);

  const handleAddRow = () => {
    setTaxes([...taxes, { name: '', rate: '0.00' }]);
  };

  const handleRemoveRow = (index) => {
    setTaxes(taxes.filter((_, i) => i !== index));
  };

  const handleFieldChange = (index, field, value) => {
    const updated = [...taxes];
    updated[index][field] = value;
    setTaxes(updated);
  };

  const handleSubmit = (e) => {
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

    const settings = {
      companyName: companyName.trim(),
      companyAddress: companyAddress.trim(),
      companyGstin: companyGstin.trim(),
      collectTax,
      taxRegNo: companyGstin.trim(),
      taxType,
      taxes: taxes.map(t => ({
        name: t.name,
        rate: parseFloat(t.rate) || 0
      }))
    };

    localStorage.setItem('kulfi_erp_tax_settings', JSON.stringify(settings));
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-800 dark:text-white flex items-center">
          <Settings className="w-5 h-5 mr-2 text-indigo-500 animate-spin-slow" />
          Tax & Company Settings
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 pl-7">
          Configure business profile details, GSTIN, tax types, and default rates applied on sales invoices.
        </p>
      </div>

      {success && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <span className="text-sm font-semibold">Tax & Company settings saved successfully and applied across all invoices!</span>
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
                  placeholder="e.g. Kulfi ERP System Ltd."
                  className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Company Address <span className="text-red-500">*</span>
                  </label>
                  <Input
                    required
                    value={companyAddress}
                    onChange={(e) => setCompanyAddress(e.target.value)}
                    placeholder="e.g. 12, Ice Cream Industrial Zone, Mumbai, Maharashtra"
                    className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    GSTIN <span className="text-red-500">*</span>
                  </label>
                  <Input
                    required
                    value={companyGstin}
                    onChange={(e) => {
                      setCompanyGstin(e.target.value);
                      setTaxRegNo(e.target.value); // Keep in sync for compatibility
                    }}
                    placeholder="e.g. 27AABC1234F1Z5"
                    className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tax Settings Card */}
        <Card className="bg-white dark:bg-slate-800/80 backdrop-blur border border-slate-200 dark:border-slate-700/50 rounded-2xl shadow-sm">
          <CardContent className="p-6 space-y-6">
            <div className="border-b border-slate-100 dark:border-slate-700 pb-3">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Settings className="w-4 h-4 text-indigo-500" />
                Tax Rates Configuration
              </h2>
            </div>
            
            {/* Collect Tax Toggle */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Collect Tax <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-6 pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="radio"
                    name="collectTax"
                    value="Yes"
                    checked={collectTax === 'Yes'}
                    onChange={(e) => setCollectTax(e.target.value)}
                    className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Yes</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="radio"
                    name="collectTax"
                    value="No"
                    checked={collectTax === 'No'}
                    onChange={(e) => setCollectTax(e.target.value)}
                    className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">No</span>
                </label>
              </div>
            </div>

            {/* Inputs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  TAX Registration Number <span className="text-red-500">*</span>
                </label>
                <Input
                  required={collectTax === 'Yes'}
                  value={taxRegNo}
                  onChange={(e) => setTaxRegNo(e.target.value)}
                  placeholder="e.g. 27AABC1234F1Z5"
                  className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Tax Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={taxType}
                  onChange={(e) => setTaxType(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 h-10"
                >
                  <option value="Exclusive Tax">Exclusive Tax</option>
                  <option value="Inclusive Tax">Inclusive Tax</option>
                </select>
              </div>
            </div>

            {/* Taxes Table */}
            <div className="pt-4 space-y-3">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b dark:border-slate-700 text-slate-500 dark:text-slate-400 font-semibold text-xs uppercase">
                      <th className="py-2 w-12 text-center">SN</th>
                      <th className="py-2 px-4">Tax Name</th>
                      <th className="py-2 px-4 w-44">Tax Rate</th>
                      <th className="py-2 w-20 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {taxes.map((t, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                        <td className="py-3 text-center text-slate-404 font-medium">{idx + 1}</td>
                        <td className="py-3 px-4">
                          <Input
                            required
                            placeholder="e.g. CGST"
                            value={t.name}
                            onChange={(e) => handleFieldChange(idx, 'name', e.target.value)}
                            className="bg-white dark:bg-slate-900"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <div className="relative">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              required
                              value={t.rate}
                              onChange={(e) => handleFieldChange(idx, 'rate', e.target.value)}
                              className="pr-8 bg-white dark:bg-slate-900 text-right font-mono"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold">%</span>
                          </div>
                        </td>
                        <td className="py-3 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg"
                            onClick={() => handleRemoveRow(idx)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Add More Button */}
              <div>
                <Button
                  type="button"
                  onClick={handleAddRow}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex items-center gap-1 text-xs px-3 h-9"
                >
                  <Plus className="w-3.5 h-3.5" /> Add More
                </Button>
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
