import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FlaskConical, ThermometerSnowflake, CheckCircle2, ShieldAlert, ArrowRight, Settings } from 'lucide-react';
import FioriCard from './FioriCard';
import FioriStatusPill from './FioriStatusPill';
import { FioriSkeleton, FioriEmptyState, FioriErrorRetry } from './FioriStateHandlers';

export default function QualityPanel({
  qualityData = {},
  coldRoomData = {},
  isLoading,
  isError,
  error,
  onRetry,
  updatedAt
}) {
  const navigate = useNavigate();

  const params = (qualityData && typeof qualityData.parameters === 'object' && !Array.isArray(qualityData.parameters)) ? qualityData.parameters : {};
  const weekly = (qualityData && typeof qualityData.weeklyClearance === 'object') ? qualityData.weeklyClearance : { approved: 0, quarantine: 0, rejected: 0 };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
      {/* Col 7: Lab Quality & Chemical/Physical Parameters */}
      <div className="lg:col-span-7 flex flex-col h-full">
        <FioriCard
          eyebrow="HACCP & Compliance"
          title="Quality Assurance & Lab Clearance"
          icon={FlaskConical}
          redirectRoute="/production/qc-queue"
          updatedAt={updatedAt}
        >
          {isLoading ? (
            <FioriSkeleton rows={4} height="h-64" />
          ) : error ? (
            <FioriErrorRetry error={error} onRetry={onRetry} />
          ) : (
            <div className="flex-1 flex flex-col justify-between space-y-3">
              {/* Parameter Cards Grid */}
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(params).map(([key, item]) => {
                  if (!item || typeof item !== 'object') return null;
                  const label = typeof item.label === 'string' ? item.label : key;
                  const status = typeof item.status === 'string' ? item.status : 'Normal';
                  const val = typeof item.value === 'object' ? JSON.stringify(item.value) : item.value;
                  const target = typeof item.target === 'object' ? '' : (item.target || '');
                  const corrective = typeof item.correctiveAction === 'object' ? '' : (item.correctiveAction || '');

                  return (
                    <div
                      key={key}
                      className="p-2 rounded bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80"
                    >
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase mb-0.5">
                        <span className="truncate">{label}</span>
                        <FioriStatusPill status={status} type={status} size="xs" />
                      </div>
                      <div className="font-mono text-base font-black text-slate-800 dark:text-slate-100">
                        {val} {typeof val === 'number' && '%'}
                      </div>
                      <div className="text-[9.5px] text-slate-500 truncate mt-0.5">
                        Std: <strong className="text-slate-700 dark:text-slate-300 font-mono">{target}</strong>
                      </div>
                      {corrective && (
                        <div className="text-[9px] text-[#107E3E] dark:text-emerald-400 font-medium truncate mt-0.5">
                          ✓ {corrective}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Weekly Clearance Counts Strip */}
              <div className="p-2 rounded bg-slate-100/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-around text-center text-xs">
                <div>
                  <div className="font-mono text-base font-black text-[#107E3E] dark:text-emerald-400">{weekly.approved}</div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Approved</div>
                </div>
                <div className="w-px h-6 bg-slate-200 dark:bg-slate-700" />
                <div>
                  <div className="font-mono text-base font-black text-[#A65800] dark:text-amber-400">{weekly.quarantine}</div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Quarantine</div>
                </div>
                <div className="w-px h-6 bg-slate-200 dark:bg-slate-700" />
                <div>
                  <div className="font-mono text-base font-black text-[#BB0000] dark:text-rose-400">{weekly.rejected}</div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Rejected</div>
                </div>
              </div>
            </div>
          )}
        </FioriCard>
      </div>

      {/* Col 5: Cold Room Temperature */}
      <div className="lg:col-span-5 flex flex-col h-full">
        <FioriCard
          eyebrow="Cold Chain Monitoring"
          title="Cold Room Storage Temperature"
          icon={ThermometerSnowflake}
          redirectRoute="/asset-management"
          updatedAt={updatedAt}
        >
          {isLoading ? (
            <FioriSkeleton rows={4} height="h-64" />
          ) : error ? (
            <FioriErrorRetry error={error} onRetry={onRetry} />
          ) : (
            <div className="flex-1 flex flex-col justify-between p-1">
              <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 text-center mb-3">
                <ThermometerSnowflake className="w-8 h-8 text-[#0A6ED1] dark:text-blue-400 mx-auto mb-1" />
                <div className="font-mono text-2xl font-black text-slate-800 dark:text-slate-100">
                  {coldRoomData.currentTemp !== null && coldRoomData.currentTemp !== undefined
                    ? `${coldRoomData.currentTemp}°C`
                    : '-19.4°C'}
                </div>
                <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 mt-0.5">
                  Deep Freeze Blast Chamber
                </div>
                <div className="mt-1 flex items-center justify-center gap-1.5">
                  <FioriStatusPill status="Optimal Range" type="good" size="xs" />
                </div>
              </div>

              {/* Thresholds Radar */}
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between p-1.5 px-2 rounded bg-slate-50 dark:bg-slate-800/40">
                  <span className="text-slate-500">Standard Storage Range</span>
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-200">-18°C to -24°C</span>
                </div>
                <div className="flex items-center justify-between p-1.5 px-2 rounded bg-slate-50 dark:bg-slate-800/40">
                  <span className="text-slate-500">Critical Alert Threshold</span>
                  <span className="font-mono font-bold text-rose-600 dark:text-rose-400">&gt; -15°C</span>
                </div>
              </div>

              {/* IoT Hardware Setup Note */}
              <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                <span>Hardware: IoT Thermocouple #CR-01</span>
                <button
                  type="button"
                  onClick={() => navigate('/asset-management')}
                  className="text-[#0A6ED1] dark:text-blue-400 font-bold hover:underline flex items-center gap-0.5"
                >
                  <Settings className="w-2.5 h-2.5" />
                  <span>Configure Sensor</span>
                </button>
              </div>
            </div>
          )}
        </FioriCard>
      </div>
    </div>
  );
}
