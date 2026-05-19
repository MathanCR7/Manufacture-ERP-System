const prisma = require('../../database/prisma');

const search = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) return res.json({ results: {} });
    const query = q.trim();

    const [pos, grns, suppliers, customers, rawMaterials, purchaseReturns, inventoryBatches, rmWastes] = await Promise.all([
      prisma.rawMaterialPO.findMany({
        where: { OR: [{ referenceNo: { contains: query, mode: 'insensitive' } }, { name: { contains: query, mode: 'insensitive' } }] },
        select: { id: true, referenceNo: true, name: true, status: true, createdAt: true }, take: 8
      }),
      prisma.gRNReceive.findMany({
        where: { OR: [{ referenceNo: { contains: query, mode: 'insensitive' } }, { invoiceNumber: { contains: query, mode: 'insensitive' } }, { challanNumber: { contains: query, mode: 'insensitive' } }] },
        select: { id: true, referenceNo: true, status: true, receivedDate: true, invoiceNumber: true }, take: 8
      }),
      prisma.supplier.findMany({
        where: { OR: [{ name: { contains: query, mode: 'insensitive' } }, { email: { contains: query, mode: 'insensitive' } }, { phone: { contains: query, mode: 'insensitive' } }] },
        select: { id: true, name: true, email: true, phone: true, status: true }, take: 5
      }),
      prisma.customer.findMany({
        where: { OR: [{ name: { contains: query, mode: 'insensitive' } }, { email: { contains: query, mode: 'insensitive' } }] },
        select: { id: true, name: true, email: true }, take: 5
      }),
      prisma.rawMaterial.findMany({
        where: { OR: [{ name: { contains: query, mode: 'insensitive' } }, { code: { contains: query, mode: 'insensitive' } }] },
        select: { id: true, name: true, code: true, currentStock: true }, take: 5
      }),
      prisma.purchaseReturn.findMany({
        where: { referenceNo: { contains: query, mode: 'insensitive' } },
        select: { id: true, referenceNo: true, status: true, returnDate: true }, take: 5
      }),
      prisma.inventoryBatch.findMany({
        where: { OR: [{ batchNumber: { contains: query, mode: 'insensitive' } }, { rawMaterialName: { contains: query, mode: 'insensitive' } }] },
        select: { id: true, batchNumber: true, rawMaterialName: true, status: true }, take: 5
      }),
      prisma.rMWaste.findMany({
        where: { OR: [{ referenceNo: { contains: query, mode: 'insensitive' } }, { note: { contains: query, mode: 'insensitive' } }] },
        select: { id: true, referenceNo: true, note: true }, take: 5
      }),
    ]);

    res.json({
      results: {
        purchaseOrders: pos.map(p => ({ ...p, type: 'PO', label: p.referenceNo || p.id, subtitle: p.name, link: `/purchase-orders/${p.id}` })),
        grnRecords: grns.map(g => ({ ...g, type: 'GRN', label: g.referenceNo, subtitle: g.invoiceNumber || g.status, link: `/grn/view/${g.id}` })),
        suppliers: suppliers.map(s => ({ ...s, type: 'SUPPLIER', label: s.name, subtitle: s.email || s.phone, link: `/parties/suppliers` })),
        customers: customers.map(c => ({ ...c, type: 'CUSTOMER', label: c.name, subtitle: c.email, link: `/parties/customers` })),
        rawMaterials: rawMaterials.map(r => ({ ...r, type: 'RM', label: r.name, subtitle: r.code, link: `/setup/raw-material` })),
        purchaseReturns: purchaseReturns.map(r => ({ ...r, type: 'RETURN', label: r.referenceNo, subtitle: r.status, link: `/purchase-return/list` })),
        inventoryBatches: inventoryBatches.map(b => ({ ...b, type: 'BATCH', label: b.batchNumber, subtitle: b.rawMaterialName, link: `/inventory/list` })),
        rmWastes: rmWastes.map(r => ({ ...r, type: 'RM_WASTE', label: r.referenceNo, subtitle: r.note || 'Waste Record', link: `/waste/raw-material/edit/${r.id}` })),
      }
    });
  } catch (err) { next(err); }
};

module.exports = { search };
