import { useState, useEffect } from 'react';
import { Bell, Check, Clock, Phone, Trash2, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { deleteOne, updateOne, serverTimestamp } from '../lib/data';
import useRealtime from '../hooks/useRealtime';
import EmptyState from '../components/EmptyState';
import { fmtDate, todayISO } from '../lib/finance';

export default function Reminders() {
  const { data: reminders, loading } = useRealtime('reminders', { orderBy: ['reminderDate', 'asc'] });
  const today = todayISO();
  const [refreshKey, setRefreshKey] = useState(0);

  // Check for due reminders on mount and show alert
  useEffect(() => {
    if (reminders.length === 0) return;
    
    const now = new Date();
    const dueReminders = reminders.filter((r) => {
      if (r.status !== 'pending') return false;
      const reminderDateTime = new Date(`${r.reminderDate}T${r.reminderTime}`);
      return reminderDateTime <= now;
    });

    if (dueReminders.length > 0) {
      const names = dueReminders.map(r => r.borrowerName).join(', ');
      toast.warning(`🔔 ${dueReminders.length} reminder(s) due: ${names}`, {
        autoClose: 8000,
        position: 'top-center',
      });
    }
  }, [reminders]);

  const markAsCompleted = async (reminder) => {
    if (!reminder.id) {
      toast.error('Invalid reminder ID');
      return;
    }
    try {
      await updateOne('reminders', reminder.id, {
        status: 'completed',
        completedAt: serverTimestamp(),
      });
      toast.success('Reminder marked as completed');
      setRefreshKey(prev => prev + 1); // Force refresh
    } catch (error) {
      console.error('Update error:', error);
      toast.error('Failed to update reminder');
    }
  };

  const deleteReminder = async (id) => {
    if (!id) {
      toast.error('Invalid reminder ID');
      return;
    }
    if (!confirm('Delete this reminder?')) return;
    try {
      await deleteOne('reminders', id);
      toast.success('Reminder deleted');
      setRefreshKey(prev => prev + 1); // Force refresh
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete reminder');
    }
  };

  const pendingReminders = reminders.filter((r) => r.status === 'pending');
  const completedReminders = reminders.filter((r) => r.status === 'completed');
  const overdueReminders = pendingReminders.filter((r) => r.reminderDate < today);
  const todayReminders = pendingReminders.filter((r) => r.reminderDate === today);
  const upcomingReminders = pendingReminders.filter((r) => r.reminderDate > today);

  if (loading) return <div className="skeleton h-96" />;

  return (
    <div className="space-y-4" key={refreshKey}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">Payment Reminders</h1>
        <div className="flex items-center gap-2 text-sm">
          <span className="rounded-full bg-red-100 px-3 py-1 font-bold text-red-700">
            {overdueReminders.length} Overdue
          </span>
          <span className="rounded-full bg-amber-100 px-3 py-1 font-bold text-amber-700">
            {todayReminders.length} Today
          </span>
          <span className="rounded-full bg-blue-100 px-3 py-1 font-bold text-blue-700">
            {upcomingReminders.length} Upcoming
          </span>
        </div>
      </div>

      {/* Overdue Reminders */}
      {overdueReminders.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-red-700">
            <Clock size={16} />
            Overdue Reminders
          </h2>
          <div className="space-y-2">
            {overdueReminders.map((reminder) => (
              <ReminderCard
                key={reminder.id}
                reminder={reminder}
                type="overdue"
                onComplete={() => markAsCompleted(reminder)}
                onDelete={() => deleteReminder(reminder.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Today's Reminders */}
      {todayReminders.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-amber-700">
            <Bell size={16} />
            Today's Reminders
          </h2>
          <div className="space-y-2">
            {todayReminders.map((reminder) => (
              <ReminderCard
                key={reminder.id}
                reminder={reminder}
                type="today"
                onComplete={() => markAsCompleted(reminder)}
                onDelete={() => deleteReminder(reminder.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Upcoming Reminders */}
      {upcomingReminders.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-blue-700">
            <Clock size={16} />
            Upcoming Reminders
          </h2>
          <div className="space-y-2">
            {upcomingReminders.map((reminder) => (
              <ReminderCard
                key={reminder.id}
                reminder={reminder}
                type="upcoming"
                onComplete={() => markAsCompleted(reminder)}
                onDelete={() => deleteReminder(reminder.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Completed Reminders */}
      {completedReminders.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-green-700">
            <Check size={16} />
            Completed Reminders
          </h2>
          <div className="space-y-2">
            {completedReminders.map((reminder) => (
              <ReminderCard
                key={reminder.id}
                reminder={reminder}
                type="completed"
                onDelete={() => deleteReminder(reminder.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Empty State */}
      {reminders.length === 0 && (
        <EmptyState
          title="No reminders set"
          message="Set reminders from borrower details to get notified when they promise to pay."
        />
      )}
    </div>
  );
}

function ReminderCard({ reminder, type, onComplete, onDelete }) {
  const colors = {
    overdue: 'border-red-300 bg-red-50',
    today: 'border-amber-300 bg-amber-50',
    upcoming: 'border-blue-300 bg-blue-50',
    completed: 'border-green-300 bg-green-50',
  };

  // Add pulsing animation for overdue and today reminders
  const isPriority = type === 'overdue' || type === 'today';

  return (
    <div className={`card border-l-4 ${colors[type]} ${isPriority ? 'animate-pulse-slow' : ''} relative`}>
      {/* Priority Badge for Overdue and Today */}
      {type === 'overdue' && (
        <div className="absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-white shadow-lg animate-bounce">
          <span className="text-xs font-black">!</span>
        </div>
      )}
      {type === 'today' && (
        <div className="absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-amber-600 text-white shadow-lg">
          <Bell size={14} className="animate-wiggle" />
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className={`font-black ${isPriority ? 'text-lg' : ''} text-slate-900`}>
              {reminder.borrowerName}
            </p>
            {type === 'completed' && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-black text-green-700">
                Completed
              </span>
            )}
            {type === 'overdue' && (
              <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-black text-white animate-pulse">
                OVERDUE
              </span>
            )}
            {type === 'today' && (
              <span className="rounded-full bg-amber-600 px-2 py-0.5 text-[10px] font-black text-white">
                DUE TODAY
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-slate-600">
            <span className={`flex items-center gap-1 ${isPriority ? 'font-bold' : ''}`}>
              <Clock size={12} />
              {fmtDate(reminder.reminderDate)} at {reminder.reminderTime}
            </span>
            <a
              href={`tel:${reminder.borrowerPhone}`}
              className="flex items-center gap-1 text-primary-700 hover:underline"
            >
              <Phone size={12} />
              {reminder.borrowerPhone}
            </a>
          </div>
          {reminder.notes && (
            <p className="mt-2 text-xs italic text-slate-500">{reminder.notes}</p>
          )}
        </div>

        <div className="flex items-center gap-1">
          <a
            href={`tel:${reminder.borrowerPhone}`}
            title="Call borrower"
            className={`rounded-lg p-1.5 ${
              isPriority 
                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md' 
                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
            }`}
          >
            <Phone size={14} />
          </a>
          {type !== 'completed' && onComplete && (
            <button
              onClick={onComplete}
              title="Mark as completed"
              className={`rounded-lg p-1.5 ${
                isPriority
                  ? 'bg-green-600 text-white hover:bg-green-700 shadow-md'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              <Check size={14} />
            </button>
          )}
          <button
            onClick={onDelete}
            title="Delete"
            className="rounded-lg bg-red-100 p-1.5 text-red-600 hover:bg-red-200"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
