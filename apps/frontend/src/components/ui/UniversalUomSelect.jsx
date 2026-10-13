import React, { useMemo } from 'react';
import SearchSelect from './SearchSelect';

/**
 * Common legacy/alias normalizer mapping to uppercase standard units
 */
export const UOM_ALIAS_MAP = {
  'KG': 'KG',
  'KGS': 'KG',
  'KILOGRAM': 'KG',
  'KILOGRAMS': 'KG',
  'PCS': 'PCS',
  'PIECE': 'PCS',
  'PIECES': 'PCS',
  'PC': 'PCS',
  'ML': 'ML',
  'MILLILITER': 'ML',
  'MILLILITRE': 'ML',
  'NOS': 'NOS',
  'NO': 'NOS',
  'NUMBERS': 'NOS',
  'NUMBER': 'NOS',
  'LTR': 'LTR',
  'LITER': 'LTR',
  'LITRE': 'LTR',
  'LITRES': 'LTR',
  'LITERS': 'LTR',
  'GM': 'GM',
  'G': 'GM',
  'GRAM': 'GM',
  'GRAMS': 'GM',
  'GRM': 'GM',
  'MG': 'MG',
  'MILLIGRAM': 'MG',
  'TON': 'TON',
  'TONS': 'TON',
  'METRIC TON': 'TON',
  'QUINTAL': 'QUINTAL',
  'QUINTALS': 'QUINTAL',
  'BOX': 'BOX',
  'BOXES': 'BOX',
  'CTN': 'CARTON',
  'CARTON': 'CARTON',
  'CARTONS': 'CARTON',
  'CASE': 'CASE',
  'CASES': 'CASE',
  'PACK': 'PACK',
  'PACKS': 'PACK',
  'PACKET': 'PKT',
  'PKT': 'PKT',
  'PKTS': 'PKT',
  'BAG': 'BAG',
  'BAGS': 'BAG',
  'POUCH': 'POUCH',
  'POUCHES': 'POUCH',
  'DRUM': 'DRUM',
  'DRUMS': 'DRUM',
  'CAN': 'CAN',
  'CANS': 'CAN',
  'BOTTLE': 'BOTTLE',
  'BOTTLES': 'BOTTLE',
  'BTL': 'BOTTLE',
  'MTR': 'MTR',
  'METER': 'MTR',
  'METERS': 'MTR',
  'METRE': 'MTR',
  'SQM': 'SQM',
  'SQUARE METER': 'SQM',
  'SQUARE METRE': 'SQM',
  'SQFT': 'SQFT',
  'SQUARE FT': 'SQFT',
  'SQUARE FEET': 'SQFT',
  'ROLL': 'ROLL',
  'ROLLS': 'ROLL',
  'SHEET': 'SHEET',
  'SHEETS': 'SHEET',
  'UNIT': 'UNIT',
  'UNITS': 'UNIT',
  'EA': 'EA',
  'EACH': 'EA',
  'PAIR': 'PAIR',
  'PAIRS': 'PAIR',
  'DOZEN': 'DOZEN',
  'DOZENS': 'DOZEN',
  'DZN': 'DOZEN',
  'SET': 'SET',
  'SETS': 'SET',
  'KIT': 'KIT',
  'KITS': 'KIT',
  'BUNDLE': 'BUNDLE',
  'BUNDLES': 'BUNDLE',
  'BDL': 'BUNDLE',
  'STICK': 'STICK',
  'STICKS': 'STICK',
  'CONE': 'CONE',
  'CONES': 'CONE',
  'CUP': 'CUP',
  'CUPS': 'CUP',
  'TUB': 'TUB',
  'TUBS': 'TUB',
  'MATKA': 'MATKA',
  'MATKAS': 'MATKA',
  'POT': 'POT',
  'POTS': 'POT',
  'DAY': 'DAY',
  'DAYS': 'DAY',
  'HR': 'HR',
  'HRS': 'HR',
  'HOUR': 'HR',
  'HOURS': 'HR',
  'KWH': 'KWH'
};

/**
 * Normalize any UOM input to standard UPPERCASE unit code
 */
export const normalizeUom = (val) => {
  if (!val) return '';
  const trimmedUpper = String(val).trim().toUpperCase();
  return UOM_ALIAS_MAP[trimmedUpper] || trimmedUpper;
};

/**
 * Universal Master UOM Catalog - UPPERCASE UNITS ONLY (NO EXPLANATIONS)
 */
