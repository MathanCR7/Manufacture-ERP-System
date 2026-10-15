/**
 * Universal Frontend UOM Conversion Engine for Manufacturing ERP
 *
 * Rules:
 *  - 1 kg = 1,000 gm
 *  - 1 liter = 1,000 ml
 *  - Alt = Base * Factor (e.g. 4 L * 1000 = 4000 ml)
 *  - Base = Alt / Factor (e.g. 4000 ml / 1000 = 4 L; 4 ml / 1000 = 0.004 L)
 */

export function cleanUom(str) {
  if (!str || typeof str !== 'string') return '';
  return str.trim().toLowerCase();
}

export function getConversionFactor(baseUom, altUom, explicitFactor, rawMaterial) {
  const b = cleanUom(baseUom || rawMaterial?.unit?.abbreviation || rawMaterial?.unitId);
  const a = cleanUom(altUom || rawMaterial?.alternateUom || rawMaterial?.consumptionUnit);

  if (!a || a === b) {
    return 1;
  }

  const numFactor = Number(explicitFactor);
  if (!isNaN(numFactor) && numFactor > 1) {
    return numFactor;
  }

  const rmFactor = Number(rawMaterial?.conversionFactor);
  if (!isNaN(rmFactor) && rmFactor > 1) {
    return rmFactor;
  }

  if (rawMaterial?.alternateUomQty && rawMaterial?.baseUomQty) {
    const calc = Number(rawMaterial.alternateUomQty) / Number(rawMaterial.baseUomQty);
    if (!isNaN(calc) && calc > 1) return calc;
  }

  // Standard metric conversions
  const isLiter = ['liter', 'litre', 'l', 'liters', 'litres'].includes(b);
  const isMl = ['ml', 'milliliter', 'millilitre', 'mls'].includes(a);
  if (isLiter && isMl) return 1000;

  const isKg = ['kg', 'kilogram', 'kgs', 'kilograms'].includes(b);
  const isGm = ['gm', 'g', 'gram', 'grams', 'gms'].includes(a);
  if (isKg && isGm) return 1000;

  const isMeter = ['m', 'meter', 'metre', 'meters'].includes(b);
  const isCm = ['cm', 'centimeter', 'centimeters'].includes(a);
  if (isMeter && isCm) return 100;

  const isMm = ['mm', 'millimeter', 'millimeters'].includes(a);
  if (isMeter && isMm) return 1000;

  return 1;
}

export function toBase(val, factor = 1000) {
  const num = parseFloat(val);
  if (isNaN(num)) return 0;
  return factor > 0 ? Number((num / factor).toFixed(4)) : num;
}

export function toAlt(val, factor = 1000) {
  const num = parseFloat(val);
  if (isNaN(num)) return 0;
  return Number((num * factor).toFixed(3));
}
