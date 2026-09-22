const express = require('express');
const prisma = require('../../database/prisma');
const authenticateToken = require('../../middlewares/auth.middleware');
const forecastingController = require('./forecasting.controller');

const router = express.Router();

const { extractERPPayload } = require('./forecastDataExtractor');
const forecastAIService = require('./forecastAIService');
const { getLiveHolidays } = require('./liveHolidayService');

// GET /api/forecasting/comprehensive - Multi-Domain Predictive Forecasting
router.get('/comprehensive', authenticateToken, (req, res, next) => {
  forecastingController.getComprehensiveForecast(req, res, next);
});

// POST /api/forecasting/what-if - Dynamic Scenario Simulation
router.post('/what-if', authenticateToken, (req, res, next) => {
  forecastingController.simulateWhatIf(req, res, next);
});

// GET /api/forecasting/payload - Extract live Section 3 Payload from PostgreSQL
router.get('/payload', authenticateToken, async (req, res, next) => {
  try {
    const payload = await extractERPPayload(req.query);
    res.json({ success: true, payload });
  } catch (err) {
    next(err);
  }
});

// POST /api/forecasting/ai-predict - Execute Master Prompt via AI or Quantitative Engine
router.post('/ai-predict', authenticateToken, async (req, res, next) => {
  try {
    let payload = req.body?.payload;
    if (!payload) {
      payload = await extractERPPayload(req.body);
    }
    const result = await forecastAIService.runForecastingPrompt(payload, {
      apiKey: req.body?.apiKey || req.headers['x-gemini-key'] || process.env.GEMINI_API_KEY,
      horizonDays: req.body?.horizonDays || 30
    });
    res.json({ success: true, result });
  } catch (err) {
    next(err);
  }
});

// GET /api/forecasting/prompt - Return exact Master System Prompt
router.get('/prompt', authenticateToken, (req, res) => {
  res.json({
    success: true,
    prompt: forecastAIService.getMasterPrompt()
  });
});

// ============================================================================
// CALENDAR EVENTS & HOLIDAYS (PostgreSQL Database Persisted)
// ============================================================================

// GET /api/forecasting/calendar/events - Fetch events from PostgreSQL filtered by user role visibility
router.get('/calendar/events', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    const allEvents = await prisma.$queryRawUnsafe(
      `SELECT * FROM "OperationsCalendarEvent" ORDER BY date ASC, time ASC`
    );

    // Visibility filtering:
    const filteredEvents = allEvents.filter(ev => {
      if (!userRole || userRole === 'MAIN_MASTER' || userRole === 'ADMIN') return true;
      if (ev.createdBy === userId) return true;
      
      let roles = ev.allowedRoles;
      if (typeof roles === 'string') {
        try { roles = JSON.parse(roles); } catch { roles = ['ALL']; }
      }
      if (!Array.isArray(roles) || roles.length === 0 || roles.includes('ALL')) return true;
      return roles.includes(userRole);
    });

    res.json({ success: true, events: filteredEvents });
  } catch (err) {
    next(err);
  }
});

