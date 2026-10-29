/**
 * Shared Production Calculation Engine (Backend)
 * 
 * Used identically on server (for strict validation & persistence)
 * and client (for live interactive preview).
 */

const EPSILON = 1e-6;

/**
 * Convert quantity from given UOM to milliliters (ml).
 * Formula:
 *  - ml: qty
 *  - l / litre / liter / '1': qty * 1000
 *  - g / gm / gram: qty / density
 *  - kg / kgs / kilogram: (qty * 1000) / density
 * 
 * @param {number} qty - Input quantity
 * @param {string|number} uom - Unit of measurement
 * @param {number} [density=1.0] - Density in g/ml (required for weight -> volume)
 * @returns {number} Quantity in milliliters
 */
function toMl(qty, uom, density = 1.0) {
  const numQty = Number(qty);
  if (isNaN(numQty)) {
    throw new Error(`Invalid numeric quantity: ${qty}`);
  }
  if (uom === undefined || uom === null || uom === '') {
    // Default to litre/kg (1000ml per unit) if density is 1
    return numQty * 1000;
  }

  const d = Number(density) > 0 ? Number(density) : 1.0;
  const norm = String(uom).trim().toLowerCase();

  switch (norm) {
    case 'ml':
    case 'milliliter':
    case 'millilitre':
    case 'milliliters':
    case 'millilitres':
      return numQty;

    case '1':
    case 'l':
    case 'ltr':
    case 'liter':
    case 'litre':
    case 'liters':
    case 'litres':
      return numQty * 1000;

    case 'g':
    case 'gm':
    case 'gms':
    case 'gram':
    case 'grams':
      return numQty / d;

    case 'kg':
    case 'kgs':
    case 'kilo':
    case 'kilogram':
    case 'kilograms':
      return (numQty * 1000) / d;

    case 'pcs':
    case 'pc':
    case 'piece':
    case 'pieces':
    case 'nos':
    case 'no':
    case 'box':
    case 'boxes':
    case 'pack':
    case 'packs':
      // Solid unit fallback - assume nominal 50ml per unit rather than throwing hard crash
      return numQty * 50;

    default:
      if (norm.endsWith('ml')) return numQty;
      if (norm.endsWith('l') || norm.endsWith('ltr')) return numQty * 1000;
      if (norm.endsWith('kg')) return (numQty * 1000) / d;
      if (norm.endsWith('g') || norm.endsWith('gm')) return numQty / d;
      // Default fallback
      return (numQty * 1000) / d;
  }
}

/**
 * Format number to 2 decimal places with small epsilon rounding guard
 */
function round2(num) {
  const n = Number(num);
  if (isNaN(n)) return 0;
  return Math.round((n + EPSILON) * 100) / 100;
}

/**
 * Calculate evaporation and post-merge totals
 */
