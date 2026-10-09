import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search, Filter, UserPlus, CheckCircle, ChevronRight, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getDoctorPatients, createPatient } from '../services/doctorService';

export function DoctorPatients() {
  const { data: patients, isLoading, refetch } = useQuery({
    queryKey: ['doctor-patients'],
    queryFn: getDoctorPatients,
  });

  const [showCreatePatient, setShowCreatePatient] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newPatient, setNewPatient] = useState({
    full_name: '',
    mrn: '',
    date_of_birth: '',
    sex: 'male' as 'male' | 'female' | 'other',
    language: 'en',
    city: '',
    care_circle: 'Self',
    discharge_date: '',
    email: '',
    password: '',
  });
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState(false);

  const handleCreatePatient = async () => {
    if (!newPatient.full_name.trim()) {
      setCreateError('Patient name is required');
      return;
    }
    if (!newPatient.email.trim()) {
      setCreateError('Patient login email is required');
      return;
    }
    if (newPatient.password.length < 6) {
      setCreateError('Password must be at least 6 characters');
      return;
    }
    setIsSubmitting(true);
    setCreateError(null);
    try {
      const doctorId = (await supabase.auth.getUser()).data.user?.id || '';
      await createPatient(newPatient, doctorId);
      setCreateSuccess(true);
      setShowCreatePatient(false);
      setNewPatient({
        full_name: '',
        mrn: '',
        date_of_birth: '',
        sex: 'male',
        language: 'en',
        city: '',
        care_circle: 'Self',
        discharge_date: '',
        email: '',
        password: '',
      });
      refetch();
      setTimeout(() => setCreateSuccess(false), 3000);
    } catch (error: any) {
      setCreateError(error.message || 'Failed to create patient');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Patients</h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Manage your assigned patients
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="search"
              placeholder="Search patients..."
              className="pl-9 pr-4 py-2 bg-white border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <button className="flex items-center gap-2 px-3 py-2 bg-white border border-border rounded-lg text-sm text-slate-600 hover:bg-slate-50">
            <Filter className="w-4 h-4" />
            Filter
          </button>
          <button
            onClick={() => setShowCreatePatient(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Add Patient
          </button>
        </div>
      </div>

      {/* Success Banner */}
      {createSuccess && (
        <div className="flex items-center gap-2 px-4 py-3 bg-success-container/20 border border-success/30 rounded-lg text-sm text-success">
          <CheckCircle className="w-4 h-4" />
          Patient created successfully
        </div>
      )}

      {/* Create Patient Modal */}
      {showCreatePatient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-lg font-bold text-slate-900">Add New Patient</h2>
              <button
                onClick={() => setShowCreatePatient(false)}
                className="p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Patient Name *</label>
                <input
                  type="text"
                  value={newPatient.full_name}
                  onChange={(e) => setNewPatient({ ...newPatient, full_name: e.target.value })}
                  placeholder="Enter full name"
                  className="w-full px-3 py-2 bg-white border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">MRN</label>
                <input
                  type="text"
                  value={newPatient.mrn}
                  onChange={(e) => setNewPatient({ ...newPatient, mrn: e.target.value })}
                  placeholder="Medical Record Number"
                  className="w-full px-3 py-2 bg-white border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Date of Birth</label>
                <input
                  type="date"
                  value={newPatient.date_of_birth}
                  onChange={(e) => setNewPatient({ ...newPatient, date_of_birth: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Sex</label>
                <select
                  value={newPatient.sex}
                  onChange={(e) => setNewPatient({ ...newPatient, sex: e.target.value as any })}
                  className="w-full px-3 py-2 bg-white border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Language</label>
                <select
                  value={newPatient.language}
                  onChange={(e) => setNewPatient({ ...newPatient, language: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="ta">Tamil</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">City</label>
                <input
                  type="text"
                  value={newPatient.city}
                  onChange={(e) => setNewPatient({ ...newPatient, city: e.target.value })}
                  placeholder="City"
                  className="w-full px-3 py-2 bg-white border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Care Circle</label>
                <input
                  type="text"
                  value={newPatient.care_circle}
                  onChange={(e) => setNewPatient({ ...newPatient, care_circle: e.target.value })}
                  placeholder="e.g., Family member or caregiver"
                  className="w-full px-3 py-2 bg-white border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Discharge date</label>
                <input
                  type="date"
                  value={newPatient.discharge_date}
                  onChange={(e) => setNewPatient({ ...newPatient, discharge_date: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <p className="text-[11px] text-slate-500 mt-1">Optional — sets the "Day" counter in the Patients table. Also auto-set when you publish a discharge.</p>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">
                  Patient login credentials
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Login Email *</label>
                    <input
                      type="email"
                      value={newPatient.email}
                      onChange={(e) => setNewPatient({ ...newPatient, email: e.target.value })}
                      placeholder="patient@example.com"
                      className="w-full px-3 py-2 bg-white border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password *</label>
                    <input
                      type="password"
                      value={newPatient.password}
                      onChange={(e) => setNewPatient({ ...newPatient, password: e.target.value })}
                      placeholder="At least 6 characters"
                      className="w-full px-3 py-2 bg-white border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </div>
              </div>
              {createError && (
                <div className="px-3 py-2 bg-danger-container/20 border border-danger/30 rounded-lg text-xs text-danger">
                  {createError}
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 p-4 border-t border-border bg-slate-50">
              <button
                onClick={() => setShowCreatePatient(false)}
                disabled={isSubmitting}
                className="px-4 py-2 bg-white border border-border rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePatient}
                disabled={isSubmitting}
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Creating...' : 'Create Patient'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Patients Table */}
      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-slate-50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Patient
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  MRN
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Age/Sex
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Language
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Discharge Date
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Day
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-500 text-sm">
                    Loading...
                  </td>
                </tr>
              ) : patients?.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-500 text-sm">
                    No patients assigned
                  </td>
                </tr>
              ) : (
                patients?.map((patient) => (
                  <tr key={patient.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-semibold">
                          {patient.full_name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-900">
                            {patient.full_name}
                          </div>
                          <div className="text-xs text-slate-500">{patient.city || 'Not specified'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">{patient.mrn}</td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {patient.date_of_birth
                        ? `${new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear()} yrs`
                        : 'N/A'}{' '}
                      • {patient.sex || 'N/A'}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600 capitalize">
                      {patient.language}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {patient.discharge_date
                        ? new Date(patient.discharge_date).toLocaleDateString()
                        : 'N/A'}
                    </td>
                    <td className="px-5 py-4">
                      {patient.discharge_date && (
                        <span className="text-sm text-slate-600">
                          Day{' '}
                          {Math.floor(
                            (new Date().getTime() - new Date(patient.discharge_date).getTime()) /
                              (1000 * 60 * 60 * 24)
                          ) + 1}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        to={`/doctor/patients/${patient.id}`}
                        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-700"
                      >
                        View
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
