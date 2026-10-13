import React, { useMemo } from 'react';
import SearchSelect from './SearchSelect';

/**
 * Universal Master UOM Catalog
 * Contains EVERY SINGLE Unit of Measure across the entire ERP:
 * - Weight (metric, imperial, bulk)
 * - Volume (metric, imperial, bulk, packaging)
 * - Pieces / Count / Food Production (Nos, pcs, sticks, cones, cups, tubs, matkas)
 * - Packaging Containers & Secondary Packaging (boxes, cartons, packs, bags, pouches, drums)
 * - Length, Roll & Area (meters, rolls, sheets, reams, sq meters, acres)
 * - Time & Operational Rates (days, hours, shifts)
 * - Energy & Utilities (kWh, MJ)
 */
export const UNIVERSAL_UOM_CATALOG = [
  // ── 1. PRIMARY COUNT & PIECES (Manufacturing Core) ──
  { value: 'Nos', label: 'Nos (Numbers)', subLabel: 'Count / Primary Unit' },
  { value: 'pcs', label: 'pcs (Pieces)', subLabel: 'Count / Individual Items' },
  { value: 'Pcs', label: 'Pcs (Pieces - Capitalized)', subLabel: 'Count' },
  { value: 'Pieces', label: 'Pieces (Full Name)', subLabel: 'Count' },
  { value: 'Numbers', label: 'Numbers (Full Name)', subLabel: 'Count' },
  { value: 'EA', label: 'EA (Each)', subLabel: 'Count / Asset Unit' },
  { value: 'ea', label: 'ea (Each - Lowercase)', subLabel: 'Count' },
  { value: 'Each', label: 'Each (Full Name)', subLabel: 'Count' },
  { value: 'unit', label: 'unit (Unit)', subLabel: 'Count / General' },
  { value: 'Unit', label: 'Unit (Operational Units)', subLabel: 'Overhead / General' },
  { value: 'Units', label: 'Units (Plural)', subLabel: 'General' },
  { value: 'pair', label: 'pair (Pair - 2 items)', subLabel: 'Count' },
  { value: 'Pair', label: 'Pair (Pair)', subLabel: 'Count' },
  { value: 'dozen', label: 'dozen (Dozen - 12 pcs)', subLabel: 'Count' },
  { value: 'Dozen', label: 'Dozen (Dozen)', subLabel: 'Count' },
  { value: 'gross', label: 'gross (Gross - 144 pcs)', subLabel: 'Count' },
  { value: 'Gross', label: 'Gross (Gross)', subLabel: 'Count' },
  { value: 'set', label: 'set (Set)', subLabel: 'Assembly / Set' },
  { value: 'Set', label: 'Set (Set)', subLabel: 'Assembly / Set' },
  { value: 'kit', label: 'kit (Kit)', subLabel: 'Kit' },
  { value: 'Kit', label: 'Kit (Kit)', subLabel: 'Kit' },
  { value: 'bundle', label: 'bundle (Bundle)', subLabel: 'Bundle' },
  { value: 'Bundle', label: 'Bundle (Bundle)', subLabel: 'Bundle' },
  { value: 'lot', label: 'lot (Lot)', subLabel: 'Inventory Lot' },
  { value: 'batch', label: 'batch (Batch / Production Run)', subLabel: 'Production' },
  { value: 'assortment', label: 'assortment (Assortment Pack)', subLabel: 'Specialty' },

  // ── 2. ICE CREAM & KULFI FOOD MANUFACTURING ITEMS ──
  { value: 'stick', label: 'stick (Stick - Kulfi / Ice Candy Stick)', subLabel: 'Ice Cream Production' },
  { value: 'cone', label: 'cone (Cone - Waffle / Sugar Cone)', subLabel: 'Ice Cream Packaging' },
  { value: 'cup', label: 'cup (Cup - Ice Cream Cup / Matka)', subLabel: 'Ice Cream Packaging' },
  { value: 'tub', label: 'tub (Tub - 500ml / 1L / Bulk Tub)', subLabel: 'Ice Cream Packaging' },
  { value: 'matka', label: 'matka (Matka - Clay / Terracotta Pot)', subLabel: 'Kulfi Specialty' },
  { value: 'pot', label: 'pot (Pot - Earthen / Ceramic)', subLabel: 'Kulfi Specialty' },

  // ── 3. WEIGHT MEASURES (Metric, Imperial & Bulk) ──
  { value: 'Kg', label: 'Kg (Kilogram)', subLabel: 'Weight / Standard' },
  { value: 'kg', label: 'kg (Kilogram - Lowercase)', subLabel: 'Weight' },
  { value: 'Kilogram', label: 'Kilogram (Full Name)', subLabel: 'Weight' },
  { value: 'Kilograms', label: 'Kilograms (Plural)', subLabel: 'Weight' },
  { value: 'gm', label: 'gm (Gram)', subLabel: 'Weight / Secondary' },
  { value: 'g', label: 'g (Gram)', subLabel: 'Weight' },
  { value: 'Grm', label: 'Grm (Gram - Legacy)', subLabel: 'Weight' },
  { value: 'Gram', label: 'Gram (Full Name)', subLabel: 'Weight' },
  { value: 'Grams', label: 'Grams (Plural)', subLabel: 'Weight' },
  { value: 'mg', label: 'mg (Milligram)', subLabel: 'Weight / Micro Ingredients' },
  { value: 'ton', label: 'ton (Metric Ton - 1,000 kg)', subLabel: 'Bulk Weight' },
  { value: 'metric ton', label: 'metric ton (1,000 kg)', subLabel: 'Bulk Weight' },
  { value: 'quintal', label: 'quintal (Quintal - 100 kg)', subLabel: 'Bulk Weight' },
  { value: 'lb', label: 'lb (Pound - 453.6 gm)', subLabel: 'Imperial Weight' },
  { value: 'oz', label: 'oz (Ounce)', subLabel: 'Imperial Weight' },

  // ── 4. VOLUME & LIQUID MEASURES ──
  { value: 'liter', label: 'liter (Liter)', subLabel: 'Volume / Standard' },
  { value: 'Liter', label: 'Liter (Liter)', subLabel: 'Volume' },
  { value: 'Ltr', label: 'Ltr (Litre - Abbreviation)', subLabel: 'Volume' },
  { value: 'Litre', label: 'Litre (Full Name)', subLabel: 'Volume' },
  { value: 'Litres', label: 'Litres (Plural)', subLabel: 'Volume' },
  { value: 'ml', label: 'ml (Milliliter)', subLabel: 'Volume / Micro Formulation' },
  { value: 'cl', label: 'cl (Centiliter)', subLabel: 'Volume' },
  { value: 'dl', label: 'dl (Deciliter)', subLabel: 'Volume' },
  { value: 'gallon', label: 'gallon (US Gallon - 3.785 L)', subLabel: 'Liquid Volume' },
  { value: 'quart', label: 'quart (Quart)', subLabel: 'Volume' },
  { value: 'pint', label: 'pint (Pint)', subLabel: 'Volume' },
  { value: 'fluid oz', label: 'fluid oz (Fluid Ounce)', subLabel: 'Volume' },
  { value: 'cubic meter', label: 'cubic meter (m³)', subLabel: 'Bulk Volume' },
  { value: 'cubic cm', label: 'cubic cm (cm³ / cc)', subLabel: 'Volume' },
  { value: 'cubic ft', label: 'cubic ft (ft³)', subLabel: 'Bulk Volume' },
  { value: 'cubic inch', label: 'cubic inch (in³)', subLabel: 'Volume' },

  // ── 5. PACKAGING CONTAINERS & BULK PACKS ──
  { value: 'box', label: 'box (Box)', subLabel: 'Packaging' },
  { value: 'Boxes', label: 'Boxes (Plural)', subLabel: 'Packaging' },
  { value: 'carton', label: 'carton (Carton / Master Shipper)', subLabel: 'Packaging' },
  { value: 'case', label: 'case (Case)', subLabel: 'Packaging' },
  { value: 'pack', label: 'pack (Packet / Inner Pack)', subLabel: 'Packaging' },
  { value: 'packet', label: 'packet (Packet)', subLabel: 'Packaging' },
  { value: 'bag', label: 'bag (Bag - e.g. 25kg / 50kg Sugar/Milk)', subLabel: 'Bulk Raw Material' },
  { value: 'pouch', label: 'pouch (Pouch / Standup Pouch)', subLabel: 'Packaging' },
  { value: 'sack', label: 'sack (Sack)', subLabel: 'Bulk Packaging' },
  { value: 'drum', label: 'drum (Drum - 200 Liter / Chemical / Syrups)', subLabel: 'Liquid Bulk' },
  { value: 'barrel', label: 'barrel (Barrel)', subLabel: 'Bulk Container' },
  { value: 'bottle', label: 'bottle (Bottle)', subLabel: 'Container' },
  { value: 'can', label: 'can (Can / Metal Tin)', subLabel: 'Container' },
  { value: 'cylinder', label: 'cylinder (Gas / Liquid Gas Cylinder)', subLabel: 'Gas / Overhead' },
  { value: 'pallet', label: 'pallet (Pallet - Warehouse Handling)', subLabel: 'Logistics' },
  { value: 'tray', label: 'tray (Tray)', subLabel: 'Packaging' },
  { value: 'tube', label: 'tube (Tube)', subLabel: 'Packaging' },
  { value: 'crate', label: 'crate (Crate / Milk Crate)', subLabel: 'Handling' },

  // ── 6. LENGTH & LINEAR MEASURES ──
  { value: 'meter', label: 'meter (Meter)', subLabel: 'Linear' },
  { value: 'cm', label: 'cm (Centimeter)', subLabel: 'Linear' },
  { value: 'mm', label: 'mm (Millimeter)', subLabel: 'Linear' },
  { value: 'km', label: 'km (Kilometer)', subLabel: 'Distance' },
  { value: 'inch', label: 'inch (Inch)', subLabel: 'Linear' },
  { value: 'feet', label: 'feet (Feet / Foot)', subLabel: 'Linear' },
  { value: 'yard', label: 'yard (Yard)', subLabel: 'Linear' },
  { value: 'mile', label: 'mile (Mile)', subLabel: 'Distance' },

  // ── 7. ROLL, SHEET & PRINTING MATERIALS ──
  { value: 'roll', label: 'roll (Roll - Wrapping Film / Label Roll)', subLabel: 'Packaging Roll' },
  { value: 'sheet', label: 'sheet (Sheet - Board / Paper)', subLabel: 'Sheet' },
  { value: 'ream', label: 'ream (Ream - 500 Sheets)', subLabel: 'Paper / Printing' },

  // ── 8. AREA MEASURES ──
  { value: 'square meter', label: 'square meter (m²)', subLabel: 'Area' },
  { value: 'square ft', label: 'square ft (sq ft)', subLabel: 'Area / Space Rent' },
  { value: 'square cm', label: 'square cm (cm²)', subLabel: 'Area' },
  { value: 'square inch', label: 'square inch (sq in)', subLabel: 'Area' },
  { value: 'square yard', label: 'square yard (sq yd)', subLabel: 'Area' },
  { value: 'acre', label: 'acre (Acre)', subLabel: 'Land Area' },
  { value: 'hectare', label: 'hectare (Hectare)', subLabel: 'Land Area' },

  // ── 9. TIME-BASED & OVERHEAD CHARGES ──
  { value: 'Day', label: 'Day (Day - Factory Rent / Daily Cost)', subLabel: 'Operational Rent' },
  { value: 'day', label: 'day (Daily Rate)', subLabel: 'Time' },
  { value: 'Days', label: 'Days (Plural)', subLabel: 'Time' },
  { value: 'hour', label: 'hour (Hour - Machine Run / Labor)', subLabel: 'Operational Rate' },
  { value: 'shift', label: 'shift (Production Shift - 8h)', subLabel: 'Operational Rate' },

  // ── 10. ENERGY, UTILITIES & POWER ──
  { value: 'kWh', label: 'kWh (Kilowatt-Hour - EB Electricity Units)', subLabel: 'Energy / Electricity' },
  { value: 'MJ', label: 'MJ (Megajoule)', subLabel: 'Thermal Energy' }
];

