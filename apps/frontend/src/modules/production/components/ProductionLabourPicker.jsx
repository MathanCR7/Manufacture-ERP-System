import React, { useState, useEffect, useMemo } from 'react';
import { api } from '@/lib/axios';
import { 
  Users, UserCheck, HardHat, ShieldCheck, CheckSquare, 
  Square, AlertCircle, CheckCircle2, User, Sparkles, Search, RefreshCw, Info
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
  disabled = false
}) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [errorMsg, setErrorMsg] = useState(null);

  // Fetch users from API (accessible by SUPERVISOR, MAIN_MASTER, PRODUCTION_STAFF)
  const fetchUsers = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // Try /users first; fallback to /admin/users if route exists
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
      setErrorMsg('Could not load staff list. Check user permissions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Filter strictly for users with role === 'PRODUCTION_STAFF'
  const productionStaffUsers = useMemo(() => {
    return users.filter(u => {
      const role = String(u.role || '').trim().toUpperCase();
      // Match exact PRODUCTION_STAFF (or if inactive is false)
      const isProdRole = role === 'PRODUCTION_STAFF';
      const isActive = u.isActive !== false;
      return isProdRole && isActive;
    });
  }, [users]);

  // Filtered by search term
  const filteredStaff = useMemo(() => {
    if (!searchTerm.trim()) return productionStaffUsers;
    const q = searchTerm.toLowerCase();
    return productionStaffUsers.filter(u => 
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.empId && u.empId.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q))
    );
  }, [productionStaffUsers, searchTerm]);

  // Safe numeric count
  const targetCount = Number(labourCount || 0);
  const selectedCount = (assignedStaffIds || []).length;

  // Handle changing the target quantity input
  const handleQuantityChange = (val) => {
    const parsed = parseInt(val, 10);
    const newCount = isNaN(parsed) || parsed < 0 ? 0 : parsed;

    // If new count is smaller than currently selected, trim the selection
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

  // Handle toggling a staff member's checkbox
  const handleToggleStaff = (user) => {
    if (disabled) return;

    const isAlreadySelected = (assignedStaffIds || []).includes(user.id);

    if (isAlreadySelected) {
      // Uncheck
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
      // Check
      // If targetCount is 0, auto-increment targetCount to match
      const effectiveTarget = targetCount === 0 ? selectedCount + 1 : targetCount;

      if (selectedCount >= effectiveTarget) {
        Swal.fire({
          title: 'Staff Limit Reached',
          text: `You have set the required labour count to ${effectiveTarget}. Increase the labour quantity field if you want to assign more workers.`,
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

  // Quick auto-fill up to target count
  const handleAutoFill = () => {
    if (targetCount <= 0) {
      Swal.fire({
        title: 'Specify Worker Count',
        text: 'Please enter a Labour Quantity (number of workers) first.',
        icon: 'info'
      });
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

  // Clear all selections
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
  const isUnder = targetCount > 0 && selectedCount < targetCount;
  const isOver = targetCount > 0 && selectedCount > targetCount;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 shadow-2xs space-y-2.5">
      
      {/* ── CARD HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-900/60 shadow-2xs">
            <HardHat className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white tracking-tight">
                Production Labour & Floor Staff Assignment
              </h3>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                PRODUCTION STAFF ONLY
              </span>
            </div>
            <p className="text-[11px] text-slate-400 line-clamp-1">
              Specify workers required and check off floor staff members to execute this batch
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <div className="text-[11px] text-slate-400 font-semibold hidden md:block">
            Available: <span className="font-mono text-slate-700 dark:text-slate-200 font-bold">{productionStaffUsers.length}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={loading}
            onClick={fetchUsers}
            className="h-7 px-2.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 rounded-lg"
          >
            <RefreshCw className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ── SAP CONSOLE TOOLBAR: WORKERS INPUT + STATUS PILL + AUTO-SELECT + SEARCH ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 bg-slate-50/80 dark:bg-slate-850/60 p-2 rounded-xl border border-slate-200/80 dark:border-slate-800">
        
        {/* Left: Labour Quantity Input + Status Indicator */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
              Labour Qty <span className="text-rose-500">*</span>:
            </Label>
            <div className="relative w-28">
              <Input
                type="number"
                min="0"
                max="50"
                disabled={disabled}
                value={labourCount === 0 ? '' : labourCount}
                onChange={(e) => handleQuantityChange(e.target.value)}
                placeholder="Workers"
                className="h-7.5 rounded-lg font-bold text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 pr-9 py-0"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none">
                Staff
              </span>
            </div>
          </div>

          {/* Status Indicator Pill */}
          <div className="shrink-0">
            {targetCount === 0 ? (
              <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[11px] font-semibold">
                <Info className="w-3.5 h-3.5 text-slate-400" />
                <span>Enter worker count to assign staff</span>
              </div>
            ) : isFulfilled ? (
              <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold shadow-2xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Fulfilled: {selectedCount} of {targetCount} assigned</span>
              </div>
            ) : isUnder ? (
              <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-[11px] font-bold">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                <span>{selectedCount}/{targetCount} selected ({targetCount - selectedCount} more required)</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-[11px] font-bold">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                <span>{selectedCount} selected, exceeds target of {targetCount}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Auto Select + Clear + Staff Search */}
        <div className="flex items-center gap-2 flex-wrap justify-between lg:justify-end">
          {targetCount > 0 && productionStaffUsers.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || selectedCount === targetCount}
              onClick={handleAutoFill}
              className="h-7 px-2 text-[11px] font-bold rounded-lg border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 cursor-pointer"
            >
              <Sparkles className="w-3 h-3 mr-1" />
              Auto Select {targetCount}
            </Button>
          )}

          {selectedCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={handleClear}
              className="h-7 px-2 text-[11px] font-bold text-slate-500 hover:text-rose-600 rounded-lg cursor-pointer"
            >
              Clear
            </Button>
          )}

          {/* Quick Staff Search */}
          <div className="relative w-full sm:w-48">
            <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter staff..."
              className="h-7 pl-7 text-[11px] rounded-lg bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 py-0"
            />
          </div>
        </div>
      </div>

      {/* ── STAFF LIST / CHECKBOX GRID (HIGH DENSITY SAP COCKPIT) ── */}
      {loading ? (
        <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-500" />
          <span>Fetching Production Staff from directory...</span>
        </div>
      ) : productionStaffUsers.length === 0 ? (
        <div className="p-4 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 space-y-1">
          <HardHat className="w-6 h-6 text-slate-300 dark:text-slate-600 mx-auto" />
          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
            No Production Staff Users Found
          </h4>
          <p className="text-[11px] text-slate-400 max-w-md mx-auto">
            To assign workers, create users with the role <b>PRODUCTION_STAFF</b> in User Management (/admin/users).
          </p>
        </div>
      ) : filteredStaff.length === 0 ? (
        <div className="p-3 text-center text-xs text-slate-400">
          No staff members match "{searchTerm}"
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 max-h-44 overflow-y-auto pr-1">
          {filteredStaff.map((staff) => {
            const isSelected = (assignedStaffIds || []).includes(staff.id);
            const isLimitReached = targetCount > 0 && selectedCount >= targetCount && !isSelected;
            const isCardDisabled = disabled || isLimitReached;

            return (
              <div
                key={staff.id}
                onClick={() => {
                  if (!isCardDisabled) {
                    handleToggleStaff(staff);
                  }
                }}
                className={`relative flex items-center gap-2 p-2 rounded-xl border transition-all cursor-pointer select-none ${
                  isSelected
                    ? 'bg-indigo-50/80 dark:bg-indigo-950/50 border-indigo-400 dark:border-indigo-700 shadow-2xs'
                    : isLimitReached
                    ? 'opacity-40 bg-slate-50/50 dark:bg-slate-850/30 border-slate-200/60 dark:border-slate-800 cursor-not-allowed'
                    : 'bg-white dark:bg-slate-850/70 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-800/60 hover:bg-slate-50/80'
                }`}
                title={isLimitReached ? `Target limit of ${targetCount} reached. Increase count to add more.` : ''}
              >
                {/* Styled Checkbox */}
                <div className="shrink-0">
                  {isSelected ? (
                    <div className="w-4 h-4 rounded-md bg-indigo-600 text-white flex items-center justify-center shadow-2xs">
                      <CheckSquare className="w-3.5 h-3.5 fill-current text-white" />
                    </div>
                  ) : (
                    <div className={`w-4 h-4 rounded-md border flex items-center justify-center ${
                      isLimitReached 
                        ? 'border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800' 
                        : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                    }`}>
                      <Square className="w-3 h-3 text-transparent" />
                    </div>
                  )}
                </div>

                {/* Avatar with initials */}
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[11px] shrink-0 ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }`}>
                  {staff.name ? staff.name.charAt(0).toUpperCase() : 'P'}
                </div>

                {/* Staff details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {staff.name}
                    </span>
                    {staff.empId && (
                      <span className="text-[8.5px] font-mono font-bold px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 shrink-0">
                        {staff.empId}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                    <span className="font-mono truncate">{staff.email || 'Floor Worker'}</span>
                  </div>
                </div>

                {/* Assigned indicator */}
                {isSelected && (
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Selected staff chips bar */}
      {selectedCount > 0 && (
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5 flex-wrap text-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Assigned ({selectedCount}):
          </span>
          {labourStaffDetails.map((staff, idx) => (
            <div
              key={staff.id || idx}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800/80 text-indigo-700 dark:text-indigo-300 font-medium text-[11px] shadow-2xs"
            >
              <UserCheck className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
              <span>{staff.name}</span>
              {staff.empId && <span className="font-mono text-[9.5px] opacity-75">({staff.empId})</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
