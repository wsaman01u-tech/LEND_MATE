import { Landmark } from 'lucide-react';

export default function Brand({ compact = false }) {
  return <div className="flex items-center gap-3">
    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-soft"><Landmark size={23} /></div>
    {!compact && <div><h1 className="text-lg font-black tracking-tight text-primary-900">SGMI-KK LENDMART</h1><p className="text-xs font-medium text-slate-500">Daily Finance Management</p></div>}
  </div>;
}
