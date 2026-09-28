import React, { useState } from 'react';
import {
  Tag, Sliders, Sparkles, Box, Scale, Ruler, Shield, Plus,
  Trash2, Info, Check, AlertCircle, ChevronDown, ChevronUp, Globe
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export default function DynamicProductSpecPanel({
  template,
  specifications = {},
  setSpecifications,
  customAttributes = [],
  setCustomAttributes,
  // Universal attributes
  brand, setBrand,
  productName, setProductName,
  description, setDescription,
  dimensionLength, setDimensionLength,
  dimensionWidth, setDimensionWidth,
  dimensionHeight, setDimensionHeight,
  dimensionUnit, setDimensionUnit,
  weightValue, setWeightValue,
  weightUnit, setWeightUnit,
  material, setMaterial,
  color, setColor,
  size, setSize,
  modelNumber, setModelNumber,
  upcEan, setUpcEan,
  countryOfOrigin, setCountryOfOrigin,
  warranty, setWarranty,
  keyFeatures, setKeyFeatures
}) {
  const [activeTab, setActiveTab] = useState('universal'); // 'universal' | 'template' | 'custom'

  // Update dynamic spec value
  const handleSpecChange = (fieldKey, value) => {
    setSpecifications(prev => ({
      ...prev,
      [fieldKey]: value
    }));
  };

  // Custom attributes management
  const handleAddCustomAttr = () => {
    setCustomAttributes(prev => [...prev, { key: '', value: '' }]);
  };

  const handleCustomAttrChange = (index, field, val) => {
    setCustomAttributes(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: val };
      return updated;
    });
  };

  const handleRemoveCustomAttr = (index) => {
    setCustomAttributes(prev => prev.filter((_, idx) => idx !== index));
  };

  // Group template fields by section
  const fieldsBySection = React.useMemo(() => {
    if (!template || !template.fields) return {};
    const groups = {};
    template.fields.forEach(f => {
      const sec = f.section || 'General Specs';
      if (!groups[sec]) groups[sec] = [];
      groups[sec].push(f);
    });
    return groups;
  }, [template]);

  const templateFieldCount = template?.fields?.length || 0;

  return (
    <div className="space-y-4 pt-2">
      {/* Sub-Tabs for Specifications */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('universal')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'universal'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Box className="w-3.5 h-3.5" />
          Universal Identity &amp; Dimensions
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('template')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'template'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          Subcategory Quality Specs
          {templateFieldCount > 0 && (
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeTab === 'template' ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
            }`}>
              {templateFieldCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('custom')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'custom'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Ad-Hoc Custom Specs ({customAttributes.length})
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: Universal Core Attributes
         ───────────────────────────────────────────────────────────── */}
      {activeTab === 'universal' && (
        <div className="space-y-4 animate-in fade-in-50 duration-150">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <Label className="text-2xs font-bold text-slate-500 uppercase block">Brand / Manufacturer</Label>
              <Input
                value={brand || ''}
                style={{ textTransform: 'uppercase' }}
                onChange={e => setBrand(e.target.value.toUpperCase())}
                placeholder="E.G. KULFI HERITAGE / ACME"
                className="mt-1 text-xs font-semibold"
              />
            </div>

            <div>
              <Label className="text-2xs font-bold text-slate-500 uppercase block">Model / Item Number</Label>
              <Input
                value={modelNumber || ''}
                style={{ textTransform: 'uppercase' }}
                onChange={e => setModelNumber(e.target.value.toUpperCase())}
                placeholder="E.G. MOD-KLF-001"
                className="mt-1 text-xs font-mono font-semibold"
              />
            </div>

            <div>
              <Label className="text-2xs font-bold text-slate-500 uppercase block">UPC / EAN Barcode</Label>
              <Input
                value={upcEan || ''}
                onChange={e => setUpcEan(e.target.value)}
                placeholder="12 or 13-digit barcode"
                className="mt-1 text-xs font-mono"
              />
            </div>
          </div>

          {/* Physical Dimensions & Weight */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Ruler className="w-3.5 h-3.5 text-indigo-500" />
              Dimensions &amp; Logistics Weight
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <Label className="text-[11px] font-semibold text-slate-500">Length</Label>
                <Input
                  type="number"
                  step="any"
                  value={dimensionLength ?? ''}
                  onChange={e => setDimensionLength(e.target.value)}
                  placeholder="0.0"
                  className="mt-1 text-xs bg-white dark:bg-slate-900"
                />
              </div>

              <div>
                <Label className="text-[11px] font-semibold text-slate-500">Width</Label>
                <Input
                  type="number"
                  step="any"
                  value={dimensionWidth ?? ''}
                  onChange={e => setDimensionWidth(e.target.value)}
                  placeholder="0.0"
                  className="mt-1 text-xs bg-white dark:bg-slate-900"
                />
              </div>

              <div>
                <Label className="text-[11px] font-semibold text-slate-500">Height</Label>
                <Input
                  type="number"
                  step="any"
                  value={dimensionHeight ?? ''}
                  onChange={e => setDimensionHeight(e.target.value)}
                  placeholder="0.0"
                  className="mt-1 text-xs bg-white dark:bg-slate-900"
                />
              </div>

              <div>
                <Label className="text-[11px] font-semibold text-slate-500">Dimension Unit</Label>
                <select
                  value={dimensionUnit || 'cm'}
                  onChange={e => setDimensionUnit(e.target.value)}
                  className="w-full mt-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="cm">cm (Centimeter)</option>
                  <option value="inches">inches</option>
                  <option value="mm">mm (Millimeter)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <Label className="text-[11px] font-semibold text-slate-500">Net Product Weight</Label>
                <Input
                  type="number"
                  step="any"
                  value={weightValue ?? ''}
                  onChange={e => setWeightValue(e.target.value)}
                  placeholder="e.g. 0.12"
                  className="mt-1 text-xs bg-white dark:bg-slate-900"
                />
              </div>

              <div>
                <Label className="text-[11px] font-semibold text-slate-500">Weight Unit</Label>
                <select
                  value={weightUnit || 'kg'}
                  onChange={e => setWeightUnit(e.target.value)}
                  className="w-full mt-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="kg">kg (Kilograms)</option>
                  <option value="g">g (Grams)</option>
                  <option value="lbs">lbs (Pounds)</option>
                  <option value="oz">oz (Ounces)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Product Appearance & Materials */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <Label className="text-2xs font-bold text-slate-500 uppercase block">Material / Composition</Label>
              <Input
                value={material || ''}
                style={{ textTransform: 'uppercase' }}
                onChange={e => setMaterial(e.target.value.toUpperCase())}
                placeholder="E.G. 100% DAIRY MILK SOLIDS"
                className="mt-1 text-xs font-semibold"
              />
            </div>

            <div>
              <Label className="text-2xs font-bold text-slate-500 uppercase block">Color / Shade</Label>
              <Input
                value={color || ''}
                style={{ textTransform: 'uppercase' }}
                onChange={e => setColor(e.target.value.toUpperCase())}
                placeholder="E.G. CREAM WHITE / GOLDEN SAFFRON"
                className="mt-1 text-xs font-semibold"
              />
            </div>

            <div>
              <Label className="text-2xs font-bold text-slate-500 uppercase block">Size Variant</Label>
              <Input
                value={size || ''}
                style={{ textTransform: 'uppercase' }}
                onChange={e => setSize(e.target.value.toUpperCase())}
                placeholder="E.G. 80ML STICK / 1000ML TUB"
                className="mt-1 text-xs font-semibold"
              />
            </div>
          </div>

          {/* Country of Origin, Warranty & Key Features */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <Label className="text-2xs font-bold text-slate-500 uppercase block">Country of Origin</Label>
              <Input
                value={countryOfOrigin || ''}
                style={{ textTransform: 'uppercase' }}
                onChange={e => setCountryOfOrigin(e.target.value.toUpperCase())}
                placeholder="E.G. INDIA"
                className="mt-1 text-xs font-semibold"
              />
            </div>

            <div>
              <Label className="text-2xs font-bold text-slate-500 uppercase block">Warranty / Guarantee Terms</Label>
              <Input
                value={warranty || ''}
                onChange={e => setWarranty(e.target.value)}
                placeholder="e.g. 6 Months Deep Freeze Quality Guarantee"
                className="mt-1 text-xs"
              />
            </div>
          </div>

          <div>
            <Label className="text-2xs font-bold text-slate-500 uppercase block">
              Key Features (Bullet Points separated by "|")
            </Label>
            <Input
              value={keyFeatures || ''}
              onChange={e => setKeyFeatures(e.target.value)}
              placeholder="e.g. 100% Pure Milk | Slow Simmered | No Artificial Flavors | Rich Saffron Infusion"
              className="mt-1 text-xs"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Separate features with vertical pipe "|" to render as bullet points on catalog cards.
            </p>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: Dynamic Subcategory Specification Template
         ───────────────────────────────────────────────────────────── */}
      {activeTab === 'template' && (
        <div className="space-y-4 animate-in fade-in-50 duration-150">
          {!template || !template.fields || template.fields.length === 0 ? (
            <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/30">
              <Sliders className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2 stroke-[1.5]" />
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                No Specification Template Assigned to this Subcategory
              </p>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto mt-1">
                You can configure specification fields under "Product Categories &gt; Subcategories" or add ad-hoc specifications in the next tab.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(fieldsBySection).map(([sectionName, fields]) => (
                <div
                  key={sectionName}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs"
                >
                  <div className="bg-slate-50 dark:bg-slate-800/60 px-4 py-2 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 uppercase">
                      <Tag className="w-3 h-3 text-indigo-500" />
                      {sectionName?.toUpperCase()}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500">
                      {fields.length} parameter{fields.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {fields.map(f => {
                      const currentValue = specifications[f.fieldKey] !== undefined
                        ? specifications[f.fieldKey]
                        : (f.defaultValue || '');

                      return (
                        <div key={f.id || f.fieldKey} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="text-2xs font-bold text-slate-700 dark:text-slate-200 uppercase block">
                              {f.fieldName?.toUpperCase()}
                              {f.isMandatory && <span className="text-rose-500 ml-1">*</span>}
                              {f.unitOfMeasure && (
                                <span className="ml-1 text-[10px] text-indigo-500 font-mono font-bold uppercase">
                                  ({f.unitOfMeasure.toUpperCase()})
                                </span>
                              )}
                            </label>
                            {f.isMandatory && (
                              <span className="text-[9px] font-bold text-rose-500 uppercase">
                                Mandatory
                              </span>
                            )}
                          </div>

                          {f.fieldType === 'BOOLEAN' ? (
                            <div className="flex items-center gap-2 pt-1">
                              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={!!currentValue && currentValue !== 'false'}
                                  onChange={e => handleSpecChange(f.fieldKey, e.target.checked)}
                                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 uppercase">
                                  {currentValue && currentValue !== 'false' ? 'YES (APPLICABLE)' : 'NO (NONE)'}
                                </span>
                              </label>
                            </div>
                          ) : ['SELECT', 'MULTI_SELECT'].includes(f.fieldType) && Array.isArray(f.options) && f.options.length > 0 ? (
                            <select
                              value={currentValue}
                              onChange={e => handleSpecChange(f.fieldKey, e.target.value)}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 h-10 px-3 py-2 text-xs focus:outline-none uppercase font-semibold"
                            >
                              <option value="">SELECT {f.fieldName?.toUpperCase()}...</option>
                              {f.options.map(opt => (
                                <option key={opt} value={opt}>{String(opt).toUpperCase()}</option>
                              ))}
                            </select>
                          ) : (
                            <Input
                              type={f.fieldType === 'NUMBER' ? 'number' : f.fieldType === 'DATE' ? 'date' : 'text'}
                              step={f.fieldType === 'NUMBER' ? 'any' : undefined}
                              min={f.minValue !== null ? f.minValue : undefined}
                              max={f.maxValue !== null ? f.maxValue : undefined}
                              value={currentValue}
                              style={f.fieldType === 'TEXT' ? { textTransform: 'uppercase' } : undefined}
                              onChange={e => handleSpecChange(f.fieldKey, f.fieldType === 'TEXT' ? e.target.value.toUpperCase() : e.target.value)}
                              placeholder={f.placeholder ? f.placeholder.toUpperCase() : `ENTER ${f.fieldName?.toUpperCase()}...`}
                              className="text-xs font-semibold"
                            />
                          )}

                          {f.helpText && (
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {f.helpText}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 3: Ad-Hoc Key-Value Custom Specifications
         ───────────────────────────────────────────────────────────── */}
      {activeTab === 'custom' && (
        <div className="space-y-3 animate-in fade-in-50 duration-150">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Custom Key-Value Attributes for this Product
            </span>
            <Button
              type="button"
              onClick={handleAddCustomAttr}
              size="sm"
              variant="outline"
              className="text-xs flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add Attribute
            </Button>
          </div>

          {customAttributes.length === 0 ? (
            <div className="p-6 text-center border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-400">
              No custom ad-hoc attributes added. Click "+ Add Attribute" to define custom specifications.
            </div>
          ) : (
            <div className="space-y-2">
              {customAttributes.map((attr, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    value={attr.key}
                    style={{ textTransform: 'uppercase' }}
                    onChange={e => handleCustomAttrChange(idx, 'key', e.target.value.toUpperCase())}
                    placeholder="ATTRIBUTE KEY (E.G. EXPORT APPROVAL NO)"
                    className="text-xs font-semibold flex-1"
                  />
                  <span className="text-slate-400 font-bold">:</span>
                  <Input
                    value={attr.value}
                    style={{ textTransform: 'uppercase' }}
                    onChange={e => handleCustomAttrChange(idx, 'value', e.target.value.toUpperCase())}
                    placeholder="ATTRIBUTE VALUE (E.G. EXP-2026-99)"
                    className="text-xs font-semibold flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveCustomAttr(idx)}
                    className="h-8 w-8 p-0 text-rose-500 hover:text-rose-700"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