// String array of all UOM values for legacy components expecting string[]
export const UNIVERSAL_UOM_STRING_LIST = UNIVERSAL_UOM_CATALOG.map(u => u.value);

/**
 * UniversalUomSelect Component
 * Used across the ENTIRE ERP for seamless, searchable, keyboard-friendly UOM selection.
 */
export default function UniversalUomSelect({
  value = '',
  onChange,
  extraOptions = [],
  placeholder = 'Select UOM...',
  searchPlaceholder = 'Search UOM (kg, liter, Nos, box, Unit, stick, Day)...',
  disabled = false,
  error = false,
  className = '',
  triggerClassName = '',
  menuClassName = 'min-w-[220px]',
  size = 'default'
}) {
  // Aggregate all built-in universal UOMs + any dynamic database masters from /api/uom
  const options = useMemo(() => {
    const map = new Map();

    // 1. Preload the complete universal catalog
    UNIVERSAL_UOM_CATALOG.forEach(opt => {
      map.set(opt.value.toLowerCase(), {
        value: opt.value,
        label: opt.label,
        subLabel: opt.subLabel
      });
    });

    // 2. Merge dynamic extra database options (/api/uom)
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

    // 3. Guarantee that ANY existing custom value is included and never lost
    if (value && String(value).trim()) {
      const valStr = String(value).trim();
      const key = valStr.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          value: valStr,
          label: valStr,
          subLabel: 'Custom Unit'
        });
      }
    }

    return Array.from(map.values());
  }, [extraOptions, value]);

  // Match current value with available options
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
      menuClassName={menuClassName}
      size={size}
    />
  );
}
