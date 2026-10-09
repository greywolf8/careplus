import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { dataService } from '../services/dataService';
import { TaskCard } from '../components/tasks/TaskCard';
import { TaskDetailSheet } from '../components/tasks/TaskDetailSheet';
import { t } from '../i18n/translations';
import { ItemCategory, FollowupItem } from '../types';
import { AlertTriangle, Clock, Calendar, CheckCircle2 } from 'lucide-react';

export const PlanView: React.FC = () => {
  const { patientContext, language, selectedTaskId, setSelectedTaskId, theme } = useAuth();
  const [categoryFilter, setCategoryFilter] = useState<'all' | ItemCategory>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed' | 'overdue'>('all');
  const [allItems, setAllItems] = useState<FollowupItem[]>([]);
  const isLight = theme === 'light';

  useEffect(() => {
    let isMounted = true;
    dataService.getEffectiveItems(patientContext.patientId).then((items) => {
      if (isMounted) setAllItems(items);
    });
    return () => {
      isMounted = false;
    };
  }, [patientContext.patientId]);

  const visibleItems = useMemo(() => allItems.filter((i) => i.effective_status !== 'needs_review'), [allItems]);

  const filteredItems = useMemo(() =>
    visibleItems.filter((i) => {
      if (categoryFilter !== 'all' && i.category !== categoryFilter) return false;
      if (statusFilter !== 'all' && i.effective_status !== statusFilter) return false;
      return true;
    }),
    [visibleItems, categoryFilter, statusFilter]
  );

  // Today's date string
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Overdue recovery tasks check
  const overdueItems = useMemo(() => {
    return visibleItems.filter(
      (i) =>
        i.effective_status === 'overdue' ||
        (i.due_date && i.due_date < todayStr && i.effective_status !== 'completed')
    );
  }, [visibleItems, todayStr]);

  // Compute dynamic recovery timeline phases from patient's discharge date in DB
  const phases = useMemo(() => {
    const rawDischarge = patientContext.dischargeDate || todayStr;
    const baseDate = new Date(rawDischarge);
    const validBase = isNaN(baseDate.getTime()) ? new Date() : baseDate;

    const addDays = (d: Date, days: number): Date => {
      const res = new Date(d);
      res.setDate(res.getDate() + days);
      return res;
    };

    const toIsoDate = (d: Date): string => d.toISOString().split('T')[0];

    const formatDayMonthYear = (d: Date): string => {
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const formatRange = (d1: Date, d2: Date): string => {
      const day1 = d1.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      const day2 = d2.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      return `${day1} – ${day2}`;
    };

    // Phase 1: Discharge Day & Immediate Care (Days 0-1)
    const p1Start = validBase;
    const p1End = addDays(validBase, 1);
    const p1EndStr = toIsoDate(p1End);

    // Phase 2: Week 1 Recovery (Days 2-7)
    const p2Start = addDays(validBase, 2);
    const p2End = addDays(validBase, 7);
    const p2StartStr = toIsoDate(p2Start);
    const p2EndStr = toIsoDate(p2End);

    // Phase 3: Week 2 Follow-Up (Days 8-14)
    const p3Start = addDays(validBase, 8);
    const p3End = addDays(validBase, 14);
    const p3StartStr = toIsoDate(p3Start);
    const p3EndStr = toIsoDate(p3End);

    // Phase 4: Month 1 Stabilization & Ongoing (Days 15-30+)
    const p4Start = addDays(validBase, 15);
    const p4End = addDays(validBase, 30);
    const p4StartStr = toIsoDate(p4Start);

    return [
      {
        id: 'phase_1',
        title: 'DISCHARGE DAY & IMMEDIATE CARE',
        dates: formatRange(p1Start, p1End),
        badge: 'Hospital Exit, Wound & Puncture Rest',
        active: todayStr <= p1EndStr,
        items: filteredItems.filter((i) => i.due_date && i.due_date <= p1EndStr),
      },
      {
        id: 'phase_2',
        title: 'WEEK 1 RECOVERY',
        dates: `${formatRange(p2Start, p2End)}${todayStr >= p2StartStr && todayStr <= p2EndStr ? ' (Active Phase)' : ''}`,
        badge: 'Vitals, Blood Tests & Activity Monitoring',
        active: todayStr >= p2StartStr && todayStr <= p2EndStr,
        items: filteredItems.filter((i) => i.due_date && i.due_date >= p2StartStr && i.due_date <= p2EndStr),
      },
      {
        id: 'phase_3',
        title: 'WEEK 2 CLINICAL FOLLOW-UP',
        dates: `${formatRange(p3Start, p3End)}${todayStr >= p3StartStr && todayStr <= p3EndStr ? ' (Active Phase)' : ''}`,
        badge: 'Cardiology Review, 12-Lead ECG & Echo',
        active: todayStr >= p3StartStr && todayStr <= p3EndStr,
        items: filteredItems.filter((i) => i.due_date && i.due_date >= p3StartStr && i.due_date <= p3EndStr),
      },
      {
        id: 'phase_4',
        title: 'MONTH 1 & ONGOING STABILIZATION',
        dates: `${formatRange(p4Start, p4End)}`,
        badge: 'Cardiac Rehab & Long-term Lifestyle',
        active: todayStr >= p4StartStr,
        items: filteredItems.filter((i) => !i.due_date || i.due_date >= p4StartStr || i.due_date === 'ongoing'),
      },
    ];
  }, [patientContext.dischargeDate, todayStr, filteredItems]);

  /* ── style helpers ── */
  const tabs = {
    wrap: isLight
      ? { backgroundColor: '#EAF4FA', border: '1px solid #C5DCE8' }
      : { backgroundColor: '#0f172a', border: '1px solid rgba(30,41,59,1)' },
    active: isLight
      ? { backgroundColor: '#00AFA3', color: '#ffffff' }
      : { backgroundColor: '#0d9488', color: '#ffffff' },
    inactive: isLight
      ? { color: '#587084' }
      : { color: '#64748b' },
    statusActive: isLight
      ? { backgroundColor: 'rgba(0,175,163,0.12)', border: '1px solid #00AFA3', color: '#007A73', fontWeight: '700' }
      : { backgroundColor: 'rgba(19,78,74,0.8)', border: '1px solid #0d9488', color: '#5eead4', fontWeight: '700' },
    statusInactive: isLight
      ? { backgroundColor: '#EAF4FA', border: '1px solid #C5DCE8', color: '#587084' }
      : { backgroundColor: '#0f172a', border: '1px solid rgba(30,41,59,1)', color: '#64748b' },
  };

  const timelineTrack = isLight ? '#C5DCE8' : 'rgba(30,41,59,0.8)';

  return (
    <div className="space-y-4 pb-8 animate-in fade-in duration-200">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold tracking-tight" style={isLight ? { color: '#18324A' } : { color: '#ffffff' }}>
          Discharge Recovery Timeline
        </h1>
        <p className="text-xs" style={isLight ? { color: '#007A73' } : { color: 'rgba(94,234,212,0.8)' }}>
          {patientContext.dischargeDate
            ? `Discharge Date: ${new Date(patientContext.dischargeDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`
            : 'Structured post-discharge clinical phases'}
        </p>
      </div>

      {/* Overdue Tasks Alert Banner */}
      {overdueItems.length > 0 && (
        <div
          role="alert"
          className="p-3.5 rounded-2xl border flex items-start gap-3 animate-pulse transition-all shadow-sm"
          style={
            isLight
              ? { backgroundColor: '#FFF5D9', borderColor: '#F5D57A', color: '#8A5D00' }
              : { backgroundColor: 'rgba(120,53,15,0.4)', borderColor: 'rgba(217,119,6,0.6)', color: '#fde68a' }
          }
        >
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-500" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold flex items-center justify-between">
              <span>Overdue Care Tasks Alert</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-extrabold uppercase bg-amber-500/20">
                {overdueItems.length} Overdue
              </span>
            </div>
            <p className="text-[11px] mt-0.5 opacity-90 leading-relaxed">
              {overdueItems.length === 1
                ? '1 task has passed its scheduled recovery window. Please complete it or consult your care team.'
                : `${overdueItems.length} tasks have passed their scheduled recovery window. Please take action.`}
            </p>
            {statusFilter !== 'overdue' && (
              <button
                onClick={() => setStatusFilter('overdue')}
                className="text-[11px] font-bold mt-1.5 underline text-amber-700 dark:text-amber-300 cursor-pointer"
              >
                View overdue tasks only →
              </button>
            )}
          </div>
        </div>
      )}

      {/* Filter controls */}
      <div className="space-y-2">
        {/* Category tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl overflow-x-auto no-scrollbar" style={tabs.wrap}>
          {[
            { id: 'all', key: 'filters_all' },
            { id: 'appointment', key: 'filters_appointments' },
            { id: 'test', key: 'filters_tests' },
            { id: 'care', key: 'filters_care' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setCategoryFilter(f.id as typeof categoryFilter)}
              className="min-h-[40px] px-3.5 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer"
              style={categoryFilter === f.id ? tabs.active : tabs.inactive}
            >
              {t(language, f.key)}
            </button>
          ))}
        </div>

        {/* Status pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar px-0.5">
          {[
            { id: 'all', label: 'All Statuses' },
            { id: 'pending', label: 'Pending' },
            { id: 'overdue', label: `Overdue (${overdueItems.length})` },
            { id: 'completed', label: 'Completed' },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setStatusFilter(st.id as typeof statusFilter)}
              className="text-[11px] px-2.5 py-1 rounded-lg transition whitespace-nowrap cursor-pointer"
              style={statusFilter === st.id ? tabs.statusActive : tabs.statusInactive}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-6 pt-2 relative">
        <div className="absolute left-4 top-4 bottom-8 w-0.5 pointer-events-none" style={{ backgroundColor: timelineTrack }} />

        {phases.map((phase) => (
          <div key={phase.id} className="relative pl-10 space-y-2.5">
            {/* Step node */}
            <div
              className="absolute left-2.5 -translate-x-1/2 top-1 w-4 h-4 rounded-full border-2 flex items-center justify-center"
              style={phase.active
                ? { backgroundColor: '#00AFA3', borderColor: isLight ? '#ffffff' : '#ffffff', boxShadow: '0 0 0 4px rgba(0,175,163,0.2)' }
                : { backgroundColor: isLight ? '#EAF4FA' : '#0f172a', borderColor: isLight ? '#C5DCE8' : '#334155' }}
            >
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isLight ? (phase.active ? '#ffffff' : '#C5DCE8') : '#020817' }} />
            </div>

            {/* Phase header */}
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wider" style={isLight ? { color: '#18324A' } : { color: '#ffffff' }}>
                  {phase.title}
                </h2>
                {phase.active && (
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                    style={isLight
                      ? { backgroundColor: 'rgba(0,175,163,0.12)', border: '1px solid #00AFA3', color: '#007A73' }
                      : { backgroundColor: 'rgba(20,184,166,0.15)', border: '1px solid rgba(45,212,191,0.4)', color: '#5eead4' }}
                  >
                    Current Phase
                  </span>
                )}
              </div>
              <div className="text-[11px] mt-0.5" style={isLight ? { color: '#007A73' } : { color: 'rgba(94,234,212,0.8)' }}>
                {phase.dates}
              </div>
              <div className="text-[11px] italic mt-0.5" style={isLight ? { color: '#587084' } : { color: '#64748b' }}>
                {phase.badge}
              </div>
            </div>

            {/* Items */}
            <div className="space-y-2.5 pt-1">
              {phase.items.length === 0 ? (
                <div
                  className="p-3 rounded-2xl text-[11px] italic"
                  style={isLight
                    ? { backgroundColor: '#F0F8FD', border: '1px solid #C5DCE8', color: '#7A9AAD' }
                    : { backgroundColor: 'rgba(15,23,42,0.4)', border: '1px solid rgba(30,41,59,0.6)', color: '#475569' }}
                >
                  No items scheduled under this phase.
                </div>
              ) : (
                phase.items.map((item) => (
                  <TaskCard key={item.id} item={item} onOpenDetails={(i) => setSelectedTaskId(i.id)} />
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      <TaskDetailSheet itemId={selectedTaskId} onClose={() => setSelectedTaskId(null)} />
    </div>
  );
};
