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
  { id: 'cf', name: 'CF – Cont. Freezer', category: 'Freezing & Molding', icon: 'snowflake', desc: 'Continuous scraped surface freezing' },
  { id: 'bf', name: 'BF – Bath Freezer', category: 'Freezing & Molding', icon: 'snowflake', desc: 'Brine tank sub-zero mold immersion' },
  { id: 'cm', name: 'CM – Candy Machine', category: 'Freezing & Molding', icon: 'sparkles', desc: 'Automated candy stick insertion and demolding' },
  { id: 'manual-weight', name: 'Manual Weight', category: 'Packing & Finishing', icon: 'scale', desc: 'Tare checkweighing and portion confirmation' },
  { id: 'ht', name: 'HT – Hardening Tunnel', category: 'Freezing & Molding', icon: 'snowflake', desc: 'Blast tunnel deep hardening at -35°C' },
  { id: 'packing', name: 'Packing', category: 'Packing & Finishing', icon: 'package', desc: 'Flow wrap pouching and master carton pack' },
  { id: 'label-print', name: 'Label and Printing', category: 'Packing & Finishing', icon: 'tag', desc: 'Barcode, batch number and MRP thermal printing' },
  { id: 'freezing', name: 'Freezing', category: 'Freezing & Molding', icon: 'snowflake', desc: 'Static spiral freezer holding' },
  { id: 'qc', name: 'QC', category: 'Quality & Lab', icon: 'check-circle', desc: 'Microbiological test, fat & overrun sampling' },
  { id: 'storage', name: 'Storage', category: 'Storage & Intake', icon: 'warehouse', desc: 'Finished goods cold room intake at -25°C' }
];

