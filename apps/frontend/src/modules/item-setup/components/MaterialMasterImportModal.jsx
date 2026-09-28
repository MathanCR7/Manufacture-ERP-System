import React, { useState } from 'react';
import {
  FileSpreadsheet, Upload, Download, Check, AlertCircle, X,
  FileCheck, AlertTriangle, Loader2, Sparkles, RefreshCw, ChevronRight
} from 'lucide-react';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import { api } from '@/lib/axios';

import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function MaterialMasterImportModal({ isOpen, onClose, onSuccess, subcategories = [] }) {
  const [selectedSubId, setSelectedSubId] = useState(subcategories[0]?.id || '');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewRows, setPreviewRows] = useState([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStats, setUploadStats] = useState(null);

  if (!isOpen) return null;

  // Download Excel Template for selected subcategory
  const handleDownloadTemplate = async () => {
    if (!selectedSubId) {
      Swal.fire({ title: 'Select Subcategory', text: 'Please pick a subcategory first.', icon: 'warning' });
      return;
    }

    try {
      const selectedSub = subcategories.find(s => s.id === selectedSubId);
      const res = await api.get(`/product-spec-templates/${selectedSubId}/export-excel-format`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Material_Master_${selectedSub?.code || 'Template'}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      Swal.fire({
        title: 'Download Failed',
        text: err.response?.data?.message || err.message,
        icon: 'error'
      });
    }
  };

  // Handle file selection and client-side pre-validation
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setIsParsing(true);
    setUploadStats(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      // Client pre-validation
      const validatedRows = json.map((row, idx) => {
        const errors = [];
        const name = String(row.Product_Name || row.name || '').trim();
        if (!name) errors.push('Missing Product_Name');

        const uom = String(row.UOM || row.uom || row.Unit || '').trim();
        if (!uom) errors.push('Missing UOM');

        return {
          rowNum: idx + 2,
          name: name || 'Unnamed',
          sku: row.SKU || 'Auto-Generate',
          category: row.Category || 'Auto-Match',
          subcategory: row.Subcategory || 'General',
          price: row.Sale_Price || 0,
          isValid: errors.length === 0,
          errors
        };
      });

      setPreviewRows(validatedRows);
    } catch (err) {
      Swal.fire({
        title: 'Parse Error',
        text: 'Failed to read Excel file. Please ensure it is a valid .xlsx or .csv format.',
        icon: 'error'
      });
    } finally {
      setIsParsing(false);
    }
  };

  // Upload and commit to PostgreSQL database
  const handleCommitUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await api.post('/products/bulk-import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setUploadStats(res.data);

      if (res.data.successCount > 0) {
        Swal.fire({
          title: 'Import Successful!',
          html: `
            <div class="text-xs text-slate-600 dark:text-slate-300">
              <p class="font-bold text-emerald-600 text-sm mb-1">
                ✓ ${res.data.successCount} product(s) successfully created!
              </p>
              ${res.data.failedCount > 0 ? `<p class="text-rose-500 font-semibold mt-1">⚠ ${res.data.failedCount} row(s) had errors.</p>` : ''}
            </div>
          `,
          icon: 'success',
          confirmButtonText: 'Done'
        }).then(() => {
          onSuccess && onSuccess();
          onClose();
        });
      } else {
        Swal.fire({
          title: 'Import Failed',
          html: `<p class="text-xs text-rose-500 font-medium">All rows failed validation. Please review the errors below.</p>`,
          icon: 'error'
        });
      }
    } catch (err) {
      Swal.fire({
        title: 'Server Import Error',
        text: err.response?.data?.error || err.message,
        icon: 'error'
      });
    } finally {
      setIsUploading(false);
    }
  };

  const validCount = previewRows.filter(r => r.isValid).length;
  const invalidCount = previewRows.filter(r => !r.isValid).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:px-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/70 dark:bg-slate-950/70">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              Material Master Bulk Import
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Upload multiple products along with mandatory and optional quality specifications via Excel.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Step 1: Download Subcategory Template */}
          <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Download className="w-4 h-4 text-indigo-500" />
              Step 1: Download Formatted Template
            </span>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <select
                value={selectedSubId}
                onChange={e => setSelectedSubId(e.target.value)}
                className="w-full sm:w-80 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {subcategories.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.category?.name})
                  </option>
                ))}
              </select>

              <Button
                type="button"
                onClick={handleDownloadTemplate}
                size="sm"
                variant="outline"
                className="w-full sm:w-auto text-xs font-semibold flex items-center justify-center gap-1.5 bg-white dark:bg-slate-900"
              >
                <Download className="w-3.5 h-3.5" />
                Download Excel Template
              </Button>
            </div>
            <p className="text-[11px] text-slate-400">
              The template includes all Universal Core Attributes (Dimensions, Weight, Barcode) plus dynamic columns for the subcategory's quality specs.
            </p>
          </div>

          {/* Step 2: Upload File Dropzone */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Upload className="w-4 h-4 text-emerald-500" />
              Step 2: Upload Completed File
            </span>

            <div className="border-2 border-dashed border-slate-250 dark:border-slate-700 rounded-2xl p-6 text-center bg-slate-50/50 dark:bg-slate-950/20 hover:border-emerald-500/60 transition-colors flex flex-col items-center justify-center relative cursor-pointer group">
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <FileSpreadsheet className="w-10 h-10 text-emerald-600 mb-2 group-hover:scale-105 transition-transform" />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                {selectedFile ? selectedFile.name : 'Click or drag Excel / CSV file here'}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Supported formats: .xlsx, .xls, .csv (Max 10MB)
              </p>
            </div>
          </div>

          {/* Pre-validation Preview Table */}
          {isParsing && (
            <div className="flex items-center justify-center py-6 gap-2 text-xs text-indigo-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Parsing and validating spreadsheet data...
            </div>
          )}

          {previewRows.length > 0 && !isParsing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  Pre-Validation Preview ({previewRows.length} Rows)
                </span>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200">
                    ✓ {validCount} Ready
                  </span>
                  {invalidCount > 0 && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200">
                      ⚠ {invalidCount} Issues
                    </span>
                  )}
                </div>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-48 overflow-y-auto shadow-xs">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-slate-950 text-[10px] uppercase font-bold text-slate-500">
                      <TableHead className="w-12">Row</TableHead>
                      <TableHead>Product Name</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Category / Subcategory</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.slice(0, 15).map(r => (
                      <TableRow key={r.rowNum} className="text-xs">
                        <TableCell className="font-mono text-slate-400">{r.rowNum}</TableCell>
                        <TableCell className="font-semibold text-slate-800 dark:text-slate-200">{r.name}</TableCell>
                        <TableCell className="font-mono text-[11px] text-slate-500">{r.sku}</TableCell>
                        <TableCell className="text-slate-500 text-[11px]">{r.category} &gt; {r.subcategory}</TableCell>
                        <TableCell>
                          {r.isValid ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                              <Check className="w-3 h-3" /> Valid
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-500">
                              <AlertCircle className="w-3 h-3" /> {r.errors[0]}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {previewRows.length > 15 && (
                <p className="text-[10px] text-slate-400 text-center">
                  Showing first 15 rows of {previewRows.length} total.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:px-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/70 dark:bg-slate-950/70">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            Cancel
          </Button>

          <Button
            onClick={handleCommitUpload}
            disabled={previewRows.length === 0 || isUploading}
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 flex items-center gap-1.5 shadow-xs"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Importing &amp; Validating Specs...
              </>
            ) : (
              <>
                <FileCheck className="w-3.5 h-3.5" />
                Commit {validCount} Products to Database
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
