import React, { useMemo } from 'react';
import { 
  Layers, Clock, Plus, Trash2, ArrowUp, ArrowDown, 
  Flame, Snowflake, Sparkles, Scale, Package, Tag, 
  CheckCircle2, Warehouse, Sliders, Database, GripVertical 
} from 'lucide-react';

export const STANDARD_FACTORY_STAGES = [
  { id: 'pasteurization', name: 'Pasteurization', category: 'Thermal & Mixing', icon: 'flame', desc: 'High temperature batch pasteurization' },
  { id: 'ageing', name: 'Ageing', category: 'Thermal & Mixing', icon: 'clock', desc: 'Mix aging in refrigerated vats at 4°C' },
  { id: 'vat', name: 'VAT', category: 'Thermal & Mixing', icon: 'database', desc: 'Holding and agitation in process tanks' },
  { id: 'mixing', name: 'Mixing', category: 'Thermal & Mixing', icon: 'sliders', desc: 'Ingredient blending and emulsification' },
  { id: 'cf', name: 'CF - Cont. Freezer', category: 'Freezing & Molding', icon: 'snowflake', desc: 'Continuous scraped surface freezing' },
  { id: 'bf', name: 'BF - Bath Freezer', category: 'Freezing & Molding', icon: 'snowflake', desc: 'Brine tank sub-zero mold immersion' },
  { id: 'cm', name: 'CM - Candy Machine', category: 'Freezing & Molding', icon: 'sparkles', desc: 'Automated candy stick insertion and demolding' },
  { id: 'manual-weight', name: 'Manual Weight', category: 'Packing & Finishing', icon: 'scale', desc: 'Tare checkweighing and portion confirmation' },
  { id: 'ht', name: 'HT - Hardening Tunnel', category: 'Freezing & Molding', icon: 'snowflake', desc: 'Blast tunnel deep hardening at -35°C' },
  { id: 'packing', name: 'PACKING', category: 'Packing & Finishing', icon: 'package', desc: 'Flow wrap pouching and master carton pack' },
  { id: 'label-print', name: 'LABLE AND PRINTING', category: 'Packing & Finishing', icon: 'tag', desc: 'Barcode, batch number and MRP thermal printing' },
  { id: 'freezing', name: 'Freezing', category: 'Freezing & Molding', icon: 'snowflake', desc: 'Static spiral freezer holding' },
  { id: 'qc', name: 'QC', category: 'Quality & Lab', icon: 'check-circle', desc: 'Microbiological test, fat & overrun sampling' },
  { id: 'storage', name: 'Storage', category: 'Storage & Intake', icon: 'warehouse', desc: 'Finished goods cold room intake at -25°C' }
];

