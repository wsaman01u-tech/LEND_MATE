/**
 * Capacitor native bridge — initializes plugins + provides helpers.
 * Safe to import on web (all calls are no-ops when Capacitor is absent).
 */
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Network } from '@capacitor/network';
import { StatusBar } from '@capacitor/status-bar';
import { Keyboard } from '@capacitor/keyboard';
import { SplashScreen } from '@capacitor/splash-screen';
import { Preferences } from '@capacitor/preferences';

export const isNative = Capacitor.isNativePlatform();
export const APP_VERSION = '1.0.0';
export const BUILD_NUMBER = '1';

// ── Network status ─────────────────────────────────────────────────────────
let _online = navigator.onLine;
const _listeners = new Set();

export const isOnline = () => _online;
export const onNetworkChange = (fn) => { _listeners.add(fn); return () => _listeners.delete(fn); };

const notifyNetwork = (status) => {
  _online = status;
  _listeners.forEach((fn) => fn(status));
};

// Web fallback
window.addEventListener('online', () => notifyNetwork(true));
window.addEventListener('offline', () => notifyNetwork(false));

// ── Preferences (native key-value store) ───────────────────────────────────
export const setPref = async (key, value) => {
  if (isNative) return Preferences.set({ key, value: JSON.stringify(value) });
  localStorage.setItem(`cap-${key}`, JSON.stringify(value));
};
export const getPref = async (key) => {
  if (isNative) {
    const { value } = await Preferences.get({ key });
    return value ? JSON.parse(value) : null;
  }
  const v = localStorage.getItem(`cap-${key}`);
  return v ? JSON.parse(v) : null;
};

// ── Offline sync queue ─────────────────────────────────────────────────────
const QUEUE_KEY = 'offline-sync-queue';

export const getOfflineQueue = async () => (await getPref(QUEUE_KEY)) || [];
export const saveOfflineQueue = (queue) => setPref(QUEUE_KEY, queue);

export const enqueueOfflineOp = async (op) => {
  const queue = await getOfflineQueue();
  queue.push({ ...op, queuedAt: Date.now() });
  await saveOfflineQueue(queue);
};

export const clearOfflineQueue = () => saveOfflineQueue([]);

// ── Last sync time ─────────────────────────────────────────────────────────
export const getLastSync = () => getPref('last-sync-time');
export const setLastSync = () => setPref('last-sync-time', Date.now());

// ── Initialize (call once from main.jsx) ───────────────────────────────────
export async function initCapacitor() {
  if (!isNative) return;

  // Network listener
  Network.addListener('networkStatusChange', ({ connected }) => notifyNetwork(connected));
  const status = await Network.getStatus();
  _online = status.connected;

  // Status bar
  try {
    await StatusBar.setBackgroundColor({ color: '#059669' });
  } catch { /* web */ }

  // Keyboard
  try {
    Keyboard.addListener('keyboardWillShow', () => {
      document.body.classList.add('keyboard-open');
    });
    Keyboard.addListener('keyboardWillHide', () => {
      document.body.classList.remove('keyboard-open');
    });
  } catch { /* web */ }

  // Back button handler
  App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) window.history.back();
    else App.exitApp();
  });

  // Hide splash after app loads
  await SplashScreen.hide();
}
