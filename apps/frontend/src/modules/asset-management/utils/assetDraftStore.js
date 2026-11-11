import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

const STORAGE_PREFIX = 'erp_asset_draft_v1';
const SESSION_PREFIX = 'erp_asset_session_v1';
const DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Resolves the active user identifier synchronously from auth storage as a fallback
 * so draft keys remain consistent on immediate mount and page refresh.
 */
export function resolveDraftUserId(userId) {
  if (userId) return String(userId);
  try {
    const raw = localStorage.getItem('leonex-auth');
    if (raw) {
      const parsed = JSON.parse(raw);
      const storedId = parsed?.state?.user?.id;
      if (storedId) return String(storedId);
    }
  } catch {
    // Ignore storage access failures
  }
  return 'default';
}

export function getModeKey(editId) {
  return editId ? `edit:${String(editId)}` : 'create';
}

function buildSessionKey(moduleKey, userId) {
  return `${SESSION_PREFIX}:${resolveDraftUserId(userId)}:${moduleKey}`;
}

function buildDraftKey(moduleKey, userId, editId = null) {
  return `${STORAGE_PREFIX}:${resolveDraftUserId(userId)}:${moduleKey}:${getModeKey(editId)}`;
}

function buildDraftKeyPrefix(moduleKey, userId) {
  return `${STORAGE_PREFIX}:${resolveDraftUserId(userId)}:${moduleKey}:`;
}

function safeParse(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.updatedAt && Date.now() - parsed.updatedAt > DRAFT_TTL_MS) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function reviveDateFields(formObj, dateFields = []) {
  if (!formObj || typeof formObj !== 'object') return formObj;
  if (!dateFields.length) return formObj;
  const revived = { ...formObj };
  dateFields.forEach((field) => {
    const val = revived[field];
    if (!val) {
      revived[field] = null;
      return;
    }
    if (val instanceof Date) {
      revived[field] = isNaN(val.getTime()) ? null : val;
      return;
    }
    const d = new Date(val);
    revived[field] = isNaN(d.getTime()) ? null : d;
  });
  return revived;
}

