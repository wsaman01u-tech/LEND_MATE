import { useEffect, useState } from 'react';
import { Bell, ChevronRight, Cloud, CloudOff, Database, Download, Key, LogOut, RefreshCw, Save, Shield, Smartphone, Upload, User, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../state/AuthContext';
import { APP_VERSION, BUILD_NUMBER, isNative, isOnline, onNetworkChange, getLastSync, getOfflineQueue } from '../lib/capacitor';
import { syncOfflineQueue } from '../lib/data';
import { checkFirebaseVersion } from '../lib/updater';

export default function Settings() {
  const { user, profile, logout, isDemo } = useAuth();

  const [editMode, setEditMode] = useState(false);
  const [name, setName] = useState(profile?.name || user?.displayName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [role] = useState(profile?.role || 'Admin');

  const [notifications, setNotifications] = useState(() => {
    try { return localStorage.getItem('sgmi-notif') !== 'off'; } catch { return false; }
  });
  const [notifStatus, setNotifStatus] = useState(() => 'Notification' in window ? Notification.permission : 'unsupported');
  const [currency, setCurrency] = useState('INR');
  const [dateFormat, setDateFormat] = useState('DD/MM/YY');

  const [showPwSection, setShowPwSection] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');

  // App info state
  const [online, setOnline] = useState(isOnline());
  const [lastSync, setLastSyncState] = useState(null);
  const [queueLen, setQueueLen] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const unsub = onNetworkChange((v) => setOnline(v));
    getLastSync().then((t) => setLastSyncState(t));
    getOfflineQueue().then((q) => setQueueLen(q.length));
    return unsub;
  }, []);

  const doSync = async () => {
    setSyncing(true);
    try {
      const count = await syncOfflineQueue();
      setQueueLen(0);
      const t = Date.now();
      setLastSyncState(t);
      toast.success(count > 0 ? `Synced ${count} pending operations` : 'Already up to date');
    } catch { toast.error('Sync failed'); }
    setSyncing(false);
  };

  const doCheckUpdate = async () => {
    setChecking(true);
    const info = await checkFirebaseVersion();
    if (info?.needsUpdate) toast.info(`Update available: v${info.latestVersion}`);
    else toast.success('App is up to date');
    setChecking(false);
  };

  const initials = (name || 'DA').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  const saveProfile = () => {
    toast.success('Profile saved (demo mode — no backend)');
    setEditMode(false);
  };

  const changePassword = () => {
    if (!newPw || newPw.length < 6) return toast.error('Password must be at least 6 characters');
    if (newPw !== confirmPw) return toast.error('Passwords do not match');
    toast.success('Password changed (demo mode)');
    setShowPwSection(false);
    setCurrentPw(''); setNewPw(''); setConfirmPw('');
  };

  const backupData = () => {
    try {
      const raw = localStorage.getItem('sgmi-data') || '{}';
      const blob = new Blob([raw], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `sgmi-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click(); URL.revokeObjectURL(url);
      toast.success('Backup downloaded');
    } catch { toast.error('Backup failed'); }
  };

  const restoreData = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          JSON.parse(ev.target.result);
          localStorage.setItem('sgmi-data', ev.target.result);
          toast.success('Data restored — reload the page');
        } catch { toast.error('Invalid backup file'); }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-2xl font-black text-slate-900">Settings</h1>

      {/* Profile Card */}
      <div className="card space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-black text-slate-900"><User size={18} className="text-primary-600" /> Profile</h2>
          {!editMode
            ? <button onClick={() => setEditMode(true)} className="btn-soft !px-3 !py-1.5 text-xs">Edit Profile</button>
            : <div className="flex gap-2">
                <button onClick={() => setEditMode(false)} className="btn text-xs text-slate-500 hover:bg-slate-100">Cancel</button>
                <button onClick={saveProfile} className="btn-primary !px-3 !py-1.5 text-xs"><Save size={13} /> Save</button>
              </div>}
        </div>

        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-primary-600 text-xl font-black text-white shadow-md">
            {initials}
          </div>
          <div>
            <p className="text-lg font-black text-slate-900">{name || 'Demo Admin'}</p>
            <p className="text-sm text-slate-500">{email}</p>
            <span className="mt-1 inline-block rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-bold text-primary-700">{role}</span>
          </div>
        </div>

        {editMode && (
          <div className="space-y-3 border-t border-slate-100 pt-4">
            <SettingField label="Full Name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" /></SettingField>
            <SettingField label="Email"><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" /></SettingField>
            <SettingField label="Phone Number"><input className="input" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit number" /></SettingField>
            <SettingField label="Role"><input className="input bg-slate-50" readOnly value={role} /></SettingField>
          </div>
        )}
      </div>

      {/* Change Password */}
      <div className="card space-y-3">
        <button onClick={() => setShowPwSection((v) => !v)} className="flex w-full items-center justify-between text-base font-black text-slate-900">
          <span className="flex items-center gap-2"><Key size={18} className="text-primary-600" /> Change Password</span>
          <ChevronRight size={16} className={`text-slate-400 transition-transform ${showPwSection ? 'rotate-90' : ''}`} />
        </button>
        {showPwSection && (
          <div className="space-y-3 border-t border-slate-100 pt-3">
            {!isDemo && <SettingField label="Current Password"><input type="password" className="input" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} placeholder="••••••••" /></SettingField>}
            <SettingField label="New Password"><input type="password" className="input" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="Min. 6 characters" /></SettingField>
            <SettingField label="Confirm Password"><input type="password" className="input" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="Repeat new password" /></SettingField>
            <button onClick={changePassword} className="btn-primary w-full"><Shield size={16} /> Update Password</button>
          </div>
        )}
      </div>

      {/* App Info & Sync */}
      <div className="card space-y-4">
        <h2 className="flex items-center gap-2 text-base font-black text-slate-900"><Smartphone size={18} className="text-primary-600" /> App Info</h2>

        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Version</span>
            <span className="font-bold text-slate-800">v{APP_VERSION} (build {BUILD_NUMBER})</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Platform</span>
            <span className="font-bold text-slate-800">{isNative ? 'Android App' : 'Web Browser'}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Network</span>
            <span className={`flex items-center gap-1.5 font-bold ${online ? 'text-green-700' : 'text-red-600'}`}>
              {online ? <><Wifi size={14} /> Online</> : <><WifiOff size={14} /> Offline</>}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Last Sync</span>
            <span className="font-bold text-slate-800">{lastSync ? new Date(lastSync).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : 'Never'}</span>
          </div>
          {queueLen > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Pending Sync</span>
              <span className="flex items-center gap-1.5 font-bold text-amber-600"><CloudOff size={14} /> {queueLen} operations</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
          <button onClick={doSync} disabled={syncing || !online}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary-50 px-3 py-2.5 text-sm font-bold text-primary-700 hover:bg-primary-100 disabled:opacity-50">
            <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
          <button onClick={doCheckUpdate} disabled={checking}
            className="flex items-center justify-center gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-sm font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-50">
            <Cloud size={15} className={checking ? 'animate-pulse' : ''} /> {checking ? 'Checking...' : 'Check Updates'}
          </button>
        </div>
      </div>

      {/* App Settings */}
      <div className="card space-y-4">
        <h2 className="flex items-center gap-2 text-base font-black text-slate-900"><Bell size={18} className="text-primary-600" /> App Settings</h2>

        <NotifRow notifications={notifications} notifStatus={notifStatus} onToggle={async () => {
          if (!('Notification' in window)) return toast.error('Notifications not supported in this browser');
          if (!notifications) {
            const perm = await Notification.requestPermission();
            setNotifStatus(perm);
            if (perm === 'granted') {
              localStorage.setItem('sgmi-notif', 'on');
              setNotifications(true);
              new Notification('SGMI-KK LendMate', { body: 'Payment reminders are now enabled!', icon: '/vite.svg' });
              toast.success('Notifications enabled!');
            } else {
              toast.error('Permission denied — allow notifications in browser settings');
            }
          } else {
            localStorage.setItem('sgmi-notif', 'off');
            setNotifications(false);
            toast.info('Notifications disabled');
          }
        }} />

        <div className="border-t border-slate-100 pt-3 space-y-3">
          <SettingField label="Currency">
            <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              <option value="INR">₹ Indian Rupee (INR)</option>
              <option value="USD">$ US Dollar (USD)</option>
              <option value="EUR">€ Euro (EUR)</option>
            </select>
          </SettingField>
          <SettingField label="Date Format">
            <select className="input" value={dateFormat} onChange={(e) => setDateFormat(e.target.value)}>
              <option value="DD/MM/YY">DD/MM/YY (24/05/26)</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY (24/05/2026)</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY (05/24/2026)</option>
            </select>
          </SettingField>
        </div>
      </div>

      {/* Account Actions */}
      <div className="card space-y-2">
        <h2 className="mb-3 flex items-center gap-2 text-base font-black text-slate-900"><Database size={18} className="text-primary-600" /> Data & Account</h2>

        <ActionRow icon={Download} label="Backup Data" desc="Download all data as JSON" color="text-primary-700 bg-primary-50 hover:bg-primary-100" onClick={backupData} />
        <ActionRow icon={Upload} label="Restore Data" desc="Import from a backup file" color="text-amber-700 bg-amber-50 hover:bg-amber-100" onClick={restoreData} />
        <ActionRow icon={LogOut} label="Logout" desc="Sign out of your account" color="text-red-700 bg-red-50 hover:bg-red-100" onClick={logout} />
      </div>

      {!isOnline() && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          <b>Offline Mode:</b> Changes will sync automatically when internet returns.
        </div>
      )}
    </div>
  );
}

function SettingField({ label, children }) {
  return <div><label className="label">{label}</label>{children}</div>;
}

function NotifRow({ notifications, notifStatus, onToggle }) {
  const denied = notifStatus === 'denied';
  const unsupported = notifStatus === 'unsupported';
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-50 text-primary-600"><Bell size={16} /></div>
        <div>
          <p className="text-sm font-semibold text-slate-800">Payment Reminders</p>
          <p className="text-xs text-slate-500">
            {unsupported ? 'Not supported in this browser'
              : denied ? 'Blocked — enable in browser settings'
              : notifications ? 'Enabled — you will receive alerts'
              : 'Tap to enable browser notifications'}
          </p>
        </div>
      </div>
      <button
        onClick={onToggle}
        disabled={denied || unsupported}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40 ${
          notifications && !denied ? 'bg-primary-600' : 'bg-slate-200'
        }`}
      >
        <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          notifications && !denied ? 'translate-x-5' : 'translate-x-0'
        }`} />
      </button>
    </div>
  );
}

function ActionRow({ icon: Icon, label, desc, color, onClick }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition ${color}`}>
      <Icon size={18} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{label}</p>
        <p className="text-xs opacity-75">{desc}</p>
      </div>
      <ChevronRight size={16} className="opacity-50" />
    </button>
  );
}
