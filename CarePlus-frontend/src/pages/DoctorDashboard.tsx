import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Users, Calendar, MessageSquare, ChevronRight, AlertTriangle, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { getPatientAttentionList } from '../services/doctorService';
import { getUnresolvedFlags } from '../services/flagService';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export function DoctorDashboard() {
  const { profile } = useAuth();
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [rescheduleForm, setRescheduleForm] = useState({
    new_due_date: '',
    new_due_time: '',
    reason: '',
  });
  const [rescheduling, setRescheduling] = useState(false);

  const { data: attentionList, isLoading: attentionLoading } = useQuery({
    queryKey: ['patient-attention'],
    queryFn: getPatientAttentionList,
    retry: false,
  });

  const { data: flags, isLoading: flagsLoading } = useQuery({
    queryKey: ['unresolved-flags'],
    queryFn: getUnresolvedFlags,
    retry: false,
  });

  const { data: schedule, isLoading: scheduleLoading } = useQuery({
    queryKey: ['doctor-schedule'],
    queryFn: async () => {
      const profile = await supabase.auth.getUser();
      if (!profile.data.user) return { data: { today: [], upcoming: [], today_date: '' } };

      // Get assigned patient IDs
      const { data: assignments } = await supabase
        .from('doctor_patients')
        .select('patient_id')
        .eq('doctor_id', profile.data.user.id)
        .eq('active', true);

      const patientIds = assignments?.map(a => a.patient_id) || [];
      if (patientIds.length === 0) return { data: { today: [], upcoming: [], today_date: '' } };

      // Get today's date
      const today = new Date().toISOString().split('T')[0];

      // Query followup items for appointments
      const { data: items } = await supabase
        .from('followup_item')
        .select('*, patient ( id, full_name )')
        .in('patient_id', patientIds)
        .eq('category', 'appointment')
        .gte('due_date', today)
        .order('due_date', { ascending: true });

      const todayItems = (items || []).filter((i: any) => i.due_date === today);
      const upcomingItems = (items || []).filter((i: any) => i.due_date > today);

      return {
        data: {
          today: todayItems.map((i: any) => ({
            id: i.id,
            patient_id: i.patient_id,
            patient_name: i.patient?.full_name || 'Unknown',
            title: i.title,
            due_date: i.due_date,
            due_time: i.due_time,
            provider: i.provider_suggestion?.name || null,
            status: i.effective_status,
            is_completed: i.completed_at !== null,
          })),
          upcoming: upcomingItems.slice(0, 5).map((i: any) => ({
            id: i.id,
            patient_id: i.patient_id,
            patient_name: i.patient?.full_name || 'Unknown',
            title: i.title,
            due_date: i.due_date,
            due_time: i.due_time,
            provider: i.provider_suggestion?.name || null,
            status: i.effective_status,
            is_completed: i.completed_at !== null,
          })),
          today_date: today,
        },
      };
    },
    retry: false,
  });

  const needsAttention = (attentionList as any[])?.filter((p: any) => p.urgency_score > 0) || [];
  const openQuestions = (flags as any[])?.filter((f: any) => f.question_id) || [];
  const overdueItems = (attentionList as any[])?.filter((p: any) => p.overdue_items > 0) || [];

  const handleReschedule = async () => {
    if (!selectedAppointment || !rescheduleForm.new_due_date) return;
    setRescheduling(true);
    try {
      // Use direct Supabase update
      const { error } = await supabase
        .from('followup_item')
        .update({
          due_date: rescheduleForm.new_due_date,
          due_time: rescheduleForm.new_due_time || null,
        })
        .eq('id', selectedAppointment.id);

      if (error) {
        alert(error.message);
        return;
      }

      setShowRescheduleModal(false);
      setSelectedAppointment(null);
      setRescheduleForm({ new_due_date: '', new_due_time: '', reason: '' });
      // Refetch schedule
      window.location.reload();
    } catch (error) {
      console.error('Failed to reschedule:', error);
      alert('Failed to reschedule appointment');
    } finally {
      setRescheduling(false);
    }
  };

  const openRescheduleModal = (appointment: any) => {
    setSelectedAppointment(appointment);
    setRescheduleForm({
      new_due_date: appointment.due_date || '',
      new_due_time: appointment.due_time || '',
      reason: '',
    });
    setShowRescheduleModal(true);
  };

  // Display name: strip a leading "Dr. " if present so the greeting reads once.
  const rawName = (profile?.full_name || '').trim();
  const isDr = /^dr\.?\s+/i.test(rawName);
  const displayName = rawName ? rawName.replace(/^dr\.?\s+/i, '') : '';
  const nameWithTitle = isDr || !displayName ? rawName : `Dr. ${displayName}`;

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Greeting & Current Date Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Good morning, {nameWithTitle || 'Doctor'}
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Here's what needs your attention today.
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/70 border border-border text-xs font-semibold text-slate-700 shadow-sm self-start sm:self-auto">
          <Calendar className="w-3.5 h-3.5 text-slate-500" />
          {format(new Date(), 'EEE, d MMM yyyy')}
        </div>
      </div>

      {/* Summary Tiles */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Needs Attention */}
        <article className="bg-white rounded-2xl p-4 border border-border shadow-sm flex items-center gap-3.5 hover:shadow transition-shadow">
          <div className="w-12 h-12 rounded-xl bg-warning-container text-warning flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 leading-none">
              {needsAttention.length}
            </div>
            <div className="text-xs font-medium text-slate-600 mt-1">Needs attention</div>
          </div>
        </article>

        {/* Open Questions */}
        <article className="bg-white rounded-2xl p-4 border border-border shadow-sm flex items-center gap-3.5 hover:shadow transition-shadow">
          <div className="w-12 h-12 rounded-xl bg-info-container text-info flex items-center justify-center shrink-0">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 leading-none">
              {openQuestions.length}
            </div>
            <div className="text-xs font-medium text-slate-600 mt-1">Open questions</div>
          </div>
        </article>

        {/* Overdue Items */}
        <article className="bg-white rounded-2xl p-4 border border-border shadow-sm flex items-center gap-3.5 hover:shadow transition-shadow">
          <div className="w-12 h-12 rounded-xl bg-warning-container text-warning flex items-center justify-center shrink-0">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 leading-none">
              {overdueItems.length}
            </div>
            <div className="text-xs font-medium text-slate-600 mt-1">Overdue items</div>
          </div>
        </article>

        {/* Total Patients */}
        <article className="bg-white rounded-2xl p-4 border border-border shadow-sm flex items-center gap-3.5 hover:shadow transition-shadow">
          <div className="w-12 h-12 rounded-xl bg-success-container text-success flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 leading-none">
              {attentionList?.length || 0}
            </div>
            <div className="text-xs font-medium text-slate-600 mt-1">Total patients</div>
          </div>
        </article>
      </section>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Patients Needing Attention */}
          <section className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
            <header className="p-4 px-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Patients needing attention</h2>
              <Link to="/doctor/patients" className="text-xs font-semibold text-primary hover:text-primary-700 transition-colors">
                View all
              </Link>
            </header>
            <div className="divide-y divide-slate-100">
              {attentionLoading ? (
                <div className="p-4 text-center text-slate-500 text-sm">Loading...</div>
              ) : needsAttention.length === 0 ? (
                <div className="p-4 text-center text-slate-500 text-sm">No patients need attention</div>
              ) : (
                needsAttention.slice(0, 5).map((patient: any) => (
                  <Link
                    key={patient.patient_id}
                    to={`/doctor/patients/${patient.patient_id}`}
                    className="p-3.5 px-5 flex items-center justify-between hover:bg-slate-50/70 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-semibold">
                        {patient.patient_name.split(' ').map((n: string) => n[0]).join('')}
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-slate-900">{patient.patient_name}</h3>
                        <p className="text-[11px] text-slate-500">
                          {patient.age} yrs • {patient.sex} • Day {patient.day_number}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {patient.escalated_questions > 0 && (
                        <span className="text-[11px] text-warning font-medium">
                          {patient.escalated_questions} questions
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </Link>
                ))
              )}
            </div>
          </section>

          {/* Recent Patients (REQUIRED) */}
          <section className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
            <header className="p-4 px-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Recent patients</h2>
              <Link to="/doctor/patients" className="text-xs font-semibold text-primary hover:text-primary-700 transition-colors">
                View all
              </Link>
            </header>
            <div className="divide-y divide-slate-100">
              {attentionLoading ? (
                <div className="p-4 text-center text-slate-500 text-sm">Loading...</div>
              ) : (
                attentionList?.slice(0, 4).map((patient) => (
                  <Link
                    key={patient.patient_id}
                    to={`/doctor/patients/${patient.patient_id}`}
                    className="p-3.5 px-5 flex items-center justify-between hover:bg-slate-50/70 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-xs font-semibold">
                        {patient.patient_name.split(' ').map((n: string) => n[0]).join('')}
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-slate-900">{patient.patient_name}</h3>
                        <p className="text-[11px] text-slate-500">
                          {patient.age} yrs • {patient.sex} • Day {patient.day_number}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </Link>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Overdue Items */}
          <section className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
            <header className="p-4 px-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Overdue items</h2>
              <Link to="/doctor/review" className="text-xs font-semibold text-primary hover:text-primary-700 transition-colors">
                View all
              </Link>
            </header>
            <div className="divide-y divide-slate-100">
              {flagsLoading ? (
                <div className="p-4 text-center text-slate-500 text-sm">Loading...</div>
              ) : overdueItems.length === 0 ? (
                <div className="p-4 text-center text-slate-500 text-sm">No overdue items</div>
              ) : (
                overdueItems.slice(0, 5).map((patient: any) => (
                  <Link
                    key={patient.patient_id}
                    to={`/doctor/patients/${patient.patient_id}`}
                    className="p-3.5 px-5 flex items-center justify-between hover:bg-slate-50/70 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full border-2 border-warning flex items-center justify-center shrink-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-warning"></div>
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-slate-900">{patient.patient_name}</h3>
                        <p className="text-[11px] text-slate-500">{patient.overdue_items} overdue tasks</p>
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-warning-container text-warning border border-warning/20">
                      Urgent
                    </span>
                  </Link>
                ))
              )}
            </div>
          </section>

          {/* Today's Schedule (appointments = care-plan items with category 'appointment') */}
          <section className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
            <header className="p-4 px-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Today's schedule</h2>
              <span className="text-xs text-slate-500">
                {schedule?.data?.today?.length || 0} today
              </span>
            </header>
            <div className="p-5 space-y-3.5">
              {scheduleLoading ? (
                <div className="text-center text-slate-500 text-sm py-4">Loading…</div>
              ) : ((schedule as any)?.data?.today?.length || 0) === 0 ? (
                <div className="text-center text-slate-500 text-sm py-4">
                  No appointments scheduled for today
                </div>
              ) : (
                (schedule as any)!.data!.today!.map((a: any) => (
                  <Link
                    key={a.id}
                    to={`/doctor/patients/${a.patient_id}`}
                    className="flex items-start justify-between gap-3 hover:bg-slate-50 rounded-lg px-2 py-2 -mx-2 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-semibold shrink-0">
                        {a.patient_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-slate-900">{a.patient_name}</h3>
                        <p className="text-[11px] text-slate-600">{a.title || 'Appointment'}</p>
                        {a.provider && <p className="text-[11px] text-slate-400">{a.provider}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 shrink-0">
                      {a.is_completed ? (
                        <span className="px-2 py-0.5 rounded-full bg-success-container text-success font-semibold">Done</span>
                      ) : (
                        <>
                          <Clock className="w-3.5 h-3.5" />
                          <span>{a.due_time || '—'}</span>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              openRescheduleModal(a);
                            }}
                            className="p-1 hover:bg-slate-200 rounded transition-colors"
                            title="Reschedule"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </Link>
                ))
              )}

              {!scheduleLoading && ((schedule as any)?.data?.upcoming?.length || 0) > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">Upcoming</p>
                  <div className="space-y-1.5">
                    {(schedule as any)!.data!.upcoming!.slice(0, 5).map((a: any) => (
                      <div key={a.id} className="flex items-center justify-between text-xs text-slate-600">
                        <span className="truncate">
                          <span className="font-medium text-slate-700">{a.patient_name}</span> — {a.title || 'Appointment'}
                        </span>
                        <span className="text-slate-400 shrink-0">
                          {a.due_date ? format(new Date(a.due_date), 'd MMM') : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Reschedule Modal */}
      {showRescheduleModal && selectedAppointment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Reschedule Appointment</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Patient</label>
                <p className="text-sm text-slate-600">{selectedAppointment.patient_name}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Current Date</label>
                <p className="text-sm text-slate-600">{selectedAppointment.due_date}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">New Date *</label>
                <input
                  type="date"
                  value={rescheduleForm.new_due_date}
                  onChange={(e) => setRescheduleForm({ ...rescheduleForm, new_due_date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">New Time</label>
                <input
                  type="time"
                  value={rescheduleForm.new_due_time}
                  onChange={(e) => setRescheduleForm({ ...rescheduleForm, new_due_time: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Reason</label>
                <textarea
                  rows={2}
                  value={rescheduleForm.reason}
                  onChange={(e) => setRescheduleForm({ ...rescheduleForm, reason: e.target.value })}
                  placeholder="Optional reason for rescheduling"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowRescheduleModal(false);
                  setSelectedAppointment(null);
                  setRescheduleForm({ new_due_date: '', new_due_time: '', reason: '' });
                }}
                disabled={rescheduling}
                className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReschedule}
                disabled={rescheduling || !rescheduleForm.new_due_date}
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
              >
                {rescheduling ? 'Rescheduling...' : 'Reschedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
