import React, { useState, useEffect, useMemo } from 'react';
import { 
  Activity, Search, Filter, ArrowUpDown, ArrowUp, ArrowDown, Download, Printer, 
  RefreshCw, AlertTriangle, CheckCircle2, Clock, XCircle, ShieldAlert, 
  Layers, Package, Factory, HardDrive, Tag, Eye, ChevronRight, X, ExternalLink,
  Calendar as CalendarIcon, Database, Info, Wrench
} from 'lucide-react';
import { api } from '@/lib/axios';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';

export default function InventoryHealthCheckPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    summary: {},
    rawMaterials: { batches: [], master: [], adjustments: [] },
    finishedGoods: { batches: [], master: [] },
    machineAssets: { assets: [], assetMasters: [], machineLogs: [] },
    otherItems: { items: [] }
  });

  // Filters & Controls
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'RAW_MATERIALS' | 'FINISHED_GOODS' | 'MACHINE_ASSETS' | 'OTHER_ITEMS'
  const [rmSubTab, setRmSubTab] = useState('BATCHES'); // 'BATCHES' | 'MASTER'
  const [fgSubTab, setFgSubTab] = useState('BATCHES'); // 'BATCHES' | 'MASTER'
  const [searchQuery, setSearchQuery] = useState('');
  const [healthFilter, setHealthFilter] = useState('ALL'); // 'ALL' | 'EXPIRED' | 'EXPIRING_SOON' | 'LOW_STOCK' | 'HEALTHY'
  const [timeRange, setTimeRange] = useState('ALL'); // 'ALL' | 'TODAY' | '7_DAYS' | '30_DAYS' | 'CUSTOM'
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [sortField, setSortField] = useState('expiryDate');
  const [sortAsc, setSortAsc] = useState(true);

  // Inspector Modal State
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [recordType, setRecordType] = useState('');

  // Fetch full stock auditing data from API
  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/inventory/health-check');
      if (res.data && res.data.success) {
        setData(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch stock health check data:', err);
      Swal.fire({
        icon: 'error',
        title: 'Data Load Notice',
        text: 'Could not fetch consolidated health check data. Showing cached records.',
        timer: 2500,
        showConfirmButton: false
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Helper date calculations
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const getBatchHealth = (expDate, status, qty) => {
    if (status === 'WASTED' || status === 'DEPLETED' || Number(qty) <= 0) {
      return { label: 'Depleted / Zero', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700', type: 'DEPLETED' };
    }
    if (!expDate) {
      return { label: 'No Expiry Set', color: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800', type: 'HEALTHY' };
    }
    const d = new Date(expDate);
    if (d < now) {
      return { label: 'Expired', color: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border-rose-300 dark:border-rose-800', type: 'EXPIRED' };
    }
    if (d <= in30Days) {
      const daysLeft = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
      return { label: `Expiring (${daysLeft}d)`, color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300 dark:border-amber-800', type: 'EXPIRING_SOON' };
    }
    return { label: 'Healthy Stock', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800', type: 'HEALTHY' };
  };

  const getMasterHealth = (current, alert) => {
    const c = Number(current || 0);
    const a = Number(alert || 0);
    if (c <= 0) {
      return { label: 'Zero Stock', color: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border-rose-300 dark:border-rose-800', type: 'LOW_STOCK' };
    }
    if (c <= a) {
      return { label: 'Low Stock Alert', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300 dark:border-amber-800', type: 'LOW_STOCK' };
    }
    return { label: 'Optimal Stock', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800', type: 'HEALTHY' };
  };

  // Date Filter evaluation
  const matchesDateRange = (itemDate) => {
    if (timeRange === 'ALL' || !itemDate) return true;
    const itemTime = new Date(itemDate).getTime();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    if (timeRange === 'TODAY') {
      return itemTime >= todayStart && itemTime <= todayStart + 86400000;
    }
    if (timeRange === '7_DAYS') {
      return itemTime >= now.getTime() - 7 * 86400000;
    }
    if (timeRange === '30_DAYS') {
      return itemTime >= now.getTime() - 30 * 86400000;
    }
    if (timeRange === 'CUSTOM') {
      const s = customStart ? new Date(customStart).getTime() : 0;
      const e = customEnd ? new Date(customEnd + 'T23:59:59').getTime() : Infinity;
      return itemTime >= s && itemTime <= e;
    }
    return true;
  };

  // 1. Filtered Raw Material Batches
  const filteredRmBatches = useMemo(() => {
    return (data.rawMaterials.batches || []).filter(b => {
      const health = getBatchHealth(b.expiryDate, b.status, b.netQty);
      if (healthFilter !== 'ALL' && health.type !== healthFilter) return false;
      if (!matchesDateRange(b.expiryDate || b.mfgDate || b.createdAt)) return false;

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const batchNo = (b.batchNumber || '').toLowerCase();
        const name = (b.rawMaterialName || '').toLowerCase();
        const mfgBatch = (b.mfgBatchNo || '').toLowerCase();
        const loc = (b.storageLocation || '').toLowerCase();
        const supplier = (b.po?.supplier?.name || '').toLowerCase();
        if (!batchNo.includes(q) && !name.includes(q) && !mfgBatch.includes(q) && !loc.includes(q) && !supplier.includes(q)) {
          return false;
        }
      }
      return true;
    }).sort((a, b) => {
      let va = a[sortField] || '';
      let vb = b[sortField] || '';
      if (sortField === 'netQty' || sortField === 'receivedQty') {
        va = Number(va || 0);
        vb = Number(vb || 0);
      }
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [data.rawMaterials.batches, healthFilter, timeRange, customStart, customEnd, searchQuery, sortField, sortAsc]);

  // 1b. Filtered Raw Material Master Items
  const filteredRmMaster = useMemo(() => {
    return (data.rawMaterials.master || []).filter(m => {
      const health = getMasterHealth(m.currentStock, m.alertLevel);
      if (healthFilter === 'LOW_STOCK' && health.type !== 'LOW_STOCK') return false;
      if (healthFilter === 'HEALTHY' && health.type !== 'HEALTHY') return false;
      if (healthFilter === 'EXPIRED' || healthFilter === 'EXPIRING_SOON') return false;

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const code = (m.code || '').toLowerCase();
        const name = (m.name || '').toLowerCase();
        const cat = (m.category?.name || '').toLowerCase();
        if (!code.includes(q) && !name.includes(q) && !cat.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => {
      const va = Number(a.currentStock || 0);
      const vb = Number(b.currentStock || 0);
      return sortAsc ? va - vb : vb - va;
    });
  }, [data.rawMaterials.master, healthFilter, searchQuery, sortAsc]);

  // 2. Filtered Finished Goods Batches
  const filteredFgBatches = useMemo(() => {
    return (data.finishedGoods.batches || []).filter(b => {
      const health = getBatchHealth(b.expiryDate, b.status, b.actualOutput || b.goodQuantity || b.quantity);
      if (healthFilter !== 'ALL' && health.type !== healthFilter) return false;
      if (!matchesDateRange(b.expiryDate || b.mfd || b.startDate)) return false;

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const batchNo = (b.batchNo || b.referenceNo || '').toLowerCase();
        const pName = (b.product?.name || '').toLowerCase();
        const pCode = (b.product?.code || '').toLowerCase();
        const line = (b.machineLine || '').toLowerCase();
        const status = (b.status || '').toLowerCase();
        if (!batchNo.includes(q) && !pName.includes(q) && !pCode.includes(q) && !line.includes(q) && !status.includes(q)) {
          return false;
        }
      }
      return true;
    }).sort((a, b) => {
      let va = a[sortField] || '';
      let vb = b[sortField] || '';
      if (sortField === 'quantity' || sortField === 'actualOutput') {
        va = Number(va || 0);
        vb = Number(vb || 0);
      }
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [data.finishedGoods.batches, healthFilter, timeRange, customStart, customEnd, searchQuery, sortField, sortAsc]);

  // 2b. Filtered Finished Goods Master
  const filteredFgMaster = useMemo(() => {
    return (data.finishedGoods.master || []).filter(p => {
      const health = getMasterHealth(p.currentStock, p.alertLevel);
      if (healthFilter === 'LOW_STOCK' && health.type !== 'LOW_STOCK') return false;
      if (healthFilter === 'HEALTHY' && health.type !== 'HEALTHY') return false;
      if (healthFilter === 'EXPIRED' || healthFilter === 'EXPIRING_SOON') return false;

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const code = (p.code || '').toLowerCase();
        const name = (p.name || '').toLowerCase();
        const sku = (p.sku || '').toLowerCase();
        const cat = (p.category?.name || '').toLowerCase();
        if (!code.includes(q) && !name.includes(q) && !sku.includes(q) && !cat.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => {
      const va = Number(a.currentStock || 0);
      const vb = Number(b.currentStock || 0);
      return sortAsc ? va - vb : vb - va;
    });
  }, [data.finishedGoods.master, healthFilter, searchQuery, sortAsc]);

  // 3. Filtered Machine / Assets
  const filteredAssets = useMemo(() => {
    return (data.machineAssets.assetMasters || []).filter(a => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const name = (a.assetName || '').toLowerCase();
        const cat = (a.category || '').toLowerCase();
        const hsn = (a.hsnCode || '').toLowerCase();
        const specs = (a.specifications || '').toLowerCase();
        if (!name.includes(q) && !cat.includes(q) && !hsn.includes(q) && !specs.includes(q)) return false;
      }
      return true;
    });
  }, [data.machineAssets.assetMasters, searchQuery]);

  // 4. Filtered Other Items
  const filteredOtherItems = useMemo(() => {
    return (data.otherItems.items || []).filter(item => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const code = (item.code || '').toLowerCase();
        const name = (item.name || '').toLowerCase();
        const cat = (item.category || '').toLowerCase();
        if (!code.includes(q) && !name.includes(q) && !cat.includes(q)) return false;
      }
      return true;
    });
  }, [data.otherItems.items, searchQuery]);

  // Toggle sorting
  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Export full multi-sheet Excel file
  const exportFullExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Raw Material Batches
      const rmData = (data.rawMaterials.batches || []).map((b, i) => ({
        '#': i + 1,
        'Batch Number': b.batchNumber,
        'Material Name': b.rawMaterialName,
        'Received Qty': Number(b.receivedQty),
        'Available Net Qty': Number(b.netQty),
        'Wasted Qty': Number(b.wastedQty),
        'UOM': b.uom?.abbreviation || b.uom?.name || b.uomId,
        'Status': b.status,
        'MFG Date': b.mfgDate ? b.mfgDate.split('T')[0] : 'N/A',
        'Expiry Date': b.expiryDate ? b.expiryDate.split('T')[0] : 'N/A',
        'Storage Location': b.storageLocation || 'Unassigned',
        'Vendor Batch #': b.mfgBatchNo || 'N/A',
        'PO Ref': b.poId || 'N/A',
        'GRN Ref': b.grnId || 'N/A'
      }));
      const wsRM = XLSX.utils.json_to_sheet(rmData);
      XLSX.utils.book_append_sheet(wb, wsRM, 'RM Batches');

      // Sheet 2: Finished Goods Batches
      const fgData = (data.finishedGoods.batches || []).map((b, i) => ({
        '#': i + 1,
        'Reference No': b.referenceNo,
        'Batch Number': b.batchNo || 'N/A',
        'Product Name': b.product?.name,
        'Product Code': b.product?.code,
        'Planned Qty': Number(b.quantity),
        'Good Qty': Number(b.goodQuantity || 0),
        'Actual Output': Number(b.actualOutput || 0),
        'Rejected Qty': Number(b.rejectedQuantity || 0),
        'Yield %': `${b.yieldPercentage}%`,
        'Status': b.status,
        'QC Status': b.qcStatus,
        'MFG Date': b.mfd ? b.mfd.split('T')[0] : (b.startDate ? b.startDate.split('T')[0] : 'N/A'),
        'Expiry Date': b.expiryDate ? b.expiryDate.split('T')[0] : 'N/A',
        'Machine Line': b.machineLine || 'N/A',
        'Shift': b.shift || 'N/A'
      }));
      const wsFG = XLSX.utils.json_to_sheet(fgData);
      XLSX.utils.book_append_sheet(wb, wsFG, 'FG Production Batches');

      // Sheet 3: Assets & Machinery
      const assetData = (data.machineAssets.assetMasters || []).map((a, i) => ({
        '#': i + 1,
        'Asset Name': a.assetName,
        'Category': a.category,
        'HSN Code': a.hsnCode,
        'Last Unit Cost': Number(a.lastUnitCost || 0),
        'Specifications': a.specifications || 'N/A'
      }));
      const wsAsset = XLSX.utils.json_to_sheet(assetData);
      XLSX.utils.book_append_sheet(wb, wsAsset, 'Machine Assets');

      // Sheet 4: Other Items
      const otherData = (data.otherItems.items || []).map((item, i) => ({
        '#': i + 1,
        'Item Code': item.code,
        'Item Name': item.name,
        'Category': item.category,
        'Unit': item.unitId,
        'Rate Per Unit': Number(item.ratePerUnit || 0),
        'HSN Code': item.hsnCode || 'N/A',
        'Description': item.description || 'N/A'
      }));
      const wsOther = XLSX.utils.json_to_sheet(otherData);
      XLSX.utils.book_append_sheet(wb, wsOther, 'Other Items (Non-Inv)');

      const filename = `Stock_Audit_Health_Check_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, filename);

      Swal.fire({
        icon: 'success',
        title: 'Export Complete',
        text: `Full dataset exported to ${filename}`,
        timer: 2000,
        showConfirmButton: false
      });
    } catch (e) {
      console.error(e);
      Swal.fire({ icon: 'error', title: 'Export Failed', text: e.message });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* ────────────────── Header & Actions ────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-600/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
              <Activity className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                Inventory Health Check & Stock Auditing
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300">
                  Full Database View
                </span>
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Auditing batches, lot numbers, manufacturing & expiry dates across Raw Materials, Finished Goods, Machines, and Non-Inventory items.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={fetchData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/80 shadow-sm transition-all"
            title="Refresh All Records"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            Refresh
          </button>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/80 shadow-sm transition-all"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            Print Audit Sheet
          </button>

          <button
            onClick={exportFullExcel}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-600/30 transition-all"
          >
            <Download className="w-4 h-4" />
            Export Full Audit (Excel)
          </button>
        </div>
      </div>

      {/* ────────────────── KPI Health Summary Cards ────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div 
          onClick={() => setHealthFilter('ALL')}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            healthFilter === 'ALL'
              ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800 ring-2 ring-indigo-500/20'
              : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
            Total Lots
            <Database className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {(data.summary.totalRawMaterialBatches || 0) + (data.summary.totalFinishedGoodsBatches || 0)}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {data.summary.totalRawMaterialBatches || 0} RM + {data.summary.totalFinishedGoodsBatches || 0} FG
          </p>
        </div>

        <div 
          onClick={() => setHealthFilter('EXPIRED')}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            healthFilter === 'EXPIRED'
              ? 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 ring-2 ring-rose-500/20'
              : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 text-xs font-semibold uppercase tracking-wider">
            Expired Lots
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-600 dark:text-rose-400">
            {data.summary.expiredCount || 0}
          </div>
          <p className="mt-1 text-xs text-rose-500 dark:text-rose-400/80 font-medium">
            Requires immediate discard
          </p>
        </div>

        <div 
          onClick={() => setHealthFilter('EXPIRING_SOON')}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            healthFilter === 'EXPIRING_SOON'
              ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 ring-2 ring-amber-500/20'
              : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 text-xs font-semibold uppercase tracking-wider">
            Expiring (&lt;30d)
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">
            {data.summary.expiringSoonCount || 0}
          </div>
          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400/80 font-medium">
            FEFO priority consumption
          </p>
        </div>

        <div 
          onClick={() => setHealthFilter('LOW_STOCK')}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            healthFilter === 'LOW_STOCK'
              ? 'bg-orange-50/80 dark:bg-orange-950/40 border-orange-300 dark:border-orange-800 ring-2 ring-orange-500/20'
              : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between text-orange-600 dark:text-orange-400 text-xs font-semibold uppercase tracking-wider">
            Under-Stock
            <AlertTriangle className="w-4 h-4 text-orange-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-orange-600 dark:text-orange-400">
            {data.summary.lowStockCount || 0}
          </div>
          <p className="mt-1 text-xs text-orange-600 dark:text-orange-400/80">
            Below safety alert level
          </p>
        </div>

        <div 
          onClick={() => setHealthFilter('HEALTHY')}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            healthFilter === 'HEALTHY'
              ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 ring-2 ring-emerald-500/20'
              : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-xs font-semibold uppercase tracking-wider">
            Healthy Stock
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {data.summary.healthyCount || 0}
          </div>
          <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400/80">
            Good shelf life & balance
          </p>
        </div>

        <div className="p-4 rounded-2xl border bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400 text-xs font-semibold uppercase tracking-wider">
            Assets & Other
            <HardDrive className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {(data.summary.totalAssetMasters || 0) + (data.summary.totalOtherItems || 0)}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {data.summary.totalAssetMasters || 0} Machines + {data.summary.totalOtherItems || 0} Aux
          </p>
        </div>
      </div>

      {/* ────────────────── Tabs, Search & Filters Bar ────────────────── */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        {/* Category Navigation Pills */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'ALL'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Layers className="w-4 h-4 text-indigo-500" />
              All Categories
            </button>

            <button
              onClick={() => setActiveTab('RAW_MATERIALS')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'RAW_MATERIALS'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Factory className="w-4 h-4 text-amber-500" />
              Raw Materials ({filteredRmBatches.length} lots)
            </button>

            <button
              onClick={() => setActiveTab('FINISHED_GOODS')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'FINISHED_GOODS'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Package className="w-4 h-4 text-emerald-500" />
              Finished Goods ({filteredFgBatches.length} batches)
            </button>

            <button
              onClick={() => setActiveTab('MACHINE_ASSETS')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'MACHINE_ASSETS'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <HardDrive className="w-4 h-4 text-blue-500" />
              Machine Assets ({filteredAssets.length})
            </button>

            <button
              onClick={() => setActiveTab('OTHER_ITEMS')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'OTHER_ITEMS'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Tag className="w-4 h-4 text-purple-500" />
              Other Items ({filteredOtherItems.length})
            </button>
          </div>

          {/* Sub-view switches for RM and FG */}
          {activeTab === 'RAW_MATERIALS' && (
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-semibold">
              <button
                onClick={() => setRmSubTab('BATCHES')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  rmSubTab === 'BATCHES' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'
                }`}
              >
                Batches & Lots ({data.rawMaterials.batches.length})
              </button>
              <button
                onClick={() => setRmSubTab('MASTER')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  rmSubTab === 'MASTER' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'
                }`}
              >
                Master Stock Health ({data.rawMaterials.master.length})
              </button>
            </div>
          )}

          {activeTab === 'FINISHED_GOODS' && (
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-semibold">
              <button
                onClick={() => setFgSubTab('BATCHES')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  fgSubTab === 'BATCHES' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'
                }`}
              >
                Production Batches ({data.finishedGoods.batches.length})
              </button>
              <button
                onClick={() => setFgSubTab('MASTER')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  fgSubTab === 'MASTER' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'
                }`}
              >
                Catalog Stock Health ({data.finishedGoods.master.length})
              </button>
            </div>
          )}
        </div>

        {/* Filter Toolbar: Search, Health, Time Range */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
          {/* Universal Search */}
          <div className="relative lg:col-span-5">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Batch #, Material/Product Name, Code, Serial #, Location..."
              className="w-full pl-10 pr-4 py-2 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Health Status Filter */}
          <div className="lg:col-span-3">
            <select
              value={healthFilter}
              onChange={(e) => setHealthFilter(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            >
              <option value="ALL">All Health Statuses</option>
              <option value="EXPIRED">🔴 Expired Lots Only</option>
              <option value="EXPIRING_SOON">🟡 Expiring Within 30 Days</option>
              <option value="LOW_STOCK">🟠 Under-Stock / Reorder Alert</option>
              <option value="HEALTHY">🟢 Healthy Stock Only</option>
              <option value="DEPLETED">⚪ Depleted / Wasted / Zero</option>
            </select>
          </div>

          {/* Time Range Filter */}
          <div className="lg:col-span-4 flex items-center gap-2">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            >
              <option value="ALL">All Time</option>
              <option value="TODAY">Today Only</option>
              <option value="7_DAYS">Last 7 Days</option>
              <option value="30_DAYS">Last 30 Days</option>
              <option value="CUSTOM">Custom Date Range...</option>
            </select>

            {timeRange === 'CUSTOM' && (
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="px-2 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
                <span className="text-slate-400 text-xs">to</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="px-2 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ────────────────── Main Data Views ────────────────── */}

      {/* Section 1: Raw Materials Batches Table */}
      {(activeTab === 'ALL' || (activeTab === 'RAW_MATERIALS' && rmSubTab === 'BATCHES')) && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 sm:px-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                1. Raw Material Inventory Batches ({filteredRmBatches.length} Lots Tracked)
              </h2>
            </div>
            <span className="text-xs text-slate-400">
              Sorted by: <strong className="text-slate-600 dark:text-slate-300">{sortField}</strong> ({sortAsc ? 'Asc' : 'Desc'})
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 border-b border-slate-200/80 dark:border-slate-800 uppercase font-semibold">
                  <th className="py-3 px-3.5">#</th>
                  <th className="py-3 px-3.5 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('batchNumber')}>
                    <span className="inline-flex items-center gap-1">
                      Batch Number
                      {sortField === 'batchNumber' && (sortAsc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                    </span>
                  </th>
                  <th className="py-3 px-3.5 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('rawMaterialName')}>
                    <span className="inline-flex items-center gap-1">
                      Material Name
                      {sortField === 'rawMaterialName' && (sortAsc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                    </span>
                  </th>
                  <th className="py-3 px-3.5 text-right cursor-pointer hover:text-indigo-600" onClick={() => handleSort('receivedQty')}>
                    Received
                  </th>
                  <th className="py-3 px-3.5 text-right cursor-pointer hover:text-indigo-600" onClick={() => handleSort('netQty')}>
                    Available Net Qty
                  </th>
                  <th className="py-3 px-3.5 text-center">UOM</th>
                  <th className="py-3 px-3.5 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('mfgDate')}>
                    MFG Date
                  </th>
                  <th className="py-3 px-3.5 cursor-pointer hover:text-indigo-600" onClick={() => handleSort('expiryDate')}>
                    Expiry Date
                  </th>
                  <th className="py-3 px-3.5">Health Status</th>
                  <th className="py-3 px-3.5">Location</th>
                  <th className="py-3 px-3.5">Supplier Batch</th>
                  <th className="py-3 px-3.5 text-center">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filteredRmBatches.length === 0 ? (
                  <tr>
                    <td colSpan="12" className="py-8 text-center text-slate-400">
                      No raw material batches matched the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredRmBatches.map((b, i) => {
                    const health = getBatchHealth(b.expiryDate, b.status, b.netQty);
                    return (
                      <tr key={b.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-3.5 text-slate-400">{i + 1}</td>
                        <td className="py-3 px-3.5 font-mono font-medium text-slate-900 dark:text-white">
                          {b.batchNumber}
                        </td>
                        <td className="py-3 px-3.5 font-medium text-slate-900 dark:text-white">
                          {b.rawMaterialName}
                        </td>
                        <td className="py-3 px-3.5 text-right text-slate-500">
                          {Number(b.receivedQty).toLocaleString()}
                        </td>
                        <td className="py-3 px-3.5 text-right font-bold text-slate-900 dark:text-white">
                          {Number(b.netQty).toLocaleString()}
                        </td>
                        <td className="py-3 px-3.5 text-center text-slate-500 font-mono">
                          {b.uom?.abbreviation || b.uom?.name || b.uomId}
                        </td>
                        <td className="py-3 px-3.5 text-slate-600 dark:text-slate-400">
                          {b.mfgDate ? b.mfgDate.split('T')[0] : <span className="text-slate-400 italic">N/A</span>}
                        </td>
                        <td className="py-3 px-3.5 font-medium">
                          {b.expiryDate ? b.expiryDate.split('T')[0] : <span className="text-slate-400 italic">N/A</span>}
                        </td>
                        <td className="py-3 px-3.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${health.color}`}>
                            {health.label}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 text-slate-500">
                          {b.storageLocation || <span className="text-slate-400 italic">Unassigned</span>}
                        </td>
                        <td className="py-3 px-3.5 font-mono text-slate-500">
                          {b.mfgBatchNo || <span className="text-slate-400 italic">-</span>}
                        </td>
                        <td className="py-3 px-3.5 text-center">
                          <button
                            onClick={() => {
                              setSelectedRecord(b);
                              setRecordType('RawMaterialBatch');
                            }}
                            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-indigo-600 dark:text-indigo-400"
                            title="Inspect All Database Columns"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Section 1b: Raw Material Master Stock Health */}
      {(activeTab === 'RAW_MATERIALS' && rmSubTab === 'MASTER') && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 sm:px-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Raw Materials Master Catalog Stock Health ({filteredRmMaster.length} Items)
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 border-b border-slate-200/80 dark:border-slate-800 uppercase font-semibold">
                  <th className="py-3 px-3.5">#</th>
                  <th className="py-3 px-3.5">Code</th>
                  <th className="py-3 px-3.5">Material Name</th>
                  <th className="py-3 px-3.5">Category</th>
                  <th className="py-3 px-3.5 text-right">Current Stock</th>
                  <th className="py-3 px-3.5 text-right">Safety Alert Level</th>
                  <th className="py-3 px-3.5 text-right">Rate / Unit</th>
                  <th className="py-3 px-3.5">Stock Health</th>
                  <th className="py-3 px-3.5 text-center">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filteredRmMaster.map((rm, i) => {
                  const health = getMasterHealth(rm.currentStock, rm.alertLevel);
                  return (
                    <tr key={rm.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3.5 text-slate-400">{i + 1}</td>
                      <td className="py-3 px-3.5 font-mono font-medium text-slate-900 dark:text-white">{rm.code}</td>
                      <td className="py-3 px-3.5 font-medium text-slate-900 dark:text-white">{rm.name}</td>
                      <td className="py-3 px-3.5 text-slate-500">{rm.category?.name || 'Uncategorized'}</td>
                      <td className="py-3 px-3.5 text-right font-bold text-slate-900 dark:text-white">
                        {Number(rm.currentStock || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-3.5 text-right text-slate-500">
                        {Number(rm.alertLevel || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-3.5 text-right font-medium">₹{Number(rm.ratePerUnit || 0).toFixed(2)}</td>
                      <td className="py-3 px-3.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${health.color}`}>
                          {health.label}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-center">
                        <button
                          onClick={() => {
                            setSelectedRecord(rm);
                            setRecordType('RawMaterialMaster');
                          }}
                          className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-indigo-600 dark:text-indigo-400"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Section 2: Finished Goods Production Batches Table */}
      {(activeTab === 'ALL' || (activeTab === 'FINISHED_GOODS' && fgSubTab === 'BATCHES')) && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 sm:px-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                2. Finished Goods Production Batches ({filteredFgBatches.length} Batches Tracked)
              </h2>
            </div>
            <span className="text-xs text-slate-400">
              Sorted by: <strong className="text-slate-600 dark:text-slate-300">{sortField}</strong> ({sortAsc ? 'Asc' : 'Desc'})
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 border-b border-slate-200/80 dark:border-slate-800 uppercase font-semibold">
                  <th className="py-3 px-3.5">#</th>
                  <th className="py-3 px-3.5">Reference #</th>
                  <th className="py-3 px-3.5">Batch #</th>
                  <th className="py-3 px-3.5">Product Name</th>
                  <th className="py-3 px-3.5 text-right">Planned Qty</th>
                  <th className="py-3 px-3.5 text-right">Good / Actual Qty</th>
                  <th className="py-3 px-3.5 text-center">Yield %</th>
                  <th className="py-3 px-3.5">Batch Status</th>
                  <th className="py-3 px-3.5">QC Status</th>
                  <th className="py-3 px-3.5">MFD (Mfg Date)</th>
                  <th className="py-3 px-3.5">Expiry Date</th>
                  <th className="py-3 px-3.5">Health</th>
                  <th className="py-3 px-3.5">Machine Line</th>
                  <th className="py-3 px-3.5 text-center">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filteredFgBatches.length === 0 ? (
                  <tr>
                    <td colSpan="14" className="py-8 text-center text-slate-400">
                      No finished goods batches matched the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredFgBatches.map((b, i) => {
                    const health = getBatchHealth(b.expiryDate, b.status, b.actualOutput || b.goodQuantity || b.quantity);
                    return (
                      <tr key={b.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-3.5 text-slate-400">{i + 1}</td>
                        <td className="py-3 px-3.5 font-mono text-slate-500">{b.referenceNo}</td>
                        <td className="py-3 px-3.5 font-mono font-medium text-slate-900 dark:text-white">
                          {b.batchNo || b.referenceNo}
                        </td>
                        <td className="py-3 px-3.5 font-medium text-slate-900 dark:text-white">
                          {b.product?.name} <span className="text-slate-400 font-normal">({b.product?.code})</span>
                        </td>
                        <td className="py-3 px-3.5 text-right text-slate-500">{Number(b.quantity).toLocaleString()}</td>
                        <td className="py-3 px-3.5 text-right font-bold text-slate-900 dark:text-white">
                          {Number(b.actualOutput || b.goodQuantity || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-3.5 text-center font-semibold text-slate-700 dark:text-slate-300">
                          {b.yieldPercentage}%
                        </td>
                        <td className="py-3 px-3.5">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            b.status === 'Completed' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' :
                            b.status === 'In Progress' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                            'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                          }`}>
                            {b.status}
                          </span>
                        </td>
                        <td className="py-3 px-3.5">
                          <span className="font-mono text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                            {b.qcStatus || 'N/A'}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 text-slate-600 dark:text-slate-400">
                          {b.mfd ? b.mfd.split('T')[0] : (b.startDate ? b.startDate.split('T')[0] : 'N/A')}
                        </td>
                        <td className="py-3 px-3.5 font-medium">
                          {b.expiryDate ? b.expiryDate.split('T')[0] : <span className="text-slate-400 italic">N/A</span>}
                        </td>
                        <td className="py-3 px-3.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${health.color}`}>
                            {health.label}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 text-slate-500">{b.machineLine || '-'}</td>
                        <td className="py-3 px-3.5 text-center">
                          <button
                            onClick={() => {
                              setSelectedRecord(b);
                              setRecordType('FinishedGoodsBatch');
                            }}
                            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-indigo-600 dark:text-indigo-400"
                            title="Inspect All 80 Columns"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Section 2b: Finished Goods Catalog Stock Health */}
      {(activeTab === 'FINISHED_GOODS' && fgSubTab === 'MASTER') && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 sm:px-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Finished Products Catalog Stock Health ({filteredFgMaster.length} Products)
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 border-b border-slate-200/80 dark:border-slate-800 uppercase font-semibold">
                  <th className="py-3 px-3.5">#</th>
                  <th className="py-3 px-3.5">Code</th>
                  <th className="py-3 px-3.5">SKU</th>
                  <th className="py-3 px-3.5">Product Name</th>
                  <th className="py-3 px-3.5">Category</th>
                  <th className="py-3 px-3.5 text-right">Current Stock</th>
                  <th className="py-3 px-3.5 text-right">Alert Threshold</th>
                  <th className="py-3 px-3.5 text-right">Sale Price</th>
                  <th className="py-3 px-3.5">Stock Health</th>
                  <th className="py-3 px-3.5 text-center">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filteredFgMaster.map((p, i) => {
                  const health = getMasterHealth(p.currentStock, p.alertLevel);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3.5 text-slate-400">{i + 1}</td>
                      <td className="py-3 px-3.5 font-mono font-medium text-slate-900 dark:text-white">{p.code}</td>
                      <td className="py-3 px-3.5 font-mono text-slate-500">{p.sku || '-'}</td>
                      <td className="py-3 px-3.5 font-medium text-slate-900 dark:text-white">{p.name}</td>
                      <td className="py-3 px-3.5 text-slate-500">{p.category?.name || 'Uncategorized'}</td>
                      <td className="py-3 px-3.5 text-right font-bold text-slate-900 dark:text-white">
                        {Number(p.currentStock || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-3.5 text-right text-slate-500">
                        {Number(p.alertLevel || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-3.5 text-right font-medium">₹{Number(p.salePrice || 0).toFixed(2)}</td>
                      <td className="py-3 px-3.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${health.color}`}>
                          {health.label}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-center">
                        <button
                          onClick={() => {
                            setSelectedRecord(p);
                            setRecordType('FinishedProductMaster');
                          }}
                          className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-indigo-600 dark:text-indigo-400"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Section 3: Machine Assets Table */}
      {(activeTab === 'ALL' || activeTab === 'MACHINE_ASSETS') && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 sm:px-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                3. Machine & Equipment Assets ({filteredAssets.length} Assets Registered)
              </h2>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 border-b border-slate-200/80 dark:border-slate-800 uppercase font-semibold">
                  <th className="py-3 px-3.5">#</th>
                  <th className="py-3 px-3.5">Asset Name</th>
                  <th className="py-3 px-3.5">Category</th>
                  <th className="py-3 px-3.5">HSN / SAC Code</th>
                  <th className="py-3 px-3.5 text-right">Last Unit Cost</th>
                  <th className="py-3 px-3.5">Specifications & Features</th>
                  <th className="py-3 px-3.5">Created Date</th>
                  <th className="py-3 px-3.5 text-center">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filteredAssets.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-8 text-center text-slate-400">
                      No machine assets registered yet.
                    </td>
                  </tr>
                ) : (
                  filteredAssets.map((a, i) => (
                    <tr key={a.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3.5 text-slate-400">{i + 1}</td>
                      <td className="py-3 px-3.5 font-medium text-slate-900 dark:text-white flex items-center gap-2">
                        <Wrench className="w-4 h-4 text-blue-500" />
                        {a.assetName}
                      </td>
                      <td className="py-3 px-3.5 text-slate-500">{a.category}</td>
                      <td className="py-3 px-3.5 font-mono text-slate-600 dark:text-slate-400">{a.hsnCode}</td>
                      <td className="py-3 px-3.5 text-right font-bold text-slate-900 dark:text-white">
                        ₹{Number(a.lastUnitCost || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-3.5 text-slate-500 max-w-xs truncate" title={a.specifications}>
                        {a.specifications || '-'}
                      </td>
                      <td className="py-3 px-3.5 text-slate-400">
                        {a.createdAt ? a.createdAt.split('T')[0] : '-'}
                      </td>
                      <td className="py-3 px-3.5 text-center">
                        <button
                          onClick={() => {
                            setSelectedRecord(a);
                            setRecordType('AssetMaster');
                          }}
                          className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-indigo-600 dark:text-indigo-400"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Section 4: Other Items (Non-Inventory Consumables) */}
      {(activeTab === 'ALL' || activeTab === 'OTHER_ITEMS') && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 sm:px-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                4. Other Items List ({filteredOtherItems.length} Auxiliary & Packaging Items)
              </h2>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 border-b border-slate-200/80 dark:border-slate-800 uppercase font-semibold">
                  <th className="py-3 px-3.5">#</th>
                  <th className="py-3 px-3.5">Item Code</th>
                  <th className="py-3 px-3.5">Item Name</th>
                  <th className="py-3 px-3.5">Category</th>
                  <th className="py-3 px-3.5 text-center">Unit</th>
                  <th className="py-3 px-3.5 text-right">Rate / Unit</th>
                  <th className="py-3 px-3.5">Alternate UOM / Factor</th>
                  <th className="py-3 px-3.5">HSN Code</th>
                  <th className="py-3 px-3.5 text-center">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filteredOtherItems.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="py-8 text-center text-slate-400">
                      No other auxiliary items registered.
                    </td>
                  </tr>
                ) : (
                  filteredOtherItems.map((item, i) => (
                    <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3.5 text-slate-400">{i + 1}</td>
                      <td className="py-3 px-3.5 font-mono font-medium text-slate-900 dark:text-white">{item.code}</td>
                      <td className="py-3 px-3.5 font-medium text-slate-900 dark:text-white">{item.name}</td>
                      <td className="py-3 px-3.5 text-slate-500">{item.category || 'Packaging / Auxiliary'}</td>
                      <td className="py-3 px-3.5 text-center font-mono text-slate-600 dark:text-slate-400">{item.unitId}</td>
                      <td className="py-3 px-3.5 text-right font-bold text-slate-900 dark:text-white">
                        ₹{Number(item.ratePerUnit || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-3.5 text-slate-500">
                        {item.hasAlternateUom ? `${item.alternateUom} (Factor: ${item.conversionFactor})` : 'Standard 1:1'}
                      </td>
                      <td className="py-3 px-3.5 font-mono text-slate-400">{item.hsnCode || '-'}</td>
                      <td className="py-3 px-3.5 text-center">
                        <button
                          onClick={() => {
                            setSelectedRecord(item);
                            setRecordType('NonInventoryItem');
                          }}
                          className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-indigo-600 dark:text-indigo-400"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ────────────────── Complete Database Record Inspector Modal ────────────────── */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[85vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-850">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-600/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    Database Record Inspector
                    <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {recordType}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    ID: {selectedRecord.id || selectedRecord.batchNumber || selectedRecord.code}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedRecord(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content: Key-Value Field Grid */}
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(selectedRecord).map(([key, val]) => {
                  let displayVal = val;
                  if (val === null || val === undefined) {
                    displayVal = <span className="text-slate-400 italic font-mono">null</span>;
                  } else if (typeof val === 'boolean') {
                    displayVal = val ? <span className="text-emerald-600 font-bold font-mono">true</span> : <span className="text-rose-600 font-bold font-mono">false</span>;
                  } else if (typeof val === 'object') {
                    displayVal = <pre className="text-[11px] font-mono text-slate-600 dark:text-slate-400 overflow-x-auto p-2 bg-slate-100 dark:bg-slate-800/80 rounded-lg">{JSON.stringify(val, null, 2)}</pre>;
                  } else {
                    displayVal = <span className="font-mono text-xs text-slate-900 dark:text-white break-all">{String(val)}</span>;
                  }

                  return (
                    <div key={key} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-750">
                      <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                        {key}
                      </div>
                      <div>{displayVal}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-850">
              <span className="text-xs text-slate-500">
                Total fields: <strong className="text-slate-700 dark:text-slate-300">{Object.keys(selectedRecord).length}</strong>
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(selectedRecord, null, 2));
                  Swal.fire({ icon: 'success', title: 'Copied JSON', timer: 1200, showConfirmButton: false });
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all"
              >
                Copy JSON to Clipboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
