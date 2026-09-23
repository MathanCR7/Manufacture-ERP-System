import React, { useState } from 'react';
import { 
  X, Play, CheckCircle2, Pause, RotateCcw, Award, FileText, 
  Layers, Clock, DollarSign, Calendar, Info, Package, Flame, 
  Printer, ArrowRight, ShieldCheck, ShieldAlert, Scale, Check,
  AlertTriangle, ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function BatchDetailDrawer({
  isOpen,
  onClose,
  batch,
  loading = false,
  canEdit = true,
  onUpdateStatus,
  onOpenCompletionModal
}) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'bom' | 'sop' | 'qc' | 'logs'

  if (!isOpen) return null;

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-xs animate__animated animate__fadeIn">
        <div className="w-full max-w-2xl bg-white dark:bg-slate-900 h-full p-6 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 rounded-full border-3 border-indigo-600 border-t-transparent animate-spin" />
          <p className="text-xs font-semibold text-slate-500">Loading batch details...</p>
        </div>
      </div>
    );
  }

  if (!batch) return null;

  // Status badge color configuration
  const getStatusBadge = (status) => {
    switch (status) {
      case 'Planned':
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800';
      case 'In Progress':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800';
      case 'Completed':
        return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800';
      case 'qc_passed':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800';
      case 'qc_failed':
        return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800';
      case 'On Hold':
        return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  const statusLabel = batch.status === 'qc_passed' ? 'Passed QC' : batch.status === 'qc_failed' ? 'Failed QC' : batch.status;

  // Calculate variances
  const rawUsages = batch.rmUsages || [];
  const calculatedVariances = rawUsages.map(u => {
    const required = Number(u.requiredQty || 0);
    const actual = Number(u.actualUsedQty || 0);
    return {
      rawMaterialName: u.rawMaterial?.name || 'Raw Material',
      rawMaterialCode: u.rawMaterial?.code,
      unit: u.rawMaterial?.unit?.abbreviation || 'units',
      requiredQty: required,
      actualUsedQty: actual,
      variance: actual - required,
      unitCost: Number(u.unitCost || 0),
      totalCost: Number(u.totalCost || 0)
    };
  });

  // Calculate duration
  const auditLogs = batch.auditLogs || [];
  let durationText = 'N/A';
  if (auditLogs.length > 1) {
    const first = new Date(auditLogs[0].createdAt).getTime();
    const last = new Date(auditLogs[auditLogs.length - 1].createdAt).getTime();
    const mins = Math.floor((last - first) / 60000);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    durationText = h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  // Print Batch Sheet
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-xs animate__animated animate__fadeIn animate__faster">
      <div 
        className="w-full max-w-2xl bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 h-full flex flex-col shadow-2xl animate__animated animate__slideInRight animate__faster overflow-hidden"
        role="dialog"
      >
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/40 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950 border border-indigo-100 dark:border-indigo-900 flex items-center justify-center shrink-0 overflow-hidden">
              {batch.product?.imageUrl ? (
                <img src={batch.product.imageUrl} alt={batch.product.name} className="w-full h-full object-cover" />
              ) : (
                <Package className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 truncate">
                <span className="font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400">
                  #{batch.referenceNo}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${getStatusBadge(batch.status)}`}>
                  {statusLabel}
                </span>
              </div>
              <h2 className="font-bold text-sm text-slate-900 dark:text-white truncate mt-0.5">
                {batch.product?.name}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handlePrint}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Print Batch Sheet"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Key Metrics Banner */}
        <div className="px-5 py-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 grid grid-cols-4 gap-2 text-center text-xs">
          <div className="p-2 bg-slate-50 dark:bg-slate-950/60 rounded-xl">
            <span className="text-[9px] text-slate-400 uppercase font-bold block">Target</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">
              {batch.quantity} {batch.product?.unit?.abbreviation || 'pcs'}
            </span>
          </div>
          <div className="p-2 bg-slate-50 dark:bg-slate-950/60 rounded-xl">
            <span className="text-[9px] text-slate-400 uppercase font-bold block">Actual Yield</span>
            <span className={`font-bold mt-0.5 block ${batch.actualOutput !== null ? 'text-emerald-600' : 'text-slate-400'}`}>
              {batch.actualOutput !== null ? `${batch.actualOutput} pcs` : 'Pending'}
            </span>
          </div>
          <div className="p-2 bg-slate-50 dark:bg-slate-950/60 rounded-xl">
            <span className="text-[9px] text-slate-400 uppercase font-bold block">Start Date</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">
              {new Date(batch.startDate).toLocaleDateString('en-GB')}
            </span>
          </div>
          <div className="p-2 bg-slate-50 dark:bg-slate-950/60 rounded-xl">
            <span className="text-[9px] text-slate-400 uppercase font-bold block">Duration</span>
            <span className="font-bold text-indigo-600 dark:text-indigo-400 mt-0.5 block">
              {durationText}
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-5 pt-3 border-b border-slate-200 dark:border-slate-800 flex gap-2 overflow-x-auto scrollbar-none text-xs">
          {[
            { id: 'overview', label: 'Overview', icon: Info },
            { id: 'bom', label: `BOM (${rawUsages.length})`, icon: Layers },
            { id: 'sop', label: 'SOP Steps', icon: Flame },
            { id: 'qc', label: `QC Lab (${(batch.qcTests || []).length})`, icon: Award },
            { id: 'logs', label: `Activity (${auditLogs.length})`, icon: Clock }
          ].map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`pb-2.5 px-2 font-bold flex items-center gap-1.5 transition-all border-b-2 cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-4 animate__animated animate__fadeIn">
              {/* Basic Info Block */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl space-y-2.5">
                <span className="font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] tracking-wider block">
                  Batch Parameters
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-400 text-[10px] block">Production Type:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{batch.productionType}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Expiry Buffer:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{batch.expiryDays} days</span>
                  </div>
                  {batch.batchNo && (
                    <div>
                      <span className="text-slate-400 text-[10px] block">Batch Number / Lot:</span>
                      <span className="font-semibold font-mono text-slate-800 dark:text-slate-200">{batch.batchNo}</span>
                    </div>
                  )}
                  {batch.creator && (
                    <div>
                      <span className="text-slate-400 text-[10px] block">Created By:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{batch.creator.name}</span>
                    </div>
                  )}
                </div>

                {batch.note && (
                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800">
                    <span className="text-slate-400 text-[10px] block font-bold uppercase">Instructions / Note:</span>
                    <p className="text-slate-700 dark:text-slate-300 mt-0.5 leading-relaxed">{batch.note}</p>
                  </div>
                )}
              </div>

              {/* Financial Cost Ledger */}
              <div className="p-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2.5">
                <span className="font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-indigo-500" />
                  Financial Cost Ledger
                </span>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  <div className="py-1.5 flex justify-between items-center">
                    <span className="text-slate-500">Total Material Cost:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      ₹{Number(batch.totalCost || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="py-1.5 flex justify-between items-center">
                    <span className="text-slate-500">Target Selling Price:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      ₹{Number(batch.salePrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="py-1.5 flex justify-between items-center text-indigo-600 dark:text-indigo-400 font-semibold">
                    <span>Profit Margin:</span>
                    <span>{batch.profitMargin}%</span>
                  </div>
                </div>
              </div>

              {/* Linked Sales Order */}
              {batch.order ? (
                <div className="p-4 bg-violet-50/40 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/40 rounded-2xl space-y-2">
                  <span className="font-bold text-violet-800 dark:text-violet-300 uppercase text-[10px] tracking-wider block">
                    Linked Customer Order
                  </span>
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs">
                        {batch.order.customer?.name}
                      </span>
                      <span className="font-mono text-[10px] text-violet-600 dark:text-violet-400">
                        {batch.order.referenceNo}
                      </span>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-white dark:bg-slate-900 border border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300">
                      Status: {batch.order.status}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800 rounded-xl text-slate-400 text-center italic">
                  Make-to-Stock Batch (No linked sales order)
                </div>
              )}
            </div>
          )}

          {/* TAB 2: BOM / RAW MATERIALS */}
          {activeTab === 'bom' && (
            <div className="space-y-3 animate__animated animate__fadeIn">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] tracking-wide">
                  Raw Material Variance Report
                </span>
                <span className="font-mono text-slate-500 font-semibold">
                  {calculatedVariances.length} materials assigned
                </span>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                <div className="bg-slate-50 dark:bg-slate-950 p-2.5 grid grid-cols-4 font-bold text-[10px] text-slate-500 uppercase tracking-wider">
                  <span>Material</span>
                  <span className="text-right">Required</span>
                  <span className="text-right">Actual Used</span>
                  <span className="text-right">Variance</span>
                </div>

                {calculatedVariances.length > 0 ? (
                  calculatedVariances.map((item, idx) => (
                    <div key={idx} className="p-2.5 grid grid-cols-4 items-center text-xs hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <div>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate">
                          {item.rawMaterialName}
                        </span>
                        {item.rawMaterialCode && (
                          <span className="font-mono text-[9px] text-slate-400">{item.rawMaterialCode}</span>
                        )}
                      </div>
                      <div className="text-right font-mono text-slate-600 dark:text-slate-300">
                        {item.requiredQty.toFixed(2)} {item.unit}
                      </div>
                      <div className="text-right font-mono text-slate-600 dark:text-slate-300">
                        {item.actualUsedQty.toFixed(2)} {item.unit}
                      </div>
                      <div className={`text-right font-mono font-bold ${
                        item.variance > 0 ? 'text-amber-500' : item.variance < 0 ? 'text-indigo-500' : 'text-slate-400'
                      }`}>
                        {item.variance > 0 ? `+${item.variance.toFixed(2)}` : item.variance.toFixed(2)} {item.unit}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center text-slate-400 italic">No raw material usage allocated.</div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: SOP STEPS */}
          {activeTab === 'sop' && (
            <div className="space-y-3 animate__animated animate__fadeIn">
              <span className="font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] tracking-wide block">
                Standard Operating Procedure Recipe
              </span>

              {batch.product?.sopSteps && batch.product.sopSteps.length > 0 ? (
                <div className="space-y-2.5">
                  {batch.product.sopSteps.map((step, idx) => (
                    <div key={idx} className="p-3 bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-xl space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[10px] text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                          Step #{idx + 1}
                        </span>
                        {step.stageName && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {step.stageName}
                          </span>
                        )}
                      </div>
                      <p className="font-medium text-slate-800 dark:text-slate-200 text-xs leading-relaxed">
                        {step.instruction}
                      </p>
                      {(step.tempTime || step.safetyNote) && (
                        <div className="pt-2 border-t border-dashed border-slate-100 dark:border-slate-800 text-[10px] space-y-1">
                          {step.tempTime && (
                            <span className="text-slate-500 block">🕒 {step.tempTime}</span>
                          )}
                          {step.safetyNote && (
                            <span className="text-amber-600 dark:text-amber-400 font-semibold block">⚠️ {step.safetyNote}</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 border border-dashed rounded-xl italic">
                  No SOP steps logged for this finished product.
                </div>
              )}
            </div>
          )}

          {/* TAB 4: QC RESULTS */}
          {activeTab === 'qc' && (
            <div className="space-y-3 animate__animated animate__fadeIn">
              <span className="font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] tracking-wide block">
                Quality Control Lab Tests & Inspections
              </span>

              {batch.qcTests && batch.qcTests.length > 0 ? (
                <div className="space-y-3">
                  {batch.qcTests.map((test, idx) => {
                    const isPassed = test.result?.toLowerCase() === 'pass' || test.action?.toLowerCase() === 'approved';
                    return (
                      <div key={idx} className="p-3.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            isPassed
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400'
                              : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400'
                          }`}>
                            {isPassed ? '✓ Passed QC' : '✕ Failed QC'}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(test.createdAt).toLocaleString('en-GB')}
                          </span>
                        </div>

                        {test.tester && (
                          <p className="text-[10px] text-slate-500">
                            Tested by: <strong className="text-slate-700 dark:text-slate-300">{test.tester.name}</strong>
                          </p>
                        )}

                        {test.qcNotes && (
                          <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg text-slate-700 dark:text-slate-300 text-[11px]">
                            {test.qcNotes}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 border border-dashed rounded-xl italic">
                  No QC lab reports submitted for this batch yet.
                </div>
              )}
            </div>
          )}

          {/* TAB 5: ACTIVITY LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-3 animate__animated animate__fadeIn">
              <span className="font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] tracking-wide block">
                Audit Trail & Status History
              </span>

              {auditLogs.length > 0 ? (
                <div className="relative pl-4 border-l border-slate-200 dark:border-slate-800 space-y-4">
                  {auditLogs.map((log, idx) => (
                    <div key={idx} className="relative">
                      <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-indigo-600 border-2 border-white dark:border-slate-900" />
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1">
                        <span className="font-bold text-slate-800 dark:text-white uppercase text-[10px] tracking-wide">
                          {log.action?.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(log.createdAt).toLocaleString('en-GB')} by {log.user?.name || 'System'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 border border-dashed rounded-xl italic">
                  No activity logs recorded.
                </div>
              )}
            </div>
          )}

        </div>

        {/* Drawer Footer Actions */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-between gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="rounded-xl text-xs font-semibold h-10 px-4 cursor-pointer"
          >
            Close
          </Button>

          {/* Context Actions */}
          <div className="flex items-center gap-2">
            {canEdit && batch.status === 'Planned' && (
              <Button
                type="button"
                onClick={() => {
                  onClose();
                  onUpdateStatus(batch.id, 'In Progress');
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold h-10 px-4 cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <Play className="w-3.5 h-3.5" />
                Start Production
              </Button>
            )}

            {canEdit && batch.status === 'In Progress' && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    onClose();
                    onUpdateStatus(batch.id, 'On Hold');
                  }}
                  className="rounded-xl text-xs font-bold h-10 px-3 cursor-pointer text-amber-600 border-amber-200 hover:bg-amber-50"
                >
                  <Pause className="w-3.5 h-3.5 mr-1" />
                  Hold
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenCompletionModal(batch);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold h-10 px-4 cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Complete Batch
                </Button>
              </>
            )}

            {canEdit && batch.status === 'On Hold' && (
              <Button
                type="button"
                onClick={() => {
                  onClose();
                  onUpdateStatus(batch.id, 'In Progress');
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold h-10 px-4 cursor-pointer flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5" />
                Resume Batch
              </Button>
            )}

            {canEdit && batch.status === 'qc_failed' && (
              <Button
                type="button"
                onClick={() => {
                  onClose();
                  onUpdateStatus(batch.id, 'In Progress');
                }}
                className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold h-10 px-4 cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Rework Batch
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
