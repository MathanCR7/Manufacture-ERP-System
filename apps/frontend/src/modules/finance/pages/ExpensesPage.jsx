import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import {
  Plus, Search, Edit2, Trash2, TrendingUp, DollarSign, Calendar, FileText, X,
  Layers, Download, CheckSquare, Square, ChevronDown, Filter,
  ArrowUpDown, ArrowUp, ArrowDown, Copy, PlusCircle, Check,
  RotateCcw, PieChart as PieChartIcon, BarChart3, Eye,
  Paperclip, Upload, Image as ImageIcon,
  ExternalLink, CreditCard, Loader2, Building2, Percent, Hash,
  Calculator, Receipt, Info, ShieldCheck, Sparkles, Maximize2, Minimize2
} from 'lucide-react';
import { api } from '@/lib/axios';
import DatePicker from '@/components/ui/DatePicker';
import Swal from 'sweetalert2';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { Pagination } from '@/components/ui/Pagination';
import useCompanyStore from '@/app/store/companyStore';
import QuickAddSupplierModal from '@/components/forms/QuickAddSupplierModal';
import GstCalculationModal, { calculateGstBreakdown } from '@/modules/purchase/components/GstCalculationModal';
import PaymentFieldsSection, { ImagePreviewModal, resolvePaymentImageUrl, PAYMENT_MODES } from '@/modules/purchase/components/PaymentFieldsSection';

// Helper to construct fully qualified static file URL
const getFileUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  const serverHost = apiBase.replace(/\/api\/?$/, '');
  return `${serverHost}${url.startsWith('/') ? '' : '/'}${url}`;
};

