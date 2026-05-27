import { useState } from 'react';
import { Bell, X, Calendar, Clock, Check } from 'lucide-react';
import { toast } from 'react-toastify';
import TimePicker from 'react-time-picker';
import 'react-time-picker/dist/TimePicker.css';
import 'react-clock/dist/Clock.css';
import { addOne, updateOne, deleteOne, serverTimestamp } from '../lib/data';
import { fmtDate, todayISO } from '../lib/finance';
import { useAuth } from '../state/AuthContext';

export default function PaymentReminder({ borrower, onClose }) {
  const { user } = useAuth();
  const [reminderDate, setReminderDate] = useState(todayISO());
  const [reminderTime, setReminderTime] = useState('10:00');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!reminderDate) {
      toast.error('Please select a date');
      return;
    }

    setSaving(true);
    try {
      // Create reminder document
      await addOne('reminders', {
        userId: user.uid,
        borrowerId: borrower.id,
        borrowerName: borrower.fullName,
        borrowerPhone: borrower.phone,
        reminderDate,
        reminderTime,
        notes: notes || `Payment reminder for ${borrower.fullName}`,
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      // Request notification permission and schedule
      await requestNotificationPermission();
      scheduleNotification();

      toast.success('Reminder set successfully!');
      onClose();
    } catch (error) {
      console.error('Error setting reminder:', error);
      toast.error('Failed to set reminder');
    }
    setSaving(false);
  };

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return;
    }

    if (Notification.permission === 'granted') {
      return;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        toast.success('Notifications enabled!');
      }
    }
  };

  const scheduleNotification = () => {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }

    const reminderDateTime = new Date(`${reminderDate}T${reminderTime}`);
    const now = new Date();
    const timeUntilReminder = reminderDateTime - now;

    if (timeUntilReminder > 0) {
      // Try to use service worker for background notifications
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'SCHEDULE_REMINDER',
          borrowerName: borrower.fullName,
          borrowerPhone: borrower.phone,
          reminderDate,
          reminderTime,
        });
      } else {
        // Fallback to regular setTimeout notification
        setTimeout(() => {
          new Notification('💰 Payment Reminder', {
            body: `${borrower.fullName} promised to pay today!\nPhone: ${borrower.phone}`,
            icon: '/icons/icon-192.svg',
            badge: '/icons/icon-192.svg',
            tag: `reminder-${borrower.id}`,
            requireInteraction: true,
          });
        }, timeUntilReminder);
      }
    }
  };

  // Format time for display (12-hour format)
  const formatTime12Hour = (time24) => {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${minutes} ${ampm}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-primary-100 p-2">
              <Bell size={20} className="text-primary-700" />
            </div>
            <h2 className="text-lg font-black text-slate-900">Set Payment Reminder</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* Borrower Info */}
        <div className="mb-4 rounded-xl bg-slate-50 p-3">
          <p className="text-sm font-bold text-slate-900">{borrower.fullName}</p>
          <p className="text-xs text-slate-500">{borrower.phone}</p>
        </div>

        {/* Form */}
        <div className="space-y-4">
          {/* Date */}
          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Calendar size={16} />
              Reminder Date
            </label>
            <input
              type="date"
              value={reminderDate}
              onChange={(e) => setReminderDate(e.target.value)}
              min={todayISO()}
              className="w-full rounded-lg border-2 border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
            />
          </div>

          {/* Time - Analog Clock Picker */}
          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Clock size={16} />
              Reminder Time
            </label>
            <TimePicker
              onChange={setReminderTime}
              value={reminderTime}
              disableClock={false}
              clearIcon={null}
              clockIcon={<Clock size={16} />}
              format="h:mm a"
              className="w-full"
              clockClassName="custom-clock"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Promised to pay ₹500"
              rows="3"
              className="w-full rounded-lg border-2 border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
            />
          </div>

          {/* Info */}
          <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-700">
            <p className="font-semibold">📱 Notification will be sent on:</p>
            <p className="mt-1">
              {fmtDate(reminderDate)} at {formatTime12Hour(reminderTime)}
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border-2 border-slate-200 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary-600 py-2.5 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? (
                'Saving...'
              ) : (
                <>
                  <Check size={16} />
                  Set Reminder
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
