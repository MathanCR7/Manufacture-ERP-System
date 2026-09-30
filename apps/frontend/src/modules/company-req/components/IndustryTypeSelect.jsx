import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import Swal from 'sweetalert2';
import {
  Search, X, ChevronDown, Check, Plus, Tag, Building2,
  Sparkles, AlertCircle, Loader2
} from 'lucide-react';

export default function IndustryTypeSelect({
  value = '',
  onChange,
  error = '',
  placeholder = 'Select or search Industry Type (e.g. Milk Supplier)...'
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Fetch unique industry types from the Master table
  const { data: industriesData, isLoading, refetch } = useQuery({
    queryKey: ['company-req-industries'],
    queryFn: async () => {
      const res = await api.get('/company-req/industries');
      // res.data can be { data: [{id, name}], industries: ['...'] } or array
      if (res.data?.data && Array.isArray(res.data.data)) {
        return res.data.data;
      }
      if (Array.isArray(res.data?.industries)) {
        return res.data.industries.map(name => ({ id: name, name }));
      }
      if (Array.isArray(res.data)) {
        return res.data.map(item => (typeof item === 'string' ? { id: item, name: item } : item));
      }
      return [];
    }
  });

  const masterList = useMemo(() => {
    return Array.isArray(industriesData) ? industriesData : [];
  }, [industriesData]);

  // Mutation to add a new unique industry type to Master table
  const addMutation = useMutation({
    mutationFn: async (newIndustryName) => {
      const res = await api.post('/company-req/industries', {
        name: newIndustryName.trim()
      });
      return res.data?.data || res.data;
    },
    onSuccess: (data, newIndustryName) => {
      queryClient.invalidateQueries({ queryKey: ['company-req-industries'] });
      const savedName = data?.name || newIndustryName.trim();
      onChange(savedName);
      setOpen(false);
      setSearch('');

      const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true
      });
      Toast.fire({
        icon: 'success',
        title: `Industry "${savedName}" saved to Master`
      });
    },
    onError: (err) => {
      Swal.fire({
        icon: 'error',
        title: 'Could Not Add Industry',
        text: err.response?.data?.error || 'Failed to add industry type to Master'
      });
    }
  });

  // Filter existing industries by search term
  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return masterList;
    return masterList.filter(item => {
      const name = (item.name || '').toLowerCase();
      return name.includes(q);
    });
  }, [masterList, search]);

  // Check if search text matches an existing item exactly (case-insensitive)
  const exactMatchExists = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return false;
    return masterList.some(item => (item.name || '').toLowerCase() === q);
  }, [masterList, search]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when opening
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 60);
    }
  }, [open]);

  const handleSelect = (industryName) => {
    onChange(industryName);
    setOpen(false);
    setSearch('');
  };

  const handleAddNew = (e) => {
    e?.preventDefault();
    const trimmed = search.trim();
    if (!trimmed) return;

    // Check if case-insensitive match already exists in masterList
    const existing = masterList.find(i => (i.name || '').toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      handleSelect(existing.name);
      return;
    }

    addMutation.mutate(trimmed);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredList.length === 1) {
        handleSelect(filteredList[0].name);
      } else if (!exactMatchExists && search.trim()) {
        handleAddNew();
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Selector Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-xl border bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-3xs transition-all cursor-pointer ${
          error
            ? 'border-rose-400 focus:border-rose-500 ring-2 ring-rose-400/20'
            : open
            ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs'
            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Tag className={`w-3.5 h-3.5 shrink-0 ${value ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
          {value ? (
            <span className="font-bold text-slate-900 dark:text-white truncate">
              {value}
            </span>
          ) : (
            <span className="text-slate-400 dark:text-slate-500 truncate">
              {placeholder}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {value && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="p-0.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors"
              title="Clear selection"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180 text-indigo-600' : ''}`} />
        </div>
      </button>

      {/* Dropdown Panel with Search & Master Add */}
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          
          {/* Search bar inside dropdown (Just like Create PO Raw Material Search) */}
          <div className="p-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search Industry Type or type new to add..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1.5 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all placeholder:text-slate-400 shadow-3xs"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  title="Clear"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1 px-1">
              <span>{filteredList.length} master industries available</span>
              <span>Unique & deduplicated</span>
            </div>
          </div>

          {/* Quick "+ Add New Industry" button if searched term is new */}
          {search.trim() && !exactMatchExists && (
            <div className="p-2 border-b border-indigo-100 dark:border-indigo-900/60 bg-indigo-50/70 dark:bg-indigo-950/40">
              <button
                type="button"
                disabled={addMutation.isPending}
                onClick={handleAddNew}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-all cursor-pointer active:scale-98 disabled:opacity-50"
              >
                <div className="flex items-center gap-1.5 truncate">
                  {addMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span className="truncate">
                    + Add <span className="underline underline-offset-2">"{search.trim()}"</span> to Master
                  </span>
                </div>
                <span className="text-[10px] uppercase tracking-wider bg-white/20 px-1.5 py-0.5 rounded font-mono ml-2 shrink-0">
                  New Master
                </span>
              </button>
            </div>
          )}

          {/* List of master industry types */}
          <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
            {isLoading ? (
              <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading Master Industries...
              </div>
            ) : filteredList.length === 0 ? (
              <div className="p-4 text-center">
                <Building2 className="w-6 h-6 text-slate-300 dark:text-slate-600 mx-auto mb-1.5 opacity-60" />
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  No matching industry found.
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Click the button above to add <strong className="text-indigo-600">"{search.trim()}"</strong> into the master list!
                </p>
              </div>
            ) : (
              filteredList.map((item) => {
                const isSelected = value === item.name;
                return (
                  <button
                    key={item.id || item.name}
                    type="button"
                    onClick={() => handleSelect(item.name)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50/90 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-bold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/70'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      }`}>
                        <Building2 className="w-3.5 h-3.5" />
                      </div>
                      <span className="truncate">{item.name}</span>
                    </div>

                    {isSelected && (
                      <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 ml-2" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer Info */}
          <div className="p-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 text-[10px] text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-indigo-500" /> Master Controlled
            </span>
            <span>Prevents Duplicates</span>
          </div>
        </div>
      )}
    </div>
  );
}
