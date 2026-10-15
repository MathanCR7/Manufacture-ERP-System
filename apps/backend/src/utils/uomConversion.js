/**
 * Universal UOM Conversion Engine for Manufacturing ERP
 * 
 * Rules:
 *  - 1 kg = 1,000 gm
 *  - 1 liter = 1,000 ml
 *  - Canonical database storage is ALWAYS in Base UOM (kg, liter, units)
 *  - Alternate UOM (gm, ml) is converted using factor:
 *      Alt = Base * Factor
 *      Base = Alt / Factor
 */

function cleanUom(str) {
  if (!str || typeof str !== 'string') return '';
  return str.trim().toLowerCase();
}

/**
 * Returns the true conversion factor between base and alternate UOMs.
 * Safeguards against legacy database rows where conversionFactor was recorded as 1.0.
 */
function getConversionFactor(baseUom, altUom, explicitFactor, rawMaterial) {
  const b = cleanUom(baseUom || rawMaterial?.unit?.abbreviation || rawMaterial?.unitId);
  const a = cleanUom(altUom || rawMaterial?.alternateUom || rawMaterial?.consumptionUnit);

  // If no alternate UOM, or they are identical
  if (!a || a === b) {
    return 1;
  }

  // 1. If explicit factor is passed and valid > 1
  const numFactor = Number(explicitFactor);
  if (!isNaN(numFactor) && numFactor > 1) {
    return numFactor;
  }

  // 2. Check rawMaterial model fields
  const rmFactor = Number(rawMaterial?.conversionFactor);
  if (!isNaN(rmFactor) && rmFactor > 1) {
    return rmFactor;
  }
  if (rawMaterial?.alternateUomQty && rawMaterial?.baseUomQty) {
    const calc = Number(rawMaterial.alternateUomQty) / Number(rawMaterial.baseUomQty);
    if (!isNaN(calc) && calc > 1) {
      return calc;
    }
  }

  // 3. Known standard metric units
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

/**
 * Converts any input quantity into canonical Base UOM.
 * E.g., 4200 ml -> 4.2 liter; 800 gm -> 0.8 kg.
 */
function toCanonicalBaseQty({
  inputQty,
  selectedUom,
  baseUom,
  altUom,
  conversionFactor,
  standardQty = null
}) {
  const val = Number(inputQty || 0);
  if (val === 0 || isNaN(val)) return 0;

  const b = cleanUom(baseUom);
  const a = cleanUom(altUom);
  const s = cleanUom(selectedUom);
  const factor = getConversionFactor(b, a, conversionFactor);

  const isAlternate = factor > 1 && (s === a || (!s && a));

  if (isAlternate) {
    return Number((val / factor).toFixed(4));
  }

  // Safeguard: User selected base UOM (e.g. Liter or Kg) but typed an alternate magnitude (e.g. 4200 instead of 4.2)
  if (factor > 1 && standardQty !== null && Number(standardQty) > 0) {
    const std = Number(standardQty);
    if (val >= std * 50) {
      // Obvious 1,000x alternate entry typed in base unit
      return Number((val / factor).toFixed(4));
    }
  }

  return val;
}

/**
 * Converts a canonical Base UOM quantity into Alternate UOM.
 * E.g., 4.2 liter -> 4200 ml; 0.8 kg -> 800 gm.
 */
function toAlternateQty(baseQty, baseUom, altUom, conversionFactor) {
  const val = Number(baseQty || 0);
  if (val === 0 || isNaN(val)) return 0;

  const factor = getConversionFactor(baseUom, altUom, conversionFactor);
  return Number((val * factor).toFixed(2));
}

module.exports = {
  getConversionFactor,
  toCanonicalBaseQty,
  toAlternateQty
};
