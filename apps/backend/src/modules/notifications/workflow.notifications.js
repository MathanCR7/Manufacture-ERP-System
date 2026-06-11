const notificationService = require('./notifications.service');

const formatLocalTime = (dateStr, includeSeconds = false) => {
  const date = new Date(dateStr);
  const options = { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' };
  if (includeSeconds) options.second = '2-digit';
  return date.toLocaleString('en-GB', options);
};

// Phase 1: Purchase Order
const triggerPOCreated = async ({ rmId, rmName, quantity, uom, amount, expectedDeliveryDate, poId, referenceNo, actorName, actorId, actorRole }) => {
  const event_at = new Date();
  const event_at_local = formatLocalTime(event_at);

  await notificationService.createNotification({
    type: 'PO_CREATED',
    recipient_roles: ['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER'],
    sender_role: actorRole,
    sender_id: actorId,
    reference_type: 'PO',
    reference_id: poId,
    event_at,
    message: `📦 New Purchase Order Raised — ${referenceNo || poId} · ${rmName} · Qty: ${quantity} ${uom} · Amount: ₹${amount} · Expected Delivery: ${expectedDeliveryDate} · Raised by ${actorName} at ${event_at_local}`,
    metadata: {
      rm_id: rmId,
      rm_name: rmName,
      quantity,
      uom,
      amount,
      expected_delivery_date: expectedDeliveryDate,
      po_id: poId,
      reference_no: referenceNo
    }
  });
};

// Phase 1b: Purchase Order Amended
const triggerPOAmended = async ({ poId, changeSummary, actorName, actorId, actorRole, previousValues, newValues }) => {
  const event_at = new Date();
  const event_at_local = formatLocalTime(event_at);

  await notificationService.createNotification({
    type: 'PO_AMENDED',
    recipient_roles: ['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER'],
    sender_role: actorRole,
    sender_id: actorId,
    reference_type: 'PO',
    reference_id: poId,
    event_at,
    message: `✏️ PO #${poId} amended — ${changeSummary} · Updated by ${actorName} at ${event_at_local}`,
    metadata: {
      po_id: poId,
      change_summary: changeSummary,
      previous_values: previousValues,
      new_values: newValues,
      status: 'AMENDED',
      actor_name: actorName
    }
  });
};

// Phase 1c: Purchase Order Cancelled
const triggerPOCancelled = async ({ poId, rmId, rmName, cancelReason, actorName, actorId, actorRole }) => {
  const event_at = new Date();
  const event_at_local = formatLocalTime(event_at);

  await notificationService.createNotification({
    type: 'PO_CANCELLED',
    recipient_roles: ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT', 'MATERIALS_RECEIVER'],
    sender_role: actorRole,
    sender_id: actorId,
    reference_type: 'PO',
    reference_id: poId,
    event_at,
    message: `🚫 PO #${poId} cancelled — Reason: ${cancelReason} · Cancelled by ${actorName} at ${event_at_local}`,
    metadata: {
      po_id: poId,
      rm_id: rmId,
      rm_name: rmName,
      cancel_reason: cancelReason,
      status: 'CANCELLED',
      actor_name: actorName
    }
  });
};

// Phase 2: Goods Receipt Note
const triggerGRNSubmitted = async ({ rmId, rmName, receivedQty, uom, receivedAmount, healthCondition, confirmationStatus, grnId, poId, actorName, actorId, actorRole }) => {
  const event_at = new Date();
  const event_at_local = formatLocalTime(event_at);

  await notificationService.createNotification({
    type: 'GRN_SUBMITTED',
    recipient_roles: ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT', 'LAB_ASSISTANT'],
    sender_role: actorRole,
    sender_id: actorId,
    reference_type: 'GRN',
    reference_id: grnId,
    event_at,
    message: `🏭 GRN Logged — RM #${rmId} · ${rmName} · Received Qty: ${receivedQty} ${uom} · Amount: ₹${receivedAmount} · Health: ${healthCondition} · Status: ${confirmationStatus} · Received by ${actorName} at ${event_at_local}`,
    metadata: {
      rm_id: rmId,
      rm_name: rmName,
      received_qty: receivedQty,
      uom,
      received_amount: receivedAmount,
      health_condition: healthCondition,
      confirmation_status: confirmationStatus,
      grn_id: grnId,
      po_id: poId
    }
  });
};

// Phase 3: Lab RM Approved
const triggerLabRMApproved = async ({ rmId, rmName, labTestId, fat, protein, moisture, acidity, notes, grnId, actorName, actorId, actorRole }) => {
  const event_at = new Date();
  const event_at_local = formatLocalTime(event_at, true);

  await notificationService.createNotification({
    type: 'LAB_RM_APPROVED',
    recipient_roles: ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT', 'MATERIALS_RECEIVER', 'PRODUCTION_STAFF'],
    sender_role: actorRole,
    sender_id: actorId,
    reference_type: 'LAB_RM',
    reference_id: labTestId,
    event_at,
    message: `✅ RM Lab APPROVED — RM #${rmId} · ${rmName} · Fat: ${fat}% · Protein: ${protein}% · Moisture: ${moisture}% · Acidity: ${acidity} · Approved by ${actorName} at ${event_at_local} · Notes: ${notes}`,
    metadata: {
      rm_id: rmId,
      rm_name: rmName,
      lab_test_id: labTestId,
      decision: 'APPROVED',
      fat,
      protein,
      moisture,
      acidity,
      notes,
      grn_id: grnId
    }
  });
};

// Phase 3: Lab RM Rejected
const triggerLabRMRejected = async ({ rmId, rmName, labTestId, notes, actorName, actorId, actorRole }) => {
  const event_at = new Date();
  const event_at_local = formatLocalTime(event_at);

  await notificationService.createNotification({
    type: 'LAB_RM_REJECTED',
    recipient_roles: ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT', 'MATERIALS_RECEIVER'],
    sender_role: actorRole,
    sender_id: actorId,
    reference_type: 'LAB_RM',
    reference_id: labTestId,
    event_at,
    message: `❌ RM Lab REJECTED — RM #${rmId} · ${rmName} · Rejected by ${actorName} at ${event_at_local} · Reason: ${notes}`,
    metadata: {
      rm_id: rmId,
      rm_name: rmName,
      lab_test_id: labTestId,
      decision: 'REJECTED',
      notes,
      actor_name: actorName
    }
  });
};

// Phase 3: Lab RM Resample
const triggerLabRMResample = async ({ rmId, rmName, labTestId, notes, grnId, actorName, actorId, actorRole }) => {
  const event_at = new Date();
  const event_at_local = formatLocalTime(event_at);

  await notificationService.createNotification({
    type: 'LAB_RM_RESAMPLE',
    recipient_roles: ['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER'],
    sender_role: actorRole,
    sender_id: actorId,
    reference_type: 'LAB_RM',
    reference_id: labTestId,
    event_at,
    message: `🔁 Re-Sample Requested — RM #${rmId} · ${rmName} · Requested by ${actorName} at ${event_at_local} · Notes: ${notes}`,
    metadata: {
      rm_id: rmId,
      rm_name: rmName,
      lab_test_id: labTestId,
      decision: 'NEED_SAMPLE',
      notes,
      actor_name: actorName,
      grn_id: grnId
    }
  });
};

// Phase 3b: Final Qty Submitted
const triggerFinalQtySubmitted = async ({ rmId, rmName, finalApprovedQty, uom, grnId, actorName, actorId, actorRole }) => {
  const event_at = new Date();
  const event_at_local = formatLocalTime(event_at);

  await notificationService.createNotification({
    type: 'FINAL_QTY_SUBMITTED',
    recipient_roles: ['MAIN_MASTER', 'SUPERVISOR', 'LAB_ASSISTANT', 'PRODUCTION_STAFF'],
    sender_role: actorRole,
    sender_id: actorId,
    reference_type: 'GRN',
    reference_id: grnId,
    event_at,
    message: `📋 Final Approved Qty Set — RM #${rmId} · ${rmName} · Final Qty: ${finalApprovedQty} ${uom} · Submitted by ${actorName} at ${event_at_local} · Status: QUEUED FOR PRODUCTION`,
    metadata: {
      rm_id: rmId,
      rm_name: rmName,
      final_approved_qty: finalApprovedQty,
      uom,
      grn_id: grnId
    }
  });
};

// Phase 4: Production Started
const triggerProductionStarted = async ({ batchId, rmId, rmName, estimatedQty, actualRmUsed, uom, actorName, actorId, actorRole }) => {
  const event_at = new Date();
  const event_at_local = formatLocalTime(event_at);

  await notificationService.createNotification({
    type: 'PRODUCTION_STARTED',
    recipient_roles: ['MAIN_MASTER', 'SUPERVISOR', 'LAB_ASSISTANT'],
    sender_role: actorRole,
    sender_id: actorId,
    reference_type: 'BATCH',
    reference_id: batchId,
    event_at,
    message: `🏗️ Production Started — Batch #${batchId} · RM #${rmId} · ${rmName} · Estimated Output: ${estimatedQty} pcs · Actual RM Used: ${actualRmUsed} ${uom} · Started by ${actorName} at ${event_at_local}`,
    metadata: {
      batch_id: batchId,
      rm_id: rmId,
      rm_name: rmName,
      estimated_qty: estimatedQty,
      actual_rm_used: actualRmUsed,
      uom,
      actor_name: actorName
    }
  });
};

// Phase 4: Production On Hold
const triggerProductionOnHold = async ({ batchId, rmId, rmName, holdReason, actorName, actorId, actorRole }) => {
  const event_at = new Date();
  const event_at_local = formatLocalTime(event_at);

  await notificationService.createNotification({
    type: 'PRODUCTION_ON_HOLD',
    recipient_roles: ['MAIN_MASTER', 'SUPERVISOR', 'PRODUCTION_STAFF', 'LAB_ASSISTANT'],
    sender_role: actorRole,
    sender_id: actorId,
    reference_type: 'BATCH',
    reference_id: batchId,
    event_at,
    message: `⏸️ Batch #${batchId} on hold — Reason: ${holdReason} · by ${actorName} at ${event_at_local}`,
    metadata: {
      batch_id: batchId,
      rm_id: rmId,
      rm_name: rmName,
      hold_reason: holdReason,
      status: 'ON_HOLD',
      actor_name: actorName
    }
  });
};

// Phase 4: Production Completed
const triggerProductionCompleted = async ({ batchId, rmId, rmName, actualRmUsed, rmRemaining, uom, estimatedQty, actorName, actorId, actorRole }) => {
  const event_at = new Date();
  const event_at_local = formatLocalTime(event_at, true);

  await notificationService.createNotification({
    type: 'PRODUCTION_COMPLETED',
    recipient_roles: ['MAIN_MASTER', 'SUPERVISOR', 'LAB_ASSISTANT'],
    sender_role: actorRole,
    sender_id: actorId,
    reference_type: 'BATCH',
    reference_id: batchId,
    event_at,
    message: `🎯 Production COMPLETED — Batch #${batchId} · RM #${rmId} · ${rmName} · Actual RM Used: ${actualRmUsed} ${uom} · Remaining: ${rmRemaining} ${uom} · Completed by ${actorName} at ${event_at_local} — QC Required`,
    metadata: {
      batch_id: batchId,
      rm_id: rmId,
      rm_name: rmName,
      actual_rm_used: actualRmUsed,
      rm_remaining: rmRemaining,
      uom,
      estimated_qty: estimatedQty,
      actor_name: actorName
    }
  });
};

// Phase 5: Production QC Passed
const triggerProductionQCPassed = async ({ batchId, productName, approvedQty, expiryDate, qcTestId, qcParams, actorName, actorId, actorRole }) => {
  const event_at = new Date();
  const event_at_local = formatLocalTime(event_at);

  await notificationService.createNotification({
    type: 'PRODUCTION_QC_PASSED',
    recipient_roles: ['MAIN_MASTER', 'SUPERVISOR', 'PRODUCTION_STAFF', 'SALES_TEAM'],
    sender_role: actorRole,
    sender_id: actorId,
    reference_type: 'LAB_PRODUCTION',
    reference_id: qcTestId,
    event_at,
    message: `✅ Production QC PASSED — Batch #${batchId} · ${productName} · Approved Qty: ${approvedQty} pcs · Expiry Date: ${expiryDate} · QC by ${actorName} at ${event_at_local} — STOCK READY FOR SALES`,
    metadata: {
      batch_id: batchId,
      product_name: productName,
      approved_qty: approvedQty,
      expiry_date: expiryDate,
      qc_test_id: qcTestId,
      qc_params: qcParams,
      actor_name: actorName
    }
  });
};

// Phase 5: Production QC Failed
const triggerProductionQCFailed = async ({ batchId, productName, notes, qcTestId, actorName, actorId, actorRole }) => {
  const event_at = new Date();
  const event_at_local = formatLocalTime(event_at);

  await notificationService.createNotification({
    type: 'PRODUCTION_QC_FAILED',
    recipient_roles: ['MAIN_MASTER', 'SUPERVISOR', 'PRODUCTION_STAFF'],
    sender_role: actorRole,
    sender_id: actorId,
    reference_type: 'LAB_PRODUCTION',
    reference_id: qcTestId,
    event_at,
    message: `❌ Production QC FAILED — Batch #${batchId} · ${productName} · Failed by ${actorName} at ${event_at_local} · Reason: ${notes}`,
    metadata: {
      batch_id: batchId,
      product_name: productName,
      decision: 'QC_FAILED',
      notes,
      qc_test_id: qcTestId,
      actor_name: actorName
    }
  });
};

// Phase 6: Stock Low Alert
const triggerStockLowAlert = async ({ productId, productName, currentStock, reorderThreshold, batchId }) => {
  const event_at = new Date();
  const event_at_local = formatLocalTime(event_at);

  await notificationService.createNotification({
    type: 'STOCK_LOW_ALERT',
    recipient_roles: ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT', 'SALES_TEAM'],
    sender_role: 'SYSTEM',
    sender_id: 'system',
    reference_type: 'STOCK',
    reference_id: productId,
    event_at,
    message: `⚠️ Low stock — ${productName} · ${currentStock} pcs remaining · Reorder level: ${reorderThreshold} pcs · ${event_at_local}`,
    metadata: {
      product_id: productId,
      product_name: productName,
      current_stock: currentStock,
      reorder_threshold: reorderThreshold,
      batch_id: batchId
    }
  });
};

// Phase 6b: RM Low Stock Alert
const triggerRMLowStockAlert = async ({ rmId, rmName, currentStock, reorderLevel }) => {
  const event_at = new Date();
  const event_at_local = formatLocalTime(event_at);

  await notificationService.createNotification({
    type: 'RM_LOW_STOCK_ALERT',
    recipient_roles: ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT'],
    sender_role: 'SYSTEM',
    sender_id: 'system',
    reference_type: 'RM_STOCK',
    reference_id: rmId,
    event_at,
    message: `⚠️ Low RM Stock — ${rmName} · ${currentStock} remaining · Reorder level: ${reorderLevel} · ${event_at_local}`,
    metadata: {
      rm_id: rmId,
      rm_name: rmName,
      current_stock: currentStock,
      reorder_level: reorderLevel
    }
  });
};

// Phase 6: Stock Expiry Alert
const triggerStockExpiryAlert = async ({ batchId, productName, approvedQty, expiryDate, daysToExpiry }) => {
  const event_at = new Date();
  const event_at_local = formatLocalTime(event_at);

  await notificationService.createNotification({
    type: 'STOCK_EXPIRY_ALERT',
    recipient_roles: ['MAIN_MASTER', 'SUPERVISOR', 'SALES_TEAM'],
    sender_role: 'SYSTEM',
    sender_id: 'system',
    reference_type: 'STOCK',
    reference_id: batchId,
    event_at,
    message: `🕐 Batch #${batchId} · ${productName} expires on ${expiryDate} — ${daysToExpiry} days left · ${event_at_local}`,
    metadata: {
      batch_id: batchId,
      product_name: productName,
      approved_qty: approvedQty,
      expiry_date: expiryDate,
      days_to_expiry: daysToExpiry
    }
  });
};

// Phase 1d: PO Updated (alias for amended)
const triggerPOUpdated = async ({ poId, referenceNo, rmId, rmName, actorName, actorId, actorRole, changes }) => {
  const event_at = new Date();
  const event_at_local = formatLocalTime(event_at);

  await notificationService.createNotification({
    type: 'PO_UPDATED',
    recipient_roles: ['MAIN_MASTER', 'SUPERVISOR'],
    sender_role: actorRole,
    sender_id: actorId,
    reference_type: 'PO',
    reference_id: poId,
    event_at,
    message: `✏️ PO ${referenceNo || poId} updated — ${rmName} · Updated by ${actorName} at ${event_at_local}`,
    metadata: { po_id: poId, reference_no: referenceNo, rm_id: rmId, rm_name: rmName, changes }
  });
};

// Phase 2a: PO Status Changed to RECEIVED → notify Material Receiver
const triggerPOStatusChanged = async ({ poId, referenceNo, rmName, newStatus, actorName, actorId, actorRole }) => {
  const event_at = new Date();
  const event_at_local = formatLocalTime(event_at);
  const emoji = newStatus === 'RECEIVED' ? '🚚' : newStatus === 'ORDERED' ? '📋' : '📦';

  await notificationService.createNotification({
    type: 'PO_STATUS_CHANGED',
    recipient_roles: newStatus === 'RECEIVED'
      ? ['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER']
      : ['MAIN_MASTER', 'SUPERVISOR'],
    sender_role: actorRole,
    sender_id: actorId,
    reference_type: 'PO',
    reference_id: poId,
    event_at,
    message: `${emoji} PO ${referenceNo || poId} status changed to ${newStatus} — ${rmName} · By ${actorName} at ${event_at_local}`,
    metadata: { po_id: poId, reference_no: referenceNo, rm_name: rmName, new_status: newStatus }
  });
};

// ─────────────────────── ASSET MANAGEMENT NOTIFICATIONS ───────────────────────

// Asset PR Created
const triggerAssetPRCreated = async ({ prNo, prId, assetName, department, category, quantity, estimatedTotalCost, priority, requesterName, actorId, actorRole }) => {
  const event_at = new Date();
  const event_at_local = formatLocalTime(event_at);

  await notificationService.createNotification({
    type: 'ASSET_PR_CREATED',
    recipient_roles: ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT'],
    sender_role: actorRole,
    sender_id: actorId,
    reference_type: 'ASSET_PR',
    reference_id: prId,
    event_at,
    message: `📋 Asset Purchase Request — ${prNo} · ${assetName} · Dept: ${department} · Category: ${category} · Qty: ${quantity} · Est. Cost: ₹${Number(estimatedTotalCost).toLocaleString('en-IN')} · Priority: ${priority} · By ${requesterName} at ${event_at_local}`,
    metadata: {
      pr_no: prNo,
      pr_id: prId,
      asset_name: assetName,
      department,
      category,
      quantity,
      estimated_total_cost: estimatedTotalCost,
      priority,
      requester_name: requesterName
    }
  });
};

// Asset PR Approved
const triggerAssetPRApproved = async ({ prNo, prId, assetName, department, estimatedTotalCost, approverName, approverLevel, actorId, actorRole }) => {
  const event_at = new Date();
  const event_at_local = formatLocalTime(event_at);

  await notificationService.createNotification({
    type: 'ASSET_PR_APPROVED',
    recipient_roles: ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT'],
    sender_role: actorRole,
    sender_id: actorId,
    reference_type: 'ASSET_PR',
    reference_id: prId,
    event_at,
    message: `✅ Asset PR Approved — ${prNo} · ${assetName} · Dept: ${department} · Est. Cost: ₹${Number(estimatedTotalCost).toLocaleString('en-IN')} · Approval Level: ${approverLevel} · Approved by ${approverName} at ${event_at_local} — Proceed to Quotation`,
    metadata: {
      pr_no: prNo,
      pr_id: prId,
      asset_name: assetName,
      department,
      estimated_total_cost: estimatedTotalCost,
      approver_name: approverName,
      approver_level: approverLevel
    }
  });
};

// Asset PQ Created
const triggerAssetPQCreated = async ({ pqNo, pqId, prNo, vendorName, vendorGstin, grandTotal, validUntil, actorId, actorRole }) => {
  const event_at = new Date();
  const event_at_local = formatLocalTime(event_at);

  await notificationService.createNotification({
    type: 'ASSET_PQ_CREATED',
    recipient_roles: ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT'],
    sender_role: actorRole,
    sender_id: actorId,
    reference_type: 'ASSET_PQ',
    reference_id: pqId,
    event_at,
    message: `📄 Asset Quotation Received — ${pqNo} · PR: ${prNo} · Vendor: ${vendorName} · GSTIN: ${vendorGstin || 'N/A'} · Total: ₹${Number(grandTotal).toLocaleString('en-IN')} · Valid Until: ${new Date(validUntil).toLocaleDateString('en-IN')} · Logged at ${event_at_local}`,
    metadata: {
      pq_no: pqNo,
      pq_id: pqId,
      pr_no: prNo,
      vendor_name: vendorName,
      vendor_gstin: vendorGstin,
      grand_total: grandTotal,
      valid_until: validUntil
    }
  });
};

// Asset PO Created
const triggerAssetPOCreated = async ({ poNo, poId, prNo, pqNo, vendorName, vendorGstin, grandTotal, deliveryDate, department, actorName, actorId, actorRole }) => {
  const event_at = new Date();
  const event_at_local = formatLocalTime(event_at);

  await notificationService.createNotification({
    type: 'ASSET_PO_CREATED',
    recipient_roles: ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT'],
    sender_role: actorRole,
    sender_id: actorId,
    reference_type: 'ASSET_PO',
    reference_id: poId,
    event_at,
    message: `🛒 Asset Purchase Order Issued — ${poNo} · PQ: ${pqNo || 'Direct'} · PR: ${prNo || 'Direct'} · Vendor: ${vendorName} · GSTIN: ${vendorGstin || 'N/A'} · Total: ₹${Number(grandTotal).toLocaleString('en-IN')} · Delivery: ${new Date(deliveryDate).toLocaleDateString('en-IN')} · By ${actorName} at ${event_at_local}`,
    metadata: {
      po_no: poNo,
      po_id: poId,
      pr_no: prNo,
      pq_no: pqNo,
      vendor_name: vendorName,
      vendor_gstin: vendorGstin,
      grand_total: grandTotal,
      delivery_date: deliveryDate,
      department,
      actor_name: actorName
    }
  });
};

// Asset GRPO Created
const triggerAssetGRPOCreated = async ({ grpoNo, grpoId, poNo, vendorName, receivedBy, qcStatus, itemCount, actorId, actorRole }) => {
  const event_at = new Date();
  const event_at_local = formatLocalTime(event_at);

  await notificationService.createNotification({
    type: 'ASSET_GRPO_CREATED',
    recipient_roles: ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT'],
    sender_role: actorRole,
    sender_id: actorId,
    reference_type: 'ASSET_GRPO',
    reference_id: grpoId,
    event_at,
    message: `📦 Asset Goods Received — ${grpoNo} · PO: ${poNo} · Vendor: ${vendorName} · QC: ${qcStatus} · Items: ${itemCount} line(s) · Received by ${receivedBy} at ${event_at_local} — Assets capitalized in register`,
    metadata: {
      grpo_no: grpoNo,
      grpo_id: grpoId,
      po_no: poNo,
      vendor_name: vendorName,
      received_by: receivedBy,
      qc_status: qcStatus,
      item_count: itemCount
    }
  });
};

// Asset AP Invoice Created
const triggerAssetAPInvoiceCreated = async ({ invoiceNo, invoiceId, poNo, grpoNo, vendorName, vendorGstin, grandTotal, netPayable, dueDate, actorId, actorRole }) => {
  const event_at = new Date();
  const event_at_local = formatLocalTime(event_at);

  await notificationService.createNotification({
    type: 'ASSET_INVOICE_CREATED',
    recipient_roles: ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT'],
    sender_role: actorRole,
    sender_id: actorId,
    reference_type: 'ASSET_INVOICE',
    reference_id: invoiceId,
    event_at,
    message: `🧾 Asset A/P Invoice Posted — ${invoiceNo} · PO: ${poNo} · GRPO: ${grpoNo} · Vendor: ${vendorName} · GSTIN: ${vendorGstin || 'N/A'} · Total: ₹${Number(grandTotal).toLocaleString('en-IN')} · Net Payable: ₹${Number(netPayable).toLocaleString('en-IN')} · Due: ${new Date(dueDate).toLocaleDateString('en-IN')} · Posted at ${event_at_local}`,
    metadata: {
      invoice_no: invoiceNo,
      invoice_id: invoiceId,
      po_no: poNo,
      grpo_no: grpoNo,
      vendor_name: vendorName,
      vendor_gstin: vendorGstin,
      grand_total: grandTotal,
      net_payable: netPayable,
      due_date: dueDate
    }
  });
};

// Asset Invoice Paid
const triggerAssetInvoicePaid = async ({ invoiceNo, invoiceId, vendorName, netPayable, actorId, actorRole }) => {
  const event_at = new Date();
  const event_at_local = formatLocalTime(event_at);

  await notificationService.createNotification({
    type: 'ASSET_INVOICE_PAID',
    recipient_roles: ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT'],
    sender_role: actorRole,
    sender_id: actorId,
    reference_type: 'ASSET_INVOICE',
    reference_id: invoiceId,
    event_at,
    message: `💳 Asset Invoice Marked Paid — ${invoiceNo} · Vendor: ${vendorName} · Amount Settled: ₹${Number(netPayable).toLocaleString('en-IN')} · Cleared at ${event_at_local}`,
    metadata: {
      invoice_no: invoiceNo,
      invoice_id: invoiceId,
      vendor_name: vendorName,
      net_payable: netPayable
    }
  });
};

// Asset Decommissioned
const triggerAssetDecommissioned = async ({ assetId, assetName, category, department, bookValue, actorId, actorRole }) => {
  const event_at = new Date();
  const event_at_local = formatLocalTime(event_at);

  await notificationService.createNotification({
    type: 'ASSET_DECOMMISSIONED',
    recipient_roles: ['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT'],
    sender_role: actorRole,
    sender_id: actorId,
    reference_type: 'ASSET',
    reference_id: assetId,
    event_at,
    message: `🗑️ Asset Decommissioned — ${assetId} · ${assetName} · Category: ${category} · Dept: ${department} · Book Value at Disposal: ₹${Number(bookValue).toLocaleString('en-IN')} · Decommissioned at ${event_at_local}`,
    metadata: {
      asset_id: assetId,
      asset_name: assetName,
      category,
      department,
      book_value: bookValue
    }
  });
};

module.exports = {
  triggerPOCreated,
  triggerPOAmended,
  triggerPOCancelled,
  triggerGRNSubmitted,
  triggerLabRMApproved,
  triggerLabRMRejected,
  triggerLabRMResample,
  triggerFinalQtySubmitted,
  triggerProductionStarted,
  triggerProductionOnHold,
  triggerProductionCompleted,
  triggerProductionQCPassed,
  triggerProductionQCFailed,
  triggerStockLowAlert,
  triggerRMLowStockAlert,
  triggerStockExpiryAlert,
  triggerPOUpdated,
  triggerPOStatusChanged,
  // Asset Management
  triggerAssetPRCreated,
  triggerAssetPRApproved,
  triggerAssetPQCreated,
  triggerAssetPOCreated,
  triggerAssetGRPOCreated,
  triggerAssetAPInvoiceCreated,
  triggerAssetInvoicePaid,
  triggerAssetDecommissioned
};
