import React, { useState, useEffect, useMemo } from 'react';
import { api } from '@/lib/axios';
import { 
  Users, UserCheck, HardHat, CheckCircle2, AlertCircle, 
  Search, Sparkles, RefreshCw, X, ShieldCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Swal from 'sweetalert2';

export default function ProductionLabourPicker({
  labourCount = 0,
  assignedStaffIds = [],
  labourStaffDetails = [],
  onChange,
  disabled = false,
  stepNumber = 6,
  fullWidth = true
}) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      let res;
      try {
        res = await api.get('/users');
      } catch (e1) {
        if (e1.response?.status === 404 || e1.response?.status === 403) {
          res = await api.get('/admin/users');
        } else {
          throw e1;
        }
      }

      const userList = Array.isArray(res.data) ? res.data : (res.data?.users || []);
      setUsers(userList);
    } catch (err) {
      console.error('Failed to fetch users for production labour:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Filter for PRODUCTION_STAFF
  const productionStaffUsers = useMemo(() => {
    return users.filter(u => {
      const role = String(u.role || '').trim().toUpperCase();
      const isProdRole = role === 'PRODUCTION_STAFF' || role.includes('PRODUCTION');
      const isActive = u.isActive !== false;
      return isProdRole && isActive;
    });
  }, [users]);

  // Filtered by search
  const filteredStaff = useMemo(() => {
    if (!searchTerm.trim()) return productionStaffUsers;
    const q = searchTerm.toLowerCase();
    return productionStaffUsers.filter(u => 
      String(u.name || '').toLowerCase().includes(q) ||
      String(u.empId || '').toLowerCase().includes(q) ||
      String(u.email || '').toLowerCase().includes(q)
    );
  }, [productionStaffUsers, searchTerm]);

  const targetCount = Number(labourCount || 0);
  const selectedCount = (assignedStaffIds || []).length;

  const handleQuantityChange = (val) => {
    const parsed = parseInt(val, 10);
    const newCount = isNaN(parsed) || parsed < 0 ? 0 : parsed;

    let nextStaffIds = [...assignedStaffIds];
    let nextDetails = [...labourStaffDetails];
    if (newCount < nextStaffIds.length) {
      nextStaffIds = nextStaffIds.slice(0, newCount);
      nextDetails = nextDetails.slice(0, newCount);
    }

    if (onChange) {
      onChange({
        labourCount: newCount,
        assignedStaffIds: nextStaffIds,
        labourStaffDetails: nextDetails
      });
    }
  };

  const handleToggleStaff = (user) => {
    if (disabled) return;

    const isAlreadySelected = (assignedStaffIds || []).includes(user.id);

    if (isAlreadySelected) {
      const nextStaffIds = assignedStaffIds.filter(id => id !== user.id);
      const nextDetails = labourStaffDetails.filter(d => (d.id || d) !== user.id);
      
      if (onChange) {
        onChange({
          labourCount: targetCount,
          assignedStaffIds: nextStaffIds,
          labourStaffDetails: nextDetails
        });
      }
    } else {
      const effectiveTarget = targetCount === 0 ? selectedCount + 1 : targetCount;

      if (selectedCount >= effectiveTarget) {
        Swal.fire({
          title: 'Staff Limit Reached',
          text: `Required labour count is set to ${effectiveTarget}. Increase labour quantity to assign more staff.`,
          icon: 'info',
          confirmButtonColor: '#4f46e5'
        });
        return;
      }

      const nextStaffIds = [...assignedStaffIds, user.id];
      const nextDetails = [
        ...labourStaffDetails,
        {
          id: user.id,
          name: user.name,
          empId: user.empId || null,
          email: user.email || null,
          role: user.role
        }
      ];

      if (onChange) {
        onChange({
          labourCount: effectiveTarget,
          assignedStaffIds: nextStaffIds,
          labourStaffDetails: nextDetails
        });
      }
    }
  };

  const handleAutoFill = () => {
    if (targetCount <= 0) {
      const countToSet = productionStaffUsers.length > 0 ? 1 : 0;
      if (countToSet > 0) {
        handleQuantityChange(1);
        const u = productionStaffUsers[0];
        if (onChange) {
          onChange({
            labourCount: 1,
            assignedStaffIds: [u.id],
            labourStaffDetails: [{ id: u.id, name: u.name, email: u.email, role: u.role }]
          });
        }
      }
      return;
    }

    const availableToPick = productionStaffUsers.slice(0, targetCount);
    const newStaffIds = availableToPick.map(u => u.id);
    const newDetails = availableToPick.map(u => ({
      id: u.id,
      name: u.name,
      empId: u.empId || null,
      email: u.email || null,
      role: u.role
    }));

    if (onChange) {
      onChange({
        labourCount: targetCount,
        assignedStaffIds: newStaffIds,
        labourStaffDetails: newDetails
      });
    }
  };

  const handleClear = () => {
    if (onChange) {
      onChange({
        labourCount: targetCount,
        assignedStaffIds: [],
        labourStaffDetails: []
      });
    }
  };

  const isFulfilled = targetCount > 0 && selectedCount === targetCount;

  // ── Render Full Width Mode (for Step 6) ──
  if (fullWidth) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-[#E3E6EC] dark:border-slate-800 rounded-[12px] p-5 shadow-xs space-y-5">
        {/* Step Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#E3E6EC] dark:border-slate-800 gap-2">
          <div className="flex items-center gap-2.5">
            {stepNumber && (
              <span className="w-7 h-7 rounded-full bg-[#4F46E5] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                {stepNumber}
              </span>
            )}
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <span>Labour &amp; floor staff allocation</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Allocate certified operators and floor staff to supervise execution &amp; monitor machinery
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-xs font-mono font-bold px-3 py-1 rounded-full ${
              isFulfilled 
                ? 'bg-emerald-50 text-[#0F7B5F] border border-emerald-200'
                : 'bg-amber-50 text-[#B45309] border border-amber-200'
            }`}>
              {selectedCount} of {targetCount} Staff Assigned
            </span>
            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              Available: {productionStaffUsers.length}
            </span>
          </div>
        </div>

        {/* 2-Column Responsive Cockpit */}
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5 items-start">
          
          {/* Left Panel: Quantity & Quick Assign Controls */}
          <div className="space-y-4 bg-slate-50/70 dark:bg-slate-800/40 p-4 rounded-[12px] border border-slate-200/80 dark:border-slate-800">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Required Labour Qty <span className="text-rose-500">*</span>
                </Label>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isFulfilled 
                    ? 'bg-[#0F7B5F]/10 text-[#0F7B5F]'
                    : 'bg-amber-100/70 text-[#B45309]'
                }`}>
                  {isFulfilled ? 'Fulfilled' : `${targetCount - selectedCount} needed`}
                </span>
              </div>
              <Input
                type="number"
                min="0"
                disabled={disabled}
                value={labourCount === 0 ? '' : labourCount}
                onChange={(e) => handleQuantityChange(e.target.value)}
                placeholder="Workers required (e.g. 1)"
                className="h-[44px] rounded-[10px] text-sm font-bold border-[#E3E6EC] bg-white dark:bg-slate-900"
              />
              <p className="text-[11px] text-slate-400">
                Number of team members required for this batch run.
              </p>
            </div>

            <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 space-y-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAutoFill}
                  disabled={disabled || productionStaffUsers.length === 0}
                  className="flex-1 h-[38px] text-xs font-bold text-[#4F46E5] border-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-[8px] cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1.5 text-[#4F46E5]" />
                  Auto Assign
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  disabled={disabled || selectedCount === 0}
                  className="h-[38px] px-3 text-xs font-bold text-slate-500 hover:text-rose-600 rounded-[8px] cursor-pointer"
                >
                  Clear
                </Button>
              </div>

              {assignedStaffIds.length > 0 && (
                <div className="p-2.5 rounded-[8px] bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/60 text-[11px] text-indigo-900 dark:text-indigo-200">
                  <div className="flex items-center gap-1.5 font-bold mb-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#4F46E5]" />
                    <span>Allocated Personnel:</span>
                  </div>
                  <div className="space-y-0.5 pl-5 list-disc">
                    {labourStaffDetails.map(d => (
                      <div key={d.id || d.name} className="truncate font-medium">
                        • {d.name} <span className="opacity-70 font-mono text-[10px]">({d.email || 'Staff'})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Search + Grid of Staff Cards */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filter staff by name, email, employee ID..."
                className="w-full h-[44px] pl-9 pr-9 bg-white dark:bg-slate-900 border border-[#E3E6EC] dark:border-slate-800 rounded-[10px] text-xs font-medium text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {loading ? (
              <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-[#4F46E5]" />
                <span>Loading production team members...</span>
              </div>
            ) : filteredStaff.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 rounded-[10px] border border-dashed border-[#E3E6EC] dark:border-slate-800">
                No production staff found matching "{searchTerm}".
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5 max-h-[320px] overflow-y-auto pr-1">
                {filteredStaff.map((staff) => {
                  const isSelected = (assignedStaffIds || []).includes(staff.id);
                  const initial = staff.name ? staff.name.charAt(0).toUpperCase() : 'P';

                  return (
                    <button
                      key={staff.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => handleToggleStaff(staff)}
                      className={`p-3 rounded-[10px] border text-left transition-all flex items-center gap-3 cursor-pointer select-none group ${
                        isSelected
                          ? 'bg-indigo-50/90 dark:bg-indigo-950/60 border-[#4F46E5] text-[#4F46E5] shadow-xs ring-1 ring-indigo-500/30'
                          : 'bg-white dark:bg-slate-900 border-[#E3E6EC] dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-indigo-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      {/* Avatar initial */}
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-[#4F46E5] text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 group-hover:bg-indigo-100 group-hover:text-[#4F46E5]'
                      }`}>
                        {initial}
                      </div>

                      {/* Name & Email */}
                      <div className="flex-1 min-w-0">
                        <div 
                          className="font-bold text-xs text-slate-900 dark:text-white break-words whitespace-normal leading-snug"
                          title={staff.name}
                        >
                          {staff.name}
                        </div>
                        <div 
                          className="text-[10px] text-slate-400 font-mono break-words whitespace-normal leading-tight"
                          title={staff.email}
                        >
                          {staff.email || 'Production Worker'}
                        </div>
                      </div>

                      {/* Checkmark indicator */}
                      {isSelected ? (
                        <CheckCircle2 className="w-4 h-4 text-[#4F46E5] shrink-0" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-slate-300 shrink-0 group-hover:border-indigo-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    );
  }

  // ── Render Narrow Sidebar Mode (Fallback) ──
  return (
    <div className="bg-white dark:bg-slate-900 border border-[#E3E6EC] dark:border-slate-800 rounded-[12px] p-5 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#E3E6EC] dark:border-slate-800">
        <div>
          <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
            <span>Labour &amp; floor staff</span>
          </h3>
          <p className="text-[11px] text-slate-400">
            Allocate staff to supervise &amp; operate production
          </p>
        </div>
        <span className="text-xs font-semibold text-slate-500">
          Available: {productionStaffUsers.length}
        </span>
      </div>

      {/* Labour Qty input & Fulfilled badge */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Labour Qty <span className="text-rose-500">*</span>
          </Label>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
            isFulfilled 
              ? 'bg-[#0F7B5F]/10 text-[#0F7B5F] border border-[#0F7B5F]/30'
              : 'bg-amber-50 text-[#B45309] border border-amber-200'
          }`}>
            Fulfilled {selectedCount} of {targetCount}
          </span>
        </div>
        <Input
          type="number"
          min="0"
          disabled={disabled}
          value={labourCount === 0 ? '' : labourCount}
          onChange={(e) => handleQuantityChange(e.target.value)}
          placeholder="Workers required (e.g. 1)"
          className="h-[44px] rounded-[10px] text-sm font-bold border-[#E3E6EC]"
        />
      </div>

      {/* Filter input with Auto and Clear buttons */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter staff name, email..."
            className="w-full h-[40px] pl-9 pr-8 bg-white dark:bg-slate-900 border border-[#E3E6EC] dark:border-slate-800 rounded-[8px] text-xs font-medium text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAutoFill}
            disabled={disabled || productionStaffUsers.length === 0}
            className="h-[32px] px-2.5 text-xs font-bold text-[#4F46E5] border-indigo-200 hover:bg-indigo-50 rounded-[8px]"
          >
            <Sparkles className="w-3 h-3 mr-1" />
            Auto
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            disabled={disabled || selectedCount === 0}
            className="h-[32px] px-2.5 text-xs font-bold text-slate-500 hover:text-rose-600 rounded-[8px]"
          >
            Clear
          </Button>
        </div>
      </div>

      {/* Staff chip list */}
      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
        {loading ? (
          <div className="p-3 text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#4F46E5]" />
            <span>Loading staff...</span>
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="p-3 text-center text-xs text-slate-400 rounded-lg border border-dashed border-[#E3E6EC]">
            No production staff found.
          </div>
        ) : (
          filteredStaff.map((staff) => {
            const isSelected = (assignedStaffIds || []).includes(staff.id);
            const initial = staff.name ? staff.name.charAt(0).toUpperCase() : 'P';

            return (
              <button
                key={staff.id}
                type="button"
                disabled={disabled}
                onClick={() => handleToggleStaff(staff)}
                className={`w-full p-2.5 rounded-[10px] border text-left transition-all flex items-center gap-3 cursor-pointer select-none ${
                  isSelected
                    ? 'bg-indigo-50/90 dark:bg-indigo-950/60 border-[#4F46E5] text-[#4F46E5] shadow-xs'
                    : 'bg-white dark:bg-slate-900 border-[#E3E6EC] dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-indigo-300'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                  isSelected
                    ? 'bg-[#4F46E5] text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200'
                }`}>
                  {initial}
                </div>

                <div className="flex-1 min-w-0">
                  <div 
                    className="font-bold text-xs text-slate-900 dark:text-white break-words whitespace-normal leading-snug"
                    title={staff.name}
                  >
                    {staff.name}
                  </div>
                  <div 
                    className="text-[10px] text-slate-400 font-mono break-words whitespace-normal leading-tight"
                    title={staff.email}
                  >
                    {staff.email || 'Production Worker'}
                  </div>
                </div>

                {isSelected ? (
                  <CheckCircle2 className="w-4 h-4 text-[#4F46E5] shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full border border-slate-300 shrink-0" />
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
