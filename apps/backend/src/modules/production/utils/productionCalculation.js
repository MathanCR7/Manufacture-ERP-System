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

    case 'gallon':
    case 'gallons':
    case 'gal':
      return numQty * 2000;

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
    case 'roll':
    case 'rolls':
    case 'unit':
    case 'units':
      // Discrete packaging units do NOT contribute liquid mix volume
      return 0;

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
  mergeStage = 'After heating',
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
    let taken = Number(line.takenQty ?? line.taken_qty ?? 0);
    if (taken <= 0 && required > 0) {
      taken = required;
    }
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
 * Detect whether an item/material is a packaging/dry non-mix item
 * (e.g. sticks, poly covers, cups, cartons, labels, wrappers)
 */
function isPackagingMaterial(item) {
  if (!item) return false;
  const name = String(item.rawMaterialName || item.rmName || item.name || item.printName || '').toLowerCase();
  const code = String(item.rawMaterialCode || item.rmCode || item.code || '').toLowerCase();
  const cat = String(item.category || item.categoryName || '').toLowerCase();
  const uom = String(item.uom || item.consumptionUnit || item.selectedUom || '').toLowerCase();

  // 1. Food Ingredients & Raw Materials are NEVER packaging materials (even if they contain words like 'cover' or 'dip' or 'pack')
  const foodKeywords = [
    'chocolate', 'choco', 'cocoa', 'dip', 'dark cover', 'compound', 'syrup', 'sauce',
    'paste', 'cream', 'butter', 'milk', 'sugar', 'flavor', 'flavour', 'essence',
    'color', 'colour', 'puree', 'fruit', 'nut', 'oil', 'powder', 'smp', 'stabilizer',
    'fat', 'cashew', 'almond', 'pista', 'mango', 'vanilla', 'strawberry', 'dates'
  ];
  if (foodKeywords.some(kw => name.includes(kw) || code.includes(kw) || cat.includes(kw))) {
    return false;
  }

  // 2. Weight and volume UOMs (kg, g, l, ml) are NEVER packaging
  const fluidWeightUoms = ['kg', 'kgs', 'kilo', 'kilogram', 'kilograms', 'g', 'gm', 'gms', 'gram', 'grams', 'l', 'ltr', 'liter', 'litre', 'liters', 'litres', 'ml', 'milliliter', 'tonne', 'ton'];
  if (fluidWeightUoms.includes(uom)) {
    return false;
  }

  // 3. Packaging items: explicit packaging keywords
  const packagingKeywords = [
    'wooden stick', 'stick 144', 'stick 65', 'ice cream stick', 'poly cover', 'packing cover',
    'pouch', 'wrapper', 'carton', 'corrugated', 'outer box', 'packing roll', 'tape', 'seal',
    'spoon', 'liner', 'film 130', 'film 170', 'wrapper roll'
  ];
  if (packagingKeywords.some(kw => name.includes(kw) || code.includes(kw))) {
    return true;
  }

  // 4. Packaging Category
  if (cat.includes('pack') || cat.includes('box') || cat.includes('wrapper')) {
    return true;
  }

  // 5. Discrete packaging units where name indicates packing
  const discreteUoms = ['pcs', 'pc', 'piece', 'pieces', 'unit', 'units', 'roll', 'rolls', 'pkt', 'packet', 'bag', 'nos', 'case'];
  if (discreteUoms.includes(uom)) {
    if (['stick', 'poly', 'pack', 'box', 'cup', 'wrapper', 'carton', 'bag', 'roll', 'seal', 'spoon', 'pouch'].some(kw => name.includes(kw))) {
      return true;
    }
  }

  return false;
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
    const rawUseMould = item.useMould !== undefined ? Boolean(item.useMould) : true;
    const capacityMl = Number(item.capacityMl || item.capacity_ml || 0);
    const useMould = rawUseMould && (Boolean(item.mouldId && item.mouldId !== 'NO_MOULD') || capacityMl > 0);
    const effectiveCapacityMl = capacityMl > 0 ? capacityMl : (useMould ? 50 : 0);
    const cavities = item.cavities !== undefined && item.cavities !== null 
      ? Number(item.cavities) 
      : (item.cavityCount ? Number(item.cavityCount) : (useMould ? 42 : 1));
    const trays = Number(item.trays || 0);
    const wasteMode = item.wasteMode || item.waste_mode || 'PERCENT';
    const wasteVal = Number(item.wasteValue ?? item.waste_value ?? 0);

    // Explicit allocated base mix (ml) from user or calculated from mould trays
    const allocatedBaseMl = Number(item.allocatedBaseMl ?? item.allocated_base_ml ?? 0);
    const mouldNominalSetMl = effectiveCapacityMl * cavities;

    let mixUsedMl = 0;
    if (allocatedBaseMl > 0) {
      mixUsedMl = allocatedBaseMl;
    } else if (trays > 0 && mouldNominalSetMl > 0) {
      mixUsedMl = trays * mouldNominalSetMl;
    } else if (item.mixUsedMl || item.mix_used_ml) {
      mixUsedMl = Number(item.mixUsedMl || item.mix_used_ml || 0);
    }

    // Product-specific raw materials / essences added to this end product
    const productRms = Array.isArray(item.productRms) ? item.productRms : [];
    let addedRmVolumeMl = 0;
    for (const prm of productRms) {
      // Check if this item is marked to add to the liquid mix (defaults to false for packaging items)
      const shouldAdd = prm.addToMix !== undefined 
        ? Boolean(prm.addToMix) 
        : (prm.isLiquidMix !== undefined ? Boolean(prm.isLiquidMix) : !isPackagingMaterial(prm));
      if (!shouldAdd) continue;

      const prmQty = Number(prm.takenQty ?? prm.qty ?? prm.quantity ?? 0);
      const prmUom = prm.uom || prm.selectedUom || 'ml';
      const prmDensity = Number(prm.density || 1.0);
      try {
        addedRmVolumeMl += toMl(prmQty, prmUom, prmDensity);
      } catch (_) {
        addedRmVolumeMl += prmQty;
      }
    }

    // Total product mix = base mix + added ingredients volume
    const productTotalMixMl = mixUsedMl + addedRmVolumeMl;

    let wasteMl = 0;
    if (wasteMode === 'PERCENT' || wasteMode === '%') {
      wasteMl = (productTotalMixMl * wasteVal) / 100;
    } else {
      wasteMl = trays > 0 ? (wasteVal * trays) : (wasteVal);
    }

    if (useMould) {
      if (effectiveCapacityMl <= 0) {
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
    }

    if (wasteMl > productTotalMixMl + EPSILON && productTotalMixMl > 0) {
      errors.push({
        seq,
        index: i,
        productId: item.productId,
        type: 'EXCESSIVE_WASTE',
        message: `Product #${seq}: Wastage (${round2(wasteMl)} ml) cannot exceed mix used (${round2(productTotalMixMl)} ml).`
      });
    }

    const usableMixMl = Math.max(0, productTotalMixMl - wasteMl);
    let goodPieces = 0;
    if (useMould && effectiveCapacityMl > 0) {
      goodPieces = Math.floor((usableMixMl + EPSILON) / effectiveCapacityMl);
    } else {
      // Bulk Storage Mode: Gallon, Liter, Tub or Piece
      const bulkUom = String(item.bulkUom || item.uom || 'L').toLowerCase();
      if (bulkUom.includes('gallon')) {
        goodPieces = round2(usableMixMl / 2000);
      } else if (bulkUom.includes('liter') || bulkUom.includes('ltr') || bulkUom === 'l') {
        goodPieces = round2(usableMixMl / 1000);
      } else if (effectiveCapacityMl > 0) {
        goodPieces = Math.floor((usableMixMl + EPSILON) / effectiveCapacityMl);
      } else {
        goodPieces = round2(usableMixMl / 1000);
      }
    }

    const remainingAfter = runningMixLeft - mixUsedMl;
    totalMixUsed += mixUsedMl;

    if (remainingAfter < -EPSILON && initialAvailable > 0) {
      errors.push({
        seq,
        index: i,
        productId: item.productId,
        type: 'INSUFFICIENT_MIX',
        message: `Product #${seq}: Insufficient base mix. Demanded ${round2(mixUsedMl)} ml, but only ${round2(runningMixLeft)} ml remained.`
      });
    }

    const theoreticalGoodPieces = goodPieces;
    const effectiveGoodPieces = (item.actualYield !== undefined && item.actualYield !== null && item.actualYield !== '' && Number(item.actualYield) >= 0)
      ? Number(item.actualYield)
      : theoreticalGoodPieces;

    results.push({
      ...item,
      seq,
      useMould,
      capacityMl: round2(capacityMl),
      cavities,
      trays,
      nominalSetMl: round2(mouldNominalSetMl),
      allocatedBaseMl: round2(mixUsedMl),
      addedRmVolumeMl: round2(addedRmVolumeMl),
      productTotalMixMl: round2(productTotalMixMl),
      mixUsedMl: round2(mixUsedMl),
      mixRequiredMl: round2(mixUsedMl),
      mixUsedL: round2(mixUsedMl / 1000),
      wasteMode,
      wasteValue: wasteVal,
      wasteMl: round2(wasteMl),
      wasteL: round2(wasteMl / 1000),
      usableMixMl: round2(usableMixMl),
      theoreticalGoodPieces,
      goodPieces: effectiveGoodPieces,
      actualYield: (item.actualYield !== undefined && item.actualYield !== null && item.actualYield !== '') ? Number(item.actualYield) : null,
      productRms,
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
  } else if (wasteMode === 'ABSOLUTE' || wasteMode === 'ML' || wasteMode === 'FIXED_ML_PER_TRAY') {
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
  isPackagingMaterial,
  EPSILON
};
