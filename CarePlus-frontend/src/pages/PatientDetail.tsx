import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Verified,
  PlusCircle,
  AlertCircle,
  ClipboardList,
  FileText,
  Pill,
  Activity,
  History,
  X,
  Loader2,
} from 'lucide-react';
import { getPatientById } from '../services/doctorService';
import { getPatientItems } from '../services/itemService';
import { getPatientFlags } from '../services/flagService';
import { getPatientQuestions } from '../services/questionService';
import { getPatientMedications } from '../services/medicationService';
import { webGetDischargeSummary, webAddTask } from '../lib/api';

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
  const queryClient = useQueryClient();

  const [showAddTask, setShowAddTask] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    item_type: 'care_instruction',
    due_date: '',
  });
  const [submittingTask, setSubmittingTask] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);

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

  const { data: dischargeSummary, isLoading: summaryLoading } = useQuery({
    queryKey: ['patient-discharge-summary', id],
    queryFn: () => webGetDischargeSummary(id!),
    enabled: !!id && activeTab === 'summary',
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

  async function submitAddTask() {
    if (!taskForm.description.trim()) {
      setTaskError('Task description is required');
      return;
    }
    setSubmittingTask(true);
    setTaskError(null);
    try {
      const res = await webAddTask({
        patient_id: id!,
        description: taskForm.description.trim(),
        item_type: taskForm.item_type,
        due_date: taskForm.due_date || null,
        title: taskForm.title.trim() || null,
      });
      if (res.error) {
        setTaskError(res.error);
        return;
      }
      setShowAddTask(false);
      setTaskForm({ title: '', description: '', item_type: 'care_instruction', due_date: '' });
      // Refresh plan items (web Plan reads v_items_effective -> followup_item)
      queryClient.invalidateQueries({ queryKey: ['patient-items', id] });
    } catch (e: any) {
      setTaskError(e?.message || 'Failed to add task');
    } finally {
      setSubmittingTask(false);
    }
  }

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
            <button
              onClick={() => setShowAddTask(true)}
              className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-700 text-white font-medium transition-colors flex items-center gap-2"
            >
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
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Discharge Summary</h3>
              {(dischargeSummary?.data?.summaries?.length ?? 0) > 0 && (
                <span className="text-xs text-slate-500">
                  {dischargeSummary?.data?.summaries?.length} record(s)
                </span>
              )}
            </div>
            {summaryLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-slate-500 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading discharge summary...
              </div>
            ) : (dischargeSummary?.data?.summaries?.length ?? 0) > 0 ? (
              <div className="space-y-4">
                {dischargeSummary!.data!.summaries!.map((s) => (
                  <div key={s.id} className="border border-border rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-border text-xs text-slate-500">
                      <div className="flex items-center gap-3">
                        {s.discharge_date && (
                          <span>Discharged: {new Date(s.discharge_date).toLocaleDateString()}</span>
                        )}
                        <span className="capitalize">{s.language}</span>
                      </div>
                      <span>Uploaded {new Date(s.created_at).toLocaleString()}</span>
                    </div>
                    <pre className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed p-4 max-h-[50vh] overflow-y-auto">
                      {s.raw_content}
                    </pre>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 border border-dashed border-border rounded-lg">
                <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="text-sm text-slate-500">No discharge summary recorded yet.</p>
                <p className="text-xs text-slate-400 mt-1">
                  Upload one from the New Discharge flow (Upload → Review & Publish) and it will appear here.
                </p>
              </div>
            )}
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

      {/* Add Task modal */}
      {showAddTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-lg font-bold text-slate-900">Add task to care plan</h2>
              <button
                onClick={() => setShowAddTask(false)}
                className="p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Type</label>
                <select
                  value={taskForm.item_type}
                  onChange={(e) => setTaskForm({ ...taskForm, item_type: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="appointment">Appointment</option>
                  <option value="test">Test</option>
                  <option value="medication">Medication</option>
                  <option value="care_instruction">Care instruction</option>
                  <option value="warning_sign">Warning sign</option>
                  <option value="diet">Diet</option>
                  <option value="rehab">Rehab</option>
                  <option value="wound_care">Wound care</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Title (optional)</label>
                <input
                  type="text"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  placeholder="Short label for the plan"
                  className="w-full px-3 py-2 bg-white border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Description *</label>
                <textarea
                  rows={4}
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  placeholder="What should the patient do?"
                  className="w-full px-3 py-2 bg-white border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Due date (optional)</label>
                <input
                  type="date"
                  value={taskForm.due_date}
                  onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              {taskError && (
                <div className="flex items-start gap-2 px-3 py-2 bg-danger-container/20 border border-danger/30 rounded-lg text-xs text-danger">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{taskError}</span>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 p-4 border-t border-border bg-slate-50">
              <button
                onClick={() => setShowAddTask(false)}
                disabled={submittingTask}
                className="px-4 py-2 bg-white border border-border rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={submitAddTask}
                disabled={submittingTask}
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
              >
                {submittingTask ? (<><Loader2 className="w-4 h-4 animate-spin" /> Adding...</>) : 'Add task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
