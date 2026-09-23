import React, { useState, useRef, useMemo } from 'react';
import { 
  Layers, GripVertical, AlertTriangle, CheckCircle2, Plus, Trash2, 
  RotateCcw, Info, ArrowUp, ArrowDown, Search, X, Package, ShieldAlert,
  ChevronRight, Sparkles, Scale, Database
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function LiveBOMPanel({
  bomItems = [],
  setBomItems,
  loading = false,
  product = null,
  batchQty = 1,
  allRawMaterials = [],
  onUndoRemove = null,
  removedItem = null,
  onClearUndo = null
}) {
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [isAddingIngredient, setIsAddingIngredient] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const [selectedRmToAdd, setSelectedRmToAdd] = useState(null);
  const [addQty, setAddQty] = useState(1);
  const [showReservationPreview, setShowReservationPreview] = useState(true);

  // Compute live aggregates
  const { totalBatchCost, insufficientItems, sufficientCount } = useMemo(() => {
    let cost = 0;
    const insufficient = [];
    let suffCount = 0;

    bomItems.forEach(item => {
      const itemCost = Number(item.requiredQty || 0) * Number(item.unitCost || 0);
      cost += itemCost;
      const isSufficient = Number(item.availableStock || 0) >= Number(item.requiredQty || 0);
      if (!isSufficient) {
        insufficient.push({
          ...item,
          shortfall: Number(item.requiredQty || 0) - Number(item.availableStock || 0)
        });
      } else {
        suffCount++;
      }
    });

    return {
      totalBatchCost: cost,
      insufficientItems: insufficient,
      sufficientCount: suffCount
    };
  }, [bomItems]);

  // Handle Drag and Drop
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Transparent or custom drag preview
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

    const updated = [...bomItems];
    const [movedItem] = updated.splice(draggedIndex, 1);
    updated.splice(index, 0, movedItem);

    setBomItems(updated);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Keyboard reordering fallback
  const moveItem = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= bomItems.length) return;
    const updated = [...bomItems];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    setBomItems(updated);
  };

  // Inline quantity edit
  const handleQuantityChange = (index, newQty) => {
    const qty = Math.max(0.001, Number(newQty) || 0);
    const updated = [...bomItems];
    const current = updated[index];
    const available = Number(current.availableStock || 0);
    const status = available >= qty ? 'Sufficient' : 'Insufficient';
    const totalCost = qty * Number(current.unitCost || 0);

    updated[index] = {
      ...current,
      requiredQty: qty,
      totalCost,
      status
    };
    setBomItems(updated);
  };

  // Remove ingredient with Undo support
  const handleRemoveItem = (index) => {
    const itemToRemove = bomItems[index];
    const updated = bomItems.filter((_, i) => i !== index);
    setBomItems(updated);
    onUndoRemove?.(itemToRemove, index);
  };

  // Add extra/substitute ingredient
  const handleConfirmAddIngredient = () => {
    if (!selectedRmToAdd) return;

    const available = Number(selectedRmToAdd.currentStock || 0);
    const qty = Math.max(0.01, Number(addQty) || 1);
    const unitPrice = Number(selectedRmToAdd.unitPrice || selectedRmToAdd.purchasePrice || 0);
    const status = available >= qty ? 'Sufficient' : 'Insufficient';

    const newItem = {
      id: `custom-${Date.now()}-${selectedRmToAdd.id}`,
      rawMaterialId: selectedRmToAdd.id,
      rmId: selectedRmToAdd.id,
      rawMaterialName: selectedRmToAdd.name,
      rawMaterialCode: selectedRmToAdd.code,
      unit: selectedRmToAdd.uom?.abbreviation || selectedRmToAdd.unitId || 'kg',
      requiredQty: qty,
      consumption: qty / (batchQty || 1),
      availableStock: available,
      unitCost: unitPrice,
      totalCost: qty * unitPrice,
      status,
      isCustomAddition: true
    };

    setBomItems([...bomItems, newItem]);
    setIsAddingIngredient(false);
    setSelectedRmToAdd(null);
    setAddSearch('');
    setAddQty(1);
  };

  // Filter raw materials for add picker
  const filteredRMs = useMemo(() => {
    const existingIds = new Set(bomItems.map(i => i.rawMaterialId || i.rmId));
    const term = addSearch.toLowerCase().trim();
    return allRawMaterials
      .filter(rm => !existingIds.has(rm.id))
      .filter(rm => {
        if (!term) return true;
        return (
          rm.name?.toLowerCase().includes(term) ||
          rm.code?.toLowerCase().includes(term) ||
          rm.category?.name?.toLowerCase().includes(term)
        );
      })
      .slice(0, 15);
  }, [allRawMaterials, bomItems, addSearch]);

  return (
    <div className="space-y-4">
      {/* Panel Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <h3 className="font-bold text-slate-800 dark:text-white flex items-center text-xs uppercase tracking-wider">
            <Layers className="w-4 h-4 mr-1.5 text-indigo-600 dark:text-indigo-400" />
            Live Recipe BOM Check
          </h3>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
            Inventory reserves calculated live for {batchQty} {product?.unit?.abbreviation || 'pcs'}.
          </p>
        </div>

        {bomItems.length > 0 && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            {bomItems.length} Ingredients
          </span>
        )}
      </div>

      {/* Prominent Batch Material Cost Card */}
      <div className="p-3.5 bg-gradient-to-br from-indigo-50/90 via-white to-violet-50/80 dark:from-slate-900 dark:via-indigo-950/20 dark:to-slate-900 rounded-2xl border border-indigo-100 dark:border-indigo-900/60 shadow-xs flex items-center justify-between">
        <div>
          <span className="text-[10px] uppercase font-extrabold tracking-wider text-indigo-700 dark:text-indigo-400 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            Batch Material Cost
          </span>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
            Total RM input cost for this batch
          </p>
        </div>
        <div className="text-right">
          <span className="font-mono font-black text-xl text-indigo-700 dark:text-indigo-300">
            ₹{totalBatchCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <div className="text-[9px] text-slate-400 mt-0.5">
            ≈ ₹{(batchQty > 0 ? totalBatchCost / batchQty : 0).toFixed(2)} / {product?.unit?.abbreviation || 'unit'}
          </div>
        </div>
      </div>

      {/* Undo Toast Banner if item was removed */}
      {removedItem && (
        <div className="p-2.5 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 rounded-xl flex items-center justify-between text-xs shadow-lg animate__animated animate__fadeIn">
          <div className="flex items-center gap-2 truncate min-w-0 pr-2">
            <span className="text-slate-300 dark:text-slate-600 text-[11px]">Removed:</span>
            <span className="font-semibold truncate text-[11px]">{removedItem.rawMaterialName}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onUndoRemove}
              className="px-2.5 py-1 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              Undo
            </button>
            <button
              type="button"
              onClick={onClearUndo}
              className="p-1 text-slate-400 hover:text-white dark:hover:text-slate-800"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading ? (
        <div className="space-y-2.5 py-6">
          <div className="text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
            <div className="w-5 h-5 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
            <span>Checking live inventory reserves & recipe items...</span>
          </div>
          <div className="space-y-2 pt-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800/60 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      ) : bomItems.length > 0 ? (
        <div className="space-y-2.5">
          {/* Helper hint for drag & reorder */}
          <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
            <span className="flex items-center gap-1">
              <GripVertical className="w-3 h-3 text-slate-300 dark:text-slate-600" />
              Drag cards to arrange processing sequence
            </span>
            <span>
              {sufficientCount} / {bomItems.length} Sufficient
            </span>
          </div>

          {/* Draggable Raw Material Cards List */}
          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
            {bomItems.map((item, index) => {
              const reqQty = Number(item.requiredQty || 0);
              const availStock = Number(item.availableStock || 0);
              const isSufficient = availStock >= reqQty;
              const shortfall = reqQty - availStock;
              const isDragging = draggedIndex === index;
              const isOver = dragOverIndex === index;

              return (
                <div
                  key={item.id || item.rawMaterialId || index}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`relative p-3 rounded-xl border transition-all duration-200 select-none ${
                    isDragging
                      ? 'opacity-40 scale-95 border-indigo-400 shadow-inner'
                      : isOver
                      ? 'border-indigo-500 bg-indigo-50/30 dark:bg-indigo-950/20 translate-y-1'
                      : isSufficient
                      ? 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs'
                      : 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60 shadow-2xs'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {/* Drag Handle */}
                    <div
                      className="mt-1 cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded touch-none"
                      title="Drag to reorder sequence"
                    >
                      <GripVertical className="w-4 h-4" />
                    </div>

                    {/* Content Body */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-semibold text-xs text-slate-800 dark:text-slate-100 truncate">
                            {item.rawMaterialName}
                          </span>
                          {item.rawMaterialCode && (
                            <span className="px-1 py-0.2 rounded text-[9px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800">
                              {item.rawMaterialCode}
                            </span>
                          )}
                          {item.isCustomAddition && (
                            <span className="px-1 py-0.2 rounded text-[8px] font-bold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/60 border border-violet-200 dark:border-violet-800">
                              Added
                            </span>
                          )}
                        </div>

                        {/* Sufficiency Badge */}
                        <div className="shrink-0">
                          {isSufficient ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              Sufficient
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-800 animate-pulse">
                              <AlertTriangle className="w-2.5 h-2.5 text-rose-500" />
                              Insufficient
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Quantities & Inline Edit Row */}
                      <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2 items-center text-[10px]">
                        {/* Inline Editable Required Quantity */}
                        <div className="space-y-0.5">
                          <label className="text-slate-400 uppercase font-bold text-[9px] block">
                            Required ({item.unit || 'units'})
                          </label>
                          <div className="flex items-center">
                            <input
                              type="number"
                              min="0.001"
                              step="any"
                              value={reqQty}
                              onChange={(e) => handleQuantityChange(index, e.target.value)}
                              className="w-20 px-1.5 py-0.5 font-mono font-bold text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>
                        </div>

                        {/* Available Warehouse Stock */}
                        <div className="space-y-0.5">
                          <label className="text-slate-400 uppercase font-bold text-[9px] block">
                            Warehouse Stock
                          </label>
                          <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                            {availStock.toFixed(2)} {item.unit || ''}
                          </span>
                        </div>

                        {/* Projected Remaining or Shortfall */}
                        <div className="space-y-0.5 col-span-2 sm:col-span-1">
                          <label className="text-slate-400 uppercase font-bold text-[9px] block">
                            {isSufficient ? 'Remaining' : 'Shortfall'}
                          </label>
                          {isSufficient ? (
                            <span className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400 block">
                              +{(availStock - reqQty).toFixed(2)}
                            </span>
                          ) : (
                            <span className="font-mono text-xs font-bold text-rose-600 dark:text-rose-400 block">
                              −{shortfall.toFixed(2)} {item.unit || ''}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Cost Line & Accessibility Reorder Controls */}
                      <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
                        <span className="font-mono">
                          Est. Cost: ₹{(reqQty * Number(item.unitCost || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>

                        <div className="flex items-center gap-1">
                          {/* Accessibility arrow buttons to move up/down */}
                          <button
                            type="button"
                            onClick={() => moveItem(index, index - 1)}
                            disabled={index === 0}
                            title="Move up sequence"
                            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowUp className="w-3 h-3 text-slate-500" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveItem(index, index + 1)}
                            disabled={index === bomItems.length - 1}
                            title="Move down sequence"
                            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowDown className="w-3 h-3 text-slate-500" />
                          </button>

                          {/* Delete item */}
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            title="Remove ingredient from batch"
                            className="p-1 rounded text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer transition-colors ml-1"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add Raw Material Button & Popover */}
          {!isAddingIngredient ? (
            <button
              type="button"
              onClick={() => setIsAddingIngredient(true)}
              className="w-full py-2.5 px-3 border border-dashed border-indigo-300 dark:border-indigo-800/70 hover:border-indigo-500 rounded-xl text-indigo-600 dark:text-indigo-400 text-xs font-bold hover:bg-indigo-50/40 dark:hover:bg-indigo-950/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              + Add Extra / Substitute Ingredient
            </button>
          ) : (
            <div className="p-3 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-xl shadow-md space-y-2.5 animate__animated animate__fadeIn">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1">
                  <Package className="w-3.5 h-3.5 text-indigo-500" />
                  Add Raw Material to Batch
                </span>
                <button
                  type="button"
                  onClick={() => setIsAddingIngredient(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Search Raw Material */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={addSearch}
                  onChange={(e) => setAddSearch(e.target.value)}
                  placeholder="Search raw material name or code..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1.5 focus:ring-indigo-500/30"
                />
              </div>

              {/* Picker List */}
              <div className="max-h-36 overflow-y-auto space-y-1 divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-lg p-1 bg-slate-50/50 dark:bg-slate-950/30">
                {filteredRMs.length > 0 ? (
                  filteredRMs.map(rm => {
                    const isSelected = selectedRmToAdd?.id === rm.id;
                    const stock = Number(rm.currentStock || 0);
                    return (
                      <div
                        key={rm.id}
                        onClick={() => setSelectedRmToAdd(rm)}
                        className={`px-2 py-1.5 rounded-md flex items-center justify-between text-xs cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-indigo-600 text-white font-bold'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        <div className="truncate pr-2">
                          <span className="block truncate">{rm.name}</span>
                          <span className={`text-[10px] font-mono ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>
                            {rm.code} • Stock: {stock} {rm.uom?.abbreviation || ''}
                          </span>
                        </div>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-center py-3 text-[11px] text-slate-400 italic">No available raw materials found</p>
                )}
              </div>

              {selectedRmToAdd && (
                <div className="flex items-center gap-2 pt-1">
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Required Quantity</label>
                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      value={addQty}
                      onChange={(e) => setAddQty(Number(e.target.value) || 1)}
                      className="w-full px-2 py-1 text-xs font-mono font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={handleConfirmAddIngredient}
                    className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg h-8 px-3"
                  >
                    Add to BOM
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Sticky BOM Shortfall Warning Banner */}
          {insufficientItems.length > 0 && (
            <div className="p-3 bg-rose-50 border border-rose-200/90 dark:bg-rose-950/40 dark:border-rose-900 rounded-xl space-y-1 text-xs text-rose-800 dark:text-rose-300 animate__animated animate__shakeX">
              <div className="flex items-center gap-1.5 font-bold uppercase text-[10px] tracking-wide text-rose-700 dark:text-rose-400">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                <span>BOM Shortfall Warning ({insufficientItems.length} Materials Insufficient)</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Production batch start will be blocked until inventory is replenished or quantities are adjusted:
              </p>
              <ul className="list-disc pl-4 space-y-0.5 text-[10px] font-medium">
                {insufficientItems.map(item => (
                  <li key={item.id || item.rawMaterialId}>
                    <span className="font-semibold">{item.rawMaterialName}</span>: Shortfall of{' '}
                    <span className="font-bold font-mono">
                      {item.shortfall.toFixed(2)} {item.unit || 'units'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        /* Friendly Empty State */
        <div className="py-12 px-4 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-white/50 dark:bg-slate-900/50 space-y-2">
          <Scale className="w-8 h-8 text-indigo-400/80 mx-auto" />
          <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300">
            No Product Selected
          </h4>
          <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
            Choose a finished product and yield batch size in the form to view real-time raw material reserves and recipe BOM.
          </p>
        </div>
      )}
    </div>
  );
}
