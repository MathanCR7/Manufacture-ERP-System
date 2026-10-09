const express = require('express');
const { z } = require('zod');
const crypto = require('crypto');
const prisma = require('../../database/prisma');
const authenticateToken = require('../../middlewares/auth.middleware');
const roleMiddleware = require('../../middlewares/role.middleware');

const router = express.Router();

// Schema for product stock adjustment
const productAdjustmentSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  type: z.enum(['ADDITION', 'SUBTRACTION']),
  quantity: z.coerce.number().positive('Quantity must be greater than 0'),
  notes: z.string().optional()
});

// Helper to get actual current stock of a finished product
async function getProductCurrentStock(tx, productId) {
  const product = await tx.finishedProduct.findFirst({
    where: { id: productId, deletedAt: null },
    include: {
      category: true,
      unit: true,
    }
  });

  if (!product) {
    throw new Error('Finished Product not found');
  }

  // Calculate net stock from movements
  const movements = await tx.$queryRaw`
    SELECT COALESCE(SUM(direction * quantity), 0)::float AS "netMovement"
    FROM product_stock_movements
    WHERE product_id = ${productId}
  `;
  const netMovement = movements && movements[0] ? Number(movements[0].netMovement || 0) : 0;
  const computedStock = Number(product.openingStock || 0) + netMovement;

  return { product, currentStock: computedStock };
}

// POST /api/product-stock-adjustment or /api/products/stock-adjustment
router.post('/', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT', 'PRODUCTION_STAFF']), async (req, res, next) => {
  try {
    const data = productAdjustmentSchema.parse(req.body);
    const adjustmentId = crypto.randomUUID();

    const adjustment = await prisma.$transaction(async (tx) => {
      const { product, currentStock } = await getProductCurrentStock(tx, data.productId);

      let newStock;
      const direction = data.type === 'ADDITION' ? 1 : -1;

      if (data.type === 'ADDITION') {
        newStock = currentStock + data.quantity;
      } else {
        if (data.quantity > currentStock) {
          throw new Error(`Cannot subtract ${data.quantity}. Current stock is only ${currentStock.toFixed(2)}.`);
        }
        newStock = currentStock - data.quantity;
      }

      // 1. Insert into product_stock_adjustments table
      await tx.$executeRaw`
        INSERT INTO product_stock_adjustments (id, product_id, type, quantity, notes, created_by, created_at, updated_at)
        VALUES (${adjustmentId}, ${data.productId}, ${data.type}, ${data.quantity}, ${data.notes || null}, ${req.user.id}, NOW(), NOW())
      `;

      // 2. Insert into product_stock_movements for complete ledger traceability
      await tx.productStockMovement.create({
        data: {
          productId: data.productId,
          type: 'adjustment',
          quantity: data.quantity,
          direction: direction,
          note: data.notes ? `Stock Adjustment: ${data.notes}` : `Stock Adjustment (${data.type})`,
          createdBy: req.user.id
        }
      });

      // 3. Update current_stock in products table
      await tx.$executeRaw`
        UPDATE products 
        SET current_stock = ${newStock}, updated_at = NOW()
        WHERE id = ${data.productId}
      `;

      // 4. Log audit log
      const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
      try {
        await tx.auditLog.create({
          data: {
            userId: req.user.id,
            action: 'CREATED',
            tableName: 'ProductStockAdjustment',
            recordId: adjustmentId,
            oldValue: { currentStock: Number(currentStock) },
            newValue: { currentStock: Number(newStock), type: data.type, quantity: data.quantity },
            ip: clientIp,
          }
        });
      } catch (auditErr) {
        console.warn('Audit log write error:', auditErr.message);
      }

      return {
        id: adjustmentId,
        productId: product.id,
        productCode: product.code,
        productName: product.name,
        type: data.type,
        quantity: data.quantity,
        currentStock: newStock,
        notes: data.notes || null
      };
    });

    res.status(201).json(adjustment);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    if (error.message.includes('Cannot subtract')) return res.status(400).json({ error: error.message });
    if (error.message.includes('not found')) return res.status(404).json({ error: error.message });
    next(error);
  }
});

// GET /api/product-stock-adjustment or /api/products/stock-adjustment
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const rawAdjustments = await prisma.$queryRaw`
      SELECT 
        psa.id,
        psa.product_id AS "productId",
        p.code AS "productCode",
        p.name AS "productName",
        p.sku AS "productSku",
        c.name AS "categoryName",
        COALESCE(u.abbreviation, u.name, 'pcs') AS "unit",
        psa.type,
        psa.quantity::float AS "quantity",
        psa.notes,
        psa.created_at AS "createdAt",
        psa.created_by AS "createdById",
        usr.name AS "createdBy",
        usr.role AS "creatorRole"
      FROM product_stock_adjustments psa
      JOIN products p ON psa.product_id = p.id
      LEFT JOIN "ProductCategory" c ON p.category_id = c.id
      LEFT JOIN "UOM" u ON p.unit_id = u.id
      LEFT JOIN "User" usr ON psa.created_by = usr.id
      WHERE p.deleted_at IS NULL
      ORDER BY psa.created_at DESC
    `;

    res.json(rawAdjustments || []);
  } catch (error) {
    next(error);
  }
});

