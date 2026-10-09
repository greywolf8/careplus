import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { dataService } from '../services/dataService';
import { TaskCard } from '../components/tasks/TaskCard';
import { TaskDetailSheet } from '../components/tasks/TaskDetailSheet';
import { CoordinationCard } from '../components/common/CoordinationCard';
import { CreateCoordinationModal } from '../components/common/CreateCoordinationModal';
import { t } from '../i18n/translations';
import {
  FollowupItem,
  Medication,
  AdherenceLog,
  Reminder,
  CoordinationCard as CoordinationCardModel,
  CoordinationCardStatus,
} from '../types';
import {
  CheckCircle2,
  Clock,
  Bell,
  Wifi,
  WifiOff,
  ChevronRight,
  ArrowRight,
  PlusCircle,
  Activity,
  HeartPulse,
  Pill,
} from 'lucide-react';

export const TodayView: React.FC = () => {
  const {
    patientContext,
    language,
    selectedTaskId,
    setSelectedTaskId,
    setActiveSubRoute,
    setActiveTab,
    isOnline,
    refreshData,
    theme,
  } = useAuth();

  const [showCoordinationModal, setShowCoordinationModal] = useState(false);
  const [allItems, setAllItems] = useState<FollowupItem[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [adherenceLogs, setAdherenceLogs] = useState<AdherenceLog[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [coordinationCards, setCoordinationCards] = useState<CoordinationCardModel[]>([]);

  useEffect(() => {
    let isMounted = true;
    const patId = patientContext.patientId;

    dataService.getEffectiveItems(patId).then((items) => {
      if (isMounted) setAllItems(items);
    });
    dataService.getMedications(patId).then((meds) => {
      if (isMounted) setMedications(meds);
    });
    const todayIso = new Date().toISOString().split('T')[0];
    dataService.getAdherenceLogs(patId, todayIso).then((logs) => {
      if (isMounted) setAdherenceLogs(logs);
    });
    dataService.getReminders(patId).then((rems) => {
      if (isMounted) setReminders(rems.filter((r) => !r.is_past));
    });
    dataService.getCoordinationCards(patId).then((cards) => {
      if (isMounted) setCoordinationCards(cards);
    });

    return () => {
      isMounted = false;
    };
  }, [patientContext.patientId]);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const todayFormatted = useMemo(() => new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }), []);

  const takenMedsCount = useMemo(() => adherenceLogs.filter((l) => l.status === 'taken').length, [adherenceLogs]);
  const reviewCount = useMemo(() => allItems.filter((i) => i.effective_status === 'needs_review').length, [allItems]);
  const visibleItems = useMemo(() => allItems.filter((i) => i.effective_status !== 'needs_review'), [allItems]);
  
  // Due today includes items scheduled for today or daily care
  const dueTodayItems = useMemo(
    () => visibleItems.filter((i) => (i.section === 'DUE TODAY' || i.section === 'DAILY CARE' || i.due_date === todayStr) && i.effective_status !== 'overdue'),
    [visibleItems, todayStr]
  );
  const completedTodayCount = useMemo(() => dueTodayItems.filter((i) => i.effective_status === 'completed').length, [dueTodayItems]);
  const overdueItems = useMemo(() => visibleItems.filter((i) => i.section === 'OVERDUE' || i.effective_status === 'overdue'), [visibleItems]);
  
  // Upcoming appointments & scheduled followups (category='appointment' or section='NEXT UP')
  const upcomingAppointments = useMemo(
    () => visibleItems.filter((i) => (i.section === 'NEXT UP' || i.category === 'appointment') && !dueTodayItems.some((d) => d.id === i.id) && i.effective_status !== 'overdue'),
    [visibleItems, dueTodayItems]
  );

  const totalTrackedItems = dueTodayItems.length + medications.length;
  const totalCompletedItems = completedTodayCount + takenMedsCount;
  const progressPercentage = totalTrackedItems > 0 ? Math.round((totalCompletedItems / totalTrackedItems) * 100) : 0;

  const nextPendingItem = useMemo(() => dueTodayItems.find((i) => i.effective_status === 'pending') || null, [dueTodayItems]);
  const nextPendingMedication = useMemo(() => {
    const takenIds = new Set(adherenceLogs.filter((l) => l.status === 'taken').map((l) => l.medication_id));
    return medications.find((m) => !takenIds.has(m.id)) || null;
  }, [medications, adherenceLogs]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t(language, 'good_morning');
    if (hour < 17) return t(language, 'good_afternoon');
    return t(language, 'good_evening');
  };

  const patientFirstName = patientContext.patientName.split(' ')[0];
  const isCaregiver = patientContext.role === 'caregiver';
  const isLight = theme === 'light';

  const handleUpdateCoordStatus = async (id: string, status: CoordinationCardStatus) => {
    await dataService.updateCoordinationCardStatus(id, status, 'Noted by care coordinator.');
    const updated = await dataService.getCoordinationCards(patientContext.patientId);
    setCoordinationCards(updated);
    refreshData();
  };

  /* ── Shared card style helpers (vary by theme) ── */
  const card = {
    normal: {
      backgroundColor: isLight ? '#EAF4FA' : undefined,
      border: isLight ? '1px solid #C5DCE8' : undefined,
      boxShadow: isLight ? '0 1px 4px rgba(24,50,74,0.07)' : undefined,
    } as React.CSSProperties,
    emphasized: {
      backgroundColor: isLight ? '#E1F0F7' : undefined,
      border: isLight ? '1px solid #B8D9E8' : undefined,
      boxShadow: isLight ? '0 1px 4px rgba(24,50,74,0.07)' : undefined,
    } as React.CSSProperties,
    amber: {
      backgroundColor: isLight ? '#FFF5D9' : undefined,
      border: isLight ? '1px solid #F5D57A' : undefined,
    } as React.CSSProperties,
    blue: {
      backgroundColor: isLight ? '#E8F3FC' : undefined,
      border: isLight ? '1px solid #B8D4EA' : undefined,
    } as React.CSSProperties,
    green: {
      backgroundColor: isLight ? '#E4F6F1' : undefined,
      border: isLight ? '1px solid #A8DFC9' : undefined,
    } as React.CSSProperties,
  };

  const txt = {
    heading: { color: isLight ? '#18324A' : undefined } as React.CSSProperties,
    muted: { color: isLight ? '#587084' : undefined } as React.CSSProperties,
    primary: { color: isLight ? '#007A73' : undefined } as React.CSSProperties,
    amber: { color: isLight ? '#C58A00' : undefined } as React.CSSProperties,
    green: { color: isLight ? '#1A7A50' : undefined } as React.CSSProperties,
    white: {} as React.CSSProperties, // always white on teal buttons
  };

  const sectionLabel = (color: 'teal' | 'amber' | 'blue') => {
    if (!isLight) return color === 'teal' ? 'text-teal-300' : color === 'amber' ? 'text-amber-400' : 'text-blue-300';
    return color === 'teal' ? '' : color === 'amber' ? '' : '';
  };

  return (
    <div className="space-y-4 pb-8 animate-in fade-in duration-200">

      {/* ── HERO CARD: Greeting + Progress ── */}
      <div
        className="rounded-3xl p-5 shadow-sm relative overflow-hidden"
        style={isLight ? {
          background: 'linear-gradient(135deg, #D4EEF7 0%, #E8F5FB 60%, #F0F8FD 100%)',
          border: '1px solid #B8D9E8',
          boxShadow: '0 2px 12px rgba(24,50,74,0.08)',
        } : {
          background: undefined,
        }}
        /* Dark mode keeps the original Tailwind gradient class below */
      >
        {/* Dark mode classes — ignored in light mode due to inline style override */}
        <div
          className={isLight ? '' : 'absolute inset-0 rounded-3xl bg-gradient-to-br from-teal-900/70 via-slate-900 to-slate-950 border border-teal-800/40'}
          aria-hidden
        />
        {/* Decorative glow (dark only) */}
        {!isLight && <div className="absolute -top-12 -right-12 w-32 h-32 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />}

        <div className="relative z-10">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 text-xs">
              <span
                className="font-bold uppercase tracking-wider"
                style={isLight ? { color: '#007A73' } : { color: '#5eead4' }}
              >
                {isCaregiver ? 'Caregiver Oversight' : 'Daily Care Plan'}
              </span>
              <span style={isLight ? { color: '#7A9AAD' } : { color: '#94a3b8' }}>·</span>
              <span className="font-mono text-[11px]" style={isLight ? { color: '#587084' } : { color: '#cbd5e1' }}>
                {todayFormatted}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setActiveSubRoute('reminders')}
                aria-label="View reminders"
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] transition"
                style={isLight ? {
                  backgroundColor: 'rgba(0,175,163,0.10)',
                  border: '1px solid #B8D9E8',
                  color: '#007A73',
                } : {
                  backgroundColor: 'rgba(30,41,59,0.9)',
                  border: '1px solid rgba(71,85,105,0.8)',
                  color: '#5eead4',
                }}
              >
                <Bell className="w-3 h-3" />
                <span>{reminders.length}</span>
              </button>

              <span
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
                style={isLight ? (isOnline ? {
                  backgroundColor: '#E4F6F1', border: '1px solid #A8DFC9', color: '#1A7A50',
                } : {
                  backgroundColor: '#FFF5D9', border: '1px solid #F5D57A', color: '#C58A00',
                }) : (isOnline ? {
                  backgroundColor: 'rgba(6,78,59,0.8)', border: '1px solid rgba(4,120,87,0.7)', color: '#6ee7b7',
                } : {
                  backgroundColor: 'rgba(120,53,15,0.8)', border: '1px solid rgba(146,64,14,0.7)', color: '#fcd34d',
                })}
              >
                {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                <span>{isOnline ? 'Online' : 'Offline'}</span>
              </span>
            </div>
          </div>

          <h1
            className="text-xl font-bold tracking-tight mt-1"
            style={isLight ? { color: '#18324A' } : { color: '#ffffff' }}
          >
            {getGreeting()}, {isCaregiver ? 'Ramesh' : patientFirstName}
          </h1>
          {isCaregiver && (
            <p className="text-xs mt-0.5 font-medium" style={isLight ? { color: '#C58A00' } : { color: '#fcd34d' }}>
              Monitoring recovery for: <strong>{patientContext.patientName}</strong>
            </p>
          )}

          {/* Progress */}
          <div
            className="mt-4 pt-3"
            style={{ borderTop: isLight ? '1px solid #C5DCE8' : '1px solid rgba(20,184,166,0.2)' }}
          >
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-xs font-semibold" style={isLight ? { color: '#18324A' } : { color: '#ffffff' }}>
                  Today's Progress
                </span>
                <div className="text-[11px]" style={isLight ? { color: '#587084' } : { color: '#99f6e4' }}>
                  {totalCompletedItems} of {totalTrackedItems} actions completed
                </div>
              </div>
              <span
                className="text-lg font-black font-mono"
                style={isLight ? { color: '#007A73' } : { color: '#5eead4' }}
              >
                {progressPercentage}%
              </span>
            </div>

            {/* Progress bar */}
            <div
              className="w-full h-2.5 rounded-full overflow-hidden"
              style={isLight ? {
                backgroundColor: '#C5DCE8',
                border: '1px solid #B8D9E8',
              } : {
                backgroundColor: 'rgba(30,41,59,0.9)',
                border: '1px solid rgba(71,85,105,0.6)',
              }}
            >
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${progressPercentage}%`,
                  background: isLight
                    ? 'linear-gradient(90deg, #00AFA3, #00D4C8)'
                    : 'linear-gradient(90deg, #14b8a6, #5eead4)',
                }}
              />
            </div>

            {/* Stats pills */}
            <div className="grid grid-cols-3 gap-2 mt-3 text-center">
              {[
                { label: 'Completed', value: totalCompletedItems, colorStyle: isLight ? { color: '#1A7A50' } : { color: '#34d399' } },
                { label: 'Pending',   value: dueTodayItems.filter((i) => i.effective_status === 'pending').length + (medications.length - takenMedsCount), colorStyle: isLight ? { color: '#007A73' } : { color: '#5eead4' } },
                { label: 'Overdue',   value: overdueItems.length, colorStyle: isLight ? { color: '#C58A00' } : { color: '#fbbf24' } },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="p-1.5 rounded-xl"
                  style={isLight ? {
                    backgroundColor: 'rgba(255,255,255,0.6)',
                    border: '1px solid #C5DCE8',
                  } : {
                    backgroundColor: 'rgba(2,8,23,0.6)',
                    border: '1px solid rgba(30,41,59,0.8)',
                  }}
                >
                  <span
                    className="text-[10px] block uppercase font-semibold"
                    style={isLight ? { color: '#587084' } : { color: '#94a3b8' }}
                  >
                    {stat.label}
                  </span>
                  <span className="text-xs font-bold" style={stat.colorStyle}>{stat.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Review Banner ── */}
      {reviewCount > 0 && (
        <div
          className="rounded-2xl p-3.5 flex items-center gap-3"
          style={isLight ? card.blue : {
            backgroundColor: 'rgba(30,58,138,0.6)',
            border: '1px solid rgba(30,64,175,0.5)',
          }}
        >
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={isLight ? { backgroundColor: '#D0E8F8', color: '#2B6CB0' } : { backgroundColor: 'rgba(30,64,175,0.7)', color: '#93c5fd' }}
          >
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-xs font-medium leading-relaxed" style={isLight ? { color: '#2B5F8A' } : { color: '#bfdbfe' }}>
            {t(language, 'review_banner', { count: reviewCount })}
          </div>
        </div>
      )}

      {/* ── NEXT ACTION ── */}
      <section aria-label="Next action" className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: isLight ? '#00AFA3' : '#2dd4bf' }} />
          <h2 className="text-xs font-bold uppercase tracking-wider" style={isLight ? { color: '#007A73' } : { color: '#5eead4' }}>
            Next Action
          </h2>
        </div>

        {nextPendingMedication ? (
          <div
            className="rounded-2xl p-4 shadow-sm flex items-start justify-between gap-3"
            style={isLight ? {
              backgroundColor: '#EAF4FA',
              border: '1px solid #C5DCE8',
              boxShadow: '0 1px 6px rgba(24,50,74,0.07)',
            } : {
              backgroundColor: 'rgba(15,23,42,0.9)',
              border: '1px solid rgba(20,184,166,0.3)',
            }}
          >
            <div className="flex items-start gap-3 min-w-0">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                style={isLight ? { backgroundColor: 'rgba(0,175,163,0.12)', border: '1px solid #A8D9D5', color: '#007A73' }
                               : { backgroundColor: 'rgba(19,78,74,0.5)', border: '1px solid rgba(20,184,166,0.4)', color: '#2dd4bf' }}
              >
                <Pill className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider" style={isLight ? { color: '#007A73' } : { color: '#2dd4bf' }}>
                  Take Prescribed Medicine
                </span>
                <h3 className="text-sm font-bold truncate mt-0.5" style={isLight ? { color: '#18324A' } : { color: '#ffffff' }}>
                  {nextPendingMedication.drug_name}
                </h3>
                <div className="text-xs mt-1 flex items-center gap-2">
                  <span className="font-semibold" style={isLight ? { color: '#18324A' } : { color: '#e2e8f0' }}>
                    {nextPendingMedication.dose}
                  </span>
                  <span style={isLight ? { color: '#7A9AAD' } : { color: '#64748b' }}>·</span>
                  <span style={isLight ? { color: '#587084' } : { color: '#99f6e4' }}>
                    {nextPendingMedication.how_often}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('medicines')}
              className="min-h-[44px] px-3.5 rounded-xl text-white text-xs font-bold flex items-center gap-1.5 shrink-0 shadow-sm transition active:scale-95"
              style={{ backgroundColor: '#00AFA3' }}
            >
              <span>View</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : nextPendingItem ? (
          <div
            className="rounded-2xl p-4 shadow-sm flex items-start justify-between gap-3"
            style={isLight ? {
              backgroundColor: '#EAF4FA',
              border: '1px solid #C5DCE8',
              boxShadow: '0 1px 6px rgba(24,50,74,0.07)',
            } : {
              backgroundColor: 'rgba(15,23,42,0.9)',
              border: '1px solid rgba(20,184,166,0.3)',
            }}
          >
            <div className="flex items-start gap-3 min-w-0">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                style={isLight ? { backgroundColor: 'rgba(0,175,163,0.12)', border: '1px solid #A8D9D5', color: '#007A73' }
                               : { backgroundColor: 'rgba(19,78,74,0.5)', border: '1px solid rgba(20,184,166,0.4)', color: '#2dd4bf' }}
              >
                <Activity className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider" style={isLight ? { color: '#007A73' } : { color: '#2dd4bf' }}>
                  Scheduled Daily Care
                </span>
                <h3 className="text-sm font-bold truncate mt-0.5" style={isLight ? { color: '#18324A' } : { color: '#ffffff' }}>
                  {nextPendingItem.title}
                </h3>
                <div className="text-xs mt-1" style={isLight ? { color: '#587084' } : { color: '#cbd5e1' }}>
                  Due: {nextPendingItem.due_time || 'Today'}
                </div>
              </div>
            </div>
            <button
              onClick={() => setSelectedTaskId(nextPendingItem.id)}
              className="min-h-[44px] px-3.5 rounded-xl text-white text-xs font-bold flex items-center gap-1.5 shrink-0 shadow-sm transition active:scale-95"
              style={{ backgroundColor: '#00AFA3' }}
            >
              <span>Check In</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div
            className="p-3.5 rounded-2xl flex items-center gap-2 text-xs"
            style={isLight ? card.green : { backgroundColor: 'rgba(15,23,42,0.6)', border: '1px solid rgba(30,41,59,1)' }}
          >
            <CheckCircle2 className="w-4 h-4" style={isLight ? { color: '#1A7A50' } : { color: '#34d399' }} />
            <span style={isLight ? { color: '#1A7A50' } : { color: '#94a3b8' }}>
              All scheduled actions for today have been logged.
            </span>
          </div>
        )}
      </section>

      {/* ── OVERDUE / NEEDS ATTENTION ── */}
      {overdueItems.length > 0 && (
        <section aria-label="Needs attention" className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: isLight ? '#C58A00' : '#fbbf24' }} />
            <h2 className="text-xs font-bold uppercase tracking-wider" style={isLight ? { color: '#C58A00' } : { color: '#fbbf24' }}>
              Needs Attention ({overdueItems.length})
            </h2>
          </div>
          <div className="space-y-2.5">
            {overdueItems.map((item) => (
              <TaskCard key={item.id} item={item} onOpenDetails={(i) => setSelectedTaskId(i.id)} />
            ))}
          </div>
        </section>
      )}

      {/* ── TODAY'S CARE TASKS ── */}
      <section aria-label="Today's care tasks" className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: isLight ? '#00AFA3' : '#2dd4bf' }} />
            <h2 className="text-xs font-bold uppercase tracking-wider" style={isLight ? { color: '#007A73' } : { color: '#5eead4' }}>
              Today's Care Tasks ({dueTodayItems.length})
            </h2>
          </div>
          <button
            onClick={() => setActiveTab('plan')}
            className="text-xs flex items-center gap-1"
            style={isLight ? { color: '#007A73' } : { color: '#2dd4bf' }}
          >
            <span>Full Plan</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="space-y-2.5">
          {dueTodayItems.map((item) => (
            <TaskCard key={item.id} item={item} onOpenDetails={(i) => setSelectedTaskId(i.id)} />
          ))}
        </div>
      </section>

      {/* ── UPCOMING ── */}
      {upcomingAppointments.length > 0 && (
        <section aria-label="Upcoming appointments and tests" className="space-y-2.5">
          <div className="flex items-center gap-2 px-1">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: isLight ? '#2B5F8A' : '#60a5fa' }} />
            <h2 className="text-xs font-bold uppercase tracking-wider" style={isLight ? { color: '#2B5F8A' } : { color: '#93c5fd' }}>
              Upcoming Follow-ups
            </h2>
          </div>
          <div className="space-y-2.5">
            {upcomingAppointments.map((item) => (
              <TaskCard key={item.id} item={item} onOpenDetails={(i) => setSelectedTaskId(i.id)} />
            ))}
          </div>
        </section>
      )}

      {/* ── COORDINATION CARDS ── */}
      <section aria-label="Care coordination issues" className="space-y-3 pt-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <HeartPulse className="w-4 h-4" style={isLight ? { color: '#007A73' } : { color: '#2dd4bf' }} />
            <h2 className="text-xs font-bold uppercase tracking-wider" style={isLight ? { color: '#18324A' } : { color: '#ffffff' }}>
              Care Team Coordination
            </h2>
          </div>
          <button
            onClick={() => setShowCoordinationModal(true)}
            className="min-h-[36px] px-3 py-1 rounded-xl text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition active:scale-95"
            style={{ backgroundColor: '#00AFA3' }}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Report Issue</span>
          </button>
        </div>

        {coordinationCards.length === 0 ? (
          <div
            className="p-4 rounded-2xl text-xs text-center"
            style={isLight ? card.normal : { backgroundColor: 'rgba(15,23,42,1)', border: '1px solid rgba(30,41,59,1)', color: '#64748b' }}
          >
            <span style={isLight ? { color: '#587084' } : {}}>No active issues raised with the care team.</span>
          </div>
        ) : (
          <div className="space-y-2.5">
            {coordinationCards.map((card_) => (
              <CoordinationCard
                key={card_.id}
                card={card_}
                isCaregiver={isCaregiver}
                onUpdateStatus={(newStatus) => handleUpdateCoordStatus(card_.id, newStatus)}
              />
            ))}
          </div>
        )}
      </section>

      {showCoordinationModal && (
        <CreateCoordinationModal
          patientContext={patientContext}
          onClose={() => setShowCoordinationModal(false)}
          onCreated={() => refreshData()}
        />
      )}

      <TaskDetailSheet itemId={selectedTaskId} onClose={() => setSelectedTaskId(null)} />
    </div>
  );
};
