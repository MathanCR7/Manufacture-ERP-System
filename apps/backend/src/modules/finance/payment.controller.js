const prisma = require('../../database/prisma');

/**
 * Generate next payment or receipt reference number
 */
async function generatePaymentNumber(direction) {
  const prefix = direction === 'IN' ? 'RCT' : 'PAY';
  const lastPayment = await prisma.$queryRawUnsafe(`
    SELECT payment_no FROM payments 
    WHERE payment_no LIKE '${prefix}-%' 
    ORDER BY id DESC LIMIT 1;
  `);

  let nextNum = 1;
  if (lastPayment && lastPayment.length > 0) {
    const parts = lastPayment[0].payment_no.split('-');
    if (parts.length === 2 && !isNaN(parseInt(parts[1], 10))) {
      nextNum = parseInt(parts[1], 10) + 1;
    }
  }
  return `${prefix}-${String(nextNum).padStart(6, '0')}`;
}

/**
 * Get active Bank & Cash Accounts
 */
async function getBankAccounts(req, res) {
  try {
    const accounts = await prisma.$queryRawUnsafe(`
      SELECT id, name, type, account_number, bank_name, ifsc_code, opening_balance, current_balance, is_active
      FROM bank_accounts
      WHERE is_active = true
      ORDER BY id ASC;
    `);
    return res.json({ success: true, data: accounts });
  } catch (error) {
    console.error('Error fetching bank accounts:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get list of payments with filtering
 */
async function getPaymentsList(req, res) {
  try {
    const { direction, party_id, mode, from, to, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    let conditions = ['1=1'];
    if (direction) conditions.push(`p.direction = '${direction.toUpperCase()}'`);
    if (party_id) conditions.push(`p.party_id = '${party_id}'`);
    if (mode) conditions.push(`p.mode = '${mode.toUpperCase()}'`);
    if (from) conditions.push(`p.pay_date >= '${from}'::date`);
    if (to) conditions.push(`p.pay_date <= '${to}'::date`);

    const whereClause = conditions.join(' AND ');

    const countRes = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int as total
      FROM payments p
      WHERE ${whereClause};
    `);
    const total = countRes[0]?.total || 0;

    const payments = await prisma.$queryRawUnsafe(`
      SELECT 
        p.id,
        p.payment_no,
        p.direction,
        p.party_id,
        pt.name as party_name,
        p.bank_account_id,
        b.name as account_name,
        p.pay_date,
        p.mode,
        p.reference_no,
        p.amount,
        p.is_reversed,
        p.reversed_of,
        p.notes,
        p.created_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id', pa.id,
              'doc_type', pa.doc_type,
              'doc_id', pa.doc_id,
              'kind', pa.kind,
              'amount', pa.amount
            )
          ) FILTER (WHERE pa.id IS NOT NULL), '[]'::json
        ) as allocations
      FROM payments p
      LEFT JOIN parties pt ON pt.id = p.party_id
      LEFT JOIN bank_accounts b ON b.id = p.bank_account_id
      LEFT JOIN payment_allocations pa ON pa.payment_id = p.id
      WHERE ${whereClause}
      GROUP BY p.id, pt.name, b.name
      ORDER BY p.pay_date DESC, p.id DESC
      LIMIT ${parseInt(limit, 10)} OFFSET ${offset};
    `);

    return res.json({
      success: true,
      data: payments,
      meta: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(total / parseInt(limit, 10))
      }
    });
  } catch (error) {
    console.error('Error fetching payments list:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Record a new payment with allocations (Transaction-safe)
 */
async function createPayment(req, res) {
  try {
    const {
      direction, // 'OUT' or 'IN'
      party_id,
      bank_account_id,
      pay_date,
      mode, // 'CASH', 'BANK', 'UPI', 'CHEQUE', 'NEFT', 'RTGS'
      reference_no,
      amount,
      notes,
      allocations = [] // [{ doc_type, doc_id, kind, milestone_id, amount }]
    } = req.body;

    if (!direction || !party_id || !amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, error: 'Direction, party, and valid amount (> 0) are required' });
    }

    const payAmount = Number(amount);
    const validModes = ['CASH', 'BANK', 'UPI', 'CHEQUE', 'NEFT', 'RTGS'];
    const resolvedMode = mode && validModes.includes(mode.toUpperCase()) ? mode.toUpperCase() : 'BANK';

    // Verify Party exists
    const partyCheck = await prisma.$queryRawUnsafe(`SELECT id, name FROM parties WHERE id = $1 LIMIT 1;`, party_id);
    if (!partyCheck || partyCheck.length === 0) {
      return res.status(404).json({ success: false, error: 'Party not found' });
    }

    // Validate allocations sum <= total amount
    const allocatedSum = allocations.reduce((s, a) => s + (Number(a.amount) || 0), 0);
    if (allocatedSum > payAmount + 0.01) {
      return res.status(400).json({
        success: false,
        error: `Allocations total (₹${allocatedSum.toFixed(2)}) cannot exceed payment amount (₹${payAmount.toFixed(2)})`
      });
    }

    const unallocatedRemainder = Number((payAmount - allocatedSum).toFixed(2));
    const paymentNo = await generatePaymentNumber(direction);
    const userId = req.user?.id || 'SYSTEM';

    // Execute in Prisma Transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Insert Payment
      const payRows = await tx.$queryRawUnsafe(`
        INSERT INTO payments (payment_no, direction, party_id, bank_account_id, pay_date, mode, reference_no, amount, notes, created_by, created_at)
        VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8, $9, $10, now())
        RETURNING id;
      `, paymentNo, direction, party_id, bank_account_id ? Number(bank_account_id) : null, pay_date || new Date(), resolvedMode, reference_no || null, payAmount, notes || null, userId);

      const paymentId = payRows[0].id;

      // 2. Insert Explicit Allocations
      for (const alloc of allocations) {
        if (Number(alloc.amount) > 0) {
          await tx.$queryRawUnsafe(`
            INSERT INTO payment_allocations (payment_id, doc_type, doc_id, kind, milestone_id, amount, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, now());
          `, paymentId, alloc.doc_type, alloc.doc_id || null, alloc.kind || 'AGAINST_BILL', alloc.milestone_id ? Number(alloc.milestone_id) : null, Number(alloc.amount));
        }
      }

      // 3. Insert On-Account Advance if remainder > 0
      if (unallocatedRemainder > 0.01) {
        await tx.$queryRawUnsafe(`
          INSERT INTO payment_allocations (payment_id, doc_type, doc_id, kind, amount, created_at)
          VALUES ($1, $2, NULL, 'ADVANCE', $3, now());
        `, paymentId, direction === 'OUT' ? 'PURCHASE_ORDER' : 'SALES_ORDER', unallocatedRemainder);
      }

      // 4. Update Bank Account Balance if bank_account_id provided
      if (bank_account_id) {
        const balanceDelta = direction === 'IN' ? payAmount : -payAmount;
        await tx.$queryRawUnsafe(`
          UPDATE bank_accounts 
          SET current_balance = current_balance + $1 
          WHERE id = $2;
        `, balanceDelta, Number(bank_account_id));
      }

      return { paymentId, paymentNo };
    });

    return res.status(201).json({
      success: true,
      message: `Payment ${result.paymentNo} recorded successfully`,
      data: result
    });
  } catch (error) {
    console.error('Error creating payment:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Reverse an existing payment (Creates immutable reversal entry)
 */
async function reversePayment(req, res) {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const paymentRows = await prisma.$queryRawUnsafe(`
      SELECT * FROM payments WHERE id = $1 LIMIT 1;
    `, Number(id));

    if (!paymentRows || paymentRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }

    const original = paymentRows[0];
    if (original.is_reversed) {
      return res.status(400).json({ success: false, error: 'Payment is already reversed' });
    }

    const reversalDirection = original.direction === 'OUT' ? 'IN' : 'OUT';
    const reversalPayNo = await generatePaymentNumber(reversalDirection);
    const userId = req.user?.id || 'SYSTEM';

    await prisma.$transaction(async (tx) => {
      // 1. Mark original as reversed
      await tx.$queryRawUnsafe(`
        UPDATE payments SET is_reversed = true WHERE id = $1;
      `, Number(id));

      // 2. Insert Reversal Payment
      const revRows = await tx.$queryRawUnsafe(`
        INSERT INTO payments (payment_no, direction, party_id, bank_account_id, pay_date, mode, reference_no, amount, reversed_of, is_reversed, notes, created_by, created_at)
        VALUES ($1, $2, $3, $4, CURRENT_DATE, $5, $6, $7, $8, true, $9, $10, now())
        RETURNING id;
      `, reversalPayNo, reversalDirection, original.party_id, original.bank_account_id, original.mode, `REV-${original.payment_no}`, original.amount, original.id, `Reversal of ${original.payment_no}. Reason: ${reason || 'Mistake / Adjustment'}`, userId);

      const reversalPaymentId = revRows[0].id;

      // 3. Mirror negative/counter allocations
      const originalAllocations = await tx.$queryRawUnsafe(`
        SELECT * FROM payment_allocations WHERE payment_id = $1;
      `, Number(id));

      for (const a of originalAllocations) {
        await tx.$queryRawUnsafe(`
          INSERT INTO payment_allocations (payment_id, doc_type, doc_id, kind, milestone_id, amount, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, now());
        `, reversalPaymentId, a.doc_type, a.doc_id, a.kind, a.milestone_id, a.amount);
      }

      // 4. Reverse bank account balance change
      if (original.bank_account_id) {
        const revertDelta = original.direction === 'OUT' ? Number(original.amount) : -Number(original.amount);
        await tx.$queryRawUnsafe(`
          UPDATE bank_accounts 
          SET current_balance = current_balance + $1 
          WHERE id = $2;
        `, revertDelta, Number(original.bank_account_id));
      }
    });

    return res.json({
      success: true,
      message: `Payment ${original.payment_no} successfully reversed with ${reversalPayNo}`
    });
  } catch (error) {
    console.error('Error reversing payment:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Reallocate an advance or unallocated credit to a specific bill
 */
async function reallocatePayment(req, res) {
  try {
    const { id } = req.params; // allocation id or payment id
    const { target_doc_type, target_doc_id, amount } = req.body;

    if (!target_doc_type || !target_doc_id || !amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, error: 'Target document type, document ID, and amount (> 0) required' });
    }

    const reallocAmount = Number(amount);

    // Verify target document balance
    const docRows = await prisma.$queryRawUnsafe(`
      SELECT balance, doc_no, party_id FROM v_finance_documents 
      WHERE doc_type = $1 AND doc_id = $2 LIMIT 1;
    `, target_doc_type, target_doc_id);

    if (!docRows || docRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Target document not found in financial ledger' });
    }

    const doc = docRows[0];
    if (reallocAmount > Number(doc.balance) + 0.01) {
      return res.status(400).json({
        success: false,
        error: `Reallocation amount (₹${reallocAmount.toFixed(2)}) exceeds bill balance (₹${Number(doc.balance).toFixed(2)})`
      });
    }

    await prisma.$transaction(async (tx) => {
      // Find unallocated advance allocation
      const advanceAlloc = await tx.$queryRawUnsafe(`
        SELECT id, payment_id, amount FROM payment_allocations 
        WHERE doc_id IS NULL AND kind = 'ADVANCE' AND amount >= $1 
        ORDER BY id ASC LIMIT 1;
      `, reallocAmount);

      if (!advanceAlloc || advanceAlloc.length === 0) {
        throw new Error('Insufficient on-account advance available for reallocation');
      }

      const alloc = advanceAlloc[0];
      const remainingAdvance = Number((Number(alloc.amount) - reallocAmount).toFixed(2));

      // Update current allocation or split
      if (remainingAdvance > 0.01) {
        await tx.$queryRawUnsafe(`UPDATE payment_allocations SET amount = $1 WHERE id = $2;`, remainingAdvance, alloc.id);
      } else {
        await tx.$queryRawUnsafe(`DELETE FROM payment_allocations WHERE id = $1;`, alloc.id);
      }

      // Insert new allocation against bill
      await tx.$queryRawUnsafe(`
        INSERT INTO payment_allocations (payment_id, doc_type, doc_id, kind, amount, created_at)
        VALUES ($1, $2, $3, 'AGAINST_BILL', $4, now());
      `, alloc.payment_id, target_doc_type, target_doc_id, reallocAmount);
    });

    return res.json({
      success: true,
      message: `₹${reallocAmount.toFixed(2)} successfully reallocated to ${doc.doc_no}`
    });
  } catch (error) {
    console.error('Error reallocating advance:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  getBankAccounts,
  getPaymentsList,
  createPayment,
  reversePayment,
  reallocatePayment
};