// POST /api/forecasting/calendar/events - Add event with all 4 ERP module relational fields
router.post('/calendar/events', authenticateToken, async (req, res, next) => {
  try {
    const {
      id, title, date, time, priority, note, allowedRoles,
      module = 'production',
      status = 'Scheduled',
      workOrderNo = null,
      routingStage = null,
      setupTimeMinutes = 0,
      runTimeMinutes = 0,
      downtimeBlock = null,
      resourceId = null,
      resourceType = null,
      capacityLimit = null,
      workingHours = null,
      shiftException = null,
      taskName = null,
      taskDependency = null,
      milestone = 'No',
      assignedTeam = null,
      referenceNo = null,
      movementType = null,
      carrier = null,
      dockLocation = null
    } = req.body;

    const eventId = id || `ue-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const eventTitle = title || 'Scheduled Event';
    const eventDate = date;
    const eventTime = time || null;
    const eventPriority = priority || 'Medium';
    const eventNote = note || '';
    const userId = req.user?.id || 'system';
    const creatorName = req.user?.name || req.user?.email || 'System User';
    const creatorRole = req.user?.role || 'SUPERVISOR';
    const rolesList = Array.isArray(allowedRoles) && allowedRoles.length > 0 ? allowedRoles : ['ALL'];
    const rolesJson = JSON.stringify(rolesList);

    await prisma.$executeRawUnsafe(
      `INSERT INTO "OperationsCalendarEvent" (
        id, title, date, time, priority, note, notified, "createdBy", "creatorName", "creatorRole", "allowedRoles",
        module, status,
        "workOrderNo", "routingStage", "setupTimeMinutes", "runTimeMinutes", "downtimeBlock",
        "resourceId", "resourceType", "capacityLimit", "workingHours", "shiftException",
        "taskName", "taskDependency", milestone, "assignedTeam",
        "referenceNo", "movementType", carrier, "dockLocation",
        "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, false, $7, $8, $9, $10::jsonb,
        $11, $12,
        $13, $14, $15, $16, $17,
        $18, $19, $20, $21, $22,
        $23, $24, $25, $26,
        $27, $28, $29, $30,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      ON CONFLICT (id) DO UPDATE SET 
        title = $2, date = $3, time = $4, priority = $5, note = $6, 
        "creatorName" = $8, "creatorRole" = $9, "allowedRoles" = $10::jsonb,
        module = $11, status = $12,
        "workOrderNo" = $13, "routingStage" = $14, "setupTimeMinutes" = $15, "runTimeMinutes" = $16, "downtimeBlock" = $17,
        "resourceId" = $18, "resourceType" = $19, "capacityLimit" = $20, "workingHours" = $21, "shiftException" = $22,
        "taskName" = $23, "taskDependency" = $24, milestone = $25, "assignedTeam" = $26,
        "referenceNo" = $27, "movementType" = $28, carrier = $29, "dockLocation" = $30,
        "updatedAt" = CURRENT_TIMESTAMP`,
      eventId, eventTitle, eventDate, eventTime, eventPriority, eventNote, userId, creatorName, creatorRole, rolesJson,
      module, status,
      workOrderNo, routingStage, Number(setupTimeMinutes) || 0, Number(runTimeMinutes) || 0, downtimeBlock,
      resourceId, resourceType, capacityLimit, workingHours, shiftException,
      taskName, taskDependency, milestone, assignedTeam,
      referenceNo, movementType, carrier, dockLocation
    );

    const rows = await prisma.$queryRawUnsafe(`SELECT * FROM "OperationsCalendarEvent" WHERE id = $1`, eventId);

    res.json({
      success: true,
      event: rows[0]
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/forecasting/calendar/events/:id - Update all relational fields in PostgreSQL
router.put('/calendar/events/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      title, date, time, priority, note, allowedRoles,
      module = 'production',
      status = 'Scheduled',
      workOrderNo = null,
      routingStage = null,
      setupTimeMinutes = 0,
      runTimeMinutes = 0,
      downtimeBlock = null,
      resourceId = null,
      resourceType = null,
      capacityLimit = null,
      workingHours = null,
      shiftException = null,
      taskName = null,
      taskDependency = null,
      milestone = 'No',
      assignedTeam = null,
      referenceNo = null,
      movementType = null,
      carrier = null,
      dockLocation = null
    } = req.body;

    const rolesList = Array.isArray(allowedRoles) && allowedRoles.length > 0 ? allowedRoles : ['ALL'];
    const rolesJson = JSON.stringify(rolesList);

    await prisma.$executeRawUnsafe(
      `UPDATE "OperationsCalendarEvent"
       SET title = $1, date = $2, time = $3, priority = $4, note = $5, "allowedRoles" = $6::jsonb,
           module = $7, status = $8,
           "workOrderNo" = $9, "routingStage" = $10, "setupTimeMinutes" = $11, "runTimeMinutes" = $12, "downtimeBlock" = $13,
           "resourceId" = $14, "resourceType" = $15, "capacityLimit" = $16, "workingHours" = $17, "shiftException" = $18,
           "taskName" = $19, "taskDependency" = $20, milestone = $21, "assignedTeam" = $22,
           "referenceNo" = $23, "movementType" = $24, carrier = $25, "dockLocation" = $26,
           notified = false, "updatedAt" = CURRENT_TIMESTAMP
       WHERE id = $27`,
      title, date, time || null, priority || 'Medium', note || '', rolesJson,
      module, status,
      workOrderNo, routingStage, Number(setupTimeMinutes) || 0, Number(runTimeMinutes) || 0, downtimeBlock,
      resourceId, resourceType, capacityLimit, workingHours, shiftException,
      taskName, taskDependency, milestone, assignedTeam,
      referenceNo, movementType, carrier, dockLocation,
      id
    );

    res.json({ success: true, message: 'Event updated successfully' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/forecasting/calendar/events/:id - Remove event from PostgreSQL
router.delete('/calendar/events/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.$executeRawUnsafe('DELETE FROM "OperationsCalendarEvent" WHERE id = $1', id);
    res.json({ success: true, message: 'Event deleted successfully' });
  } catch (err) {
    next(err);
  }
});

// POST /api/forecasting/calendar/cascade-reschedule - Shift event and optionally cascade downstream dependent operations
router.post('/calendar/cascade-reschedule', authenticateToken, async (req, res, next) => {
  try {
    const { eventId, targetDate, cascadeDownstream = false } = req.body;
    if (!eventId || !targetDate) {
      return res.status(400).json({ success: false, message: 'eventId and targetDate are required' });
    }

    const currentRows = await prisma.$queryRawUnsafe(
      `SELECT * FROM "OperationsCalendarEvent" WHERE id = $1`,
      eventId
    );
    if (!currentRows || currentRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Event not found in database' });
    }

    const currentEvent = currentRows[0];
    const oldDateStr = currentEvent.date;
    const oldDate = new Date(oldDateStr + 'T00:00:00');
    const newDate = new Date(targetDate + 'T00:00:00');
    const diffDays = Math.round((newDate.getTime() - oldDate.getTime()) / (1000 * 60 * 60 * 24));

    // Update the parent event
    await prisma.$executeRawUnsafe(
      `UPDATE "OperationsCalendarEvent" SET date = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2`,
      targetDate,
      eventId
    );

    let cascadedCount = 0;
    const cascadedEvents = [];

    if (cascadeDownstream && diffDays !== 0) {
      const wo = currentEvent.workOrderNo;
      const tName = currentEvent.taskName || currentEvent.title;

      let dependentRows = [];
      if (wo) {
        dependentRows = await prisma.$queryRawUnsafe(
          `SELECT * FROM "OperationsCalendarEvent" 
           WHERE id != $1 AND ("workOrderNo" = $2 OR "taskDependency" ILIKE $3 OR "taskDependency" ILIKE $4)
           AND date >= $5`,
          eventId, wo, `%${wo}%`, `%${tName}%`, oldDateStr
        );
      } else {
        dependentRows = await prisma.$queryRawUnsafe(
          `SELECT * FROM "OperationsCalendarEvent" 
           WHERE id != $1 AND ("taskDependency" ILIKE $2)
           AND date >= $3`,
          eventId, `%${tName}%`, oldDateStr
        );
      }

      for (const dep of dependentRows) {
        const depOldDate = new Date(dep.date + 'T00:00:00');
        const depNewDate = new Date(depOldDate.getTime() + diffDays * 24 * 60 * 60 * 1000);
        const depNewDateStr = depNewDate.toISOString().split('T')[0];

        await prisma.$executeRawUnsafe(
          `UPDATE "OperationsCalendarEvent" SET date = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2`,
          depNewDateStr,
          dep.id
        );
        cascadedCount++;
        cascadedEvents.push({ id: dep.id, title: dep.title, oldDate: dep.date, newDate: depNewDateStr });
      }
    }

    res.json({
      success: true,
      message: `Rescheduled successfully${cascadedCount > 0 ? ` with ${cascadedCount} downstream operations shifted` : ''}`,
      cascadedCount,
      cascadedEvents
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/forecasting/calendar/check-conflicts - Pre-save validation for machine/operator capacity & double-booking
router.post('/calendar/check-conflicts', authenticateToken, async (req, res, next) => {
  try {
    const { eventId, date, resourceId, setupTimeMinutes = 0, runTimeMinutes = 0, routingStage } = req.body;
    if (!date) {
      return res.json({ hasConflict: false, conflicts: [] });
    }

    const proposedMins = (Number(setupTimeMinutes) || 0) + (Number(runTimeMinutes) || 0);
    const conflicts = [];

    // Check by resourceId if provided
    if (resourceId && resourceId.trim()) {
      const existingResourceEvents = await prisma.$queryRawUnsafe(
        `SELECT id, title, "workOrderNo", "routingStage", "setupTimeMinutes", "runTimeMinutes", time 
         FROM "OperationsCalendarEvent" 
         WHERE date = $1 AND "resourceId" = $2 AND ($3::text IS NULL OR id != $3)`,
        date, resourceId.trim(), eventId || null
      );

      let totalMins = proposedMins;
      existingResourceEvents.forEach(e => {
        totalMins += (Number(e.setupTimeMinutes) || 0) + (Number(e.runTimeMinutes) || 0);
      });

      const maxShiftMins = 480; // 8-hour operational shift
      if (totalMins > maxShiftMins) {
        conflicts.push({
          type: 'OVER_ALLOCATION',
          resourceId: resourceId.trim(),
          totalMinutes: totalMins,
          capacityLimitMinutes: maxShiftMins,
          overMinutes: totalMins - maxShiftMins,
          message: `Resource "${resourceId}" would exceed 8h shift capacity (${totalMins}m scheduled vs 480m limit) on ${date}.`,
          competingEvents: existingResourceEvents
        });
      } else if (existingResourceEvents.length > 0) {
        conflicts.push({
          type: 'RESOURCE_CO_BOOKED',
          resourceId: resourceId.trim(),
          totalMinutes: totalMins,
          message: `Resource "${resourceId}" has ${existingResourceEvents.length} other job(s) scheduled on ${date}.`,
          competingEvents: existingResourceEvents
        });
      }
    }

    // Check routing stage bottleneck on that date
    if (routingStage && routingStage !== 'General') {
      const stageEvents = await prisma.$queryRawUnsafe(
        `SELECT count(*)::int as count, sum("setupTimeMinutes" + "runTimeMinutes")::int as "totalStageMinutes"
         FROM "OperationsCalendarEvent"
         WHERE date = $1 AND "routingStage" = $2 AND ($3::text IS NULL OR id != $3)`,
        date, routingStage, eventId || null
      );

      const stageCount = (stageEvents[0]?.count || 0) + 1;
      const stageMins = (stageEvents[0]?.totalStageMinutes || 0) + proposedMins;

      if (stageMins > 720) {
        conflicts.push({
          type: 'STAGE_BOTTLENECK',
          routingStage,
          stageCount,
          totalStageMinutes: stageMins,
          message: `Routing stage "${routingStage}" queue is heavily loaded (${stageMins} mins across ${stageCount} jobs) on ${date}.`
        });
      }
    }

    res.json({
      success: true,
      hasConflict: conflicts.length > 0,
      conflicts
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/forecasting/calendar/commit-scenario - Bulk commit a What-If scenario sandbox to PostgreSQL
router.post('/calendar/commit-scenario', authenticateToken, async (req, res, next) => {
  try {
    const { scenarioEvents = [] } = req.body;
    if (!Array.isArray(scenarioEvents) || scenarioEvents.length === 0) {
      return res.status(400).json({ success: false, message: 'No scenario events provided' });
    }

    let updatedCount = 0;
    for (const ev of scenarioEvents) {
      if (!ev.id || !ev.title || !ev.date) continue;

      const rolesJson = JSON.stringify(ev.allowedRoles || ['ALL']);
      await prisma.$executeRawUnsafe(
        `INSERT INTO "OperationsCalendarEvent" (
          id, title, date, time, priority, note, notified, "createdBy", "creatorName", "creatorRole", "allowedRoles",
          module, status,
          "workOrderNo", "routingStage", "setupTimeMinutes", "runTimeMinutes", "downtimeBlock",
          "resourceId", "resourceType", "capacityLimit", "workingHours", "shiftException",
          "taskName", "taskDependency", milestone, "assignedTeam",
          "referenceNo", "movementType", carrier, "dockLocation",
          "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, false, $7, $8, $9, $10::jsonb,
          $11, $12,
          $13, $14, $15, $16, $17,
          $18, $19, $20, $21, $22,
          $23, $24, $25, $26,
          $27, $28, $29, $30,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT (id) DO UPDATE SET 
          title = $2, date = $3, time = $4, priority = $5, note = $6, 
          module = $11, status = $12,
          "workOrderNo" = $13, "routingStage" = $14, "setupTimeMinutes" = $15, "runTimeMinutes" = $16, "downtimeBlock" = $17,
          "resourceId" = $18, "resourceType" = $19, "capacityLimit" = $20, "workingHours" = $21, "shiftException" = $22,
          "taskName" = $23, "taskDependency" = $24, milestone = $25, "assignedTeam" = $26,
          "referenceNo" = $27, "movementType" = $28, carrier = $29, "dockLocation" = $30,
          "updatedAt" = CURRENT_TIMESTAMP`,
        ev.id, ev.title, ev.date, ev.time || null, ev.priority || 'Medium', ev.note || '',
        req.user?.id || 'system', req.user?.name || 'Planner', req.user?.role || 'PLANNER', rolesJson,
        ev.module || 'production', ev.status || 'Scheduled',
        ev.workOrderNo || null, ev.routingStage || null, Number(ev.setupTimeMinutes) || 0, Number(ev.runTimeMinutes) || 0, ev.downtimeBlock || null,
        ev.resourceId || null, ev.resourceType || null, ev.capacityLimit || null, ev.workingHours || null, ev.shiftException || null,
        ev.taskName || null, ev.taskDependency || null, ev.milestone || 'No', ev.assignedTeam || null,
        ev.referenceNo || null, ev.movementType || null, ev.carrier || null, ev.dockLocation || null
      );
      updatedCount++;
    }

    res.json({
      success: true,
      message: `Scenario successfully committed: ${updatedCount} operational event(s) synchronized to database.`,
      count: updatedCount
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/forecasting/calendar/export-ics - Export live operations calendar to RFC 5545 iCalendar
router.get('/calendar/export-ics', async (req, res, next) => {
  try {
    const events = await prisma.$queryRawUnsafe(
      `SELECT * FROM "OperationsCalendarEvent" ORDER BY date ASC`
    );

    let ics = 'BEGIN:VCALENDAR\r\n';
    ics += 'VERSION:2.0\r\n';
    ics += 'PRODID:-//Manufacturing ERP//Operations Calendar//EN\r\n';
    ics += 'CALSCALE:GREGORIAN\r\n';
    ics += 'METHOD:PUBLISH\r\n';
    ics += 'X-WR-CALNAME:ERP Operations Schedule\r\n';

    const nowStr = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    events.forEach(ev => {
      const cleanDate = (ev.date || '').replace(/-/g, '');
      const uid = (ev.id || 'evt') + '@erp.operations';
      const summary = (ev.title || 'ERP Event').replace(/[\\;,]/g, ' ');
      const desc = `Module: ${ev.module || 'Operations'}\\nStatus: ${ev.status || 'Scheduled'}\\nWork Order: ${ev.workOrderNo || 'N/A'}\\nStage: ${ev.routingStage || 'N/A'}\\nNotes: ${(ev.note || '').replace(/\n/g, ' ')}`;

      ics += 'BEGIN:VEVENT\r\n';
      ics += `UID:${uid}\r\n`;
      ics += `DTSTAMP:${nowStr}\r\n`;
      ics += `DTSTART;VALUE=DATE:${cleanDate}\r\n`;
      ics += `DTEND;VALUE=DATE:${cleanDate}\r\n`;
      ics += `SUMMARY:${summary}\r\n`;
      ics += `DESCRIPTION:${desc}\r\n`;
      ics += `STATUS:CONFIRMED\r\n`;
      ics += 'END:VEVENT\r\n';
    });

    ics += 'END:VCALENDAR\r\n';

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="erp-operations-schedule.ics"');
    res.send(ics);
  } catch (err) {
    next(err);
  }
});

// GET /api/forecasting/calendar/holidays - Live Official Gazette Holidays from Real-Time Public Feeds
router.get('/calendar/holidays', async (req, res, next) => {
  try {
    const year = parseInt(req.query.year, 10) || 2026;
    const forceRefresh = req.query.refresh === 'true';
    const result = await getLiveHolidays(year, forceRefresh);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Helper to compute current stock for a product, taking openingStock into account
const getProductStock = async (productId) => {
  const product = await prisma.finishedProduct.findUnique({
    where: { id: productId }
  });
  if (!product) return 0;

  const sumIn = await prisma.productStockMovement.aggregate({
    where: { productId, direction: 1 },
    _sum: { quantity: true }
  });
  const sumOut = await prisma.productStockMovement.aggregate({
    where: { productId, direction: -1 },
    _sum: { quantity: true }
  });

  return Number(product.openingStock || 0) + Number(sumIn._sum.quantity || 0) - Number(sumOut._sum.quantity || 0);
};

// GET /api/forecasting/by-order - Forecast by Order (analyzing materials & times)
router.get('/by-order', authenticateToken, async (req, res, next) => {
  try {
    // Get all undelivered orders
    const orders = await prisma.customerOrder.findMany({
      where: {
        status: { notIn: ['Delivered', 'Cancelled'] },
        deletedAt: null
      },
      include: {
        customer: true,
        items: {
          include: {
            product: {
              include: {
                unit: true,
                bom: {
                  include: {
                    rawMaterial: {
                      include: {
                        uoms: true
                      }
                    }
                  }
                },
                stages: true
              }
            }
          }
        }
      },
      orderBy: { deliveryDate: 'asc' }
    });

    const result = [];

    for (const order of orders) {
      const materialsMap = {};
      let overallStatus = 'Ready';
      let maxDurationMinutes = 0;

      // 1. Evaluate material requirements and production time per item
      for (const item of order.items) {
        const prod = item.product;
        const qtyOrdered = Number(item.quantity);
        const currentProductStock = await getProductStock(prod.id);
        const productShortfall = Math.max(0, qtyOrdered - currentProductStock);

        // Calculate lead time for shortfall
        if (productShortfall > 0) {
          overallStatus = 'Shortage';

          // Accumulate raw material requirements
          for (const bomItem of prod.bom) {
            const rm = bomItem.rawMaterial;
            const requiredQty = Number(bomItem.consumptionPerUnit) * productShortfall;
            const rmId = rm.id;

            if (!materialsMap[rmId]) {
              materialsMap[rmId] = {
                name: rm.name,
                unit: rm.uoms?.[0]?.abbreviation || 'units',
                requiredQty: 0,
                availableStock: Number(rm.currentStock || 0)
              };
            }
            materialsMap[rmId].requiredQty += requiredQty;
          }

          // Calculate stage times in minutes
          let productMinutes = 0;
          prod.stages.forEach(st => {
            productMinutes += Number(st.months || 0) * 30 * 24 * 60;
            productMinutes += Number(st.days || 0) * 24 * 60;
            productMinutes += Number(st.hours || 0) * 60;
            productMinutes += Number(st.minutes || 0);
          });

          // Scale by quantity logarithmically
          const durationForQty = productMinutes * (1 + Math.log10(productShortfall));
          if (durationForQty > maxDurationMinutes) {
            maxDurationMinutes = durationForQty;
          }
        }
      }

      // Convert materials map to sorted array
      const materials = Object.keys(materialsMap).map(id => {
        const m = materialsMap[id];
        const sufficient = m.availableStock >= m.requiredQty;
        const deficit = sufficient ? 0 : m.requiredQty - m.availableStock;
        if (!sufficient) {
          overallStatus = 'Shortage';
        }
        return {
          name: m.name,
          unit: m.unit,
          requiredQty: m.requiredQty,
          availableStock: m.availableStock,
          sufficient,
          deficit
        };
      });

      const leadTimeHours = Math.ceil(maxDurationMinutes / 60);

      result.push({
        orderId: order.id,
        referenceNo: order.referenceNo,
        customerName: order.customer?.name || 'N/A',
        deliveryDate: order.deliveryDate,
        totalSubtotal: Number(order.totalSubtotal || 0),
        overallStatus,
        materials,
        timeline: {
          leadTimeHours: leadTimeHours > 0 ? leadTimeHours : 24 // default minimum feasibility
        }
      });
    }

    // 2. Aggregate demand per product for undelivered orders
    const products = await prisma.finishedProduct.findMany({
      where: { deletedAt: null },
      include: {
        stockLevels: true
      }
    });

    const analysisData = [];
    for (const prod of products) {
      // Find all undelivered items for this product
      const orderItems = await prisma.customerOrderItem.findMany({
        where: {
          productId: prod.id,
          order: {
            status: { notIn: ['Delivered', 'Cancelled'] },
            deletedAt: null
          }
        },
        include: {
          order: true
        }
      });

      const pendingOrdersCount = orderItems.length;
      const orderQtyNeeded = orderItems.reduce((sum, item) => sum + Number(item.quantity), 0);
      const currentStock = await getProductStock(prod.id);
      
      const stockLevel = prod.stockLevels[0] || null;
      const minLevel = stockLevel ? Number(stockLevel.minLevel) : 0;
      
      const shortage = currentStock - orderQtyNeeded;
      const needToProduce = Math.max(0, orderQtyNeeded - currentStock) + minLevel;
      
      // Keep track of the first order containing this product to pre-fill orderId if they click "+ Produce"
      const oldestOrder = orderItems.length > 0 ? orderItems[0].order : null;

      analysisData.push({
        productId: prod.id,
        productCode: prod.code,
        productName: prod.name,
        pendingOrdersCount,
        orderQtyNeeded,
        currentStock,
        minLevel,
        shortage,
        needToProduce,
        orderId: oldestOrder ? oldestOrder.id : null
      });
    }

    res.json({
      orders: result,
      analysis: analysisData
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/forecasting/by-product - Forecast by Product (Grouped)
router.get('/by-product', authenticateToken, async (req, res, next) => {
  try {
    // 1. Get all undelivered items grouped by product
    const orders = await prisma.customerOrder.findMany({
      where: {
        status: { notIn: ['Delivered', 'Cancelled'] },
        deletedAt: null
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                unit: true
              }
            }
          }
        }
      }
    });

    const productMap = {};

    for (const order of orders) {
      for (const item of order.items) {
        const prod = item.product;
        if (!productMap[prod.id]) {
          const currentStock = await getProductStock(prod.id);
          productMap[prod.id] = {
            productId: prod.id,
            productCode: prod.code,
            productName: prod.name,
            unit: prod.unit?.abbreviation || 'pcs',
            totalDemand: 0,
            currentStock,
            salePrice: Number(prod.salePrice || 0)
          };
        }
        productMap[prod.id].totalDemand += Number(item.quantity);
      }
    }

    const result = [];

    // Analyze each product
    for (const id of Object.keys(productMap)) {
      const item = productMap[id];
      const deficit = Math.max(0, item.totalDemand - item.currentStock);
      const status = deficit === 0 ? 'Sufficient' : 'Shortage';
      const shortfallValue = deficit * item.salePrice;

      result.push({
        productId: item.productId,
        productCode: item.productCode,
        productName: item.productName,
        unit: item.unit,
        currentStock: item.currentStock,
        totalDemand: item.totalDemand,
        status,
        deficit,
        salePrice: item.salePrice,
        shortfallValue
      });
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
