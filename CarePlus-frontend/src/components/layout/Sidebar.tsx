import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  ClipboardList, 
  History,
  Settings,
  HelpCircle,
  Plus,
  Bot
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getUnresolvedFlags } from '../../services/flagService';

const navItems = [
  { path: '/doctor', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/doctor/patients', icon: Users, label: 'Patients' },
  { path: '/doctor/agent', icon: Bot, label: 'AI Agent' },
  { path: '/doctor/review', icon: ClipboardList, label: 'Review Queue', showBadge: true },
  { path: '/doctor/intake', icon: Plus, label: 'New Discharge' },
  { path: '/doctor/audit', icon: History, label: 'Audit Log' },
];

export function Sidebar() {
  const location = useLocation();
  
  const { data: flags } = useQuery({
    queryKey: ['unresolved-flags'],
    queryFn: getUnresolvedFlags,
  });

  const unresolvedCount = flags?.length || 0;

  return (
    <aside className="w-64 bg-background-sidebar border-r border-border flex flex-col justify-between shrink-0 min-h-screen py-5 px-4 select-none">
      <div>
        {/* CarePlus Logo */}
        <div className="flex items-center gap-2.5 px-3 mb-8">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-sm shadow-emerald-700/20">
            <Plus className="w-5 h-5" />
          </div>
          <span className="font-bold text-xl tracking-tight text-slate-900">CarePlus</span>
        </div>

        {/* Navigation Menu */}
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || 
              (item.path !== '/doctor' && location.pathname.startsWith(item.path));
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-container text-primary-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-surface-container'
                }`}
              >
                <item.icon className={`w-5 h-5 ${isActive ? 'text-primary-800' : 'text-slate-500'}`} />
                <span className="flex-1">{item.label}</span>
                {item.showBadge && unresolvedCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-error text-white text-xs font-semibold">
                    {unresolvedCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom Links */}
      <div className="space-y-1.5 pt-4 border-t border-border">
        <Link
          to="/settings"
          className="flex items-center gap-3 px-3.5 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-surface-container text-sm font-medium transition-colors"
        >
          <Settings className="w-5 h-5 text-slate-500" />
          Settings
        </Link>
        <Link
          to="/help"
          className="flex items-center gap-3 px-3.5 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-surface-container text-sm font-medium transition-colors"
        >
          <HelpCircle className="w-5 h-5 text-slate-500" />
          Help
        </Link>
      </div>
    </aside>
  );
}
