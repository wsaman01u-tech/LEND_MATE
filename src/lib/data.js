import { isFirebaseConfigured, db, auth } from './firebase';
import {
  addDoc, collection, deleteDoc, doc, getDoc,
  increment as fbIncrement, limit as fbLimit, onSnapshot,
  orderBy as fbOrderBy, query, serverTimestamp as fbServerTimestamp,
  setDoc, updateDoc, where as fbWhere
} from 'firebase/firestore';
import { isOnline, onNetworkChange, enqueueOfflineOp, getOfflineQueue, clearOfflineQueue, setLastSync } from './capacitor';

// Get current authenticated user's UID for multi-tenancy
export const getCurrentUserId = () => auth?.currentUser?.uid || null;

// ── Local storage engine (used as cache + fallback) ────────────────────────
const LS_KEY = 'sgmi-data';
const listeners = new Set();
const load = () => { try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch { return {}; } };
const persist = (data) => { localStorage.setItem(LS_KEY, JSON.stringify(data)); listeners.forEach((l) => l()); };
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

const rehydrate = (obj) => {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (v && typeof v === 'object' && '_t' in v && Object.keys(v).length === 1) {
      out[k] = { _t: v._t, toDate: () => new Date(v._t) };
    } else out[k] = v;
  }
  return out;
};

// Cache snapshot data locally for offline reads
const cacheSnapshot = (coll, items) => {
  const data = load();
  data[coll] = {};
  for (const item of items) {
    const { id, ...rest } = item;
    data[coll][id] = rest;
  }
  persist(data);
};

// Apply a local-only write (for offline queued ops) so UI stays responsive
const applyLocal = (coll, id, payload, mode = 'set') => {
  const data = load();
  data[coll] = data[coll] || {};
  if (mode === 'delete') { delete data[coll][id]; }
  else if (mode === 'update') {
    const cur = data[coll][id] || {};
    const next = { ...cur };
    for (const [k, v] of Object.entries(payload)) {
      if (v && typeof v === 'object' && '__inc' in v) next[k] = (Number(next[k]) || 0) + v.__inc;
      else next[k] = v;
    }
    data[coll][id] = next;
  } else {
    data[coll][id] = payload;
  }
  persist(data);
};

export const serverTimestamp = () => isFirebaseConfigured ? fbServerTimestamp() : { _t: Date.now() };
export const increment = (n) => isFirebaseConfigured ? fbIncrement(n) : { __inc: n };

// ── Offline sync queue replay ──────────────────────────────────────────────
let _syncing = false;
export async function syncOfflineQueue() {
  if (!isFirebaseConfigured || !isOnline() || _syncing) return 0;
  _syncing = true;
  const queue = await getOfflineQueue();
  if (!queue.length) { _syncing = false; return 0; }

  let synced = 0;
  const failed = [];
  for (const op of queue) {
    try {
      if (op.type === 'add') await addDoc(collection(db, op.coll), op.payload);
      else if (op.type === 'set') await setDoc(doc(db, op.coll, op.id), op.payload);
      else if (op.type === 'update') await updateDoc(doc(db, op.coll, op.id), op.payload);
      else if (op.type === 'delete') await deleteDoc(doc(db, op.coll, op.id));
      synced++;
    } catch (e) {
      console.warn('[Sync] Failed op:', op, e);
      failed.push(op);
    }
  }
  await clearOfflineQueue();
  if (failed.length) {
    const { saveOfflineQueue } = await import('./capacitor');
    await saveOfflineQueue(failed);
  }
  if (synced > 0) await setLastSync();
  _syncing = false;
  return synced;
}

// Auto-sync when network comes back
onNetworkChange((online) => { if (online) syncOfflineQueue(); });

