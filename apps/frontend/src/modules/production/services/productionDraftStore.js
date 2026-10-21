/**
 * Unified Reactive Persistent Draft Store for Production Batches
 * 
 * Supports:
 * - Real-time auto-save across Standard, Order-Based, and Low Stock Replenishment
 * - Seamless state retention when switching between tabs/routes without reload
 * - Full hydration from LocalStorage on browser refresh/reopen
 * - Clean purge ONLY when "Start Production" is clicked and batch is successfully created
 */

const DRAFT_STORAGE_KEY = 'mfg_erp_production_draft_v2';
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days retention

let inMemoryDraft = null;
let saveDebounceTimer = null;

// Hydrate on module initialization
try {
  const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
  if (saved) {
    const parsed = JSON.parse(saved);
    if (parsed && parsed.lastSavedAt && (Date.now() - parsed.lastSavedAt) < DRAFT_TTL_MS) {
      inMemoryDraft = parsed;
    } else {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    }
  }
} catch (e) {
  // LocalStorage not accessible
}

/**
 * Get current production draft (from memory or localStorage)
 */
export function getProductionDraft() {
  if (inMemoryDraft) return inMemoryDraft;
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && (Date.now() - (parsed.lastSavedAt || 0)) < DRAFT_TTL_MS) {
        inMemoryDraft = parsed;
        return inMemoryDraft;
      }
    }
  } catch (e) {}
  return null;
}

/**
 * Save draft state (debounced by 250ms for 60fps performance)
 */
export function saveProductionDraft(data, mode = 'STANDARD') {
  if (!data) return;

  const draftPayload = {
    ...data,
    lastSavedMode: mode,
    lastSavedAt: Date.now()
  };

  inMemoryDraft = draftPayload;

  if (saveDebounceTimer) {
    clearTimeout(saveDebounceTimer);
  }

  saveDebounceTimer = setTimeout(() => {
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftPayload));
    } catch (e) {
      // Storage quota or privacy mode
    }
  }, 250);
}

/**
 * Immediately persist draft without debounce (e.g. before navigating)
 */
export function flushProductionDraft(data, mode = 'STANDARD') {
  if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
  const draftPayload = {
    ...data,
    lastSavedMode: mode,
    lastSavedAt: Date.now()
  };
  inMemoryDraft = draftPayload;
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftPayload));
  } catch (e) {}
}

/**
 * Clear the draft completely (called on successful Start Production or user reset)
 */
export function clearProductionDraft() {
  if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
  inMemoryDraft = null;
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch (e) {}
}

/**
 * Check if a non-empty user draft exists
 */
export function hasProductionDraft() {
  const draft = getProductionDraft();
  if (!draft) return false;
  return Boolean(
    (Array.isArray(draft.selectedProducts) && draft.selectedProducts.length > 0) ||
    draft.selectedBaseId ||
    draft.selectedTemplate ||
    draft.note ||
    (Array.isArray(draft.rawMaterials) && draft.rawMaterials.some(rm => (rm.allocatedBatches || []).length > 0)) ||
    draft.selectedOrderId
  );
}
