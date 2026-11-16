import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Factory,
  BarChart3,
  AlertTriangle,
  ShieldCheck,
  Truck,
  FileCheck2,
  Users,
  IndianRupee,
  ArrowUpRight
} from 'lucide-react';
import FioriStatusPill from './FioriStatusPill';
import FioriSparkline from './FioriSparkline';

// Helper for Indian Currency formatting
const formatRupees = (val) => {
  const num = Number(val || 0);
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
  return `₹${num.toLocaleString('en-IN')}`;
};

export default function KpiBand({ data, isLoading, onRefresh }) {
  const navigate = useNavigate();
  const kpis = data?.kpis || {};

  const tiles = [
    {
      id: 'active-batches',
      title: 'Active Batches',
      value: kpis.activeBatches?.count ?? 0,
      sub: 'In execution on floor',
      pill: { status: `${kpis.activeBatches?.count || 0} Running`, type: 'in-progress' },
      icon: Factory,
      sparkline: kpis.activeBatches?.sparkline,
      route: '/production/batches'
    },
    {
      id: 'output-today',
      title: 'Output Today',
      value: `${kpis.outputToday?.actual?.toLocaleString('en-IN') || 0} ${kpis.outputToday?.uom || 'L'}`,
      sub: `Plan: ${kpis.outputToday?.planned?.toLocaleString('en-IN') || 0} ${kpis.outputToday?.uom || 'L'}`,
      pill: { status: `${kpis.outputToday?.percentOfPlan || 100}% of plan`, type: (kpis.outputToday?.percentOfPlan >= 90 ? 'good' : 'warning') },
      icon: BarChart3,
      progress: kpis.outputToday?.percentOfPlan || 100,
      route: '/production/batches'
    },
    {
      id: 'rm-low-stock',
      title: 'RM Low Stock',
      value: kpis.rmLowStock?.totalAtRisk ?? 0,
      sub: `${kpis.rmLowStock?.critical || 0} Critical • ${kpis.rmLowStock?.low || 0} Low`,
      pill: {
        status: (kpis.rmLowStock?.critical > 0 ? `${kpis.rmLowStock.critical} Critical` : 'Stock Healthy'),
        type: (kpis.rmLowStock?.critical > 0 ? 'critical' : kpis.rmLowStock?.low > 0 ? 'warning' : 'good')
      },
      icon: AlertTriangle,
      route: '/purchase/rm-low-stock'
    },
    {
      id: 'qc-quarantine',
      title: 'QC Quarantine',
      value: kpis.qcQuarantine?.quarantineCount ?? 0,
      sub: `${kpis.qcQuarantine?.approvedToday || 0} approved today`,
      pill: {
        status: (kpis.qcQuarantine?.quarantineCount > 0 ? `${kpis.qcQuarantine.quarantineCount} On Hold` : 'Queue Clear'),
        type: (kpis.qcQuarantine?.quarantineCount > 0 ? 'warning' : 'good')
      },
      icon: ShieldCheck,
      route: '/production/qc-queue'
    },
    {
      id: 'orders-to-dispatch',
      title: 'Orders to Dispatch',
      value: kpis.ordersToDispatch?.readyForShipment ?? 0,
      sub: `${kpis.ordersToDispatch?.dispatchedToday || 0} dispatched today`,
      pill: {
        status: `${kpis.ordersToDispatch?.readyForShipment || 0} Ready`,
        type: 'good'
      },
      icon: Truck,
      route: '/sales/order'
    },
    {
      id: 'pos-pending-approval',
      title: 'POs Pending Approval',
      value: kpis.posPendingApproval?.count ?? 0,
      sub: formatRupees(kpis.posPendingApproval?.totalAmount || 0),
      pill: {
        status: (kpis.posPendingApproval?.count > 0 ? `${kpis.posPendingApproval.count} Awaiting` : 'All Approved'),
        type: (kpis.posPendingApproval?.count > 0 ? 'warning' : 'good')
      },
      icon: FileCheck2,
      route: '/purchase-orders'
    },
    {
      id: 'staff-on-floor',
      title: 'Staff on Floor',
      value: kpis.staffOnFloor?.clockedIn ?? 12,
      sub: `Shift: ${kpis.staffOnFloor?.shift || data?.currentShift || 'Morning'}`,
      pill: { status: 'Shift Active', type: 'good' },
      icon: Users,
      route: '/attendance'
    },
    {
      id: 'revenue-today',
      title: 'Revenue Today',
      value: formatRupees(kpis.revenueToday?.revenue || 0),
      sub: `Target: ${formatRupees(kpis.revenueToday?.dailyTarget || 50000)}`,
      pill: {
        status: `${kpis.revenueToday?.revenue >= (kpis.revenueToday?.dailyTarget || 50000) ? 'Target Met' : 'In Progress'}`,
        type: (kpis.revenueToday?.revenue >= (kpis.revenueToday?.dailyTarget || 50000) ? 'good' : 'in-progress')
      },
      icon: IndianRupee,
      sparkline: kpis.revenueToday?.sparkline,
      route: '/sales/order'
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3" aria-label="Key Performance Indicators Band">
      {tiles.map((tile) => {
        const Icon = tile.icon;
        return (
          <div
            key={tile.id}
            onClick={() => navigate(tile.route)}
            className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-[#0A6ED1] dark:hover:border-blue-500 rounded-lg p-3 sm:p-3.5 shadow-2xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between relative overflow-hidden"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') navigate(tile.route); }}
            title={`Click to open ${tile.title} page (${tile.route})`}
          >
            {/* Top Accent Line */}
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-slate-200 dark:bg-slate-800 group-hover:bg-[#0A6ED1] dark:group-hover:bg-blue-400 transition-colors" />

            <div className="flex items-start justify-between gap-1 mb-1.5">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
                {tile.title}
              </span>
              <div className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:text-[#0A6ED1] group-hover:bg-blue-50 dark:group-hover:bg-blue-950 transition-colors shrink-0">
                <Icon className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Value Row */}
            <div className="flex items-baseline justify-between gap-2 my-1">
              <span className="font-mono text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight tabular-nums truncate">
                {isLoading ? (
                  <span className="inline-block w-16 h-6 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                ) : (
                  typeof tile.value === 'object' && tile.value !== null
                    ? (tile.value.count ?? tile.value.actual ?? tile.value.readyForShipment ?? 0)
                    : tile.value
                )}
              </span>

              {tile.sparkline && !isLoading && (
                <FioriSparkline data={tile.sparkline} color="#0A6ED1" width={56} height={20} />
              )}
            </div>

            {/* Mini Progress Bar for Output */}
            {tile.progress !== undefined && !isLoading && (
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1 my-1 overflow-hidden">
                <div
                  className="bg-[#107E3E] h-1 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Number(tile.progress) || 100)}%` }}
                />
              </div>
            )}

            {/* Bottom Row */}
            <div className="flex items-center justify-between gap-1 mt-1 text-[10px] text-slate-400 dark:text-slate-500">
              <span className="truncate">
                {typeof tile.sub === 'object' && tile.sub !== null ? '' : (tile.sub || '')}
              </span>
              <FioriStatusPill
                status={typeof tile.pill?.status === 'object' ? 'Active' : (tile.pill?.status || 'Active')}
                type={tile.pill?.type || 'neutral'}
                size="xs"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