// Curated Vibrant Color Palette for Master Categories
const PALETTE = [
  { color: '#10b981', bg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },
  { color: '#6366f1', bg: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800' },
  { color: '#f59e0b', bg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
  { color: '#f97316', bg: 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800' },
  { color: '#06b6d4', bg: 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800' },
  { color: '#a855f7', bg: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800' },
  { color: '#ec4899', bg: 'bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800' },
  { color: '#ef4444', bg: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800' },
  { color: '#3b82f6', bg: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
  { color: '#64748b', bg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700' }
];

const DATE_PRESETS = [
  { id: 'ALL', label: 'All Time' },
  { id: 'TODAY', label: 'Today' },
  { id: 'THIS_WEEK', label: 'This Week' },
  { id: 'THIS_MONTH', label: 'This Month' },
  { id: 'THIS_QUARTER', label: 'This Quarter' },
  { id: 'CUSTOM', label: 'Custom Range' }
];

// Clean Toast Without Backdrop Blur
const showCustomToast = (title, message, icon = 'success') => {
  const isDark = document.documentElement.classList.contains('dark');
  Swal.fire({
    title: `<span class="font-extrabold text-xs text-slate-800 dark:text-slate-100">${title}</span>`,
    html: `<p class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">${message}</p>`,
    icon: icon,
    iconColor: icon === 'success' ? '#10b981' : '#ef4444',
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3500,
    timerProgressBar: true,
    background: isDark ? '#0f172a' : '#ffffff',
    color: isDark ? '#f8fafc' : '#0f172a',
    customClass: {
      popup: `rounded-xl border ${icon === 'success' ? 'border-emerald-200 dark:border-emerald-900' : 'border-red-200 dark:border-red-900'} shadow-lg p-3`,
      timerProgressBar: icon === 'success' ? 'bg-emerald-500' : 'bg-red-500'
    }
  });
};

// ==========================================
// 🌟 ULTRA-STYLISH PORTAL-POWERED SUPPLIER SELECT COMPONENT
// Mounted via React Portal with z-[9999999] so it is NEVER clipped by table overflow or dialogs
// Includes auto-flip positioning (opens upward if near screen bottom), search & quick-add
// ==========================================
function SupplierSelect({
  suppliers = [],
  value,
  onChange,
  onAddNew,
  placeholder = "Select Supplier / Vendor...",
  isInterStateForSupplier,
  compact = false
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);
  const [coords, setCoords] = useState(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return suppliers;
    const q = search.toLowerCase();
    return suppliers.filter(s =>
      (s.name || '').toLowerCase().includes(q) || 
      (s.phone && s.phone.toLowerCase().includes(q)) ||
      (s.gstin && s.gstin.toLowerCase().includes(q)) ||
      (s.state && s.state.toLowerCase().includes(q)) ||
      (s.city && s.city.toLowerCase().includes(q))
    );
  }, [suppliers, search]);

  const calculateCoords = useCallback(() => {
    if (!buttonRef.current) return null;
    const rect = buttonRef.current.getBoundingClientRect();
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
    const dropdownWidth = isMobile
      ? Math.max(280, window.innerWidth - 24)
      : Math.min(520, Math.max(rect.width, 460));

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUpwards = spaceBelow < 340 && spaceAbove > spaceBelow;

    let left = isMobile ? 12 : rect.left;
    if (!isMobile) {
      if (left + dropdownWidth > window.innerWidth - 16) {
        left = Math.max(16, window.innerWidth - dropdownWidth - 16);
      }
      if (left < 16) left = 16;
    }

    const availableHeight = openUpwards ? spaceAbove - 20 : spaceBelow - 20;
    const maxHeight = Math.min(420, Math.max(220, availableHeight));

    return {
      top: openUpwards ? undefined : rect.bottom + 6,
      bottom: openUpwards ? window.innerHeight - rect.top + 6 : undefined,
      left,
      width: dropdownWidth,
      maxHeight,
      openUpwards,
      isMobile
    };
  }, []);

  const updateCoords = useCallback(() => {
    const nextCoords = calculateCoords();
    if (nextCoords) setCoords(nextCoords);
  }, [calculateCoords]);

  const handleToggle = () => {
    if (!open) {
      const nextCoords = calculateCoords();
      if (nextCoords) setCoords(nextCoords);
      setOpen(true);
      setHighlightedIndex(0);
      setTimeout(() => {
        if (searchInputRef.current) searchInputRef.current.focus();
      }, 50);
    } else {
      setOpen(false);
      setSearch('');
    }
  };

  useEffect(() => {
    if (open) {
      updateCoords();
      const onScrollOrResize = () => updateCoords();
      window.addEventListener('resize', onScrollOrResize);
      window.addEventListener('scroll', onScrollOrResize, true);
      return () => {
        window.removeEventListener('resize', onScrollOrResize);
        window.removeEventListener('scroll', onScrollOrResize, true);
      };
    }
  }, [open, updateCoords]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (
        buttonRef.current && !buttonRef.current.contains(e.target) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target)
      ) {
        setOpen(false);
        setSearch('');
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  // Keep highlighted item in view during arrow navigation
  useEffect(() => {
    if (listRef.current && filtered.length > 0 && listRef.current.children[highlightedIndex]) {
      const activeEl = listRef.current.children[highlightedIndex];
      if (activeEl && typeof activeEl.scrollIntoView === 'function') {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, filtered.length]);

  const handleSelectSupplier = (s) => {
    onChange(s);
    setOpen(false);
    setSearch('');
  };

  const isValueInter = value && isInterStateForSupplier ? isInterStateForSupplier(value) : false;

  return (
    <div className={`flex ${compact ? 'gap-1' : 'gap-1.5'} w-full items-center`}>
      <div className="relative flex-1 min-w-0">
        <button
          ref={buttonRef}
          type="button"
          onClick={handleToggle}
          className={`w-full ${compact ? 'px-2 h-7.5 rounded-lg text-[11px]' : 'px-2.5 h-8.5 rounded-xl text-xs'} border text-left flex items-center justify-between transition-all duration-150 shadow-2xs select-none ${
            open 
              ? 'bg-indigo-50/90 border-indigo-500 ring-2 ring-indigo-500/25 dark:bg-indigo-950/70 dark:border-indigo-500' 
              : value
              ? 'bg-gradient-to-r from-indigo-50/60 to-white dark:from-indigo-950/40 dark:to-slate-900 border-indigo-200 dark:border-indigo-800/80 hover:border-indigo-400'
              : 'bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 hover:border-indigo-400'
          }`}
        >
          <div className="flex items-center gap-1.5 truncate flex-1 min-w-0">
            <Building2 className={`w-3.5 h-3.5 shrink-0 ${value ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
            <span className={value ? 'text-slate-900 dark:text-white truncate font-bold text-xs' : 'text-slate-400 dark:text-slate-500 truncate text-[11px]'}>
              {value ? `${value.name}${value.phone ? ` (${value.phone})` : ''}` : placeholder}
            </span>
            {value && value.gstin && (
              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded shrink-0 hidden sm:inline-block ${
                isValueInter 
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300' 
                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
              }`}>
                {isValueInter ? 'IGST' : 'CGST+SGST'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-1">
            {value && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(null);
                }}
                className="p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                title="Clear selected supplier"
              >
                <X className="w-3 h-3" />
              </span>
            )}
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180 text-indigo-500' : ''}`} />
          </div>
        </button>

        {/* 🌟 ULTRA-STYLISH FLOATING PORTAL DROPDOWN (Mounts at Document Root with z-[9999999]) */}
        {open && coords && createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: 'fixed',
              top: coords.top !== undefined ? `${coords.top}px` : undefined,
              bottom: coords.bottom !== undefined ? `${coords.bottom}px` : undefined,
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              maxHeight: `${coords.maxHeight}px`,
              zIndex: 9999999
            }}
            className="bg-white/98 dark:bg-slate-900/98 backdrop-blur-xl border-2 border-indigo-500/90 dark:border-indigo-500/90 rounded-2xl shadow-[0_25px_70px_-10px_rgba(15,23,42,0.45),0_0_0_1px_rgba(99,102,241,0.25)] overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150 flex flex-col"
          >
            {/* Top Luxury Rainbow Gradient Accent */}
            <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 shrink-0" />

            {/* Header & Search Bar */}
            <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/90 space-y-2 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                    <Building2 className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-[11px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider block leading-tight">
                      Select Supplier / Vendor
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                      Auto-computes GST & tax classification
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 font-mono">
                    {filtered.length} {filtered.length === 1 ? 'vendor' : 'vendors'}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setOpen(false); setSearch(''); }}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                    title="Close"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-indigo-500" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={e => {
                    setSearch(e.target.value);
                    setHighlightedIndex(0);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setHighlightedIndex(prev => (prev + 1) % (filtered.length || 1));
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setHighlightedIndex(prev => (prev - 1 + (filtered.length || 1)) % (filtered.length || 1));
                    } else if (e.key === 'Enter') {
                      e.preventDefault();
                      if (filtered[highlightedIndex]) {
                        handleSelectSupplier(filtered[highlightedIndex]);
                      }
                    }
                  }}
                  placeholder="Search by vendor name, GSTIN, phone, state..."
                  className="w-full pl-8 pr-7 py-1.5 text-xs border border-indigo-200 dark:border-indigo-800 rounded-xl bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-slate-900 dark:text-white font-medium shadow-xs"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Keyboard navigation helper */}
              <div className="flex items-center justify-between text-[10px] text-slate-400 px-0.5">
                <span>Use <kbd className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono font-bold text-[9px]">↑</kbd> <kbd className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono font-bold text-[9px]">↓</kbd> to navigate, <kbd className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono font-bold text-[9px]">↵</kbd> to select</span>
                <span className="font-mono text-indigo-500 font-semibold">ESC to close</span>
              </div>
            </div>

            {/* Scrollable Supplier List */}
            <div ref={listRef} className="overflow-y-auto p-1.5 space-y-1 flex-1">
              {filtered.length === 0 ? (
                <div className="p-6 text-center text-slate-400 space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-400 flex items-center justify-center mx-auto">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    No suppliers found matching "{search}"
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Register this supplier instantly with 1-click.
                  </p>
                  {onAddNew && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setOpen(false);
                        onAddNew();
                      }}
                      className="mt-2 h-8 px-4 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl inline-flex items-center gap-1.5 shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add New Supplier
                    </Button>
                  )}
                </div>
              ) : (
                filtered.map((s, idx) => {
                  const isSelected = value?.id === s.id;
                  const isHighlighted = idx === highlightedIndex;
                  const isInter = isInterStateForSupplier ? isInterStateForSupplier(s) : false;
                  const initials = (s.name || 'S')
                    .split(' ')
                    .filter(Boolean)
                    .map(w => w[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase() || 'SP';

                  return (
                    <div
                      key={s.id || idx}
                      onClick={() => handleSelectSupplier(s)}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      className={`p-2.5 rounded-xl cursor-pointer transition-all flex items-center justify-between gap-3 border ${
                        isSelected
                          ? 'bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/80 dark:to-purple-950/80 border-indigo-400 dark:border-indigo-500 text-indigo-950 dark:text-indigo-100 shadow-sm ring-1 ring-indigo-500/30'
                          : isHighlighted
                          ? 'bg-indigo-50/60 dark:bg-slate-800/80 border-indigo-300 dark:border-indigo-700 text-slate-900 dark:text-white shadow-xs'
                          : 'border-transparent hover:border-indigo-200 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Avatar Initials Badge */}
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 shadow-xs ${
                          isSelected
                            ? 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-indigo-500/20'
                            : 'bg-gradient-to-br from-indigo-100 to-indigo-200 dark:from-indigo-950 dark:to-purple-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800/50'
                        }`}>
                          {initials}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs sm:text-[13px] text-slate-900 dark:text-white truncate">
                              {s.name}
                            </span>
                            {isSelected && (
                              <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                                <Check className="w-2.5 h-2.5 stroke-[3]" />
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap mt-1 text-[10px]">
                            {/* GSTIN badge */}
                            {s.gstin ? (
                              <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                GST: {s.gstin}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic text-[10px]">
                                No GSTIN
                              </span>
                            )}

                            {/* Tax Pill (Intrastate vs Interstate) */}
                            {s.gstin && (
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold flex items-center gap-1 border ${
                                isInter
                                  ? 'bg-amber-50 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                  : 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                              }`}>
                                {isInter ? (
                                  <>
                                    <Sparkles className="w-2.5 h-2.5" />
                                    Interstate (IGST)
                                  </>
                                ) : (
                                  <>
                                    <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" />
                                    Intrastate (CGST+SGST)
                                  </>
                                )}
                              </span>
                            )}

                            {/* Phone */}
                            {s.phone && (
                              <span className="text-slate-500 dark:text-slate-400 font-medium">
                                • {s.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* State badge */}
                      {s.state && (
                        <div className="shrink-0 text-right">
                          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 block">
                            {s.state}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer with Quick Add Button */}
            <div className="p-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/90 flex items-center justify-between text-[11px] shrink-0">
              {onAddNew ? (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onAddNew();
                  }}
                  className="px-3 py-1.5 rounded-xl text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 font-bold flex items-center gap-1.5 transition-colors border border-indigo-200/80 dark:border-indigo-800/80"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Quick Add New Supplier</span>
                </button>
              ) : <span />}

              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setSearch('');
                }}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>,
          document.body
        )}
      </div>

      {onAddNew && (
        <Button 
          type="button" 
          size="sm"
          onClick={onAddNew} 
          title="Quick Add New Supplier"
          className={`bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 shadow-xs ${compact ? 'px-1.5 h-7.5 rounded-lg' : 'px-2 h-8.5 rounded-xl'}`}
        >
          <Plus className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        </Button>
      )}
    </div>
  );
}

// ==========================================
// 🌟 DYNAMIC MULTI-CHOICE CATEGORY DROPDOWN COMPONENT WITH PORTAL
// ==========================================
function MultiSelectCategoryDropdown({ categories = [], selectedValues = [], onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);
  const [coords, setCoords] = useState(null);

  const calculateCoords = useCallback(() => {
    if (!buttonRef.current) return null;
    const rect = buttonRef.current.getBoundingClientRect();
    const dropdownWidth = Math.max(rect.width, 300);
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpwards = spaceBelow < 300 && rect.top > 300;

    let left = rect.left;
    if (left + dropdownWidth > window.innerWidth - 16) {
      left = Math.max(16, window.innerWidth - dropdownWidth - 16);
    }
    if (left < 16) left = 16;

    return {
      top: openUpwards ? undefined : rect.bottom + 6,
      bottom: openUpwards ? window.innerHeight - rect.top + 6 : undefined,
      left,
      width: dropdownWidth,
      openUpwards
    };
  }, []);

  const updateCoords = useCallback(() => {
    const nextCoords = calculateCoords();
    if (nextCoords) setCoords(nextCoords);
  }, [calculateCoords]);

  const handleToggle = () => {
    if (!isOpen) {
      const nextCoords = calculateCoords();
      if (nextCoords) setCoords(nextCoords);
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      const onScrollOrResize = () => updateCoords();
      window.addEventListener('resize', onScrollOrResize);
      window.addEventListener('scroll', onScrollOrResize, true);
      return () => {
        window.removeEventListener('resize', onScrollOrResize);
        window.removeEventListener('scroll', onScrollOrResize, true);
      };
    }
  }, [isOpen, updateCoords]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (
        buttonRef.current && !buttonRef.current.contains(e.target) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const q = searchQuery.toLowerCase();
    return categories.filter(c =>
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.code && c.code.toLowerCase().includes(q))
    );
  }, [categories, searchQuery]);

  const handleToggleCategory = (catName) => {
    if (selectedValues.includes(catName)) {
      onChange(selectedValues.filter(v => v !== catName));
    } else {
      onChange([...selectedValues, catName]);
    }
  };

  const handleSelectAll = () => {
    onChange(categories.map(c => c.name));
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const isAllSelected = categories.length > 0 && selectedValues.length === categories.length;
  const isNoneSelected = selectedValues.length === 0;

  return (
    <div className="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className={`flex items-center justify-between gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all h-8 cursor-pointer w-full sm:w-52 select-none ${
          selectedValues.length > 0
            ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500/20'
            : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
        }`}
      >
        <div className="flex items-center gap-1.5 truncate">
          <Filter className={`w-3.5 h-3.5 shrink-0 ${selectedValues.length > 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
          <span className="truncate text-[11px]">
            {isNoneSelected
              ? 'All Categories'
              : isAllSelected
              ? 'All Categories (All)'
              : `${selectedValues.length} Categor${selectedValues.length > 1 ? 'ies' : 'y'}`}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {selectedValues.length > 0 && (
            <span className="flex items-center justify-center w-4 h-4 text-[9px] font-black rounded-full bg-indigo-600 text-white">
              {selectedValues.length}
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-indigo-500' : ''}`} />
        </div>
      </button>

      {isOpen && coords && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: coords.top !== undefined ? `${coords.top}px` : undefined,
            bottom: coords.bottom !== undefined ? `${coords.bottom}px` : undefined,
            left: `${coords.left}px`,
            width: `${coords.width}px`,
            zIndex: 9999999
          }}
          className="bg-white dark:bg-slate-900 border-2 border-indigo-500/90 dark:border-indigo-500/90 rounded-2xl shadow-[0_25px_60px_-15px_rgba(15,23,42,0.4)] overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150 flex flex-col"
        >
          <div className="h-1 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 shrink-0" />

          <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
            <div className="relative">
              <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full pl-7 pr-2 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
              />
            </div>

            <div className="flex items-center justify-between mt-1.5 pt-0.5 text-[10px] font-bold">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer flex items-center gap-1"
              >
                <CheckSquare className="w-2.5 h-2.5" />
                Select All ({categories.length})
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="text-slate-400 hover:text-rose-500 hover:underline cursor-pointer flex items-center gap-1"
              >
                <X className="w-2.5 h-2.5" />
                Clear
              </button>
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto p-1 space-y-0.5">
            {filteredCategories.length === 0 ? (
              <div className="text-center py-4 text-xs text-slate-400 italic">
                No matching categories
              </div>
            ) : (
              filteredCategories.map((cat, idx) => {
                const isSelected = selectedValues.includes(cat.name);
                const colorMeta = PALETTE[idx % PALETTE.length];
                return (
                  <div
                    key={cat.id || cat.name}
                    onClick={() => handleToggleCategory(cat.name)}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-100 font-semibold'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-all ${
                        isSelected
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900'
                      }`}>
                        {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </div>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colorMeta.color }} />
                        <span className="text-[11px] font-medium">{cat.name}</span>
                        {cat.code && (
                          <span className="text-[9px] font-mono text-slate-400">({cat.code})</span>
                        )}
                        {cat.expenseWithSupplier && (
                          <span className="text-[8px] font-bold px-1 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            Supplier
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="p-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between text-[10px] text-slate-500 font-medium">
            <span><strong>{selectedValues.length}</strong> selected</span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-2.5 py-0.5 rounded bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ==========================================
// PER-EXPENSE CHARGES, PAYMENT & GST HELPERS
// ==========================================
function createDefaultChargesAndPayment() {
  return {
    discountAmount: '0',
    shippingAmount: '0',
    shippingGstApplicable: false,
    shippingGstRate: 18,
    packingAmount: '0',
    packingGstApplicable: false,
    packingGstRate: 18,
    loadingAmount: '0',
    loadingGstApplicable: false,
    loadingGstRate: 18,
    otherCharges: '0',
    otherChargesLabel: 'Other Charges',
    otherChargesGstApplicable: false,
    otherChargesGstRate: 18,
    remarks: '',
    paymentStatus: 'PAID',
    paidAmount: '0',
    paymentMode: 'CASH',
    paymentRef: '',
    paymentImage: null,
    paymentNotes: ''
  };
}

function getPaymentModeShortLabel(modeId) {
  const found = PAYMENT_MODES.find(m => m.id === modeId);
  if (!found) return modeId || 'Cash';
  if (modeId === 'BANK_TRANSFER') return 'Bank Transfer';
  if (modeId === 'UPI') return 'UPI';
  if (modeId === 'CHEQUE') return 'Cheque / DD';
  if (modeId === 'CARD') return 'Card';
  return found.label;
}

function getExpenseChargesBadges(exp) {
  if (!exp) return [];
  const items = [];
  const ship = Number(exp.shippingAmount || 0);
  const pack = Number(exp.packingAmount || 0);
  const load = Number(exp.loadingAmount || 0);
  const other = Number(exp.otherCharges || 0);
  const disc = Number(exp.discountAmount || 0);

  if (ship > 0) {
    items.push({
      key: 'ship',
      label: `Ship ₹${ship.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
      gst: exp.shippingGstApplicable ? `+${Number(exp.shippingGstRate ?? 18)}%` : null,
      tone: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
    });
  }
  if (pack > 0) {
    items.push({
      key: 'pack',
      label: `Pack ₹${pack.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
      gst: exp.packingGstApplicable ? `+${Number(exp.packingGstRate ?? 18)}%` : null,
      tone: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
    });
  }
  if (load > 0) {
    items.push({
      key: 'load',
      label: `Load ₹${load.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
      gst: exp.loadingGstApplicable ? `+${Number(exp.loadingGstRate ?? 18)}%` : null,
      tone: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
    });
  }
  if (other > 0) {
    items.push({
      key: 'other',
      label: `${exp.otherChargesLabel || 'Other'} ₹${other.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
      gst: exp.otherChargesGstApplicable ? `+${Number(exp.otherChargesGstRate ?? 18)}%` : null,
      tone: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
    });
  }
  if (disc > 0) {
    items.push({
      key: 'disc',
      label: `Disc -₹${disc.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
      gst: null,
      tone: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
    });
  }
  return items;
}

function computeExpenseFinancials(row = {}, idx = 0) {
  const taxable = Math.max(0, parseFloat(row.taxableAmount) || 0);
  const isSupplier = row.isSupplierExpense !== undefined
    ? Boolean(row.isSupplierExpense)
    : Boolean(row.supplierId || row.supplierName);
  const gstRate = isSupplier ? (parseFloat(row.gstPercentage) || 0) : 0;
  const itemGst = (taxable * gstRate) / 100;

  const shipping = Math.max(0, Number(row.shippingAmount) || 0);
  const packing = Math.max(0, Number(row.packingAmount) || 0);
  const loading = Math.max(0, Number(row.loadingAmount) || 0);
  const otherCharges = Math.max(0, Number(row.otherCharges) || 0);
  const discount = Math.max(0, Number(row.discountAmount) || 0);

  const parseRate = (val) => (val !== undefined && val !== null && val !== '' && Number.isFinite(Number(val)) ? Number(val) : 18);
  const shippingGstRate = parseRate(row.shippingGstRate);
  const packingGstRate = parseRate(row.packingGstRate);
  const loadingGstRate = parseRate(row.loadingGstRate);
  const otherChargesGstRate = parseRate(row.otherChargesGstRate);

  const shippingGst = row.shippingGstApplicable && shipping > 0 ? (shipping * shippingGstRate) / 100 : 0;
  const packingGst = row.packingGstApplicable && packing > 0 ? (packing * packingGstRate) / 100 : 0;
  const loadingGst = row.loadingGstApplicable && loading > 0 ? (loading * loadingGstRate) / 100 : 0;
  const otherGst = row.otherChargesGstApplicable && otherCharges > 0 ? (otherCharges * otherChargesGstRate) / 100 : 0;

  const totalExtraCharges = shipping + packing + loading + otherCharges;
  const totalChargesTaxes = shippingGst + packingGst + loadingGst + otherGst;
  const totalTaxes = itemGst + totalChargesTaxes;

  const isInterState = Boolean(row.isInterState);
  const cgstAmount = isInterState ? 0 : totalTaxes / 2;
  const sgstAmount = isInterState ? 0 : totalTaxes / 2;
  const igstAmount = isInterState ? totalTaxes : 0;

  const chargesList = [];
  if (shipping > 0) {
    chargesList.push({ label: 'Shipping / Freight', value: shipping, applied: true, gstApplicable: Boolean(row.shippingGstApplicable), rate: shippingGstRate });
  }
  if (packing > 0) {
    chargesList.push({ label: 'Packing Charges', value: packing, applied: true, gstApplicable: Boolean(row.packingGstApplicable), rate: packingGstRate });
  }
  if (loading > 0) {
    chargesList.push({ label: 'Loading & Unloading', value: loading, applied: true, gstApplicable: Boolean(row.loadingGstApplicable), rate: loadingGstRate });
  }
  if (otherCharges > 0) {
    chargesList.push({ label: row.otherChargesLabel || 'Other Charges', value: otherCharges, applied: true, gstApplicable: Boolean(row.otherChargesGstApplicable), rate: otherChargesGstRate });
  }

  const itemsForBreakdown = taxable > 0
    ? [{
        id: row.id || `exp_${idx}`,
        name: row.title?.trim() || `Expense #${idx + 1}`,
        subtotal: taxable,
        quantity: 1,
        unitPrice: taxable,
        gstApplicable: gstRate > 0,
        gstPercentage: gstRate
      }]
    : [];

  const gstBreakdown = calculateGstBreakdown({
    items: itemsForBreakdown,
    charges: chargesList,
    isInterState
  });

  const unroundedGrandTotal = Math.max(0, taxable + totalTaxes + totalExtraCharges - discount);
  const grandTotal = Math.round(unroundedGrandTotal);
  const roundOff = Number((grandTotal - unroundedGrandTotal).toFixed(2));

  const paymentStatus = row.paymentStatus || 'PAID';
  const rawPaid = row.paidAmount !== undefined && row.paidAmount !== null && row.paidAmount !== ''
    ? parseFloat(row.paidAmount)
    : (paymentStatus === 'PAID' ? grandTotal : 0);
  const paidAmountNum = paymentStatus === 'UNPAID'
    ? 0
    : (paymentStatus === 'PAID' ? grandTotal : (Number.isFinite(rawPaid) ? rawPaid : 0));
  const balanceDue = Math.max(0, grandTotal - paidAmountNum);

  return {
    taxable,
    isSupplier,
    gstRate,
    itemGst,
    shipping,
    shippingGst,
    shippingGstRate,
    packing,
    packingGst,
    packingGstRate,
    loading,
    loadingGst,
    loadingGstRate,
    otherCharges,
    otherChargesLabel: row.otherChargesLabel || 'Other Charges',
    otherGst,
    otherChargesGstRate,
    discount,
    totalExtraCharges,
    totalChargesTaxes,
    totalTaxes,
    isInterState,
    cgstAmount,
    sgstAmount,
    igstAmount,
    chargesList,
    itemsForBreakdown,
    gstBreakdown,
    unroundedGrandTotal,
    grandTotal,
    roundOff,
    paymentStatus,
    paymentMode: row.paymentMode || 'CASH',
    paidAmountNum,
    balanceDue
  };
}

// ==========================================
// SHARED CHARGES & FINANCIAL SUMMARY EDITOR
// ==========================================
function ExpenseChargesAndSummarySection({
  values,
  onChangeField,
  summary,
  entryCountLabel = '1 expense entry',
  showRemarks = true,
  compactLayout = false
}) {
  const chargeCards = [
    {
      key: 'shipping',
      label: 'Shipping (₹)',
      amountField: 'shippingAmount',
      gstField: 'shippingGstApplicable',
      rateField: 'shippingGstRate',
      gstAmount: summary.shippingGst
    },
    {
      key: 'packing',
      label: 'Packing (₹)',
      amountField: 'packingAmount',
      gstField: 'packingGstApplicable',
      rateField: 'packingGstRate',
      gstAmount: summary.packingGst
    },
    {
      key: 'loading',
      label: 'Loading (₹)',
      amountField: 'loadingAmount',
      gstField: 'loadingGstApplicable',
      rateField: 'loadingGstRate',
      gstAmount: summary.loadingGst
    }
  ];

  return (
    <div className={compactLayout ? 'space-y-2.5' : 'grid grid-cols-1 xl:grid-cols-12 gap-3.5 items-start'}>
      {/* Charges Inputs & Remarks */}
      <div className={compactLayout ? 'space-y-2.5' : 'xl:col-span-7 space-y-2.5'}>
        <div className={`grid ${compactLayout ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-3 gap-2' : 'grid-cols-2 sm:grid-cols-3 gap-2'}`}>
          {/* 1. Discount */}
          <div className="space-y-1 p-2 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
            <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">Discount (₹)</Label>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 select-none">₹</span>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={values.discountAmount ?? '0'}
                onChange={(e) => onChangeField('discountAmount', e.target.value)}
                className="h-7.5 text-xs pl-5 rounded-lg bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 hover:border-emerald-400 focus:border-emerald-600 font-semibold shadow-2xs"
              />
            </div>
          </div>

          {/* 2-4. Shipping / Packing / Loading Cards */}
          {chargeCards.map((card) => {
            const amountVal = values[card.amountField] ?? '0';
            const gstEnabled = Boolean(values[card.gstField]);
            const rateVal = values[card.rateField] ?? 18;
            return (
              <div key={card.key} className="space-y-1 p-2 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between gap-1">
                  <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap truncate">{card.label}</Label>
                  <label className="inline-flex items-center gap-1 cursor-pointer select-none shrink-0">
                    <input
                      type="checkbox"
                      checked={gstEnabled}
                      onChange={(e) => onChangeField(card.gstField, e.target.checked)}
                      className="w-3 h-3 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 cursor-pointer"
                    />
                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">GST</span>
                  </label>
                </div>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 select-none">₹</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amountVal}
                    onChange={(e) => onChangeField(card.amountField, e.target.value)}
                    className="h-7.5 text-xs pl-5 rounded-lg bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 hover:border-indigo-400 focus:border-indigo-600 font-semibold shadow-2xs"
                  />
                </div>
                {gstEnabled && (
                  <div className="flex items-center justify-between gap-1 pt-0.5">
                    <select
                      value={rateVal}
                      onChange={(e) => onChangeField(card.rateField, Number(e.target.value))}
                      className="h-5.5 text-[10px] px-1 rounded border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 font-bold focus:outline-none"
                    >
                      <option value={0}>0%</option>
                      <option value={5}>5%</option>
                      <option value={12}>12%</option>
                      <option value={18}>18%</option>
                      <option value={28}>28%</option>
                    </select>
                    {Number(amountVal) > 0 && (
                      <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                        +₹{card.gstAmount.toFixed(2)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* 5. Other Charges (with custom label) */}
          <div className={`space-y-1 p-2 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 ${compactLayout ? 'col-span-2 sm:col-span-1' : 'col-span-2 sm:col-span-1'}`}>
            <div className="flex items-center justify-between gap-1">
              <Input
                type="text"
                value={values.otherChargesLabel ?? 'Other Charges'}
                onChange={(e) => onChangeField('otherChargesLabel', e.target.value)}
                placeholder="Other Charges"
                className="h-4.5 px-0.5 py-0 text-[11px] font-bold text-slate-700 dark:text-slate-300 border-0 bg-transparent focus-visible:ring-0 min-w-0 flex-1"
                title="Edit charge title"
              />
              <label className="inline-flex items-center gap-1 cursor-pointer select-none shrink-0">
                <input
                  type="checkbox"
                  checked={Boolean(values.otherChargesGstApplicable)}
                  onChange={(e) => onChangeField('otherChargesGstApplicable', e.target.checked)}
                  className="w-3 h-3 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 cursor-pointer"
                />
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">GST</span>
              </label>
            </div>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 select-none">₹</span>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={values.otherCharges ?? '0'}
                onChange={(e) => onChangeField('otherCharges', e.target.value)}
                className="h-7.5 text-xs pl-5 rounded-lg bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 hover:border-indigo-400 focus:border-indigo-600 font-semibold shadow-2xs"
              />
            </div>
            {Boolean(values.otherChargesGstApplicable) && (
              <div className="flex items-center justify-between gap-1 pt-0.5">
                <select
                  value={values.otherChargesGstRate ?? 18}
                  onChange={(e) => onChangeField('otherChargesGstRate', Number(e.target.value))}
                  className="h-5.5 text-[10px] px-1 rounded border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 font-bold focus:outline-none"
                >
                  <option value={0}>0%</option>
                  <option value={5}>5%</option>
                  <option value={12}>12%</option>
                  <option value={18}>18%</option>
                  <option value={28}>28%</option>
                </select>
                {Number(values.otherCharges) > 0 && (
                  <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                    +₹{summary.otherGst.toFixed(2)}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Row Remarks */}
        {showRemarks && (
          <div className="space-y-1">
            <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <FileText className="w-3 h-3 text-slate-400" />
              Supplier Instructions & Remarks
            </Label>
            <textarea
              value={values.remarks ?? ''}
              onChange={(e) => onChangeField('remarks', e.target.value)}
              rows={compactLayout ? 1 : 2}
              className="w-full border rounded-xl px-2.5 py-1.5 text-xs bg-slate-50/70 dark:bg-slate-900/90 border-slate-300 dark:border-slate-700 hover:border-indigo-400 focus:outline-none focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500/20 resize-none shadow-2xs text-slate-800 dark:text-slate-200 font-medium"
              placeholder="Supplier instructions, delivery notes, payment terms, or reference numbers..."
            />
          </div>
        )}
      </div>

      {/* Live Financial Summary Box */}
      <div className={`${compactLayout ? 'p-3 rounded-xl space-y-1.5 text-[11px]' : 'xl:col-span-5 p-3.5 rounded-xl space-y-2 text-xs'} bg-gradient-to-br from-slate-50 via-indigo-50/35 to-slate-50 dark:from-slate-950/90 dark:via-indigo-950/30 dark:to-slate-950/90 border border-indigo-200/80 dark:border-indigo-900/60 shadow-2xs`}>
        <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
          <span>Taxable Base ({entryCountLabel})</span>
          <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
            ₹{summary.taxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
          <span>Item GST ({summary.gstRate}%)</span>
          <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
            ₹{summary.itemGst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        {!summary.isInterState ? (
          <div className="grid grid-cols-2 gap-2 pt-0.5 text-[11px]">
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400 bg-white/70 dark:bg-slate-900/60 px-2 py-1 rounded-lg border border-slate-200/60 dark:border-slate-800">
              <span className="inline-flex items-center gap-1">
                <span>CGST</span>
                <GstCalculationModal
                  items={summary.itemsForBreakdown}
                  charges={summary.chargesList}
                  isInterState={false}
                  breakdownData={summary.gstBreakdown}
                />
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                ₹{summary.cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400 bg-white/70 dark:bg-slate-900/60 px-2 py-1 rounded-lg border border-slate-200/60 dark:border-slate-800">
              <span>SGST</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                ₹{summary.sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <span>IGST (Interstate)</span>
              <GstCalculationModal
                items={summary.itemsForBreakdown}
                charges={summary.chargesList}
                isInterState={true}
                breakdownData={summary.gstBreakdown}
              />
            </span>
            <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
              ₹{summary.igstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        )}

        {summary.discount > 0 && (
          <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400 font-semibold">
            <span>Discount</span>
            <span className="font-mono">
              -₹{summary.discount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        )}

        {summary.totalExtraCharges > 0 && (
          <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
            <span>Extra Charges ({[
              summary.shipping > 0 ? 'Ship' : null,
              summary.packing > 0 ? 'Pack' : null,
              summary.loading > 0 ? 'Load' : null,
              summary.otherCharges > 0 ? (values.otherChargesLabel || 'Other') : null
            ].filter(Boolean).join(', ')})</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
              +₹{summary.totalExtraCharges.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        )}

        {summary.totalChargesTaxes > 0 && (
          <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
            <span>Charges Tax (GST)</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
              +₹{summary.totalChargesTaxes.toFixed(2)}
            </span>
          </div>
        )}

        {summary.roundOff !== 0 && (
          <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
            <span>Round Off</span>
            <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
              {summary.roundOff > 0 ? `+₹${summary.roundOff.toFixed(2)}` : `-₹${Math.abs(summary.roundOff).toFixed(2)}`}
            </span>
          </div>
        )}

        <div className="pt-2 border-t border-indigo-200 dark:border-indigo-800/80 flex justify-between items-baseline">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-400 block">
              EXPENSE GRAND TOTAL
            </span>
            <span className="text-[10px] text-slate-400 font-medium">Includes taxes, charges & discount</span>
          </div>
          <span className={`${compactLayout ? 'text-xl sm:text-2xl' : 'text-xl sm:text-2xl'} font-black font-mono text-indigo-600 dark:text-indigo-400`}>
            ₹{summary.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// CSV EXPORT UTILITY FUNCTION
// ==========================================
function downloadExpensesCSV(expensesList, filenamePrefix = 'expenses') {
  if (!expensesList || expensesList.length === 0) {
    showCustomToast('Export Notice', 'No expenses available to export.', 'info');
    return;
  }

  const headers = [
    'Expense No', 'Date', 'Expense Title', 'Category', 'Supplier', 'Supplier GSTIN', 'Invoice No',
    'Payment Mode', 'Payment Status', 'Paid Amount (INR)', 'Payment Ref',
    'Taxable (INR)', 'Discount (INR)', 'Shipping (INR)', 'Packing (INR)', 'Loading (INR)', 'Other Charges (INR)',
    'GST %', 'CGST', 'SGST', 'IGST', 'Total Amount (INR)', 'Recorded By', 'Attachments Count', 'Notes'
  ];
  const csvRows = [headers.join(',')];

  expensesList.forEach(item => {
    const attCount = Array.isArray(item.attachments) ? item.attachments.length : 0;
    const row = [
      `"${item.expenseNumber || ''}"`,
      `"${new Date(item.date).toISOString().split('T')[0]}"`,
      `"${(item.title || '').replace(/"/g, '""')}"`,
      `"${item.category || ''}"`,
      `"${(item.supplierName || '').replace(/"/g, '""')}"`,
      `"${item.supplierGstin || ''}"`,
      `"${item.invoiceNo || ''}"`,
      `"${getPaymentModeShortLabel(item.paymentMode || 'CASH')}"`,
      `"${item.paymentStatus || 'PAID'}"`,
      Number(item.paidAmount || 0).toFixed(2),
      `"${(item.paymentRef || '').replace(/"/g, '""')}"`,
      Number(item.taxableAmount || item.amount || 0).toFixed(2),
      Number(item.discountAmount || 0).toFixed(2),
      Number(item.shippingAmount || 0).toFixed(2),
      Number(item.packingAmount || 0).toFixed(2),
      Number(item.loadingAmount || 0).toFixed(2),
      Number(item.otherCharges || 0).toFixed(2),
      Number(item.gstPercentage || 0).toFixed(0),
      Number(item.cgstAmount || 0).toFixed(2),
      Number(item.sgstAmount || 0).toFixed(2),
      Number(item.igstAmount || 0).toFixed(2),
      Number(item.totalAmount || item.amount || 0).toFixed(2),
      `"${(item.user?.name || item.user?.email || 'N/A').replace(/"/g, '""')}"`,
      attCount,
      `"${(item.notes || '').replace(/"/g, '""')}"`
    ];
    csvRows.push(row.join(','));
  });

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const timestamp = new Date().toISOString().slice(0, 10);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filenamePrefix}_${timestamp}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ==========================================
// MAIN EXPENSES PAGE COMPONENT
// ==========================================
export default function ExpensesPage() {
  const queryClient = useQueryClient();

  // Company Store for GST & Interstate detection
  const storeCompany = useCompanyStore((s) => s.company);
  const fetchCompany = useCompanyStore((s) => s.fetchCompany);

  useEffect(() => {
    fetchCompany();
  }, [fetchCompany]);

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [datePreset, setDatePreset] = useState('ALL');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Sorting State
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Multi-Selection State
  const [selectedExpenseIds, setSelectedExpenseIds] = useState([]);

  // Modals State
  const [isMultiModalOpen, setIsMultiModalOpen] = useState(false);
  const [isMultiModalFullScreen, setIsMultiModalFullScreen] = useState(true);
  const [editingExpense, setEditingExpense] = useState(null);
  const [viewingExpense, setViewingExpense] = useState(null);
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [targetRowIdxForNewSupplier, setTargetRowIdxForNewSupplier] = useState(null);

  // Running Expense Number Query
  const { data: nextExpenseNumberData, refetch: refetchNextNumber } = useQuery({
    queryKey: ['expense-next-number'],
    queryFn: async () => {
      const res = await api.get('/finance/expenses/next-number');
      return res.data?.nextNumber || 'EXP-000001';
    }
  });
  const candidateExpenseNumber = nextExpenseNumberData || 'EXP-000001';

  // Fullscreen Attachment (Image / PDF) Preview State
  const [previewAttachmentUrl, setPreviewAttachmentUrl] = useState(null);
  const [previewAttachmentTitle, setPreviewAttachmentTitle] = useState('Expense Attachment');

  const handlePreviewAttachment = (file) => {
    if (!file) return;
    const url = file.url || file;
    const fullUrl = getFileUrl(url);
    const isPdf = (file.type && file.type.includes('pdf')) || (typeof url === 'string' && url.toLowerCase().endsWith('.pdf'));

    if (isPdf) {
      window.open(fullUrl, '_blank', 'noopener,noreferrer');
    } else {
      setPreviewAttachmentUrl(fullUrl);
      setPreviewAttachmentTitle(file.name || file.originalName || 'Attachment Preview');
    }
  };

  // Attachments State for Modals
  const [rowAttachmentModalIdx, setRowAttachmentModalIdx] = useState(null);
  const [editAttachments, setEditAttachments] = useState([]);
  const [viewingAttachmentsExpense, setViewingAttachmentsExpense] = useState(null);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);

  // Active Row Selection & Section Refs for Per-Expense Charges & Payment
  const [activeBatchRowIdx, setActiveBatchRowIdx] = useState(0);
  const chargesSectionRef = useRef(null);
  const paymentSectionRef = useRef(null);

  // Single Edit Modal Extra Charges & Payment State
  const [editChargesPayment, setEditChargesPayment] = useState(createDefaultChargesAndPayment);

  // 1. Fetch Dynamic Expense Master Categories
  const { data: masterCategories = [] } = useQuery({
    queryKey: ['expense-categories'],
    queryFn: async () => {
      const res = await api.get('/item-setup/expense-category');
      return Array.isArray(res.data) ? res.data : [];
    }
  });

  // Active categories for dropdowns
  const activeMasterCategories = useMemo(() => {
    const active = masterCategories.filter(c => (c.status || 'ACTIVE') === 'ACTIVE');
    return active.length > 0
      ? active
      : [{ id: 'EXP-DEF', name: 'General Expenses', code: 'EXP-GEN', status: 'ACTIVE', expenseWithSupplier: false, defaultGstRate: 0 }];
  }, [masterCategories]);

  // 2. Fetch Verified Active Suppliers
  const { data: suppliers = [], refetch: refetchSuppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const response = await api.get('/parties/suppliers');
      return Array.isArray(response.data) ? response.data : [];
    }
  });

  // Determine Interstate based on company GSTIN vs Supplier GSTIN
  const isInterStateForSupplier = useCallback((supplier) => {
    if (!supplier?.gstin) return false;
    const suppPrefix = supplier.gstin.trim().slice(0, 2);
    const compGstin = storeCompany?.companyGstin || '';
    const compPrefix = compGstin ? compGstin.trim().slice(0, 2) : '33'; // Default 33 = Tamil Nadu
    return suppPrefix !== compPrefix;
  }, [storeCompany]);

  // Helper to map category to color badge
  const getCategoryMeta = useCallback((catNameOrId) => {
    if (!catNameOrId) return { label: 'General', color: '#64748b', bg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700' };

    const found = masterCategories.find(c => c.id === catNameOrId || c.name === catNameOrId || c.code === catNameOrId);
    const name = found ? found.name : catNameOrId;

    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = (hash << 5) - hash + name.charCodeAt(i);
      hash |= 0;
    }
    const paletteIdx = Math.abs(hash) % PALETTE.length;
    return {
      label: name,
      code: found?.code,
      id: found?.id,
      expenseWithSupplier: Boolean(found?.expenseWithSupplier),
      defaultGstRate: found?.defaultGstRate,
      hsnSacCode: found?.hsnSacCode,
      ...PALETTE[paletteIdx]
    };
  }, [masterCategories]);

  // Batch Rows State
  const rowCounterRef = useRef(1);
  const getInitialBatchRow = useCallback((idOffset = 1) => {
    const defaultCat = activeMasterCategories[0] || null;
    const withSupplier = Boolean(defaultCat?.expenseWithSupplier);
    const defaultGst = defaultCat?.defaultGstRate != null ? Number(defaultCat.defaultGstRate) : (withSupplier ? 18 : 0);

    return {
      id: `row_${Date.now()}_${rowCounterRef.current++}_${idOffset}`,
      date: new Date().toISOString().split('T')[0],
      categoryId: defaultCat?.id || '',
      category: defaultCat?.name || 'Office Supplies',
      title: '',
      isSupplierExpense: withSupplier,
      selectedSupplier: null,
      supplierId: '',
      supplierName: '',
      supplierGstin: '',
      invoiceNo: '',
      invoiceDate: new Date().toISOString().split('T')[0],
      taxableAmount: '',
      gstPercentage: defaultGst,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      totalAmount: '',
      isInterState: false,
      hsnSacCode: defaultCat?.hsnSacCode || '',
      notes: '',
      attachments: [],
      ...createDefaultChargesAndPayment()
    };
  }, [activeMasterCategories]);

  const [batchRows, setBatchRows] = useState(() =>
    [1, 2, 3].map((num) => ({
      id: `row_${num}`,
      date: new Date().toISOString().split('T')[0],
      categoryId: '',
      category: 'Office Supplies',
      title: '',
      isSupplierExpense: false,
      selectedSupplier: null,
      supplierId: '',
      supplierName: '',
      supplierGstin: '',
      invoiceNo: '',
      invoiceDate: new Date().toISOString().split('T')[0],
      taxableAmount: '',
      gstPercentage: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      totalAmount: '',
      isInterState: false,
      hsnSacCode: '',
      notes: '',
      attachments: [],
      ...createDefaultChargesAndPayment()
    }))
  );

  // React Hook Form for Single Edit Record
  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    reset: resetEdit,
    control: controlEdit,
    setValue: setValueEdit,
    watch: watchEdit,
    formState: { errors: editErrors }
  } = useForm({
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      categoryId: '',
      category: '',
      title: '',
      isSupplierExpense: false,
      supplierId: '',
      supplierName: '',
      supplierGstin: '',
      invoiceNo: '',
      invoiceDate: '',
      taxableAmount: '',
      gstPercentage: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      totalAmount: '',
      isInterState: false,
      hsnSacCode: '',
      notes: ''
    }
  });

  const editIsSupplierExpense = watchEdit('isSupplierExpense');
  const editSupplierId = watchEdit('supplierId');
  const editTaxableAmount = watchEdit('taxableAmount');
  const editGstPercentage = watchEdit('gstPercentage');
  const editIsInterState = watchEdit('isInterState');
  const editTitle = watchEdit('title');

  // Calculate Start & End Date based on Preset
  const { computedStartDate, computedEndDate } = useMemo(() => {
    const now = new Date();
    let start = '';
    let end = '';

    if (datePreset === 'TODAY') {
      const todayStr = now.toISOString().split('T')[0];
      start = todayStr;
      end = todayStr;
    } else if (datePreset === 'THIS_WEEK') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now.setDate(diff));
      start = monday.toISOString().split('T')[0];
      end = new Date().toISOString().split('T')[0];
    } else if (datePreset === 'THIS_MONTH') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      start = firstDay.toISOString().split('T')[0];
      end = new Date().toISOString().split('T')[0];
    } else if (datePreset === 'THIS_QUARTER') {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const startQuarter = new Date(now.getFullYear(), currentQuarter * 3, 1);
      start = startQuarter.toISOString().split('T')[0];
      end = new Date().toISOString().split('T')[0];
    } else if (datePreset === 'CUSTOM') {
      start = customStartDate;
      end = customEndDate;
    }

    return { computedStartDate: start, computedEndDate: end };
  }, [datePreset, customStartDate, customEndDate]);

  // Query: Expenses List
  const { data: expenses = [], isLoading: isListLoading, refetch: refetchExpenses, isFetching } = useQuery({
    queryKey: ['expenses', searchTerm, selectedCategories, computedStartDate, computedEndDate],
    queryFn: async () => {
      const params = {};
      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (selectedCategories.length > 0) params.categories = selectedCategories.join(',');
      if (computedStartDate) params.startDate = computedStartDate;
      if (computedEndDate) params.endDate = computedEndDate;

      const response = await api.get('/finance/expenses', { params });
      return response.data || [];
    }
  });

  // Query: Expenses Summary Stats
  const { data: summary, isLoading: isSummaryLoading, refetch: refetchSummary } = useQuery({
    queryKey: ['expenses-summary'],
    queryFn: async () => {
      const response = await api.get('/finance/expenses/summary');
      return response.data || { total: 0, monthly: 0, categoryBreakdown: [], recent: [] };
    }
  });

  // Mutations
  const bulkCreateMutation = useMutation({
    mutationFn: async (expensesList) => {
      const response = await api.post('/finance/expenses/bulk', { expenses: expensesList });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expenses-summary'] });
      queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
      queryClient.invalidateQueries({ queryKey: ['expense-next-number'] });
      showCustomToast(
        'Expenses Saved!',
        `Successfully recorded ${data.count || data.expenses?.length || 1} expense(s).`,
        'success'
      );
      handleCloseMultiModal();
    },
    onError: (err) => {
      showCustomToast('Save Failed', err.response?.data?.error || err.message || 'Failed to save expenses.', 'error');
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await api.put(`/finance/expenses/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expenses-summary'] });
      queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
      queryClient.invalidateQueries({ queryKey: ['expense-next-number'] });
      showCustomToast('Expense Updated!', 'The expense entry has been updated.', 'success');
      setEditingExpense(null);
    },
    onError: (err) => {
      showCustomToast('Update Failed', err.response?.data?.error || err.message || 'Failed to update expense.', 'error');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await api.delete(`/finance/expenses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expenses-summary'] });
      queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
      showCustomToast('Expense Deleted!', 'Expense record permanently removed from server storage.', 'success');
      setSelectedExpenseIds(prev => prev.filter(item => item !== deleteMutation.variables));
    },
    onError: (err) => {
      showCustomToast('Delete Failed', err.response?.data?.error || err.message || 'Failed to delete expense.', 'error');
    }
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids) => {
      const response = await api.post('/finance/expenses/bulk-delete', { ids });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expenses-summary'] });
      queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
      showCustomToast('Bulk Delete Complete', `${data.count} expenses removed successfully.`, 'success');
      setSelectedExpenseIds([]);
    },
    onError: (err) => {
      showCustomToast('Bulk Delete Failed', err.response?.data?.error || err.message || 'Failed to delete selected expenses.', 'error');
    }
  });

  // Handlers for Multi-Entry Grid (Per-Expense Charges, Summary & Payment)
  const handleOpenMultiModal = () => {
    refetchNextNumber();
    setBatchRows([
      getInitialBatchRow(1),
      getInitialBatchRow(2),
      getInitialBatchRow(3)
    ]);
    setActiveBatchRowIdx(0);
    setIsMultiModalOpen(true);
  };

  const handleCloseMultiModal = () => {
    setIsMultiModalOpen(false);
  };

  const handleAddBatchRow = () => {
    setBatchRows(prev => {
      const next = [...prev, getInitialBatchRow(prev.length + 1)];
      setActiveBatchRowIdx(next.length - 1);
      return next;
    });
  };

  const handleAddMultipleBatchRows = (count = 3) => {
    setBatchRows(prev => {
      const newItems = [];
      for (let i = 1; i <= count; i++) {
        newItems.push(getInitialBatchRow(prev.length + i));
      }
      return [...prev, ...newItems];
    });
  };

  const handleDuplicateBatchRow = (idx) => {
    setBatchRows(prev => {
      const target = prev[idx];
      const duplicated = {
        ...target,
        id: `row_${Date.now()}_${Math.random()}`,
        attachments: [...(target.attachments || [])]
      };
      const copy = [...prev];
      copy.splice(idx + 1, 0, duplicated);
      return copy;
    });
    setActiveBatchRowIdx(idx + 1);
  };

  const handleRemoveBatchRow = (idx) => {
    setBatchRows(prev => {
      if (prev.length <= 1) {
        setActiveBatchRowIdx(0);
        return [getInitialBatchRow(1)];
      }
      const next = prev.filter((_, i) => i !== idx);
      setActiveBatchRowIdx(curr => {
        if (curr > idx) return curr - 1;
        return Math.min(curr, next.length - 1);
      });
      return next;
    });
  };

  // Update a field in a specific batch row with automatic per-row financial & tax recalculation
  const handleUpdateBatchRow = useCallback((idx, field, value) => {
    setBatchRows(prev => {
      if (!prev[idx]) return prev;
      const copy = [...prev];
      const target = { ...copy[idx] };

      if (field === 'categorySelect') {
        const selectedMaster = activeMasterCategories.find(c => c.id === value || c.name === value);
        target.categoryId = selectedMaster ? selectedMaster.id : '';
        target.category = selectedMaster ? selectedMaster.name : value;

        if (selectedMaster?.expenseWithSupplier) {
          target.isSupplierExpense = true;
          if (selectedMaster.defaultGstRate != null) {
            target.gstPercentage = Number(selectedMaster.defaultGstRate);
          }
          if (selectedMaster.hsnSacCode) {
            target.hsnSacCode = selectedMaster.hsnSacCode;
          }
        }
      } else if (field === 'supplierSelect') {
        target.selectedSupplier = value;
        target.supplierId = value?.id || '';
        target.supplierName = value?.name || '';
        target.supplierGstin = value?.gstin || '';
        target.isInterState = isInterStateForSupplier(value);
      } else {
        target[field] = value;
      }

      const fin = computeExpenseFinancials(target, idx);
      target.cgstAmount = fin.cgstAmount;
      target.sgstAmount = fin.sgstAmount;
      target.igstAmount = fin.igstAmount;
      target.totalAmount = fin.grandTotal;

      const isPaymentOnlyField =
        field === 'paymentStatus' ||
        field === 'paidAmount' ||
        field === 'paymentMode' ||
        field === 'paymentRef' ||
        field === 'paymentImage' ||
        field === 'paymentNotes';

      // Keep paidAmount synced automatically when financial inputs change on a PAID row
      if (!isPaymentOnlyField && (target.paymentStatus || 'PAID') === 'PAID') {
        target.paidAmount = String(fin.grandTotal);
      }

      copy[idx] = target;
      return copy;
    });
  }, [activeMasterCategories, isInterStateForSupplier]);

  const safeActiveRowIdx = Math.min(activeBatchRowIdx, Math.max(0, batchRows.length - 1));
  const activeBatchRow = batchRows[safeActiveRowIdx] || batchRows[0];

  const handleUpdateActiveRowField = useCallback((field, value) => {
    handleUpdateBatchRow(safeActiveRowIdx, field, value);
  }, [safeActiveRowIdx, handleUpdateBatchRow]);

  const handleFocusRowSection = (idx, section = 'charges') => {
    setActiveBatchRowIdx(idx);
    const ref = section === 'payment' ? paymentSectionRef : chargesSectionRef;
    requestAnimationFrame(() => {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  };

  const handleCopyChargesToAllRows = () => {
    const src = batchRows[safeActiveRowIdx];
    if (!src) return;
    setBatchRows(prev =>
      prev.map((r, i) => {
        const merged = {
          ...r,
          discountAmount: src.discountAmount,
          shippingAmount: src.shippingAmount,
          shippingGstApplicable: src.shippingGstApplicable,
          shippingGstRate: src.shippingGstRate,
          packingAmount: src.packingAmount,
          packingGstApplicable: src.packingGstApplicable,
          packingGstRate: src.packingGstRate,
          loadingAmount: src.loadingAmount,
          loadingGstApplicable: src.loadingGstApplicable,
          loadingGstRate: src.loadingGstRate,
          otherCharges: src.otherCharges,
          otherChargesLabel: src.otherChargesLabel,
          otherChargesGstApplicable: src.otherChargesGstApplicable,
          otherChargesGstRate: src.otherChargesGstRate,
          remarks: src.remarks
        };
        const fin = computeExpenseFinancials(merged, i);
        return {
          ...merged,
          cgstAmount: fin.cgstAmount,
          sgstAmount: fin.sgstAmount,
          igstAmount: fin.igstAmount,
          totalAmount: fin.grandTotal,
          paidAmount: (merged.paymentStatus || 'PAID') === 'PAID' ? String(fin.grandTotal) : merged.paidAmount
        };
      })
    );
    showCustomToast('Charges Copied', `Copied Row #${safeActiveRowIdx + 1} charges to all ${batchRows.length} rows.`, 'success');
  };

  const handleCopyPaymentToAllRows = () => {
    const src = batchRows[safeActiveRowIdx];
    if (!src) return;
    setBatchRows(prev =>
      prev.map((r, i) => {
        const fin = computeExpenseFinancials(r, i);
        const status = src.paymentStatus || 'PAID';
        const nextPaid = status === 'PAID'
          ? String(fin.grandTotal)
          : status === 'UNPAID'
          ? '0'
          : src.paidAmount;
        return {
          ...r,
          paymentMode: src.paymentMode,
          paymentStatus: status,
          paidAmount: nextPaid,
          paymentRef: src.paymentRef,
          paymentImage: src.paymentImage,
          paymentNotes: src.paymentNotes
        };
      })
    );
    showCustomToast('Payment Mode Copied', `Applied Row #${safeActiveRowIdx + 1} payment details to all ${batchRows.length} rows.`, 'success');
  };

  // Per-row & Aggregate Summaries
  const rowSummaries = useMemo(
    () => batchRows.map((row, i) => computeExpenseFinancials(row, i)),
    [batchRows]
  );

  const activeRowSummary = rowSummaries[safeActiveRowIdx] || computeExpenseFinancials(activeBatchRow, safeActiveRowIdx);

  const batchSummary = useMemo(() => {
    let validCount = 0;
    let grandTotal = 0;
    let totalPaid = 0;
    let totalDue = 0;

    batchRows.forEach((row, i) => {
      const taxable = parseFloat(row.taxableAmount) || 0;
      const isTitleFilled = row.title && row.title.trim().length > 0;
      const isCatValid = Boolean(row.category || row.categoryId);
      if (taxable > 0 && isTitleFilled && isCatValid) {
        validCount++;
        const fin = rowSummaries[i] || computeExpenseFinancials(row, i);
        grandTotal += fin.grandTotal;
        totalPaid += fin.paidAmountNum;
        totalDue += fin.balanceDue;
      }
    });

    return { validCount, grandTotal, totalPaid, totalDue };
  }, [batchRows, rowSummaries]);

  // Save Batch Expenses to Database (Each row keeps its own Charges, Financial Summary & Payment Details)
  const handleSaveBatchExpenses = () => {
    const validRows = batchRows.filter(row => {
      const isTitleFilled = row.title && row.title.trim().length > 0;
      const numTaxable = parseFloat(row.taxableAmount);
      return isTitleFilled && !isNaN(numTaxable) && numTaxable > 0 && Boolean(row.date);
    });

    if (validRows.length === 0) {
      showCustomToast('Validation Warning', 'Please fill in required fields (Date, Category, Title, Taxable Amount > 0).', 'error');
      return;
    }

    const payload = validRows.map((row, i) => {
      const fin = computeExpenseFinancials(row, i);
      const combinedNotes = [row.notes, row.remarks]
        .map(s => (typeof s === 'string' ? s.trim() : ''))
        .filter(Boolean)
        .join(' | ') || null;

      return {
        date: row.date,
        categoryId: row.categoryId || undefined,
        category: row.category,
        title: row.title.trim(),
        amount: fin.grandTotal,
        taxableAmount: fin.taxable,
        isSupplierExpense: Boolean(row.isSupplierExpense),
        supplierId: row.supplierId || row.selectedSupplier?.id || null,
        supplierName: row.supplierName || row.selectedSupplier?.name || null,
        supplierGstin: row.supplierGstin || row.selectedSupplier?.gstin || null,
        invoiceNo: row.invoiceNo ? row.invoiceNo.trim() : null,
        invoiceDate: row.invoiceDate ? row.invoiceDate : null,
        gstPercentage: fin.gstRate,
        cgstAmount: fin.cgstAmount,
        sgstAmount: fin.sgstAmount,
        igstAmount: fin.igstAmount,
        totalAmount: fin.grandTotal,
        isInterState: fin.isInterState,
        hsnSacCode: row.hsnSacCode ? row.hsnSacCode.trim() : null,
        notes: combinedNotes,
        attachments: row.attachments && row.attachments.length > 0 ? row.attachments : undefined,
        // Per-Row Payment & Settlement Details
        paymentMode: fin.paymentMode,
        paymentStatus: fin.paymentStatus,
        paidAmount: fin.paidAmountNum,
        paymentRef: row.paymentRef ? String(row.paymentRef).trim() : null,
        paymentImage: row.paymentImage || null,
        paymentNotes: row.paymentNotes ? String(row.paymentNotes).trim() : null,
        // Per-Row Individual Charges & Tax Rates
        shippingAmount: fin.shipping,
        shippingGstApplicable: Boolean(row.shippingGstApplicable),
        shippingGstRate: fin.shippingGstRate,
        packingAmount: fin.packing,
        packingGstApplicable: Boolean(row.packingGstApplicable),
        packingGstRate: fin.packingGstRate,
        loadingAmount: fin.loading,
        loadingGstApplicable: Boolean(row.loadingGstApplicable),
        loadingGstRate: fin.loadingGstRate,
        otherCharges: fin.otherCharges,
        otherChargesLabel: row.otherChargesLabel ? String(row.otherChargesLabel).trim() : null,
        otherChargesGstApplicable: Boolean(row.otherChargesGstApplicable),
        otherChargesGstRate: fin.otherChargesGstRate,
        discountAmount: fin.discount,
        roundOff: fin.roundOff
      };
    });

    bulkCreateMutation.mutate(payload);
  };

  // Upload Attachments for Row
  const handleUploadRowAttachments = async (e, rowIdx) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsUploadingAttachments(true);
    try {
      const formData = new FormData();
      files.forEach(f => formData.append('files', f));

      const res = await api.post('/finance/expenses/upload-attachments', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data?.success && res.data?.files) {
        setBatchRows(prev => {
          const copy = [...prev];
          const row = { ...copy[rowIdx] };
          row.attachments = [...(row.attachments || []), ...res.data.files];
          copy[rowIdx] = row;
          return copy;
        });
        showCustomToast('File Uploaded', `${res.data.files.length} attachment(s) uploaded successfully.`, 'success');
      }
    } catch (err) {
      showCustomToast('Upload Failed', err.response?.data?.error || 'Failed to upload attachments.', 'error');
    } finally {
      setIsUploadingAttachments(false);
      if (e.target) e.target.value = '';
    }
  };

  // Remove Attachment from Row
  const handleRemoveRowAttachment = async (rowIdx, fileObj) => {
    try {
      if (fileObj.url) {
        await api.delete('/finance/expenses/attachments', { data: { url: fileObj.url, fileId: fileObj.id } });
      }
      setBatchRows(prev => {
        const copy = [...prev];
        const row = { ...copy[rowIdx] };
        row.attachments = (row.attachments || []).filter(it => it.id !== fileObj.id && it.url !== fileObj.url);
        copy[rowIdx] = row;
        return copy;
      });
      showCustomToast('Attachment Removed', 'File deleted from server storage.', 'success');
    } catch (err) {
      console.warn('Failed to delete attachment from server:', err);
    }
  };

  // Live Financial Summary for Single Edit Record
  const editFinancialSummary = useMemo(
    () =>
      computeExpenseFinancials({
        id: editingExpense?.id || 'edit',
        title: editTitle || editingExpense?.title || '',
        isSupplierExpense: editIsSupplierExpense,
        isInterState: editIsInterState,
        taxableAmount: editTaxableAmount,
        gstPercentage: editGstPercentage,
        ...editChargesPayment
      }),
    [
      editingExpense?.id,
      editingExpense?.title,
      editTitle,
      editIsSupplierExpense,
      editIsInterState,
      editTaxableAmount,
      editGstPercentage,
      editChargesPayment
    ]
  );

  const handleUpdateEditExtraField = useCallback((field, value) => {
    setEditChargesPayment(prev => ({ ...prev, [field]: value }));
  }, []);

  // Open Edit Modal for Single Record
  const handleOpenEditModal = (expense) => {
    setEditingExpense(expense);
    setEditAttachments(Array.isArray(expense.attachments) ? [...expense.attachments] : []);

    const isSupplier = Boolean(expense.isSupplierExpense || expense.supplierId || expense.supplierName);
    const taxable = expense.taxableAmount != null ? Number(expense.taxableAmount) : Number(expense.amount);
    const gstRate = expense.gstPercentage != null ? Number(expense.gstPercentage) : 0;

    resetEdit({
      expenseNumber: expense.expenseNumber || '',
      date: new Date(expense.date).toISOString().split('T')[0],
      categoryId: expense.categoryId || activeMasterCategories.find(c => c.name === expense.category)?.id || '',
      category: expense.category,
      title: expense.title,
      isSupplierExpense: isSupplier,
      supplierId: expense.supplierId || '',
      supplierName: expense.supplierName || '',
      supplierGstin: expense.supplierGstin || '',
      invoiceNo: expense.invoiceNo || '',
      invoiceDate: expense.invoiceDate ? new Date(expense.invoiceDate).toISOString().split('T')[0] : '',
      taxableAmount: taxable,
      gstPercentage: gstRate,
      cgstAmount: expense.cgstAmount || 0,
      sgstAmount: expense.sgstAmount || 0,
      igstAmount: expense.igstAmount || 0,
      totalAmount: expense.totalAmount || expense.amount,
      isInterState: Boolean(expense.isInterState),
      hsnSacCode: expense.hsnSacCode || '',
      notes: expense.notes || ''
    });

    setEditChargesPayment({
      discountAmount: expense.discountAmount != null ? String(Number(expense.discountAmount)) : '0',
      shippingAmount: expense.shippingAmount != null ? String(Number(expense.shippingAmount)) : '0',
      shippingGstApplicable: Boolean(expense.shippingGstApplicable),
      shippingGstRate: expense.shippingGstRate != null ? Number(expense.shippingGstRate) : 18,
      packingAmount: expense.packingAmount != null ? String(Number(expense.packingAmount)) : '0',
      packingGstApplicable: Boolean(expense.packingGstApplicable),
      packingGstRate: expense.packingGstRate != null ? Number(expense.packingGstRate) : 18,
      loadingAmount: expense.loadingAmount != null ? String(Number(expense.loadingAmount)) : '0',
      loadingGstApplicable: Boolean(expense.loadingGstApplicable),
      loadingGstRate: expense.loadingGstRate != null ? Number(expense.loadingGstRate) : 18,
      otherCharges: expense.otherCharges != null ? String(Number(expense.otherCharges)) : '0',
      otherChargesLabel: expense.otherChargesLabel || 'Other Charges',
      otherChargesGstApplicable: Boolean(expense.otherChargesGstApplicable),
      otherChargesGstRate: expense.otherChargesGstRate != null ? Number(expense.otherChargesGstRate) : 18,
      remarks: '',
      paymentMode: expense.paymentMode || 'CASH',
      paymentStatus: expense.paymentStatus || 'PAID',
      paidAmount: expense.paidAmount != null
        ? String(Number(expense.paidAmount))
        : String(Number(expense.totalAmount || expense.amount || 0)),
      paymentRef: expense.paymentRef || '',
      paymentImage: expense.paymentImage || null,
      paymentNotes: expense.paymentNotes || ''
    });
  };

  // Upload Attachments inside Single Edit Modal
  const handleUploadEditAttachments = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setIsUploadingAttachments(true);
    try {
      const formData = new FormData();
      files.forEach(f => formData.append('files', f));
      if (editingExpense?.id) {
        formData.append('expenseId', editingExpense.id);
      }

      const res = await api.post('/finance/expenses/upload-attachments', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data?.success && res.data?.files) {
        setEditAttachments(prev => [...prev, ...res.data.files]);
        showCustomToast('Files Uploaded', `${res.data.files.length} attachment(s) uploaded.`, 'success');
      }
    } catch (err) {
      showCustomToast('Upload Failed', err.response?.data?.error || 'Failed to upload attachments.', 'error');
    } finally {
      setIsUploadingAttachments(false);
      if (e.target) e.target.value = '';
    }
  };

  // Remove Attachment inside Single Edit Modal
  const handleRemoveEditAttachment = async (fileObj) => {
    try {
      await api.delete('/finance/expenses/attachments', {
        data: {
          expenseId: editingExpense?.id,
          url: fileObj.url,
          fileId: fileObj.id
        }
      });
      setEditAttachments(prev => prev.filter(it => it.id !== fileObj.id && it.url !== fileObj.url));
      showCustomToast('Attachment Removed', 'File deleted from server storage.', 'success');
    } catch (err) {
      console.warn('Failed to delete attachment:', err);
    }
  };

  // Submit Edit Form (including Per-Expense Charges & Payment Details)
  const onEditSubmit = (data) => {
    if (editingExpense) {
      const selectedCat = activeMasterCategories.find(c => c.id === data.categoryId || c.name === data.category);
      const fin = computeExpenseFinancials({
        ...data,
        ...editChargesPayment
      });

      updateMutation.mutate({
        id: editingExpense.id,
        data: {
          expenseNumber: data.expenseNumber || undefined,
          date: data.date,
          category: selectedCat ? selectedCat.name : data.category,
          categoryId: selectedCat ? selectedCat.id : data.categoryId,
          title: data.title,
          amount: fin.grandTotal,
          taxableAmount: fin.taxable,
          isSupplierExpense: Boolean(data.isSupplierExpense),
          supplierId: data.supplierId || null,
          supplierName: data.supplierName || null,
          supplierGstin: data.supplierGstin || null,
          invoiceNo: data.invoiceNo || null,
          invoiceDate: data.invoiceDate || null,
          gstPercentage: fin.gstRate,
          cgstAmount: fin.cgstAmount,
          sgstAmount: fin.sgstAmount,
          igstAmount: fin.igstAmount,
          totalAmount: fin.grandTotal,
          isInterState: fin.isInterState,
          hsnSacCode: data.hsnSacCode || null,
          notes: data.notes || null,
          attachments: editAttachments,
          // Payment fields
          paymentMode: fin.paymentMode,
          paymentStatus: fin.paymentStatus,
          paidAmount: fin.paidAmountNum,
          paymentRef: editChargesPayment.paymentRef ? String(editChargesPayment.paymentRef).trim() : null,
          paymentImage: editChargesPayment.paymentImage || null,
          paymentNotes: editChargesPayment.paymentNotes ? String(editChargesPayment.paymentNotes).trim() : null,
          // Charges breakdown fields
          shippingAmount: fin.shipping,
          shippingGstApplicable: Boolean(editChargesPayment.shippingGstApplicable),
          shippingGstRate: fin.shippingGstRate,
          packingAmount: fin.packing,
          packingGstApplicable: Boolean(editChargesPayment.packingGstApplicable),
          packingGstRate: fin.packingGstRate,
          loadingAmount: fin.loading,
          loadingGstApplicable: Boolean(editChargesPayment.loadingGstApplicable),
          loadingGstRate: fin.loadingGstRate,
          otherCharges: fin.otherCharges,
          otherChargesLabel: editChargesPayment.otherChargesLabel ? String(editChargesPayment.otherChargesLabel).trim() : null,
          otherChargesGstApplicable: Boolean(editChargesPayment.otherChargesGstApplicable),
          otherChargesGstRate: fin.otherChargesGstRate,
          discountAmount: fin.discount,
          roundOff: fin.roundOff
        }
      });
    }
  };

  // Delete Single Expense
  const handleDeleteSingle = (id, title) => {
    const isDark = document.documentElement.classList.contains('dark');
    Swal.fire({
      title: `<span class="text-sm font-bold text-slate-900 dark:text-white">Delete Expense Record?</span>`,
      html: `<div class="text-xs text-slate-600 dark:text-slate-400 mt-1">Delete "${title}"? All associated files in server storage will be permanently wiped.</div>`,
      icon: 'warning',
      iconColor: '#ef4444',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, Delete',
      cancelButtonText: 'Cancel',
      reverseButtons: true,
      background: isDark ? '#0f172a' : '#ffffff',
      color: isDark ? '#f8fafc' : '#0f172a',
      customClass: {
        popup: 'rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        deleteMutation.mutate(id);
      }
    });
  };

  // Bulk Delete
  const handleBulkDelete = () => {
    if (selectedExpenseIds.length === 0) return;
    const isDark = document.documentElement.classList.contains('dark');
    Swal.fire({
      title: `<span class="text-sm font-bold text-slate-900 dark:text-white">Delete ${selectedExpenseIds.length} Expenses?</span>`,
      text: 'All selected expenses and their uploaded receipts/attachments will be permanently removed.',
      icon: 'warning',
      iconColor: '#ef4444',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: `Yes, Delete All (${selectedExpenseIds.length})`,
      cancelButtonText: 'Cancel',
      reverseButtons: true,
      background: isDark ? '#0f172a' : '#ffffff',
      color: isDark ? '#f8fafc' : '#0f172a',
      customClass: {
        popup: 'rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        bulkDeleteMutation.mutate(selectedExpenseIds);
      }
    });
  };

  // Toggle selection
  const handleToggleSelectRow = (id) => {
    setSelectedExpenseIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedExpenseIds.length === expenses.length && expenses.length > 0) {
      setSelectedExpenseIds([]);
    } else {
      setSelectedExpenseIds(expenses.map(exp => exp.id));
    }
  };

  // Sorting
  const sortedExpenses = useMemo(() => {
    const list = [...expenses];
    list.sort((a, b) => {
      let valA = a[sortBy];
      let valB = b[sortBy];

      if (sortBy === 'date') {
        valA = new Date(valA).getTime();
        valB = new Date(valB).getTime();
      } else if (sortBy === 'amount') {
        valA = parseFloat(valA) || 0;
        valB = parseFloat(valB) || 0;
      } else if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = (valB || '').toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [expenses, sortBy, sortOrder]);

  const handleSortToggle = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  // Pagination Slice
  const totalPages = Math.ceil(sortedExpenses.length / itemsPerPage) || 1;
  const paginatedExpenses = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedExpenses.slice(start, start + itemsPerPage);
  }, [sortedExpenses, currentPage, itemsPerPage]);

  // Chart Data
  const chartData = useMemo(() => {
    if (!summary?.categoryBreakdown || summary.categoryBreakdown.length === 0) {
      return [];
    }
    return summary.categoryBreakdown.map((item) => {
      const meta = getCategoryMeta(item.category);
      return {
        name: meta.label,
        value: item.amount,
        color: meta.color
      };
    });
  }, [summary, getCategoryMeta]);

  return (
    <div className="p-2.5 sm:p-4 space-y-3 max-w-[1720px] mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            <span>Finance</span>
            <span>/</span>
            <span>Expenses</span>
          </div>
          <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2 mt-0.5">
            <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900">
              <DollarSign className="w-4 h-4 stroke-[2.5]" />
            </span>
            Expenses Management
          </h1>
        </div>

        <div className="flex items-center flex-wrap gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              refetchExpenses();
              refetchSummary();
            }}
            disabled={isFetching}
            className="h-8 px-2.5 rounded-lg border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <RotateCcw className={`w-3.5 h-3.5 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => downloadExpensesCSV(expenses, 'manufacturing_expenses')}
            className="h-8 px-2.5 rounded-lg border-emerald-200 dark:border-emerald-800/60 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export CSV
          </Button>

          <Button
            size="sm"
            onClick={handleOpenMultiModal}
            className="h-8 px-3 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-xs shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add Expenses
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
        <Card className="rounded-xl border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-2xs">
          <CardContent className="p-2.5 sm:p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Expenses</p>
              <h3 className="text-lg sm:text-xl font-black font-mono text-slate-900 dark:text-white mt-0.5">
                ₹{summary?.total ? summary.total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
              </h3>
              <p className="text-[10px] text-slate-400">{expenses.length} total entries</p>
            </div>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-900 shrink-0">
              <Layers className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-2xs">
          <CardContent className="p-2.5 sm:p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">This Month's Spend</p>
              <h3 className="text-lg sm:text-xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                ₹{summary?.monthly ? summary.monthly.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
              </h3>
              <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80">Current cycle</p>
            </div>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100 dark:border-emerald-900 shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-2xs">
          <CardContent className="p-2.5 sm:p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Supplier Tagged</p>
              <h3 className="text-lg sm:text-xl font-black font-mono text-purple-600 dark:text-purple-400 mt-0.5">
                {expenses.filter(e => e.isSupplierExpense || e.supplierId || e.supplierName).length}
              </h3>
              <p className="text-[10px] text-purple-500/80 dark:text-purple-400/80">With vendor invoices</p>
            </div>
            <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-100 dark:border-purple-900 shrink-0">
              <Building2 className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-2xs">
          <CardContent className="p-2.5 sm:p-3 flex items-center justify-between">
            <div className="min-w-0 pr-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Top Cost Center</p>
              <h3 className="text-sm sm:text-base font-black text-amber-600 dark:text-amber-400 mt-0.5 truncate">
                {summary?.categoryBreakdown && summary.categoryBreakdown.length > 0
                  ? [...summary.categoryBreakdown].sort((a, b) => b.amount - a.amount)[0]?.category
                  : 'None'}
              </h3>
              <p className="text-[10px] text-amber-500/80 dark:text-amber-400/80">Highest volume</p>
            </div>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-100 dark:border-amber-900 shrink-0">
              <CreditCard className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Control Bar */}
      <div className="p-2 sm:p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 text-xs">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search title, supplier, GSTIN, invoice..."
              className="pl-8 h-8 text-xs rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Dynamic Master Categories Dropdown */}
          <MultiSelectCategoryDropdown
            categories={activeMasterCategories}
            selectedValues={selectedCategories}
            onChange={(newVal) => {
              setSelectedCategories(newVal);
              setCurrentPage(1);
            }}
          />
        </div>

        <div className="flex items-center flex-wrap gap-2 justify-end">
          {/* Date Presets */}
          <select
            value={datePreset}
            onChange={(e) => {
              setDatePreset(e.target.value);
              setCurrentPage(1);
            }}
            className="h-8 px-2.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-medium"
          >
            {DATE_PRESETS.map(preset => (
              <option key={preset.id} value={preset.id}>{preset.label}</option>
            ))}
          </select>

          {datePreset === 'CUSTOM' && (
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => {
                  setCustomStartDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-8 px-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
              <span className="text-slate-400">-</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => {
                  setCustomEndDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-8 px-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
            </div>
          )}

          {/* Sort By Dropdown */}
          <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden h-8">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="h-full px-2 text-xs bg-white dark:bg-slate-950 font-medium border-0 focus:ring-0"
            >
              <option value="date">Date</option>
              <option value="amount">Amount</option>
              <option value="title">Title</option>
              <option value="category">Category</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-2 h-full bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border-l border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
              title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            >
              {sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            </button>
          </div>

          {/* Bulk Delete Button */}
          {selectedExpenseIds.length > 0 && (
            <Button
              size="sm"
              variant="destructive"
              onClick={handleBulkDelete}
              className="h-8 px-2.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Delete ({selectedExpenseIds.length})
            </Button>
          )}
        </div>
      </div>

      {/* Main Content: Full-Width Table + Bottom Analytics */}
      <div className="space-y-3">
        {/* Expenses Table (Full Width, Zero Horizontal Overflow) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-2xs overflow-hidden">
          {isListLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full rounded-lg" />
              ))}
            </div>
          ) : sortedExpenses.length === 0 ? (
            <div className="p-10 text-center text-slate-400 text-xs">
              <CreditCard className="w-9 h-9 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
              <p className="font-bold text-sm text-slate-600 dark:text-slate-300">No expense records found</p>
              <p className="mt-1">Click &quot;Add Expenses&quot; to record expenses with supplier details, charges &amp; payment modes.</p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <Table className="text-xs w-full">
                <TableHeader className="bg-slate-50/90 dark:bg-slate-950/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <TableRow className="border-b border-slate-100 dark:border-slate-800">
                    <TableHead className="w-8 px-1.5 py-2 text-center">
                      <button
                        type="button"
                        onClick={handleToggleSelectAll}
                        className="text-slate-400 hover:text-indigo-600"
                      >
                        {selectedExpenseIds.length === expenses.length && expenses.length > 0 ? (
                          <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
                        ) : (
                          <Square className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </TableHead>

                    <TableHead
                      onClick={() => handleSortToggle('date')}
                      className="w-[108px] px-2 font-bold text-slate-600 dark:text-slate-300 py-2 cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-1">
                        <span>Exp # / Date</span>
                        <ArrowUpDown className="w-2.5 h-2.5 text-slate-400" />
                      </div>
                    </TableHead>

                    <TableHead
                      onClick={() => handleSortToggle('category')}
                      className="w-[116px] px-2 font-bold text-slate-600 dark:text-slate-300 py-2 cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-1">
                        <span>Category</span>
                        <ArrowUpDown className="w-2.5 h-2.5 text-slate-400" />
                      </div>
                    </TableHead>

                    <TableHead
                      onClick={() => handleSortToggle('title')}
                      className="px-2 font-bold text-slate-600 dark:text-slate-300 py-2 cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-1">
                        <span>Title &amp; Notes</span>
                        <ArrowUpDown className="w-2.5 h-2.5 text-slate-400" />
                      </div>
                    </TableHead>

                    <TableHead className="px-2 font-bold text-slate-600 dark:text-slate-300 py-2">
                      Supplier / Inv #
                    </TableHead>

                    <TableHead className="w-[86px] px-2 text-right font-bold text-slate-600 dark:text-slate-300 py-2">
                      Taxable
                    </TableHead>

                    <TableHead className="w-[104px] px-1.5 text-center font-bold text-slate-600 dark:text-slate-300 py-2">
                      GST
                    </TableHead>

                    <TableHead className="w-[132px] px-2 font-bold text-slate-600 dark:text-slate-300 py-2">
                      Charges &amp; Disc
                    </TableHead>

                    <TableHead
                      onClick={() => handleSortToggle('amount')}
                      className="w-[96px] px-2 text-right font-bold text-slate-600 dark:text-slate-300 py-2 cursor-pointer select-none"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Total (₹)</span>
                        <ArrowUpDown className="w-2.5 h-2.5 text-slate-400" />
                      </div>
                    </TableHead>

                    <TableHead className="w-[136px] px-1.5 text-center font-bold text-slate-600 dark:text-slate-300 py-2">
                      Payment &amp; Mode
                    </TableHead>

                    <TableHead className="w-[56px] px-1.5 text-center font-bold text-slate-600 dark:text-slate-300 py-2">
                      Files
                    </TableHead>

                    <TableHead className="w-[74px] px-2 text-right font-bold text-slate-600 dark:text-slate-300 py-2">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {paginatedExpenses.map((exp) => {
                    const isSelected = selectedExpenseIds.includes(exp.id);
                    const catMeta = getCategoryMeta(exp.category);
                    const attachmentsCount = Array.isArray(exp.attachments) ? exp.attachments.length : 0;
                    const hasSupplier = Boolean(exp.isSupplierExpense || exp.supplierId || exp.supplierName);
                    const gstRate = Number(exp.gstPercentage || 0);
                    const totalTax = Number(exp.cgstAmount || 0) + Number(exp.sgstAmount || 0) + Number(exp.igstAmount || 0);
                    const chargeBadges = getExpenseChargesBadges(exp);
                    const totalExp = Number(exp.totalAmount || exp.amount || 0);
                    const status = exp.paymentStatus || 'PAID';
                    const paidVal = exp.paidAmount != null
                      ? Number(exp.paidAmount)
                      : (status === 'PAID' ? totalExp : 0);
                    const dueVal = Math.max(0, totalExp - paidVal);

                    return (
                      <TableRow
                        key={exp.id}
                        className={`transition-colors ${
                          isSelected
                            ? 'bg-indigo-50/50 dark:bg-indigo-950/30'
                            : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/30'
                        }`}
                      >
                        <TableCell className="text-center px-1.5 py-2">
                          <button
                            type="button"
                            onClick={() => handleToggleSelectRow(exp.id)}
                            className="text-slate-400 hover:text-indigo-600"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
                            ) : (
                              <Square className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </TableCell>

                        {/* Expense # & Date */}
                        <TableCell className="px-2 py-2 whitespace-nowrap">
                          <div className="space-y-0.5">
                            <span className="inline-block font-mono font-bold text-[10px] text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded bg-indigo-50/80 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800/80">
                              {exp.expenseNumber || 'EXP-—'}
                            </span>
                            <div className="font-semibold text-slate-600 dark:text-slate-400 text-[10px]">
                              {new Date(exp.date).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </div>
                          </div>
                        </TableCell>

                        {/* Category */}
                        <TableCell className="px-2 py-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border max-w-[110px] truncate ${catMeta.bg}`} title={catMeta.label}>
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: catMeta.color }} />
                            <span className="truncate">{catMeta.label}</span>
                          </span>
                        </TableCell>

                        {/* Title, SAC & Notes */}
                        <TableCell className="px-2 py-2 max-w-[180px]">
                          <div className="font-bold text-slate-900 dark:text-slate-100 truncate text-xs" title={exp.title}>
                            {exp.title}
                          </div>
                          {(exp.hsnSacCode || exp.notes) && (
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 truncate" title={exp.notes || ''}>
                              {exp.hsnSacCode && <span className="font-mono shrink-0">SAC:{exp.hsnSacCode}</span>}
                              {exp.notes && <span className="truncate italic">{exp.notes}</span>}
                            </div>
                          )}
                        </TableCell>

                        {/* Supplier / Vendor */}
                        <TableCell className="px-2 py-2 max-w-[180px]">
                          {hasSupplier ? (
                            <div className="space-y-0.5">
                              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1 truncate text-[11px]" title={exp.supplierName || ''}>
                                <Building2 className="w-3 h-3 text-indigo-500 shrink-0" />
                                <span className="truncate">{exp.supplierName || 'Vendor Assigned'}</span>
                              </div>
                              <div className="flex items-center gap-1 flex-wrap">
                                {exp.supplierGstin && (
                                  <span className="font-mono text-[9px] px-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                    {exp.supplierGstin}
                                  </span>
                                )}
                                {exp.invoiceNo && (
                                  <span className="font-mono text-[9px] px-1 rounded bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                    #{exp.invoiceNo}
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[10px] italic">Internal</span>
                          )}
                        </TableCell>

                        {/* Taxable */}
                        <TableCell className="px-2 py-2 text-right font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap text-[11px]">
                          ₹{Number(exp.taxableAmount || exp.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>

                        {/* GST Breakdown */}
                        <TableCell className="px-1.5 py-2 text-center whitespace-nowrap">
                          {gstRate > 0 || totalTax > 0 ? (
                            <div className="space-y-0.5">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                exp.isInterState
                                  ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                  : 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                              }`}>
                                {gstRate > 0
                                  ? (exp.isInterState ? `IGST ${gstRate}%` : `CGST+SGST ${gstRate}%`)
                                  : (exp.isInterState ? 'IGST (Chg)' : 'GST (Chg)')}
                              </span>
                              <div className="text-[10px] font-mono text-slate-500">
                                +₹{totalTax.toFixed(2)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-mono">0% GST</span>
                          )}
                        </TableCell>

                        {/* Charges & Discount */}
                        <TableCell className="px-2 py-2 max-w-[140px]">
                          {chargeBadges.length === 0 ? (
                            <span className="text-[11px] text-slate-300 dark:text-slate-600">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {chargeBadges.map((b) => (
                                <span
                                  key={b.key}
                                  className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-bold border font-mono ${b.tone}`}
                                >
                                  <span>{b.label}</span>
                                  {b.gst && <span className="text-indigo-600 dark:text-indigo-400">{b.gst}</span>}
                                </span>
                              ))}
                            </div>
                          )}
                        </TableCell>

                        {/* Grand Total */}
                        <TableCell className="px-2 py-2 text-right font-bold font-mono text-slate-900 dark:text-white whitespace-nowrap text-xs">
                          ₹{totalExp.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>

                        {/* Payment Status, Mode & Ref */}
                        <TableCell className="px-1.5 py-2 text-center whitespace-nowrap">
                          <div className="space-y-0.5 flex flex-col items-center">
                            <div className="flex items-center gap-1">
                              <span className={`inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-bold border uppercase tracking-wider ${
                                status === 'PAID'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                                  : status === 'PARTIALLY_PAID'
                                  ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800'
                                  : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                              }`}>
                                {status === 'PAID' ? 'PAID' : status === 'PARTIALLY_PAID' ? 'PARTIAL' : 'UNPAID'}
                              </span>
                              <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">
                                {getPaymentModeShortLabel(exp.paymentMode)}
                              </span>
                              {exp.paymentImage && (
                                <button
                                  type="button"
                                  onClick={() => handlePreviewAttachment({ url: exp.paymentImage, name: `Payment Receipt - ${exp.expenseNumber || exp.title}` })}
                                  className="p-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100"
                                  title="View Payment Proof Image"
                                >
                                  <Eye className="w-2.5 h-2.5" />
                                </button>
                              )}
                            </div>
                            {status !== 'PAID' ? (
                              <div className="text-[9px] font-mono text-amber-600 dark:text-amber-400 font-semibold">
                                Paid ₹{paidVal.toLocaleString('en-IN', { maximumFractionDigits: 0 })} • Due ₹{dueVal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                              </div>
                            ) : (
                              <div className="text-[9px] font-mono text-emerald-600/80 dark:text-emerald-400/80">
                                ₹{paidVal.toLocaleString('en-IN', { maximumFractionDigits: 2 })} settled
                              </div>
                            )}
                            {exp.paymentRef && (
                              <div className="text-[9px] font-mono text-slate-400 max-w-[125px] truncate" title={exp.paymentRef}>
                                Ref: {exp.paymentRef}
                              </div>
                            )}
                          </div>
                        </TableCell>

                        {/* Attachments */}
                        <TableCell className="px-1.5 py-2 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setViewingAttachmentsExpense(exp)}
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                              attachmentsCount > 0
                                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100'
                                : 'bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 hover:text-indigo-600'
                            }`}
                          >
                            <Paperclip className="w-2.5 h-2.5" />
                            <span>{attachmentsCount}</span>
                          </button>
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="px-2 py-2 text-right space-x-0.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setViewingExpense(exp)}
                            className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="View Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(exp)}
                            className="p-1 rounded text-slate-400 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Edit Expense"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSingle(exp.id, exp.title)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Delete Expense"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-3 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/20 text-xs">
              <span className="text-[11px] text-slate-400">
                Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, sortedExpenses.length)} of {sortedExpenses.length}
              </span>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </div>

        {/* Compact Bottom 2-Column Analytics Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3 shadow-2xs">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 pb-1.5 border-b border-slate-100 dark:border-slate-800">
              <PieChartIcon className="w-3.5 h-3.5 text-indigo-500" />
              Category Breakdown
            </h4>

            {isSummaryLoading ? (
              <div className="h-40 flex items-center justify-center">
                <Skeleton className="w-28 h-28 rounded-full" />
              </div>
            ) : chartData.length === 0 ? (
              <div className="h-40 flex flex-col items-center justify-center text-slate-400 text-xs text-center p-2">
                <PieChartIcon className="w-8 h-8 mb-1 text-slate-300 dark:text-slate-700" />
                <span>No expense data to chart</span>
              </div>
            ) : (
              <div className="h-40 w-full text-xs">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={38}
                      outerRadius={60}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Amount']}
                      contentStyle={{
                        borderRadius: '8px',
                        fontSize: '11px',
                        background: '#0f172a',
                        color: '#fff',
                        border: 'none'
                      }}
                    />
                    <Legend
                      layout="horizontal"
                      verticalAlign="bottom"
                      align="center"
                      iconSize={6}
                      iconType="circle"
                      wrapperStyle={{ fontSize: '10px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3 shadow-2xs space-y-2">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 pb-1.5 border-b border-slate-100 dark:border-slate-800">
              <BarChart3 className="w-3.5 h-3.5 text-emerald-500" />
              Top Cost Centers
            </h4>

            {chartData.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400 italic">
                No records yet
              </div>
            ) : (
              <div className="space-y-2">
                {[...chartData]
                  .sort((a, b) => b.value - a.value)
                  .slice(0, 5)
                  .map((item, idx) => {
                    const maxVal = Math.max(...chartData.map(c => c.value), 1);
                    const pct = Math.round((item.value / maxVal) * 100);
                    return (
                      <div key={idx} className="space-y-1 text-[11px]">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[180px]">{item.name}</span>
                          <span className="font-mono font-bold text-slate-900 dark:text-white">
                            ₹{item.value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{ width: `${pct}%`, backgroundColor: item.color }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          FAST MULTI-ENTRY GRID MODAL WITH STYLISH SUPPLIER SELECT & CHARGES SUMMARY (SECTION 4)
          FULL SCREEN & FULLY RESPONSIVE FOR ALL DEVICES WITHOUT COLLAPSE
          ========================================================================= */}
      {isMultiModalOpen && (
        <div className={`fixed inset-0 z-50 flex ${isMultiModalFullScreen ? 'p-0' : 'items-center justify-center p-2 sm:p-3'} bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200`}>
          <div className={`bg-white dark:bg-slate-900 ${isMultiModalFullScreen ? 'w-screen h-screen rounded-none' : 'rounded-2xl w-[97vw] xl:max-w-[1520px] max-h-[96vh]'} flex flex-col border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden transition-all duration-200`}>
            {/* Compact Enterprise Modal Header */}
            <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-gradient-to-r from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-sm">
                  <CreditCard className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                    Record Expenses (Multi-Entry Grid)
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                      SUPPLIER &amp; GST
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-mono flex items-center gap-1">
                      <Hash className="w-3 h-3 text-purple-500" />
                      Next: {candidateExpenseNumber}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
                    Enter batch expenses with per-row Charges, Financial Summary &amp; Payment Settlement.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsMultiModalFullScreen(!isMultiModalFullScreen)}
                  className="h-7.5 px-2.5 rounded-lg border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold flex items-center gap-1.5"
                  title={isMultiModalFullScreen ? "Exit Fullscreen (Windowed View)" : "Maximize to Fullscreen"}
                >
                  {isMultiModalFullScreen ? (
                    <>
                      <Minimize2 className="w-3.5 h-3.5 text-indigo-500" />
                      <span className="hidden sm:inline">Windowed</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="w-3.5 h-3.5 text-indigo-500" />
                      <span className="hidden sm:inline">Full Screen</span>
                    </>
                  )}
                </Button>
                <button
                  type="button"
                  onClick={handleCloseMultiModal}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Close Window (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Quick Action Bar */}
            <div className="px-4 py-1.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddBatchRow}
                  className="h-7 px-2.5 rounded-lg border-indigo-200 dark:border-indigo-800/80 font-bold text-[11px] bg-indigo-50/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 shadow-2xs"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Row
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAddMultipleBatchRows(3)}
                  className="h-7 px-2.5 rounded-lg border-slate-200 dark:border-slate-700 font-bold text-[11px] hover:border-indigo-300"
                >
                  <PlusCircle className="w-3 h-3 mr-1 text-slate-400" />
                  +3 Rows
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAddMultipleBatchRows(5)}
                  className="h-7 px-2.5 rounded-lg border-slate-200 dark:border-slate-700 font-bold text-[11px] hover:border-indigo-300 hidden sm:inline-flex"
                >
                  <PlusCircle className="w-3 h-3 mr-1 text-slate-400" />
                  +5 Rows
                </Button>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] text-slate-500">
                  Ready: <strong className="text-slate-900 dark:text-white font-mono">{batchSummary.validCount}</strong>/{batchRows.length}
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-indigo-50/80 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-bold text-[11px] font-mono">
                  Row #{safeActiveRowIdx + 1}: ₹{activeRowSummary.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                <span className="px-2.5 py-0.5 rounded-lg bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/80 dark:to-purple-950/80 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-mono font-black text-xs shadow-2xs">
                  Batch: ₹{batchSummary.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Scrollable Content: Compact Overflow-Free Grid + Side-by-Side Section 4 & Section 5 */}
            <div className="flex-1 overflow-y-auto p-2.5 sm:p-3.5 space-y-3 bg-slate-50/40 dark:bg-slate-950/30">
              {/* Zero-Overflow Spreadsheet Grid Table */}
              <div
                className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-y-auto overflow-x-auto lg:overflow-x-hidden shadow-xs bg-white dark:bg-slate-900"
                style={{
                  maxHeight: isMultiModalFullScreen ? 'calc(100vh - 510px)' : '310px',
                  minHeight: '190px'
                }}
              >
                <table className="w-full text-left text-xs min-w-[960px] lg:min-w-0 lg:table-fixed">
                  <thead className="bg-slate-100/95 dark:bg-slate-950/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider sticky top-0 z-20">
                    <tr>
                      <th className="w-[3%] px-1 py-2 text-center">#</th>
                      <th className="w-[15%] px-1.5 py-2">Date &amp; Category *</th>
                      <th className="w-[21%] px-1.5 py-2">Vendor &amp; Inv #</th>
                      <th className="w-[16%] px-1.5 py-2">Title / Purpose *</th>
                      <th className="w-[8%] px-1.5 py-2 text-right">Taxable *</th>
                      <th className="w-[5%] px-1 py-2 text-center">GST</th>
                      <th className="w-[8%] px-1.5 py-2 text-right">Total (₹)</th>
                      <th className="w-[8%] px-1 py-2 text-center">Charges</th>
                      <th className="w-[10%] px-1 py-2 text-center">Payment</th>
                      <th className="w-[6%] px-1 py-2 text-center">Files / Act</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900">
                    {batchRows.map((row, idx) => {
                      const isSupp = Boolean(row.isSupplierExpense);
                      const isActive = idx === safeActiveRowIdx;
                      const rowFin = rowSummaries[idx] || computeExpenseFinancials(row, idx);
                      const rowChargeBadges = getExpenseChargesBadges(row);
                      const payStatus = rowFin.paymentStatus;

                      return (
                        <tr
                          key={row.id}
                          onMouseDown={() => setActiveBatchRowIdx(idx)}
                          onFocusCapture={() => setActiveBatchRowIdx(idx)}
                          className={`transition-colors align-top ${
                            isActive
                              ? 'bg-indigo-50/55 dark:bg-indigo-950/35 ring-1 ring-inset ring-indigo-500/40'
                              : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/20'
                          }`}
                        >
                          {/* 1. Row Index */}
                          <td className="px-1 py-1.5 text-center font-mono font-bold">
                            <button
                              type="button"
                              onClick={() => setActiveBatchRowIdx(idx)}
                              className={`inline-flex flex-col items-center px-1.5 py-1 rounded-lg transition-all text-[11px] ${
                                isActive
                                  ? 'bg-indigo-600 text-white shadow-xs'
                                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                              }`}
                              title="Click to edit Charges & Payment for this row"
                            >
                              <span>{idx + 1}</span>
                              {isActive && <span className="text-[7px] font-black uppercase leading-none mt-0.5">ON</span>}
                            </button>
                          </td>

                          {/* 2. Date & Category Stacked */}
                          <td className="px-1.5 py-1.5 space-y-1">
                            <input
                              type="date"
                              value={row.date}
                              onChange={(e) => handleUpdateBatchRow(idx, 'date', e.target.value)}
                              className="w-full h-7 px-1.5 text-[11px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                            />
                            <select
                              value={row.categoryId || row.category}
                              onChange={(e) => handleUpdateBatchRow(idx, 'categorySelect', e.target.value)}
                              className="w-full h-7 px-1.5 text-[11px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold truncate"
                            >
                              {activeMasterCategories.map(cat => (
                                <option key={cat.id || cat.name} value={cat.id || cat.name}>
                                  {cat.name}{cat.expenseWithSupplier ? ' (Vendor)' : ''}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* 3. Supplier Toggle + Inv # + Searchable Supplier Select */}
                          <td className="px-1.5 py-1.5 space-y-1">
                            <div className="flex items-center gap-1">
                              <label className={`inline-flex items-center gap-1 cursor-pointer select-none px-1.5 h-6 rounded-md border shrink-0 transition-colors ${
                                isSupp
                                  ? 'border-indigo-300 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-950/60'
                                  : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80'
                              }`}>
                                <input
                                  type="checkbox"
                                  checked={isSupp}
                                  onChange={(e) => handleUpdateBatchRow(idx, 'isSupplierExpense', e.target.checked)}
                                  className="w-3 h-3 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                />
                                <span className={`text-[9px] font-extrabold uppercase ${isSupp ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-500'}`}>
                                  {isSupp ? 'Vendor' : 'Int.'}
                                </span>
                              </label>
                              <input
                                type="text"
                                placeholder={isSupp ? 'Inv # (Opt)' : 'Ref / Inv #'}
                                value={row.invoiceNo}
                                onChange={(e) => handleUpdateBatchRow(idx, 'invoiceNo', e.target.value)}
                                className="flex-1 min-w-0 h-6 px-1.5 text-[10px] rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
                              />
                            </div>
                            {isSupp ? (
                              <SupplierSelect
                                suppliers={suppliers}
                                value={row.selectedSupplier}
                                onChange={(s) => handleUpdateBatchRow(idx, 'supplierSelect', s)}
                                onAddNew={() => {
                                  setTargetRowIdxForNewSupplier(idx);
                                  setShowAddSupplierModal(true);
                                }}
                                placeholder="Select vendor..."
                                isInterStateForSupplier={isInterStateForSupplier}
                                compact={true}
                              />
                            ) : (
                              <div className="h-7.5 px-2 rounded-lg border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 flex items-center text-[10px] text-slate-400 italic truncate">
                                Internal Expense (No Vendor)
                              </div>
                            )}
                          </td>

                          {/* 4. Title / Purpose */}
                          <td className="px-1.5 py-1.5">
                            <textarea
                              rows={2}
                              placeholder="e.g. Travel expense, purchase expense, freight..."
                              value={row.title}
                              onChange={(e) => handleUpdateBatchRow(idx, 'title', e.target.value)}
                              className="w-full h-[58px] px-2 py-1 text-[11px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium resize-none leading-tight"
                            />
                          </td>

                          {/* 5. Taxable Amount */}
                          <td className="px-1.5 py-1.5">
                            <input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={row.taxableAmount}
                              onChange={(e) => handleUpdateBatchRow(idx, 'taxableAmount', e.target.value)}
                              className="w-full h-8 px-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono font-bold text-right"
                            />
                          </td>

                          {/* 6. GST % */}
                          <td className="px-1 py-1.5 text-center">
                            {isSupp ? (
                              <select
                                value={row.gstPercentage}
                                onChange={(e) => handleUpdateBatchRow(idx, 'gstPercentage', Number(e.target.value))}
                                className="w-full h-8 px-0.5 text-[11px] rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-950 text-indigo-700 dark:text-indigo-300 font-bold focus:outline-none text-center"
                              >
                                <option value={0}>0%</option>
                                <option value={5}>5%</option>
                                <option value={12}>12%</option>
                                <option value={18}>18%</option>
                                <option value={28}>28%</option>
                              </select>
                            ) : (
                              <span className="inline-flex h-8 items-center text-[11px] text-slate-400 font-mono">0%</span>
                            )}
                          </td>

                          {/* 7. Row Grand Total */}
                          <td className="px-1.5 py-1.5 text-right font-mono whitespace-nowrap">
                            <div className="font-black text-xs text-slate-900 dark:text-white pt-1">
                              ₹{rowFin.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            {(rowFin.totalExtraCharges > 0 || rowFin.discount > 0 || rowFin.totalChargesTaxes > 0) && (
                              <div className="text-[9px] text-indigo-600 dark:text-indigo-400 font-semibold truncate">
                                {rowFin.totalExtraCharges > 0 ? `+₹${rowFin.totalExtraCharges.toFixed(0)} ` : ''}
                                {rowFin.discount > 0 ? `-₹${rowFin.discount.toFixed(0)}` : ''}
                              </div>
                            )}
                          </td>

                          {/* 8. Per-Row Charges Trigger */}
                          <td className="px-1 py-1.5 text-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleFocusRowSection(idx, 'charges');
                              }}
                              className={`w-full min-h-[32px] px-1.5 py-1 rounded-lg border text-[10px] font-bold transition-all flex flex-wrap items-center justify-center gap-0.5 ${
                                isActive
                                  ? 'border-indigo-400 bg-white dark:bg-slate-900 shadow-xs'
                                  : 'border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/70 hover:border-indigo-400'
                              }`}
                              title="Click to enter Shipping, Packing, Loading, Other Charges & Discount"
                            >
                              {rowChargeBadges.length > 0 ? (
                                rowChargeBadges.map((b) => (
                                  <span key={b.key} className="px-1 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-mono text-[9px] truncate max-w-full">
                                    {b.label}
                                  </span>
                                ))
                              ) : (
                                <span className="text-slate-500 dark:text-slate-400 inline-flex items-center gap-0.5">
                                  <Calculator className="w-3 h-3 text-indigo-500 shrink-0" />
                                  <span>+Chg</span>
                                </span>
                              )}
                            </button>
                          </td>

                          {/* 9. Per-Row Payment Mode Trigger */}
                          <td className="px-1 py-1.5 text-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleFocusRowSection(idx, 'payment');
                              }}
                              className={`w-full px-1.5 py-1 rounded-lg border text-[10px] font-bold transition-all flex flex-col items-center gap-0.5 ${
                                isActive
                                  ? 'border-indigo-400 bg-white dark:bg-slate-900 shadow-xs'
                                  : 'border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/70 hover:border-indigo-400'
                              }`}
                              title="Click to configure Payment Mode, Paid Amount, Ref & Proof Image"
                            >
                              <div className="flex items-center gap-1 max-w-full">
                                <span className={`px-1 rounded text-[8px] font-extrabold uppercase shrink-0 ${
                                  payStatus === 'PAID'
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                                    : payStatus === 'PARTIALLY_PAID'
                                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400'
                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                                }`}>
                                  {payStatus === 'PAID' ? 'PAID' : payStatus === 'PARTIALLY_PAID' ? 'PART' : 'DUE'}
                                </span>
                                <span className="text-slate-700 dark:text-slate-200 truncate">
                                  {getPaymentModeShortLabel(rowFin.paymentMode)}
                                </span>
                                {row.paymentImage && <ImageIcon className="w-2.5 h-2.5 text-emerald-500 shrink-0" />}
                              </div>
                              <div className="text-[9px] font-mono text-slate-500 truncate max-w-full">
                                {payStatus === 'PAID'
                                  ? `₹${rowFin.paidAmountNum.toLocaleString('en-IN')}`
                                  : `₹${rowFin.paidAmountNum.toLocaleString('en-IN')} / Due ₹${rowFin.balanceDue.toLocaleString('en-IN')}`}
                              </div>
                            </button>
                          </td>

                          {/* 10. Files & Actions Combined */}
                          <td className="px-1 py-1.5 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setRowAttachmentModalIdx(idx)}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-0.5 border transition-all ${
                                  row.attachments && row.attachments.length > 0
                                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                                    : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                                }`}
                                title="Upload / Manage Row Attachments"
                              >
                                <Paperclip className="w-2.5 h-2.5" />
                                <span>{row.attachments?.length || 0}</span>
                              </button>
                              <div className="flex items-center gap-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleDuplicateBatchRow(idx)}
                                  className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                  title="Duplicate Row"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveBatchRow(idx)}
                                  className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                  title="Delete Row"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Unified Active Row Switcher & Quick Copy Strip */}
              <div className="bg-white dark:bg-slate-900 border border-indigo-200/80 dark:border-indigo-900/60 rounded-xl px-3 py-2 shadow-2xs flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mr-1">
                    Active Expense:
                  </span>
                  {batchRows.map((row, idx) => {
                    const isActive = idx === safeActiveRowIdx;
                    const rFin = rowSummaries[idx] || computeExpenseFinancials(row, idx);
                    return (
                      <button
                        key={row.id}
                        type="button"
                        onClick={() => setActiveBatchRowIdx(idx)}
                        className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition-all inline-flex items-center gap-1.5 ${
                          isActive
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                        }`}
                      >
                        <span className="font-mono">#{idx + 1}</span>
                        <span className="truncate max-w-[95px] font-medium">
                          {row.title?.trim() || row.category || 'Empty'}
                        </span>
                        <span className={`font-mono text-[10px] ${isActive ? 'text-indigo-100' : 'text-slate-400'}`}>
                          ₹{rFin.grandTotal.toLocaleString('en-IN')}
                        </span>
                        <span className={`text-[8px] uppercase font-extrabold px-1 rounded ${
                          rFin.paymentStatus === 'PAID'
                            ? (isActive ? 'bg-emerald-500/30 text-white' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400')
                            : rFin.paymentStatus === 'PARTIALLY_PAID'
                            ? (isActive ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400')
                            : (isActive ? 'bg-amber-400/30 text-white' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400')
                        }`}>
                          {getPaymentModeShortLabel(rFin.paymentMode)}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {batchRows.length > 1 && (
                  <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                    <button
                      type="button"
                      onClick={handleCopyChargesToAllRows}
                      className="h-7 px-2 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold hover:bg-indigo-100 transition-colors inline-flex items-center gap-1"
                      title="Apply active row's Charges & Discount to all rows"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copy Charges to All</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyPaymentToAllRows}
                      className="h-7 px-2 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold hover:bg-indigo-100 transition-colors inline-flex items-center gap-1"
                      title="Apply active row's Payment Mode & Status to all rows"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copy Payment to All</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Balanced 2-Column Enterprise Panel: Section 4 Charges & Section 5 Payment */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-start">
                {/* 4. Per-Row Charges & Financial Summary */}
                <div
                  ref={chargesSectionRef}
                  className="xl:col-span-6 bg-white dark:bg-slate-900 border border-indigo-200/80 dark:border-indigo-900/60 rounded-xl p-3 shadow-2xs space-y-2.5 w-full min-w-0"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      <Calculator className="w-4 h-4 text-indigo-500 shrink-0" />
                      <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                        4. Charges &amp; Financial Summary
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-black">
                        ROW #{safeActiveRowIdx + 1}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate max-w-[180px]">
                        {activeBatchRow.title?.trim() || 'Untitled'} • {activeBatchRow.isSupplierExpense ? (activeBatchRow.supplierName || 'Vendor') : 'Internal'}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shrink-0">
                      INR (₹)
                    </span>
                  </div>

                  <ExpenseChargesAndSummarySection
                    values={activeBatchRow}
                    onChangeField={handleUpdateActiveRowField}
                    summary={activeRowSummary}
                    entryCountLabel={`Row #${safeActiveRowIdx + 1}`}
                    compactLayout={true}
                  />
                </div>

                {/* 5. Per-Row Payment & Settlement Details */}
                <div
                  ref={paymentSectionRef}
                  className="xl:col-span-6 bg-white dark:bg-slate-900 border border-indigo-200/80 dark:border-indigo-900/60 rounded-xl p-3 shadow-2xs space-y-2.5 w-full min-w-0"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CreditCard className="w-4 h-4 text-indigo-500 shrink-0" />
                      <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                        5. Payment &amp; Settlement Details
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-black">
                        ROW #{safeActiveRowIdx + 1}
                      </span>
                    </div>

                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                      activeRowSummary.paymentStatus === 'PAID'
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                        : activeRowSummary.paymentStatus === 'PARTIALLY_PAID'
                        ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800'
                        : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                    }`}>
                      {activeRowSummary.paymentStatus === 'PAID' ? 'Fully Settled' : activeRowSummary.paymentStatus === 'PARTIALLY_PAID' ? 'Partial Settlement' : 'Unpaid Expense'}
                    </span>
                  </div>

                  <PaymentFieldsSection
                    key={activeBatchRow.id}
                    paymentStatus={activeBatchRow.paymentStatus || 'PAID'}
                    setPaymentStatus={(val) => handleUpdateActiveRowField('paymentStatus', val)}
                    paidAmount={(activeBatchRow.paymentStatus || 'PAID') === 'PAID' ? String(activeRowSummary.grandTotal) : (activeBatchRow.paidAmount ?? '0')}
                    setPaidAmount={(val) => handleUpdateActiveRowField('paidAmount', val)}
                    paymentMode={activeBatchRow.paymentMode || 'CASH'}
                    setPaymentMode={(val) => handleUpdateActiveRowField('paymentMode', val)}
                    paymentRef={activeBatchRow.paymentRef ?? ''}
                    setPaymentRef={(val) => handleUpdateActiveRowField('paymentRef', val)}
                    paymentImage={activeBatchRow.paymentImage ?? null}
                    setPaymentImage={(val) => handleUpdateActiveRowField('paymentImage', val)}
                    paymentNotes={activeBatchRow.paymentNotes ?? ''}
                    setPaymentNotes={(val) => handleUpdateActiveRowField('paymentNotes', val)}
                    totalAmount={activeRowSummary.grandTotal}
                    isCompact={true}
                  />
                </div>
              </div>
            </div>

            {/* Compact Modal Footer */}
            <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-2 shadow-sm shrink-0">
              <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-bold font-mono text-[11px]">
                  {batchSummary.validCount} Valid Row{batchSummary.validCount !== 1 ? 's' : ''}
                </span>
                {batchSummary.validCount > 0 && (
                  <span className="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold font-mono text-[11px]">
                    Paid: ₹{batchSummary.totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    {batchSummary.totalDue > 0 ? ` • Due: ₹${batchSummary.totalDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : ''}
                  </span>
                )}
                <span className="hidden lg:inline text-[11px]">• Per-expense Charges &amp; Payment Modes saved independently</span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseMultiModal}
                  className="rounded-xl border-slate-300 dark:border-slate-700 text-xs font-bold h-8.5 px-4 hover:bg-slate-100"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveBatchExpenses}
                  disabled={bulkCreateMutation.isPending || batchSummary.validCount === 0}
                  className="rounded-xl text-xs font-black h-8.5 px-5 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-md hover:shadow-indigo-500/25 transition-all flex items-center gap-1.5"
                >
                  {bulkCreateMutation.isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Expenses...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Save ({batchSummary.validCount} Expense{batchSummary.validCount !== 1 ? 's' : ''}) • ₹{batchSummary.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          ROW ATTACHMENTS MODAL (Inside Multi-Entry Grid)
          ========================================================================= */}
      {rowAttachmentModalIdx !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 bg-black/50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h4 className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                  Attachments: Row #{rowAttachmentModalIdx + 1}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setRowAttachmentModalIdx(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Upload Area */}
            <div>
              <Label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Upload Receipts / Invoices (PDF, PNG, JPG, WEBP)</span>
                {isUploadingAttachments && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">
                    <Loader2 className="w-3 h-3 animate-spin" /> Uploading...
                  </span>
                )}
              </Label>
              <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-4 text-center hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors">
                <input
                  type="file"
                  multiple
                  accept=".pdf,image/png,image/jpeg,image/webp"
                  onChange={(e) => handleUploadRowAttachments(e, rowAttachmentModalIdx)}
                  id="rowFileInput"
                  className="hidden"
                />
                <label htmlFor="rowFileInput" className="cursor-pointer block">
                  <Upload className="w-6 h-6 mx-auto text-indigo-500 mb-1" />
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    Click to select multiple files
                  </span>
                  <p className="text-[10px] text-slate-400 mt-0.5">Maximum 25MB per file</p>
                </label>
              </div>
            </div>

            {/* List of uploaded files */}
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {(batchRows[rowAttachmentModalIdx]?.attachments || []).length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-3 italic">
                  No attachments added yet (optional).
                </p>
              ) : (
                (batchRows[rowAttachmentModalIdx]?.attachments || []).map((file, fIdx) => (
                  <div
                    key={file.id || fIdx}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700 text-xs"
                  >
                    <div className="flex items-center gap-2 truncate mr-2">
                      {file.type?.includes('pdf') ? (
                        <FileText className="w-4 h-4 text-rose-500 shrink-0" />
                      ) : (
                        <ImageIcon className="w-4 h-4 text-emerald-500 shrink-0" />
                      )}
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{file.name || file.originalName}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handlePreviewAttachment(file)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 transition-colors shadow-2xs"
                        title="View Attachment"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveRowAttachment(rowAttachmentModalIdx, file)}
                        className="p-1 rounded text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        title="Remove file from server"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <Button
                type="button"
                onClick={() => setRowAttachmentModalIdx(null)}
                className="h-8 px-4 text-xs font-bold bg-indigo-600 text-white rounded-lg"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          EDIT EXPENSE RECORD MODAL WITH SUPPLIER & GST CALCULATION
          ========================================================================= */}
      {editingExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
            <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/60 dark:bg-slate-950/60">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Edit2 className="w-3.5 h-3.5 text-indigo-500" />
                Edit Expense Record
              </h3>
              <button
                type="button"
                onClick={() => setEditingExpense(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleSubmitEdit(onEditSubmit)} className="p-5 space-y-3.5 overflow-y-auto text-xs flex-1">
              {/* 0. Running Expense Number */}
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-500 uppercase flex items-center justify-between">
                  <span>Running Expense #</span>
                  <span className="text-[9px] font-mono text-slate-400">System Tracked Identifier</span>
                </Label>
                <Input
                  {...registerEdit('expenseNumber')}
                  placeholder="e.g. EXP-000001"
                  className="h-8 text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 rounded-lg bg-indigo-50/40 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800"
                />
              </div>

              {/* 1. Date */}
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-500 uppercase">1. Date *</Label>
                <Controller
                  control={controlEdit}
                  name="date"
                  rules={{ required: 'Date is required' }}
                  render={({ field }) => (
                    <DatePicker
                      value={field.value}
                      onChange={(date) => field.onChange(date ? date.toISOString().split('T')[0] : '')}
                      triggerClassName="h-8 text-xs rounded-lg"
                    />
                  )}
                />
                {editErrors.date && <span className="text-[10px] text-rose-500">{editErrors.date.message}</span>}
              </div>

              {/* 2. Category (Expense Master Dynamic) */}
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-500 uppercase flex items-center justify-between">
                  <span>2. Category (Expense Master) *</span>
                </Label>
                <Controller
                  control={controlEdit}
                  name="categoryId"
                  rules={{ required: 'Category is required' }}
                  render={({ field }) => (
                    <select
                      value={field.value}
                      onChange={(e) => {
                        field.onChange(e.target.value);
                        const sel = activeMasterCategories.find(c => c.id === e.target.value);
                        if (sel) {
                          setValueEdit('category', sel.name);
                          if (sel.expenseWithSupplier) {
                            setValueEdit('isSupplierExpense', true);
                            if (sel.defaultGstRate != null) setValueEdit('gstPercentage', Number(sel.defaultGstRate));
                            if (sel.hsnSacCode) setValueEdit('hsnSacCode', sel.hsnSacCode);
                          }
                        }
                      }}
                      className="w-full h-8.5 px-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-medium"
                    >
                      <option value="">Select Category...</option>
                      {activeMasterCategories.map(cat => (
                        <option key={cat.id || cat.name} value={cat.id || cat.name}>
                          {cat.name} {cat.expenseWithSupplier ? '(Supplier)' : ''}
                        </option>
                      ))}
                    </select>
                  )}
                />
                {editErrors.categoryId && <span className="text-[10px] text-rose-500">{editErrors.categoryId.message}</span>}
              </div>

              {/* 3. With Supplier Checkbox Toggle */}
              <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    {...registerEdit('isSupplierExpense')}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-600 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                    Expense with Supplier (Vendor Billing & GST)
                  </span>
                </label>
              </div>

              {/* Supplier Selection Fields (If with supplier) */}
              {editIsSupplierExpense && (
                <div className="p-3 rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/30 dark:bg-indigo-950/20 space-y-2.5">
                  <div>
                    <Label className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase block mb-1">
                      Supplier / Vendor *
                    </Label>
                    <SupplierSelect
                      suppliers={suppliers}
                      value={suppliers.find(s => s.id === editSupplierId) || (watchEdit('supplierName') ? { id: editSupplierId, name: watchEdit('supplierName'), gstin: watchEdit('supplierGstin') } : null)}
                      onChange={(s) => {
                        setValueEdit('supplierId', s?.id || '');
                        setValueEdit('supplierName', s?.name || '');
                        setValueEdit('supplierGstin', s?.gstin || '');
                        setValueEdit('isInterState', isInterStateForSupplier(s));
                      }}
                      onAddNew={() => setShowAddSupplierModal(true)}
                      isInterStateForSupplier={isInterStateForSupplier}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] font-bold text-slate-500 uppercase">Invoice / Bill #</Label>
                      <Input
                        {...registerEdit('invoiceNo')}
                        placeholder="e.g. INV-1049"
                        className="h-8 text-xs font-mono rounded-lg"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] font-bold text-slate-500 uppercase">Invoice Date</Label>
                      <Input
                        type="date"
                        {...registerEdit('invoiceDate')}
                        className="h-8 text-xs font-medium rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 4. Title / Purpose */}
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-500 uppercase">Title / Purpose *</Label>
                <Input
                  {...registerEdit('title', { required: 'Title is required' })}
                  placeholder="e.g. Travel expense, purchase expense, freight..."
                  className="h-8 text-xs rounded-lg"
                />
                {editErrors.title && <span className="text-[10px] text-rose-500">{editErrors.title.message}</span>}
              </div>

              {/* 5. Taxable Amount & GST Rate */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase">Taxable Amount (₹) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    {...registerEdit('taxableAmount', { required: 'Taxable amount is required' })}
                    className="h-8 text-xs font-mono font-bold rounded-lg"
                  />
                  {editErrors.taxableAmount && <span className="text-[10px] text-rose-500">{editErrors.taxableAmount.message}</span>}
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase">GST Rate %</Label>
                  <select
                    {...registerEdit('gstPercentage')}
                    className="w-full h-8 px-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-bold text-indigo-600"
                  >
                    <option value={0}>0% GST</option>
                    <option value={5}>5% GST</option>
                    <option value={12}>12% GST</option>
                    <option value={18}>18% GST</option>
                    <option value={28}>28% GST</option>
                  </select>
                </div>
              </div>

              {/* 6. Reference / Notes */}
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-500 uppercase">Reference Note</Label>
                <textarea
                  {...registerEdit('notes')}
                  rows={2}
                  placeholder="Optional reference number or extra details"
                  className="w-full p-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 resize-none"
                />
              </div>

              {/* 7. Per-Expense Charges & Financial Summary */}
              <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40 space-y-3">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/70 dark:border-slate-800">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <Calculator className="w-3.5 h-3.5 text-indigo-500" />
                    Charges & Financial Summary
                  </span>
                  <span className="font-mono text-xs font-black text-indigo-600 dark:text-indigo-400">
                    ₹{editFinancialSummary.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <ExpenseChargesAndSummarySection
                  values={editChargesPayment}
                  onChangeField={handleUpdateEditExtraField}
                  summary={editFinancialSummary}
                  entryCountLabel={editTitle || editingExpense?.title || '1 expense'}
                  showRemarks={false}
                />
              </div>

              {/* 8. Payment & Settlement Details (PO Compatible) */}
              <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40 space-y-3">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/70 dark:border-slate-800">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-indigo-500" />
                    Payment & Settlement Details
                  </span>
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border uppercase ${
                    editChargesPayment.paymentStatus === 'PAID'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800'
                      : editChargesPayment.paymentStatus === 'PARTIALLY_PAID'
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-400 dark:border-indigo-800'
                      : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800'
                  }`}>
                    {editChargesPayment.paymentStatus || 'PAID'}
                  </span>
                </div>
                <PaymentFieldsSection
                  key={editingExpense.id}
                  paymentStatus={editChargesPayment.paymentStatus || 'PAID'}
                  setPaymentStatus={(val) => handleUpdateEditExtraField('paymentStatus', val)}
                  paidAmount={editChargesPayment.paymentStatus === 'PAID' ? String(editFinancialSummary.grandTotal) : (editChargesPayment.paidAmount ?? '0')}
                  setPaidAmount={(val) => handleUpdateEditExtraField('paidAmount', val)}
                  paymentMode={editChargesPayment.paymentMode || 'CASH'}
                  setPaymentMode={(val) => handleUpdateEditExtraField('paymentMode', val)}
                  paymentRef={editChargesPayment.paymentRef ?? ''}
                  setPaymentRef={(val) => handleUpdateEditExtraField('paymentRef', val)}
                  paymentImage={editChargesPayment.paymentImage ?? null}
                  setPaymentImage={(val) => handleUpdateEditExtraField('paymentImage', val)}
                  paymentNotes={editChargesPayment.paymentNotes ?? ''}
                  setPaymentNotes={(val) => handleUpdateEditExtraField('paymentNotes', val)}
                  totalAmount={editFinancialSummary.grandTotal}
                  isCompact={true}
                />
              </div>

              {/* Attachments */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                    <Paperclip className="w-3 h-3 text-indigo-500" />
                    <span>Attachments ({editAttachments.length})</span>
                  </Label>
                  <label
                    htmlFor="editFileInput"
                    className="cursor-pointer text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Add Files
                  </label>
                  <input
                    type="file"
                    id="editFileInput"
                    multiple
                    accept=".pdf,image/png,image/jpeg,image/webp"
                    onChange={handleUploadEditAttachments}
                    className="hidden"
                  />
                </div>

                {editAttachments.length > 0 && (
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {editAttachments.map((att, aIdx) => (
                      <div
                        key={att.id || aIdx}
                        className="flex items-center justify-between p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-xs"
                      >
                        <span className="font-medium text-slate-800 dark:text-slate-200 truncate mr-2">{att.name || att.originalName}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handlePreviewAttachment(att)}
                            className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800"
                            title="View Attachment"
                          >
                            <Eye className="w-3 h-3" />
                            <span>View</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveEditAttachment(att)}
                            className="p-1 rounded text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingExpense(null)}
                  className="w-1/2 h-8 text-xs font-bold rounded-lg"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="w-1/2 h-8 text-xs font-bold rounded-lg bg-indigo-600 text-white"
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          ATTACHMENT VIEWER & MANAGER MODAL
          ========================================================================= */}
      {viewingAttachmentsExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Paperclip className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    Expense Attachments
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    "{viewingAttachmentsExpense.title}" • ₹{parseFloat(viewingAttachmentsExpense.totalAmount || viewingAttachmentsExpense.amount).toLocaleString('en-IN')}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setViewingAttachmentsExpense(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 max-h-72">
              {(!viewingAttachmentsExpense.attachments || viewingAttachmentsExpense.attachments.length === 0) ? (
                <div className="text-center py-8 text-slate-400">
                  <Paperclip className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700 mb-1" />
                  <p className="text-xs font-semibold">No attachments yet</p>
                </div>
              ) : (
                viewingAttachmentsExpense.attachments.map((file, idx) => {
                  const fullUrl = getFileUrl(file.url);
                  return (
                    <div
                      key={file.id || idx}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="flex items-center gap-3 truncate">
                        <FileText className="w-5 h-5 text-indigo-500 shrink-0" />
                        <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {file.name || file.originalName || 'Document'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handlePreviewAttachment(file)}
                          className="h-7 px-2.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/60 text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 inline-flex items-center gap-1 transition-colors shadow-2xs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View
                        </button>
                        <a
                          href={fullUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="h-7 px-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1"
                          title="Open Original in New Window"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setViewingAttachmentsExpense(null)}
                className="h-8 px-3 rounded-lg"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW EXPENSE DETAILS MODAL
          ========================================================================= */}
      {viewingExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Expense Details
                    </h3>
                    <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
                      {viewingExpense.expenseNumber || 'EXP-000001'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {viewingExpense.date ? new Date(viewingExpense.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'} • {viewingExpense.category}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingExpense(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs overflow-y-auto pr-1 flex-1">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Title / Purpose</span>
                <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">{viewingExpense.title}</p>
              </div>

              {/* Supplier Info if available */}
              {(viewingExpense.isSupplierExpense || viewingExpense.supplierName) && (
                <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900/50 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 uppercase flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5" />
                      Supplier Details
                    </span>
                    {viewingExpense.invoiceNo && (
                      <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-white dark:bg-slate-900 border text-slate-700 dark:text-slate-300">
                        Invoice #{viewingExpense.invoiceNo}
                      </span>
                    )}
                  </div>
                  <p className="font-bold text-slate-900 dark:text-white">{viewingExpense.supplierName || 'Unknown Vendor'}</p>
                  {viewingExpense.supplierGstin && (
                    <p className="font-mono text-[11px] text-slate-600 dark:text-slate-400">GSTIN: {viewingExpense.supplierGstin}</p>
                  )}
                </div>
              )}

              {/* Financial & GST Breakdown Grid */}
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Taxable Value:</span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                    ₹{Number(viewingExpense.taxableAmount || viewingExpense.amount || 0).toFixed(2)}
                  </span>
                </div>

                {/* Additional breakdown charges */}
                {Number(viewingExpense.discountAmount || 0) > 0 && (
                  <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400">
                    <span>Discount:</span>
                    <span className="font-mono font-semibold">-₹{Number(viewingExpense.discountAmount).toFixed(2)}</span>
                  </div>
                )}
                {Number(viewingExpense.shippingAmount || 0) > 0 && (
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                    <span>
                      Shipping {viewingExpense.shippingGstApplicable ? `(GST ${Number(viewingExpense.shippingGstRate ?? 18)}% = +₹${((Number(viewingExpense.shippingAmount) * Number(viewingExpense.shippingGstRate ?? 18)) / 100).toFixed(2)})` : '(No GST)'}:
                    </span>
                    <span className="font-mono">₹{Number(viewingExpense.shippingAmount).toFixed(2)}</span>
                  </div>
                )}
                {Number(viewingExpense.packingAmount || 0) > 0 && (
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                    <span>
                      Packing {viewingExpense.packingGstApplicable ? `(GST ${Number(viewingExpense.packingGstRate ?? 18)}% = +₹${((Number(viewingExpense.packingAmount) * Number(viewingExpense.packingGstRate ?? 18)) / 100).toFixed(2)})` : '(No GST)'}:
                    </span>
                    <span className="font-mono">₹{Number(viewingExpense.packingAmount).toFixed(2)}</span>
                  </div>
                )}
                {Number(viewingExpense.loadingAmount || 0) > 0 && (
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                    <span>
                      Loading & Unloading {viewingExpense.loadingGstApplicable ? `(GST ${Number(viewingExpense.loadingGstRate ?? 18)}% = +₹${((Number(viewingExpense.loadingAmount) * Number(viewingExpense.loadingGstRate ?? 18)) / 100).toFixed(2)})` : '(No GST)'}:
                    </span>
                    <span className="font-mono">₹{Number(viewingExpense.loadingAmount).toFixed(2)}</span>
                  </div>
                )}
                {Number(viewingExpense.otherCharges || 0) > 0 && (
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                    <span>
                      {viewingExpense.otherChargesLabel || 'Other Charges'} {viewingExpense.otherChargesGstApplicable ? `(GST ${Number(viewingExpense.otherChargesGstRate ?? 18)}% = +₹${((Number(viewingExpense.otherCharges) * Number(viewingExpense.otherChargesGstRate ?? 18)) / 100).toFixed(2)})` : '(No GST)'}:
                    </span>
                    <span className="font-mono">₹{Number(viewingExpense.otherCharges).toFixed(2)}</span>
                  </div>
                )}

                {(Number(viewingExpense.gstPercentage || 0) > 0 || (Number(viewingExpense.cgstAmount || 0) + Number(viewingExpense.sgstAmount || 0) + Number(viewingExpense.igstAmount || 0)) > 0) && (
                  <>
                    <div className="flex justify-between items-center text-slate-500 pt-1 border-t border-slate-200/50 dark:border-slate-800/50">
                      <span>GST Mode ({viewingExpense.isInterState ? 'Interstate IGST' : 'Intrastate CGST+SGST'}):</span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                        {Number(viewingExpense.gstPercentage || 0)}% {Number(viewingExpense.gstPercentage || 0) === 0 ? '(Charges GST)' : ''}
                      </span>
                    </div>

                    {viewingExpense.isInterState ? (
                      <div className="flex justify-between items-center text-slate-500">
                        <span>IGST Amount:</span>
                        <span className="font-mono text-slate-700 dark:text-slate-300">
                          ₹{Number(viewingExpense.igstAmount || 0).toFixed(2)}
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between items-center text-slate-500">
                          <span>CGST Amount:</span>
                          <span className="font-mono text-slate-700 dark:text-slate-300">
                            ₹{Number(viewingExpense.cgstAmount || 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-slate-500">
                          <span>SGST Amount:</span>
                          <span className="font-mono text-slate-700 dark:text-slate-300">
                            ₹{Number(viewingExpense.sgstAmount || 0).toFixed(2)}
                          </span>
                        </div>
                      </>
                    )}
                  </>
                )}

                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
                  <span className="font-bold text-slate-900 dark:text-white uppercase text-xs">Grand Total:</span>
                  <span className="text-base font-black font-mono text-indigo-600 dark:text-indigo-400">
                    ₹{Number(viewingExpense.totalAmount || viewingExpense.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Payment Details Section */}
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-indigo-500" />
                    Payment & Settlement
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      viewingExpense.paymentStatus === 'PAID'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                        : viewingExpense.paymentStatus === 'PARTIALLY_PAID'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                        : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                    }`}
                  >
                    {viewingExpense.paymentStatus || 'PAID'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1 text-slate-600 dark:text-slate-400">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Payment Mode:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {getPaymentModeShortLabel(viewingExpense.paymentMode || 'CASH')}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Paid Amount:</span>
                    <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                      ₹{Number(viewingExpense.paidAmount ?? (viewingExpense.paymentStatus === 'UNPAID' ? 0 : (viewingExpense.totalAmount || viewingExpense.amount || 0))).toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Balance Due:</span>
                    <span className="font-bold font-mono text-amber-600 dark:text-amber-400">
                      ₹{Math.max(0, Number(viewingExpense.totalAmount || viewingExpense.amount || 0) - Number(viewingExpense.paidAmount ?? (viewingExpense.paymentStatus === 'UNPAID' ? 0 : (viewingExpense.totalAmount || viewingExpense.amount || 0)))).toFixed(2)}
                    </span>
                  </div>
                  {viewingExpense.paymentRef && (
                    <div className="col-span-2">
                      <span className="text-[10px] text-slate-400 block">Reference / Cheque / UTR:</span>
                      <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {viewingExpense.paymentRef}
                      </span>
                    </div>
                  )}
                  {viewingExpense.paymentNotes && (
                    <div className="col-span-2">
                      <span className="text-[10px] text-slate-400 block">Payment Notes:</span>
                      <span className="text-xs text-slate-700 dark:text-slate-300">
                        {viewingExpense.paymentNotes}
                      </span>
                    </div>
                  )}
                </div>

                {viewingExpense.paymentImage && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Payment Receipt / Proof</span>
                    <button
                      type="button"
                      onClick={() => handlePreviewAttachment({ url: viewingExpense.paymentImage, name: `Receipt-${viewingExpense.expenseNumber || 'EXP'}` })}
                      className="h-7 px-2.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/60 text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 inline-flex items-center gap-1.5 transition-colors shadow-2xs"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View Receipt
                    </button>
                  </div>
                )}
              </div>

              {/* Attachments List */}
              {viewingExpense.attachments?.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Expense Attachments ({viewingExpense.attachments.length})
                  </span>
                  <div className="space-y-1">
                    {viewingExpense.attachments.map((file, idx) => (
                      <div
                        key={file.id || idx}
                        className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between gap-2"
                      >
                        <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          {file.name || file.originalName || 'Document'}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handlePreviewAttachment(file)}
                            className="h-6 px-2 rounded border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 inline-flex items-center gap-1 shadow-2xs"
                          >
                            <Eye className="w-3 h-3" />
                            View
                          </button>
                          <a
                            href={getFileUrl(file.url)}
                            target="_blank"
                            rel="noreferrer"
                            className="h-6 px-1.5 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center"
                            title="Open in New Window"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {viewingExpense.notes && (
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Reference / Notes</span>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                    {viewingExpense.notes}
                  </p>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end shrink-0">
              <Button
                type="button"
                onClick={() => setViewingExpense(null)}
                className="h-8 px-4 text-xs font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          QUICK ADD SUPPLIER MODAL (Opened from SupplierSelect)
          ========================================================================= */}
      {showAddSupplierModal && (
        <QuickAddSupplierModal
          onClose={() => setShowAddSupplierModal(false)}
          onAdded={(newSupplier) => {
            queryClient.invalidateQueries({ queryKey: ['suppliers'] });
            setShowAddSupplierModal(false);
            if (targetRowIdxForNewSupplier !== null) {
              handleUpdateBatchRow(targetRowIdxForNewSupplier, 'supplierSelect', newSupplier);
              setTargetRowIdxForNewSupplier(null);
            }
            if (editingExpense) {
              setValueEdit('supplierId', newSupplier.id);
              setValueEdit('supplierName', newSupplier.name);
              setValueEdit('supplierGstin', newSupplier.gstin || '');
              setValueEdit('isInterState', isInterStateForSupplier(newSupplier));
            }
            showCustomToast('Supplier Added', `${newSupplier.name} registered and selected.`, 'success');
          }}
        />
      )}

      {/* =========================================================================
          IMAGE / ATTACHMENT PREVIEW MODAL (Just like Purchase Order page)
          ========================================================================= */}
      {previewAttachmentUrl && (
        <ImagePreviewModal
          src={previewAttachmentUrl}
          title={previewAttachmentTitle}
          onClose={() => setPreviewAttachmentUrl(null)}
        />
      )}
    </div>
  );
}