// ── subscribe ──────────────────────────────────────────────────────────────
export function subscribe(coll, opts, cb) {
  const { orderBy, where, limit } = opts || {};
  if (isFirebaseConfigured) {
    const userId = getCurrentUserId();
    const constraints = [];
    // Auto-filter by userId for top-level collections to enforce 100% data separation
    if (userId) constraints.push(fbWhere('userId', '==', userId));
    if (where) constraints.push(fbWhere(...where));
    if (orderBy) constraints.push(fbOrderBy(...(Array.isArray(orderBy) ? orderBy : [orderBy])));
    if (limit) constraints.push(fbLimit(limit));
    const q = query(collection(db, coll), ...constraints);
    return onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // Cache for offline
      if (!where && !limit) cacheSnapshot(coll, items);
      cb(items);
    }, () => {
      // On error (offline), serve from local cache, filtered by current user
      const all = load()[coll] || {};
      let items = Object.entries(all).map(([id, v]) => ({ id, ...rehydrate(v) }));
      if (userId) {
        items = items.filter((i) => i.userId === userId);
      }
      if (where) {
        const [field, op, val] = where;
        items = items.filter((i) => (op === '==' ? i[field] === val : true));
      }
      if (orderBy) {
        const [field, dir] = Array.isArray(orderBy) ? orderBy : [orderBy];
        items.sort((a, b) => {
          const av = a[field]?._t ?? a[field] ?? 0;
          const bv = b[field]?._t ?? b[field] ?? 0;
          return (dir === 'desc' ? -1 : 1) * (av > bv ? 1 : av < bv ? -1 : 0);
        });
      }
      if (limit) items = items.slice(0, limit);
      cb(items);
    });
  }
  const compute = () => {
    const all = load()[coll] || {};
    let items = Object.entries(all).map(([id, v]) => ({ id, ...rehydrate(v) }));
    const userId = getCurrentUserId();
    if (userId) {
      items = items.filter((i) => i.userId === userId);
    }
    if (where) {
      const [field, op, val] = where;
      items = items.filter((i) => (op === '==' ? i[field] === val : true));
    }
    if (orderBy) {
      const [field, dir] = Array.isArray(orderBy) ? orderBy : [orderBy];
      items.sort((a, b) => {
        const av = a[field]?._t ?? a[field] ?? 0;
        const bv = b[field]?._t ?? b[field] ?? 0;
        return (dir === 'desc' ? -1 : 1) * (av > bv ? 1 : av < bv ? -1 : 0);
      });
    }
    if (limit) items = items.slice(0, limit);
    cb(items);
  };
  compute();
  const fn = () => compute();
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ── getOne ─────────────────────────────────────────────────────────────────
export async function getOne(coll, id) {
  if (isFirebaseConfigured) {
    try {
      const s = await getDoc(doc(db, coll, id));
      return s.exists() ? { id, ...s.data() } : null;
    } catch {
      // Offline: serve from cache, verifying ownership
      const v = load()[coll]?.[id];
      const res = v ? { id, ...rehydrate(v) } : null;
      if (res && res.userId && res.userId !== getCurrentUserId()) return null;
      return res;
    }
  }
  const v = load()[coll]?.[id];
  const res = v ? { id, ...rehydrate(v) } : null;
  if (res && res.userId && res.userId !== getCurrentUserId()) return null;
  return res;
}

// ── addOne ─────────────────────────────────────────────────────────────────
export async function addOne(coll, payload) {
  // Auto-inject userId for multi-tenancy
  const userId = getCurrentUserId();
  const enriched = userId ? { ...payload, userId } : payload;
  if (isFirebaseConfigured) {
    if (isOnline()) {
      const ref = await addDoc(collection(db, coll), enriched);
      return ref.id;
    }
    // Offline: apply locally + queue for sync
    const tempId = `offline_${uid()}`;
    applyLocal(coll, tempId, { ...enriched, _offline: true });
    await enqueueOfflineOp({ type: 'add', coll, payload: enriched, tempId });
    return tempId;
  }
  const data = load(); data[coll] = data[coll] || {}; const id = uid(); data[coll][id] = enriched; persist(data); return id;
}

// ── updateOne ──────────────────────────────────────────────────────────────
export async function updateOne(coll, id, patch) {
  if (isFirebaseConfigured) {
    // Always apply locally first for instant UI
    applyLocal(coll, id, patch, 'update');
    if (isOnline()) {
      try { return await updateDoc(doc(db, coll, id), patch); }
      catch { /* fall through to queue */ }
    }
    await enqueueOfflineOp({ type: 'update', coll, id, payload: patch });
    return;
  }
  applyLocal(coll, id, patch, 'update');
}

// ── setOne ─────────────────────────────────────────────────────────────────
export async function setOne(coll, id, payload) {
  // Auto-inject userId for multi-tenancy
  const userId = getCurrentUserId();
  const enriched = userId ? { ...payload, userId } : payload;
  if (isFirebaseConfigured) {
    applyLocal(coll, id, enriched, 'set');
    if (isOnline()) {
      try { return await setDoc(doc(db, coll, id), enriched); }
      catch { /* fall through to queue */ }
    }
    await enqueueOfflineOp({ type: 'set', coll, id, payload: enriched });
    return;
  }
  applyLocal(coll, id, enriched, 'set');
}

// ── deleteOne ──────────────────────────────────────────────────────────────
export async function deleteOne(coll, id) {
  if (isFirebaseConfigured) {
    applyLocal(coll, id, null, 'delete');
    if (isOnline()) {
      try { return await deleteDoc(doc(db, coll, id)); }
      catch { /* fall through to queue */ }
    }
    await enqueueOfflineOp({ type: 'delete', coll, id });
    return;
  }
  const data = load(); if (data[coll]) { delete data[coll][id]; persist(data); }
}
