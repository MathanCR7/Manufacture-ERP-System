import React, { useMemo } from 'react';
import SearchSelect from './SearchSelect';

// Comprehensive list of all manufacturing, inventory, packaging, volume, weight, and operational UOMs
export const COMPREHENSIVE_UOM_OPTIONS = [
  // Primary Manufacturing Standards
  { value: 'Kg', label: 'Kg (Kilogram)', subLabel: 'Weight' },
  { value: 'gm', label: 'gm (Gram)', subLabel: 'Weight' },
  { value: 'mg', label: 'mg (Milligram)', subLabel: 'Weight' },
  { value: 'liter', label: 'liter (Liter / Litre)', subLabel: 'Volume' },
  { value: 'ml', label: 'ml (Milliliter)', subLabel: 'Volume' },
  { value: 'Nos', label: 'Nos (Numbers / Pieces)', subLabel: 'Count' },
  { value: 'pcs', label: 'pcs (Pieces)', subLabel: 'Count' },
  { value: 'Unit', label: 'Unit (Operational Units)', subLabel: 'Overhead / Energy' },
  { value: 'Day', label: 'Day (Daily Rent / Expense)', subLabel: 'Time / Operational' },
  { value: 'hour', label: 'hour (Hourly Rate / Service)', subLabel: 'Time' },

  // Packaging & Bulk Containers
  { value: 'box', label: 'box (Box)', subLabel: 'Packaging' },
  { value: 'carton', label: 'carton (Carton)', subLabel: 'Packaging' },
  { value: 'case', label: 'case (Case)', subLabel: 'Packaging' },
  { value: 'pack', label: 'pack (Packet / Pack)', subLabel: 'Packaging' },
  { value: 'bag', label: 'bag (Bag - e.g. 25kg / 50kg)', subLabel: 'Packaging' },
  { value: 'drum', label: 'drum (Drum - e.g. 200L)', subLabel: 'Bulk Volume' },
  { value: 'bottle', label: 'bottle (Bottle)', subLabel: 'Container' },
  { value: 'can', label: 'can (Can / Tin)', subLabel: 'Container' },
  { value: 'barrel', label: 'barrel (Barrel)', subLabel: 'Bulk Volume' },
  { value: 'cylinder', label: 'cylinder (Gas / CO2 Cylinder)', subLabel: 'Gas / Container' },
  { value: 'pallet', label: 'pallet (Pallet)', subLabel: 'Storage' },
  { value: 'tray', label: 'tray (Tray)', subLabel: 'Packaging' },
  { value: 'tube', label: 'tube (Tube)', subLabel: 'Packaging' },
  { value: 'crate', label: 'crate (Crate)', subLabel: 'Packaging' },
  { value: 'sack', label: 'sack (Sack)', subLabel: 'Packaging' },

  // Volume Standards
  { value: 'gallon', label: 'gallon (Gallon - 3.785 L)', subLabel: 'Volume' },
  { value: 'quart', label: 'quart (Quart)', subLabel: 'Volume' },
  { value: 'pint', label: 'pint (Pint)', subLabel: 'Volume' },
  { value: 'cl', label: 'cl (Centiliter)', subLabel: 'Volume' },
  { value: 'dl', label: 'dl (Deciliter)', subLabel: 'Volume' },
  { value: 'fluid oz', label: 'fluid oz (Fluid Ounce)', subLabel: 'Volume' },
  { value: 'cubic meter', label: 'cubic meter (m³)', subLabel: 'Volume' },
  { value: 'cubic cm', label: 'cubic cm (cm³ / cc)', subLabel: 'Volume' },
  { value: 'cubic ft', label: 'cubic ft (ft³)', subLabel: 'Volume' },
  { value: 'cubic inch', label: 'cubic inch (in³)', subLabel: 'Volume' },

  // Bulk Weight Standards
  { value: 'ton', label: 'ton (Metric Ton - 1000 kg)', subLabel: 'Bulk Weight' },
  { value: 'quintal', label: 'quintal (Quintal - 100 kg)', subLabel: 'Bulk Weight' },
  { value: 'lb', label: 'lb (Pound - 453.6 gm)', subLabel: 'Weight' },
  { value: 'oz', label: 'oz (Ounce)', subLabel: 'Weight' },

  // Count / Batch Sets
  { value: 'dozen', label: 'dozen (Dozen - 12 pcs)', subLabel: 'Count' },
  { value: 'pair', label: 'pair (Pair - 2 pcs)', subLabel: 'Count' },
  { value: 'gross', label: 'gross (Gross - 144 pcs)', subLabel: 'Count' },
  { value: 'set', label: 'set (Set)', subLabel: 'Count' },
  { value: 'kit', label: 'kit (Kit)', subLabel: 'Count' },
  { value: 'bundle', label: 'bundle (Bundle)', subLabel: 'Count' },
  { value: 'batch', label: 'batch (Batch / Formulation Run)', subLabel: 'Production' },
  { value: 'lot', label: 'lot (Lot)', subLabel: 'Inventory' },

  // Length & Roll Standards
  { value: 'meter', label: 'meter (Meter)', subLabel: 'Length' },
  { value: 'cm', label: 'cm (Centimeter)', subLabel: 'Length' },
  { value: 'mm', label: 'mm (Millimeter)', subLabel: 'Length' },
  { value: 'km', label: 'km (Kilometer)', subLabel: 'Length' },
  { value: 'inch', label: 'inch (Inch)', subLabel: 'Length' },
  { value: 'feet', label: 'feet (Feet / Foot)', subLabel: 'Length' },
  { value: 'yard', label: 'yard (Yard)', subLabel: 'Length' },
  { value: 'roll', label: 'roll (Roll - Film / Label)', subLabel: 'Roll' },
  { value: 'sheet', label: 'sheet (Sheet / Paper)', subLabel: 'Sheet' },
  { value: 'ream', label: 'ream (Ream - 500 sheets)', subLabel: 'Sheet' },

  // Area Standards
  { value: 'square meter', label: 'square meter (m²)', subLabel: 'Area' },
  { value: 'square ft', label: 'square ft (sq ft)', subLabel: 'Area' },
  { value: 'square cm', label: 'square cm (cm²)', subLabel: 'Area' },
  { value: 'square inch', label: 'square inch (sq in)', subLabel: 'Area' },
  { value: 'acre', label: 'acre (Acre)', subLabel: 'Area' },
  { value: 'hectare', label: 'hectare (Hectare)', subLabel: 'Area' },

  // Energy & Utilities
  { value: 'kWh', label: 'kWh (Kilowatt-Hour / EB)', subLabel: 'Energy' },
  { value: 'MJ', label: 'MJ (Megajoule)', subLabel: 'Energy' },
  { value: 'shift', label: 'shift (Work Shift)', subLabel: 'Labor / Time' }
];

