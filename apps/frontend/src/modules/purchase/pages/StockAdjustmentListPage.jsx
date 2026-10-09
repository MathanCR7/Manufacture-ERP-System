import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import useAuthStore from '@/app/store/authStore';
import { useNavigate, useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { Download, Search, Edit, Trash2, ArrowLeft, Save, Loader2, AlertTriangle, Plus, Package, Lock, Calendar, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pagination } from '@/components/ui/Pagination';
import Swal from 'sweetalert2';

import StockAdjustmentForm from '../components/StockAdjustmentForm';

const StockAdjustmentListPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRowId, setExpandedRowId] = useState(null);

  const user = useAuthStore(s => s.user);
  const canEdit = ['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER'].includes(user?.role);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const [view, setView] = useState(() => {
    return (canEdit && (location.pathname.endsWith('/add') || location.state?.editData)) ? 'add' : 'list';
  });
  const [editData, setEditData] = useState(() => {
    return (canEdit && location.state?.editData) || null;
  });

  useEffect(() => {
    const isAdd = canEdit && (location.pathname.endsWith('/add') || location.state?.editData);
    setView(isAdd ? 'add' : 'list');
    setEditData(canEdit ? (location.state?.editData || null) : null);
  }, [location.pathname, location.state, canEdit]);

  const { data: adjustments = [], isLoading } = useQuery({
    queryKey: ['rm-stock-adjustment'],
    queryFn: () => api.get('/rm-stock-adjustment').then(res => res.data)
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/rm-stock-adjustment/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rm-stock-adjustment'] });
      queryClient.invalidateQueries({ queryKey: ['rm-stock'] });
      queryClient.invalidateQueries({ queryKey: ['rm-batches'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    }
  });

  const handleDelete = (id) => {
    Swal.fire({
      title: 'Delete Adjustment?',
      text: 'Are you sure you want to delete this adjustment? It will revert the stock and batch changes.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, delete',
      cancelButtonText: 'Cancel',
      customClass: {
        popup: 'rounded-2xl shadow-xl',
        confirmButton: 'rounded-xl text-xs font-bold px-4 py-2',
        cancelButton: 'rounded-xl text-xs font-bold px-4 py-2'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        deleteMutation.mutate(id);
      }
    });
  };

  // Reset pagination when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const filteredAdjustments = adjustments.filter(adj => {
    const q = searchTerm.toLowerCase();
    const batchMatch = Array.isArray(adj.batches) && adj.batches.some(b => 
      (b.batchNumber && b.batchNumber.toLowerCase().includes(q)) ||
      (b.poReferenceNo && b.poReferenceNo.toLowerCase().includes(q)) ||
      (b.grnReferenceNo && b.grnReferenceNo.toLowerCase().includes(q))
    );
    return (
      adj.rawMaterialName?.toLowerCase().includes(q) ||
      adj.rawMaterialCode?.toLowerCase().includes(q) ||
      adj.type?.toLowerCase().includes(q) ||
      adj.notes?.toLowerCase().includes(q) ||
      batchMatch
    );
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredAdjustments.length / ITEMS_PER_PAGE);
  const paginatedAdjustments = filteredAdjustments.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  if (view !== 'list') {
    return (
      <StockAdjustmentForm 
        editData={editData} 
        onBack={() => {
          setView('list');
          setEditData(null);
          navigate('/rm/stock-adjustment/list');
        }} 
      />
    );
  }

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4 mx-auto transition-all duration-300">
      {!canEdit && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-955/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl text-amber-800 dark:text-amber-300 text-sm font-medium animate-in fade-in slide-in-from-top-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>You have <strong>Read-Only access</strong> to Stock Adjustments. Modifying raw material quantities is restricted.</span>
        </div>
      )}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Stock Adjustment</h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 font-medium">Directly adjust inventory stocks for raw materials with full batch allocation and audit logs</p>
        </div>
        {canEdit && (
          <Button 
            onClick={() => {
              setView('add');
              setEditData(null);
              navigate('/rm/stock-adjustment/add');
            }} 
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl flex items-center shadow-sm text-xs h-9 cursor-pointer border-none"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Stock Adjustment
          </Button>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        {/* Toolbar */}
        <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-3 bg-slate-50/50 dark:bg-slate-900/50 text-xs">
          <div className="flex gap-2 w-full sm:w-auto">
            <Button onClick={() => {
              if (filteredAdjustments.length === 0) return;
              const headers = ['SN', 'Raw Material', 'Type', 'Quantity', 'Unit', 'Batches', 'Notes', 'Date', 'Adjusted By'];
              const rows = filteredAdjustments.map((a, i) => [
                i + 1,
                `"${a.rawMaterialName} (${a.rawMaterialCode})"`,
                a.type,
                a.quantity,
                a.unit,
                `"${(a.batches || []).map(b => `${b.batchNumber} (${b.quantity})`).join('; ')}"`,
                `"${(a.notes || '').replace(/"/g, '""')}"`,
                format(new Date(a.createdAt), 'yyyy-MM-dd'),
                a.createdBy || 'Unknown'
              ]);
              const csv = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
              const link = document.createElement('a');
              link.setAttribute('href', encodeURI(csv));
              link.setAttribute('download', `rm_stock_adjustments_${new Date().toISOString().split('T')[0]}.csv`);
              document.body.appendChild(link); link.click(); document.body.removeChild(link);
            }} variant="outline" className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 dark:border-indigo-800 dark:hover:bg-indigo-900/30 text-xs font-bold rounded-xl h-9">
              <Download className="w-3.5 h-3.5 mr-1.5" /> Export adjustments
            </Button>
          </div>
          
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by RM, batch, PO, GRN, type..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 h-9 font-semibold"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/65 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-widest text-[11px]">
                <th className="py-2.5 px-4 w-12 text-center">SN</th>
                <th className="py-2.5 px-4 min-w-[200px]">Raw Material (Code)</th>
                <th className="py-2.5 px-4 w-28">Type</th>
                <th className="py-2.5 px-4 text-right w-28">Quantity</th>
                <th className="py-2.5 px-4 min-w-[240px]">Batches Allocated</th>
                <th className="py-2.5 px-4 min-w-[180px]">Reason & Notes</th>
                <th className="py-2.5 px-4 w-28">Date</th>
                {canEdit && <th className="py-2.5 px-4 text-center w-24">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">Loading adjustments...</td>
                </tr>
              ) : paginatedAdjustments.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">No stock adjustments found.</td>
                </tr>
              ) : (
                paginatedAdjustments.map((adj, index) => {
                  const calculatedIndex = (currentPage - 1) * ITEMS_PER_PAGE + index + 1;
                  const batchesList = Array.isArray(adj.batches) ? adj.batches : [];
                  const isExpanded = expandedRowId === adj.id;

                  return (
                    <React.Fragment key={adj.id}>
                      <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors border-b border-slate-100 dark:border-slate-800">
                        <td className="py-3 px-4 text-slate-500 font-semibold text-center">
                          {calculatedIndex}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-900 dark:text-white">
                            {adj.rawMaterialName}
                          </p>
                          <span className="font-mono text-[10px] text-slate-400 font-semibold">
                            {adj.rawMaterialCode}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                            adj.type === 'ADDITION' 
                              ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20' 
                              : 'bg-rose-500/10 text-rose-600 dark:text-rose-450 border-rose-500/20'
                          }`}>
                            {adj.type === 'ADDITION' ? '+ Addition' : '- Subtraction'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-black text-slate-900 dark:text-white">
                          {Number(adj.quantity).toLocaleString()} <span className="text-[10px] font-normal text-slate-450 uppercase">{adj.unit}</span>
                        </td>
                        <td className="py-3 px-4">
                          {batchesList.length === 0 ? (
                            <span className="text-slate-400 text-[11px] italic">General (No Lot)</span>
                          ) : (
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {batchesList.slice(0, 2).map((b, bIdx) => (
                                  <span
                                    key={bIdx}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/70 font-mono text-[10px] font-bold"
                                  >
                                    <Lock className="w-2.5 h-2.5 text-indigo-400" />
                                    {b.batchNumber}
                                    <span className="text-[9px] font-normal text-slate-500">({b.quantity} {adj.unit})</span>
                                  </span>
                                ))}

                                {batchesList.length > 2 && (
                                  <button
                                    type="button"
                                    onClick={() => setExpandedRowId(isExpanded ? null : adj.id)}
                                    className="inline-flex items-center gap-0.5 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 underline cursor-pointer"
                                  >
                                    +{batchesList.length - 2} more
                                  </button>
                                )}
                              </div>

                              {batchesList.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setExpandedRowId(isExpanded ? null : adj.id)}
                                  className="text-[10px] text-slate-400 hover:text-indigo-600 flex items-center gap-1 font-medium cursor-pointer"
                                >
                                  {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                  {isExpanded ? 'Hide Batch Details' : 'View Batch Details'}
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300 max-w-[220px] truncate" title={adj.notes || ''}>
                          {adj.notes || '—'}
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-[11px]">
                          {format(new Date(adj.createdAt), 'dd-MM-yyyy')}
                          <span className="block text-[10px] text-slate-400">{adj.createdBy}</span>
                        </td>
                        {canEdit && (
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button 
                                onClick={() => navigate('/rm/stock-adjustment/add', { state: { editData: {
                                  id: adj.id,
                                  rawMaterialId: adj.rawMaterialId,
                                  rawMaterial: { id: adj.rawMaterialId, code: adj.rawMaterialCode, name: adj.rawMaterialName, unit: adj.unit },
                                  type: adj.type,
                                  quantity: adj.quantity,
                                  notes: adj.notes,
                                  batches: adj.batches
                                }}})}
                                className="text-indigo-600 hover:text-indigo-750 transition-colors p-1.5 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 rounded-lg cursor-pointer" 
                                title="Edit"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleDelete(adj.id)}
                                className="text-rose-600 hover:text-rose-750 transition-colors p-1.5 hover:bg-rose-50/50 dark:hover:bg-rose-950/20 rounded-lg cursor-pointer" 
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>

                      {/* Expandable row showing full batch breakdown */}
                      {isExpanded && batchesList.length > 0 && (
                        <tr className="bg-slate-50/70 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 animate-in fade-in duration-150">
                          <td colSpan="8" className="p-3 px-6">
                            <div className="space-y-2">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                                <Package className="w-3.5 h-3.5" />
                                Batch Breakdown for {adj.rawMaterialName} ({batchesList.length} Batches)
                              </span>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                {batchesList.map((b, bIdx) => (
                                  <div
                                    key={bIdx}
                                    className="p-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 text-[11px] space-y-1 shadow-2xs"
                                  >
                                    <div className="flex items-center justify-between font-mono font-bold">
                                      <span className="text-indigo-600 dark:text-indigo-400">#{bIdx + 1} {b.batchNumber}</span>
                                      <span className="text-slate-900 dark:text-white font-black">{b.quantity} {adj.unit}</span>
                                    </div>
                                    <div className="text-slate-500 dark:text-slate-400 space-y-0.5 text-[10px]">
                                      {b.poReferenceNo && <div>PO Ref: <strong className="text-slate-700 dark:text-slate-200">{b.poReferenceNo}</strong></div>}
                                      {b.grnReferenceNo && <div>GRN Ref: <strong className="text-slate-700 dark:text-slate-200">{b.grnReferenceNo}</strong></div>}
                                      {b.supplierName && <div>Supplier: <strong className="text-slate-700 dark:text-slate-200">{b.supplierName}</strong></div>}
                                      {b.storageLocation && <div>Location: <strong className="text-slate-700 dark:text-slate-200">{b.storageLocation}</strong></div>}
                                      {b.weight && <div>Weight: <strong className="text-slate-700 dark:text-slate-200">{b.weight}</strong></div>}
                                      {b.mfgBatchNo && <div>MFG Batch: <strong className="text-slate-700 dark:text-slate-200">{b.mfgBatchNo}</strong></div>}
                                      {b.mfgDate && <div>MFG Date: <strong className="text-slate-700 dark:text-slate-200">{String(b.mfgDate).slice(0, 10)}</strong></div>}
                                      {b.expDate && <div>Exp Date: <strong className="text-rose-600 dark:text-rose-400">{String(b.expDate).slice(0, 10)}</strong></div>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info & Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-900/20 flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium order-2 sm:order-1">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredAdjustments.length)} of {filteredAdjustments.length} adjustments
            </div>

            <div className="order-1 sm:order-2">
              <Pagination 
                currentPage={currentPage} 
                totalPages={totalPages} 
                onPageChange={setCurrentPage} 
              />
            </div>

            <div className="text-xs text-slate-400 font-medium order-3">
              Matched entries: {filteredAdjustments.length} entries
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StockAdjustmentListPage;
