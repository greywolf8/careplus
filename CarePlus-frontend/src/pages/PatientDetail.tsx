import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  ArrowLeft, 
  Verified, 
  PlusCircle, 
  AlertCircle,
  ClipboardList,
  FileText,
  Pill,
  Activity,
  History
} from 'lucide-react';
import { getPatientById } from '../services/doctorService';
import { getPatientItems } from '../services/itemService';
import { getPatientFlags } from '../services/flagService';
import { getPatientQuestions } from '../services/questionService';
import { getPatientMedications } from '../services/medicationService';

type TabType = 'attention' | 'plan' | 'summary' | 'medicines' | 'activity' | 'audit';

const tabs = [
  { id: 'attention' as TabType, label: 'Attention', icon: AlertCircle },
  { id: 'plan' as TabType, label: 'Plan', icon: ClipboardList },
  { id: 'summary' as TabType, label: 'Discharge summary', icon: FileText },
  { id: 'medicines' as TabType, label: 'Medicines', icon: Pill },
  { id: 'activity' as TabType, label: 'Patient activity', icon: Activity },
  { id: 'audit' as TabType, label: 'Audit', icon: History },
];

export function PatientDetail() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<TabType>('plan');

  const { data: patient, isLoading: patientLoading } = useQuery({
    queryKey: ['patient', id],
    queryFn: () => getPatientById(id!),
    enabled: !!id,
  });

  const { data: items } = useQuery({
    queryKey: ['patient-items', id],
    queryFn: () => getPatientItems(id!),
    enabled: !!id,
  });

  const { data: flags } = useQuery({
    queryKey: ['patient-flags', id],
    queryFn: () => getPatientFlags(id!),
    enabled: !!id,
  });

  const { data: questions } = useQuery({
    queryKey: ['patient-questions', id],
    queryFn: () => getPatientQuestions(id!),
    enabled: !!id,
  });

  const { data: medications } = useQuery({
    queryKey: ['patient-medications', id],
    queryFn: () => getPatientMedications(id!),
    enabled: !!id,
  });

  if (patientLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-slate-500">Loading patient...</div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-slate-500">Patient not found</div>
      </div>
    );
  }

  const dayNumber = patient.discharge_date
    ? Math.floor((new Date().getTime() - new Date(patient.discharge_date).getTime()) / (1000 * 60 * 60 * 24)) + 1
    : 0;

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm">
        <Link to="/doctor/patients" className="flex items-center gap-1.5 text-primary hover:text-primary-700">
          <ArrowLeft className="w-4 h-4" />
          Patients Directory
        </Link>
      </nav>

      {/* Patient Header */}
      <section className="bg-white rounded-2xl border border-border shadow-sm p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Patient Info */}
          <div className="flex items-start sm:items-center gap-5">
            <div className="w-16 h-16 rounded-xl bg-primary/20 flex items-center justify-center text-primary text-xl font-semibold">
              {patient.full_name.split(' ').map(n => n[0]).join('')}
            </div>
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold text-slate-900">{patient.full_name}</h1>
                <span className="px-2 py-0.5 rounded-full bg-surface-container text-slate-600 text-sm">
                  {patient.mrn}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-surface-container-low text-slate-600 text-sm">
                  Post-Op Day {dayNumber}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-sm text-slate-600">
                <span>
                  {patient.date_of_birth
                    ? `${new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear()} yrs`
                    : 'N/A'}{' '}
                  • {patient.sex || 'N/A'}
                </span>
                <span>•</span>
                <span className="capitalize">{patient.language}</span>
                <span>•</span>
                <span>{patient.city || 'Not specified'}</span>
                <span>•</span>
                <span>
                  Discharged:{' '}
                  {patient.discharge_date
                    ? new Date(patient.discharge_date).toLocaleDateString()
                    : 'N/A'}
                </span>
                <span>•</span>
                <span>Care circle: {patient.care_circle || 'Self'}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 shrink-0">
            <button className="px-4 py-2 rounded-lg bg-surface-container-low hover:bg-surface-container text-slate-700 font-medium transition-colors flex items-center gap-2">
              <Verified className="w-4 h-4" />
              Verify audit log
            </button>
            <button className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-700 text-white font-medium transition-colors flex items-center gap-2">
              <PlusCircle className="w-4 h-4" />
              Add task
            </button>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <nav className="flex items-center gap-2 overflow-x-auto pb-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const badge = tab.id === 'attention' ? flags?.length || 0 :
                        tab.id === 'plan' ? items?.length || 0 :
                        tab.id === 'medicines' ? medications?.length || 0 : 0;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 shrink-0 transition-colors ${
                isActive
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-surface-container-low'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {badge > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                  isActive ? 'bg-white text-primary' : 'bg-surface-container text-slate-600'
                }`}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Tab Content */}
      <div className="bg-white rounded-2xl border border-border shadow-sm p-6">
        {activeTab === 'attention' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Flags */}
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-4">Where things went wrong</h3>
                {flags && flags.length > 0 ? (
                  <div className="space-y-2">
                    {flags.map((flag: any) => (
                      <div key={flag.id} className="p-3 rounded-lg bg-warning-container/10 border border-warning/20">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold text-slate-900">{flag.reason}</span>
                          <span className="text-xs text-warning capitalize">{flag.severity}</span>
                        </div>
                        <p className="text-xs text-slate-600">Raised {new Date(flag.created_at).toLocaleDateString()}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No flags</p>
                )}
              </div>

              {/* Right: Questions */}
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-4">Questions from patient</h3>
                {questions && questions.length > 0 ? (
                  <div className="space-y-2">
                    {questions.map((question: any) => (
                      <div key={question.id} className="p-3 rounded-lg bg-info-container/10 border border-info/20">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold text-slate-900">{question.question_text}</span>
                          <span className="text-xs text-info capitalize">{question.status}</span>
                        </div>
                        <p className="text-xs text-slate-600">Asked {new Date(question.created_at).toLocaleDateString()}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No questions</p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'plan' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Care Plan Items</h3>
            {items && items.length > 0 ? (
              <div className="space-y-2">
                {items.map((item: any) => (
                  <div key={item.id} className="p-4 rounded-lg border border-border hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          item.effective_status === 'overdue' ? 'bg-warning-container text-warning' :
                          item.effective_status === 'upcoming' ? 'bg-info-container text-info' :
                          item.effective_status === 'completed' ? 'bg-success-container text-success' :
                          'bg-surface-container text-slate-600'
                        }`}>
                          {item.effective_status}
                        </span>
                        <span className="text-sm font-semibold text-slate-900">{item.what}</span>
                      </div>
                      <span className="text-xs text-slate-500">Confidence: {item.confidence}%</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-600">
                      <span>Due: {item.due_date ? new Date(item.due_date).toLocaleDateString() : 'N/A'}</span>
                      <span>Category: {item.category}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No care plan items</p>
            )}
          </div>
        )}

        {activeTab === 'medicines' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Medications</h3>
            {medications && medications.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Drug</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Dose</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Frequency</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Duration</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {medications.map((med: any) => (
                      <tr key={med.id} className="border-b border-slate-100">
                        <td className="px-4 py-3 text-sm text-slate-900">{med.drug}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{med.dose || 'Not stated'}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{med.frequency || 'Not stated'}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{med.duration || 'Not stated'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            med.status === 'active' ? 'bg-success-container text-success' :
                            med.status === 'stopped' ? 'bg-warning-container text-warning' :
                            'bg-surface-container text-slate-600'
                          }`}>
                            {med.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No medications</p>
            )}
          </div>
        )}

        {activeTab === 'summary' && (
          <div className="text-center py-8">
            <p className="text-sm text-slate-500">Discharge summary view</p>
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="text-center py-8">
            <p className="text-sm text-slate-500">Patient activity view</p>
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="text-center py-8">
            <p className="text-sm text-slate-500">Audit log view</p>
          </div>
        )}
      </div>
    </div>
  );
}
