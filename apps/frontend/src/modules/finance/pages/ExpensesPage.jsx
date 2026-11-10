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
  isInterStateForSupplier
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
    <div className="flex gap-1.5 w-full items-center">
      <div className="relative flex-1 min-w-0">
        <button
          ref={buttonRef}
          type="button"
          onClick={handleToggle}
          className={`w-full px-2.5 h-8.5 border rounded-xl text-left flex items-center justify-between transition-all duration-150 text-xs shadow-2xs select-none ${
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
          className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 px-2 h-8.5 rounded-xl shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
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
// CSV EXPORT UTILITY FUNCTION
// ==========================================
function downloadExpensesCSV(expensesList, filenamePrefix = 'expenses') {
  if (!expensesList || expensesList.length === 0) {
    showCustomToast('Export Notice', 'No expenses available to export.', 'info');
    return;
  }

  const headers = ['Expense No', 'Date', 'Expense Title', 'Category', 'Supplier', 'Supplier GSTIN', 'Invoice No', 'Payment Mode', 'Payment Status', 'Paid Amount (INR)', 'Taxable (INR)', 'GST %', 'CGST', 'SGST', 'IGST', 'Total Amount (INR)', 'Recorded By', 'Attachments Count', 'Notes'];
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
      `"${item.paymentMode || 'CASH'}"`,
      `"${item.paymentStatus || 'PAID'}"`,
      Number(item.paidAmount || 0).toFixed(2),
      Number(item.taxableAmount || item.amount || 0).toFixed(2),
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

  // Section 4 Financial Summary Individual Extra Charges with Dedicated GST Checkboxes & Rates
  const [batchDiscount, setBatchDiscount] = useState('0');
  const [batchShipping, setBatchShipping] = useState('0');
  const [batchShippingGstApplicable, setBatchShippingGstApplicable] = useState(false);
  const [batchShippingGstPercentage, setBatchShippingGstPercentage] = useState(18);
  const [batchPacking, setBatchPacking] = useState('0');
  const [batchPackingGstApplicable, setBatchPackingGstApplicable] = useState(false);
  const [batchPackingGstPercentage, setBatchPackingGstPercentage] = useState(18);
  const [batchLoading, setBatchLoading] = useState('0');
  const [batchLoadingGstApplicable, setBatchLoadingGstApplicable] = useState(false);
  const [batchLoadingGstPercentage, setBatchLoadingGstPercentage] = useState(18);
  const [batchOtherCharges, setBatchOtherCharges] = useState('0');
  const [batchOtherChargesLabel, setBatchOtherChargesLabel] = useState('Other Charges');
  const [batchOtherChargesGstApplicable, setBatchOtherChargesGstApplicable] = useState(false);
  const [batchOtherChargesGstPercentage, setBatchOtherChargesGstPercentage] = useState(18);
  const [batchRemarks, setBatchRemarks] = useState('');

  // Section 5 Payment & Settlement Details State (PO Compatible)
  const [batchPaymentStatus, setBatchPaymentStatus] = useState('PAID');
  const [batchPaidAmount, setBatchPaidAmount] = useState('0');
  const [batchPaymentMode, setBatchPaymentMode] = useState('CASH');
  const [batchPaymentRef, setBatchPaymentRef] = useState('');
  const [batchPaymentImage, setBatchPaymentImage] = useState(null);
  const [batchPaymentNotes, setBatchPaymentNotes] = useState('');

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
      attachments: []
    };
  }, [activeMasterCategories]);

  const [batchRows, setBatchRows] = useState(() => [
    {
      id: 'row_1',
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
      gstPercentage: 18,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      totalAmount: '',
      isInterState: false,
      hsnSacCode: '',
      notes: '',
      attachments: []
    },
    {
      id: 'row_2',
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
      gstPercentage: 18,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      totalAmount: '',
      isInterState: false,
      hsnSacCode: '',
      notes: '',
      attachments: []
    },
    {
      id: 'row_3',
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
      gstPercentage: 18,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      totalAmount: '',
      isInterState: false,
      hsnSacCode: '',
      notes: '',
      attachments: []
    }
  ]);

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

  // Handlers for Multi-Entry Grid
  const handleOpenMultiModal = () => {
    refetchNextNumber();
    setBatchRows([
      getInitialBatchRow(1),
      getInitialBatchRow(2),
      getInitialBatchRow(3)
    ]);
    setBatchDiscount('0');
    setBatchShipping('0');
    setBatchShippingGstApplicable(false);
    setBatchShippingGstPercentage(18);
    setBatchPacking('0');
    setBatchPackingGstApplicable(false);
    setBatchPackingGstPercentage(18);
    setBatchLoading('0');
    setBatchLoadingGstApplicable(false);
    setBatchLoadingGstPercentage(18);
    setBatchOtherCharges('0');
    setBatchOtherChargesLabel('Other Charges');
    setBatchOtherChargesGstApplicable(false);
    setBatchOtherChargesGstPercentage(18);
    setBatchRemarks('');
    setBatchPaymentStatus('PAID');
    setBatchPaidAmount('0');
    setBatchPaymentMode('CASH');
    setBatchPaymentRef('');
    setBatchPaymentImage(null);
    setBatchPaymentNotes('');
    setIsMultiModalOpen(true);
  };

  const handleCloseMultiModal = () => {
    setIsMultiModalOpen(false);
  };

  const handleAddBatchRow = () => {
    setBatchRows(prev => [...prev, getInitialBatchRow(prev.length + 1)]);
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
  };

  const handleRemoveBatchRow = (idx) => {
    setBatchRows(prev => {
      if (prev.length <= 1) return [getInitialBatchRow(1)];
      return prev.filter((_, i) => i !== idx);
    });
  };

  // Update a field in a batch row with automatic tax / interstate recalculation
  const handleUpdateBatchRow = (idx, field, value) => {
    setBatchRows(prev => {
      const copy = [...prev];
      const target = { ...copy[idx] };

      if (field === 'categorySelect') {
        const selectedMaster = activeMasterCategories.find(c => c.id === value || c.name === value);
        target.categoryId = selectedMaster ? selectedMaster.id : '';
        target.category = selectedMaster ? selectedMaster.name : value;

        // Auto-detect if category requires / defaults to supplier
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

      // Recompute Tax and Total for row
      const taxable = parseFloat(target.taxableAmount) || 0;
      const gstRate = target.isSupplierExpense ? (parseFloat(target.gstPercentage) || 0) : 0;
      const totalGst = (taxable * gstRate) / 100;

      if (target.isInterState) {
        target.igstAmount = totalGst;
        target.cgstAmount = 0;
        target.sgstAmount = 0;
      } else {
        target.cgstAmount = totalGst / 2;
        target.sgstAmount = totalGst / 2;
        target.igstAmount = 0;
      }

      target.totalAmount = taxable + totalGst;

      copy[idx] = target;
      return copy;
    });
  };

  // Section 4 Financial Summary Calculations (Charges & Taxes)
  const financialSummary = useMemo(() => {
    let itemsSubtotal = 0;
    let totalTaxableValue = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    let validCount = 0;

    const dummyItemsForBreakdown = [];

    batchRows.forEach((row, i) => {
      const taxable = parseFloat(row.taxableAmount) || 0;
      const isTitleFilled = row.title && row.title.trim().length > 0;
      const isCatValid = Boolean(row.category || row.categoryId);

      if (taxable > 0 && isTitleFilled && isCatValid) {
        validCount++;
        itemsSubtotal += taxable;
        totalTaxableValue += taxable;

        const rate = row.isSupplierExpense ? (Number(row.gstPercentage) || 0) : 0;
        const gstAmount = (taxable * rate) / 100;

        if (row.isInterState) {
          totalIgst += gstAmount;
        } else {
          totalCgst += gstAmount / 2;
          totalSgst += gstAmount / 2;
        }

        dummyItemsForBreakdown.push({
          id: row.id,
          name: row.title || `Expense #${i + 1}`,
          subtotal: taxable,
          quantity: 1,
          unitPrice: taxable,
          gstApplicable: rate > 0,
          gstPercentage: rate
        });
      }
    });

    const shipping = Number(batchShipping) || 0;
    const packing = Number(batchPacking) || 0;
    const loading = Number(batchLoading) || 0;
    const otherCharges = Number(batchOtherCharges) || 0;
    const discount = Number(batchDiscount) || 0;

    const shippingGst = batchShippingGstApplicable && shipping > 0 ? (shipping * Number(batchShippingGstPercentage) / 100) : 0;
    const packingGst = batchPackingGstApplicable && packing > 0 ? (packing * Number(batchPackingGstPercentage) / 100) : 0;
    const loadingGst = batchLoadingGstApplicable && loading > 0 ? (loading * Number(batchLoadingGstPercentage) / 100) : 0;
    const otherGst = batchOtherChargesGstApplicable && otherCharges > 0 ? (otherCharges * Number(batchOtherChargesGstPercentage) / 100) : 0;

    const hasAnyInterstate = batchRows.some(r => r.isSupplierExpense && r.isInterState);

    const chargesList = [];
    if (shipping > 0) {
      chargesList.push({
        label: 'Shipping / Freight',
        value: shipping,
        applied: true,
        gstApplicable: batchShippingGstApplicable,
        rate: batchShippingGstPercentage
      });
    }
    if (packing > 0) {
      chargesList.push({
        label: 'Packing Charges',
        value: packing,
        applied: true,
        gstApplicable: batchPackingGstApplicable,
        rate: batchPackingGstPercentage
      });
    }
    if (loading > 0) {
      chargesList.push({
        label: 'Loading & Unloading',
        value: loading,
        applied: true,
        gstApplicable: batchLoadingGstApplicable,
        rate: batchLoadingGstPercentage
      });
    }
    if (otherCharges > 0) {
      chargesList.push({
        label: batchOtherChargesLabel || 'Other Charges',
        value: otherCharges,
        applied: true,
        gstApplicable: batchOtherChargesGstApplicable,
        rate: batchOtherChargesGstPercentage
      });
    }

    const gstBreakdown = calculateGstBreakdown({
      items: dummyItemsForBreakdown,
      charges: chargesList,
      isInterState: hasAnyInterstate
    });

    const totalChargesTaxes = shippingGst + packingGst + loadingGst + otherGst;
    const totalExtraCharges = shipping + packing + loading + otherCharges;
    const totalTaxes = totalCgst + totalSgst + totalIgst + totalChargesTaxes;
    const unroundedGrandTotal = Math.max(0, itemsSubtotal + totalTaxes + totalExtraCharges - discount);
    const grandTotal = Math.round(unroundedGrandTotal);
    const roundOff = Number((grandTotal - unroundedGrandTotal).toFixed(2));

    return {
      validCount,
      itemsSubtotal,
      totalTaxableValue,
      totalCgst,
      totalSgst,
      totalIgst,
      shipping,
      shippingGst,
      packing,
      packingGst,
      loading,
      loadingGst,
      otherCharges,
      otherGst,
      totalChargesTaxes,
      totalExtraCharges,
      totalTaxes,
      hasAnyInterstate,
      grandTotal,
      roundOff,
      discount,
      gstBreakdown,
      chargesList,
      dummyItemsForBreakdown
    };
  }, [
    batchRows,
    batchShipping,
    batchShippingGstApplicable,
    batchShippingGstPercentage,
    batchPacking,
    batchPackingGstApplicable,
    batchPackingGstPercentage,
    batchLoading,
    batchLoadingGstApplicable,
    batchLoadingGstPercentage,
    batchOtherCharges,
    batchOtherChargesLabel,
    batchOtherChargesGstApplicable,
    batchOtherChargesGstPercentage,
    batchDiscount
  ]);

  // Synchronize paid amount when grand total changes and status is PAID
  useEffect(() => {
    if (batchPaymentStatus === 'PAID') {
      setBatchPaidAmount(financialSummary.grandTotal.toString());
    }
  }, [financialSummary.grandTotal, batchPaymentStatus]);

  // Save Batch Expenses to Database
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

    const payload = validRows.map(row => {
      const taxable = parseFloat(row.taxableAmount) || 0;
      const rate = row.isSupplierExpense ? (parseFloat(row.gstPercentage) || 0) : 0;
      const totalGst = (taxable * rate) / 100;
      const cgst = row.isInterState ? 0 : totalGst / 2;
      const sgst = row.isInterState ? 0 : totalGst / 2;
      const igst = row.isInterState ? totalGst : 0;
      const total = taxable + totalGst;

      return {
        date: row.date,
        categoryId: row.categoryId || undefined,
        category: row.category,
        title: row.title.trim(),
        amount: total,
        taxableAmount: taxable,
        isSupplierExpense: Boolean(row.isSupplierExpense),
        supplierId: row.supplierId || row.selectedSupplier?.id || null,
        supplierName: row.supplierName || row.selectedSupplier?.name || null,
        supplierGstin: row.supplierGstin || row.selectedSupplier?.gstin || null,
        invoiceNo: row.invoiceNo ? row.invoiceNo.trim() : null,
        invoiceDate: row.invoiceDate ? row.invoiceDate : null,
        gstPercentage: rate,
        cgstAmount: cgst,
        sgstAmount: sgst,
        igstAmount: igst,
        totalAmount: total,
        isInterState: Boolean(row.isInterState),
        hsnSacCode: row.hsnSacCode ? row.hsnSacCode.trim() : null,
        notes: [row.notes, batchRemarks].filter(Boolean).join(' | ') || null,
        attachments: row.attachments && row.attachments.length > 0 ? row.attachments : undefined,
        // Payment settlement fields (from Section 5)
        paymentMode: batchPaymentMode,
        paymentStatus: batchPaymentStatus,
        paidAmount: parseFloat(batchPaidAmount) || (batchPaymentStatus === 'PAID' ? total : 0),
        paymentRef: batchPaymentRef || null,
        paymentImage: batchPaymentImage || null,
        paymentNotes: batchPaymentNotes || null,
        // Individual charges breakdown with tax rates
        shippingAmount: Number(batchShipping) || 0,
        shippingGstApplicable: batchShippingGstApplicable,
        shippingGstRate: batchShippingGstPercentage,
        packingAmount: Number(batchPacking) || 0,
        packingGstApplicable: batchPackingGstApplicable,
        packingGstRate: batchPackingGstPercentage,
        loadingAmount: Number(batchLoading) || 0,
        loadingGstApplicable: batchLoadingGstApplicable,
        loadingGstRate: batchLoadingGstPercentage,
        otherCharges: Number(batchOtherCharges) || 0,
        otherChargesGstApplicable: batchOtherChargesGstApplicable,
        otherChargesGstRate: batchOtherChargesGstPercentage,
        discountAmount: Number(batchDiscount) || 0
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
      notes: expense.notes || '',
      // Payment fields
      paymentMode: expense.paymentMode || 'CASH',
      paymentStatus: expense.paymentStatus || 'PAID',
      paidAmount: expense.paidAmount != null ? Number(expense.paidAmount) : Number(expense.totalAmount || expense.amount),
      paymentRef: expense.paymentRef || '',
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

  // Submit Edit Form
  const onEditSubmit = (data) => {
    if (editingExpense) {
      const selectedCat = activeMasterCategories.find(c => c.id === data.categoryId || c.name === data.category);
      const taxable = parseFloat(data.taxableAmount) || 0;
      const rate = data.isSupplierExpense ? (parseFloat(data.gstPercentage) || 0) : 0;
      const totalGst = (taxable * rate) / 100;
      const isInter = Boolean(data.isInterState);
      const cgst = isInter ? 0 : totalGst / 2;
      const sgst = isInter ? 0 : totalGst / 2;
      const igst = isInter ? totalGst : 0;
      const total = taxable + totalGst;

      updateMutation.mutate({
        id: editingExpense.id,
        data: {
          expenseNumber: data.expenseNumber || undefined,
          date: data.date,
          category: selectedCat ? selectedCat.name : data.category,
          categoryId: selectedCat ? selectedCat.id : data.categoryId,
          title: data.title,
          amount: total,
          taxableAmount: taxable,
          isSupplierExpense: Boolean(data.isSupplierExpense),
          supplierId: data.supplierId || null,
          supplierName: data.supplierName || null,
          supplierGstin: data.supplierGstin || null,
          invoiceNo: data.invoiceNo || null,
          invoiceDate: data.invoiceDate || null,
          gstPercentage: rate,
          cgstAmount: cgst,
          sgstAmount: sgst,
          igstAmount: igst,
          totalAmount: total,
          isInterState: isInter,
          hsnSacCode: data.hsnSacCode || null,
          notes: data.notes || null,
          attachments: editAttachments,
          // Payment fields
          paymentMode: data.paymentMode || 'CASH',
          paymentStatus: data.paymentStatus || 'PAID',
          paidAmount: parseFloat(data.paidAmount) || (data.paymentStatus === 'PAID' ? total : 0),
          paymentRef: data.paymentRef || null,
          paymentNotes: data.paymentNotes || null
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
    <div className="p-3 sm:p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            <span>Finance</span>
            <span>/</span>
            <span>Expenses</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2 mt-0.5">
            <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900">
              <DollarSign className="w-5 h-5 stroke-[2.5]" />
            </span>
            Expenses Management
          </h1>
        </div>

        <div className="flex items-center flex-wrap gap-2">
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
            className="h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            + Add Expenses
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <Card className="rounded-xl border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-2xs">
          <CardContent className="p-3 sm:p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Expenses</p>
              <h3 className="text-xl sm:text-2xl font-black font-mono text-slate-900 dark:text-white mt-0.5">
                ₹{summary?.total ? summary.total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">{expenses.length} total entries</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-900">
              <Layers className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-2xs">
          <CardContent className="p-3 sm:p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">This Month's Spend</p>
              <h3 className="text-xl sm:text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                ₹{summary?.monthly ? summary.monthly.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
              </h3>
              <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">Current cycle</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100 dark:border-emerald-900">
              <TrendingUp className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-2xs">
          <CardContent className="p-3 sm:p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Supplier Tagged</p>
              <h3 className="text-xl sm:text-2xl font-black font-mono text-purple-600 dark:text-purple-400 mt-0.5">
                {expenses.filter(e => e.isSupplierExpense || e.supplierId || e.supplierName).length}
              </h3>
              <p className="text-[10px] text-purple-500/80 dark:text-purple-400/80 mt-0.5">With vendor invoices</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-100 dark:border-purple-900">
              <Building2 className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-2xs">
          <CardContent className="p-3 sm:p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Top Cost Center</p>
              <h3 className="text-sm sm:text-base font-black text-amber-600 dark:text-amber-400 mt-0.5 truncate max-w-[130px]">
                {summary?.categoryBreakdown && summary.categoryBreakdown.length > 0
                  ? summary.categoryBreakdown.sort((a, b) => b.amount - a.amount)[0]?.category
                  : 'None'}
              </h3>
              <p className="text-[10px] text-amber-500/80 dark:text-amber-400/80 mt-0.5">Highest volume</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-100 dark:border-amber-900">
              <CreditCard className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Control Bar */}
      <div className="p-2.5 sm:p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 text-xs">
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

      {/* Main Content: Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Left Side (3 Columns): Expenses Table */}
        <div className="lg:col-span-3 space-y-3">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-2xs overflow-hidden">
            {isListLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full rounded-lg" />
                ))}
              </div>
            ) : sortedExpenses.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                <CreditCard className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                <p className="font-bold text-sm text-slate-600 dark:text-slate-300">No expense records found</p>
                <p className="mt-1">Click "+ Add Expenses" to record expenses with supplier details and GST breakdown.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="text-xs">
                  <TableHeader className="bg-slate-50/70 dark:bg-slate-950/70 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <TableRow className="border-b border-slate-100 dark:border-slate-800">
                      <TableHead className="w-8 py-2 text-center">
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
                        className="w-24 font-bold text-slate-600 dark:text-slate-300 py-2 cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-1">
                          <span>Date</span>
                          <ArrowUpDown className="w-2.5 h-2.5 text-slate-400" />
                        </div>
                      </TableHead>

                      <TableHead
                        onClick={() => handleSortToggle('expenseNumber')}
                        className="w-28 font-bold text-slate-600 dark:text-slate-300 py-2 cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-1">
                          <span>Expense #</span>
                          <ArrowUpDown className="w-2.5 h-2.5 text-slate-400" />
                        </div>
                      </TableHead>

                      <TableHead
                        onClick={() => handleSortToggle('category')}
                        className="w-32 font-bold text-slate-600 dark:text-slate-300 py-2 cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-1">
                          <span>Category</span>
                          <ArrowUpDown className="w-2.5 h-2.5 text-slate-400" />
                        </div>
                      </TableHead>

                      <TableHead
                        onClick={() => handleSortToggle('title')}
                        className="min-w-[170px] font-bold text-slate-600 dark:text-slate-300 py-2 cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-1">
                          <span>Title / Purpose</span>
                          <ArrowUpDown className="w-2.5 h-2.5 text-slate-400" />
                        </div>
                      </TableHead>

                      {/* Supplier Column */}
                      <TableHead className="min-w-[170px] font-bold text-slate-600 dark:text-slate-300 py-2">
                        Supplier / Vendor
                      </TableHead>

                      {/* Taxable Amount */}
                      <TableHead className="w-24 text-right font-bold text-slate-600 dark:text-slate-300 py-2">
                        Taxable (₹)
                      </TableHead>

                      {/* GST Breakdown */}
                      <TableHead className="w-28 text-center font-bold text-slate-600 dark:text-slate-300 py-2">
                        GST Breakdown
                      </TableHead>

                      {/* Grand Total */}
                      <TableHead
                        onClick={() => handleSortToggle('amount')}
                        className="w-28 text-right font-bold text-slate-600 dark:text-slate-300 py-2 cursor-pointer select-none"
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Grand Total (₹)</span>
                          <ArrowUpDown className="w-2.5 h-2.5 text-slate-400" />
                        </div>
                      </TableHead>

                      {/* Payment Status & Mode */}
                      <TableHead className="w-28 text-center font-bold text-slate-600 dark:text-slate-300 py-2">
                        Payment
                      </TableHead>

                      <TableHead className="min-w-[120px] font-bold text-slate-600 dark:text-slate-300 py-2">
                        Ref / Notes
                      </TableHead>

                      <TableHead className="w-24 text-center font-bold text-slate-600 dark:text-slate-300 py-2">
                        Attachments
                      </TableHead>

                      <TableHead className="w-20 text-right font-bold text-slate-600 dark:text-slate-300 py-2 pr-3">
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

                      return (
                        <TableRow
                          key={exp.id}
                          className={`transition-colors ${
                            isSelected
                              ? 'bg-indigo-50/50 dark:bg-indigo-950/30'
                              : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/30'
                          }`}
                        >
                          <TableCell className="text-center py-2">
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

                          {/* 1. Date */}
                          <TableCell className="font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap text-[11px]">
                            {new Date(exp.date).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </TableCell>

                          {/* 1b. Running Expense Number */}
                          <TableCell className="whitespace-nowrap font-mono text-[11px]">
                            <span className="font-bold text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-md bg-indigo-50/80 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800/80 shadow-2xs">
                              {exp.expenseNumber || 'EXP-—'}
                            </span>
                          </TableCell>

                          {/* 2. Category */}
                          <TableCell className="whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${catMeta.bg}`}>
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: catMeta.color }} />
                              {catMeta.label}
                            </span>
                          </TableCell>

                          {/* 3. Title / Purpose */}
                          <TableCell className="max-w-[190px]">
                            <div className="font-bold text-slate-900 dark:text-slate-100 truncate text-xs">
                              {exp.title}
                            </div>
                            {exp.hsnSacCode && (
                              <div className="text-[10px] text-slate-400 font-mono">SAC: {exp.hsnSacCode}</div>
                            )}
                          </TableCell>

                          {/* 4. Supplier / Vendor */}
                          <TableCell className="max-w-[190px]">
                            {hasSupplier ? (
                              <div className="space-y-0.5">
                                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1 truncate text-xs">
                                  <Building2 className="w-3 h-3 text-indigo-500 shrink-0" />
                                  <span className="truncate">{exp.supplierName || 'Vendor Assigned'}</span>
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {exp.supplierGstin && (
                                    <span className="font-mono text-[9px] px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                      {exp.supplierGstin}
                                    </span>
                                  )}
                                  {exp.invoiceNo && (
                                    <span className="font-mono text-[9px] px-1 py-0.2 rounded bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                      Inv #{exp.invoiceNo}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[11px] italic">Internal (No Supplier)</span>
                            )}
                          </TableCell>

                          {/* 5. Taxable Amount */}
                          <TableCell className="text-right font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap text-xs">
                            ₹{Number(exp.taxableAmount || exp.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>

                          {/* 6. GST Breakdown */}
                          <TableCell className="text-center whitespace-nowrap">
                            {gstRate > 0 ? (
                              <div className="space-y-0.5">
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  exp.isInterState
                                    ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                    : 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                                }`}>
                                  {exp.isInterState ? `IGST ${gstRate}%` : `CGST+SGST ${gstRate}%`}
                                </span>
                                <div className="text-[10px] font-mono text-slate-500">
                                  +₹{Number((exp.cgstAmount || 0) + (exp.sgstAmount || 0) + (exp.igstAmount || 0)).toFixed(2)}
                                </div>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-mono">0% GST</span>
                            )}
                          </TableCell>

                          {/* 7. Grand Total Amount */}
                          <TableCell className="text-right font-bold font-mono text-slate-900 dark:text-white whitespace-nowrap text-xs">
                            ₹{Number(exp.totalAmount || exp.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>

                          {/* 7b. Payment Status & Mode */}
                          <TableCell className="text-center whitespace-nowrap">
                            <div className="space-y-0.5">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                                exp.paymentStatus === 'PAID'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                                  : exp.paymentStatus === 'PARTIALLY_PAID'
                                  ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800'
                                  : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                              }`}>
                                {exp.paymentStatus === 'PAID' ? 'PAID' : exp.paymentStatus === 'PARTIALLY_PAID' ? 'PARTIAL' : 'UNPAID'}
                              </span>
                              <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1">
                                <CreditCard className="w-2.5 h-2.5 text-slate-400" />
                                <span>{PAYMENT_MODES.find(m => m.id === exp.paymentMode)?.label?.split(' ')[0] || exp.paymentMode || 'Cash'}</span>
                              </div>
                            </div>
                          </TableCell>

                          {/* 8. Notes */}
                          <TableCell className="max-w-[130px] truncate text-[11px] text-slate-500 dark:text-slate-400">
                            {exp.notes || <span className="text-slate-300 dark:text-slate-600 italic">—</span>}
                          </TableCell>

                          {/* 9. Attachments */}
                          <TableCell className="text-center whitespace-nowrap">
                            {attachmentsCount > 0 ? (
                              <button
                                type="button"
                                onClick={() => setViewingAttachmentsExpense(exp)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition-colors"
                              >
                                <Paperclip className="w-2.5 h-2.5" />
                                <span>{attachmentsCount} {attachmentsCount === 1 ? 'file' : 'files'}</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setViewingAttachmentsExpense(exp)}
                                className="text-[10px] text-slate-400 hover:text-indigo-600 transition-colors inline-flex items-center gap-0.5"
                              >
                                <Paperclip className="w-2.5 h-2.5 opacity-60" />
                                <span>+ Add</span>
                              </button>
                            )}
                          </TableCell>

                          {/* 10. Actions */}
                          <TableCell className="text-right py-1.5 pr-3 space-x-0.5 whitespace-nowrap">
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
        </div>

        {/* Right Side (1 Column): Charts */}
        <div className="space-y-3">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3 shadow-2xs">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 pb-2 border-b border-slate-100 dark:border-slate-800">
              <PieChartIcon className="w-3.5 h-3.5 text-indigo-500" />
              Category Breakdown
            </h4>

            {isSummaryLoading ? (
              <div className="h-44 flex items-center justify-center">
                <Skeleton className="w-28 h-28 rounded-full" />
              </div>
            ) : chartData.length === 0 ? (
              <div className="h-44 flex flex-col items-center justify-center text-slate-400 text-xs text-center p-2">
                <PieChartIcon className="w-8 h-8 mb-1 text-slate-300 dark:text-slate-700" />
                <span>No expense data to chart</span>
              </div>
            ) : (
              <div className="h-44 w-full text-xs">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={65}
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
                      wrapperStyle={{ fontSize: '9px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3 shadow-2xs space-y-2">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 pb-2 border-b border-slate-100 dark:border-slate-800">
              <BarChart3 className="w-3.5 h-3.5 text-emerald-500" />
              Top Cost Centers
            </h4>

            {chartData.length === 0 ? (
              <div className="text-center py-4 text-xs text-slate-400 italic">
                No records yet
              </div>
            ) : (
              chartData
                .sort((a, b) => b.value - a.value)
                .slice(0, 5)
                .map((item, idx) => {
                  const maxVal = Math.max(...chartData.map(c => c.value), 1);
                  const pct = Math.round((item.value / maxVal) * 100);
                  return (
                    <div key={idx} className="space-y-1 text-[11px]">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[120px]">{item.name}</span>
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
                })
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          FAST MULTI-ENTRY GRID MODAL WITH STYLISH SUPPLIER SELECT & CHARGES SUMMARY (SECTION 4)
          FULL SCREEN & FULLY RESPONSIVE FOR ALL DEVICES WITHOUT COLLAPSE
          ========================================================================= */}
      {isMultiModalOpen && (
        <div className={`fixed inset-0 z-50 flex ${isMultiModalFullScreen ? 'p-0' : 'items-center justify-center p-2 sm:p-4'} bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200`}>
          <div className={`bg-white dark:bg-slate-900 ${isMultiModalFullScreen ? 'w-screen h-screen rounded-none' : 'rounded-2xl w-full max-w-[96vw] xl:max-w-7xl max-h-[96vh]'} flex flex-col border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden transition-all duration-200`}>
            {/* Modal Header */}
            <div className="px-4 sm:px-6 py-3 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-sm">
                  <CreditCard className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                    Record Expenses (Multi-Entry Grid)
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                      SUPPLIER & GST ENABLED
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-mono">
                      FULL SCREEN ENTERPRISE
                    </span>
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-mono flex items-center gap-1 shadow-2xs">
                      <Hash className="w-3 h-3 text-purple-500" />
                      Next No: {candidateExpenseNumber}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Add expenses with supplier lookup, invoice number, and full GST breakdown just like Purchase Orders.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsMultiModalFullScreen(!isMultiModalFullScreen)}
                  className="h-8 px-2.5 rounded-xl border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold flex items-center gap-1.5"
                  title={isMultiModalFullScreen ? "Exit Fullscreen (Windowed View)" : "Maximize to Fullscreen"}
                >
                  {isMultiModalFullScreen ? (
                    <>
                      <Minimize2 className="w-3.5 h-3.5 text-indigo-500" />
                      <span className="hidden sm:inline">Exit Fullscreen</span>
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
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Close Window (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Quick Action Bar */}
            <div className="px-4 sm:px-6 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 flex flex-wrap items-center justify-between gap-2.5 text-xs shrink-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddBatchRow}
                  className="h-7.5 px-3 rounded-xl border-indigo-200 dark:border-indigo-800/80 font-bold text-xs bg-indigo-50/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  + Add 1 Row
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAddMultipleBatchRows(3)}
                  className="h-7.5 px-3 rounded-xl border-slate-200 dark:border-slate-700 font-bold text-xs hover:border-indigo-300"
                >
                  <PlusCircle className="w-3.5 h-3.5 mr-1 text-slate-400" />
                  + Add 3 Rows
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAddMultipleBatchRows(5)}
                  className="h-7.5 px-3 rounded-xl border-slate-200 dark:border-slate-700 font-bold text-xs hover:border-indigo-300 hidden sm:inline-flex"
                >
                  <PlusCircle className="w-3.5 h-3.5 mr-1 text-slate-400" />
                  + Add 5 Rows
                </Button>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs text-slate-500">
                  Ready: <strong className="text-slate-900 dark:text-white font-mono">{financialSummary.validCount}</strong> of {batchRows.length} rows
                </span>
                <span className="px-3 py-1 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/80 dark:to-purple-950/80 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-mono font-black text-xs sm:text-sm shadow-2xs">
                  Grand Total: ₹{financialSummary.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Scrollable Content: Spreadsheet Grid + Section 4 Charges & Financial Summary */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-5">
              {/* Spreadsheet Grid Table with permanently pinned sticky header */}
              <div 
                className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-auto shadow-sm bg-white dark:bg-slate-900"
                style={{
                  maxHeight: isMultiModalFullScreen ? 'calc(100vh - 460px)' : '480px',
                  minHeight: '260px'
                }}
              >
                <table className="w-full text-left text-xs min-w-[1540px]">
                  <thead className="bg-slate-100/95 dark:bg-slate-950/95 backdrop-blur-sm border-b-2 border-slate-200 dark:border-slate-800 text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider sticky top-0 z-20 shadow-xs">
                    <tr>
                      <th className="w-12 px-2.5 py-3 text-center">#</th>
                      <th className="w-36 px-2.5 py-3">Date *</th>
                      <th className="w-56 min-w-[200px] px-2.5 py-3">Category *</th>
                      <th className="w-32 px-2.5 py-3 text-center">With Supplier?</th>
                      <th className="w-80 min-w-[280px] px-2.5 py-3">Supplier / Vendor</th>
                      <th className="w-72 min-w-[220px] px-2.5 py-3">Title / Purpose *</th>
                      <th className="w-36 px-2.5 py-3">Invoice #</th>
                      <th className="w-36 px-2.5 py-3 text-right">Taxable (₹) *</th>
                      <th className="w-28 px-2.5 py-3 text-center">GST %</th>
                      <th className="w-36 px-2.5 py-3 text-right">Total (₹)</th>
                      <th className="w-24 px-2.5 py-3 text-center">Files</th>
                      <th className="w-24 px-2.5 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900">
                    {batchRows.map((row, idx) => {
                      const isSupp = Boolean(row.isSupplierExpense);
                      return (
                        <tr key={row.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/20 transition-colors">
                          <td className="px-2.5 py-2.5 text-center font-mono font-bold text-slate-400 text-xs">
                            {idx + 1}
                          </td>

                          {/* 1. Date */}
                          <td className="px-1.5 py-2">
                            <input
                              type="date"
                              value={row.date}
                              onChange={(e) => handleUpdateBatchRow(idx, 'date', e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                            />
                          </td>

                          {/* 2. Category (Expense Master) */}
                          <td className="px-1.5 py-2">
                            <select
                              value={row.categoryId || row.category}
                              onChange={(e) => handleUpdateBatchRow(idx, 'categorySelect', e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold truncate"
                            >
                              {activeMasterCategories.map(cat => (
                                <option key={cat.id || cat.name} value={cat.id || cat.name}>
                                  {cat.name} {cat.expenseWithSupplier ? '(Supplier Tagged)' : ''}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* 3. With Supplier Checkbox Toggle */}
                          <td className="px-1.5 py-2 text-center">
                            <label className="inline-flex items-center gap-1.5 cursor-pointer select-none px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:border-indigo-400 transition-colors">
                              <input
                                type="checkbox"
                                checked={isSupp}
                                onChange={(e) => handleUpdateBatchRow(idx, 'isSupplierExpense', e.target.checked)}
                                className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-600 cursor-pointer"
                              />
                              <span className={`text-[10px] font-bold ${isSupp ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>
                                {isSupp ? 'YES' : 'NO'}
                              </span>
                            </label>
                          </td>

                          {/* 4. Ultra-Stylish Searchable Supplier Dropdown */}
                          <td className="px-1.5 py-2">
                            {isSupp ? (
                              <SupplierSelect
                                suppliers={suppliers}
                                value={row.selectedSupplier}
                                onChange={(s) => handleUpdateBatchRow(idx, 'supplierSelect', s)}
                                onAddNew={() => {
                                  setTargetRowIdxForNewSupplier(idx);
                                  setShowAddSupplierModal(true);
                                }}
                                placeholder="Search & select supplier..."
                                isInterStateForSupplier={isInterStateForSupplier}
                              />
                            ) : (
                              <span className="text-slate-400 dark:text-slate-500 italic text-[11px] px-2 block">Internal (No Vendor)</span>
                            )}
                          </td>

                          {/* 5. Title / Purpose */}
                          <td className="px-1.5 py-2">
                            <input
                              type="text"
                              placeholder="e.g. Server hosting, Maintenance, Machinery repair..."
                              value={row.title}
                              onChange={(e) => handleUpdateBatchRow(idx, 'title', e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                            />
                          </td>

                          {/* 6. Invoice No */}
                          <td className="px-1.5 py-2">
                            <input
                              type="text"
                              placeholder={isSupp ? "e.g. INV-9921" : "Optional"}
                              value={row.invoiceNo}
                              onChange={(e) => handleUpdateBatchRow(idx, 'invoiceNo', e.target.value)}
                              className="w-full px-2 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
                            />
                          </td>

                          {/* 7. Taxable Amount (₹) */}
                          <td className="px-1.5 py-2">
                            <input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={row.taxableAmount}
                              onChange={(e) => handleUpdateBatchRow(idx, 'taxableAmount', e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono font-bold text-right"
                            />
                          </td>

                          {/* 8. GST % Selector */}
                          <td className="px-1.5 py-2 text-center">
                            {isSupp ? (
                              <select
                                value={row.gstPercentage}
                                onChange={(e) => handleUpdateBatchRow(idx, 'gstPercentage', Number(e.target.value))}
                                className="w-full px-1.5 py-1.5 text-xs rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-950 text-indigo-700 dark:text-indigo-300 font-bold focus:outline-none text-center"
                              >
                                <option value={0}>0%</option>
                                <option value={5}>5%</option>
                                <option value={12}>12%</option>
                                <option value={18}>18%</option>
                                <option value={28}>28%</option>
                              </select>
                            ) : (
                              <span className="text-[11px] text-slate-400 font-mono">0%</span>
                            )}
                          </td>

                          {/* 9. Grand Total (Taxable + GST) */}
                          <td className="px-2.5 py-2 text-right font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                            ₹{(Number(row.totalAmount || row.taxableAmount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>

                          {/* 10. Attachments */}
                          <td className="px-1.5 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => setRowAttachmentModalIdx(idx)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold inline-flex items-center gap-1 border transition-all ${
                                row.attachments && row.attachments.length > 0
                                  ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                                  : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                              }`}
                            >
                              <Paperclip className="w-3 h-3" />
                              <span>{row.attachments?.length || 0}</span>
                            </button>
                          </td>

                          {/* 11. Actions */}
                          <td className="px-1.5 py-2 text-center whitespace-nowrap space-x-1">
                            <button
                              type="button"
                              onClick={() => handleDuplicateBatchRow(idx)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              title="Duplicate Row"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveBatchRow(idx)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              title="Delete Row"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* 🌟 SECTION 4: CHARGES & FINANCIAL SUMMARY (IDENTICAL TO /purchase-orders/create) */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4 w-full">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-indigo-500" />
                    4. Charges & Financial Summary
                  </span>
                  <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    INR (₹)
                  </span>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-6 items-start">
                  {/* Left Column (7 cols): Additional Charges Inputs & Remarks */}
                  <div className="xl:col-span-7 space-y-4">
                    {/* Individual Charges Cards with Individual GST Checkbox & Rates */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-2.5 sm:gap-3">
                      {/* 1. Discount */}
                      <div className="space-y-1.5 p-2.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                        <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">Discount (₹)</Label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-600 dark:text-emerald-400 select-none">₹</span>
                          <Input 
                            type="number" 
                            min="0"
                            value={batchDiscount} 
                            onChange={(e) => setBatchDiscount(e.target.value)}
                            className="h-8.5 text-xs pl-6 rounded-lg bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 hover:border-emerald-400 focus:border-emerald-600 font-semibold shadow-2xs" 
                          />
                        </div>
                      </div>

                      {/* 2. Shipping & Freight */}
                      <div className="space-y-1.5 p-2.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Shipping (₹)</Label>
                          <label className="inline-flex items-center gap-1 cursor-pointer select-none">
                            <input 
                              type="checkbox" 
                              checked={batchShippingGstApplicable} 
                              onChange={(e) => setBatchShippingGstApplicable(e.target.checked)}
                              className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 cursor-pointer"
                            />
                            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">GST</span>
                          </label>
                        </div>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-indigo-600 dark:text-indigo-400 select-none">₹</span>
                          <Input 
                            type="number" 
                            min="0"
                            value={batchShipping} 
                            onChange={(e) => setBatchShipping(e.target.value)}
                            className="h-8.5 text-xs pl-6 rounded-lg bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 hover:border-indigo-400 focus:border-indigo-600 font-semibold shadow-2xs" 
                          />
                        </div>
                        {batchShippingGstApplicable && (
                          <div className="flex items-center justify-between gap-1 pt-1">
                            <span className="text-[10px] text-slate-500 font-semibold">Rate:</span>
                            <select
                              value={batchShippingGstPercentage}
                              onChange={(e) => setBatchShippingGstPercentage(Number(e.target.value))}
                              className="h-6 text-[11px] px-1.5 rounded-md border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 font-bold focus:outline-none"
                            >
                              <option value={0}>0%</option>
                              <option value={5}>5%</option>
                              <option value={12}>12%</option>
                              <option value={18}>18%</option>
                              <option value={28}>28%</option>
                            </select>
                            {Number(batchShipping) > 0 && (
                              <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                                +₹{(Number(batchShipping) * batchShippingGstPercentage / 100).toFixed(2)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* 3. Packing Charges */}
                      <div className="space-y-1.5 p-2.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Packing (₹)</Label>
                          <label className="inline-flex items-center gap-1 cursor-pointer select-none">
                            <input 
                              type="checkbox" 
                              checked={batchPackingGstApplicable} 
                              onChange={(e) => setBatchPackingGstApplicable(e.target.checked)}
                              className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 cursor-pointer"
                            />
                            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">GST</span>
                          </label>
                        </div>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-indigo-600 dark:text-indigo-400 select-none">₹</span>
                          <Input 
                            type="number" 
                            min="0"
                            value={batchPacking} 
                            onChange={(e) => setBatchPacking(e.target.value)}
                            className="h-8.5 text-xs pl-6 rounded-lg bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 hover:border-indigo-400 focus:border-indigo-600 font-semibold shadow-2xs" 
                          />
                        </div>
                        {batchPackingGstApplicable && (
                          <div className="flex items-center justify-between gap-1 pt-1">
                            <span className="text-[10px] text-slate-500 font-semibold">Rate:</span>
                            <select
                              value={batchPackingGstPercentage}
                              onChange={(e) => setBatchPackingGstPercentage(Number(e.target.value))}
                              className="h-6 text-[11px] px-1.5 rounded-md border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 font-bold focus:outline-none"
                            >
                              <option value={0}>0%</option>
                              <option value={5}>5%</option>
                              <option value={12}>12%</option>
                              <option value={18}>18%</option>
                              <option value={28}>28%</option>
                            </select>
                            {Number(batchPacking) > 0 && (
                              <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                                +₹{(Number(batchPacking) * batchPackingGstPercentage / 100).toFixed(2)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* 4. Loading & Unloading Charges */}
                      <div className="space-y-1.5 p-2.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            Loading (₹)
                          </Label>
                          <label className="inline-flex items-center gap-1 cursor-pointer select-none">
                            <input 
                              type="checkbox" 
                              checked={batchLoadingGstApplicable} 
                              onChange={(e) => setBatchLoadingGstApplicable(e.target.checked)}
                              className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 cursor-pointer"
                            />
                            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">GST</span>
                          </label>
                        </div>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-indigo-600 dark:text-indigo-400 select-none">₹</span>
                          <Input 
                            type="number" 
                            min="0"
                            value={batchLoading} 
                            onChange={(e) => setBatchLoading(e.target.value)}
                            className="h-8.5 text-xs pl-6 rounded-lg bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 hover:border-indigo-400 focus:border-indigo-600 font-semibold shadow-2xs" 
                          />
                        </div>
                        {batchLoadingGstApplicable && (
                          <div className="flex items-center justify-between gap-1 pt-1">
                            <span className="text-[10px] text-slate-500 font-semibold">Rate:</span>
                            <select
                              value={batchLoadingGstPercentage}
                              onChange={(e) => setBatchLoadingGstPercentage(Number(e.target.value))}
                              className="h-6 text-[11px] px-1.5 rounded-md border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 font-bold focus:outline-none"
                            >
                              <option value={0}>0%</option>
                              <option value={5}>5%</option>
                              <option value={12}>12%</option>
                              <option value={18}>18%</option>
                              <option value={28}>28%</option>
                            </select>
                            {Number(batchLoading) > 0 && (
                              <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                                +₹{(Number(batchLoading) * batchLoadingGstPercentage / 100).toFixed(2)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* 5. Other Charges (with custom label) */}
                      <div className="space-y-1.5 p-2.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <Input
                            type="text"
                            value={batchOtherChargesLabel}
                            onChange={(e) => setBatchOtherChargesLabel(e.target.value)}
                            placeholder="Other Charges"
                            className="h-5 px-1 py-0 text-[11px] font-bold text-slate-700 dark:text-slate-300 border-0 bg-transparent focus-visible:ring-0 max-w-[110px] p-0"
                            title="Edit charge title"
                          />
                          <label className="inline-flex items-center gap-1 cursor-pointer select-none">
                            <input 
                              type="checkbox" 
                              checked={batchOtherChargesGstApplicable} 
                              onChange={(e) => setBatchOtherChargesGstApplicable(e.target.checked)}
                              className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 cursor-pointer"
                            />
                            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">GST</span>
                          </label>
                        </div>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-indigo-600 dark:text-indigo-400 select-none">₹</span>
                          <Input 
                            type="number" 
                            min="0"
                            value={batchOtherCharges} 
                            onChange={(e) => setBatchOtherCharges(e.target.value)}
                            className="h-8.5 text-xs pl-6 rounded-lg bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 hover:border-indigo-400 focus:border-indigo-600 font-semibold shadow-2xs" 
                          />
                        </div>
                        {batchOtherChargesGstApplicable && (
                          <div className="flex items-center justify-between gap-1 pt-1">
                            <span className="text-[10px] text-slate-500 font-semibold">Rate:</span>
                            <select
                              value={batchOtherChargesGstPercentage}
                              onChange={(e) => setBatchOtherChargesGstPercentage(Number(e.target.value))}
                              className="h-6 text-[11px] px-1.5 rounded-md border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 font-bold focus:outline-none"
                            >
                              <option value={0}>0%</option>
                              <option value={5}>5%</option>
                              <option value={12}>12%</option>
                              <option value={18}>18%</option>
                              <option value={28}>28%</option>
                            </select>
                            {Number(batchOtherCharges) > 0 && (
                              <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                                +₹{(Number(batchOtherCharges) * batchOtherChargesGstPercentage / 100).toFixed(2)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Note / Remarks */}
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                        Supplier Instructions & Remarks
                      </Label>
                      <textarea 
                        value={batchRemarks}
                        onChange={(e) => setBatchRemarks(e.target.value)}
                        rows={3}
                        className="w-full border rounded-xl p-3 text-xs bg-slate-50/70 dark:bg-slate-900/90 border-slate-300 dark:border-slate-700 hover:border-indigo-400 focus:outline-none focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500/20 resize-none shadow-2xs text-slate-800 dark:text-slate-200 font-medium" 
                        placeholder="Supplier instructions, delivery location notes, payment terms, or reference numbers..."
                      />
                    </div>
                  </div>

                  {/* Right Column (5 cols): Live Financial Summary Box */}
                  <div className="xl:col-span-5 p-4 bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-50 dark:from-slate-950/90 dark:via-indigo-950/30 dark:to-slate-950/90 rounded-2xl border-2 border-indigo-100 dark:border-indigo-900/60 space-y-2.5 text-xs shadow-xs">
                    <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                      <span>Items Subtotal ({financialSummary.validCount} valid entries)</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        ₹{financialSummary.itemsSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                      <span>Taxable Value</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        ₹{financialSummary.totalTaxableValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    {/* Tax Breakdown - Show CGST/SGST if intrastate or totalCgst > 0, and show IGST if interstate */}
                    {(financialSummary.totalCgst > 0 || financialSummary.totalSgst > 0 || !financialSummary.hasAnyInterstate) && (
                      <>
                        <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                          <span className="inline-flex items-center gap-1.5">
                            <span>CGST (Intrastate)</span>
                            <GstCalculationModal 
                              items={financialSummary.dummyItemsForBreakdown || []} 
                              charges={financialSummary.chargesList} 
                              isInterState={false} 
                              breakdownData={financialSummary.gstBreakdown} 
                            />
                          </span>
                          <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                            ₹{financialSummary.totalCgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                          <span className="inline-flex items-center gap-1.5">
                            <span>SGST (Intrastate)</span>
                            <GstCalculationModal 
                              items={financialSummary.dummyItemsForBreakdown || []} 
                              charges={financialSummary.chargesList} 
                              isInterState={false} 
                              breakdownData={financialSummary.gstBreakdown} 
                            />
                          </span>
                          <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                            ₹{financialSummary.totalSgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </>
                    )}

                    {(financialSummary.totalIgst > 0 || financialSummary.hasAnyInterstate) && (
                      <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                        <span className="inline-flex items-center gap-1.5">
                          <span>IGST (Interstate)</span>
                          <GstCalculationModal 
                            items={financialSummary.dummyItemsForBreakdown || []} 
                            charges={financialSummary.chargesList} 
                            isInterState={true} 
                            breakdownData={financialSummary.gstBreakdown} 
                          />
                        </span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                          ₹{financialSummary.totalIgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}

                    {financialSummary.discount > 0 && (
                      <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400 font-semibold">
                        <span>Discount</span>
                        <span>
                          -₹{financialSummary.discount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}

                    {financialSummary.totalExtraCharges > 0 && (
                      <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                        <span>Extra Charges (Shipping, Packing, etc.)</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          +₹{financialSummary.totalExtraCharges.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}

                    {financialSummary.totalChargesTaxes > 0 && (
                      <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                        <span>Charges Tax (GST)</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                          +₹{financialSummary.totalChargesTaxes.toFixed(2)}
                        </span>
                      </div>
                    )}

                    {financialSummary.roundOff !== 0 && (
                      <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                        <span>Round Off</span>
                        <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                          {financialSummary.roundOff > 0 ? `+₹${financialSummary.roundOff.toFixed(2)}` : `-₹${Math.abs(financialSummary.roundOff).toFixed(2)}`}
                        </span>
                      </div>
                    )}

                    <div className="pt-2.5 border-t-2 border-indigo-200 dark:border-indigo-800/80 flex justify-between items-baseline">
                      <div>
                        <span className="text-xs font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-400 block">
                          GRAND TOTAL
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">Includes all taxes & delivery</span>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl sm:text-3xl font-black font-mono text-indigo-600 dark:text-indigo-400">
                          ₹{financialSummary.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ───────────────────────────────────────────────────────────────────
                  5. PAYMENT & SETTLEMENT DETAILS (IDENTICAL TO /purchase-orders/create)
                  ─────────────────────────────────────────────────────────────────── */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5 w-full">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-800">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                        5. Payment & Settlement Details
                      </span>
                      <p className="text-[11px] text-slate-400">
                        Record cash, bank transfer, UPI, or cheque payment with transaction ref & proof image
                      </p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${
                    batchPaymentStatus === 'PAID'
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                      : batchPaymentStatus === 'PARTIALLY_PAID'
                      ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800'
                      : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                  }`}>
                    {batchPaymentStatus === 'PAID' ? 'Fully Settled' : batchPaymentStatus === 'PARTIALLY_PAID' ? 'Partial Settlement' : 'Unpaid Expense'}
                  </span>
                </div>

                <PaymentFieldsSection
                  paymentStatus={batchPaymentStatus}
                  setPaymentStatus={setBatchPaymentStatus}
                  paidAmount={batchPaidAmount}
                  setPaidAmount={setBatchPaidAmount}
                  paymentMode={batchPaymentMode}
                  setPaymentMode={setBatchPaymentMode}
                  paymentRef={batchPaymentRef}
                  setPaymentRef={setBatchPaymentRef}
                  paymentImage={batchPaymentImage}
                  setPaymentImage={setBatchPaymentImage}
                  paymentNotes={batchPaymentNotes}
                  setPaymentNotes={setBatchPaymentNotes}
                  totalAmount={financialSummary.grandTotal}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-4 sm:px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg shrink-0">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-bold font-mono">
                  {financialSummary.validCount} Valid Row{financialSummary.validCount !== 1 ? 's' : ''}
                </span>
                <span className="hidden md:inline">• You can record single or batch vendor expenses simultaneously</span>
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseMultiModal}
                  className="rounded-xl border-slate-300 dark:border-slate-700 text-xs font-bold h-9 px-4 hover:bg-slate-100"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveBatchExpenses}
                  disabled={bulkCreateMutation.isPending || financialSummary.validCount === 0}
                  className="rounded-xl text-xs font-black h-9 px-6 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-md hover:shadow-indigo-500/25 transition-all flex items-center gap-2"
                >
                  {bulkCreateMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving Expenses...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Save ({financialSummary.validCount} Expense{financialSummary.validCount !== 1 ? 's' : ''}) • ₹{financialSummary.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
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
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
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
                  placeholder="e.g. Courier charges, Machine repair"
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

              {/* Calculated Grand Total Indicator */}
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-600 dark:text-slate-300">Total with GST:</span>
                <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 text-sm">
                  ₹{((parseFloat(editTaxableAmount) || 0) + ((parseFloat(editTaxableAmount) || 0) * (parseFloat(editGstPercentage) || 0) / 100)).toFixed(2)}
                </span>
              </div>

              {/* Reference / Notes */}
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-500 uppercase">Reference Note</Label>
                <textarea
                  {...registerEdit('notes')}
                  rows={2}
                  placeholder="Optional reference number or extra details"
                  className="w-full p-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 resize-none"
                />
              </div>

              {/* Payment Details */}
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 space-y-2.5">
                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-indigo-500" />
                  Payment & Settlement Details
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] font-bold text-slate-500 uppercase">Mode</Label>
                    <select
                      {...registerEdit('paymentMode')}
                      className="w-full h-8 px-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold"
                    >
                      {PAYMENT_MODES.map(mode => (
                        <option key={mode.id} value={mode.id}>{mode.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-[10px] font-bold text-slate-500 uppercase">Status</Label>
                    <select
                      {...registerEdit('paymentStatus')}
                      className="w-full h-8 px-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-indigo-600"
                    >
                      <option value="PAID">PAID (Settled)</option>
                      <option value="PARTIALLY_PAID">PARTIALLY PAID</option>
                      <option value="UNPAID">UNPAID (Pending)</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] font-bold text-slate-500 uppercase">Paid Amount (₹)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      {...registerEdit('paidAmount')}
                      className="h-8 text-xs font-mono font-bold rounded-lg"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] font-bold text-slate-500 uppercase">Transaction / UTR / Cheque Ref</Label>
                    <Input
                      {...registerEdit('paymentRef')}
                      placeholder="e.g. UTR12345678"
                      className="h-8 text-xs font-mono rounded-lg"
                    />
                  </div>
                </div>
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
                    <span>Shipping {viewingExpense.shippingGstApplicable ? `(GST ${viewingExpense.shippingGstRate || 18}%)` : '(No GST)'}:</span>
                    <span className="font-mono">₹{Number(viewingExpense.shippingAmount).toFixed(2)}</span>
                  </div>
                )}
                {Number(viewingExpense.packingAmount || 0) > 0 && (
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                    <span>Packing {viewingExpense.packingGstApplicable ? `(GST ${viewingExpense.packingGstRate || 18}%)` : '(No GST)'}:</span>
                    <span className="font-mono">₹{Number(viewingExpense.packingAmount).toFixed(2)}</span>
                  </div>
                )}
                {Number(viewingExpense.loadingAmount || 0) > 0 && (
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                    <span>Loading & Unloading {viewingExpense.loadingGstApplicable ? `(GST ${viewingExpense.loadingGstRate || 18}%)` : '(No GST)'}:</span>
                    <span className="font-mono">₹{Number(viewingExpense.loadingAmount).toFixed(2)}</span>
                  </div>
                )}
                {Number(viewingExpense.otherCharges || 0) > 0 && (
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                    <span>Other Charges {viewingExpense.otherChargesGstApplicable ? `(GST ${viewingExpense.otherChargesGstRate || 18}%)` : '(No GST)'}:</span>
                    <span className="font-mono">₹{Number(viewingExpense.otherCharges).toFixed(2)}</span>
                  </div>
                )}

                {Number(viewingExpense.gstPercentage || 0) > 0 && (
                  <>
                    <div className="flex justify-between items-center text-slate-500 pt-1 border-t border-slate-200/50 dark:border-slate-800/50">
                      <span>Base GST Rate ({viewingExpense.isInterState ? 'Interstate IGST' : 'Intrastate CGST+SGST'}):</span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                        {viewingExpense.gstPercentage}%
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
                    {viewingExpense.paymentStatus || 'UNPAID'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 text-slate-600 dark:text-slate-400">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Payment Mode:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 capitalize">
                      {(viewingExpense.paymentMode || 'CASH').replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Paid Amount:</span>
                    <span className="font-bold font-mono text-slate-800 dark:text-slate-200">
                      ₹{Number(viewingExpense.paidAmount || 0).toFixed(2)}
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