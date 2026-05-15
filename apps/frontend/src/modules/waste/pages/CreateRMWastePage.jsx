import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { CalendarIcon, RefreshCw, ArrowLeft, Loader2, Search, X, ChevronDown } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
        className={`w-full px-3 py-2 border rounded-md text-left flex items-center justify-between bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${error ? 'border-red-400' : 'border-slate-300 dark:border-slate-700'}`}
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
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md shadow-lg">
          <div className="p-2 border-b border-slate-100 dark:border-slate-700">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search RM Name or Code..."
                className="w-full pl-7 pr-7 py-1.5 text-sm border rounded border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
              <li className="px-3 py-2 text-sm text-slate-400 text-center">No results found</li>
            ) : (
              filtered.map(rm => (
                <li
                  key={rm.id}
                  onMouseDown={() => handleSelect(rm)}
                  className={`px-3 py-2 text-sm cursor-pointer select-none flex justify-between items-center ${
                    value?.id === rm.id
                      ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-medium'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>{rm.name}</span>
                  <span className="text-xs text-slate-400">{rm.code}</span>
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
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    date: new Date(),
    note: '',
    responsibleId: '',
  });

  const [wasteItems, setWasteItems] = useState([]);
  const [selectedRmForAdd, setSelectedRmForAdd] = useState(null);
  
  const [errorMsg, setErrorMsg] = useState('');

  const { data: refData, refetch: rotateRef, isFetching: isRotating } = useQuery({
    queryKey: ['generateRmWasteRef'],
    queryFn: async () => {
      const response = await api.get('/rm-waste/reference/generate');
      return response.data;
    },
    refetchOnWindowFocus: false,
  });

  const { data: rawMaterials = [], isLoading: isLoadingRMs } = useQuery({
    queryKey: ['raw-materials-setup'],
    queryFn: async () => {
      const response = await api.get('/item-setup/raw-material');
      return response.data;
    }
  });

  const { data: allUoms = [] } = useQuery({
    queryKey: ['uoms'],
    queryFn: async () => {
      const response = await api.get('/uom');
      return response.data;
    }
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.get('/users');
      return response.data;
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const response = await api.post('/rm-waste', data);
      return response.data;
    },
    onSuccess: (data) => {
      alert(`RM Waste Logged successfully — ${data.referenceNo}`);
      navigate('/waste/raw-material');
    },
    onError: (err) => {
      setErrorMsg(err.response?.data?.error || 'Failed to log RM waste');
    }
  });

  const handleAddRm = (rm) => {
    if (!rm) return;
    if (wasteItems.some(item => item.rm.id === rm.id)) {
      alert("Item already added to the list.");
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

  const handleRemoveRm = (id) => {
    setWasteItems(wasteItems.filter(item => item.id !== id));
  };

  const handleItemChange = (id, field, value) => {
    setWasteItems(wasteItems.map(item => 
      item.id === id ? { ...item, [field]: value } : item
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

    createMutation.mutate({
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
    });
  };



  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/waste/raw-material')} className="text-slate-500 rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Add RM Waste</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Log raw material wastage and associated loss.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <form onSubmit={handleSubmit}>
          {/* Top Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 border-b border-slate-200 dark:border-slate-800">
            <div className="space-y-2">
              <Label className="text-red-500">Reference No *</Label>
              <div className="flex">
                <Input value={isRotating ? '------' : refData?.candidateId || 'Loading...'} readOnly className="bg-slate-50 dark:bg-slate-800/50 rounded-r-none font-mono text-indigo-600 dark:text-indigo-400" />
                <Button type="button" variant="outline" size="icon" className="rounded-l-none border-l-0" onClick={(e) => { e.preventDefault(); rotateRef(); }} disabled={isRotating}>
                  <RefreshCw className={twMerge("w-4 h-4 text-slate-500", isRotating && "animate-spin")} />
                </Button>
              </div>
            </div>

            <div className="space-y-2 flex flex-col">
              <Label className="text-red-500">Date *</Label>
              <Popover>
                <PopoverTrigger
                  className={twMerge(
                    "flex h-10 w-full items-center justify-start rounded-md border border-slate-200 bg-white px-4 py-2 text-left text-sm font-normal text-slate-900 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-50 dark:focus-visible:ring-slate-800",
                    !formData.date && "text-slate-500 dark:text-slate-400"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.date ? format(formData.date, "PPP") : <span>Pick a date</span>}
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={formData.date} onSelect={(date) => setFormData({...formData, date})} initialFocus />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label className="text-red-500">Responsible Person *</Label>
              <Select value={formData.responsibleId} onValueChange={(val) => setFormData({...formData, responsibleId: val})} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name} ({u.role})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Details Section */}
          <div className="p-6 space-y-6">
            <div className="space-y-2 max-w-md">
              <Label className="text-slate-700 dark:text-slate-300">Raw Material (Only Stock available are listed)</Label>
              {isLoadingRMs ? (
                <div className="w-full px-3 py-2 border rounded-md text-slate-400 flex items-center"><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading...</div>
              ) : (
                <RawMaterialSelect 
                  rawMaterials={rawMaterials}
                  value={selectedRmForAdd}
                  onChange={handleAddRm} 
                />
              )}
            </div>

            <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-x-auto">
              <table className="w-full text-sm text-left min-w-[800px]">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-medium">
                  <tr>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 w-12">SN</th>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 w-64">Raw Material(Code)</th>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 w-48">Stock Info</th>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 w-48">Quantity *</th>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 w-48">Loss Amount *</th>
                    <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 w-16 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {wasteItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500 bg-white dark:bg-slate-900">
                        No raw materials added yet. Select a raw material from the dropdown above.
                      </td>
                    </tr>
                  ) : (
                    wasteItems.map((item, idx) => (
                      <tr key={item.id} className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                        <td className="px-4 py-4 text-center">{idx + 1}</td>
                        <td className="px-4 py-4 font-medium">{item.rm.name} ({item.rm.code})</td>
                        <td className="px-4 py-4 text-xs text-slate-500">
                          <div>Current Stock: {item.rm.currentStock || 0} {item.rm.unitId}</div>
                          <div>Total Floating Stock: 0 {item.rm.unitId}</div>
                        </td>
                        <td className="px-4 py-4 relative">
                          <Input type="number" step="0.01" min="0" placeholder="0.00" className="h-9 pr-16" value={item.quantity} onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)} required />
                          <span className="absolute right-7 top-1/2 -translate-y-1/2 text-slate-400 text-xs uppercase">{item.rm.unitId}</span>
                        </td>
                        <td className="px-4 py-4 relative">
                          <Input type="number" step="0.01" min="0" placeholder="0.00" className="h-9 pr-16" value={item.lossAmount} onChange={(e) => handleItemChange(item.id, 'lossAmount', e.target.value)} required />
                          <span className="absolute right-7 top-1/2 -translate-y-1/2 text-slate-400 text-xs">INR</span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <button type="button" onClick={() => handleRemoveRm(item.id)} className="text-red-500 hover:text-red-700 p-1">
                            <X className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
              <div className="space-y-2">
                <Label>Note</Label>
                <textarea 
                  className="w-full px-3 py-2 border rounded-md dark:bg-slate-900 dark:border-slate-700 dark:text-white border-slate-200 min-h-[120px]" 
                  placeholder="Note"
                  value={formData.note}
                  onChange={(e) => setFormData({...formData, note: e.target.value})}
                />
              </div>
              
              <div className="flex flex-col justify-start items-end space-y-4">
                <div className="flex flex-col space-y-1 w-full max-w-xs pt-8">
                  <Label className="text-slate-900 dark:text-white font-medium">G.Total *</Label>
                  <div className="relative w-full">
                    <Input readOnly value={totalLoss.toFixed(2)} className="pr-12 bg-slate-50 dark:bg-slate-800" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">INR</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="m-6 mt-0 p-3 bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-md text-sm font-medium border border-red-200 dark:border-red-800">
              {errorMsg}
            </div>
          )}

          <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex space-x-4 bg-slate-50 dark:bg-slate-900/50">
            <Button type="submit" disabled={createMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700 min-w-28 text-white">
              {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {createMutation.isPending ? 'Submitting...' : 'Submit'}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate('/waste/raw-material')} className="min-w-28">
              Back
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