export default function UomSearchSelect({
  value = '',
  onChange,
  extraOptions = [],
  placeholder = 'Select UOM...',
  searchPlaceholder = 'Search UOM (kg, liter, Nos, box, Unit)...',
  disabled = false,
  error = false,
  className = '',
  triggerClassName = '',
  size = 'default'
}) {
  // Combine comprehensive built-in options with any database UOM masters
  const options = useMemo(() => {
    const map = new Map();

    // 1. Add comprehensive presets
    COMPREHENSIVE_UOM_OPTIONS.forEach(opt => {
      map.set(opt.value.toLowerCase(), {
        value: opt.value,
        label: opt.label,
        subLabel: opt.subLabel
      });
    });

    // 2. Merge database extra options if provided
    (extraOptions || []).forEach(opt => {
      if (!opt) return;
      const val = typeof opt === 'string' ? opt : (opt.abbreviation || opt.name || opt.value || opt.id);
      if (!val) return;
      const key = String(val).toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          value: val,
          label: typeof opt === 'string' ? opt : `${opt.name || val} (${opt.abbreviation || val})`,
          subLabel: opt.category || 'Database Master'
        });
      }
    });

    // 3. If current value exists and is not yet in map, ensure it is included
    if (value && String(value).trim()) {
      const valStr = String(value).trim();
      const key = valStr.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          value: valStr,
          label: valStr,
          subLabel: 'Custom UOM'
        });
      }
    }

    return Array.from(map.values());
  }, [extraOptions, value]);

  // Match the exact case in options if available
  const resolvedValue = useMemo(() => {
    if (!value) return '';
    const match = options.find(o => o.value.toLowerCase() === String(value).toLowerCase());
    return match ? match.value : value;
  }, [options, value]);

  return (
    <SearchSelect
      value={resolvedValue}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      showSearch={true}
      disabled={disabled}
      error={error}
      className={className}
      triggerClassName={triggerClassName}
      size={size}
    />
  );
}
