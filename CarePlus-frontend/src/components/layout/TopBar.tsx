import { Search, Bell, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export function TopBar() {
  const { profile, signOut } = useAuth();

  return (
    <header className="h-16 px-8 flex items-center justify-between gap-6 border-b border-border bg-background-sidebar/80 backdrop-blur sticky top-0 z-30">
      {/* Search Input */}
      <div className="relative flex-1 max-w-xl">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
          <Search className="w-4 h-4" />
        </span>
        <input
          type="search"
          placeholder="Search patients, appointments, or lab results..."
          className="w-full pl-9 pr-4 py-2 bg-surface-container/70 border-none rounded-full text-sm placeholder-slate-500 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:bg-white transition-all shadow-inner"
        />
      </div>

      {/* Right Profile & Notification Controls */}
      <div className="flex items-center gap-4 shrink-0">
        {/* Notification Bell */}
        <button
          aria-label="Notifications"
          className="relative p-2 rounded-full text-slate-600 hover:text-slate-900 hover:bg-surface-container transition-colors"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-success ring-2 ring-background-sidebar"></span>
        </button>

        {/* Doctor Profile Card */}
        {profile && (
          <div className="flex items-center gap-3 pl-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold ring-2 ring-primary/30">
                {profile.full_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || 'DR'}
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-sm font-semibold text-slate-900 leading-tight">{profile.full_name || 'Doctor'}</p>
                <p className="text-xs text-slate-500 capitalize">{profile.role}</p>
              </div>
            </div>
            <button
              onClick={signOut}
              className="p-2 rounded-full text-slate-600 hover:text-slate-900 hover:bg-surface-container transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
