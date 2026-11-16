const express = require('express');
const router = express.Router();
const controller = require('./factoryCommandCenter.controller');
const authenticateToken = require('../../middlewares/auth.middleware');

router.use(authenticateToken);

// 1. Overview & KPI Band + Needs Attention
router.get('/overview', controller.getOverview);

// 2. Production
router.get('/production/active-batches', controller.getActiveBatches);

// 3. Procurement & Inbound
router.get('/procurement/pipeline', controller.getPoPipeline);
router.patch('/procurement/approve-po/:id', controller.approvePo);
router.get('/procurement/grn-recent', controller.getGrnRecent);
router.get('/procurement/inflow', controller.getInboundInflow);

// 4. Inventory
router.get('/inventory/rm-health', controller.getRmHealth);
router.get('/inventory/finished-goods', controller.getFinishedGoods);
router.get('/inventory/expiry', controller.getExpiryWatchlist);

// 5. Sales
router.get('/sales/revenue', controller.getSalesRevenue);
router.get('/sales/pipeline', controller.getSalesPipeline);
router.get('/sales/top-skus', controller.getTopSkus);
router.get('/sales/top-customers', controller.getTopCustomers);

// 6. Quality
router.get('/quality/summary', controller.getQualitySummary);
router.get('/quality/cold-room', controller.getColdRoomTemp);

// 7. Finance & Cost
router.get('/finance/cost-per-unit', controller.getCostPerUnit);
router.get('/finance/oee', controller.getOee);
router.get('/finance/scrap', controller.getScrapTrend);

// 8. Activity & Handover
router.get('/activity', controller.getActivity);
router.get('/shift-notes', controller.getShiftNotes);
router.post('/shift-notes', controller.createShiftNote);

module.exports = router;

