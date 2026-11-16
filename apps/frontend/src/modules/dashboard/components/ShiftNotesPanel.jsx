import React, { useState } from 'react';
import { ClipboardPen, Send, UserCheck } from 'lucide-react';
import FioriCard from './FioriCard';
import { FioriSkeleton, FioriEmptyState, FioriErrorRetry } from './FioriStateHandlers';
import { useCreateShiftNote } from '../hooks/useFactoryDashboard';

export default function ShiftNotesPanel({ notes = [], currentShift = 'Morning', isLoading, isError, error, onRetry, updatedAt }) {
  const createNoteMutation = useCreateShiftNote();
  const [noteText, setNoteText] = useState('');
  const list = Array.isArray(notes) ? notes : [];

  const handleSaveNote = async (e) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    try {
      await createNoteMutation.mutateAsync(noteText);
      setNoteText('');
    } catch (err) {
      alert(`Error saving shift handover note: ${err.message || 'Server error'}`);
    }
  };

  const formatTimeAgo = (ts) => {
    if (!ts) return '';
    const diff = Math.floor((new Date() - new Date(ts)) / 60000);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    const hours = Math.floor(diff / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };

  return (
    <FioriCard
      eyebrow="Shift Coordination"
      title={`Supervisor Handover Sign-Off (${currentShift} Shift)`}
      icon={ClipboardPen}
      updatedAt={updatedAt}
    >
      {isLoading ? (
        <FioriSkeleton rows={4} height="h-64" />
      ) : isError ? (
        <FioriErrorRetry error={error} onRetry={onRetry} />
      ) : (
        <div className="flex-1 flex flex-col justify-between space-y-3">
          {/* Recent Handover Notes List */}
          <div className="flex-1 overflow-y-auto max-h-[160px] space-y-2">
            {list.length === 0 ? (
              <div className="text-xs text-slate-400 italic p-3 text-center">
                No shift handover notes logged today. Log note below.
              </div>
            ) : (
              list.slice(0, 3).map((note) => (
                <div
                  key={note.id}
                  className="p-2 rounded bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 text-xs"
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                    <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <UserCheck className="w-3 h-3 text-[#107E3E]" />
                      <span>{note.supervisorName}</span>
                    </span>
                    <span className="font-mono">{formatTimeAgo(note.timestamp)}</span>
                  </div>
                  <div className="text-[11px] text-slate-700 dark:text-slate-200 line-clamp-2">
                    {note.noteText}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Shift Handover Sign-off Form */}
          <form onSubmit={handleSaveNote} className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Log shift handover observations, machine washings, or alerts for next shift..."
              className="w-full h-16 p-2 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#0A6ED1] resize-none"
            />
            <button
              type="submit"
              disabled={createNoteMutation.isPending || !noteText.trim()}
              className="w-full py-1.5 rounded bg-[#0A6ED1] hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold cursor-pointer transition-colors shadow-2xs flex items-center justify-center gap-1.5"
            >
              <Send className="w-3 h-3" />
              <span>{createNoteMutation.isPending ? 'Signing Off...' : 'Sign Off Shift Handover'}</span>
            </button>
          </form>
        </div>
      )}
    </FioriCard>
  );
}

