export default function EmptyState({ title = 'No records found', message = 'Add your first record to get started.' }) {
  return <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center"><h3 className="font-bold text-slate-800">{title}</h3><p className="mt-1 text-sm text-slate-500">{message}</p></div>;
}
