const poService = require('./po.service');
const notificationService = require('../notifications/notifications.service');
const { generateReferenceNo } = require('../../utils/referenceGenerator');
const prisma = require('../../database/prisma');

class POController {
  async getAllPOs(req, res, next) {
    try {
      const pos = await poService.getAllPOs();
      res.json(pos);
    } catch (error) {
      next(error);
    }
  }

  async generateReference(req, res, next) {
    try {
      const candidateId = await generateReferenceNo(prisma, 'RawMaterialPO', 'PO');
      res.json({ candidateId });
    } catch (error) {
      next(error);
    }
  }

  async getPOById(req, res, next) {
    try {
      const po = await poService.getPOById(req.params.id);
      if (!po) return res.status(404).json({ error: 'PO not found' });
      res.json(po);
    } catch (error) {
      next(error);
    }
  }

  async createPO(req, res, next) {
    try {
      const newPO = await poService.createPO(req.body, req.user.id);
      
      const event_at = new Date();
      const event_at_local = event_at.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      const { rmId, name, quantity, amount, expectedDelivery, uom, user, id: po_id } = newPO;
      const formattedAmount = Number(amount).toFixed(2);
      const expected_delivery_date = new Date(expectedDelivery).toLocaleDateString();

      await notificationService.createNotification({
        type: 'PO_CREATED',
        recipient_roles: ['MAIN_MASTER', 'SUPERVISOR', 'MATERIALS_RECEIVER'],
        sender_role: req.user.role,
        sender_id: req.user.id,
        reference_type: 'PO',
        reference_id: po_id,
        event_at,
        message: `📦 New Purchase Order Raised — RM #${rmId} · ${name} · Qty: ${quantity} ${uom.abbreviation} · Amount: ₹${formattedAmount} · Expected Delivery: ${expected_delivery_date} · Raised by ${user.name} at ${event_at_local}`,
        metadata: {
          rm_id: rmId,
          rm_name: name,
          quantity: quantity,
          uom: uom.abbreviation,
          amount: Number(formattedAmount),
          expected_delivery_date,
          po_id
        }
      });

      res.status(201).json(newPO);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new POController();
