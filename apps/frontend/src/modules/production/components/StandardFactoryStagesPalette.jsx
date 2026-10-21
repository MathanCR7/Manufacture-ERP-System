import React, { useState, useMemo } from 'react';
import { 
  Layers, Clock, Plus, Trash2, ArrowUp, ArrowDown, 
  Flame, Snowflake, Sparkles, Scale, Package, Tag, 
  CheckCircle2, Warehouse, Sliders, Database, GripVertical,
  Thermometer, Settings, Edit3, X, Check, AlertCircle, Wrench
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export const STANDARD_FACTORY_STAGES = [
  { id: 'pasteurization', name: 'Pasteurization', category: 'Thermal & Mixing', icon: 'flame', desc: 'High temperature batch pasteurization', defaultTemp: '72°C' },
  { id: 'ageing', name: 'Ageing', category: 'Thermal & Mixing', icon: 'clock', desc: 'Mix aging in refrigerated vats at 4°C', defaultTemp: '4°C' },
  { id: 'vat', name: 'VAT', category: 'Thermal & Mixing', icon: 'database', desc: 'Holding and agitation in process tanks', defaultTemp: '10°C' },
  { id: 'mixing', name: 'Mixing', category: 'Thermal & Mixing', icon: 'sliders', desc: 'Ingredient blending and emulsification', defaultTemp: '45°C' },
  { id: 'cf', name: 'CF – Cont. Freezer', category: 'Freezing & Molding', icon: 'snowflake', desc: 'Continuous scraped surface freezing', defaultTemp: '-5°C' },
  { id: 'bf', name: 'BF – Bath Freezer', category: 'Freezing & Molding', icon: 'snowflake', desc: 'Brine tank sub-zero mold immersion', defaultTemp: '-20°C' },
  { id: 'cm', name: 'CM – Candy Machine', category: 'Freezing & Molding', icon: 'sparkles', desc: 'Automated candy stick insertion and demolding', defaultTemp: '-15°C' },
  { id: 'manual-weight', name: 'Manual Weight', category: 'Packing & Finishing', icon: 'scale', desc: 'Tare checkweighing and portion confirmation', defaultTemp: 'Ambient' },
  { id: 'ht', name: 'HT – Hardening Tunnel', category: 'Freezing & Molding', icon: 'snowflake', desc: 'Blast tunnel deep hardening at -35°C', defaultTemp: '-35°C' },
  { id: 'packing', name: 'Packing', category: 'Packing & Finishing', icon: 'package', desc: 'Flow wrap pouching and master carton pack', defaultTemp: '-18°C' },
  { id: 'label-print', name: 'Label and Printing', category: 'Packing & Finishing', icon: 'tag', desc: 'Barcode, batch number and MRP thermal printing', defaultTemp: 'Ambient' },
  { id: 'freezing', name: 'Freezing', category: 'Freezing & Molding', icon: 'snowflake', desc: 'Static spiral freezer holding', defaultTemp: '-25°C' },
  { id: 'qc', name: 'QC', category: 'Quality & Lab', icon: 'check-circle', desc: 'Microbiological test, fat & overrun sampling', defaultTemp: 'Lab' },
  { id: 'storage', name: 'Storage', category: 'Storage & Intake', icon: 'warehouse', desc: 'Finished goods cold room intake at -25°C', defaultTemp: '-25°C' }
];

export default function StandardFactoryStagesPalette({
  stages = [],
  onChangeStages,
  isEditable = true,
  stepNumber = 4
}) {
  // Modal state for editing stage parameters (temperature, duration, notes, etc.)
  const [editingStage, setEditingStage] = useState(null);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

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

  // Sort standard stages: Selected stages FIRST, non-selected displayed AFTER that!
  const sortedPaletteStages = useMemo(() => {
    const selectedList = [];
    const unselectedList = [];

    STANDARD_FACTORY_STAGES.forEach((std) => {
      const matching = stages.find(s => s.name.toLowerCase() === std.name.toLowerCase() || s.id === std.id);
      if (matching) {
        selectedList.push({
          ...std,
          isAdded: true,
          liveData: matching,
          timelineIndex: stages.indexOf(matching)
        });
      } else {
        unselectedList.push({
          ...std,
          isAdded: false,
          liveData: null,
          timelineIndex: -1
        });
      }
    });

    // Sort selected by their timeline position
    selectedList.sort((a, b) => a.timelineIndex - b.timelineIndex);

    return [...selectedList, ...unselectedList];
  }, [stages]);

  // Toggle stage add/remove
  const handleToggleStage = (stdStage) => {
    if (!isEditable) return;
    const existsIndex = stages.findIndex(s => s.name.toLowerCase() === stdStage.name.toLowerCase() || s.id === stdStage.id);
    if (existsIndex >= 0) {
      // Remove
      onChangeStages(stages.filter((_, i) => i !== existsIndex));
    } else {
      // Add
      const newStage = {
        id: stdStage.id,
        name: stdStage.name,
        category: stdStage.category,
        icon: stdStage.icon,
        desc: stdStage.desc,
        temperature: stdStage.defaultTemp || 'Ambient',
        equipment: '',
        notes: '',
        isCcp: false,
        durationMonths: 0,
        durationDays: 0,
        durationHours: 0,
        durationMinutes: 30
      };
      onChangeStages([...stages, newStage]);
    }
  };

  // Quick duration change from timeline
  const handleUpdateDuration = (idx, field, val) => {
    if (!isEditable) return;
    const num = Math.max(0, parseInt(val, 10) || 0);
    const updated = [...stages];
    updated[idx] = { ...updated[idx], [field]: num };
    onChangeStages(updated);
  };

  // Remove stage
  const handleRemoveStage = (idx) => {
    if (!isEditable) return;
    onChangeStages(stages.filter((_, i) => i !== idx));
  };

  // Up / Down click reordering
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

  // HTML5 Drag and drop handlers
  const handleDragStart = (e, index) => {
    if (!isEditable) return;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (!isEditable || draggedIndex === null) return;
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    if (!isEditable || draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }
    const updated = [...stages];
    const [draggedItem] = updated.splice(draggedIndex, 1);
    updated.splice(targetIndex, 0, draggedItem);
    onChangeStages(updated);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Open modal to configure details (e.g. Temperature, Equipment, Hours, Days)
  const handleOpenEditModal = (stage, idx) => {
    setEditingStage({
      ...stage,
      index: idx,
      durationDays: stage.durationDays ?? 0,
      durationHours: stage.durationHours ?? 0,
      durationMinutes: stage.durationMinutes ?? 30,
      temperature: stage.temperature || stage.defaultTemp || '4°C',
      equipment: stage.equipment || '',
      notes: stage.notes || '',
      isCcp: Boolean(stage.isCcp)
    });
  };

  // Save changes from modal
  const handleSaveModalDetails = () => {
    if (!editingStage || editingStage.index === undefined) return;
    const updated = [...stages];
    updated[editingStage.index] = {
      ...updated[editingStage.index],
      durationDays: Number(editingStage.durationDays || 0),
      durationHours: Number(editingStage.durationHours || 0),
      durationMinutes: Number(editingStage.durationMinutes || 0),
      temperature: editingStage.temperature,
      equipment: editingStage.equipment,
      notes: editingStage.notes,
      isCcp: editingStage.isCcp
    };
    onChangeStages(updated);
    setEditingStage(null);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-[#E3E6EC] dark:border-slate-800 rounded-[12px] p-5 shadow-xs space-y-6">
      
      {/* ── STEP 4 COMBINED HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#E3E6EC] dark:border-slate-800 gap-2">
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-full bg-[#4F46E5] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
            {stepNumber}
          </span>
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Factory stages palette &amp; Timeline sequence
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Click stage chip to add/remove • Click any stage to configure temperature &amp; duration • Drag &amp; drop to reorder
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-[#4F46E5] dark:text-indigo-300 border border-indigo-200/60">
            {stages.length} of 14 selected
          </span>
          <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-[#0F7B5F] dark:text-emerald-300 border border-emerald-200">
            Total Duration: {totalDurationStr}
          </span>
        </div>
      </div>

      {/* ── PART 1: FACTORY STAGES PALETTE (SELECTED FIRST, NOT SELECTED AFTER THAT) ── */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
            AVAILABLE STAGES PALETTE (SELECTED STAGES FIRST)
          </span>
          <span className="text-[11px] text-slate-400">
            {stages.length} Added • {14 - stages.length} Available
          </span>
        </div>

        {/* 7-column grid of 14 toggle chips (selected first, not selected after that) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-2.5">
          {sortedPaletteStages.map((std, idx) => {
            const isAdded = std.isAdded;
            const seqStr = isAdded ? String(std.timelineIndex + 1).padStart(2, '0') : String(idx + 1).padStart(2, '0');
            const temp = std.liveData?.temperature || std.defaultTemp;

            return (
              <div
                key={std.id}
                className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between min-h-[92px] group ${
                  isAdded
                    ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500 shadow-xs ring-1 ring-emerald-500/30'
                    : 'bg-white dark:bg-slate-900 border-[#E3E6EC] dark:border-slate-800 hover:border-indigo-300 hover:shadow-xs'
                }`}
              >
                {/* Top: sequence badge + Added/Add toggle */}
                <div className="flex items-start justify-between w-full">
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    isAdded
                      ? 'bg-[#0F7B5F] text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}>
                    {seqStr}
                  </span>

                  <button
                    type="button"
                    disabled={!isEditable}
                    onClick={() => handleToggleStage(std)}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full cursor-pointer transition-colors ${
                      isAdded
                        ? 'bg-[#0F7B5F] text-white hover:bg-rose-600'
                        : 'text-slate-400 hover:text-white hover:bg-[#4F46E5] bg-slate-100 dark:bg-slate-800'
                    }`}
                    title={isAdded ? 'Click to remove from timeline' : 'Click to add to timeline'}
                  >
                    {isAdded ? '✓ Added' : '+ Add'}
                  </button>
                </div>

                {/* Middle: Stage Name & Category (Clickable to edit details if added) */}
                <div 
                  className={`pt-2 ${isAdded ? 'cursor-pointer hover:opacity-80' : ''}`}
                  onClick={() => {
                    if (isAdded) {
                      handleOpenEditModal(std.liveData, std.timelineIndex);
                    } else {
                      handleToggleStage(std);
                    }
                  }}
                  title={isAdded ? 'Click to configure stage parameters (temperature, duration)' : 'Click to add stage'}
                >
                  <div className="font-bold text-xs text-slate-900 dark:text-white break-words whitespace-normal leading-tight flex items-center gap-1">
                    {renderIcon(std.icon, "w-3 h-3 text-[#4F46E5] shrink-0")}
                    <span>{std.name}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 break-words line-clamp-1 pt-0.5">
                    {std.category}
                  </div>
                </div>

                {/* Bottom: Pill indicator with Temperature & Duration (if added) */}
                {isAdded && (
                  <div 
                    onClick={() => handleOpenEditModal(std.liveData, std.timelineIndex)}
                    className="mt-1.5 pt-1.5 border-t border-emerald-200/60 dark:border-emerald-800/60 flex items-center justify-between text-[10px] font-mono font-bold text-emerald-800 dark:text-emerald-300 cursor-pointer"
                    title="Click to edit temperature & duration"
                  >
                    <span className="flex items-center gap-0.5">
                      <Thermometer className="w-3 h-3 text-emerald-600" />
                      {temp || '4°C'}
                    </span>
                    <span className="text-slate-500 font-normal">
                      {std.liveData?.durationMinutes ? `${std.liveData.durationMinutes}m` : '0m'}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── PART 2: TIMELINE SEQUENCE WITH DRAG & DROP REORDERING ── */}
      <div className="space-y-2.5 pt-2 border-t border-[#E3E6EC] dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>Timeline sequence</span>
              <span className="text-[11px] text-slate-400 font-normal">
                ({stages.length} stages • drag &amp; drop to reorder or click to edit parameters)
              </span>
            </h4>
          </div>
          <span className="text-xs font-mono font-bold text-[#0F7B5F]">
            Processing Duration: {totalDurationStr}
          </span>
        </div>

        {stages.length === 0 ? (
          <div className="p-8 rounded-xl border border-dashed border-[#E3E6EC] dark:border-slate-800 text-center text-slate-400 space-y-2 bg-slate-50/50">
            <Clock className="w-8 h-8 mx-auto text-slate-400" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
              No stages selected for this production timeline
            </p>
            <p className="text-xs text-slate-500">
              Click any stage in the Factory Stages Palette above to configure the processing pipeline.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-[#E3E6EC] dark:border-slate-800 divide-y divide-[#E3E6EC] dark:divide-slate-800 overflow-hidden bg-white dark:bg-slate-900 shadow-2xs">
            {stages.map((stage, idx) => {
              const seqStr = String(idx + 1).padStart(2, '0');
              const isDragging = draggedIndex === idx;
              const isDragOver = dragOverIndex === idx;

              return (
                <div 
                  key={stage.id || idx}
                  draggable={isEditable}
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={(e) => handleDrop(e, idx)}
                  onDragEnd={handleDragEnd}
                  className={`p-3.5 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                    isDragging ? 'opacity-40 bg-indigo-50 border-2 border-dashed border-[#4F46E5]' : ''
                  } ${
                    isDragOver ? 'bg-indigo-50/80 border-t-2 border-indigo-500' : 'hover:bg-slate-50/70 dark:hover:bg-slate-850/60'
                  }`}
                >
                  {/* Left: Drag handle + Sequence number + Clickable Stage details */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Drag Handle with Grip icon */}
                    <div 
                      className="flex items-center gap-1.5 shrink-0 text-slate-400 cursor-grab active:cursor-grabbing hover:text-slate-600"
                      title="Drag and drop to change sequence position"
                    >
                      <GripVertical className="w-4 h-4" />
                      <div className="w-7 h-7 rounded-full bg-indigo-50 dark:bg-indigo-950 text-[#4F46E5] font-mono font-black text-xs flex items-center justify-center border border-indigo-200/60 shadow-2xs">
                        {seqStr}
                      </div>
                    </div>

                    {/* Stage Name & Badges (Clicking opens popup) */}
                    <div 
                      onClick={() => handleOpenEditModal(stage, idx)}
                      className="space-y-0.5 flex-1 min-w-0 cursor-pointer group"
                      title="Click to configure parameters (temperature, duration, notes)"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-[#4F46E5] transition-colors break-words">
                          {stage.name}
                        </h4>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {stage.category || 'Thermal & Mixing'}
                        </span>

                        {/* Temperature Tag */}
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                          <Thermometer className="w-3 h-3 text-amber-600" />
                          {stage.temperature || '4°C'}
                        </span>

                        {/* Equipment / Machine Tag */}
                        {stage.equipment && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1">
                            <Wrench className="w-3 h-3 text-slate-500" />
                            {stage.equipment}
                          </span>
                        )}

                        {/* Edit Button Pill */}
                        <span className="text-[10px] text-slate-400 group-hover:text-[#4F46E5] flex items-center gap-0.5">
                          <Edit3 className="w-3 h-3" />
                          Edit Details
                        </span>
                      </div>

                      <p className="text-xs text-slate-500 dark:text-slate-400 break-words line-clamp-1">
                        {stage.desc || stage.notes || 'Industrial standard automated continuous process sequence'}
                      </p>
                    </div>

                    {/* Up / Down Reorder buttons */}
                    {isEditable && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveStage(idx, 'up')}
                          className="p-1.5 rounded-md border border-[#E3E6EC] hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent text-slate-600 cursor-pointer"
                          title="Move stage earlier in sequence"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === stages.length - 1}
                          onClick={() => handleMoveStage(idx, 'down')}
                          className="p-1.5 rounded-md border border-[#E3E6EC] hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent text-slate-600 cursor-pointer"
                          title="Move stage later in sequence"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Right: Duration inputs (Day / Hr / Min) + Delete button */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    <div className="flex items-center gap-1.5">
                      <div className="text-center">
                        <label className="text-[9px] font-bold uppercase text-slate-400 block mb-0.5">Day</label>
                        <input
                          type="number"
                          min="0"
                          disabled={!isEditable}
                          value={stage.durationDays ?? 0}
                          onChange={(e) => handleUpdateDuration(idx, 'durationDays', e.target.value)}
                          className="w-[52px] h-[36px] text-center font-mono font-bold text-xs bg-white dark:bg-slate-900 border border-[#E3E6EC] dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
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
                          className="w-[52px] h-[36px] text-center font-mono font-bold text-xs bg-white dark:bg-slate-900 border border-[#E3E6EC] dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
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
                          className="w-[52px] h-[36px] text-center font-mono font-bold text-xs bg-white dark:bg-slate-900 border border-[#E3E6EC] dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
                        />
                      </div>
                    </div>

                    {isEditable && (
                      <button
                        type="button"
                        onClick={() => handleRemoveStage(idx)}
                        className="p-2 ml-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                        title="Remove stage from sequence"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Live Sequence Footer */}
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

      {/* ── STAGE DETAILS POPUP MODAL (TEMPERATURE, DAYS, HR, MIN, EQUIPMENT, NOTES) ── */}
      {editingStage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div 
            className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-2xl rounded-2xl flex flex-col overflow-hidden text-xs animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between select-none">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                  {renderIcon(editingStage.icon, "w-5 h-5")}
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                    <span>{editingStage.name} Parameters</span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-indigo-300 border border-indigo-500/30">
                      Stage #{String((editingStage.index || 0) + 1).padStart(2, '0')}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {editingStage.category} • Configure temperature, timeline duration &amp; SOP instructions
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditingStage(null)}
                className="text-slate-400 hover:text-white rounded-lg p-1 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              
              {/* Duration Parameters: Days, Hours, Minutes */}
              <div className="space-y-2 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <Label className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center justify-between">
                  <span>Stage Duration</span>
                  <span className="font-mono text-xs text-[#0F7B5F]">
                    Total: {editingStage.durationDays || 0}d {editingStage.durationHours || 0}h {editingStage.durationMinutes || 0}m
                  </span>
                </Label>

                <div className="grid grid-cols-3 gap-3 pt-1">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-slate-500 uppercase">Days</Label>
                    <Input
                      type="number"
                      min="0"
                      value={editingStage.durationDays}
                      onChange={(e) => setEditingStage({ ...editingStage, durationDays: e.target.value })}
                      className="h-[40px] text-center font-mono font-bold text-xs rounded-lg"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-slate-500 uppercase">Hours</Label>
                    <Input
                      type="number"
                      min="0"
                      value={editingStage.durationHours}
                      onChange={(e) => setEditingStage({ ...editingStage, durationHours: e.target.value })}
                      className="h-[40px] text-center font-mono font-bold text-xs rounded-lg"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-slate-500 uppercase">Minutes</Label>
                    <Input
                      type="number"
                      min="0"
                      value={editingStage.durationMinutes}
                      onChange={(e) => setEditingStage({ ...editingStage, durationMinutes: e.target.value })}
                      className="h-[40px] text-center font-mono font-bold text-xs rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* Temperature Parameter */}
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Thermometer className="w-4 h-4 text-amber-500" />
                  <span>Process Temperature Setpoint (°C)</span>
                </Label>

                <Input
                  value={editingStage.temperature}
                  onChange={(e) => setEditingStage({ ...editingStage, temperature: e.target.value })}
                  placeholder="e.g. 4°C, -18°C, 72°C"
                  className="h-[42px] font-mono font-bold text-xs rounded-xl"
                />

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[10px] font-bold text-slate-400">Presets:</span>
                  {['4°C (Ageing Vat)', '-18°C (Cold Storage)', '-35°C (Hardening)', '72°C (Pasteurizer)', '-5°C (Cont. Freezer)'].map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setEditingStage({ ...editingStage, temperature: preset.split(' ')[0] })}
                      className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 hover:bg-indigo-50 hover:text-[#4F46E5] text-slate-600 border border-slate-200 transition-colors cursor-pointer"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Equipment / Machine / Tank Assignment */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Wrench className="w-4 h-4 text-slate-500" />
                  <span>Equipment / Machine Line Assignment</span>
                </Label>
                <Input
                  value={editingStage.equipment}
                  onChange={(e) => setEditingStage({ ...editingStage, equipment: e.target.value })}
                  placeholder="e.g. Ageing Vat #1, Continuous Freezer Line A, Tunnel 1"
                  className="h-[42px] text-xs font-semibold rounded-xl"
                />
              </div>

              {/* Process Instructions & Notes */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Standard Operating Procedure (SOP) &amp; Floor Notes
                </Label>
                <textarea
                  rows={3}
                  value={editingStage.notes}
                  onChange={(e) => setEditingStage({ ...editingStage, notes: e.target.value })}
                  placeholder="Specific agitation instructions, viscosity checks, sample drawing procedure..."
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#4F46E5]"
                />
              </div>

              {/* CCP Checkpoint */}
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40">
                <input
                  type="checkbox"
                  id="ccp-check"
                  checked={editingStage.isCcp}
                  onChange={(e) => setEditingStage({ ...editingStage, isCcp: e.target.checked })}
                  className="w-4 h-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500 cursor-pointer"
                />
                <label htmlFor="ccp-check" className="text-xs font-bold text-slate-900 dark:text-white cursor-pointer select-none">
                  Critical Quality Control Point (CCP) — requires mandatory supervisor signoff
                </label>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 dark:bg-slate-850 px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditingStage(null)}
                className="text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                Cancel
              </Button>

              <Button
                type="button"
                onClick={handleSaveModalDetails}
                className="bg-[#4F46E5] hover:bg-[#4338CA] text-white font-bold text-xs rounded-xl px-5 h-[38px] shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Save Stage Parameters</span>
              </Button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
