import { useQuery } from '@tanstack/react-query';
import { Filter, AlertTriangle } from 'lucide-react';
import { getUnresolvedFlags } from '../services/flagService';

export function ReviewQueue() {
  const { data: flags, isLoading } = useQuery({
    queryKey: ['unresolved-flags'],
    queryFn: getUnresolvedFlags,
  });

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Review Queue</h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Items requiring your attention
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-3 py-2 bg-white border border-border rounded-lg text-sm text-slate-600 hover:bg-slate-50">
            <Filter className="w-4 h-4" />
            Filter
          </button>
        </div>
      </div>

      {/* Flags Table */}
      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-slate-50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Patient
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Reason
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Item/Question
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Raised by
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Age
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Severity
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-500 text-sm">
                    Loading...
                  </td>
                </tr>
              ) : !flags || flags.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-500 text-sm">
                    No items in review queue
                  </td>
                </tr>
              ) : (
                flags.map((flag: any) => (
                  <tr key={flag.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-semibold">
                          {flag.patients?.full_name?.split(' ').map((n: string) => n[0]).join('') || 'P'}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-900">
                            {flag.patients?.full_name || 'Unknown'}
                          </div>
                          <div className="text-xs text-slate-500">{flag.patients?.mrn || 'N/A'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">{flag.reason}</td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {flag.item_id ? `Item: ${flag.item_id}` : flag.question_id ? `Question: ${flag.question_id}` : 'N/A'}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">{flag.raised_by}</td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {new Date(flag.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        flag.severity === 'high' ? 'bg-warning-container text-warning' :
                        flag.severity === 'medium' ? 'bg-info-container text-info' :
                        'bg-surface-container text-slate-600'
                      }`}>
                        {flag.severity === 'high' && <AlertTriangle className="w-3 h-3" />}
                        {flag.severity}
                      </span>
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
