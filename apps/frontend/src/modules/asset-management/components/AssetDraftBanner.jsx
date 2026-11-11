import { Clock, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AssetDraftBanner({
  draftInfo,
  entityLabel = 'Form',
  onResume,
  onDiscard,
}) {
  if (!draftInfo) return null;

  const isEditDraft = Boolean(draftInfo.editId);
  const savedTime = draftInfo.updatedAt
    ? new Date(draftInfo.updatedAt).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/80 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200">
      <div className="flex items-start sm:items-center gap-3 text-xs sm:text-sm">
        <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 shrink-0">
          <Clock className="w-4 h-4" />
        </div>
        <div>
          <p className="font-semibold">
            Unsaved {isEditDraft ? `${entityLabel} Edit` : `${entityLabel} Draft`} preserved
          </p>
          <p className="text-xs text-amber-700/90 dark:text-amber-300/80">
            Last saved {savedTime || 'recently'}. It will stay saved until you submit it.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 self-end sm:self-auto">
        {onDiscard && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onDiscard(draftInfo.editId || null)}
            className="h-8 px-3 rounded-xl text-xs text-amber-800 hover:text-rose-600 hover:bg-rose-50 dark:text-amber-300 dark:hover:bg-rose-950/30 gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" /> Discard
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          onClick={() => onResume(draftInfo.editId || null)}
          className="h-8 px-3.5 rounded-xl text-xs bg-amber-600 hover:bg-amber-700 text-white gap-1.5 shadow-xs"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Resume Draft
        </Button>
      </div>
    </div>
  );
}