// PUT /api/product-stock-adjustment/:id
router.put('/:id', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT', 'PRODUCTION_STAFF']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = productAdjustmentSchema.parse(req.body);

    const updated = await prisma.$transaction(async (tx) => {
      // Find existing adjustment
      const existingRows = await tx.$queryRaw`
        SELECT id, product_id AS "productId", type, quantity::float AS "quantity", notes
        FROM product_stock_adjustments
        WHERE id = ${id}
      `;
      const existing = existingRows && existingRows[0] ? existingRows[0] : null;
      if (!existing) {
        throw new Error('Product stock adjustment not found');
      }

      // 1. Revert previous adjustment effect on product stock
      const { product, currentStock } = await getProductCurrentStock(tx, existing.productId);
      let stockAfterRevert = currentStock;
      if (existing.type === 'ADDITION') {
        stockAfterRevert -= Number(existing.quantity);
      } else {
        stockAfterRevert += Number(existing.quantity);
      }

      // Check if product changed
      let targetProduct = product;
      let targetStock = stockAfterRevert;
      if (existing.productId !== data.productId) {
        // Revert old product
        await tx.$executeRaw`
          UPDATE products SET current_stock = ${Math.max(0, stockAfterRevert)}, updated_at = NOW() WHERE id = ${existing.productId}
        `;
        // Load new product
        const newProdInfo = await getProductCurrentStock(tx, data.productId);
        targetProduct = newProdInfo.product;
        targetStock = newProdInfo.currentStock;
      }

      // Calculate final stock with new adjustment
      let finalStock;
      if (data.type === 'ADDITION') {
        finalStock = targetStock + data.quantity;
      } else {
        if (data.quantity > targetStock) {
          throw new Error(`Cannot subtract ${data.quantity}. Available stock after recalculation is only ${targetStock.toFixed(2)}.`);
        }
        finalStock = targetStock - data.quantity;
      }

      // Update adjustment record
      await tx.$executeRaw`
        UPDATE product_stock_adjustments
        SET product_id = ${data.productId}, type = ${data.type}, quantity = ${data.quantity}, notes = ${data.notes || null}, updated_at = NOW()
        WHERE id = ${id}
      `;

      // Update movements - log reversal and new adjustment
      const direction = data.type === 'ADDITION' ? 1 : -1;
      await tx.productStockMovement.create({
        data: {
          productId: data.productId,
          type: 'adjustment',
          quantity: data.quantity,
          direction: direction,
          note: `Adjustment Update (#${id.slice(0, 8)}): ${data.notes || data.type}`,
          createdBy: req.user.id
        }
      });

      // Update products table
      await tx.$executeRaw`
        UPDATE products SET current_stock = ${finalStock}, updated_at = NOW() WHERE id = ${data.productId}
      `;

      return {
        id,
        productId: targetProduct.id,
        productCode: targetProduct.code,
        productName: targetProduct.name,
        type: data.type,
        quantity: data.quantity,
        currentStock: finalStock,
        notes: data.notes || null
      };
    });

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    if (error.message.includes('Cannot subtract')) return res.status(400).json({ error: error.message });
    if (error.message.includes('not found')) return res.status(404).json({ error: error.message });
    next(error);
  }
});

// DELETE /api/product-stock-adjustment/:id
router.delete('/:id', authenticateToken, roleMiddleware(['MAIN_MASTER', 'SUPERVISOR', 'PURCHASE_ACCOUNTANT', 'PRODUCTION_STAFF']), async (req, res, next) => {
  try {
    const { id } = req.params;

    await prisma.$transaction(async (tx) => {
      const existingRows = await tx.$queryRaw`
        SELECT id, product_id AS "productId", type, quantity::float AS "quantity"
        FROM product_stock_adjustments
        WHERE id = ${id}
      `;
      const existing = existingRows && existingRows[0] ? existingRows[0] : null;
      if (!existing) {
        throw new Error('Product stock adjustment not found');
      }

      // Revert stock
      const { currentStock } = await getProductCurrentStock(tx, existing.productId);
      let revertedStock = currentStock;
      const reverseDirection = existing.type === 'ADDITION' ? -1 : 1;

      if (existing.type === 'ADDITION') {
        revertedStock -= Number(existing.quantity);
        if (revertedStock < 0) revertedStock = 0;
      } else {
        revertedStock += Number(existing.quantity);
      }

      // Record reversal movement
      await tx.productStockMovement.create({
        data: {
          productId: existing.productId,
          type: 'adjustment',
          quantity: existing.quantity,
          direction: reverseDirection,
          note: `Reversal of Stock Adjustment #${id.slice(0, 8)}`,
          createdBy: req.user.id
        }
      });

      // Update products current_stock
      await tx.$executeRaw`
        UPDATE products SET current_stock = ${revertedStock}, updated_at = NOW() WHERE id = ${existing.productId}
      `;

      // Delete adjustment row
      await tx.$executeRaw`
        DELETE FROM product_stock_adjustments WHERE id = ${id}
      `;
    });

    res.status(204).send();
  } catch (error) {
    if (error.message.includes('not found')) return res.status(404).json({ error: error.message });
    next(error);
  }
});

module.exports = router;