export default function StandardFactoryStagesPalette({
  stages = [],
  onChangeStages,
  isEditable = true,
  stagesStepNumber = 5,
  timelineStepNumber = 6
}) {
  const renderIcon = (type, className = "w-4 h-4") => {
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

  // Compute live duration
  const { totalDurationStr, totalMinutes } = useMemo(() => {
    let totalMins = 0;
    stages.forEach(s => {
      const mo = Number(s.durationMonths || 0) * 30 * 24 * 60;
      const day = Number(s.durationDays || 0) * 24 * 60;
      const hr = Number(s.durationHours || 0) * 60;
      const min = Number(s.durationMinutes || 0);
      totalMins += (mo + day + hr + min);
    });

    if (totalMins === 0) return { totalDurationStr: '0m', totalMinutes: 0 };
    const days = Math.floor(totalMins / (24 * 60));
    const remMins = totalMins % (24 * 60);
    const hrs = Math.floor(remMins / 60);
    const mins = remMins % 60;

    let parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hrs > 0) parts.push(`${hrs}h`);
    if (mins > 0 || parts.length === 0) parts.push(`${mins}m`);

    return { totalDurationStr: parts.join(' '), totalMinutes: totalMins };
  }, [stages]);

  const handleToggleStage = (stdStage) => {
    if (!isEditable) return;
    const exists = stages.some(s => s.name.toLowerCase() === stdStage.name.toLowerCase() || s.id === stdStage.id);
    if (exists) {
      onChangeStages(stages.filter(s => s.name.toLowerCase() !== stdStage.name.toLowerCase() && s.id !== stdStage.id));
    } else {
      onChangeStages([
        ...stages,
        {
          id: stdStage.id,
          name: stdStage.name,
          category: stdStage.category,
          icon: stdStage.icon,
          desc: stdStage.desc,
          durationMonths: 0,
          durationDays: 0,
          durationHours: 0,
          durationMinutes: 30
        }
      ]);
    }
  };

  const handleUpdateDuration = (idx, field, val) => {
    if (!isEditable) return;
    const num = Math.max(0, parseInt(val, 10) || 0);
    const updated = [...stages];
    updated[idx] = { ...updated[idx], [field]: num };
    onChangeStages(updated);
  };

  const handleRemoveStage = (idx) => {
    if (!isEditable) return;
    onChangeStages(stages.filter((_, i) => i !== idx));
  };

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
    <div className="space-y-6">
      
      {/* ── 3) FULL-WIDTH SECTION: FACTORY STAGES PALETTE ── */}
      <div className="bg-white dark:bg-slate-900 border border-[#E3E6EC] dark:border-slate-800 rounded-[12px] p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#E3E6EC] dark:border-slate-800 gap-2">
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-full bg-[#4F46E5] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
              {stagesStepNumber}
            </span>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Factory stages palette
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Click any stage chip to add or remove it from the timeline sequence
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-[#4F46E5] dark:text-indigo-300 border border-indigo-200/60">
              {stages.length} of 14 selected
            </span>
          </div>
        </div>

        {/* 7-column grid of 14 toggle chips (collapses to 3 on tablet, 2 on mobile) */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-2.5">
          {STANDARD_FACTORY_STAGES.map((std, idx) => {
            const isAdded = stages.some(s => s.name.toLowerCase() === std.name.toLowerCase() || s.id === std.id);
            const seqStr = String(idx + 1).padStart(2, '0');

            return (
              <button
                key={std.id}
                type="button"
                disabled={!isEditable}
                onClick={() => handleToggleStage(std)}
                className={`p-3 rounded-[12px] border text-left transition-all relative flex flex-col justify-between min-h-[82px] cursor-pointer group ${
                  isAdded
                    ? 'bg-[#0F7B5F]/10 dark:bg-[#0F7B5F]/20 border-[#0F7B5F] shadow-xs'
                    : 'bg-white dark:bg-slate-900 border-[#E3E6EC] dark:border-slate-800 hover:border-indigo-300 hover:shadow-xs'
                }`}
                title={isAdded ? `Click to remove ${std.name}` : `Click to add ${std.name}`}
              >
                <div className="flex items-start justify-between w-full">
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    isAdded
                      ? 'bg-[#0F7B5F] text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}>
                    {seqStr}
                  </span>

                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isAdded
                      ? 'bg-[#0F7B5F] text-white font-extrabold'
                      : 'text-slate-400 group-hover:text-[#4F46E5]'
                  }`}>
                    {isAdded ? '✓ Added' : '+ Add'}
                  </span>
                </div>

                <div className="pt-2">
                  <div 
                    className="font-bold text-xs text-slate-900 dark:text-white break-words whitespace-normal leading-tight"
                    title={std.name}
                  >
                    {std.name}
                  </div>
                  <div className="text-[10px] text-slate-400 break-words line-clamp-1 pt-0.5">
                    {std.category}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 4) FULL-WIDTH SECTION: TIMELINE SEQUENCE ── */}
      <div className="bg-white dark:bg-slate-900 border border-[#E3E6EC] dark:border-slate-800 rounded-[12px] p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#E3E6EC] dark:border-slate-800 gap-2">
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-full bg-[#4F46E5] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
              {timelineStepNumber}
            </span>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Timeline sequence
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {stages.length} stages · reorder sequence or set stage durations
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-[#0F7B5F] dark:text-emerald-300 border border-emerald-200">
              Total Duration: {totalDurationStr}
            </span>
          </div>
        </div>

        {stages.length === 0 ? (
          <div className="p-8 rounded-[12px] border border-dashed border-[#E3E6EC] dark:border-slate-800 text-center text-slate-400 space-y-2 bg-slate-50/50">
            <Clock className="w-8 h-8 mx-auto text-slate-400" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
              No stages selected for this production timeline
            </p>
            <p className="text-xs text-slate-500">
              Click any stage in the Factory Stages Palette above to configure the processing pipeline.
            </p>
          </div>
        ) : (
          <div className="rounded-[12px] border border-[#E3E6EC] dark:border-slate-800 divide-y divide-[#E3E6EC] dark:divide-slate-800 overflow-hidden bg-white dark:bg-slate-900">
            {stages.map((stage, idx) => {
              const seqStr = String(idx + 1).padStart(2, '0');

              return (
                <div 
                  key={stage.id || idx}
                  className="p-3.5 hover:bg-slate-50/70 dark:hover:bg-slate-850/60 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3"
                >
                  {/* Left: Drag handle + Numbered Circle + Stage Name + Tag + Description */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 shrink-0 text-slate-400">
                      <GripVertical className="w-4 h-4 cursor-grab" />
                      <div className="w-7 h-7 rounded-full bg-indigo-50 dark:bg-indigo-950 text-[#4F46E5] font-mono font-black text-xs flex items-center justify-center border border-indigo-200/60">
                        {seqStr}
                      </div>
                    </div>

                    <div className="space-y-0.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 
                          className="font-bold text-sm text-slate-900 dark:text-white break-words whitespace-normal leading-snug"
                          title={stage.name}
                        >
                          {stage.name}
                        </h4>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {stage.category || 'Thermal & Mixing'}
                        </span>
                      </div>
                      <p 
                        className="text-xs text-slate-500 dark:text-slate-400 break-words whitespace-normal line-clamp-1"
                        title={stage.desc || stage.description}
                      >
                        {stage.desc || stage.description || 'Continuous industrial process operation'}
                      </p>
                    </div>

                    {/* Up / Down Reorder buttons */}
                    {isEditable && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveStage(idx, 'up')}
                          className="p-1.5 rounded-[6px] border border-[#E3E6EC] hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent text-slate-600 cursor-pointer"
                          title="Move stage up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === stages.length - 1}
                          onClick={() => handleMoveStage(idx, 'down')}
                          className="p-1.5 rounded-[6px] border border-[#E3E6EC] hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent text-slate-600 cursor-pointer"
                          title="Move stage down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Right: Duration inputs (Mo / Day / Hr / Min - 52px each) + Delete button */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    <div className="flex items-center gap-1.5">
                      <div className="text-center">
                        <label className="text-[9px] font-bold uppercase text-slate-400 block mb-0.5">Mo</label>
                        <input
                          type="number"
                          min="0"
                          disabled={!isEditable}
                          value={stage.durationMonths ?? 0}
                          onChange={(e) => handleUpdateDuration(idx, 'durationMonths', e.target.value)}
                          className="w-[52px] h-[36px] text-center font-mono font-bold text-xs bg-white dark:bg-slate-900 border border-[#E3E6EC] dark:border-slate-800 rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
                        />
                      </div>

                      <div className="text-center">
                        <label className="text-[9px] font-bold uppercase text-slate-400 block mb-0.5">Day</label>
                        <input
                          type="number"
                          min="0"
                          disabled={!isEditable}
                          value={stage.durationDays ?? 0}
                          onChange={(e) => handleUpdateDuration(idx, 'durationDays', e.target.value)}
                          className="w-[52px] h-[36px] text-center font-mono font-bold text-xs bg-white dark:bg-slate-900 border border-[#E3E6EC] dark:border-slate-800 rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
                        />
                      </div>

                      <div className="text-center">
                        <label className="text-[9px] font-bold uppercase text-slate-400 block mb-0.5">Hr</label>
                        <input
                          type="number"
                          min="0"
                          disabled={!isEditable}
                          value={stage.durationHours ?? 0}
                          onChange={(e) => handleUpdateDuration(idx, 'durationHours', e.target.value)}
                          className="w-[52px] h-[36px] text-center font-mono font-bold text-xs bg-white dark:bg-slate-900 border border-[#E3E6EC] dark:border-slate-800 rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
                        />
                      </div>

                      <div className="text-center">
                        <label className="text-[9px] font-bold uppercase text-slate-400 block mb-0.5">Min</label>
                        <input
                          type="number"
                          min="0"
                          disabled={!isEditable}
                          value={stage.durationMinutes ?? 0}
                          onChange={(e) => handleUpdateDuration(idx, 'durationMinutes', e.target.value)}
                          className="w-[52px] h-[36px] text-center font-mono font-bold text-xs bg-white dark:bg-slate-900 border border-[#E3E6EC] dark:border-slate-800 rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
                        />
                      </div>
                    </div>

                    {isEditable && (
                      <button
                        type="button"
                        onClick={() => handleRemoveStage(idx)}
                        className="p-2 ml-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-[8px] transition-colors cursor-pointer"
                        title="Remove stage"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Footer row: Total Duration computed live */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[#4F46E5]" />
                <span>Total Live Sequence Processing Duration:</span>
              </span>
              <span className="font-mono font-black text-sm text-[#0F7B5F] dark:text-emerald-400">
                {totalDurationStr}
              </span>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
