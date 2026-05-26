import { useEffect, useState } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';
import { onUpdateReady, isUpdateReady, applyOTAUpdate, checkFirebaseVersion } from '../lib/updater';
import { APP_VERSION, isNative } from '../lib/capacitor';

export default function UpdateBanner() {
  const [otaReady, setOtaReady] = useState(isUpdateReady());
  const [fbUpdate, setFbUpdate] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const unsub = onUpdateReady(() => setOtaReady(true));
    // Check Firebase version on mount
    checkFirebaseVersion().then((info) => {
      if (info?.needsUpdate) setFbUpdate(info);
    });
    return unsub;
  }, []);

  if (dismissed) return null;

  // Force update banner (from Firebase)
  if (fbUpdate?.forceUpdate) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-6">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl text-center space-y-4">
          <Download size={40} className="mx-auto text-primary-600" />
          <h2 className="text-lg font-black text-slate-900">Update Required</h2>
          <p className="text-sm text-slate-600">A new version ({fbUpdate.latestVersion}) is available. Please update to continue.</p>
          {fbUpdate.releaseNotes && <p className="text-xs text-slate-400 italic">{fbUpdate.releaseNotes}</p>}
          <p className="text-xs text-slate-400">Current: v{APP_VERSION}</p>
        </div>
      </div>
    );
  }

  // OTA update ready banner
  if (otaReady && isNative) {
    return (
      <div className="fixed bottom-20 left-3 right-3 z-[90] animate-slideUp">
        <div className="flex items-center gap-3 rounded-2xl bg-primary-700 p-4 text-white shadow-xl">
          <RefreshCw size={20} className="shrink-0 animate-spin-slow" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black">Update Ready</p>
            <p className="text-xs opacity-80">A new version has been downloaded</p>
          </div>
          <button onClick={() => applyOTAUpdate()} className="shrink-0 rounded-xl bg-white px-3 py-1.5 text-xs font-black text-primary-700 hover:bg-primary-50">
            Restart
          </button>
          <button onClick={() => setDismissed(true)} className="shrink-0 p-1 opacity-60 hover:opacity-100">
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  // Non-forced Firebase version mismatch hint (dismissible)
  if (fbUpdate?.needsUpdate && !fbUpdate.forceUpdate) {
    return (
      <div className="fixed bottom-20 left-3 right-3 z-[90]">
        <div className="flex items-center gap-3 rounded-2xl bg-amber-600 p-4 text-white shadow-xl">
          <Download size={18} className="shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold">New version available: {fbUpdate.latestVersion}</p>
            {fbUpdate.releaseNotes && <p className="text-xs opacity-80">{fbUpdate.releaseNotes}</p>}
          </div>
          <button onClick={() => setDismissed(true)} className="shrink-0 p-1 opacity-60 hover:opacity-100">
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