export function readAssetSession(moduleKey, userId) {
  try {
    const key = buildSessionKey(moduleKey, userId);
    const parsed = safeParse(localStorage.getItem(key));
    if (!parsed) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveAssetSession(moduleKey, userId, { isOpen, viewMode = 'create', editId = null }) {
  try {
    const key = buildSessionKey(moduleKey, userId);
    localStorage.setItem(
      key,
      JSON.stringify({
        isOpen: Boolean(isOpen),
        viewMode,
        editId: editId || null,
        updatedAt: Date.now(),
      })
    );
  } catch {
    // Ignore quota or privacy errors
  }
}

export function clearAssetSession(moduleKey, userId) {
  try {
    localStorage.removeItem(buildSessionKey(moduleKey, userId));
  } catch {
    // Ignore storage errors
  }
}

export function readAssetDraft(moduleKey, userId, editId = null, dateFields = []) {
  try {
    const key = buildDraftKey(moduleKey, userId, editId);
    const parsed = safeParse(localStorage.getItem(key));
    if (!parsed) {
      localStorage.removeItem(key);
      return null;
    }
    return {
      ...parsed,
      form: reviveDateFields(parsed.form, dateFields),
      extras: parsed.extras || {},
    };
  } catch {
    return null;
  }
}

export function saveAssetDraft(moduleKey, userId, editId = null, { form, extras = {} }) {
  try {
    const key = buildDraftKey(moduleKey, userId, editId);
    localStorage.setItem(
      key,
      JSON.stringify({
        editId: editId || null,
        form,
        extras,
        updatedAt: Date.now(),
      })
    );
  } catch {
    // Ignore quota or privacy errors
  }
}

export function clearAssetDraft(moduleKey, userId, editId = null) {
  try {
    localStorage.removeItem(buildDraftKey(moduleKey, userId, editId));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Returns the most recent unsaved draft (create or edit) for a given module so
 * the list view can show a Resume / Discard banner if the user navigated back.
 */
export function getLatestAssetDraftInfo(moduleKey, userId) {
  try {
    const prefix = buildDraftKeyPrefix(moduleKey, userId);
    let latest = null;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(prefix)) continue;
      const parsed = safeParse(localStorage.getItem(k));
      if (!parsed) {
        localStorage.removeItem(k);
        continue;
      }
      if (!latest || (parsed.updatedAt || 0) > (latest.updatedAt || 0)) {
        latest = {
          editId: parsed.editId || null,
          updatedAt: parsed.updatedAt || Date.now(),
          form: parsed.form || {},
        };
      }
    }
    return latest;
  } catch {
    return null;
  }
}

/**
 * React hook managing view/editId persistence across page refreshes & tab switches
 * for each Asset Management sub-page. Draft data is only cleared on Submit (or Discard).
 */
export function useAssetPageSession(moduleKey, userId, { createViewName = 'create' } = {}) {
  const [initialSession] = useState(() => readAssetSession(moduleKey, userId));

  const [view, setViewState] = useState(() =>
    initialSession?.isOpen ? (initialSession.viewMode || createViewName) : 'list'
  );
  const [editId, setEditIdState] = useState(() =>
    initialSession?.isOpen ? (initialSession.editId || null) : null
  );
  const [, bumpDraftVersion] = useState(0);

  const openCreate = useCallback(() => {
    setEditIdState(null);
    setViewState(createViewName);
    saveAssetSession(moduleKey, userId, {
      isOpen: true,
      viewMode: createViewName,
      editId: null,
    });
  }, [moduleKey, userId, createViewName]);

  const openEdit = useCallback((id) => {
    const targetId = id || null;
    setEditIdState(targetId);
    setViewState(createViewName);
    saveAssetSession(moduleKey, userId, {
      isOpen: true,
      viewMode: createViewName,
      editId: targetId,
    });
  }, [moduleKey, userId, createViewName]);

  const closeForm = useCallback(() => {
    setViewState('list');
    setEditIdState(null);
    // Mark form closed in session WITHOUT deleting the saved form draft data
    saveAssetSession(moduleKey, userId, {
      isOpen: false,
      viewMode: 'list',
      editId: null,
    });
    bumpDraftVersion((v) => v + 1);
  }, [moduleKey, userId]);

  const discardDraft = useCallback((targetEditId = null) => {
    clearAssetDraft(moduleKey, userId, targetEditId);
    if (view !== 'list' && (targetEditId || null) === (editId || null)) {
      clearAssetSession(moduleKey, userId);
    }
    bumpDraftVersion((v) => v + 1);
  }, [moduleKey, userId, view, editId]);

  const resumeDraft = useCallback((targetEditId = null) => {
    if (targetEditId) {
      openEdit(targetEditId);
    } else {
      openCreate();
    }
  }, [openEdit, openCreate]);

  const latestDraftInfo = view === 'list' ? getLatestAssetDraftInfo(moduleKey, userId) : null;

  return {
    view,
    setView: setViewState,
    editId,
    setEditId: setEditIdState,
    openCreate,
    openEdit,
    closeForm,
    discardDraft,
    resumeDraft,
    latestDraftInfo,
  };
}

/**
 * React hook wired inside each Create/Edit form component AFTER useState(form) / useState(extras).
 * Read `savedDraft` via `useState(() => readAssetDraft(...))` at the top of the form component.
 * Draft data is ONLY removed when `clearDraftOnSubmit()` is called.
 */
export function useAssetFormDraft({
  moduleKey,
  userId,
  editId = null,
  savedDraft = null,
  form,
  extras = {},
  isEditMode = Boolean(editId),
}) {
  const hasRestoredDraft = Boolean(savedDraft);
  const hasSavedDraftRef = useRef(hasRestoredDraft);
  const isDirtyRef = useRef(hasRestoredDraft);
  const isServerHydratedRef = useRef(!isEditMode || hasRestoredDraft);
  const expectingServerCommitRef = useRef(false);
  const currentJson = JSON.stringify({ form, extras });
  const baselineJsonRef = useRef(isEditMode ? null : currentJson);
  const latestPayloadRef = useRef({ form, extras });

  useEffect(() => {
    latestPayloadRef.current = { form, extras };
  }, [form, extras]);

  // Call immediately before applying initial server data in Edit mode so clean server state isn't treated as a dirty draft
  const beginServerHydration = useCallback(() => {
    expectingServerCommitRef.current = true;
  }, []);

  // Explicitly mark the form dirty (e.g. when prefilled from PQ conversion) so F5 preserves it
  const markDirty = useCallback(() => {
    isDirtyRef.current = true;
    hasSavedDraftRef.current = true;
    isServerHydratedRef.current = true;
    expectingServerCommitRef.current = false;
  }, []);

  // Re-baseline default Create snapshot after non-user default population (e.g. requester profile defaults)
  const rebaseBaseline = useCallback(() => {
    if (!hasSavedDraftRef.current) {
      baselineJsonRef.current = JSON.stringify(latestPayloadRef.current);
    }
  }, []);

  useEffect(() => {
    if (expectingServerCommitRef.current) {
      expectingServerCommitRef.current = false;
      isServerHydratedRef.current = true;
      baselineJsonRef.current = currentJson;
      return;
    }

    if (!isServerHydratedRef.current) {
      return;
    }

    if (!isDirtyRef.current) {
      if (baselineJsonRef.current !== null && currentJson === baselineJsonRef.current) {
        return;
      }
      isDirtyRef.current = true;
      hasSavedDraftRef.current = true;
    }

    saveAssetDraft(moduleKey, userId, editId, { form, extras });
  }, [currentJson, moduleKey, userId, editId, form, extras]);

  useEffect(() => {
    const flushIfDirty = () => {
      if (isDirtyRef.current || hasSavedDraftRef.current) {
        saveAssetDraft(moduleKey, userId, editId, latestPayloadRef.current);
      }
    };
    window.addEventListener('beforeunload', flushIfDirty);
    window.addEventListener('pagehide', flushIfDirty);
    return () => {
      window.removeEventListener('beforeunload', flushIfDirty);
      window.removeEventListener('pagehide', flushIfDirty);
      flushIfDirty();
    };
  }, [moduleKey, userId, editId]);

  const clearDraftOnSubmit = useCallback(() => {
    isDirtyRef.current = false;
    hasSavedDraftRef.current = false;
    clearAssetDraft(moduleKey, userId, editId);
    clearAssetSession(moduleKey, userId);
  }, [moduleKey, userId, editId]);

  const hasSavedOrEditedDraft = useCallback(
    () => isDirtyRef.current || hasSavedDraftRef.current,
    []
  );

  return useMemo(() => ({
    hasRestoredDraft,
    hasSavedOrEditedDraft,
    beginServerHydration,
    markDirty,
    rebaseBaseline,
    clearDraftOnSubmit,
  }), [
    hasRestoredDraft,
    hasSavedOrEditedDraft,
    beginServerHydration,
    markDirty,
    rebaseBaseline,
    clearDraftOnSubmit,
  ]);
}