function calculateEvaporation({
  lines = [],
  evaporationPct = 5.0,
  mergeStage = 'Before freezing',
  evaporationApplied = true
}) {
  const pct = Math.max(0, Math.min(100, Number(evaporationPct) || 0));

  let totalBeforeEvapMl = 0;
  let evaporationBaseMl = 0;
  const processedLines = [];
  const warnings = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const available = Number(line.availableQty ?? line.available_qty ?? 0);
    const required = Number(line.requiredQty ?? line.required_qty ?? 0);
    const taken = Number(line.takenQty ?? line.taken_qty ?? 0);
    const density = Number(line.density || line.density_g_per_ml || 1.0);
    const uom = line.uom || line.selectedUom || line.baseUom || 'kg';
    const evaporates = Boolean(line.evaporates ?? line.evaporates_by_default ?? false);
    const merged = Boolean(line.merged ?? true);

    let lineTakenMl = 0;
    let lineRequiredMl = 0;
    let canConvert = true;
    let conversionError = null;

    try {
      lineTakenMl = toMl(taken, uom, density);
      lineRequiredMl = toMl(required, uom, density);
    } catch (err) {
      canConvert = false;
      conversionError = err.message;
      warnings.push({
        lineIndex: i,
        rawMaterialId: line.rawMaterialId || line.rmId,
        rawMaterialName: line.rawMaterialName || line.rmName || `Item #${i + 1}`,
        type: 'UNIT_CONVERSION_ERROR',
        message: err.message
      });
    }

    if (taken > available) {
      warnings.push({
        lineIndex: i,
        rawMaterialId: line.rawMaterialId || line.rmId,
        rawMaterialName: line.rawMaterialName || line.rmName || `Item #${i + 1}`,
        type: 'EXCEEDS_AVAILABLE',
        message: `Taken quantity (${taken} ${uom}) exceeds available warehouse stock (${available} ${uom}).`
      });
    }

    if (taken < 0 || available < 0 || required < 0) {
      warnings.push({
        lineIndex: i,
        rawMaterialId: line.rawMaterialId || line.rmId,
        rawMaterialName: line.rawMaterialName || line.rmName || `Item #${i + 1}`,
        type: 'NEGATIVE_QUANTITY',
        message: `Quantities cannot be negative.`
      });
    }

    const varianceMl = canConvert ? (lineTakenMl - lineRequiredMl) : 0;
    const remainingStock = available - taken;

    let linePostEvapMl = lineTakenMl;
    if (merged && canConvert) {
      totalBeforeEvapMl += lineTakenMl;
      if (evaporates) {
        evaporationBaseMl += lineTakenMl;
        const lineEvapLoss = evaporationApplied ? (lineTakenMl * (pct / 100)) : 0;
        linePostEvapMl = Math.max(0, lineTakenMl - lineEvapLoss);
      } else {
        linePostEvapMl = lineTakenMl;
      }
    }

    processedLines.push({
      ...line,
      rawMaterialId: line.rawMaterialId || line.rmId || line.raw_material_id,
      rawMaterialName: line.rawMaterialName || line.rmName || line.raw_material_name,
      uom,
      density,
      availableQty: available,
      requiredQty: required,
      takenQty: taken,
      takenMl: round2(lineTakenMl),
      takenMlAfterEvap: round2(linePostEvapMl),
      postEvapMl: round2(linePostEvapMl),
      requiredMl: round2(lineRequiredMl),
      varianceMl: round2(varianceMl),
      remainingStock: round2(remainingStock),
      evaporates,
      merged,
      canConvert,
      conversionError,
      isOverTaken: taken > available,
      isNegative: taken < 0 || available < 0 || required < 0
    });
  }

  const evaporatedMl = evaporationApplied ? (evaporationBaseMl * (pct / 100)) : 0;
  const mixAfterEvapMl = Math.max(0, totalBeforeEvapMl - evaporatedMl);

  return {
    mergeStage,
    evaporationPct: pct,
    evaporationApplied,
    totalBeforeEvapMl: round2(totalBeforeEvapMl),
    totalBeforeEvapL: round2(totalBeforeEvapMl / 1000),
    evaporationBaseMl: round2(evaporationBaseMl),
    evaporatedMl: round2(evaporatedMl),
    evaporatedL: round2(evaporatedMl / 1000),
    mixAfterEvapMl: round2(mixAfterEvapMl),
    mixAfterEvapL: round2(mixAfterEvapMl / 1000),
    lines: processedLines,
    warnings,
    hasWarnings: warnings.length > 0
  };
}

/**
 * Sequential Allocation of Finished Products
 * 
 * Each product consumes from the remaining mix left by the previous one.
 */
