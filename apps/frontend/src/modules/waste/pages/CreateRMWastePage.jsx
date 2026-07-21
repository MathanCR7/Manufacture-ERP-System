import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { CalendarIcon, RefreshCw, ArrowLeft, Loader2, Search, X, ChevronDown } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import Swal from 'sweetalert2';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import DatePicker from '@/components/ui/DatePicker';
import { Badge } from '@/components/ui/badge';

// Reusing RawMaterialSelect logic for RM Waste
function RawMaterialSelect({ rawMaterials, value, onChange, error }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const searchRef = useRef(null);

  const filtered = rawMaterials.filter(rm =>
    rm.name.toLowerCase().includes(search.toLowerCase()) || 
    (rm.code && rm.code.toLowerCase().includes(search.toLowerCase()))
  );

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (open && searchRef.current) {
      searchRef.current.focus();
    }
  }, [open]);

  const handleSelect = (rm) => {
    onChange(rm);
    setOpen(false);
    setSearch('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange(null);
    setSearch('');
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className={`w-full px-3 py-2 border rounded-xl text-left flex items-center justify-between bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs font-semibold h-9 ${error ? 'border-red-400' : 'border-slate-200 dark:border-slate-700'}`}
      >
        <span className={value ? 'text-slate-900 dark:text-white truncate' : 'text-slate-400'}>
          {value ? `${value.code} - ${value.name}` : 'Select Raw Material...'}
        </span>
        <div className="flex items-center gap-1">
          {value && (
            <span
              onMouseDown={handleClear}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-0.5 rounded"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg">
          <div className="p-2 border-b border-slate-100 dark:border-slate-700">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search RM Name or Code..."
                className="w-full pl-7 pr-7 py-1.5 text-xs border rounded-xl border-slate-200 dark:border-slate-650 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              {search && (
                <button
                  type="button"
                  onMouseDown={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs text-slate-400 text-center">No results found</li>
            ) : (
              filtered.map(rm => (
                <li
                  key={rm.id}
                  onMouseDown={() => handleSelect(rm)}
                  className={`px-3 py-2 text-xs cursor-pointer select-none flex justify-between items-center ${
                    value?.id === rm.id
                      ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold'
                      : 'text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>{rm.name}</span>
                  <span className="text-xs text-slate-400 font-mono">{rm.code}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function CreateRMWastePage() {
  const { id } = useParams();
  const isEditMode = !!id;
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    date: new Date(),
    note: '',
    responsibleId: '',
    referenceNo: '',
  });

  const [wasteItems, setWasteItems] = useState([]);
  const [selectedRmForAdd, setSelectedRmForAdd] = useState(null);
  
  const [errorMsg, setErrorMsg] = useState('');
  const [isDataLoaded, setIsDataLoaded] = useState(!isEditMode);

  const { data: refData, refetch: rotateRef, isFetching: isRotating } = useQuery({
    queryKey: ['rm-waste-next-ref'],
    queryFn: async () => {
      const response = await api.get('/rm-waste/candidate-id');
      return response.data;
    },
    enabled: !isEditMode,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['system-users'],
    queryFn: async () => {
      const response = await api.get('/users');
      return response.data;
    }
  });

  const { data: rawMaterials = [], isLoading: isLoadingRMs } = useQuery({
    queryKey: ['active-raw-materials'],
    queryFn: async () => {
      const response = await api.get('/raw-materials');
      return response.data;
    }
  });

  // Prefill in edit mode
  useEffect(() => {
    if (isEditMode) {
      api.get(`/rm-waste/${id}`)
        .then(res => {
          const waste = res.data;
          setFormData({
            date: new Date(waste.date),
            note: waste.note || '',
            responsibleId: waste.responsibleId || '',
            referenceNo: waste.referenceNo || '',
          });
          
          if (waste.items) {
            setWasteItems(waste.items.map(item => ({
              id: item.id,
              rm: item.rawMaterial,
              quantity: item.quantity,
              uomId: item.uomId,
              lossAmount: item.lossAmount,
            })));
          }
          setIsDataLoaded(true);
        })
        .catch(err => {
          console.error(err);
          setErrorMsg('Failed to load raw material waste entry.');
          setIsDataLoaded(true);
        });
    }
  }, [id, isEditMode]);

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await api.post('/rm-waste', payload);
      return response.data;
    },
    onSuccess: () => {
      const isDark = document.documentElement.classList.contains('dark');
      Swal.fire({
        title: `<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Waste Logged</span>`,
        html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Raw material waste docket created successfully.</p>`,
        icon: 'success',
        iconColor: '#10b981',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        color: isDark ? '#f8fafc' : '#0f172a',
        showClass: { popup: 'animate__animated animate__slideInRight animate__faster' },
        hideClass: { popup: 'animate__animated animate__fadeOutRight animate__faster' },
        customClass: {
          popup: 'rounded-2xl border border-emerald-100 dark:border-emerald-950 shadow-xl backdrop-blur-md p-4',
          timerProgressBar: 'bg-emerald-500'
        }
      });
      navigate('/waste/raw-material');
    },
    onError: (err) => {
      const isDark = document.documentElement.classList.contains('dark');
      Swal.fire({
        title: `<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Operation Failed</span>`,
        html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">${err.response?.data?.error || 'Failed to submit wastage.'}</p>`,
        icon: 'error',
        iconColor: '#ef4444',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3500,
        timerProgressBar: true,
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        color: isDark ? '#f8fafc' : '#0f172a',
        showClass: { popup: 'animate__animated animate__slideInRight animate__faster' },
        hideClass: { popup: 'animate__animated animate__fadeOutRight animate__faster' },
        customClass: {
          popup: 'rounded-2xl border border-red-100 dark:border-red-950 shadow-xl backdrop-blur-md p-4',
          timerProgressBar: 'bg-red-500'
        }
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await api.put(`/rm-waste/${id}`, payload);
      return response.data;
    },
    onSuccess: () => {
      const isDark = document.documentElement.classList.contains('dark');
      Swal.fire({
        title: `<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Waste Updated</span>`,
        html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Raw material waste docket updated successfully.</p>`,
        icon: 'success',
        iconColor: '#10b981',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        color: isDark ? '#f8fafc' : '#0f172a',
        showClass: { popup: 'animate__animated animate__slideInRight animate__faster' },
        hideClass: { popup: 'animate__animated animate__fadeOutRight animate__faster' },
        customClass: {
          popup: 'rounded-2xl border border-emerald-100 dark:border-emerald-950 shadow-xl backdrop-blur-md p-4',
          timerProgressBar: 'bg-emerald-500'
        }
      });
      navigate('/waste/raw-material');
    },
    onError: (err) => {
      const isDark = document.documentElement.classList.contains('dark');
      Swal.fire({
        title: `<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Operation Failed</span>`,
        html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">${err.response?.data?.error || 'Failed to update wastage.'}</p>`,
        icon: 'error',
        iconColor: '#ef4444',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3500,
        timerProgressBar: true,
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        color: isDark ? '#f8fafc' : '#0f172a',
        showClass: { popup: 'animate__animated animate__slideInRight animate__faster' },
        hideClass: { popup: 'animate__animated animate__fadeOutRight animate__faster' },
        customClass: {
          popup: 'rounded-2xl border border-red-100 dark:border-red-950 shadow-xl backdrop-blur-md p-4',
          timerProgressBar: 'bg-red-500'
        }
      });
    }
  });

  const handleAddRm = (rm) => {
    if (!rm) return;
    if (wasteItems.some(item => item.rm.id === rm.id)) {
      const isDark = document.documentElement.classList.contains('dark');
      Swal.fire({
        title: `<span class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Already Added</span>`,
        html: `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">This raw material is already added to the wastage list.</p>`,
        icon: 'warning',
        iconColor: '#f59e0b',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3500,
        timerProgressBar: true,
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        color: isDark ? '#f8fafc' : '#0f172a',
        showClass: { popup: 'animate__animated animate__slideInRight animate__faster' },
        hideClass: { popup: 'animate__animated animate__fadeOutRight animate__faster' },
        customClass: {
          popup: 'rounded-2xl border border-amber-100 dark:border-amber-950 shadow-xl backdrop-blur-md p-4',
          timerProgressBar: 'bg-amber-500'
        }
      });
      setSelectedRmForAdd(null);
      return;
    }
    
    setWasteItems([...wasteItems, {
      id: crypto.randomUUID(),
      rm: rm,
      quantity: '',
      uomId: rm.unitId || '',
      lossAmount: '',
    }]);
    setSelectedRmForAdd(null);
  };

  const handleRemoveRm = (itemId) => {
    setWasteItems(wasteItems.filter(item => item.id !== itemId));
  };

  const handleItemChange = (itemId, field, value) => {
    setWasteItems(wasteItems.map(item => 
      item.id === itemId ? { ...item, [field]: value } : item
    ));
  };

  const totalLoss = wasteItems.reduce((acc, item) => acc + (Number(item.lossAmount) || 0), 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (wasteItems.length === 0) {
      setErrorMsg('At least one Raw Material is required');
      return;
    }
    if (!formData.date) {
      setErrorMsg('Date is required');
      return;
    }
    if (!formData.responsibleId) {
      setErrorMsg('Responsible Person is required');
      return;
    }

    // Validate items
    for (const item of wasteItems) {
      if (!item.quantity || Number(item.quantity) <= 0) {
        setErrorMsg('Quantity must be greater than 0 for all items');
        return;
      }
      if (!item.uomId) {
        setErrorMsg('UOM is required for all items');
        return;
      }
    }

    const payload = {
      date: formData.date.toISOString(),
      note: formData.note,
      responsibleId: formData.responsibleId,
      totalLoss,
      items: wasteItems.map(item => ({
        rawMaterialId: item.rm.id,
        quantity: Number(item.quantity),
        uomId: item.uomId,
        lossAmount: Number(item.lossAmount),
      }))
    };

    if (isEditMode) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  if (!isDataLoaded) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-650" />
      </div>
    );
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-5 space-y-4 mx-auto transition-all duration-300">
      {/* Header with back navigation */}
      <div className="flex items-center space-x-3 pb-3 border-b border-slate-205 dark:border-slate-800">
        <Button variant="ghost" size="icon" onClick={() => navigate('/waste/raw-material')} className="text-slate-500 rounded-full h-8 w-8 hover:bg-slate-100 dark:hover:bg-slate-850">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {isEditMode ? 'Edit RM Waste' : 'Add RM Waste'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
            {isEditMode ? 'Update raw material wastage and associated loss.' : 'Log raw material wastage and associated loss.'}
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-805 rounded-2xl shadow-xs overflow-hidden text-xs">
        <form onSubmit={handleSubmit}>
          {/* Top Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5 border-b border-slate-200 dark:border-slate-800">
            <div className="space-y-1.5">
              <Label className="text-red-500 font-extrabold uppercase text-[10px]">Reference No *</Label>
              {isEditMode ? (
                <Input value={formData.referenceNo || 'Loading...'} readOnly className="bg-slate-50 dark:bg-slate-950 font-mono text-indigo-600 dark:text-indigo-400 h-9 text-xs font-bold" />
              ) : (
                <div className="flex">
                  <Input value={isRotating ? '------' : refData?.candidateId || 'Loading...'} readOnly className="bg-slate-50 dark:bg-slate-955 rounded-r-none font-mono text-indigo-600 dark:text-indigo-400 h-9 text-xs font-bold rounded-l-xl" />
                  <Button type="button" variant="outline" size="icon" className="rounded-l-none border-l-0 h-9 rounded-r-xl border-slate-200" onClick={(e) => { e.preventDefault(); rotateRef(); }} disabled={isRotating}>
                    <RefreshCw className={twMerge("w-4 h-4 text-slate-500", isRotating && "animate-spin")} />
                  </Button>
                </div>
              )}
            </div>

            <DatePicker
              label="Date"
              required
              value={formData.date}
              onChange={(date) => setFormData({ ...formData, date })}
              modalTitle="Waste Log Date"
              placeholder="Select Date"
              triggerClassName="h-9 rounded-xl text-xs font-semibold"
            />

            <div className="space-y-1.5">
              <Label className="text-red-500 font-extrabold uppercase text-[10px]">Responsible Person *</Label>
              <Select value={formData.responsibleId} onValueChange={(val) => setFormData({...formData, responsibleId: val})} required>
                <SelectTrigger className="h-9 rounded-xl text-xs font-semibold border-slate-200 dark:bg-slate-950">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id} className="text-xs font-semibold">{u.name} ({u.role})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Details Section */}
          <div className="p-5 space-y-4">
            <div className="space-y-1.5 max-w-md text-xs">
              <Label className="text-slate-700 dark:text-slate-300 font-bold">Raw Material (Only Stock available are listed)</Label>
              {isLoadingRMs ? (
                <div className="w-full px-3 py-2 border rounded-xl text-slate-400 flex items-center text-xs h-9 bg-slate-50/50"><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading...</div>
              ) : (
                <RawMaterialSelect 
                  rawMaterials={rawMaterials}
                  value={selectedRmForAdd}
                  onChange={handleAddRm} 
                />
              )}
            </div>

            <div className="border border-slate-205 dark:border-slate-805 rounded-xl overflow-x-auto">
              <table className="w-full text-xs text-left min-w-[800px]">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-505 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-widest">
                  <tr>
                    <th className="px-4 py-2.5 w-12 text-center">SN</th>
                    <th className="px-4 py-2.5 w-64">Raw Material(Code)</th>
                    <th className="px-4 py-2.5 w-48">Stock Info</th>
                    <th className="px-4 py-2.5 w-48">Quantity *</th>
                    <th className="px-4 py-2.5 w-48">Loss Amount *</th>
                    <th className="px-4 py-2.5 w-16 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {wasteItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400 bg-white dark:bg-slate-900 font-semibold">
                        No raw materials added yet. Select a raw material from the dropdown above.
                      </td>
                    </tr>
                  ) : (
                    wasteItems.map((item, idx) => (
                      <tr key={item.id} className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/30">
                        <td className="px-4 py-3 text-center font-bold text-slate-400">{idx + 1}</td>
                        <td className="px-4 py-3 font-bold text-slate-855 dark:text-white">{item.rm.name} ({item.rm.code})</td>
                        <td className="px-4 py-3 text-3xs text-slate-500 font-bold space-y-0.5">
                          <div className="bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-650 px-2 py-0.5 rounded w-fit">Current Stock: {item.rm.currentStock || 0} {item.rm.unitId}</div>
                          <div className="text-slate-400 px-2">Total Floating Stock: 0 {item.rm.unitId}</div>
                        </td>
                        <td className="px-4 py-3 relative">
                          <Input type="number" step="0.01" min="0" placeholder="0.00" className="h-8 pr-14 text-xs font-bold rounded-lg border-slate-200 dark:bg-slate-950" value={item.quantity} onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)} required />
                          <span className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 text-3xs uppercase font-extrabold">{item.rm.unitId}</span>
                        </td>
                        <td className="px-4 py-3 relative">
                          <Input type="number" step="0.01" min="0" placeholder="0.00" className="h-8 pr-14 text-xs font-bold rounded-lg border-slate-200 dark:bg-slate-950 font-mono" value={item.lossAmount} onChange={(e) => handleItemChange(item.id, 'lossAmount', e.target.value)} required />
                          <span className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 text-3xs font-extrabold">INR</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button type="button" onClick={() => handleRemoveRm(item.id)} className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg">
                            <X className="w-4 h-4 mx-auto" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-extrabold text-slate-500 uppercase">Note / Remarks</Label>
                <textarea 
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-950 dark:border-slate-800 dark:text-white border-slate-200 min-h-[90px] text-xs resize-none font-medium" 
                  placeholder="Note"
                  value={formData.note}
                  onChange={(e) => setFormData({...formData, note: e.target.value})}
                />
              </div>
              
              <div className="flex flex-col justify-start items-end space-y-4">
                <div className="flex flex-col space-y-1 w-full max-w-xs pt-4">
                  <Label className="text-slate-900 dark:text-white font-bold text-xs uppercase">Grand Total Loss *</Label>
                  <div className="relative w-full">
                    <Input readOnly value={totalLoss.toFixed(2)} className="pr-12 bg-slate-50 dark:bg-slate-950 h-10 text-base font-black font-mono text-rose-600 dark:text-rose-455 border-slate-200 rounded-xl" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">INR</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="m-5 mt-0 p-3 bg-red-50 text-red-650 dark:bg-red-950/30 dark:text-red-400 rounded-xl text-xs font-bold border border-red-200 dark:border-red-900">
              {errorMsg}
            </div>
          )}

          <div className="p-5 border-t border-slate-200 dark:border-slate-800 flex space-x-3 bg-slate-50 dark:bg-slate-900/50">
            <Button type="submit" disabled={isPending} className="bg-indigo-600 hover:bg-indigo-700 min-w-28 text-white text-xs font-bold h-9 rounded-xl shadow-md cursor-pointer">
              {isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
              {isPending ? (isEditMode ? 'Updating...' : 'Submitting...') : (isEditMode ? 'Update' : 'Submit')}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate('/waste/raw-material')} className="min-w-28 text-xs font-bold h-9 rounded-xl border-slate-200">
              Back
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
