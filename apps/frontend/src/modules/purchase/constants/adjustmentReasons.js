/**
 * Standard Stock Adjustment Reasons Categorized for Food & Manufacturing ERP
 */
export const STOCK_ADJUSTMENT_REASONS = [
  {
    group: 'Inventory Audit & Physical Count',
    options: [
      { value: 'Physical Count Shortage / Shrinkage', label: 'Physical Count Shortage / Shrinkage', type: 'SUBTRACTION' },
      { value: 'Physical Count Surplus / Found Stock', label: 'Physical Count Surplus / Found Stock', type: 'ADDITION' },
      { value: 'Annual Physical Inventory Reconciliation', label: 'Annual Physical Inventory Reconciliation', type: 'BOTH' },
      { value: 'Cycle Count Audit Alignment', label: 'Cycle Count Audit Alignment', type: 'BOTH' },
    ]
  },
  {
    group: 'Damage, Expiry & Spillage Loss',
    options: [
      { value: 'Damaged / Broken in Warehouse', label: 'Damaged / Broken in Warehouse', type: 'SUBTRACTION' },
      { value: 'Expired / Past Shelf Life Date', label: 'Expired / Past Shelf Life Date', type: 'SUBTRACTION' },
      { value: 'Spillage / Leakage / Handling Evaporation', label: 'Spillage / Leakage / Handling Evaporation', type: 'SUBTRACTION' },
      { value: 'Moisture / Weather / Cold Chain Breach', label: 'Moisture / Weather / Cold Chain Breach', type: 'SUBTRACTION' },
      { value: 'Packaging Breach / Contamination', label: 'Packaging Breach / Contamination', type: 'SUBTRACTION' },
    ]
  },
  {
    group: 'Production & Quality Control',
    options: [
      { value: 'Return of Unused Material from Production', label: 'Return of Unused Material from Production', type: 'ADDITION' },
      { value: 'Lab QC Sample Consumption / Retest', label: 'Lab QC Sample Consumption / Retest', type: 'SUBTRACTION' },
      { value: 'Quality Testing Rejection / Batch Spoiled', label: 'Quality Testing Rejection / Batch Spoiled', type: 'SUBTRACTION' },
      { value: 'R&D / Production Trial Consumption', label: 'R&D / Production Trial Consumption', type: 'SUBTRACTION' },
    ]
  },
  {
    group: 'Supplier & Delivery Discrepancies',
    options: [
      { value: 'Supplier Free Sample / Bonus Delivery', label: 'Supplier Free Sample / Bonus Delivery', type: 'ADDITION' },
      { value: 'Supplier Delivery Shortage Uninvoiced', label: 'Supplier Delivery Shortage Uninvoiced', type: 'SUBTRACTION' },
      { value: 'Pre-inward Sample Retention', label: 'Pre-inward Sample Retention', type: 'SUBTRACTION' },
    ]
  },
  {
    group: 'Administrative & Error Corrections',
    options: [
      { value: 'Data Entry Error Correction (Previous Overstatement)', label: 'Data Entry Error Correction (Previous Overstatement)', type: 'SUBTRACTION' },
      { value: 'Data Entry Error Correction (Previous Understatement)', label: 'Data Entry Error Correction (Previous Understatement)', type: 'ADDITION' },
      { value: 'UOM / Unit Conversion Alignment', label: 'UOM / Unit Conversion Alignment', type: 'BOTH' },
      { value: 'Previous Erroneous Write-off Reversal', label: 'Previous Erroneous Write-off Reversal', type: 'ADDITION' },
      { value: 'Initial / Opening Stock Balance Calibration', label: 'Initial / Opening Stock Balance Calibration', type: 'BOTH' },
      { value: 'Theft / Unaccounted Missing Inventory', label: 'Theft / Unaccounted Missing Inventory', type: 'SUBTRACTION' },
      { value: 'Other (Specify in Remarks)', label: 'Other (Specify in Remarks)', type: 'BOTH' },
    ]
  }
];

export const ALL_REASON_OPTIONS = STOCK_ADJUSTMENT_REASONS.flatMap(g => g.options);
