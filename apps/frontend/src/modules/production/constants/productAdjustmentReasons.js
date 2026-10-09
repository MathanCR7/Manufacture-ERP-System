/**
 * Standard Stock Adjustment Reasons Categorized for Finished Products
 */
export const PRODUCT_STOCK_ADJUSTMENT_REASONS = [
  {
    group: 'Physical Count & Warehouse Audit',
    options: [
      { value: 'Physical Count Shortage / Shrinkage', label: 'Physical Count Shortage / Shrinkage', type: 'SUBTRACTION' },
      { value: 'Physical Count Surplus / Found Stock', label: 'Physical Count Surplus / Found Stock', type: 'ADDITION' },
      { value: 'Annual Finished Goods Stocktake Reconciliation', label: 'Annual Finished Goods Stocktake Reconciliation', type: 'BOTH' },
      { value: 'Cycle Count Audit Alignment', label: 'Cycle Count Audit Alignment', type: 'BOTH' },
      { value: 'Barcode / SKU Scanning Discrepancy Correction', label: 'Barcode / SKU Scanning Discrepancy Correction', type: 'BOTH' },
    ]
  },
  {
    group: 'Packaging & Handling Damage',
    options: [
      { value: 'Outer Carton / Box Crushing Damage', label: 'Outer Carton / Box Crushing Damage', type: 'SUBTRACTION' },
      { value: 'Seal Breach / Tampered Packaging', label: 'Seal Breach / Tampered Packaging', type: 'SUBTRACTION' },
      { value: 'Warehouse Handling Drop / Breakage', label: 'Warehouse Handling Drop / Breakage', type: 'SUBTRACTION' },
      { value: 'Cold Chain / Temperature Abuse Spoilage', label: 'Cold Chain / Temperature Abuse Spoilage', type: 'SUBTRACTION' },
      { value: 'Expired Finished Goods Quarantine', label: 'Expired Finished Goods Quarantine', type: 'SUBTRACTION' },
    ]
  },
  {
    group: 'Samples, Promotions & Marketing',
    options: [
      { value: 'Marketing / Sales Promotion Free Sample', label: 'Marketing / Sales Promotion Free Sample', type: 'SUBTRACTION' },
      { value: 'Customer Demonstration / Tasting Stall', label: 'Customer Demonstration / Tasting Stall', type: 'SUBTRACTION' },
      { value: 'Exhibition & Trade Fair Display Sample', label: 'Exhibition & Trade Fair Display Sample', type: 'SUBTRACTION' },
      { value: 'Lab QC Retain Sample Consumption', label: 'Lab QC Retain Sample Consumption', type: 'SUBTRACTION' },
    ]
  },
  {
    group: 'Production Output & Packaging Reconciliation',
    options: [
      { value: 'Production Batch Packaging Surplus Transfer', label: 'Production Batch Packaging Surplus Transfer', type: 'ADDITION' },
      { value: 'Late Batch Inwarding Correction', label: 'Late Batch Inwarding Correction', type: 'ADDITION' },
      { value: 'Packaging Line Count Shortage', label: 'Packaging Line Count Shortage', type: 'SUBTRACTION' },
      { value: 'Post-production QC Inspection Scrap', label: 'Post-production QC Inspection Scrap', type: 'SUBTRACTION' },
      { value: 'Returned from Rework / Re-boxing', label: 'Returned from Rework / Re-boxing', type: 'ADDITION' },
    ]
  },
  {
    group: 'Customer Returns & Dispatch Corrections',
    options: [
      { value: 'Sales Return Restocked into Inventory', label: 'Sales Return Restocked into Inventory', type: 'ADDITION' },
      { value: 'Unrecorded Customer Dispatch Deduction', label: 'Unrecorded Customer Dispatch Deduction', type: 'SUBTRACTION' },
      { value: 'Cancelled Dispatch Restocked', label: 'Cancelled Dispatch Restocked', type: 'ADDITION' },
    ]
  },
  {
    group: 'Administrative & Calibration',
    options: [
      { value: 'Data Entry Error Correction (Previous Overstatement)', label: 'Data Entry Error Correction (Previous Overstatement)', type: 'SUBTRACTION' },
      { value: 'Data Entry Error Correction (Previous Understatement)', label: 'Data Entry Error Correction (Previous Understatement)', type: 'ADDITION' },
      { value: 'Initial / Opening Stock Balance Calibration', label: 'Initial / Opening Stock Balance Calibration', type: 'BOTH' },
      { value: 'Unit / Case Pack Conversion Alignment', label: 'Unit / Case Pack Conversion Alignment', type: 'BOTH' },
      { value: 'Theft / Unaccounted Missing Stock', label: 'Theft / Unaccounted Missing Stock', type: 'SUBTRACTION' },
      { value: 'Other (Specify in Remarks)', label: 'Other (Specify in Remarks)', type: 'BOTH' },
    ]
  }
];

export const ALL_PRODUCT_REASON_OPTIONS = PRODUCT_STOCK_ADJUSTMENT_REASONS.flatMap(g => g.options);
