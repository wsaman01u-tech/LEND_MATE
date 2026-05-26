/**
 * OTA Update System — Capgo live updates + Firebase version tracking.
 *
 * Flow:
 * 1. On app start, checks Firebase `appConfig/version` for latest version info.
 * 2. If forceUpdate=true and version mismatch → full-screen update prompt.
 * 3. For OTA patches, Capgo handles download + apply in background.
 * 4. User sees "Update Ready — Restart Now / Later" toast.
 */
import { isNative, APP_VERSION } from './capacitor';
import { isFirebaseConfigured, db } from './firebase';

let _updateReady = false;
let _updateInfo = null;
const _listeners = new Set();

export const isUpdateReady = () => _updateReady;
export const getUpdateInfo = () => _updateInfo;
export const onUpdateReady = (fn) => { _listeners.add(fn); return () => _listeners.delete(fn); };

/**
 * Check Firebase `appConfig/version` document for update info.
 * Document shape:
 *   { latestVersion: '1.0.1', patchVersion: '1.0.1-p1', forceUpdate: false, releaseNotes: '...' }
 */
export async function checkFirebaseVersion() {
  if (!isFirebaseConfigured || !db) return null;
  try {
    const { doc, getDoc } = await import('firebase/firestore');
    const snap = await getDoc(doc(db, 'appConfig', 'version'));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      latestVersion: data.latestVersion || APP_VERSION,
      patchVersion: data.patchVersion || null,
      forceUpdate: data.forceUpdate === true,
      releaseNotes: data.releaseNotes || '',
      needsUpdate: data.latestVersion && data.latestVersion !== APP_VERSION,
    };
  } catch (e) {
    console.warn('Version check failed:', e);
    return null;
  }
}

/**
 * Initialize Capgo live updater (native only).
 * Call once from main.jsx after initCapacitor().
 */
export async function initOTAUpdater() {
  if (!isNative) return;

  try {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater');

    // Notify Capgo that the current bundle is working
    await CapacitorUpdater.notifyAppReady();

    // Listen for update events
    CapacitorUpdater.addListener('updateAvailable', (info) => {
      console.log('[OTA] Update available:', info);
    });

    CapacitorUpdater.addListener('downloadComplete', (info) => {
      console.log('[OTA] Download complete:', info);
      _updateReady = true;
      _updateInfo = info;
      _listeners.forEach((fn) => fn(info));
    });

    CapacitorUpdater.addListener('downloadFailed', (info) => {
      console.warn('[OTA] Download failed:', info);
    });
  } catch (e) {
    console.warn('Capgo init failed (expected on web):', e);
  }
}

/**
 * Apply the downloaded OTA update (restarts the app).
 */
export async function applyOTAUpdate() {
  if (!isNative || !_updateInfo) return;
  try {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
    await CapacitorUpdater.set({ id: _updateInfo.bundle?.id || _updateInfo.id });
  } catch (e) {
    console.error('Apply update failed:', e);
  }
}
