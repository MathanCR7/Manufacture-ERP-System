import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Search, Check, Layers, Sliders, ShieldCheck, 
  Sparkles, Info, Factory, RefreshCw, Box, AlertCircle,
  HelpCircle, CheckCircle2, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/axios';
import { formatIndian } from '../utils/productionCalculation';

const CATEGORY_TABS = [
  { id: 'ALL', label: 'All Moulds' },
  { id: 'Chocobar / Stick', label: 'Chocobar / Stick' },
  { id: 'Kulfi', label: 'Kulfi' },
  { id: 'Cup / Tub', label: 'Cup / Tub' },
  { id: 'Mini stick', label: 'Mini stick' },
  { id: 'Standard stick', label: 'Standard stick' },
  { id: 'Large stick', label: 'Large stick' },
  { id: 'Cone kulfi', label: 'Cone kulfi' },
  { id: 'Sandwich', label: 'Sandwich' },
  { id: 'Cake', label: 'Cake' },
  { id: 'Novelty', label: 'Novelty' },
  { id: 'Twister', label: 'Twister' },
  { id: 'Dual flavour', label: 'Dual flavour' },
  { id: 'VERIFIED_SPECS', label: '⭐ Verified Specs' }
];

export default function ProductionMouldPickerModal({
  isOpen = false,
  onClose,
  onSelectMould,
  selectedMouldId = null,
  initialCategory = 'ALL'
}) {
  const [moulds, setMoulds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState(initialCategory || 'ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, VERIFIED, ESTIMATED, MACHINE_SPECIFIC

  // Fetch moulds catalogue
  useEffect(() => {
    if (!isOpen) return;
    const fetchMoulds = async () => {
      try {
        setLoading(true);
        const res = await api.get('/production/standard/moulds?all=1').catch(() => api.get('/production/moulds?all=1'));
        const list = res.data?.moulds || (Array.isArray(res.data) ? res.data : (res.data?.data || []));
        setMoulds(list);
      } catch (err) {
        console.error('Failed to load ice cream moulds:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMoulds();
  }, [isOpen]);

  // Filtered moulds
  const filteredMoulds = useMemo(() => {
    return moulds.filter(m => {
      const cat = m.mould_category || m.mouldCategory;
      const specStatus = m.specification_status || m.specificationStatus;
      const code = (m.mould_code || m.mouldCode || '').toLowerCase();
      const name = (m.mould_name || m.mouldName || '').toLowerCase();
      const model = (m.model_number || m.modelNumber || '').toLowerCase();
      const supplier = (m.supplier_name || m.supplierName || '').toLowerCase();
      const machine = (m.machine_type || m.machineType || '').toLowerCase();

      // Category filter
      if (activeCategory === 'VERIFIED_SPECS') {
        if (specStatus !== 'VERIFIED') return false;
      } else if (activeCategory !== 'ALL' && cat !== activeCategory) {
        return false;
      }

      // Specification status filter
      if (statusFilter !== 'ALL' && specStatus !== statusFilter) {
        return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        if (!code.includes(q) && !name.includes(q) && !model.includes(q) && !supplier.includes(q) && !machine.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [moulds, activeCategory, statusFilter, searchTerm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="w-full max-w-5xl max-h-[92vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden font-['Plus_Jakarta_Sans',sans-serif]"
        role="dialog"
        aria-modal="true"
      >
        {/* ── HEADER ── */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Box className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Ice Cream Mould Specifications Master
                </h2>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300">
                  {moulds.length} Moulds in Catalog
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Select verified manufacturer specifications or ERP planning size variants with automatic nominal capacity math
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── FORMULA HIGHLIGHT BAR ── */}
        <div className="bg-indigo-50/70 dark:bg-indigo-950/40 border-b border-indigo-100 dark:border-indigo-900/40 px-5 py-2.5 flex items-center justify-between gap-3 text-xs shrink-0 flex-wrap">
          <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200 font-medium">
            <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>
              <strong>Nominal Mould Set Capacity Formula:</strong>
              <code className="ml-2 px-2 py-0.5 rounded bg-white dark:bg-slate-900 font-mono text-[11.5px] font-bold text-indigo-700 dark:text-indigo-300 border border-indigo-200">
                Total Nominal Capacity (ml) = Capacity per Cavity (ml) × Cavity Count
              </code>
            </span>
          </div>
          <div className="text-[11px] text-indigo-600 dark:text-indigo-300 font-semibold">
            Sources: Satnam Group • Aarav Trading • Kunal International • Packaging Since 1955
          </div>
        </div>

        {/* ── SEARCH & CATEGORY FILTER BAR ── */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col gap-3 shrink-0">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by mould code (IM-0001, SG-5011, SB-8002), name, category..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/60 dark:bg-slate-950 focus:outline-hidden focus:ring-1.5 focus:ring-indigo-500 focus:bg-white transition-all shadow-3xs"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status:</span>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="text-xs border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 bg-white dark:bg-slate-950 font-semibold text-slate-700 dark:text-slate-300 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="VERIFIED">Verified Specifications</option>
                <option value="ESTIMATED">ERP Planning Estimates</option>
                <option value="MACHINE_SPECIFIC">Machine Specific</option>
              </select>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
            {CATEGORY_TABS.map(tab => {
              const active = activeCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveCategory(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                    active
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <span>{tab.label}</span>
                  {active && <span className="w-1.5 h-1.5 rounded-full bg-white ml-0.5" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── MOULDS GRID CONTENT ── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-slate-50/50 dark:bg-slate-950/40">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
              <p className="text-xs font-medium">Loading mould specifications from database...</p>
            </div>
          ) : filteredMoulds.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <AlertCircle className="w-10 h-10 text-slate-300" />
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">No moulds match your criteria</p>
              <p className="text-xs text-slate-400">Try adjusting your category tabs or search query.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setActiveCategory('ALL'); setSearchTerm(''); setStatusFilter('ALL'); }}
                className="mt-2 text-xs font-bold"
              >
                Reset Filters
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredMoulds.map(m => {
                const code = m.mould_code || m.mouldCode;
                const name = m.mould_name || m.mouldName;
                const model = m.model_number || m.modelNumber;
                const supplier = m.supplier_name || m.supplierName;
                const specStatus = m.specification_status || m.specificationStatus;
                const cap = Number(m.capacity_ml ?? m.capacityMl ?? 0);
                const cav = (m.cavity_count !== null && m.cavity_count !== undefined) ? Number(m.cavity_count) : ((m.cavityCount !== null && m.cavityCount !== undefined) ? Number(m.cavityCount) : null);
                const totalNominal = (m.total_nominal_capacity_ml !== null && m.total_nominal_capacity_ml !== undefined) ? Number(m.total_nominal_capacity_ml) : (cav !== null ? cap * cav : null);
                const isSelected = selectedMouldId === m.id || selectedMouldId === code;
                const isVerified = specStatus === 'VERIFIED';

                return (
                  <div
                    key={m.id || code}
                    onClick={() => onSelectMould && onSelectMould({
                      ...m,
                      id: m.id,
                      mould_code: code,
                      mouldCode: code,
                      mould_name: name,
                      mouldName: name,
                      capacity_ml: cap,
                      capacityMl: cap,
                      cavity_count: cav,
                      cavityCount: cav,
                      total_nominal_capacity_ml: totalNominal
                    })}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/30 ring-2 ring-indigo-500/20 shadow-md'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-300 hover:shadow-xs'
                    }`}
                  >
                    {/* Top Row: Code & Verified Badge */}
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <span className="font-mono text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800">
                          {code}
                        </span>

                        {isVerified ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/70 dark:text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-300 shrink-0">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            VERIFIED SPEC
                          </span>
                        ) : specStatus === 'MACHINE_SPECIFIC' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/70 dark:text-amber-300 px-2 py-0.5 rounded-full border border-amber-300 shrink-0">
                            MACHINE SPEC
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300 px-2 py-0.5 rounded-full shrink-0">
                            ERP ESTIMATE
                          </span>
                        )}
                      </div>

                      {/* Mould Title */}
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1 mt-1">
                        {name}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {model ? `Model: ${model}` : ''} {supplier ? `• ${supplier}` : ''}
                      </p>
                    </div>

                    {/* Specifications Metrics Box */}
                    <div className="my-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 text-[11px]">Capacity / Cavity:</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          {cap.toFixed(1)} ml
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 text-[11px]">Cavity Count:</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          {cav !== null ? `${cav} cavities` : 'NULL (Enter on floor)'}
                        </span>
                      </div>

                      <div className="pt-1.5 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                        <span className="text-indigo-600 dark:text-indigo-400 font-bold text-[11px]">
                          Nominal Tray Capacity:
                        </span>
                        <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 text-sm">
                          {totalNominal !== null ? `${formatIndian(totalNominal)} ml` : 'Computed on floor'}
                        </span>
                      </div>
                    </div>

                    {/* Dimensions & Material footer */}
                    <div className="text-[10px] text-slate-500 border-t border-slate-100 dark:border-slate-800/60 pt-2 flex items-center justify-between">
                      <span className="truncate mr-2">
                        {m.dimension_text || (m.tray_length_mm ? `${m.tray_length_mm}x${m.tray_width_mm} mm` : 'Dimensions on drawing')}
                      </span>
                      <span className="shrink-0 font-medium text-slate-400">
                        {m.material || 'SS 304'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── FOOTER ── */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between shrink-0 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Industrial reference tooling catalogue ready for automatic mould tray math</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs font-bold rounded-xl cursor-pointer"
          >
            Cancel
          </Button>
        </div>

      </div>
    </div>
  );
}