export const UNIVERSAL_UOM_CATALOG = [
  // ── PRIMARY UNITS ──
  { value: 'KG', label: 'KG' },
  { value: 'PCS', label: 'PCS' },
  { value: 'ML', label: 'ML' },
  { value: 'NOS', label: 'NOS' },
  { value: 'LTR', label: 'LTR' },
  { value: 'GM', label: 'GM' },
  { value: 'MG', label: 'MG' },
  { value: 'TON', label: 'TON' },
  { value: 'QUINTAL', label: 'QUINTAL' },

  // ── PACKAGING & CONTAINERS ──
  { value: 'BOX', label: 'BOX' },
  { value: 'PACK', label: 'PACK' },
  { value: 'PKT', label: 'PKT' },
  { value: 'CARTON', label: 'CARTON' },
  { value: 'CASE', label: 'CASE' },
  { value: 'BAG', label: 'BAG' },
  { value: 'POUCH', label: 'POUCH' },
  { value: 'DRUM', label: 'DRUM' },
  { value: 'CAN', label: 'CAN' },
  { value: 'BOTTLE', label: 'BOTTLE' },
  { value: 'JAR', label: 'JAR' },
  { value: 'TIN', label: 'TIN' },
  { value: 'TUBE', label: 'TUBE' },
  { value: 'BARREL', label: 'BARREL' },
  { value: 'SACK', label: 'SACK' },
  { value: 'PALLET', label: 'PALLET' },
  { value: 'CRATE', label: 'CRATE' },
  { value: 'TRAY', label: 'TRAY' },
  { value: 'CYLINDER', label: 'CYLINDER' },

  // ── FOOD & ICE CREAM MANUFACTURING ──
  { value: 'STICK', label: 'STICK' },
  { value: 'CONE', label: 'CONE' },
  { value: 'CUP', label: 'CUP' },
  { value: 'TUB', label: 'TUB' },
  { value: 'MATKA', label: 'MATKA' },
  { value: 'POT', label: 'POT' },
  { value: 'BAR', label: 'BAR' },

  // ── COUNT & ASSETS ──
  { value: 'UNIT', label: 'UNIT' },
  { value: 'EA', label: 'EA' },
  { value: 'PAIR', label: 'PAIR' },
  { value: 'DOZEN', label: 'DOZEN' },
  { value: 'GROSS', label: 'GROSS' },
  { value: 'SET', label: 'SET' },
  { value: 'KIT', label: 'KIT' },
  { value: 'BUNDLE', label: 'BUNDLE' },
  { value: 'LOT', label: 'LOT' },
  { value: 'BATCH', label: 'BATCH' },

  // ── LINEAR, ROLLS & PAPER ──
  { value: 'MTR', label: 'MTR' },
  { value: 'CM', label: 'CM' },
  { value: 'MM', label: 'MM' },
  { value: 'KM', label: 'KM' },
  { value: 'INCH', label: 'INCH' },
  { value: 'FT', label: 'FT' },
  { value: 'YD', label: 'YD' },
  { value: 'ROLL', label: 'ROLL' },
  { value: 'SHEET', label: 'SHEET' },
  { value: 'REAM', label: 'REAM' },

  // ── AREA ──
  { value: 'SQM', label: 'SQM' },
  { value: 'SQFT', label: 'SQFT' },
  { value: 'SQCM', label: 'SQCM' },
  { value: 'ACRE', label: 'ACRE' },
  { value: 'HECTARE', label: 'HECTARE' },

  // ── VOLUME & LIQUIDS ──
  { value: 'CL', label: 'CL' },
  { value: 'DL', label: 'DL' },
  { value: 'GAL', label: 'GAL' },
  { value: 'CBM', label: 'CBM' },
  { value: 'CC', label: 'CC' },

  // ── IMPERIAL WEIGHT ──
  { value: 'LB', label: 'LB' },
  { value: 'OZ', label: 'OZ' },

  // ── TIME & UTILITIES ──
  { value: 'DAY', label: 'DAY' },
  { value: 'HR', label: 'HR' },
  { value: 'SHIFT', label: 'SHIFT' },
  { value: 'KWH', label: 'KWH' },
  { value: 'MJ', label: 'MJ' }
];

// Pure UPPERCASE string array of all UOM units
export const UNIVERSAL_UOM_STRING_LIST = UNIVERSAL_UOM_CATALOG.map(u => u.value);

/**
 * UniversalUomSelect Component
 * Displays only clean, uppercase UOM units without lengthy descriptions.
 */
export default function UniversalUomSelect({
  value = '',
  onChange,
  extraOptions = [],
  placeholder = 'Select UOM...',
  searchPlaceholder = 'Search UOM (KG, PCS, ML, LTR, BOX)...',
  disabled = false,
  error = false,
  className = '',
  triggerClassName = '',
  menuClassName = 'min-w-[200px]',
  size = 'default'
}) {
  // Aggregate all built-in universal UOMs + any dynamic database masters from /api/uom
  const options = useMemo(() => {
    const map = new Map();

    // 1. Preload standard universal uppercase units
    UNIVERSAL_UOM_CATALOG.forEach(opt => {
      map.set(opt.value, {
        value: opt.value,
        label: opt.label
      });
    });

    // 2. Merge dynamic extra database options (/api/uom) into uppercase units
    (extraOptions || []).forEach(opt => {
      if (!opt) return;
      const raw = typeof opt === 'string' ? opt : (opt.abbreviation || opt.name || opt.value || opt.id);
      if (!raw) return;
      const upper = normalizeUom(raw);
      if (!map.has(upper)) {
        map.set(upper, {
          value: upper,
          label: upper
        });
      }
    });

    // 3. Guarantee that ANY existing custom value is included in uppercase
    if (value && String(value).trim()) {
      const upperVal = normalizeUom(value);
      if (!map.has(upperVal)) {
        map.set(upperVal, {
          value: upperVal,
          label: upperVal
        });
      }
    }

    return Array.from(map.values());
  }, [extraOptions, value]);

  // Match current value with available options normalized to uppercase
  const resolvedValue = useMemo(() => {
    if (!value) return '';
    return normalizeUom(value);
  }, [value]);

  const handleChange = (selected) => {
    if (!onChange) return;
    const norm = normalizeUom(selected);
    onChange(norm);
  };

  return (
    <SearchSelect
      value={resolvedValue}
      onChange={handleChange}
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
