/**
 * Shared Production Calculation Engine
 * 
 * Used identically on server (for strict validation & persistence)
 * and client (for live interactive preview).
 */

const EPSILON = 1e-6;

/**
 * Convert quantity from given UOM to milliliters (ml).
 * Formula:
 *  - ml: qty
 *  - l / litre / liter: qty * 1000
 *  - g / gm / gram: qty / density
 *  - kg / kgs / kilogram: (qty * 1000) / density
 *  - pcs / nos / etc: throws error
 * 
 * @param {number} qty - Input quantity
 * @param {string} uom - Unit of measurement
 * @param {number} [density=1.0] - Density in g/ml (required for weight -> volume)
 * @returns {number} Quantity in milliliters
 */
function toMl(qty, uom, density = 1.0) {
  const numQty = Number(qty);
  if (isNaN(numQty)) {
    throw new Error(`Invalid numeric quantity: ${qty}`);
  }
  if (!uom || typeof uom !== 'string') {
    throw new Error('UOM is required for volume conversion');
  }

  const d = Number(density);
  if (isNaN(d) || d <= 0) {
    throw new Error(`Invalid density: ${density}. Density must be greater than 0.`);
  }

  const norm = uom.trim().toLowerCase();

  switch (norm) {
    case 'ml':
    case 'milliliter':
    case 'millilitre':
    case 'milliliters':
    case 'millilitres':
      return numQty;

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
      throw new Error(`Unit '${uom}' cannot be converted to volume (ml). Solid piece units cannot merge into liquid mix.`);

    default:
      // If unrecognized unit ends with ml or l
      if (norm.endsWith('ml')) return numQty;
      if (norm.endsWith('l') || norm.endsWith('ltr')) return numQty * 1000;
      if (norm.endsWith('kg')) return (numQty * 1000) / d;
      if (norm.endsWith('g') || norm.endsWith('gm')) return numQty / d;
      throw new Error(`Unsupported UOM for volume conversion: '${uom}'`);
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
 * 
 * @param {Object} params
 * @param {Array} params.lines - Raw material lines
 * @param {number} params.evaporationPct - Evaporation percentage (0 to 100)
 * @param {string} [params.mergeStage] - Stage name (Before freezing, Before heating, Other)
 * @param {boolean} [params.evaporationApplied=true] - Whether evaporation is applied
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
    const available = Number(line.availableQty || 0);
    const required = Number(line.requiredQty || 0);
    const taken = Number(line.takenQty || 0);
    const density = Number(line.density || line.density_g_per_ml || 1.0);
    const uom = line.uom || line.selectedUom || line.baseUom || 'kg';
    const evaporates = Boolean(line.evaporates ?? line.evaporates_by_default ?? false);
    const merged = Boolean(line.merged ?? false);

    // Validation checks
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

    let linePostEvapMl = 0;
    if (merged && canConvert) {
      totalBeforeEvapMl += lineTakenMl;
      if (evaporates) {
        evaporationBaseMl += lineTakenMl;
        const lineEvapLoss = evaporationApplied ? (lineTakenMl * (pct / 100)) : 0;
        linePostEvapMl = lineTakenMl - lineEvapLoss;
      } else {
        linePostEvapMl = lineTakenMl;
      }
    }

    processedLines.push({
      ...line,
      rawMaterialId: line.rawMaterialId || line.rmId,
      rawMaterialName: line.rawMaterialName || line.rmName,
      uom,
      density,
      availableQty: available,
      requiredQty: required,
      takenQty: taken,
      takenMl: round2(lineTakenMl),
      requiredMl: round2(lineRequiredMl),
      varianceMl: round2(varianceMl),
      remainingStock: round2(remainingStock),
      evaporates,
      merged,
      canConvert,
      conversionError,
      postEvapMl: round2(linePostEvapMl),
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
 * 
 * @param {Object} params
 * @param {number} params.availableMixMl - Total post-evaporation mix (ml)
 * @param {Array} params.allocations - Sequential allocation rows
 */
function calculateAllocations({
  availableMixMl = 0,
  allocations = []
}) {
  let runningMixLeft = Number(availableMixMl) || 0;
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
      mixUsedL: round2(mixUsedMl / 1000),
      wasteMode,
      wasteValue: wasteVal,
      wasteMl: round2(wasteMl),
      wasteL: round2(wasteMl / 1000),
      usableMixMl: round2(usableMixMl),
      goodPieces,
      mixLeftBeforeThisProduct: round2(runningMixLeft),
      mixLeftAfterThisProduct: round2(remainingAfter)
    });

    runningMixLeft = remainingAfter;
  }

  return {
    initialMixAvailableMl: round2(availableMixMl),
    remainingMixAfterAllMl: round2(runningMixLeft),
    allocations: results,
    errors,
    isValid: errors.length === 0
  };
}

/**
 * Computes maximum whole trays that fit the remaining mix
 */
function computeMaxTrays(remainingMixMl, capacityMl, cavities = 1) {
  const cap = Number(capacityMl) || 0;
  const cav = Number(cavities) || 1;
  const nominalSet = cap * cav;
  if (nominalSet <= 0 || remainingMixMl <= 0) return 0;
  return Math.floor((remainingMixMl + EPSILON) / nominalSet);
}

module.exports = {
  toMl,
  round2,
  calculateEvaporation,
  calculateAllocations,
  computeMaxTrays,
  EPSILON
};