export default function StandardFactoryStagesPalette({
  stages = [],
  onChangeStages,
  isEditable = true
}) {
  // Render icon helper
  const renderIcon = (type, className = "w-3.5 h-3.5") => {
    switch (type) {
      case 'flame': return <Flame className={className} />;
      case 'clock': return <Clock className={className} />;
      case 'database': return <Database className={className} />;
      case 'sliders': return <Sliders className={className} />;
      case 'snowflake': return <Snowflake className={className} />;
      case 'sparkles': return <Sparkles className={className} />;
      case 'scale': return <Scale className={className} />;
      case 'package': return <Package className={className} />;
      case 'tag': return <Tag className={className} />;
      case 'check-circle': return <CheckCircle2 className={className} />;
      case 'warehouse': return <Warehouse className={className} />;
      default: return <Layers className={className} />;
    }
  };

  // Calculate total duration in human readable string
  const totalDurationStr = useMemo(() => {
    let totalMins = 0;
    stages.forEach(s => {
      const mo = Number(s.durationMonths || 0) * 30 * 24 * 60;
      const day = Number(s.durationDays || 0) * 24 * 60;
      const hr = Number(s.durationHours || 0) * 60;
      const min = Number(s.durationMinutes || 0);
      totalMins += (mo + day + hr + min);
    });

    if (totalMins === 0) return '0m';
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  }, [stages]);

  // Toggle stage chip
  const handleToggleStage = (stdStage) => {
    if (!isEditable) return;
    const exists = stages.some(s => s.name.toLowerCase() === stdStage.name.toLowerCase());
    if (exists) {
      // Remove
      onChangeStages(stages.filter(s => s.name.toLowerCase() !== stdStage.name.toLowerCase()));
    } else {
      // Add
      onChangeStages([
        ...stages,
        {
          id: stdStage.id,
          name: stdStage.name,
          category: stdStage.category,
          icon: stdStage.icon,
          description: stdStage.desc,
          durationMonths: 0,
          durationDays: 0,
          durationHours: 0,
          durationMinutes: 0
        }
      ]);
    }
  };

  // Update specific field for stage at index
  const handleUpdateStage = (idx, field, val) => {
    if (!isEditable) return;
    const updated = [...stages];
    updated[idx] = { ...updated[idx], [field]: val };
    onChangeStages(updated);
  };

  // Remove stage at index
  const handleRemoveStage = (idx) => {
    if (!isEditable) return;
    onChangeStages(stages.filter((_, i) => i !== idx));
  };

  // Move stage up or down
  const handleMoveStage = (idx, direction) => {
    if (!isEditable) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= stages.length) return;
    const updated = [...stages];
    const temp = updated[idx];
    updated[idx] = updated[targetIdx];
    updated[targetIdx] = temp;
    onChangeStages(updated);
  };

  return (
    <div className="space-y-4">
      
      {/* ── 14 STANDARD FACTORY STAGES PALETTE ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                Standard Factory Stages Palette
              </h4>
              <p className="text-[11px] text-slate-400">
                Click any stage chip to toggle (add or remove) from your timeline.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60">
              {stages.length} / 14 Selected
            </span>
            <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
              Duration: {totalDurationStr}
            </span>
          </div>
        </div>

        {/* 14 Stage Chips Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
          {STANDARD_FACTORY_STAGES.map((std, idx) => {
            const isAdded = stages.some(s => s.name.toLowerCase() === std.name.toLowerCase());
            return (
              <button
                key={std.name}
                type="button"
                disabled={!isEditable}
                onClick={() => handleToggleStage(std)}
                className={`p-2 rounded-2xl text-left border transition-all relative flex flex-col justify-between h-[76px] group cursor-pointer ${
                  isAdded
                    ? 'bg-emerald-50/60 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-700 shadow-xs hover:border-rose-400 hover:bg-rose-50/40'
                    : 'bg-slate-50/70 dark:bg-slate-950/50 border-slate-200/80 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-xs'
                }`}
                title={isAdded ? `Click to remove "${std.name}"` : `Click to add "${std.name}"`}
              >
                <div className="flex items-start justify-between w-full">
                  <div className={`p-1 rounded-lg transition-colors ${
                    isAdded
                      ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 group-hover:bg-rose-100 group-hover:text-rose-700'
                      : 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700'
                  }`}>
                    {renderIcon(std.icon, "w-3 h-3")}
                  </div>

                  <span className={`text-[9.5px] font-mono font-bold px-1.5 py-0.5 rounded-md ${
                    isAdded
                      ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 group-hover:bg-rose-100 group-hover:text-rose-700'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}>
                    <span className={isAdded ? 'group-hover:hidden' : ''}>
                      {isAdded ? '✓ Added' : `+ ${idx + 1}`}
                    </span>
                    {isAdded && <span className="hidden group-hover:inline text-rose-600 font-bold">✕ Del</span>}
                  </span>
                </div>

                <div>
                  <div className="font-extrabold text-slate-900 dark:text-white text-[11px] leading-tight truncate">
                    {std.name}
                  </div>
                  <div className={`text-[9px] truncate transition-colors ${
                    isAdded 
                      ? 'text-emerald-600 dark:text-emerald-400 group-hover:text-rose-600 font-bold' 
                      : 'text-slate-400 dark:text-slate-500'
                  }`}>
                    {isAdded ? 'Click to remove' : std.category}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── CONFIGURED TIMELINE SEQUENCE (DRAG & DROP / REORDER) ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-500" />
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
              Configured Timeline Sequence ({stages.length} {stages.length === 1 ? 'stage' : 'stages'})
            </h4>
          </div>

          <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
            <GripVertical className="w-3.5 h-3.5" />
            Drag and drop cards or use arrows to reorder sequence
          </span>
        </div>

        {stages.length === 0 ? (
          <div className="py-8 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
            <Layers className="w-6 h-6 mx-auto mb-1 opacity-40 text-indigo-500" />
            <p className="text-xs font-bold">No stages configured yet.</p>
            <p className="text-[10px] mt-0.5">Click any stage chip above to add it to this production timeline sequence.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {stages.map((stage, idx) => (
              <div
                key={stage.id || stage.name || idx}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-950 hover:border-indigo-300 dark:hover:border-indigo-700/60 shadow-3xs gap-3 transition-colors"
              >
                {/* Left: Seq Badge & Name & Category */}
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button
                      type="button"
                      disabled={!isEditable || idx === 0}
                      onClick={() => handleMoveStage(idx, 'up')}
                      className="p-0.5 rounded text-slate-400 hover:text-indigo-600 disabled:opacity-20 cursor-pointer"
                      title="Move up"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      disabled={!isEditable || idx === stages.length - 1}
                      onClick={() => handleMoveStage(idx, 'down')}
                      className="p-0.5 rounded text-slate-400 hover:text-indigo-600 disabled:opacity-20 cursor-pointer"
                      title="Move down"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                  </div>

                  <span className="w-7 h-7 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-mono font-black text-xs flex items-center justify-center shrink-0 border border-indigo-200/60 dark:border-indigo-800/60">
                    #{idx + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-xs text-slate-900 dark:text-white">
                        {stage.name}
                      </span>
                      <span className="text-[9.5px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border border-slate-200/60 dark:border-slate-700">
                        {stage.category}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">
                      {stage.description || stage.desc || 'Standard processing stage'}
                    </p>
                  </div>
                </div>

                {/* Right: Duration inputs (Mo, Day, Hr, Min) & Delete */}
                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 p-1 rounded-xl border border-slate-200/60 dark:border-slate-800 text-[10px] font-bold">
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        disabled={!isEditable}
                        value={stage.durationMonths || 0}
                        onChange={(e) => handleUpdateStage(idx, 'durationMonths', Number(e.target.value))}
                        className="w-8 h-6 text-center rounded bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 font-mono font-bold"
                      />
                      <span className="text-slate-400">Mo</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        disabled={!isEditable}
                        value={stage.durationDays || 0}
                        onChange={(e) => handleUpdateStage(idx, 'durationDays', Number(e.target.value))}
                        className="w-8 h-6 text-center rounded bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 font-mono font-bold"
                      />
                      <span className="text-slate-400">Day</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        disabled={!isEditable}
                        value={stage.durationHours || 0}
                        onChange={(e) => handleUpdateStage(idx, 'durationHours', Number(e.target.value))}
                        className="w-8 h-6 text-center rounded bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 font-mono font-bold"
                      />
                      <span className="text-slate-400">Hr</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        disabled={!isEditable}
                        value={stage.durationMinutes || 0}
                        onChange={(e) => handleUpdateStage(idx, 'durationMinutes', Number(e.target.value))}
                        className="w-8 h-6 text-center rounded bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 font-mono font-bold"
                      />
                      <span className="text-slate-400">Min</span>
                    </div>
                  </div>

                  {isEditable && (
                    <button
                      type="button"
                      onClick={() => handleRemoveStage(idx)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      title="Remove stage"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
