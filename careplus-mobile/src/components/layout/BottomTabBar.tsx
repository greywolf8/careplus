import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { ActiveTab } from '../../types';
import { Calendar, CheckCircle2, Pill, MessageSquare, MoreHorizontal } from 'lucide-react';
import { t } from '../../i18n/translations';

interface TabConfig {
  id: ActiveTab;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const BottomTabBar: React.FC = () => {
  const { activeTab, setActiveTab, canSeeTab, language, activeSubRoute } = useAuth();

  const allTabs: TabConfig[] = [
    { id: 'today', labelKey: 'today', icon: CheckCircle2 },
    { id: 'plan', labelKey: 'plan', icon: Calendar },
    { id: 'medicines', labelKey: 'medicines', icon: Pill },
    { id: 'ask', labelKey: 'ask', icon: MessageSquare },
    { id: 'more', labelKey: 'more', icon: MoreHorizontal },
  ];

  // REMOVE tabs that are hidden by permissions (Do NOT show disabled grey tab)
  const visibleTabs = allTabs.filter((tab) => canSeeTab(tab.id)).slice(0, 5);

  return (
    <nav
      aria-label="Bottom Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 backdrop-blur-md border-t pb-safe shadow-lg no-print transition-colors duration-300"
      style={{
        backgroundColor: 'var(--cp-tab-bg)',
        borderColor: 'var(--cp-tab-border)',
      }}
    >
      <div className="max-w-lg mx-auto grid grid-flow-col auto-cols-fr items-center h-16 px-1">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id && activeSubRoute === null;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              aria-label={t(language, tab.labelKey)}
              className="flex flex-col items-center justify-center min-h-[44px] py-1 transition-all active:scale-95"
              style={{ color: isActive ? 'var(--cp-primary)' : 'var(--cp-text-subtle)' }}
            >
              <div
                className="p-1.5 rounded-xl transition-colors"
                style={{
                  backgroundColor: isActive ? 'var(--cp-primary-dim)' : 'transparent',
                  color: isActive ? 'var(--cp-accent)' : 'var(--cp-text-subtle)',
                }}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[11px] leading-tight tracking-tight mt-0.5 font-medium">
                {t(language, tab.labelKey)}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
