const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function mapPOToFrontend(po) {
  if (!po) return null;
  return {
    ...po,
    poDate: po.poDate || po.createdAt,
    deliveryAddress: po.shipTo,
    freight: Number(po.freight || 0),
    freightCharges: Number(po.freight || po.shippingCharges || 0),
    loadingCharges: Number(po.loadingCharges || 0),
    unloadingCharges: Number(po.unloadingCharges || 0),
    packingCharges: Number(po.packingCharges || 0),
    insurance: Number(po.insurance || 0),
    isInterState: Boolean(po.isInterState),
    applyGst: po.applyGst !== undefined ? Boolean(po.applyGst) : true,
    cgst: Number(po.cgst || 0),
    sgst: Number(po.sgst || 0),
    igst: Number(po.igst || 0),
    discount: Number(po.discount || 0),
    otherCharges: Number(po.otherCharges || 0),
    roundOff: Number(po.roundOff || 0),
    grandTotal: Number(po.grandTotal || 0),
    tds: Number(po.tds || 0),
    supplierQuoteRef: po.supplierQuoteRef || '',
    paymentMode: po.paymentMode || '',
    paymentTerms: po.paymentTerms || '',
    termsAndConditions: po.termsBlock,
    items: po.items?.map(item => ({
      ...item,
      itemDescription: item.description,
      hsnSac: item.hsnCode,
      unit: item.uom,
      quantity: Number(item.orderedQty),
      unitPrice: Number(item.unitPrice),
      gstRate: Number(item.gstRate || 18),
      totalBeforeTax: Number(item.baseAmount),
      gstAmount: Number(item.cgst || 0) + Number(item.sgst || 0) + Number(item.igst || 0),
      totalWithGst: Number(item.lineTotal),
      cgst: Number(item.cgst || 0),
      sgst: Number(item.sgst || 0),
      igst: Number(item.igst || 0),
    }))
  };
}

const buildTaxBreakdown = (po) => {
  const isInterState = Boolean(po.isInterState);
  const applyGst = po.applyGst !== undefined ? Boolean(po.applyGst) : true;
  const chargeGstStates = po.chargeGstStates || {};

  const getChargeGstApplied = (key) => {
    const state = chargeGstStates[key] || (key === 'freight' ? chargeGstStates['shippingCharges'] : null);
    if (!state) return false;
    return (state === true) || (state === 'true') || (state && (state.applied === true || state.applied === 'true'));
  };
  const getChargeRate = (key) => {
    const state = chargeGstStates[key] || (key === 'freight' ? chargeGstStates['shippingCharges'] : null);
    if (!state || typeof state !== 'object') return 18;
    return isInterState ? 18 : Number(state.rate !== undefined ? state.rate : 18);
  };

  const breakdown = {}; // { rate: { gst, taxable } }

  if (applyGst) {
    (po.items || []).forEach(item => {
      const rate = Number(item.gstRate || 18);
      const base = Number(item.totalBeforeTax || (Number(item.quantity) * Number(item.unitPrice || 0)));
      if (base <= 0) return;

      const storedGst = Number(item.gstAmount || 0);
      const gst = storedGst > 0 ? storedGst : (base * (rate / 100));

      if (!breakdown[rate]) breakdown[rate] = { rate, gst: 0, taxable: 0 };
      breakdown[rate].taxable += base;
      breakdown[rate].gst += gst;
    });

    const addChargeGst = (val, key) => {
      const numVal = Number(val || 0);
      if (numVal <= 0 || !getChargeGstApplied(key)) return;
      const rate = getChargeRate(key);
      const gst = numVal * (rate / 100);
      if (!breakdown[rate]) breakdown[rate] = { rate, gst: 0, taxable: 0 };
      breakdown[rate].taxable += numVal;
      breakdown[rate].gst += gst;
    };
    const freight = Number(po.freight || po.shippingCharges || 0);
    const loadingCharges = Number(po.loadingCharges || 0);
    const packingCharges = Number(po.packingCharges || 0);
    const insurance = Number(po.insurance || 0);
    const otherCharges = Number(po.otherCharges || 0);
    addChargeGst(freight, 'freight');
    addChargeGst(loadingCharges, 'loadingCharges');
    addChargeGst(packingCharges, 'packingCharges');
    addChargeGst(insurance, 'insurance');
    addChargeGst(otherCharges, 'otherCharges');
  }

  const taxRows = [];
  Object.values(breakdown).sort((a, b) => a.rate - b.rate).forEach(tb => {
    if (isInterState) {
      taxRows.push({ label: `IGST @ ${tb.rate}%`, value: tb.gst });
    } else {
      const half = Number((tb.rate / 2).toFixed(2));
      taxRows.push({ label: `CGST @ ${half}%`, value: tb.gst / 2 });
      taxRows.push({ label: `SGST @ ${half}%`, value: tb.gst / 2 });
    }
  });

  const totalTaxable = (po.items || []).reduce((s, i) => s + Number(i.totalBeforeTax || (Number(i.quantity) * Number(i.unitPrice || 0))), 0);
  const totalGstFromRows = taxRows.reduce((s, r) => s + r.value, 0);
  return { taxRows, totalTaxable, totalGst: totalGstFromRows, isInterState, applyGst };
};

async function run() {
  const dbPo = await prisma.assetPO.findFirst({
    where: { pqNo: 'PQ-2026-06-11-00023' },
    include: { items: true }
  });
  const mapped = mapPOToFrontend(dbPo);
  const breakdown = buildTaxBreakdown(mapped);
  console.log('Mapped po:', JSON.stringify(mapped, null, 2));
  console.log('Breakdown:', JSON.stringify(breakdown, null, 2));
  process.exit(0);
}

run();
