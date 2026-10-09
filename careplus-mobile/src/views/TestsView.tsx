import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { dataService } from '../services/dataService';
import { t } from '../i18n/translations';
import { FollowupItem, TestResult } from '../types';
import { ArrowLeft, FileCheck, Clock, CheckCircle2, AlertCircle, MapPin, Calendar, Info } from 'lucide-react';

export const TestsView: React.FC = () => {
  const { patientContext, language, setActiveSubRoute, setSelectedTaskId, theme } = useAuth();
  const [allItems, setAllItems] = useState<FollowupItem[]>([]);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const isLight = theme === 'light';

  useEffect(() => {
    let isMounted = true;
    const patId = patientContext.patientId;
    dataService.getEffectiveItems(patId).then((items) => {
      if (isMounted) setAllItems(items);
    });
    dataService.getTestResults(patId).then((results) => {
      if (isMounted) setTestResults(results);
    });
    return () => {
      isMounted = false;
    };
  }, [patientContext.patientId]);

  // Diagnostic items from follow-up plan
  const planTests = useMemo(() => {
    return allItems.filter(
      (i) => i.category === 'test' || i.title.toLowerCase().includes('ecg') || i.title.toLowerCase().includes('echo')
    );
  }, [allItems]);

  // Strictly filter released test results
  const releasedResults = useMemo(() => {
    return testResults.filter((t) => t.is_released);
  }, [testResults]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
            style={
              isLight
                ? { backgroundColor: '#E4F6F1', border: '1px solid #A8DFC9', color: '#1A7A50' }
                : { backgroundColor: 'rgba(6,78,59,0.8)', border: '1px solid rgba(4,120,87,0.7)', color: '#6ee7b7' }
            }
          >
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            <span>Completed</span>
          </span>
        );
      case 'overdue':
        return (
          <span
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
            style={
              isLight
                ? { backgroundColor: '#FFF5D9', border: '1px solid #F5D57A', color: '#C58A00' }
                : { backgroundColor: 'rgba(120,53,15,0.8)', border: '1px solid rgba(146,64,14,0.6)', color: '#fcd34d' }
            }
          >
            <AlertCircle className="w-3 h-3 text-amber-500" />
            <span>Overdue</span>
          </span>
        );
      case 'needs_review':
        return (
          <span
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
            style={
              isLight
                ? { backgroundColor: '#E8F3FC', border: '1px solid #B8D4EA', color: '#2B5F8A' }
                : { backgroundColor: 'rgba(30,58,138,0.8)', border: '1px solid rgba(37,99,235,0.6)', color: '#93c5fd' }
            }
          >
            <Clock className="w-3 h-3" />
            <span>Needs Review</span>
          </span>
        );
      case 'pending':
      default:
        return (
          <span
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
            style={
              isLight
                ? { backgroundColor: '#EAF4FA', border: '1px solid #C5DCE8', color: '#587084' }
                : { backgroundColor: 'rgba(30,41,59,1)', border: '1px solid rgba(71,85,105,1)', color: '#94a3b8' }
            }
          >
            <Clock className="w-3 h-3" />
            <span>Scheduled</span>
          </span>
        );
    }
  };

  const cardStyle: React.CSSProperties = isLight
    ? { backgroundColor: '#EAF4FA', border: '1px solid #C5DCE8', boxShadow: '0 1px 4px rgba(24,50,74,0.07)' }
    : { backgroundColor: '#0f172a', border: '1px solid rgba(20,184,166,0.15)' };

  const subCellStyle: React.CSSProperties = isLight
    ? { backgroundColor: '#F0F8FD', border: '1px solid #C5DCE8' }
    : { backgroundColor: 'rgba(2,8,23,0.6)', border: '1px solid rgba(30,41,59,0.8)' };

  return (
    <div className="space-y-5 pb-8 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setActiveSubRoute(null)}
          aria-label="Back to more menu"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl transition cursor-pointer"
          style={
            isLight
              ? { backgroundColor: '#D4EEF7', border: '1px solid #C5DCE8', color: '#18324A' }
              : { backgroundColor: '#1e293b', color: '#cbd5e1' }
          }
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-bold tracking-tight" style={isLight ? { color: '#18324A' } : { color: '#ffffff' }}>
            {t(language, 'tests_results')}
          </h1>
          <p className="text-xs" style={isLight ? { color: '#007A73' } : { color: '#2dd4bf' }}>
            Diagnostic tests, schedules, and clinical reports
          </p>
        </div>
      </div>

      {/* SECTION 1: Scheduled Tests in Care Plan */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#00AFA3' }} />
          <h2 className="text-xs font-bold uppercase tracking-wider" style={isLight ? { color: '#007A73' } : { color: '#2dd4bf' }}>
            Scheduled Diagnostic Tests ({planTests.length})
          </h2>
        </div>

        <div className="space-y-3">
          {planTests.map((tItem) => (
            <div key={tItem.id} className="rounded-3xl p-4 shadow-sm space-y-3" style={cardStyle}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold leading-snug" style={isLight ? { color: '#18324A' } : { color: '#ffffff' }}>
                    {tItem.title}
                  </h3>
                  <div className="flex items-center gap-2 text-xs mt-1" style={isLight ? { color: '#587084' } : { color: '#94a3b8' }}>
                    <Calendar className="w-3.5 h-3.5" style={isLight ? { color: '#007A73' } : { color: '#2dd4bf' }} />
                    <span>{tItem.due_date}</span>
                    {tItem.due_time && <span>· {tItem.due_time}</span>}
                  </div>
                </div>
                {getStatusBadge(tItem.effective_status)}
              </div>

              {/* Location / Provider Suggestion */}
              {tItem.provider_suggestion && (
                <div className="flex items-start gap-2 p-2.5 rounded-xl text-xs" style={subCellStyle}>
                  <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" style={isLight ? { color: '#007A73' } : { color: '#2dd4bf' }} />
                  <div>
                    <div className="font-semibold" style={isLight ? { color: '#18324A' } : { color: '#ffffff' }}>
                      {tItem.provider_suggestion.name}
                    </div>
                    {tItem.provider_suggestion.location && (
                      <div className="text-[11px]" style={isLight ? { color: '#587084' } : { color: '#94a3b8' }}>
                        {tItem.provider_suggestion.location}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Preparation instructions */}
              {tItem.original_text && (
                <div className="p-2.5 rounded-xl text-xs" style={subCellStyle}>
                  <div className="text-[10px] uppercase font-bold mb-0.5" style={isLight ? { color: '#007A73' } : { color: '#2dd4bf' }}>
                    Preparation & Clinical Instructions
                  </div>
                  <p className="font-mono text-[11px] leading-relaxed" style={isLight ? { color: '#18324A' } : { color: '#cbd5e1' }}>
                    {tItem.original_text}
                  </p>
                </div>
              )}

              {/* View full details */}
              <button
                onClick={() => setSelectedTaskId(tItem.id)}
                className="w-full py-2 text-xs font-semibold text-center cursor-pointer transition"
                style={{
                  borderTop: isLight ? '1px solid #C5DCE8' : '1px solid rgba(30,41,59,0.8)',
                  color: isLight ? '#007A73' : '#2dd4bf',
                }}
              >
                View Full Order Details
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 2: Released Laboratory Reports (Strictly is_released = true) */}
      <section className="space-y-3 pt-2">
        <div className="flex items-center gap-2 px-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#2563eb' }} />
          <h2 className="text-xs font-bold uppercase tracking-wider" style={isLight ? { color: '#1E4D78' } : { color: '#60a5fa' }}>
            Released Laboratory Findings ({releasedResults.length})
          </h2>
        </div>

        {releasedResults.length === 0 ? (
          <div className="p-4 rounded-3xl text-xs text-center" style={cardStyle}>
            <p style={isLight ? { color: '#587084' } : { color: '#94a3b8' }}>
              Your test results are currently undergoing review and will appear here as soon as they are clinically released by your physician.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {releasedResults.map((test) => (
              <div key={test.id} className="rounded-3xl p-4 shadow-sm space-y-2.5" style={cardStyle}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold" style={isLight ? { color: '#18324A' } : { color: '#ffffff' }}>
                      {test.test_name}
                    </h3>
                    <div className="text-xs mt-0.5" style={isLight ? { color: '#587084' } : { color: '#94a3b8' }}>
                      Sample Date: {test.date}
                    </div>
                  </div>

                  <span
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                    style={
                      isLight
                        ? { backgroundColor: '#E4F6F1', border: '1px solid #A8DFC9', color: '#1A7A50' }
                        : { backgroundColor: 'rgba(6,78,59,0.8)', border: '1px solid rgba(4,120,87,0.7)', color: '#6ee7b7' }
                    }
                  >
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    <span>Released</span>
                  </span>
                </div>

                {test.result_content && (
                  <div className="p-3 rounded-2xl text-xs" style={subCellStyle}>
                    <div className="text-[10px] uppercase font-bold mb-1" style={isLight ? { color: '#007A73' } : { color: '#2dd4bf' }}>
                      Released by {test.released_by || 'Cardiology Care Team'}
                    </div>
                    <p className="font-mono leading-relaxed text-[11px]" style={isLight ? { color: '#18324A' } : { color: '#cbd5e1' }}>
                      {test.result_content}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
