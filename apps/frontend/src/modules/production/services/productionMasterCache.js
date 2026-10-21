import { api } from '@/lib/axios';

/**
 * High-performance In-Memory & Session-backed Cache for Production Master Data.
 * 
 * Provides:
 * - Instant 0ms hydration on repeated page visits or tab switching
 * - Stale-While-Revalidate (SWR) background refresh
 * - SessionStorage persistence for instant recovery on full browser refresh
 * - Resilient Promise.allSettled error isolation
 */

const CACHE_KEY = 'mfg_erp_production_masters_cache_v2';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes fresh TTL

let inMemoryCache = null;
let activeFetchPromise = null;

// Try to hydrate in-memory cache from sessionStorage immediately
try {
  const stored = sessionStorage.getItem(CACHE_KEY);
  if (stored) {
    const parsed = JSON.parse(stored);
    if (parsed && parsed.timestamp && (Date.now() - parsed.timestamp) < CACHE_TTL_MS * 3) {
      inMemoryCache = parsed.data;
    }
  }
} catch (e) {
  // Ignore sessionStorage errors
}

/**
 * Fetch all production masters with intelligent caching & SWR
 */
export async function getProductionMasters({ forceRefresh = false } = {}) {
  const now = Date.now();

  // Return instant in-memory cache if available and not forced
  if (!forceRefresh && inMemoryCache) {
    // If cache is getting older than TTL, trigger background revalidation without blocking UI
    if (!activeFetchPromise && (now - (inMemoryCache._timestamp || 0)) > CACHE_TTL_MS) {
      fetchMastersFromNetwork().catch(() => {});
    }
    return inMemoryCache;
  }

  // Deduplicate inflight network requests
  if (activeFetchPromise) {
    return activeFetchPromise;
  }

  activeFetchPromise = fetchMastersFromNetwork()
    .finally(() => {
      activeFetchPromise = null;
    });

  return activeFetchPromise;
}

/**
 * Internal worker to query network and cache results
 */
async function fetchMastersFromNetwork() {
  const results = await Promise.allSettled([
    api.get('/production/bases'),
    api.get('/production/templates'),
    api.get('/products'),
    api.get('/item-setup/product-category').catch(() => ({ data: [] })),
    api.get('/product-subcategories').catch(() => ({ data: [] })),
    api.get('/item-setup/raw-material').catch(() => ({ data: [] })),
    api.get('/uom').catch(() => ({ data: [] })),
    api.get('/sales/list').catch(() => api.get('/orders')).catch(() => ({ data: [] })),
    api.get('/products/low-stock').catch(() => ({ data: [] }))
  ]);

  const [bRes, tplRes, prodRes, catRes, subRes, rmRes, uomRes, ordRes, lowRes] = results;

  const bases = bRes.status === 'fulfilled' ? (bRes.value?.data || []) : (inMemoryCache?.bases || []);
  const templates = tplRes.status === 'fulfilled' ? (tplRes.value?.data || []) : (inMemoryCache?.templates || []);
  const products = prodRes.status === 'fulfilled' ? (prodRes.value?.data?.data || prodRes.value?.data || []) : (inMemoryCache?.products || []);
  const categories = catRes.status === 'fulfilled' ? (catRes.value?.data || []) : (inMemoryCache?.categories || []);
  const subcategories = subRes.status === 'fulfilled' ? (subRes.value?.data || []) : (inMemoryCache?.subcategories || []);
  const rawMaterials = rmRes.status === 'fulfilled' ? (rmRes.value?.data || []) : (inMemoryCache?.rawMaterials || []);
  const uoms = uomRes.status === 'fulfilled' ? (uomRes.value?.data || []) : (inMemoryCache?.uoms || []);
  const orders = ordRes.status === 'fulfilled' ? (ordRes.value?.data?.orders || (Array.isArray(ordRes.value?.data) ? ordRes.value?.data : [])) : (inMemoryCache?.orders || []);
  const lowStock = lowRes.status === 'fulfilled' ? (lowRes.value?.data || []) : (inMemoryCache?.lowStock || []);

  const cachedData = {
    bases,
    templates,
    products,
    categories,
    subcategories,
    rawMaterials,
    uoms,
    orders,
    lowStock,
    _timestamp: Date.now()
  };

  inMemoryCache = cachedData;

  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      data: cachedData
    }));
  } catch (e) {
    // Quota exceeded or private browsing
  }

  return cachedData;
}

/**
 * Invalidate cache to force a fresh fetch
 */
export function invalidateProductionMasters() {
  inMemoryCache = null;
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch (e) {}
}

/**
 * Synchronous getter to check if cache already has data
 */
export function peekProductionMasters() {
  return inMemoryCache;
}
