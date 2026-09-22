const prisma = require('../../database/prisma');

let lastSyncTime = 0;
const SYNC_THROTTLE_MS = 3000; // Throttle to maximum once every 3 seconds

/**
 * Synchronize all live ERP operational lifecycle records into the OperationsCalendarEvent table:
 * 1. Purchase Orders (Created & Delivery Due)
 * 2. GRN Material Receipts (PO Received Date - including Today's Receipts)
 * 3. Raw Material Lab QC Tests (Test Date & Decision)
 * 4. Production Lab QC Tests (Pass/Fail & Date)
 * 5. Customer / Sales Orders (Booked Date & Delivery Date)
 * 6. Production Batches / Work Orders (Start Date & Complete Date)
 */
async function syncLiveERPEventsToCalendar(force = false) {
  const now = Date.now();
  if (!force && now - lastSyncTime < SYNC_THROTTLE_MS) {
    return { skipped: true, lastSyncTime };
  }
  lastSyncTime = now;

  try {
    const [pos, grns, rmTests, prodTests, orders, batches] = await Promise.all([
      prisma.$queryRawUnsafe(`
        SELECT id, "referenceNo", name, status, "expectedDelivery", "createdAt", "updatedAt", "grand_total"
        FROM "RawMaterialPO"
        WHERE "deletedAt" IS NULL
      `),
      prisma.$queryRawUnsafe(`
        SELECT g.id, g."referenceNo", g."poId", g."receivedDate", g.status, g."transporterName", g."vehicleNumber", g."lrNumber", g."createdAt", g."updatedAt",
               p."referenceNo" as "poReferenceNo", p.name as "materialName"
        FROM "GRNReceive" g
        LEFT JOIN "RawMaterialPO" p ON g."poId" = p.id
      `),
      prisma.$queryRawUnsafe(`
        SELECT t.id, t."grnId", t."overallDecision", t.status, t."createdAt", t."updatedAt", t."testedBy",
               g."referenceNo" as "grnReferenceNo", p."referenceNo" as "poReferenceNo"
        FROM "GRNLabTest" t
        LEFT JOIN "GRNReceive" g ON t."grnId" = g.id
        LEFT JOIN "RawMaterialPO" p ON g."poId" = p.id
      `),
      prisma.$queryRawUnsafe(`
        SELECT t.id, t.production_batch_id, t.result, t.action, t.created_at,
               b.reference_no as "batchReferenceNo"
        FROM "lab_production_test" t
        LEFT JOIN "production_batches" b ON t.production_batch_id = b.id
      `),
      prisma.$queryRawUnsafe(`
        SELECT id, reference_no, type, status, delivery_date, created_at, updated_at, grand_total, delivery_address
        FROM "customer_orders"
        WHERE deleted_at IS NULL
      `),
      prisma.$queryRawUnsafe(`
        SELECT id, reference_no, batch_no, status, start_date, complete_date, created_at, updated_at, quantity
        FROM "production_batches"
        WHERE deleted_at IS NULL
      `)
    ]);

    const syncEvents = [];

    // 1. Purchase Orders - Delivery Due
    pos.forEach(po => {
      if (po.expectedDelivery) {
        const d = new Date(po.expectedDelivery);
        syncEvents.push({
          id: `erp-po-due-${po.id}`,
          title: `📦 PO Delivery Due: ${po.referenceNo || 'PO'} • ${po.name || 'Raw Materials'}`,
          date: d.toISOString().split('T')[0],
          time: d.toTimeString().slice(0, 5) || '09:00',
          module: 'supply',
          status: po.status === 'APPROVED' ? 'Scheduled' : 'Delayed',
          priority: 'Medium',
          referenceNo: po.referenceNo,
          movementType: 'PO ETA (Inbound)',
          workOrderNo: null,
          routingStage: null,
          setupTimeMinutes: 0,
          runTimeMinutes: 0,
          carrier: null,
          dockLocation: null,
          note: `Purchase Order ${po.referenceNo} for ${po.name}. Status: ${po.status}. Amount: ₹${po.grand_total || 0}`
        });
      }
    });

    // 2. GRN Material Receipts (PO Received - Today or on received date)
    grns.forEach(grn => {
      if (grn.receivedDate || grn.createdAt) {
        const d = new Date(grn.receivedDate || grn.createdAt);
        const poRef = grn.poReferenceNo || 'PO';
        syncEvents.push({
          id: `erp-grn-recv-${grn.id}`,
          title: `📥 PO Received: ${grn.referenceNo} (PO: ${poRef})`,
          date: d.toISOString().split('T')[0],
          time: d.toTimeString().slice(0, 5) || '10:00',
          module: 'supply',
          status: 'Completed',
          priority: 'Medium',
          referenceNo: poRef,
          carrier: grn.transporterName || null,
          dockLocation: grn.vehicleNumber || null,
          movementType: 'PO ETA (Inbound)',
          workOrderNo: null,
          routingStage: null,
          setupTimeMinutes: 0,
          runTimeMinutes: 0,
          note: `GRN Receipt ${grn.referenceNo} for PO ${poRef}. Received: ${d.toISOString().split('T')[0]}. Transporter: ${grn.transporterName || 'N/A'}, Vehicle: ${grn.vehicleNumber || 'N/A'}`
        });
      }
    });

    // 3. Raw Material Lab QC Tests
    rmTests.forEach(t => {
      if (t.createdAt) {
        const d = new Date(t.createdAt);
        const grnRef = t.grnReferenceNo || 'GRN';
        syncEvents.push({
          id: `erp-lab-rm-${t.id}`,
          title: `🧪 RM Lab QC: ${grnRef} • ${t.overallDecision || 'Approved'}`,
          date: d.toISOString().split('T')[0],
          time: d.toTimeString().slice(0, 5) || '11:00',
          module: 'production',
          status: t.overallDecision === 'APPROVED' ? 'Completed' : 'Delayed',
          priority: t.overallDecision === 'APPROVED' ? 'Low' : 'High',
          referenceNo: t.poReferenceNo || grnRef,
          workOrderNo: null,
          routingStage: 'Quality Check',
          setupTimeMinutes: 15,
          runTimeMinutes: 45,
          carrier: null,
          dockLocation: null,
          movementType: null,
          note: `Raw Material QC for GRN ${grnRef} (PO: ${t.poReferenceNo || 'N/A'}). Overall Decision: ${t.overallDecision}. Inspector: ${t.testedBy || 'Lab Analyst'}`
        });
      }
    });

    // 4. Production Lab QC Tests
    prodTests.forEach(t => {
      if (t.created_at) {
        const d = new Date(t.created_at);
        const batchRef = t.batchReferenceNo || 'Batch';
        syncEvents.push({
          id: `erp-lab-prod-${t.id}`,
          title: `🧪 Production Lab QC: ${batchRef} • ${t.result || 'Pass'}`,
          date: d.toISOString().split('T')[0],
          time: d.toTimeString().slice(0, 5) || '14:00',
          module: 'production',
          status: t.result === 'Pass' ? 'Completed' : 'Delayed',
          priority: 'Medium',
          workOrderNo: batchRef,
          referenceNo: batchRef,
          routingStage: 'Quality Check',
          setupTimeMinutes: 15,
          runTimeMinutes: 60,
          carrier: null,
          dockLocation: null,
          movementType: null,
          note: `Finished Product QC for batch ${batchRef}. Result: ${t.result}, Action: ${t.action}`
        });
      }
    });

    // 5. Customer Orders - Booked & Delivery
    orders.forEach(co => {
      if (co.created_at) {
        const d = new Date(co.created_at);
        syncEvents.push({
          id: `erp-so-book-${co.id}`,
          title: `📑 Order Booked: ${co.reference_no} (${co.type || 'Order'})`,
          date: d.toISOString().split('T')[0],
          time: d.toTimeString().slice(0, 5) || '09:30',
          module: 'supply',
          status: 'Scheduled',
          priority: 'Medium',
          referenceNo: co.reference_no,
          workOrderNo: null,
          routingStage: null,
          setupTimeMinutes: 0,
          runTimeMinutes: 0,
          carrier: null,
          dockLocation: null,
          movementType: 'SO Outbound Dispatch',
          note: `Customer order ${co.reference_no} (${co.type}). Grand Total: ₹${co.grand_total || 0}`
        });
      }
      if (co.delivery_date) {
        const d = new Date(co.delivery_date);
        syncEvents.push({
          id: `erp-so-due-${co.id}`,
          title: `🚚 Delivery Due: ${co.reference_no}`,
          date: d.toISOString().split('T')[0],
          time: '15:00',
          module: 'supply',
          status: co.status === 'Confirmed' ? 'Scheduled' : 'Delayed',
          priority: 'High',
          referenceNo: co.reference_no,
          workOrderNo: null,
          routingStage: null,
          setupTimeMinutes: 0,
          runTimeMinutes: 0,
          carrier: null,
          dockLocation: null,
          movementType: 'SO Outbound Dispatch',
          note: `Delivery promised to customer for Order ${co.reference_no}. Address: ${co.delivery_address || 'Customer site'}`
        });
      }
    });

    // 6. Production Batches - Start & Complete
    batches.forEach(pb => {
      if (pb.start_date) {
        const d = new Date(pb.start_date);
        syncEvents.push({
          id: `erp-batch-start-${pb.id}`,
          title: `⚙️ Work Order Started: ${pb.reference_no}`,
          date: d.toISOString().split('T')[0],
          time: d.toTimeString().slice(0, 5) || '08:00',
          module: 'production',
          status: 'In-Progress',
          priority: 'Medium',
          workOrderNo: pb.reference_no,
          referenceNo: null,
          routingStage: 'Machining',
          setupTimeMinutes: 45,
          runTimeMinutes: 180,
          carrier: null,
          dockLocation: null,
          movementType: null,
          note: `Production batch ${pb.reference_no} started. Planned quantity: ${pb.quantity || 0}`
        });
      }
      if (pb.complete_date) {
        const d = new Date(pb.complete_date);
        syncEvents.push({
          id: `erp-batch-end-${pb.id}`,
          title: `🏁 Work Order Completed: ${pb.reference_no}`,
          date: d.toISOString().split('T')[0],
          time: d.toTimeString().slice(0, 5) || '17:00',
          module: 'production',
          status: 'Completed',
          priority: 'Medium',
          workOrderNo: pb.reference_no,
          referenceNo: null,
          routingStage: 'Assembly',
          setupTimeMinutes: 30,
          runTimeMinutes: 120,
          carrier: null,
          dockLocation: null,
          movementType: null,
          note: `Production batch ${pb.reference_no} completed. Status: ${pb.status}`
        });
      }
    });

    // Upsert into OperationsCalendarEvent in PostgreSQL
    for (const ev of syncEvents) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "OperationsCalendarEvent" (
          id, title, date, time, priority, note, notified, "createdBy", "creatorName", "creatorRole", "allowedRoles",
          module, status, "workOrderNo", "routingStage", "setupTimeMinutes", "runTimeMinutes", "downtimeBlock",
          "referenceNo", "movementType", carrier, "dockLocation",
          "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, false, 'system-erp-sync', 'ERP Live Engine', 'SYSTEM', '["ALL"]'::jsonb,
          $7, $8, $9, $10, $11, $12, null,
          $13, $14, $15, $16,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          date = EXCLUDED.date,
          time = EXCLUDED.time,
          status = EXCLUDED.status,
          priority = EXCLUDED.priority,
          "workOrderNo" = EXCLUDED."workOrderNo",
          "routingStage" = EXCLUDED."routingStage",
          "referenceNo" = EXCLUDED."referenceNo",
          "movementType" = EXCLUDED."movementType",
          carrier = EXCLUDED.carrier,
          "dockLocation" = EXCLUDED."dockLocation",
          "updatedAt" = CURRENT_TIMESTAMP
      `,
        ev.id, ev.title, ev.date, ev.time, ev.priority, ev.note,
        ev.module, ev.status, ev.workOrderNo, ev.routingStage, ev.setupTimeMinutes || 0, ev.runTimeMinutes || 0,
        ev.referenceNo, ev.movementType, ev.carrier, ev.dockLocation
      );
    }

    return { success: true, count: syncEvents.length };
  } catch (err) {
    console.error('Error in syncLiveERPEventsToCalendar:', err);
    return { success: false, error: err.message };
  }
}

module.exports = {
  syncLiveERPEventsToCalendar
};
