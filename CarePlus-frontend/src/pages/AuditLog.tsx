import { useQuery } from '@tanstack/react-query';

export function AuditLog() {
  // Mock data for now - will be replaced with actual Supabase query
  useQuery({
    queryKey: ['audit-logs'],
    queryFn: async () => {
      // This will be replaced with actual audit service
      return [];
    },
  });

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Audit Log</h1>
        <p className="text-sm text-slate-600 mt-0.5">
          Tamper-evident audit trail of all system changes
        </p>
      </div>

      {/* Audit Table */}
      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-slate-50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Sequence
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Actor
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Action
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Entity
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Summary
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-slate-500 text-sm">
                  Audit log will be populated from Supabase audit_logs table
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Verification Section */}
      <div className="bg-white rounded-2xl border border-border shadow-sm p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Verify Audit Chain</h2>
        <p className="text-sm text-slate-600 mb-4">
          Verify the integrity of the audit chain by checking hash continuity
        </p>
        <button className="px-4 py-2 bg-primary hover:bg-primary-700 text-white font-medium rounded-lg transition-colors">
          Verify Chain
        </button>
      </div>
    </div>
  );
}
