import React, { useState } from 'react';
import { 
  Flame, Clock, AlertTriangle, GripVertical, CheckCircle2, 
  ArrowUp, ArrowDown, Save, ShieldAlert, Sparkles, BookOpen, Layers
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function LiveSOPPanel({
  sopSteps = [],
  setSopSteps,
  product = null,
  saveAsNewVersion = false,
  setSaveAsNewVersion
}) {
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [hasReordered, setHasReordered] = useState(false);

  // Drag and Drop reordering
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    try {
      e.dataTransfer.setData('text/plain', index.toString());
    } catch {
      // ignore
    }
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDrop = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const updated = [...sopSteps];
    const [moved] = updated.splice(draggedIndex, 1);
    updated.splice(index, 0, moved);

    setSopSteps(updated);
    setDraggedIndex(null);
    setDragOverIndex(null);
    setHasReordered(true);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Keyboard reordering
  const moveStep = (from, to) => {
    if (to < 0 || to >= sopSteps.length) return;
    const updated = [...sopSteps];
    const [moved] = updated.splice(from, 1);
    updated.splice(to, 0, moved);
    setSopSteps(updated);
    setHasReordered(true);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <h3 className="font-bold text-slate-800 dark:text-white flex items-center text-xs uppercase tracking-wider">
            <Flame className="w-4 h-4 mr-1.5 text-amber-500" />
            Recipe SOP Workflow Steps
          </h3>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
            Chronological instructions for shop-floor batch operators.
          </p>
        </div>

        {sopSteps.length > 0 && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            {sopSteps.length} Steps
          </span>
        )}
      </div>

      {/* Product Recipe Notice */}
      {product && (
        <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <span className="font-bold text-slate-800 dark:text-slate-200 block text-[11px]">
                {product.name} Standard Recipe
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                Formula Code: {product.code}
              </span>
            </div>
          </div>
          {product.isSopLocked && (
            <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[9px] font-bold rounded-full">
              SOP Locked
            </span>
          )}
        </div>
      )}

      {/* Reorder Warning & "Save as new SOP version" Toggle */}
      {hasReordered && (
        <div className="p-3 bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 rounded-xl text-xs space-y-2 animate__animated animate__fadeIn">
          <div className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300 font-bold text-[11px]">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            SOP Sequence Customized for this Batch
          </div>
          <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-normal">
            You modified the execution order. Choose whether to update master product specifications:
          </p>
          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={saveAsNewVersion}
              onChange={(e) => setSaveAsNewVersion?.(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
            />
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Save changes as a new Recipe SOP version in master catalogue
            </span>
          </label>
        </div>
      )}

      {/* Steps List */}
      {sopSteps.length > 0 ? (
        <div className="relative pl-6 space-y-3 max-h-[420px] overflow-y-auto pr-1">
          {/* Vertical Visual Flow Line */}
          <div className="absolute left-2.5 top-4 bottom-4 w-0.5 bg-indigo-100 dark:bg-slate-800 -translate-x-1/2" />

          {sopSteps.map((step, index) => {
            const isDragging = draggedIndex === index;
            const isOver = dragOverIndex === index;

            return (
              <div
                key={index}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                className={`relative group bg-white dark:bg-slate-900 border rounded-xl p-3.5 transition-all duration-200 select-none shadow-2xs ${
                  isDragging
                    ? 'opacity-40 scale-95 border-indigo-400'
                    : isOver
                    ? 'border-indigo-500 bg-indigo-50/20 translate-y-1'
                    : 'border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                {/* Step Connector Dot */}
                <div className="absolute -left-[27.5px] top-4 w-4 h-4 rounded-full bg-white dark:bg-slate-900 border-2 border-indigo-600 dark:border-indigo-400 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                </div>

                {/* Card Header */}
                <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-[10px] uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      Step #{index + 1}
                    </span>
                    {step.stageName && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {step.stageName}
                      </span>
                    )}
                  </div>

                  {/* Drag Handle & Reorder Controls */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveStep(index, index - 1)}
                      disabled={index === 0}
                      className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-30 cursor-pointer"
                      title="Move step up"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveStep(index, index + 1)}
                      disabled={index === sopSteps.length - 1}
                      className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-30 cursor-pointer"
                      title="Move step down"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                    <div
                      className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                      title="Drag to reorder sequence"
                    >
                      <GripVertical className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>

                {/* Instruction Text */}
                <p className="mt-2 text-xs font-medium text-slate-700 dark:text-slate-200 leading-relaxed">
                  {step.instruction || step.stepName || 'Execute standard operation instruction'}
                </p>

                {/* Timing & Safety Notes */}
                {(step.tempTime || step.safetyNote) && (
                  <div className="mt-2.5 pt-2 border-t border-dashed border-slate-100 dark:border-slate-800 space-y-1.5 text-[10px]">
                    {step.tempTime && (
                      <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                        <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span className="font-semibold">Timing / Temp:</span>
                        <span>{step.tempTime}</span>
                      </div>
                    )}
                    {step.safetyNote && (
                      <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 text-amber-800 dark:text-amber-300 flex items-start gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold block uppercase text-[9px]">Safety / Hazard Note</span>
                          <span className="leading-tight">{step.safetyNote}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : product ? (
        <div className="py-12 px-4 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-white/50 dark:bg-slate-900/50 space-y-2">
          <BookOpen className="w-8 h-8 text-amber-400/80 mx-auto" />
          <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300">
            No SOP Steps Formulated
          </h4>
          <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
            This finished product does not have saved SOP recipe steps in its product master catalogue.
          </p>
        </div>
      ) : (
        <div className="py-12 px-4 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-white/50 dark:bg-slate-900/50 space-y-2">
          <Flame className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
          <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300">
            Select a Product
          </h4>
          <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
            Choose a product above to inspect recipe SOP guidelines and critical control points.
          </p>
        </div>
      )}
    </div>
  );
}
