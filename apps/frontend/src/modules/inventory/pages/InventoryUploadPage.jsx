import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { Package, Search, CheckCircle, Upload, Loader2, AlertTriangle, ArrowLeft, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const InventoryUploadPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefillGrnId = searchParams.get('grnId');
  const queryClient = useQueryClient();

  const [selectedGrnId, setSelectedGrnId] = useState(prefillGrnId || '');
  const [storageLocation, setStorageLocation] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Fetch approved GRNs (lab approved but not yet uploaded)
  const { data: approvedGrns = [] } = useQuery({
    queryKey: ['grn-lab-approved'],
    queryFn: () => api.get('/grn/receive').then(r =>
      r.data.filter(g => g.status === 'LAB_APPROVED' && g.inventoryStatus !== 'UPLOADED')
    ),
  });

  // Fetch selected GRN details
  const { data: selectedGRN } = useQuery({
    queryKey: ['grn-detail', selectedGrnId],
    queryFn: () => api.get(`/grn/receive/${selectedGrnId}`).then(r => r.data),
    enabled: !!selectedGrnId,
  });

  // Fetch inventory batches
  const { data: batches = [] } = useQuery({
    queryKey: ['inventory-batches'],
    queryFn: () => api.get('/inventory').then(r => r.data),
  });

  const uploadMutation = useMutation({
    mutationFn: () => api.post('/inventory/upload', {
      grnId: selectedGrnId,
      storageLocation: storageLocation || undefined,
      expiryDate: expiryDate || undefined,
      remarks: remarks || undefined,
    }).then(r => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-batches'] });
      queryClient.invalidateQueries({ queryKey: ['grn-lab-approved'] });
      setSuccess(`Inventory uploaded! Batch Number: ${data.batchNumber}`);
      setSelectedGrnId('');
      setStorageLocation('');
      setExpiryDate('');
      setRemarks('');
    },
    onError: (err) => setError(err?.response?.data?.error || 'Upload failed'),
  });

  const orderedQty = selectedGRN?.items?.reduce((s, i) => s + Number(i.actualReceivedQty) - Number(i.returnQty || 0), 0) || 0;
  const sampleQty = selectedGRN?.labTest ? Number(selectedGRN.labTest.sampleQty || 0) : 0;
  const netQty = Math.max(0, orderedQty - sampleQty);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/grn/list')} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-500" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-emerald-500" />
            Inventory Upload
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Upload lab-approved raw materials into inventory</p>
        </div>
      </div>

      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 flex gap-3">
          <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
          <div>
            <p className="font-semibold text-green-700 dark:text-green-400">Upload Successful!</p>
            <p className="text-sm text-green-600 dark:text-green-400 mt-1">{success}</p>
          </div>
        </div>
      )}

      {/* Upload Form */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-5">
        <h2 className="font-semibold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-700 pb-3">Select GRN to Upload</h2>

        <div>
          <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Approved GRN *</Label>
          <select
            value={selectedGrnId}
            onChange={e => { setSelectedGrnId(e.target.value); setError(null); setSuccess(null); }}
            className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Select a lab-approved GRN...</option>
            {approvedGrns.map(g => (
              <option key={g.id} value={g.id}>
                {g.referenceNo} — {g.po?.name || 'Unknown'} ({g.po?.supplier?.name || '?'}) — {format(new Date(g.receivedDate), 'dd MMM yyyy')}
              </option>
            ))}
          </select>
          {approvedGrns.length === 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">No approved GRNs pending inventory upload.</p>
          )}
        </div>

        {/* Auto-populated details */}
        {selectedGRN && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">GRN #</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white font-mono">{selectedGRN.referenceNo}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">PO #</p>
              <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">{selectedGRN.po?.referenceNo || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Supplier</p>
              <p className="text-sm font-medium text-slate-900 dark:text-white">{selectedGRN.po?.supplier?.name || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Raw Material</p>
              <p className="text-sm font-medium text-slate-900 dark:text-white">{selectedGRN.po?.name || selectedGRN.items?.[0]?.rmName || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Received Qty</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{orderedQty.toFixed(2)} {selectedGRN.po?.uom?.abbreviation}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Sample Used (Lab)</p>
              <p className="text-sm font-semibold text-orange-600 dark:text-orange-400">- {sampleQty.toFixed(2)} {selectedGRN.po?.uom?.abbreviation}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">Net Uploadable Quantity</p>
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{netQty.toFixed(2)} {selectedGRN.po?.uom?.abbreviation}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Storage Location</Label>
            <Input
              value={storageLocation}
              onChange={e => setStorageLocation(e.target.value)}
              placeholder="e.g., Warehouse A, Rack 3, Bin 7"
              className="text-sm"
            />
          </div>
          <div>
            <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Expiry Date</Label>
            <Input
              type="date"
              value={expiryDate}
              onChange={e => setExpiryDate(e.target.value)}
              className="text-sm"
            />
          </div>
        </div>
        <div>
          <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Remarks</Label>
          <textarea
            value={remarks}
            onChange={e => setRemarks(e.target.value)}
            rows={2}
            placeholder="Any additional notes..."
            className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
          />
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> {error}
          </div>
        )}

        <div className="flex justify-end">
          <Button
            onClick={() => { setError(null); uploadMutation.mutate(); }}
            disabled={!selectedGrnId || uploadMutation.isPending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {uploadMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            Upload to Inventory
          </Button>
        </div>
      </div>

      {/* Existing Batches */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="font-semibold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-700 pb-3 mb-4">
          Inventory Batches ({batches.length})
        </h2>
        {batches.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No inventory batches yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide border-b border-slate-100 dark:border-slate-700">
                  {['Batch #', 'PO #', 'GRN #', 'Raw Material', 'Net Qty', 'UOM', 'Storage', 'Expiry', 'Added', 'Status'].map(h => (
                    <th key={h} className="pb-3 pr-4 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {batches.map(b => (
                  <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="py-3 pr-4 font-mono text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">{b.batchNumber}</td>
                    <td className="py-3 pr-4 text-xs text-indigo-600 dark:text-indigo-400 whitespace-nowrap">{b.po?.referenceNo || '—'}</td>
                    <td className="py-3 pr-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{b.grn?.referenceNo || '—'}</td>
                    <td className="py-3 pr-4 text-sm font-medium text-slate-900 dark:text-white whitespace-nowrap">{b.rawMaterialName}</td>
                    <td className="py-3 pr-4 text-sm font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{Number(b.netQty).toFixed(2)}</td>
                    <td className="py-3 pr-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{b.uom?.abbreviation}</td>
                    <td className="py-3 pr-4 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">{b.storageLocation || '—'}</td>
                    <td className="py-3 pr-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {b.expiryDate ? format(new Date(b.expiryDate), 'dd MMM yyyy') : '—'}
                    </td>
                    <td className="py-3 pr-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {format(new Date(b.createdAt), 'dd MMM yyyy')}
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        b.status === 'AVAILABLE' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                        b.status === 'DEPLETED' ? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400' :
                        'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                      }`}>{b.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default InventoryUploadPage;
