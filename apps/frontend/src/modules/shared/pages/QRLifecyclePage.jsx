import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ShoppingCart, Package, FlaskConical, Archive, DollarSign,
  CheckCircle2, XCircle, Clock, ArrowLeft, ExternalLink, RefreshCw, AlertCircle
} from 'lucide-react';
import { api } from '@/lib/axios';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const StatusBadge = ({ status, decision }) => {
  const val = (status || decision || '').toUpperCase();
  const map = {
    APPROVED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    LAB_APPROVED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    LAB_REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    PENDING_LAB: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    AVAILABLE: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
    ORDERED: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
    RECEIVED: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
    NEED_SAMPLE: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    DISPATCHED: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${map[val] || 'bg-slate-100 text-slate-600'}`}>
      {val.replace(/_/g, ' ')}
    </span>
  );
};

const StageCard = ({ step, title, icon: Icon, color, children, isActive, isDone, isEmpty }) => {
  const colors = {
    indigo: { ring: 'ring-indigo-400', icon: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400', border: 'border-indigo-200 dark:border-indigo-800' },
    cyan: { ring: 'ring-cyan-400', icon: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/40 dark:text-cyan-400', border: 'border-cyan-200 dark:border-cyan-800' },
    emerald: { ring: 'ring-emerald-400', icon: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800' },
    purple: { ring: 'ring-purple-400', icon: 'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-800' },
    amber: { ring: 'ring-amber-400', icon: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800' },
  };
  const c = colors[color] || colors.indigo;

  return (
    <div className={`relative flex gap-4 ${step < 5 ? 'pb-8' : ''}`}>
      {/* Vertical line */}
      {step < 5 && <div className="absolute left-5 top-10 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700" />}

      {/* Step circle */}
      <div className={`relative flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-900 z-10 ${c.icon} ${isActive ? c.ring : ''} ${isEmpty ? 'opacity-40' : ''}`}>
        <Icon className="w-5 h-5" />
      </div>

      {/* Content */}
      <div className={`flex-1 bg-white dark:bg-slate-800 rounded-2xl border ${c.border} overflow-hidden ${isEmpty ? 'opacity-50' : ''}`}>
        <div className={`px-5 py-3 flex items-center justify-between border-b ${c.border}`}>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500">STAGE {step}</span>
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
          </div>
          {isDone && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
          {isEmpty && <span className="text-xs text-slate-400 italic">Not yet reached</span>}
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
};

const Row = ({ label, value }) => (
  <div className="flex items-start gap-2 text-sm">
    <span className="text-slate-400 dark:text-slate-500 min-w-[120px] flex-shrink-0">{label}</span>
    <span className="font-medium text-slate-800 dark:text-slate-200">{value || '—'}</span>
  </div>
);

const QRLifecyclePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lifecycle, setLifecycle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isOfflineData, setIsOfflineData] = useState(false);

  const parseOfflinePayload = (rawId) => {
    try {
      let data;
      try { data = JSON.parse(rawId); }
      catch (e) { data = JSON.parse(decodeURIComponent(rawId)); }
      
      return {
        po: data.poNumber ? {
          referenceNo: data.poNumber,
          name: data.rawMaterial,
          quantity: data.quantity,
          uom: { abbreviation: data.uom },
          supplier: { name: data.supplierName },
          status: data.paymentStatus || 'ORDERED',
          expectedDelivery: data.expectedDelivery,
          poAmount: data.poAmount,
        } : null,
        grn: data.grnNumber ? {
          referenceNo: data.grnNumber,
          receivedDate: data.receivedDate,
          status: data.grnStatus || 'RECEIVED',
          invoiceNumber: 'N/A',
          vehicleNumber: 'N/A'
        } : null,
        lab: (data.labDecision || data.labParams) ? {
          status: data.labDecision ? 'COMPLETED' : 'PENDING',
          overallDecision: data.labDecision || 'PENDING',
          labNotes: data.labNotes,
          testResults: data.labParams ? Object.entries(data.labParams).map(([name, val]) => ({ rmName: `${name}: ${val}`, passed: data.labDecision !== 'REJECTED' })) : []
        } : null,
        inventory: data.batchNumber ? {
          batchNumber: data.batchNumber,
          rawMaterialName: data.rawMaterial,
          netQty: data.quantity,
          uom: { abbreviation: data.uom },
          status: 'AVAILABLE'
        } : null,
        purchaseReturns: []
      };
    } catch (e) {
      return null;
    }
  };

  const fetchLifecycle = async () => {
    setLoading(true); setError(''); setIsOfflineData(false);
    const offlineData = parseOfflinePayload(id);
    
    let queryId = id;
    try {
       // Only send the core ID if it's a huge JSON to prevent URI errors on backend
       const parsed = JSON.parse(id) || JSON.parse(decodeURIComponent(id));
       queryId = parsed.grnNumber || parsed.batchNumber || parsed.poNumber || id;
    } catch (e) {}

    try {
      const r = await api.get(`/qr-lifecycle/${encodeURIComponent(queryId)}`);
      setLifecycle(r.data);
    } catch (e) {
      if (offlineData) {
        setLifecycle(offlineData);
        setIsOfflineData(true);
      } else {
        // Handle Express HTML URIError responses natively
        const errMsg = e.response?.data?.error || (typeof e.response?.data === 'string' && e.response.data.includes('URIError') ? 'URIError' : 'Unable to find lifecycle for this QR code.');
        setError(errMsg);
      }
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchLifecycle(); }, [id]);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </button>
        <div className="flex-1 overflow-hidden">
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">QR Lifecycle Tracker</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 truncate" title={id}>ID: {id}</p>
        </div>
        <button onClick={fetchLifecycle} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {isOfflineData && (
        <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-2xl p-4 mb-6 flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-cyan-600 dark:text-cyan-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-cyan-800 dark:text-cyan-300">Offline QR Payload Displayed</p>
            <p className="text-sm text-cyan-700 dark:text-cyan-400 mt-1">
              Could not fetch live database updates. Displaying the embedded data from the QR code.
            </p>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
          <p>Loading lifecycle data…</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-6 flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-800 dark:text-red-300">{error}</p>
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">Try scanning again or check the QR code.</p>
          </div>
        </div>
      )}

      {!loading && lifecycle && (
        <div className="space-y-0">
          {/* Stage 1: Purchase Order */}
          <StageCard step={1} title="Purchase Order" icon={ShoppingCart} color="indigo"
            isDone={!!lifecycle.po} isEmpty={!lifecycle.po}>
            {lifecycle.po ? (
              <div className="space-y-2">
                <Row label="Reference No" value={lifecycle.po.referenceNo} />
                <Row label="Material" value={lifecycle.po.name} />
                <Row label="Quantity" value={`${lifecycle.po.quantity} ${lifecycle.po.uom?.abbreviation || ''}`} />
                <Row label="Supplier" value={lifecycle.po.supplier?.name} />
                <Row label="Status" value={<StatusBadge status={lifecycle.po.status} />} />
                <Row label="Created By" value={lifecycle.po.user?.name} />
                <Row label="Expected Delivery" value={fmtDate(lifecycle.po.expectedDelivery)} />
                {lifecycle.po.id && (
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                    <Link to={`/purchase-orders/${lifecycle.po.id}`} className="inline-flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
                      <ExternalLink className="w-3.5 h-3.5" /> View Purchase Order
                    </Link>
                  </div>
                )}
              </div>
            ) : <p className="text-sm text-slate-400">No PO data found.</p>}
          </StageCard>

          {/* Stage 2: Material Receive (GRN) */}
          <StageCard step={2} title="Material Receive (GRN)" icon={Package} color="cyan"
            isDone={!!lifecycle.grn} isEmpty={!lifecycle.grn}>
            {lifecycle.grn ? (
              <div className="space-y-2">
                <Row label="GRN Reference" value={lifecycle.grn.referenceNo} />
                <Row label="Received Date" value={fmtDateTime(lifecycle.grn.receivedDate)} />
                <Row label="Received By" value={lifecycle.grn.receiver?.name} />
                <Row label="Invoice No" value={lifecycle.grn.invoiceNumber} />
                <Row label="Vehicle No" value={lifecycle.grn.vehicleNumber} />
                <Row label="Status" value={<StatusBadge status={lifecycle.grn.status} />} />
                {lifecycle.grn.id && (
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                    <Link to={`/grn/view/${lifecycle.grn.id}`} className="inline-flex items-center gap-1.5 text-xs text-cyan-600 dark:text-cyan-400 hover:underline">
                      <ExternalLink className="w-3.5 h-3.5" /> View GRN Record
                    </Link>
                  </div>
                )}
              </div>
            ) : <p className="text-sm text-slate-400">Material has not been received yet.</p>}
          </StageCard>

          {/* Stage 3: Lab Testing */}
          <StageCard step={3} title="Lab Testing" icon={FlaskConical} color="purple"
            isDone={!!lifecycle.lab} isEmpty={!lifecycle.lab}>
            {lifecycle.lab ? (
              <div className="space-y-2">
                <Row label="Tested By" value={lifecycle.lab.tester?.name} />
                <Row label="Status" value={<StatusBadge status={lifecycle.lab.status} />} />
                <Row label="Decision" value={<StatusBadge decision={lifecycle.lab.overallDecision} />} />
                <Row label="Sample Qty" value={`${lifecycle.lab.sampleQty || 0}`} />
                <Row label="Lab Notes" value={lifecycle.lab.labNotes} />
                {lifecycle.lab.testResults?.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-slate-500 mb-2">Test Results ({lifecycle.lab.testResults.length})</p>
                    <div className="space-y-1">
                      {lifecycle.lab.testResults.map((r, i) => (
                        <div key={i} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-700/40 rounded-lg text-xs">
                          <span className="text-slate-600 dark:text-slate-400">{r.rmName}</span>
                          {r.passed ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <XCircle className="w-3.5 h-3.5 text-red-500" />}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : <p className="text-sm text-slate-400">Lab testing not yet started.</p>}
          </StageCard>

          {/* Stage 4: Inventory */}
          <StageCard step={4} title="Inventory" icon={Archive} color="emerald"
            isDone={!!lifecycle.inventory} isEmpty={!lifecycle.inventory}>
            {lifecycle.inventory ? (
              <div className="space-y-2">
                <Row label="Batch No" value={lifecycle.inventory.batchNumber} />
                <Row label="Material" value={lifecycle.inventory.rawMaterialName} />
                <Row label="Net Qty" value={`${lifecycle.inventory.netQty} ${lifecycle.inventory.uom?.abbreviation || ''}`} />
                <Row label="Location" value={lifecycle.inventory.storageLocation} />
                <Row label="Status" value={<StatusBadge status={lifecycle.inventory.status} />} />
                <Row label="Expiry" value={fmtDate(lifecycle.inventory.expiryDate)} />
              </div>
            ) : <p className="text-sm text-slate-400">Not yet uploaded to inventory.</p>}
          </StageCard>

          {/* Stage 5: Purchase Returns */}
          <StageCard step={5} title="Sales / Returns" icon={DollarSign} color="amber"
            isDone={lifecycle.purchaseReturns?.length > 0} isEmpty={!lifecycle.purchaseReturns?.length}>
            {lifecycle.purchaseReturns?.length > 0 ? (
              <div className="space-y-3">
                {lifecycle.purchaseReturns.map((r, i) => (
                  <div key={i} className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800 space-y-1">
                    <Row label="Return Ref" value={r.referenceNo} />
                    <Row label="Qty" value={r.returnQty} />
                    <Row label="Reason" value={r.returnReason?.replace(/_/g, ' ')} />
                    <Row label="Status" value={<StatusBadge status={r.status} />} />
                    <Row label="Date" value={fmtDate(r.returnDate)} />
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-slate-400">No sales or returns recorded for this item.</p>}
          </StageCard>
        </div>
      )}
    </div>
  );
};

export default QRLifecyclePage;
