import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { dataService } from '../services/dataService';
import { t } from '../i18n/translations';
import { Reminder } from '../types';
import {
  ArrowLeft,
  MessageSquare,
  Clock,
  Smartphone,
  MessageCircle,
  Bell,
  BellRing,
  Plus,
  CheckCircle2,
  X,
  ShieldCheck,
} from 'lucide-react';

export const RemindersView: React.FC = () => {
  const { patientContext, language, setActiveSubRoute, refreshData } = useAuth();
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [showAddModal, setShowAddModal] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<string>(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );
  const [reminders, setReminders] = useState<Reminder[]>([]);

  // Form states for adding reminder
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('08:00 AM');
  const [channel, setChannel] = useState<'whatsapp' | 'sms'>('whatsapp');
  const [category, setCategory] = useState<'medicine' | 'test' | 'appointment' | 'care'>('medicine');

  useEffect(() => {
    let isMounted = true;
    dataService.getReminders(patientContext.patientId).then((rems) => {
      if (isMounted) setReminders(rems);
    });
    return () => {
      isMounted = false;
    };
  }, [patientContext.patientId]);

  const displayedReminders = useMemo(() => {
    return reminders.filter((r) => (tab === 'upcoming' ? !r.is_past : r.is_past));
  }, [reminders, tab]);

  const handleRequestNotificationPermission = async () => {
    if (typeof Notification === 'undefined') {
      alert('Browser web notifications are not supported on this platform. Reminders will display in-app.');
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      setPermissionStatus(perm);
      if (perm === 'granted') {
        new Notification('CarePlus Reminders Active', {
          body: 'You will receive reminders for scheduled follow-ups and medications.',
          icon: '/icon.svg',
        });
      }
    } catch {
      setPermissionStatus('denied');
    }
  };

  const handleAddReminder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newReminder: Reminder = {
      id: `rem_${Date.now()}`,
      patient_id: patientContext.patientId,
      item_title: title.trim(),
      due_time: `${time} Today`,
      channel,
      is_past: false,
      preview_text: `CarePlus Alert for ${patientContext.patientName}: Reminder for ${title.trim()} at ${time}. Log as complete in CarePlus app.`,
    };

    setReminders((prev) => [newReminder, ...prev]);
    setShowAddModal(false);
    setTitle('');
    refreshData();
  };

  return (
    <div className="space-y-4 pb-8 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubRoute(null)}
            aria-label="Back"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-800 text-slate-300 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">
              {t(language, 'reminders')}
            </h1>
            <p className="text-xs text-teal-300/80">Scheduled follow-up and medicine alerts</p>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="min-h-[40px] px-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Add</span>
        </button>
      </div>

      {/* Browser Notification Banner */}
      <div className="p-3.5 rounded-2xl bg-slate-900 border border-teal-900/40 text-xs text-slate-200 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <BellRing className="w-4 h-4 text-teal-400 shrink-0" />
          <div>
            <div className="font-semibold text-white">Device Notifications</div>
            <div className="text-[11px] text-slate-400">
              {permissionStatus === 'granted'
                ? 'Enabled for this device'
                : 'Enable alerts for medicines and appointments'}
            </div>
          </div>
        </div>
        {permissionStatus !== 'granted' && (
          <button
            onClick={handleRequestNotificationPermission}
            className="px-3 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-600 text-white text-xs font-semibold shrink-0 transition"
          >
            Enable
          </button>
        )}
      </div>

      {/* Simulation Notice */}
      <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 italic">
        {t(language, 'simulated_preview_notice')}
      </div>

      {/* Upcoming / Past Tabs */}
      <div className="grid grid-cols-2 p-1 bg-slate-900 border border-slate-800 rounded-2xl">
        <button
          onClick={() => setTab('upcoming')}
          className={`min-h-[40px] rounded-xl text-xs font-semibold transition ${
            tab === 'upcoming'
              ? 'bg-teal-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          {t(language, 'upcoming_reminders')} ({reminders.filter((r) => !r.is_past).length})
        </button>
        <button
          onClick={() => setTab('past')}
          className={`min-h-[40px] rounded-xl text-xs font-semibold transition ${
            tab === 'past'
              ? 'bg-teal-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          {t(language, 'past_reminders')} ({reminders.filter((r) => r.is_past).length})
        </button>
      </div>

      {/* Reminders List with Simulated WhatsApp / SMS Previews */}
      <div className="space-y-3.5 pt-1">
        {displayedReminders.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400 bg-slate-900 rounded-2xl border border-slate-800">
            No reminders scheduled in this section.
          </div>
        ) : (
          displayedReminders.map((rem) => {
            const isWhatsApp = rem.channel === 'whatsapp';

            return (
              <div
                key={rem.id}
                className="rounded-2xl bg-slate-900 border border-teal-900/40 p-4 shadow-sm text-slate-100 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isWhatsApp ? (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/70 border border-emerald-800/80 px-2 py-0.5 rounded-lg">
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>WhatsApp Alert</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-blue-400 bg-blue-950/70 border border-blue-800/80 px-2 py-0.5 rounded-lg">
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>SMS Notification</span>
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{rem.due_time}</span>
                  </span>
                </div>

                <h3 className="text-sm font-semibold text-white leading-snug">
                  {rem.item_title}
                </h3>

                {/* Simulated Message Bubble */}
                <div
                  className={`p-3 rounded-2xl text-xs leading-relaxed border ${
                    isWhatsApp
                      ? 'bg-emerald-950/40 border-emerald-900/60 text-emerald-100'
                      : 'bg-slate-950 border-slate-800 text-slate-200'
                  }`}
                >
                  <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">
                    {isWhatsApp ? 'WhatsApp Preview' : 'SMS Message Body'}
                  </div>
                  <p className="font-sans text-[11px]">{rem.preview_text}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Reminder Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-slate-900 border border-teal-800 rounded-3xl p-5 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Create Care Reminder</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddReminder} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Reminder Type
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as typeof category)}
                  className="w-full min-h-[40px] px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                >
                  <option value="medicine">Prescription Medicine</option>
                  <option value="test">Diagnostic Blood / Lab Test</option>
                  <option value="appointment">Doctor Follow-up Appointment</option>
                  <option value="care">Daily Vitals & Wound Care</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Item / Prescription Name
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Tab. Ticagrelor Morning Dose"
                  required
                  className="w-full min-h-[40px] px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Scheduled Time
                  </label>
                  <input
                    type="text"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    placeholder="08:00 AM"
                    className="w-full min-h-[40px] px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Channel
                  </label>
                  <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value as typeof channel)}
                    className="w-full min-h-[40px] px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="sms">SMS</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="min-h-[44px] rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow transition"
                >
                  Save Reminder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
