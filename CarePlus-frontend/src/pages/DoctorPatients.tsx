import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ChevronRight, Search, Filter } from 'lucide-react';
import { getDoctorPatients } from '../services/doctorService';

export function DoctorPatients() {
  const { data: patients, isLoading } = useQuery({
    queryKey: ['doctor-patients'],
    queryFn: getDoctorPatients,
  });

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
        </div>
      </div>

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
