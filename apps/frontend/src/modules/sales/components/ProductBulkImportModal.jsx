import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import {
  Upload, Download, FileSpreadsheet, CheckCircle2, AlertTriangle,
  X, Loader2, FileCheck, RefreshCw, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ProductBulkImportModal({ isOpen, onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [dryRunResult, setDryRunResult] = useState(null);
  const [isDryRunning, setIsDryRunning] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const queryClient = useQueryClient();

  if (!isOpen) return null;

  const handleDownloadTemplate = async () => {
    try {
      const response = await api.get('/products/bulk-template', { responseType: 'blob' });
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'Product_Master_Template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setErrorMsg('Failed to download template. Please check server connection.');
    }
  };

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setDryRunResult(null);
      setErrorMsg(null);
    }
  };

  const handleDryRun = async () => {
    if (!file) return;
    setIsDryRunning(true);
    setErrorMsg(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('dryRun', 'true');

    try {
      const res = await api.post('/products/bulk-import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setDryRunResult(res.data);
    } catch (err) {
      setErrorMsg(err?.response?.data?.error || 'Validation failed. Please verify file format.');
    } finally {
      setIsDryRunning(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!file) return;
    setIsImporting(true);
    setErrorMsg(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('dryRun', 'false');

    try {
      const res = await api.post('/products/bulk-import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products-search'] });
      if (onSuccess) onSuccess(res.data);
      onClose();
    } catch (err) {
      setErrorMsg(err?.response?.data?.error || 'Bulk import execution failed.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Bulk Import Finished Products
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Import product master items, HSN codes, GST rates, UOM, and opening stock via Excel
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Download Template Strip */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/20 dark:to-blue-950/20 border border-indigo-100 dark:border-indigo-900/40 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-indigo-900 dark:text-indigo-300">
                Need the standard spreadsheet format?
              </p>
              <p className="text-xs text-indigo-700/80 dark:text-indigo-400 mt-0.5">
                Download the pre-structured Excel template with sample finished goods.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              className="bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Download Template
            </Button>
          </div>

          {/* File Upload Box */}
          <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 rounded-2xl p-6 text-center transition-all bg-slate-50/50 dark:bg-slate-950/20">
            <input
              type="file"
              id="product-bulk-file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <label htmlFor="product-bulk-file" className="cursor-pointer flex flex-col items-center">
              <Upload className="w-8 h-8 text-indigo-500 mb-2" />
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {file ? file.name : 'Click to select Excel (.xlsx) or CSV file'}
              </span>
              <span className="text-xs text-slate-400 mt-1">
                {file ? `${(file.size / 1024).toFixed(1)} KB selected` : 'Supports up to 5,000 products per import'}
              </span>
            </label>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Dry Run Validation Results */}
          {dryRunResult && (
            <div className="space-y-4 animate-in fade-in">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <span className="text-xs text-slate-400 font-medium block">Total Scanned</span>
                  <span className="text-lg font-bold text-slate-800 dark:text-slate-100">
                    {dryRunResult.totalRows}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium block">Valid Rows</span>
                  <span className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                    {dryRunResult.validCount}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
                  <span className="text-xs text-rose-600 dark:text-rose-400 font-medium block">Error Rows</span>
                  <span className="text-lg font-bold text-rose-700 dark:text-rose-300">
                    {dryRunResult.errorCount}
                  </span>
                </div>
              </div>

              {/* Error list if any */}
              {dryRunResult.errors?.length > 0 && (
                <div className="p-3 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/60 rounded-xl max-h-40 overflow-y-auto space-y-1.5">
                  <p className="text-xs font-bold text-rose-700 dark:text-rose-400">
                    Validation Issues ({dryRunResult.errors.length} rows will be skipped):
                  </p>
                  {dryRunResult.errors.map((err, idx) => (
                    <div key={idx} className="text-[11px] text-rose-600 dark:text-rose-400 flex items-start gap-1.5">
                      <span className="font-mono font-bold shrink-0">Row {err.row}:</span>
                      <span>{err.productName} — {err.reasons.join(', ')}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Valid Preview Table */}
              {dryRunResult.validPreview?.length > 0 && (
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Valid Items Preview (First 10)
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="p-2">Name</th>
                          <th className="p-2">Category</th>
                          <th className="p-2">Price</th>
                          <th className="p-2">HSN</th>
                          <th className="p-2">GST</th>
                          <th className="p-2">Stock</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                        {dryRunResult.validPreview.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="p-2 font-medium">{item.name}</td>
                            <td className="p-2 text-slate-400">{item.categoryName || 'Default'}</td>
                            <td className="p-2">₹{item.salePrice}</td>
                            <td className="p-2 font-mono text-[11px]">{item.hsnCode}</td>
                            <td className="p-2 font-medium text-indigo-600">{item.gstRate}%</td>
                            <td className="p-2">{item.openingStock} {item.uomName}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/40">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            {!dryRunResult ? (
              <Button
                type="button"
                disabled={!file || isDryRunning}
                onClick={handleDryRun}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {isDryRunning ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Validating Rows...
                  </>
                ) : (
                  <>
                    <FileCheck className="w-4 h-4 mr-2" />
                    Validate / Dry Run
                  </>
                )}
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDryRunResult(null)}
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  Re-test File
                </Button>
                <Button
                  type="button"
                  disabled={dryRunResult.validCount === 0 || isImporting}
                  onClick={handleExecuteImport}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Importing {dryRunResult.validCount} Items...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Import {dryRunResult.validCount} Products
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
