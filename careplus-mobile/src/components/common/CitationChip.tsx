import React from 'react';
import { db } from '../../services/supabaseMock';
import { useAuth } from '../../context/AuthContext';
import { Calendar, ChevronRight } from 'lucide-react';

interface CitationChipProps {
  itemId: string;
  onClick: (itemId: string) => void;
}

export const CitationChip: React.FC<CitationChipProps> = ({ itemId, onClick }) => {
  const item = db.getItemById(itemId);
  if (!item) return null;

  return (
    <button
      onClick={() => onClick(itemId)}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-teal-950/80 border border-teal-700/60 text-teal-200 text-xs font-medium hover:bg-teal-900 transition active:scale-95 shadow-sm"
    >
      <Calendar className="w-3 h-3 text-teal-400 shrink-0" />
      <span className="truncate max-w-[180px]">{item.title}</span>
      <ChevronRight className="w-3 h-3 text-teal-400/80 shrink-0" />
    </button>
  );
};
