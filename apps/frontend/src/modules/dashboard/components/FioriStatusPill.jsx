import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Clock, Info } from 'lucide-react';

export default function FioriStatusPill({ status, type, size = 'sm', className = '' }) {
  const norm = (type || status || '').toLowerCase();

  let colors = 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  let Icon = Info;

  if (norm.includes('good') || norm.includes('pass') || norm.includes('approved') || norm.includes('completed') || norm.includes('healthy') || norm.includes('ok') || norm.includes('paid') || norm.includes('delivered')) {
    colors = 'bg-[#107E3E]/10 text-[#107E3E] border-[#107E3E]/30 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-700';
    Icon = CheckCircle2;
  } else if (norm.includes('warn') || norm.includes('low') || norm.includes('hold') || norm.includes('quarantine') || norm.includes('pending') || norm.includes('shortfall') || norm.includes('partial')) {
    colors = 'bg-[#A65800]/10 text-[#A65800] border-[#A65800]/30 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-700';
    Icon = AlertTriangle;
  } else if (norm.includes('crit') || norm.includes('fail') || norm.includes('reject') || norm.includes('out of stock') || norm.includes('cancelled') || norm.includes('shortage') || norm.includes('alert')) {
    colors = 'bg-[#BB0000]/10 text-[#BB0000] border-[#BB0000]/30 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-700';
    Icon = AlertCircle;
  } else if (norm.includes('progress') || norm.includes('ordered') || norm.includes('running')) {
    colors = 'bg-[#0A6ED1]/10 text-[#0A6ED1] border-[#0A6ED1]/30 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-700';
    Icon = Clock;
  }

  const px = size === 'xs' ? 'px-1.5 py-0.2 text-[9px]' : size === 'md' ? 'px-2.5 py-1 text-[11px]' : 'px-2 py-0.5 text-[10px]';

  return (
    <span className={`inline-flex items-center gap-1 font-semibold rounded-full border ${px} ${colors} ${className}`}>
      <Icon className="w-2.5 h-2.5 shrink-0" />
      <span className="truncate">{status || type}</span>
    </span>
  );
}