function calculateAllocations({
  availableMixMl,
  totalMixMl,
  allocations = []
}) {
  const initialAvailable = Number(availableMixMl ?? totalMixMl ?? 0);
  let runningMixLeft = initialAvailable;
  let totalMixUsed = 0;
  const results = [];
  const errors = [];

  for (let i = 0; i < allocations.length; i++) {
    const item = allocations[i];
    const seq = item.seq ?? (i + 1);
    const capacityMl = Number(item.capacityMl || item.capacity_ml || 0);
    const cavities = item.cavities !== undefined && item.cavities !== null 
      ? Number(item.cavities) 
      : (item.cavityCount ? Number(item.cavityCount) : 1);
    const trays = Number(item.trays || 0);
    const wasteMode = item.wasteMode || item.waste_mode || 'PERCENT';
    const wasteVal = Number(item.wasteValue ?? item.waste_value ?? 0);

    const mouldNominalSetMl = capacityMl * cavities;
    const mixUsedMl = trays * mouldNominalSetMl;

    let wasteMl = 0;
    if (wasteMode === 'PERCENT' || wasteMode === '%') {
      wasteMl = (mixUsedMl * wasteVal) / 100;
    } else {
      wasteMl = wasteVal;
    }

    if (capacityMl <= 0) {
      errors.push({
        seq,
        index: i,
        productId: item.productId,
        type: 'INVALID_CAPACITY',
        message: `Product #${seq}: Capacity per cavity/piece must be greater than 0.`
      });
    }

    if (cavities <= 0) {
      errors.push({
        seq,
        index: i,
        productId: item.productId,
        type: 'INVALID_CAVITIES',
        message: `Product #${seq}: Cavity count must be greater than 0.`
      });
    }

    if (wasteMl > mixUsedMl + EPSILON) {
      errors.push({
        seq,
        index: i,
        productId: item.productId,
        type: 'EXCESSIVE_WASTE',
        message: `Product #${seq}: Wastage (${round2(wasteMl)} ml) cannot exceed mix used (${round2(mixUsedMl)} ml).`
      });
    }

    const usableMixMl = Math.max(0, mixUsedMl - wasteMl);
    const goodPieces = capacityMl > 0 ? Math.floor((usableMixMl + EPSILON) / capacityMl) : 0;
    const remainingAfter = runningMixLeft - mixUsedMl;

    totalMixUsed += mixUsedMl;

    if (remainingAfter < -EPSILON) {
      errors.push({
        seq,
        index: i,
        productId: item.productId,
        type: 'INSUFFICIENT_MIX',
        message: `Product #${seq}: Insufficient mix. Demanded ${round2(mixUsedMl)} ml, but only ${round2(runningMixLeft)} ml remained.`
      });
    }

    results.push({
      ...item,
      seq,
      capacityMl: round2(capacityMl),
      cavities,
      trays,
      nominalSetMl: round2(mouldNominalSetMl),
      mixUsedMl: round2(mixUsedMl),
      mixRequiredMl: round2(mixUsedMl),
      mixUsedL: round2(mixUsedMl / 1000),
      wasteMode,
      wasteValue: wasteVal,
      wasteMl: round2(wasteMl),
      wasteL: round2(wasteMl / 1000),
      usableMixMl: round2(usableMixMl),
      goodPieces,
      mixLeftBeforeThisProduct: round2(runningMixLeft),
      mixLeftAfterThisProduct: round2(remainingAfter),
      mixRemainingAfterMl: round2(remainingAfter)
    });

    runningMixLeft = remainingAfter;
  }

  return {
    initialMixAvailableMl: round2(initialAvailable),
    totalMixAvailableMl: round2(initialAvailable),
    totalMixUsedMl: round2(totalMixUsed),
    remainingMixMl: round2(runningMixLeft),
    remainingMixAfterAllMl: round2(runningMixLeft),
    allocations: results,
    errors,
    isValid: errors.length === 0
  };
}

/**
 * Computes maximum whole trays that fit the remaining mix.
 * Supports both positional arguments: computeMaxTrays(remainingMix, cap, cav)
 * and object argument: computeMaxTrays({ availableMixMl, capacityMl, cavities, wasteMode, wasteValue })
 */
function computeMaxTrays(param1, param2, param3) {
  let remainingMix = 0;
  let capacityMl = 50;
  let cavities = 1;
  let wasteMode = 'PERCENT';
  let wasteValue = 0;

  if (typeof param1 === 'object' && param1 !== null) {
    remainingMix = Number(param1.availableMixMl ?? param1.remainingMixMl ?? 0);
    capacityMl = Number(param1.capacityMl ?? 50);
    cavities = Number(param1.cavities ?? 1);
    wasteMode = param1.wasteMode || 'PERCENT';
    wasteValue = Number(param1.wasteValue ?? 0);
  } else {
    remainingMix = Number(param1 || 0);
    capacityMl = Number(param2 || 50);
    cavities = Number(param3 || 1);
  }

  const cap = capacityMl > 0 ? capacityMl : 50;
  const cav = cavities > 0 ? cavities : 1;
  const nominalSet = cap * cav;
  if (nominalSet <= 0 || remainingMix <= 0) return 0;

  let mixPerTray = nominalSet;
  if (wasteMode === 'PERCENT' || wasteMode === '%') {
    const wasteFactor = Math.min(0.9, Math.max(0, wasteValue / 100));
    mixPerTray = nominalSet / (1 - wasteFactor);
  } else if (wasteMode === 'ABSOLUTE' || wasteMode === 'ML') {
    mixPerTray = nominalSet + wasteValue;
  }

  return Math.max(0, Math.floor((remainingMix + EPSILON) / mixPerTray));
}

module.exports = {
  toMl,
  round2,
  calculateEvaporation,
  calculateAllocations,
  computeMaxTrays,
  EPSILON
};
