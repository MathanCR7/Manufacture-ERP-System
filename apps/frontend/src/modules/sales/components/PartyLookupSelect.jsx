import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { Search, User, Building2, Phone, Mail, FileText, Check, X, ShieldAlert, ArrowRight } from 'lucide-react';

/**
 * Multi-Attribute Party Lookup (Customer / Supplier)
 * Supports searching by: Name, Code, Phone, Email, GSTIN
 */
export default function PartyLookupSelect({
  partyType = 'customer', // 'customer' | 'supplier'
  value, // selected party ID
  onChange, // callback with selected party object or null
  placeholder = 'Search by name, phone, email, GSTIN, or ID...',
  required = false,
  disabled = false,
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedParty, setSelectedParty] = useState(null);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch parties from backend lookup endpoint
  const endpoint = partyType === 'customer' ? '/parties/customers/lookup' : '/parties/suppliers/lookup';
  const { data: partyList = [], isLoading } = useQuery({
    queryKey: ['party-lookup', partyType, searchTerm],
    queryFn: async () => {
      const res = await api.get(endpoint, { params: { q: searchTerm } });
      return Array.isArray(res.data) ? res.data : [];
    },
    staleTime: 5000
  });

  // Keep selectedParty in sync when initial value is provided or changed
  useEffect(() => {
    if (!value) {
      setSelectedParty(null);
      return;
    }

    if (selectedParty && selectedParty.id === value) {
      return;
    }

    // Try finding in currently loaded list
    const found = partyList.find(p => p.id === value);
    if (found) {
      setSelectedParty(found);
    } else {
      // Fetch single party detail
      const detailEndpoint = partyType === 'customer' ? `/parties/customers/${value}` : `/parties/suppliers/${value}`;
      api.get(detailEndpoint)
        .then(res => {
          if (res.data) setSelectedParty(res.data);
        })
        .catch(() => {});
    }
  }, [value, partyList, partyType]);

  const handleSelect = (party) => {
    setSelectedParty(party);
    setIsOpen(false);
    setSearchTerm('');
    if (onChange) onChange(party);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    setSelectedParty(null);
    setSearchTerm('');
    if (onChange) onChange(null);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {selectedParty ? (
        // Selected Party Card View
        <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/60 rounded-xl shadow-sm hover:border-indigo-400 transition-all">
          <div className="flex items-start gap-3 min-w-0">
            <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
              partyType === 'customer' 
                ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400' 
                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
            }`}>
              {partyType === 'customer' ? <User className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate">
                  {selectedParty.name}
                </span>
                {selectedParty.code && (
                  <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {selectedParty.code}
                  </span>
                )}
                {selectedParty.customerType && (
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    selectedParty.customerType === 'DISTRIBUTOR' 
                      ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300' 
                      : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                  }`}>
                    {selectedParty.customerType}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1 flex-wrap">
                {selectedParty.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-400" />
                    {selectedParty.phone}
                  </span>
                )}
                {selectedParty.gstin && (
                  <span className="flex items-center gap-1 font-mono text-[11px]">
                    <FileText className="w-3 h-3 text-slate-400" />
                    GSTIN: {selectedParty.gstin}
                  </span>
                )}
                {Number(selectedParty.creditLimit) > 0 && (
                  <span className="text-amber-600 dark:text-amber-400 font-medium">
                    Credit Limit: ₹{Number(selectedParty.creditLimit).toLocaleString('en-IN')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {!disabled && (
            <div className="flex items-center gap-1 shrink-0 ml-2">
              <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="text-xs px-2.5 py-1 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors font-medium"
              >
                Change
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="p-1 text-slate-400 hover:text-rose-500 rounded-lg transition-colors"
                title="Clear selection"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      ) : (
        // Input Trigger
        <div
          onClick={() => !disabled && setIsOpen(true)}
          className={`flex items-center justify-between px-3.5 py-2.5 bg-white dark:bg-slate-900 border ${
            isOpen ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-200 dark:border-slate-700'
          } rounded-xl shadow-sm cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition-all ${
            disabled ? 'opacity-60 cursor-not-allowed' : ''
          }`}
        >
          <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 text-sm">
            <Search className="w-4 h-4" />
            <span className={required ? 'text-slate-400 font-normal' : ''}>
              {placeholder}
            </span>
          </div>
          <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded">
            Lookup
          </span>
        </div>
      )}

      {/* Floating Dropdown Modal / List */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Quick Search Header */}
          <div className="p-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-400 ml-1" />
            <input
              type="text"
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`Search ${partyType} by name, phone, email, GSTIN, code...`}
              className="w-full bg-transparent border-none text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Results List */}
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
            {isLoading ? (
              <div className="p-6 text-center text-xs text-slate-400">
                Searching {partyType} directory...
              </div>
            ) : partyList.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No {partyType} found matching "{searchTerm}".
              </div>
            ) : (
              partyList.map((party) => {
                const isSelected = selectedParty?.id === party.id;
                return (
                  <div
                    key={party.id}
                    onClick={() => handleSelect(party)}
                    className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-indigo-50/70 dark:bg-indigo-950/50 text-indigo-950 dark:text-indigo-100'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                          {party.name}
                        </span>
                        {party.code && (
                          <span className="text-[10px] font-mono px-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                            {party.code}
                          </span>
                        )}
                        {party.customerType && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 font-semibold uppercase">
                            {party.customerType}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {party.phone && <span>📞 {party.phone}</span>}
                        {party.email && <span>✉️ {party.email}</span>}
                        {party.gstin && <span className="font-mono text-[11px]">GSTIN: {party.gstin}</span>}
                      </div>

                      {party.address && (
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                          📍 {party.address}
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {isSelected ? (
                        <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      ) : (
                        <ArrowRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
