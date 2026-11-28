const crypto = require('crypto');
const ExcelJS = require('exceljs');
const prisma = require('../../database/prisma');
const {
  MONTH_NAMES,
  VALID_TREATMENTS,
  parseStatementDate,
  formatDisplayDate,
  getMonthAndFY,
  parseAmountToPaise,
  paiseToDecimalString,
  paiseToNumber,
  extractPaymentMetadata,
  suggestGstTreatment,
  validateGstin,
  computeTransactionKeys,
  parseFileBufferToGrid,
  parsePastedTextToGrid,
  normalizeAndValidateRow,
  parseGridToPreviewRows,
  evaluatePreviewState,
  resolvePresetDateRange,
  sanitizeSpreadsheetCell
} = require('./bankStatement.utils');

let cachedDefaultCompanyId = null;

async function resolveCompanyId(req) {
  if (req.user && req.user.companyId) {
    return String(req.user.companyId);
  }
  if (cachedDefaultCompanyId) {
    return cachedDefaultCompanyId;
  }
  const rows = await prisma.$queryRawUnsafe(`SELECT id FROM company_details ORDER BY created_at ASC LIMIT 1;`);
  cachedDefaultCompanyId = rows?.[0]?.id || 'default';
  return cachedDefaultCompanyId;
}

function resolveUserPermissions(user) {
  const role = String(user?.role || '').toUpperCase();
  if (['MAIN_MASTER', 'ADMIN', 'PURCHASE_ACCOUNTANT', 'ACCOUNTANT'].includes(role)) {
    return { view: true, upload: true, edit: true, delete: true, gstReview: true };
  }
  if (['SUPERVISOR', 'MATERIALS_RECEIVER', 'PRODUCTION_STAFF', 'SALES_TEAM', 'LAB_ASSISTANT', 'OPERATOR'].includes(role)) {
    return { view: true, upload: false, edit: false, delete: false, gstReview: false };
  }
  return { view: false, upload: false, edit: false, delete: false, gstReview: false };
}

function requirePermission(permKey) {
  return (req, res, next) => {
    const perms = resolveUserPermissions(req.user);
    if (!perms[permKey]) {
      return res.status(403).json({
        success: false,
        error: `Permission denied: "${permKey}" permission is required for this action.`
      });
    }
    return next();
  };
}

/**
 * Load existing saved keys & latest balance for an account (company-isolated)
 */
async function loadAccountExistingState(txOrPrisma, companyId, bankAccountId) {
  const savedRows = await txOrPrisma.$queryRawUnsafe(`
    SELECT
      id::text as id,
      txn_date::text as txn_date,
      description,
      ref_no,
      debit::text as debit,
      credit::text as credit,
      balance::text as balance,
      dedupe_key,
      source_key,
      sort_order
    FROM bank_txn
    WHERE company_id = $1 AND bank_account_id = $2::bigint AND is_deleted = false
    ORDER BY txn_date DESC, sort_order DESC, created_at DESC;
  `, companyId, Number(bankAccountId));

  const savedDedupeSet = new Set();
  const savedSourceSet = new Set();
  const savedPossibleMap = new Map();

  let lastSavedBalancePaise = null;
  let lastSavedDateIso = null;

  for (let i = 0; i < savedRows.length; i++) {
    const r = savedRows[i];
    savedDedupeSet.add(r.dedupe_key);
    savedSourceSet.add(r.source_key);

    const drP = parseAmountToPaise(r.debit).paise;
    const crP = parseAmountToPaise(r.credit).paise;
    const balP = r.balance !== null && r.balance !== undefined ? parseAmountToPaise(r.balance, { allowNegative: true }).paise : null;

    if (i === 0 && balP !== null) {
      lastSavedBalancePaise = balP;
      lastSavedDateIso = String(r.txn_date).slice(0, 10);
    }

    const keys = computeTransactionKeys({
      bankAccountId,
      txnDate: String(r.txn_date).slice(0, 10),
      debitPaise: drP,
      creditPaise: crP,
      balancePaise: balP,
      description: r.description,
      refNo: r.ref_no
    });

    if (!savedPossibleMap.has(keys.possibleKey)) {
      savedPossibleMap.set(keys.possibleKey, []);
    }
    savedPossibleMap.get(keys.possibleKey).push({
      id: r.id,
      txnDate: String(r.txn_date).slice(0, 10),
      description: r.description,
      refNo: r.ref_no
    });
  }

  return {
    savedDedupeSet,
    savedSourceSet,
    savedPossibleMap,
    lastSavedBalancePaise,
    lastSavedDateIso
  };
}

/**
 * GET /permissions
 */
async function getPermissions(req, res) {
  const companyId = await resolveCompanyId(req);
  return res.json({
    success: true,
    data: {
      permissions: resolveUserPermissions(req.user),
      role: req.user?.role || '',
      companyId
    }
  });
}

/**
 * GET /accounts
 */
async function getAccounts(req, res) {
  try {
    const companyId = await resolveCompanyId(req);
    const includeInactive = String(req.query.includeInactive || 'false') === 'true';
    const activeCond = includeInactive ? '' : 'AND a.is_active = true';

    const rows = await prisma.$queryRawUnsafe(`
      SELECT
        a.id::text as id,
        a.company_id,
        a.legacy_bank_account_id::text as legacy_bank_account_id,
        a.account_name,
        a.bank_name,
        a.account_number,
        a.ifsc_code,
        a.account_type,
        COALESCE(a.branch_name, '') as branch_name,
        COALESCE(a.sort_order, a.id::int) as sort_order,
        COALESCE(a.is_default, false) as is_default,
        COALESCE(a.notes, '') as notes,
        a.opening_balance::text as opening_balance,
        a.is_active,
        a.created_at,
        a.updated_at,
        COUNT(t.id) FILTER (WHERE t.is_deleted = false)::int as txn_count,
        COALESCE(SUM(t.debit) FILTER (WHERE t.is_deleted = false), 0)::text as total_debit,
        COALESCE(SUM(t.credit) FILTER (WHERE t.is_deleted = false), 0)::text as total_credit,
        (
          SELECT bt.balance::text
          FROM bank_txn bt
          WHERE bt.company_id = a.company_id AND bt.bank_account_id = a.id AND bt.is_deleted = false AND bt.balance IS NOT NULL
          ORDER BY bt.txn_date DESC, bt.sort_order DESC, bt.created_at DESC
          LIMIT 1
        ) as latest_balance
      FROM bank_statement_accounts a
      LEFT JOIN bank_txn t ON t.bank_account_id = a.id AND t.company_id = a.company_id
      WHERE a.company_id = $1 AND COALESCE(a.is_deleted, false) = false ${activeCond}
      GROUP BY a.id
      ORDER BY COALESCE(a.sort_order, a.id::int) ASC, a.id ASC;
    `, companyId);

    return res.json({
      success: true,
      data: rows.map((r) => ({
        ...r,
        opening_balance: Number(r.opening_balance || 0),
        total_debit: Number(r.total_debit || 0),
        total_credit: Number(r.total_credit || 0),
        latest_balance: r.latest_balance !== null ? Number(r.latest_balance) : Number(r.opening_balance || 0)
      }))
    });
  } catch (err) {
    console.error('[bankStatement.getAccounts]', err.message);
    return res.status(500).json({ success: false, error: 'Failed to load bank accounts.' });
  }
}

/**
 * POST /accounts
 */
async function createAccount(req, res) {
  try {
    const companyId = await resolveCompanyId(req);
    const {
      accountName,
      bankName = '',
      accountNumber = '',
      ifscCode = '',
      branchName = '',
      accountType = 'BANK',
      openingBalance = 0,
      isDefault = false,
      isActive = true,
      notes = ''
    } = req.body || {};

    if (!accountName || !String(accountName).trim()) {
      return res.status(400).json({ success: false, error: 'Account name is required.' });
    }
    const openAmt = parseAmountToPaise(openingBalance, { allowBlank: true, allowZero: true, allowNegative: true });
    if (!openAmt.ok) {
      return res.status(400).json({ success: false, error: `Opening balance: ${openAmt.error}` });
    }

    const userId = String(req.user?.id || 'SYSTEM');
    const userName = String(req.user?.name || req.user?.email || 'User');

    const created = await prisma.$transaction(async (tx) => {
      const maxOrderRows = await tx.$queryRawUnsafe(`
        SELECT COALESCE(MAX(sort_order), 0)::int as max_order
        FROM bank_statement_accounts
        WHERE company_id = $1 AND COALESCE(is_deleted, false) = false;
      `, companyId);
      const nextOrder = (maxOrderRows?.[0]?.max_order || 0) + 1;

      if (Boolean(isDefault)) {
        await tx.$executeRawUnsafe(`
          UPDATE bank_statement_accounts SET is_default = false WHERE company_id = $1;
        `, companyId);
      }

      // Sync to legacy bank_accounts when default company so payments module sees it too
      let legacyId = null;
      try {
        const compRows = await tx.$queryRawUnsafe(`SELECT id FROM company_details ORDER BY created_at ASC LIMIT 1;`);
        const primaryCompanyId = compRows?.[0]?.id || 'default';
        if (companyId === primaryCompanyId || companyId === 'default') {
          const legacyInserted = await tx.$queryRawUnsafe(`
            INSERT INTO bank_accounts (name, type, account_number, bank_name, ifsc_code, opening_balance, current_balance, is_active)
            VALUES ($1, $2, $3, $4, $5, $6::decimal, $6::decimal, $7)
            RETURNING id;
          `,
          String(accountName).trim(),
          String(accountType || 'BANK').trim().toUpperCase(),
          String(accountNumber).trim(),
          String(bankName).trim(),
          String(ifscCode).trim().toUpperCase(),
          openAmt.decimalStr,
          Boolean(isActive)
          );
          legacyId = legacyInserted?.[0]?.id || null;
        }
      } catch (_) {}

      const inserted = await tx.$queryRawUnsafe(`
        INSERT INTO bank_statement_accounts (
          company_id, legacy_bank_account_id, account_name, bank_name, account_number, ifsc_code,
          branch_name, account_type, sort_order, is_default, is_active, notes, opening_balance, created_by
        ) VALUES ($1, $2::bigint, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::decimal, $14)
        RETURNING id::text as id, account_name, bank_name, account_number, ifsc_code, branch_name, account_type, sort_order, is_default, is_active, notes, opening_balance::text as opening_balance;
      `,
      companyId,
      legacyId,
      String(accountName).trim(),
      String(bankName).trim(),
      String(accountNumber).trim(),
      String(ifscCode).trim().toUpperCase(),
      String(branchName).trim(),
      String(accountType || 'BANK').trim().toUpperCase(),
      nextOrder,
      Boolean(isDefault),
      Boolean(isActive),
      String(notes).trim(),
      openAmt.decimalStr,
      userId
      );

      await tx.$executeRawUnsafe(`
        INSERT INTO bank_audit_log (company_id, action, entity_type, entity_id, after_data, changed_by, changed_by_name)
        VALUES ($1, 'ACCOUNT_CREATE', 'bank_statement_accounts', $2, $3::jsonb, $4, $5);
      `, companyId, inserted[0].id, JSON.stringify(inserted[0]), userId, userName);

      return inserted[0];
    });

    return res.status(201).json({ success: true, data: created });
  } catch (err) {
    console.error('[bankStatement.createAccount]', err.message);
    return res.status(500).json({ success: false, error: 'Failed to create bank account.' });
  }
}

/**
 * PUT /accounts/:id (Edit / Update bank account & sync with bank_accounts)
 */
async function updateAccount(req, res) {
  try {
    const companyId = await resolveCompanyId(req);
    const { id } = req.params;
    const {
      accountName,
      bankName,
      accountNumber,
      ifscCode,
      branchName,
      accountType,
      openingBalance,
      isDefault,
      isActive,
      notes,
      sortOrder
    } = req.body || {};

    if (accountName !== undefined && !String(accountName).trim()) {
      return res.status(400).json({ success: false, error: 'Account name cannot be empty.' });
    }

    let openAmt = null;
    if (openingBalance !== undefined) {
      openAmt = parseAmountToPaise(openingBalance, { allowBlank: true, allowZero: true, allowNegative: true });
      if (!openAmt.ok) {
        return res.status(400).json({ success: false, error: `Opening balance: ${openAmt.error}` });
      }
    }

    const userId = String(req.user?.id || 'SYSTEM');
    const userName = String(req.user?.name || req.user?.email || 'User');

    const updated = await prisma.$transaction(async (tx) => {
      const prevRows = await tx.$queryRawUnsafe(`
        SELECT id::text as id, legacy_bank_account_id::text as legacy_id, account_name, bank_name, account_number,
               ifsc_code, branch_name, account_type, opening_balance::text as opening_balance,
               is_default, is_active, sort_order, notes
        FROM bank_statement_accounts
        WHERE id = $1::bigint AND company_id = $2 AND COALESCE(is_deleted, false) = false
        FOR UPDATE;
      `, Number(id), companyId);

      if (!prevRows || prevRows.length === 0) {
        const err = new Error('Bank account not found.');
        err.statusCode = 404;
        throw err;
      }

      const prev = prevRows[0];
      const nextDefault = isDefault !== undefined ? Boolean(isDefault) : Boolean(prev.is_default);
      if (nextDefault) {
        await tx.$executeRawUnsafe(`
          UPDATE bank_statement_accounts SET is_default = false WHERE company_id = $1 AND id <> $2::bigint;
        `, companyId, Number(id));
      }

      const nextName = accountName !== undefined ? String(accountName).trim() : prev.account_name;
      const nextBank = bankName !== undefined ? String(bankName).trim() : (prev.bank_name || '');
      const nextAccNo = accountNumber !== undefined ? String(accountNumber).trim() : (prev.account_number || '');
      const nextIfsc = ifscCode !== undefined ? String(ifscCode).trim().toUpperCase() : (prev.ifsc_code || '');
      const nextBranch = branchName !== undefined ? String(branchName).trim() : (prev.branch_name || '');
      const nextType = accountType !== undefined ? String(accountType).trim().toUpperCase() : prev.account_type;
      const nextOpen = openAmt ? openAmt.decimalStr : prev.opening_balance;
      const nextActive = isActive !== undefined ? Boolean(isActive) : Boolean(prev.is_active);
      const nextNotes = notes !== undefined ? String(notes).trim() : (prev.notes || '');
      const nextOrder = sortOrder !== undefined ? Number(sortOrder) : Number(prev.sort_order || 0);

      const savedRows = await tx.$queryRawUnsafe(`
        UPDATE bank_statement_accounts SET
          account_name = $1,
          bank_name = $2,
          account_number = $3,
          ifsc_code = $4,
          branch_name = $5,
          account_type = $6,
          opening_balance = $7::decimal,
          is_default = $8,
          is_active = $9,
          notes = $10,
          sort_order = $11,
          updated_at = now()
        WHERE id = $12::bigint AND company_id = $13
        RETURNING id::text as id, account_name, bank_name, account_number, ifsc_code, branch_name, account_type, opening_balance::text as opening_balance, is_default, is_active, sort_order, notes;
      `,
      nextName, nextBank, nextAccNo, nextIfsc, nextBranch, nextType, nextOpen,
      nextDefault, nextActive, nextNotes, nextOrder, Number(id), companyId
      );

      if (prev.legacy_id) {
        try {
          await tx.$executeRawUnsafe(`
            UPDATE bank_accounts SET
              name = $1,
              type = $2,
              account_number = $3,
              bank_name = $4,
              ifsc_code = $5,
              opening_balance = $6::decimal,
              is_active = $7
            WHERE id = $8::bigint;
          `, nextName, nextType, nextAccNo, nextBank, nextIfsc, nextOpen, nextActive, Number(prev.legacy_id));
        } catch (_) {}
      }

      await tx.$executeRawUnsafe(`
        INSERT INTO bank_audit_log (company_id, action, entity_type, entity_id, before_data, after_data, changed_by, changed_by_name)
        VALUES ($1, 'ACCOUNT_UPDATE', 'bank_statement_accounts', $2, $3::jsonb, $4::jsonb, $5, $6);
      `, companyId, String(id), JSON.stringify(prev), JSON.stringify(savedRows[0]), userId, userName);

      return savedRows[0];
    });

    return res.json({ success: true, data: updated });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ success: false, error: err.message || 'Failed to update bank account.' });
  }
}

/**
 * POST /accounts/reorder (Persist Bank Master display order)
 */
async function reorderAccounts(req, res) {
  try {
    const companyId = await resolveCompanyId(req);
    const { orderedIds = [] } = req.body || {};
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return res.status(400).json({ success: false, error: 'orderedIds array is required.' });
    }

    const userId = String(req.user?.id || 'SYSTEM');
    const userName = String(req.user?.name || req.user?.email || 'User');

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < orderedIds.length; i++) {
        await tx.$executeRawUnsafe(`
          UPDATE bank_statement_accounts
          SET sort_order = $1, updated_at = now()
          WHERE id = $2::bigint AND company_id = $3;
        `, i + 1, Number(orderedIds[i]), companyId);
      }
      await tx.$executeRawUnsafe(`
        INSERT INTO bank_audit_log (company_id, action, entity_type, after_data, changed_by, changed_by_name)
        VALUES ($1, 'ACCOUNT_REORDER', 'bank_statement_accounts', $2::jsonb, $3, $4);
      `, companyId, JSON.stringify({ orderedIds }), userId, userName);
    });

    return res.json({ success: true, message: 'Account order updated.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to reorder bank accounts.' });
  }
}

/**
 * Internal helper to move active transactions from sourceAccountId -> targetAccountId inside tx
 */
async function moveTransactionsBetweenAccountsTx(tx, companyId, sourceAccountId, targetAccountId, txnIds = null) {
  const filterSql = Array.isArray(txnIds) && txnIds.length > 0
    ? `AND id = ANY($3::uuid[])`
    : '';
  const queryParams = Array.isArray(txnIds) && txnIds.length > 0
    ? [companyId, Number(sourceAccountId), txnIds]
    : [companyId, Number(sourceAccountId)];

  const txns = await tx.$queryRawUnsafe(`
    SELECT id::text as id, txn_date::text as txn_date, debit::text as debit, credit::text as credit,
           balance::text as balance, description, ref_no
    FROM bank_txn
    WHERE company_id = $1 AND bank_account_id = $2::bigint AND is_deleted = false ${filterSql}
    FOR UPDATE;
  `, ...queryParams);

  let movedCount = 0;
  for (const t of txns) {
    const drP = parseAmountToPaise(t.debit).paise;
    const crP = parseAmountToPaise(t.credit).paise;
    const balP = t.balance !== null ? parseAmountToPaise(t.balance, { allowNegative: true }).paise : null;
    const newKeys = computeTransactionKeys({
      bankAccountId: targetAccountId,
      txnDate: String(t.txn_date).slice(0, 10),
      debitPaise: drP,
      creditPaise: crP,
      balancePaise: balP,
      description: t.description,
      refNo: t.ref_no
    });

    // Ensure destination doesn't already hold identical transaction
    const dup = await tx.$queryRawUnsafe(`
      SELECT id::text as id FROM bank_txn
      WHERE company_id = $1 AND bank_account_id = $2::bigint AND dedupe_key = $3 AND is_deleted = false
      LIMIT 1;
    `, companyId, Number(targetAccountId), newKeys.dedupeKey);

    if (dup && dup.length > 0) {
      const err = new Error(`Target account already contains duplicate transaction (${String(t.txn_date).slice(0, 10)} - ${t.description.slice(0, 30)}).`);
      err.statusCode = 409;
      throw err;
    }

    await tx.$executeRawUnsafe(`
      UPDATE bank_txn SET
        bank_account_id = $1::bigint,
        dedupe_key = $2,
        version = version + 1,
        updated_at = now()
      WHERE id = $3::uuid AND company_id = $4;
    `, Number(targetAccountId), newKeys.dedupeKey, t.id, companyId);
    movedCount++;
  }

  return movedCount;
}

/**
 * POST /accounts/:id/move-transactions (Move all or selected transactions from one account to another)
 */
async function moveAccountTransactions(req, res) {
  try {
    const companyId = await resolveCompanyId(req);
    const { id } = req.params;
    const { targetAccountId, txnIds = null } = req.body || {};

    if (!targetAccountId || String(targetAccountId) === String(id)) {
      return res.status(400).json({ success: false, error: 'Please select a different destination bank account.' });
    }

    const userId = String(req.user?.id || 'SYSTEM');
    const userName = String(req.user?.name || req.user?.email || 'User');

    const movedCount = await prisma.$transaction(async (tx) => {
      const src = await assertAccountBelongsToCompany(tx, companyId, id);
      const dst = await assertAccountBelongsToCompany(tx, companyId, targetAccountId);
      if (!src || !dst) {
        const err = new Error('Source or target bank account not found.');
        err.statusCode = 404;
        throw err;
      }

      const count = await moveTransactionsBetweenAccountsTx(tx, companyId, id, targetAccountId, txnIds);

      await tx.$executeRawUnsafe(`
        INSERT INTO bank_audit_log (company_id, action, entity_type, entity_id, before_data, after_data, changed_by, changed_by_name)
        VALUES ($1, 'ACCOUNT_MOVE_TXNS', 'bank_statement_accounts', $2, $3::jsonb, $4::jsonb, $5, $6);
      `,
      companyId,
      String(id),
      JSON.stringify({ sourceAccountId: id, sourceName: src.account_name }),
      JSON.stringify({ targetAccountId, targetName: dst.account_name, movedCount: count }),
      userId,
      userName
      );

      return count;
    });

    return res.json({ success: true, movedCount });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ success: false, error: err.message || 'Failed to move transactions.' });
  }
}

/**
 * DELETE /accounts/:id (Delete/archive account, either moving its transactions to moveToAccountId OR soft-deleting them when deleteTransactions=true)
 */
async function deleteAccount(req, res) {
  try {
    const companyId = await resolveCompanyId(req);
    const { id } = req.params;
    const moveToAccountId = req.body?.moveToAccountId || req.query?.moveToAccountId || null;
    const deleteTransactions =
      Boolean(req.body?.deleteTransactions) || String(req.query?.deleteTransactions || '') === 'true';

    const userId = String(req.user?.id || 'SYSTEM');
    const userName = String(req.user?.name || req.user?.email || 'User');

    const result = await prisma.$transaction(async (tx) => {
      const existingRows = await tx.$queryRawUnsafe(`
        SELECT id::text as id, legacy_bank_account_id::text as legacy_id, account_name, account_number
        FROM bank_statement_accounts
        WHERE id = $1::bigint AND company_id = $2 AND COALESCE(is_deleted, false) = false
        FOR UPDATE;
      `, Number(id), companyId);

      if (!existingRows || existingRows.length === 0) {
        const err = new Error('Bank account not found.');
        err.statusCode = 404;
        throw err;
      }

      const acct = existingRows[0];
      const countRows = await tx.$queryRawUnsafe(`
        SELECT COUNT(*)::int as cnt FROM bank_txn
        WHERE company_id = $1 AND bank_account_id = $2::bigint AND is_deleted = false;
      `, companyId, Number(id));
      const txnCount = countRows?.[0]?.cnt || 0;

      let movedCount = 0;
      let deletedTxnCount = 0;
      if (txnCount > 0) {
        if (moveToAccountId && String(moveToAccountId) !== String(id)) {
          const dst = await assertAccountBelongsToCompany(tx, companyId, moveToAccountId);
          if (!dst) {
            const err = new Error('Destination account for moving transactions was not found.');
            err.statusCode = 404;
            throw err;
          }
          movedCount = await moveTransactionsBetweenAccountsTx(tx, companyId, id, moveToAccountId, null);
        } else if (deleteTransactions) {
          await tx.$executeRawUnsafe(`
            UPDATE bank_txn_invoice_allocations SET is_deleted = true, updated_at = now()
            WHERE company_id = $1 AND txn_id IN (
              SELECT id FROM bank_txn WHERE company_id = $1 AND bank_account_id = $2::bigint AND is_deleted = false
            );
          `, companyId, Number(id));
          await tx.$executeRawUnsafe(`
            UPDATE bank_txn SET
              is_deleted = true,
              deleted_at = now(),
              deleted_by = $3,
              updated_at = now()
            WHERE company_id = $1 AND bank_account_id = $2::bigint AND is_deleted = false;
          `, companyId, Number(id), userId);
          deletedTxnCount = txnCount;
        } else {
          const err = new Error(`Cannot delete "${acct.account_name}" because it has ${txnCount} transaction(s). Move transactions to another account or choose delete with transactions.`);
          err.statusCode = 400;
          throw err;
        }
      }

      await tx.$executeRawUnsafe(`
        UPDATE bank_statement_accounts SET
          is_deleted = true,
          is_active = false,
          is_default = false,
          updated_at = now()
        WHERE id = $1::bigint AND company_id = $2;
      `, Number(id), companyId);

      if (acct.legacy_id) {
        try {
          await tx.$executeRawUnsafe(`UPDATE bank_accounts SET is_active = false WHERE id = $1::bigint;`, Number(acct.legacy_id));
        } catch (_) {}
      }

      await tx.$executeRawUnsafe(`
        INSERT INTO bank_audit_log (company_id, action, entity_type, entity_id, before_data, after_data, changed_by, changed_by_name)
        VALUES ($1, 'ACCOUNT_DELETE', 'bank_statement_accounts', $2, $3::jsonb, $4::jsonb, $5, $6);
      `, companyId, String(id), JSON.stringify(acct), JSON.stringify({ moveToAccountId, movedCount, deletedTxnCount }), userId, userName);

      return { id, movedCount, deletedTxnCount };
    });

    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ success: false, error: err.message || 'Failed to delete bank account.' });
  }
}

/**
 * Verify bank account belongs to active company
 */
async function assertAccountBelongsToCompany(txOrPrisma, companyId, bankAccountId) {
  const rows = await txOrPrisma.$queryRawUnsafe(`
    SELECT id::text as id, account_name, account_number, bank_name
    FROM bank_statement_accounts
    WHERE id = $1::bigint AND company_id = $2 AND COALESCE(is_deleted, false) = false
    LIMIT 1;
  `, Number(bankAccountId), companyId);
  return rows?.[0] || null;
}

/**
 * POST /preview (Step 1 & Step 2: Upload Excel/CSV or Paste rows -> return editable preview, save nothing!)
 */
async function previewUpload(req, res) {
  try {
    const companyId = await resolveCompanyId(req);
    const bankAccountId = req.body?.bankAccountId;

    if (!bankAccountId) {
      return res.status(400).json({ success: false, error: 'Bank account is required.' });
    }

    const account = await assertAccountBelongsToCompany(prisma, companyId, bankAccountId);
    if (!account) {
      return res.status(404).json({ success: false, error: 'Selected bank account was not found for this company.' });
    }

    let grid = [];
    let fileName = 'pasted-rows.csv';
    let fileType = 'paste';

    if (req.file) {
      fileName = req.file.originalname || 'statement.xlsx';
      const ext = fileName.toLowerCase().split('.').pop();
      if (!['xlsx', 'xls', 'csv'].includes(ext)) {
        return res.status(400).json({ success: false, error: 'Invalid file type. Only .xlsx, .xls, and .csv files are accepted.' });
      }
      if (req.file.size > 10 * 1024 * 1024) {
        return res.status(400).json({ success: false, error: 'File exceeds the 10 MB limit.' });
      }
      fileType = ext;
      grid = parseFileBufferToGrid(req.file.buffer, fileName);
    } else if (req.body?.pastedText && String(req.body.pastedText).trim()) {
      grid = parsePastedTextToGrid(req.body.pastedText);
      fileName = 'pasted-statement';
      fileType = 'paste';
    } else {
      return res.status(400).json({ success: false, error: 'Please select a .xlsx/.xls/.csv file or paste copied rows from Excel.' });
    }

    const parsedRows = parseGridToPreviewRows(grid, account.id);
    const existingState = await loadAccountExistingState(prisma, companyId, account.id);
    const evaluated = evaluatePreviewState(parsedRows, existingState);

    return res.json({
      success: true,
      data: {
        fileName,
        fileType,
        account,
        rows: evaluated.rows,
        summary: evaluated.summary
      }
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message || 'Could not parse statement.' });
  }
}

/**
 * POST /recheck (Step 2: Re-run validation, Month/FY, extraction, duplicate check, balance gap after any row edit/add/delete)
 */
async function recheckPreview(req, res) {
  try {
    const companyId = await resolveCompanyId(req);
    const { bankAccountId, rows = [] } = req.body || {};

    if (!bankAccountId) {
      return res.status(400).json({ success: false, error: 'Bank account is required.' });
    }

    const account = await assertAccountBelongsToCompany(prisma, companyId, bankAccountId);
    if (!account) {
      return res.status(404).json({ success: false, error: 'Bank account not found for this company.' });
    }

    const normalized = (Array.isArray(rows) ? rows : []).map((r, idx) =>
      normalizeAndValidateRow(r, account.id, idx)
    );
    const existingState = await loadAccountExistingState(prisma, companyId, account.id);
    const evaluated = evaluatePreviewState(normalized, existingState);

    return res.json({
      success: true,
      data: {
        account,
        rows: evaluated.rows,
        summary: evaluated.summary
      }
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message || 'Recheck failed.' });
  }
}

/**
 * POST /commit (Step 3: Atomic database save of batch + rows + initial GST + audit log)
 */
async function commitBatch(req, res) {
  try {
    const companyId = await resolveCompanyId(req);
    const { bankAccountId, fileName = 'bank-statement', fileType = 'xlsx', rows = [], simulateError = false } = req.body || {};

    if (!bankAccountId) {
      return res.status(400).json({ success: false, error: 'Bank account is required.' });
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, error: 'No rows provided to save.' });
    }

    const account = await assertAccountBelongsToCompany(prisma, companyId, bankAccountId);
    if (!account) {
      return res.status(404).json({ success: false, error: 'Bank account not found for this company.' });
    }

    const userId = String(req.user?.id || 'SYSTEM');
    const userName = String(req.user?.name || req.user?.email || 'User');

    const result = await prisma.$transaction(async (tx) => {
      // Advisory lock per (company_id, bank_account_id) prevents concurrent race conditions
      const lockKey = `${companyId}:${account.id}`;
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext($1));`, lockKey);

      const normalized = rows.map((r, idx) => normalizeAndValidateRow(r, account.id, idx));
      const existingState = await loadAccountExistingState(tx, companyId, account.id);
      const evaluated = evaluatePreviewState(normalized, existingState);

      const toSave = evaluated.rows.filter((r) => r.willSave);
      const unsavedRows = evaluated.rows.filter((r) => !r.willSave);

      if (toSave.length === 0) {
        return {
          savedCount: 0,
          duplicateCount: evaluated.summary.duplicateCount,
          possibleSkipped: evaluated.rows.filter((r) => r.status === 'Possible' && !r.keepPossible).length,
          errorCount: evaluated.summary.errorCount,
          unsavedRows,
          batchId: null,
          totalDebit: 0,
          totalCredit: 0
        };
      }

      const batchId = crypto.randomUUID();
      let batchDebitPaise = 0;
      let batchCreditPaise = 0;

      for (const r of toSave) {
        batchDebitPaise += r.debitPaise;
        batchCreditPaise += r.creditPaise;
      }

      await tx.$executeRawUnsafe(`
        INSERT INTO bank_import_batches (
          id, company_id, bank_account_id, file_name, file_type, uploaded_by, uploaded_by_name,
          total_rows, saved_rows, duplicate_rows, possible_rows, error_rows, total_debit, total_credit
        ) VALUES ($1::uuid, $2, $3::bigint, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::decimal, $14::decimal);
      `,
      batchId,
      companyId,
      Number(account.id),
      String(fileName).slice(0, 255),
      String(fileType).slice(0, 20),
      userId,
      userName,
      evaluated.summary.totalRows,
      toSave.length,
      evaluated.summary.duplicateCount,
      evaluated.summary.possibleCount,
      evaluated.summary.errorCount,
      paiseToDecimalString(batchDebitPaise),
      paiseToDecimalString(batchCreditPaise)
      );

      for (const r of toSave) {
        const txnId = crypto.randomUUID();
        await tx.$executeRawUnsafe(`
          INSERT INTO bank_txn (
            id, company_id, bank_account_id, batch_id, sort_order,
            txn_date, value_date, description, ref_no, branch_code,
            debit, credit, balance, remarks, txn_month, fin_year, txn_type,
            mode, utr, party_name, dedupe_key, source_key,
            possible_duplicate, keep_possible, balance_gap_flag, balance_gap_diff, created_by
          ) VALUES (
            $1::uuid, $2, $3::bigint, $4::uuid, $5,
            $6::date, $7::date, $8, $9, $10,
            $11::decimal, $12::decimal, $13::decimal, $14, $15, $16, $17,
            $18, $19, $20, $21, $22,
            $23, $24, $25, $26::decimal, $27
          );
        `,
        txnId,
        companyId,
        Number(account.id),
        batchId,
        r.sortOrder,
        r.txnDate,
        r.valueDate || null,
        r.description,
        r.refNo || '',
        r.branchCode || '',
        paiseToDecimalString(r.debitPaise),
        paiseToDecimalString(r.creditPaise),
        r.balancePaise !== null ? paiseToDecimalString(r.balancePaise) : null,
        r.remarks || '',
        r.month,
        r.year,
        r.type || '',
        r.mode || '',
        r.utr || '',
        r.partyName || '',
        r.dedupeKey,
        r.sourceKey,
        r.status === 'Possible',
        Boolean(r.keepPossible),
        Boolean(r.balanceGap),
        paiseToDecimalString(r.balanceGapDiffPaise || 0),
        userId
        );

        await tx.$executeRawUnsafe(`
          INSERT INTO bank_txn_gst (
            company_id, txn_id, treatment, suggested_treatment, suggestion_reason
          ) VALUES ($1, $2::uuid, 'Unreviewed', $3, $4);
        `,
        companyId,
        txnId,
        r.suggestedTreatment || 'Unreviewed',
        r.suggestionReason || ''
        );
      }

      if (simulateError === true && process.env.NODE_ENV !== 'production') {
        throw new Error('Simulated transaction failure for rollback verification');
      }

      // Audit log (summary only, NEVER logging full statement contents)
      await tx.$executeRawUnsafe(`
        INSERT INTO bank_audit_log (
          company_id, action, entity_type, entity_id, batch_id, after_data, changed_by, changed_by_name
        ) VALUES ($1, 'BATCH_IMPORT', 'bank_import_batches', $2, $2::uuid, $3::jsonb, $4, $5);
      `,
      companyId,
      batchId,
      JSON.stringify({
        accountId: account.id,
        accountName: account.account_name,
        fileName,
        savedRows: toSave.length,
        duplicateRows: evaluated.summary.duplicateCount,
        totalDebit: paiseToDecimalString(batchDebitPaise),
        totalCredit: paiseToDecimalString(batchCreditPaise)
      }),
      userId,
      userName
      );

      return {
        savedCount: toSave.length,
        duplicateCount: evaluated.summary.duplicateCount,
        possibleSkipped: evaluated.rows.filter((r) => r.status === 'Possible' && !r.keepPossible).length,
        errorCount: evaluated.summary.errorCount,
        unsavedRows,
        batchId,
        totalDebit: paiseToNumber(batchDebitPaise),
        totalCredit: paiseToNumber(batchCreditPaise)
      };
    });

    return res.status(result.savedCount > 0 ? 201 : 200).json({
      success: true,
      data: result
    });
  } catch (err) {
    console.error('[bankStatement.commitBatch]', err.message);
    if (err.code === '23505' || String(err.message).includes('uq_bank_txn')) {
      return res.status(409).json({ success: false, error: 'Duplicate transaction blocked by database unique index.' });
    }
    return res.status(500).json({ success: false, error: err.message || 'Failed to save bank transactions.' });
  }
}

/**
 * Shared filtered WHERE builder for Step 4 & Step 7 exports
 */
function buildTransactionFilterWhere(companyId, query = {}) {
  const {
    preset = 'all',
    from,
    to,
    accountId,
    dcFilter = 'ALL',
    txnType = 'ALL',
    search = ''
  } = query;

  const { from: resolvedFrom, to: resolvedTo } = resolvePresetDateRange(preset, from, to);

  const conditions = ['t.company_id = $1', 't.is_deleted = false'];
  const params = [companyId];
  let idx = 2;

  if (resolvedFrom) {
    conditions.push(`t.txn_date >= $${idx}::date`);
    params.push(resolvedFrom);
    idx++;
  }
  if (resolvedTo) {
    conditions.push(`t.txn_date <= $${idx}::date`);
    params.push(resolvedTo);
    idx++;
  }
  if (accountId && accountId !== 'ALL') {
    conditions.push(`t.bank_account_id = $${idx}::bigint`);
    params.push(Number(accountId));
    idx++;
  }
  if (dcFilter && dcFilter.toUpperCase() === 'DEBIT') {
    conditions.push(`t.debit > 0`);
  } else if (dcFilter && dcFilter.toUpperCase() === 'CREDIT') {
    conditions.push(`t.credit > 0`);
  }
  if (txnType && txnType !== 'ALL') {
    conditions.push(`LOWER(COALESCE(t.txn_type, '')) = LOWER($${idx})`);
    params.push(String(txnType).trim());
    idx++;
  }
  if (search && String(search).trim()) {
    const q = String(search).trim();
    const numericSearch = q.replace(/[₹,\s]/g, '');
    const likeParam = `%${q}%`;
    if (/^\d+(\.\d+)?$/.test(numericSearch)) {
      conditions.push(`(
        t.description ILIKE $${idx} OR
        t.remarks ILIKE $${idx} OR
        t.ref_no ILIKE $${idx} OR
        t.utr ILIKE $${idx} OR
        t.party_name ILIKE $${idx} OR
        t.debit = $${idx + 1}::decimal OR
        t.credit = $${idx + 1}::decimal
      )`);
      params.push(likeParam, numericSearch);
      idx += 2;
    } else {
      conditions.push(`(
        t.description ILIKE $${idx} OR
        t.remarks ILIKE $${idx} OR
        t.ref_no ILIKE $${idx} OR
        t.utr ILIKE $${idx} OR
        t.party_name ILIKE $${idx}
      )`);
      params.push(likeParam);
      idx += 1;
    }
  }

  return {
    whereSql: conditions.join(' AND '),
    params,
    resolvedFrom,
    resolvedTo
  };
}

/**
 * GET /transactions (Step 4: Saved transactions, filters, totals across ALL filtered rows, pagination, sorting)
 */
async function listTransactions(req, res) {
  try {
    const companyId = await resolveCompanyId(req);
    const {
      page = 1,
      limit = 25,
      sortBy = 'txn_date',
      sortDir = 'DESC'
    } = req.query;

    const { whereSql, params, resolvedFrom, resolvedTo } = buildTransactionFilterWhere(companyId, req.query);

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 25));
    const offset = (pageNum - 1) * limitNum;

    const sortColumns = {
      txn_date: 't.txn_date',
      debit: 't.debit',
      credit: 't.credit',
      balance: 't.balance',
      party_name: 't.party_name',
      txn_type: 't.txn_type',
      created_at: 't.created_at'
    };
    const orderCol = sortColumns[sortBy] || 't.txn_date';
    const orderDirection = String(sortDir).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // 1. All-filtered-rows summary (NOT just current page!)
    const summaryRows = await prisma.$queryRawUnsafe(`
      SELECT
        COUNT(*)::int as total_count,
        COALESCE(SUM(t.debit), 0)::text as total_debit,
        COALESCE(SUM(t.credit), 0)::text as total_credit
      FROM bank_txn t
      WHERE ${whereSql};
    `, ...params);

    const totalCount = summaryRows[0]?.total_count || 0;
    const totalDebitPaise = parseAmountToPaise(summaryRows[0]?.total_debit || '0').paise;
    const totalCreditPaise = parseAmountToPaise(summaryRows[0]?.total_credit || '0').paise;
    const netPaise = totalCreditPaise - totalDebitPaise;

    // 2. Paginated rows
    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;
    const rows = await prisma.$queryRawUnsafe(`
      SELECT
        t.id::text as id,
        t.bank_account_id::text as bank_account_id,
        a.account_name,
        a.account_number,
        t.txn_date::text as txn_date,
        t.value_date::text as value_date,
        t.description,
        t.ref_no,
        t.branch_code,
        t.debit::text as debit,
        t.credit::text as credit,
        t.balance::text as balance,
        t.remarks,
        t.txn_month,
        t.fin_year,
        t.txn_type,
        t.mode,
        t.utr,
        t.party_name,
        t.version,
        t.balance_gap_flag,
        t.balance_gap_diff::text as balance_gap_diff,
        COALESCE(g.treatment, 'Unreviewed') as gst_treatment,
        COALESCE(g.is_reviewed, false) as gst_reviewed,
        COALESCE(g.needs_recheck, false) as gst_needs_recheck
      FROM bank_txn t
      JOIN bank_statement_accounts a ON a.id = t.bank_account_id
      LEFT JOIN bank_txn_gst g ON g.txn_id = t.id
      WHERE ${whereSql}
      ORDER BY ${orderCol} ${orderDirection}, t.sort_order ${orderDirection}, t.created_at DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx};
    `, ...params, limitNum, offset);

    // Distinct types for filter dropdown
    const typeRows = await prisma.$queryRawUnsafe(`
      SELECT DISTINCT txn_type FROM bank_txn
      WHERE company_id = $1 AND is_deleted = false AND COALESCE(txn_type, '') <> ''
      ORDER BY txn_type ASC;
    `, companyId);

    return res.json({
      success: true,
      data: {
        rows: rows.map((r) => ({
          ...r,
          txn_date: String(r.txn_date).slice(0, 10),
          txn_date_display: formatDisplayDate(String(r.txn_date).slice(0, 10)),
          value_date: r.value_date ? String(r.value_date).slice(0, 10) : '',
          value_date_display: r.value_date ? formatDisplayDate(String(r.value_date).slice(0, 10)) : '',
          debit: Number(r.debit),
          credit: Number(r.credit),
          balance: r.balance !== null ? Number(r.balance) : null
        })),
        summary: {
          count: totalCount,
          totalDebit: paiseToNumber(totalDebitPaise),
          totalCredit: paiseToNumber(totalCreditPaise),
          net: paiseToNumber(netPaise)
        },
        filterMeta: {
          resolvedFrom,
          resolvedTo,
          availableTypes: typeRows.map((tr) => tr.txn_type)
        },
        meta: {
          total: totalCount,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.max(1, Math.ceil(totalCount / limitNum))
        }
      }
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message || 'Failed to fetch transactions.' });
  }
}

/**
 * PUT /transactions/:id (Step 5: Edit saved row with optimistic locking, duplicate protection, GST unreview if date/amt changes, audit log)
 */
async function updateTransaction(req, res) {
  try {
    const companyId = await resolveCompanyId(req);
    const { id } = req.params;
    const payload = req.body || {};
    const expectedVersion = Number(payload.version);

    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
      return res.status(400).json({ success: false, error: 'Valid record version is required for concurrency protection.' });
    }

    const userId = String(req.user?.id || 'SYSTEM');
    const userName = String(req.user?.name || req.user?.email || 'User');

    const updated = await prisma.$transaction(async (tx) => {
      const existingRows = await tx.$queryRawUnsafe(`
        SELECT
          id::text as id,
          bank_account_id::text as bank_account_id,
          txn_date::text as txn_date,
          value_date::text as value_date,
          description,
          ref_no,
          branch_code,
          debit::text as debit,
          credit::text as credit,
          balance::text as balance,
          remarks,
          txn_month,
          fin_year,
          txn_type,
          dedupe_key,
          source_key,
          version
        FROM bank_txn
        WHERE id = $1::uuid AND company_id = $2 AND is_deleted = false
        FOR UPDATE;
      `, id, companyId);

      if (!existingRows || existingRows.length === 0) {
        const err = new Error('Transaction not found.');
        err.statusCode = 404;
        throw err;
      }

      const prev = existingRows[0];
      if (Number(prev.version) !== expectedVersion) {
        const err = new Error('This transaction was updated by another user. Refresh and try again.');
        err.statusCode = 409;
        throw err;
      }

      const targetAccountId = payload.bankAccountId ? Number(payload.bankAccountId) : Number(prev.bank_account_id);
      const acct = await assertAccountBelongsToCompany(tx, companyId, targetAccountId);
      if (!acct) {
        const err = new Error('Target bank account not found.');
        err.statusCode = 404;
        throw err;
      }

      const validated = normalizeAndValidateRow({
        txnDate: payload.txnDate ?? payload.txn_date ?? String(prev.txn_date).slice(0, 10),
        valueDate: payload.valueDate ?? payload.value_date ?? (prev.value_date ? String(prev.value_date).slice(0, 10) : ''),
        description: payload.description ?? prev.description,
        refNo: payload.refNo ?? payload.ref_no ?? prev.ref_no,
        branchCode: payload.branchCode ?? payload.branch_code ?? prev.branch_code,
        debit: payload.debit !== undefined ? payload.debit : prev.debit,
        credit: payload.credit !== undefined ? payload.credit : prev.credit,
        balance: payload.balance !== undefined ? payload.balance : prev.balance,
        remarks: payload.remarks !== undefined ? payload.remarks : prev.remarks,
        type: payload.type !== undefined ? payload.type : (payload.txn_type !== undefined ? payload.txn_type : prev.txn_type),
        // Force recalculation of month and year from updated Txn Date
        month: '',
        year: '',
        sourceKey: prev.source_key // NEVER change source_key!
      }, targetAccountId);

      if (!validated.isValid) {
        const err = new Error(validated.errors.join('; '));
        err.statusCode = 400;
        throw err;
      }

      // Check duplicate excluding self
      const dupCheck = await tx.$queryRawUnsafe(`
        SELECT id::text as id FROM bank_txn
        WHERE company_id = $1 AND bank_account_id = $2::bigint AND dedupe_key = $3 AND is_deleted = false AND id <> $4::uuid
        LIMIT 1;
      `, companyId, targetAccountId, validated.dedupeKey, id);

      if (dupCheck && dupCheck.length > 0) {
        const err = new Error('A transaction with these exact details already exists in this account.');
        err.statusCode = 409;
        throw err;
      }

      const prevDateIso = String(prev.txn_date).slice(0, 10);
      const prevDebitPaise = parseAmountToPaise(prev.debit).paise;
      const prevCreditPaise = parseAmountToPaise(prev.credit).paise;

      const dateOrAmountChanged =
        validated.txnDate !== prevDateIso ||
        validated.debitPaise !== prevDebitPaise ||
        validated.creditPaise !== prevCreditPaise;

      await tx.$executeRawUnsafe(`
        UPDATE bank_txn SET
          bank_account_id = $1::bigint,
          txn_date = $2::date,
          value_date = $3::date,
          description = $4,
          ref_no = $5,
          branch_code = $6,
          debit = $7::decimal,
          credit = $8::decimal,
          balance = $9::decimal,
          remarks = $10,
          txn_month = $11,
          fin_year = $12,
          txn_type = $13,
          mode = $14,
          utr = $15,
          party_name = $16,
          dedupe_key = $17,
          version = version + 1,
          updated_by = $18,
          updated_at = now()
        WHERE id = $19::uuid AND company_id = $20;
      `,
      targetAccountId,
      validated.txnDate,
      validated.valueDate || null,
      validated.description,
      validated.refNo,
      validated.branchCode,
      paiseToDecimalString(validated.debitPaise),
      paiseToDecimalString(validated.creditPaise),
      validated.balancePaise !== null ? paiseToDecimalString(validated.balancePaise) : null,
      validated.remarks,
      validated.month,
      validated.year,
      validated.type,
      validated.mode,
      validated.utr,
      validated.partyName,
      validated.dedupeKey,
      userId,
      id,
      companyId
      );

      if (dateOrAmountChanged) {
        await tx.$executeRawUnsafe(`
          UPDATE bank_txn_gst SET
            is_reviewed = false,
            needs_recheck = true,
            updated_at = now()
          WHERE txn_id = $1::uuid AND company_id = $2;
        `, id, companyId);

        await tx.$executeRawUnsafe(`
          UPDATE bank_txn_invoice_allocations SET
            needs_recheck = true,
            updated_at = now()
          WHERE txn_id = $1::uuid AND company_id = $2 AND is_deleted = false;
        `, id, companyId);
      }

      const afterObj = {
        bankAccountId: targetAccountId,
        txnDate: validated.txnDate,
        valueDate: validated.valueDate,
        description: validated.description,
        refNo: validated.refNo,
        branchCode: validated.branchCode,
        debit: paiseToDecimalString(validated.debitPaise),
        credit: paiseToDecimalString(validated.creditPaise),
        balance: validated.balancePaise !== null ? paiseToDecimalString(validated.balancePaise) : null,
        remarks: validated.remarks,
        month: validated.month,
        year: validated.year,
        type: validated.type,
        dateOrAmountChanged
      };

      await tx.$executeRawUnsafe(`
        INSERT INTO bank_audit_log (
          company_id, action, entity_type, entity_id, txn_id, before_data, after_data, changed_by, changed_by_name
        ) VALUES ($1, 'TXN_EDIT', 'bank_txn', $2, $2::uuid, $3::jsonb, $4::jsonb, $5, $6);
      `, companyId, id, JSON.stringify(prev), JSON.stringify(afterObj), userId, userName);

      return { id, version: expectedVersion + 1, dateOrAmountChanged };
    });

    return res.json({ success: true, data: updated });
  } catch (err) {
    const code = err.statusCode || 500;
    return res.status(code).json({ success: false, error: err.message || 'Failed to update transaction.' });
  }
}

/**
 * DELETE /transactions/:id (Step 5: Soft delete + audit log in one transaction)
 */
async function deleteTransaction(req, res) {
  try {
    const companyId = await resolveCompanyId(req);
    const { id } = req.params;
    const userId = String(req.user?.id || 'SYSTEM');
    const userName = String(req.user?.name || req.user?.email || 'User');

    await prisma.$transaction(async (tx) => {
      const existingRows = await tx.$queryRawUnsafe(`
        SELECT id::text as id, txn_date::text as txn_date, description, debit::text as debit, credit::text as credit
        FROM bank_txn
        WHERE id = $1::uuid AND company_id = $2 AND is_deleted = false
        FOR UPDATE;
      `, id, companyId);

      if (!existingRows || existingRows.length === 0) {
        const err = new Error('Transaction not found.');
        err.statusCode = 404;
        throw err;
      }

      await tx.$executeRawUnsafe(`
        UPDATE bank_txn SET
          is_deleted = true,
          deleted_at = now(),
          deleted_by = $1,
          updated_at = now()
        WHERE id = $2::uuid AND company_id = $3;
      `, userId, id, companyId);

      await tx.$executeRawUnsafe(`
        UPDATE bank_txn_invoice_allocations SET
          is_deleted = true,
          updated_at = now()
        WHERE txn_id = $1::uuid AND company_id = $2;
      `, id, companyId);

      await tx.$executeRawUnsafe(`
        INSERT INTO bank_audit_log (
          company_id, action, entity_type, entity_id, txn_id, before_data, changed_by, changed_by_name
        ) VALUES ($1, 'TXN_DELETE', 'bank_txn', $2, $2::uuid, $3::jsonb, $4, $5);
      `, companyId, id, JSON.stringify(existingRows[0]), userId, userName);
    });

    return res.json({ success: true, message: 'Transaction deleted.' });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ success: false, error: err.message || 'Failed to delete transaction.' });
  }
}

/**
 * GET /audit-logs (Step 4 & Step 5: Change log history)
 */
async function getAuditLogs(req, res) {
  try {
    const companyId = await resolveCompanyId(req);
    const limit = Math.min(200, Math.max(10, parseInt(req.query.limit, 10) || 100));
    const rows = await prisma.$queryRawUnsafe(`
      SELECT
        id::text as id,
        action,
        entity_type,
        entity_id,
        txn_id::text as txn_id,
        batch_id::text as batch_id,
        before_data,
        after_data,
        changed_by,
        changed_by_name,
        changed_at
      FROM bank_audit_log
      WHERE company_id = $1
      ORDER BY changed_at DESC
      LIMIT $2;
    `, companyId, limit);

    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to load change log.' });
  }
}

/**
 * Internal helper to compute GST review dataset (used by both UI GET /gst-review & GST Excel export)
 * Ensures one invoice paid in multiple transactions counts invoice tax ONCE!
 */
async function computeGstWorkingPaper(companyId, { finYear = 'ALL', accountId = 'ALL', pendingOnly = false } = {}) {
  const cond = ['t.company_id = $1', 't.is_deleted = false'];
  const params = [companyId];
  let idx = 2;

  if (finYear && finYear !== 'ALL') {
    cond.push(`t.fin_year = $${idx}`);
    params.push(finYear);
    idx++;
  }
  if (accountId && accountId !== 'ALL') {
    cond.push(`t.bank_account_id = $${idx}::bigint`);
    params.push(Number(accountId));
    idx++;
  }

  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      t.id::text as id,
      t.bank_account_id::text as bank_account_id,
      a.account_name,
      t.txn_date::text as txn_date,
      t.description,
      t.ref_no,
      t.debit::text as debit,
      t.credit::text as credit,
      t.balance::text as balance,
      t.remarks,
      t.txn_month,
      t.fin_year,
      t.txn_type,
      t.mode,
      t.utr,
      t.party_name,
      COALESCE(g.treatment, 'Unreviewed') as treatment,
      COALESCE(g.suggested_treatment, 'Unreviewed') as suggested_treatment,
      COALESCE(g.suggestion_reason, '') as suggestion_reason,
      COALESCE(g.invoice_no, '') as invoice_no,
      g.invoice_date::text as invoice_date,
      COALESCE(g.gstin, '') as gstin,
      COALESCE(g.hsn_sac, '') as hsn_sac,
      COALESCE(g.taxable_amount, 0)::text as taxable_amount,
      COALESCE(g.cgst_amount, 0)::text as cgst_amount,
      COALESCE(g.sgst_amount, 0)::text as sgst_amount,
      COALESCE(g.igst_amount, 0)::text as igst_amount,
      COALESCE(g.total_tax, 0)::text as total_tax,
      COALESCE(g.found_in_gstr2b, 'Not Checked') as found_in_gstr2b,
      COALESCE(g.ims_status, 'Pending') as ims_status,
      COALESCE(g.is_reviewed, false) as is_reviewed,
      COALESCE(g.needs_recheck, false) as needs_recheck,
      COALESCE(g.notes, '') as notes,
      g.reviewed_by_name,
      g.reviewed_at
    FROM bank_txn t
    JOIN bank_statement_accounts a ON a.id = t.bank_account_id
    LEFT JOIN bank_txn_gst g ON g.txn_id = t.id
    WHERE ${cond.join(' AND ')}
    ORDER BY t.txn_date DESC, t.sort_order DESC;
  `, ...params);

  // Fetch allocations for these transactions
  const txnIds = rows.map((r) => r.id);
  let allocRows = [];
  if (txnIds.length > 0) {
    allocRows = await prisma.$queryRawUnsafe(`
      SELECT
        id::text as id,
        txn_id::text as txn_id,
        invoice_source,
        invoice_id,
        invoice_no,
        invoice_date::text as invoice_date,
        party_name,
        party_gstin,
        invoice_taxable::text as invoice_taxable,
        invoice_cgst::text as invoice_cgst,
        invoice_sgst::text as invoice_sgst,
        invoice_igst::text as invoice_igst,
        invoice_total::text as invoice_total,
        allocated_amount::text as allocated_amount,
        needs_recheck
      FROM bank_txn_invoice_allocations
      WHERE company_id = $1 AND is_deleted = false AND txn_id = ANY($2::uuid[])
      ORDER BY created_at ASC;
    `, companyId, txnIds);
  }

  const allocMap = new Map();
  for (const a of allocRows) {
    if (!allocMap.has(a.txn_id)) allocMap.set(a.txn_id, []);
    allocMap.get(a.txn_id).push({
      ...a,
      invoice_date: a.invoice_date ? String(a.invoice_date).slice(0, 10) : '',
      invoice_taxable: Number(a.invoice_taxable),
      invoice_cgst: Number(a.invoice_cgst),
      invoice_sgst: Number(a.invoice_sgst),
      invoice_igst: Number(a.invoice_igst),
      invoice_total: Number(a.invoice_total),
      allocated_amount: Number(a.allocated_amount)
    });
  }

  // Track seen unique ITC invoices so tax is counted ONCE per unique invoice across split payments!
  const seenItcInvoicesComplete = new Set();
  const seenItcInvoicesPending = new Set();
  const itcRegisterMap = new Map();

  let needsReviewCount = 0;
  let docsPendingCount = 0;
  let itcCompletePaise = 0;
  let itcPendingPaise = 0;
  let salesReceiptsPaise = 0;

  const monthlyMap = new Map();

  const enrichedEntries = rows.map((r) => {
    const debitPaise = parseAmountToPaise(r.debit).paise;
    const creditPaise = parseAmountToPaise(r.credit).paise;
    const cgstPaise = parseAmountToPaise(r.cgst_amount).paise;
    const sgstPaise = parseAmountToPaise(r.sgst_amount).paise;
    const igstPaise = parseAmountToPaise(r.igst_amount).paise;
    const taxablePaise = parseAmountToPaise(r.taxable_amount).paise;
    const totalTaxPaise = cgstPaise + sgstPaise + igstPaise;

    const allocs = allocMap.get(r.id) || [];
    const gstinCheck = r.gstin ? validateGstin(r.gstin) : { valid: false, isBlank: true };

    const isItcVerify = r.treatment === 'Purchase: ITC to verify';
    const isDocsComplete = Boolean(
      r.is_reviewed &&
      isItcVerify &&
      r.invoice_no.trim() !== '' &&
      Boolean(r.invoice_date) &&
      !gstinCheck.isBlank &&
      gstinCheck.valid &&
      totalTaxPaise > 0 &&
      r.found_in_gstr2b === 'Yes'
    );

    const needsReview = !r.is_reviewed || r.treatment === 'Unreviewed' || Boolean(r.needs_recheck);
    const docsPending = isItcVerify && !isDocsComplete;

    if (needsReview) needsReviewCount++;
    if (docsPending) docsPendingCount++;

    if (r.is_reviewed && r.treatment === 'Sales receipt') {
      salesReceiptsPaise += creditPaise;
    }

    // Deduplicate invoice tax across multiple payments
    let rowItcTaxPaise = 0;
    if (allocs.length > 0 && (isItcVerify || isDocsComplete)) {
      for (const al of allocs) {
        const invKey = `${al.invoice_source || 'INV'}|${(al.party_gstin || r.gstin || '').toUpperCase()}|${al.invoice_no.trim().toUpperCase()}`;
        const invTaxP =
          parseAmountToPaise(al.invoice_cgst).paise +
          parseAmountToPaise(al.invoice_sgst).paise +
          parseAmountToPaise(al.invoice_igst).paise;

        if (!itcRegisterMap.has(invKey)) {
          itcRegisterMap.set(invKey, {
            invoice_source: al.invoice_source,
            invoice_no: al.invoice_no,
            invoice_date: al.invoice_date,
            party_name: al.party_name || r.party_name,
            gstin: al.party_gstin || r.gstin,
            hsn_sac: r.hsn_sac,
            taxable: al.invoice_taxable,
            cgst: al.invoice_cgst,
            sgst: al.invoice_sgst,
            igst: al.invoice_igst,
            total_tax: paiseToNumber(invTaxP),
            invoice_total: al.invoice_total,
            found_in_gstr2b: r.found_in_gstr2b,
            ims_status: r.ims_status,
            docs_complete: isDocsComplete,
            payments_count: 1,
            allocated_total: al.allocated_amount,
            txn_refs: [r.utr || r.ref_no || formatDisplayDate(r.txn_date)]
          });
        } else {
          const existingReg = itcRegisterMap.get(invKey);
          existingReg.payments_count += 1;
          existingReg.allocated_total = paiseToNumber(
            parseAmountToPaise(existingReg.allocated_total).paise + parseAmountToPaise(al.allocated_amount).paise
          );
          existingReg.txn_refs.push(r.utr || r.ref_no || formatDisplayDate(r.txn_date));
        }

        if (isDocsComplete) {
          if (!seenItcInvoicesComplete.has(invKey)) {
            seenItcInvoicesComplete.add(invKey);
            itcCompletePaise += invTaxP;
            rowItcTaxPaise += invTaxP;
          }
        } else if (isItcVerify) {
          if (!seenItcInvoicesPending.has(invKey)) {
            seenItcInvoicesPending.add(invKey);
            itcPendingPaise += invTaxP > 0 ? invTaxP : totalTaxPaise;
            rowItcTaxPaise += invTaxP > 0 ? invTaxP : totalTaxPaise;
          }
        }
      }
    } else if (isItcVerify) {
      const invKey = r.invoice_no.trim()
        ? `SINGLE|${r.gstin.trim().toUpperCase()}|${r.invoice_no.trim().toUpperCase()}`
        : `TXN|${r.id}`;
      if (!itcRegisterMap.has(invKey) && (r.invoice_no.trim() || totalTaxPaise > 0)) {
        itcRegisterMap.set(invKey, {
          invoice_source: 'DIRECT',
          invoice_no: r.invoice_no || 'N/A',
          invoice_date: r.invoice_date ? String(r.invoice_date).slice(0, 10) : '',
          party_name: r.party_name,
          gstin: r.gstin,
          hsn_sac: r.hsn_sac,
          taxable: paiseToNumber(taxablePaise),
          cgst: paiseToNumber(cgstPaise),
          sgst: paiseToNumber(sgstPaise),
          igst: paiseToNumber(igstPaise),
          total_tax: paiseToNumber(totalTaxPaise),
          invoice_total: paiseToNumber(taxablePaise + totalTaxPaise),
          found_in_gstr2b: r.found_in_gstr2b,
          ims_status: r.ims_status,
          docs_complete: isDocsComplete,
          payments_count: 1,
          allocated_total: paiseToNumber(debitPaise),
          txn_refs: [r.utr || r.ref_no || formatDisplayDate(r.txn_date)]
        });
      }

      if (isDocsComplete) {
        if (!seenItcInvoicesComplete.has(invKey)) {
          seenItcInvoicesComplete.add(invKey);
          itcCompletePaise += totalTaxPaise;
          rowItcTaxPaise = totalTaxPaise;
        }
      } else {
        if (!seenItcInvoicesPending.has(invKey)) {
          seenItcInvoicesPending.add(invKey);
          itcPendingPaise += totalTaxPaise;
          rowItcTaxPaise = totalTaxPaise;
        }
      }
    }

    // Monthly Aggregation
    const monthKey = `${r.txn_month} (${r.fin_year})`;
    if (!monthlyMap.has(monthKey)) {
      monthlyMap.set(monthKey, {
        month: r.txn_month,
        finYear: r.fin_year,
        monthOrder: MONTH_NAMES.indexOf(r.txn_month),
        entries: 0,
        creditPaise: 0,
        debitPaise: 0,
        salesReceiptsPaise: 0,
        itcCompletePaise: 0,
        itcPendingPaise: 0,
        needsReviewCount: 0
      });
    }
    const mAgg = monthlyMap.get(monthKey);
    mAgg.entries += 1;
    mAgg.creditPaise += creditPaise;
    mAgg.debitPaise += debitPaise;
    if (r.is_reviewed && r.treatment === 'Sales receipt') mAgg.salesReceiptsPaise += creditPaise;
    if (isDocsComplete) mAgg.itcCompletePaise += rowItcTaxPaise;
    else if (isItcVerify) mAgg.itcPendingPaise += rowItcTaxPaise;
    if (needsReview) mAgg.needsReviewCount += 1;

    return {
      ...r,
      txn_date: String(r.txn_date).slice(0, 10),
      txn_date_display: formatDisplayDate(String(r.txn_date).slice(0, 10)),
      invoice_date: r.invoice_date ? String(r.invoice_date).slice(0, 10) : '',
      debit: paiseToNumber(debitPaise),
      credit: paiseToNumber(creditPaise),
      taxable_amount: paiseToNumber(taxablePaise),
      cgst_amount: paiseToNumber(cgstPaise),
      sgst_amount: paiseToNumber(sgstPaise),
      igst_amount: paiseToNumber(igstPaise),
      total_tax: paiseToNumber(totalTaxPaise),
      allocations: allocs,
      needs_review: needsReview,
      docs_complete: isDocsComplete,
      docs_pending: docsPending
    };
  });

  // Sort months in FY order (Apr..Mar)
  const fyMonthRank = (mIdx) => (mIdx >= 3 ? mIdx - 3 : mIdx + 9);
  const monthlySummary = Array.from(monthlyMap.values())
    .sort((a, b) => a.finYear.localeCompare(b.finYear) || fyMonthRank(a.monthOrder) - fyMonthRank(b.monthOrder))
    .map((m) => ({
      month: m.month,
      finYear: m.finYear,
      entries: m.entries,
      credit: paiseToNumber(m.creditPaise),
      debit: paiseToNumber(m.debitPaise),
      salesReceipts: paiseToNumber(m.salesReceiptsPaise),
      itcComplete: paiseToNumber(m.itcCompletePaise),
      itcPending: paiseToNumber(m.itcPendingPaise),
      needsReviewCount: m.needsReviewCount
    }));

  const filteredEntries = pendingOnly
    ? enrichedEntries.filter((e) => e.needs_review || e.docs_pending)
    : enrichedEntries;

  // Distinct available FYs
  const fyRows = await prisma.$queryRawUnsafe(`
    SELECT DISTINCT fin_year FROM bank_txn
    WHERE company_id = $1 AND is_deleted = false AND COALESCE(fin_year, '') <> ''
    ORDER BY fin_year DESC;
  `, companyId);

  return {
    kpis: {
      entries: enrichedEntries.length,
      needsReview: needsReviewCount,
      docsPending: docsPendingCount,
      itcDocsComplete: paiseToNumber(itcCompletePaise),
      itcDocsPending: paiseToNumber(itcPendingPaise),
      salesReceipts: paiseToNumber(salesReceiptsPaise)
    },
    monthlySummary,
    entries: filteredEntries,
    allEntries: enrichedEntries,
    itcRegister: Array.from(itcRegisterMap.values()),
    availableFinYears: fyRows.map((x) => x.fin_year)
  };
}

/**
 * GET /gst-review
 */
async function getGstReview(req, res) {
  try {
    const companyId = await resolveCompanyId(req);
    const { finYear = 'ALL', accountId = 'ALL', pendingOnly = 'false' } = req.query;
    const data = await computeGstWorkingPaper(companyId, {
      finYear,
      accountId,
      pendingOnly: String(pendingOnly) === 'true'
    });
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[bankStatement.getGstReview]', err.message);
    return res.status(500).json({ success: false, error: 'Failed to load GST review data.' });
  }
}

/**
 * PUT /gst-review/:txnId (Step 6: Save GST treatment, invoice details, allocations & audit log atomically)
 */
async function updateGstReview(req, res) {
  try {
    const companyId = await resolveCompanyId(req);
    const { txnId } = req.params;
    const {
      treatment = 'Unreviewed',
      invoiceNo = '',
      invoiceDate = '',
      gstin = '',
      hsnSac = '',
      taxableAmount = 0,
      cgstAmount = 0,
      sgstAmount = 0,
      igstAmount = 0,
      foundInGstr2b = 'Not Checked',
      imsStatus = 'Pending',
      notes = '',
      allocations = []
    } = req.body || {};

    if (!VALID_TREATMENTS.includes(treatment)) {
      return res.status(400).json({ success: false, error: `Invalid GST treatment "${treatment}".` });
    }

    // GSTIN format & check digit validation
    const gstCheck = validateGstin(gstin);
    if (!gstCheck.valid) {
      return res.status(400).json({ success: false, error: gstCheck.error });
    }

    let parsedInvDate = null;
    if (invoiceDate && String(invoiceDate).trim()) {
      const dRes = parseStatementDate(invoiceDate);
      if (!dRes.ok) {
        return res.status(400).json({ success: false, error: `Invoice date: ${dRes.error}` });
      }
      parsedInvDate = dRes.iso;
    }

    const taxRes = parseAmountToPaise(taxableAmount, { allowBlank: true, allowZero: true, allowNegative: false });
    const cgstRes = parseAmountToPaise(cgstAmount, { allowBlank: true, allowZero: true, allowNegative: false });
    const sgstRes = parseAmountToPaise(sgstAmount, { allowBlank: true, allowZero: true, allowNegative: false });
    const igstRes = parseAmountToPaise(igstAmount, { allowBlank: true, allowZero: true, allowNegative: false });

    if (!taxRes.ok || !cgstRes.ok || !sgstRes.ok || !igstRes.ok) {
      return res.status(400).json({ success: false, error: 'GST tax and taxable amounts must be non-negative valid numbers.' });
    }

    if (igstRes.paise > 0 && (cgstRes.paise > 0 || sgstRes.paise > 0)) {
      return res.status(400).json({ success: false, error: 'Use either IGST OR CGST + SGST, not both.' });
    }

    if (cgstRes.paise !== sgstRes.paise) {
      return res.status(400).json({ success: false, error: 'CGST must equal SGST.' });
    }

    const totalTaxPaise = cgstRes.paise + sgstRes.paise + igstRes.paise;
    const userId = String(req.user?.id || 'SYSTEM');
    const userName = String(req.user?.name || req.user?.email || 'User');

    const saved = await prisma.$transaction(async (tx) => {
      const txnRows = await tx.$queryRawUnsafe(`
        SELECT id::text as id, debit::text as debit, credit::text as credit
        FROM bank_txn
        WHERE id = $1::uuid AND company_id = $2 AND is_deleted = false
        FOR UPDATE;
      `, txnId, companyId);

      if (!txnRows || txnRows.length === 0) {
        const err = new Error('Transaction not found.');
        err.statusCode = 404;
        throw err;
      }

      const prevGstRows = await tx.$queryRawUnsafe(`
        SELECT * FROM bank_txn_gst WHERE txn_id = $1::uuid AND company_id = $2 LIMIT 1;
      `, txnId, companyId);

      const isReviewed = treatment !== 'Unreviewed';

      await tx.$executeRawUnsafe(`
        INSERT INTO bank_txn_gst (
          company_id, txn_id, treatment, invoice_no, invoice_date, gstin, hsn_sac,
          taxable_amount, cgst_amount, sgst_amount, igst_amount, total_tax,
          found_in_gstr2b, ims_status, is_reviewed, needs_recheck, notes,
          reviewed_by, reviewed_by_name, reviewed_at, updated_at
        ) VALUES (
          $1, $2::uuid, $3, $4, $5::date, $6, $7,
          $8::decimal, $9::decimal, $10::decimal, $11::decimal, $12::decimal,
          $13, $14, $15, false, $16,
          $17, $18, now(), now()
        )
        ON CONFLICT (txn_id) DO UPDATE SET
          treatment = EXCLUDED.treatment,
          invoice_no = EXCLUDED.invoice_no,
          invoice_date = EXCLUDED.invoice_date,
          gstin = EXCLUDED.gstin,
          hsn_sac = EXCLUDED.hsn_sac,
          taxable_amount = EXCLUDED.taxable_amount,
          cgst_amount = EXCLUDED.cgst_amount,
          sgst_amount = EXCLUDED.sgst_amount,
          igst_amount = EXCLUDED.igst_amount,
          total_tax = EXCLUDED.total_tax,
          found_in_gstr2b = EXCLUDED.found_in_gstr2b,
          ims_status = EXCLUDED.ims_status,
          is_reviewed = EXCLUDED.is_reviewed,
          needs_recheck = false,
          notes = EXCLUDED.notes,
          reviewed_by = EXCLUDED.reviewed_by,
          reviewed_by_name = EXCLUDED.reviewed_by_name,
          reviewed_at = now(),
          updated_at = now();
      `,
      companyId,
      txnId,
      treatment,
      String(invoiceNo).trim(),
      parsedInvDate,
      gstCheck.cleaned,
      String(hsnSac).trim(),
      taxRes.decimalStr,
      cgstRes.decimalStr,
      sgstRes.decimalStr,
      igstRes.decimalStr,
      paiseToDecimalString(totalTaxPaise),
      String(foundInGstr2b || 'Not Checked'),
      String(imsStatus || 'Pending'),
      isReviewed,
      String(notes).trim(),
      userId,
      userName
      );

      // Replace active invoice allocations in link table
      await tx.$executeRawUnsafe(`
        UPDATE bank_txn_invoice_allocations SET is_deleted = true, updated_at = now()
        WHERE txn_id = $1::uuid AND company_id = $2 AND is_deleted = false;
      `, txnId, companyId);

      if (Array.isArray(allocations)) {
        for (const al of allocations) {
          if (!al.invoiceNo && !al.invoice_no) continue;
          const invDateRes = (al.invoiceDate || al.invoice_date)
            ? parseStatementDate(al.invoiceDate || al.invoice_date)
            : { ok: true, iso: null };

          const alAmt = parseAmountToPaise(al.allocatedAmount ?? al.allocated_amount ?? 0, { allowBlank: true, allowZero: true, allowNegative: false });
          const invTaxable = parseAmountToPaise(al.invoiceTaxable ?? al.invoice_taxable ?? 0);
          const invCgst = parseAmountToPaise(al.invoiceCgst ?? al.invoice_cgst ?? 0);
          const invSgst = parseAmountToPaise(al.invoiceSgst ?? al.invoice_sgst ?? 0);
          const invIgst = parseAmountToPaise(al.invoiceIgst ?? al.invoice_igst ?? 0);
          const invTotal = parseAmountToPaise(al.invoiceTotal ?? al.invoice_total ?? 0);

          await tx.$executeRawUnsafe(`
            INSERT INTO bank_txn_invoice_allocations (
              company_id, txn_id, invoice_source, invoice_id, invoice_no, invoice_date,
              party_name, party_gstin, invoice_taxable, invoice_cgst, invoice_sgst, invoice_igst,
              invoice_total, allocated_amount, needs_recheck, created_by
            ) VALUES (
              $1, $2::uuid, $3, $4, $5, $6::date,
              $7, $8, $9::decimal, $10::decimal, $11::decimal, $12::decimal,
              $13::decimal, $14::decimal, false, $15
            );
          `,
          companyId,
          txnId,
          String(al.invoiceSource || al.invoice_source || 'MANUAL'),
          al.invoiceId || al.invoice_id || null,
          String(al.invoiceNo || al.invoice_no).trim(),
          invDateRes.ok ? invDateRes.iso : null,
          String(al.partyName || al.party_name || '').trim(),
          String(al.partyGstin || al.party_gstin || gstCheck.cleaned).trim().toUpperCase(),
          invTaxable.decimalStr,
          invCgst.decimalStr,
          invSgst.decimalStr,
          invIgst.decimalStr,
          invTotal.decimalStr,
          alAmt.decimalStr,
          userId
          );
        }
      }

      const afterData = {
        treatment,
        invoiceNo,
        invoiceDate: parsedInvDate,
        gstin: gstCheck.cleaned,
        hsnSac,
        taxableAmount: taxRes.decimalStr,
        cgstAmount: cgstRes.decimalStr,
        sgstAmount: sgstRes.decimalStr,
        igstAmount: igstRes.decimalStr,
        foundInGstr2b,
        imsStatus,
        allocationsCount: Array.isArray(allocations) ? allocations.length : 0
      };

      await tx.$executeRawUnsafe(`
        INSERT INTO bank_audit_log (
          company_id, action, entity_type, entity_id, txn_id, before_data, after_data, changed_by, changed_by_name
        ) VALUES ($1, 'GST_REVIEW', 'bank_txn_gst', $2, $2::uuid, $3::jsonb, $4::jsonb, $5, $6);
      `, companyId, txnId, JSON.stringify(prevGstRows?.[0] || {}), JSON.stringify(afterData), userId, userName);

      return afterData;
    });

    return res.json({ success: true, data: saved });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ success: false, error: err.message || 'Failed to save GST review.' });
  }
}

/**
 * Query unified ERP Invoices (Sales, Purchases, Asset AP Invoices, Expenses, Credit/Debit Notes, GSTR-2B)
 */
async function fetchUnifiedErpInvoices(companyId, { search = '', from = null, to = null } = {}) {
  const searchTrim = String(search || '').trim();
  const hasSearch = searchTrim.length > 0;
  const like = `%${searchTrim}%`;

  const rows = await prisma.$queryRawUnsafe(`
    WITH erp_inv AS (
      -- Sales Orders / Invoices (including unpaid & cash invoices)
      SELECT
        'SALES_ORDER'::text as invoice_source,
        co.id as invoice_id,
        COALESCE(co.doc_no, co.reference_no) as invoice_no,
        co.created_at::date as invoice_date,
        COALESCE(c.name, co.customer_name, 'Customer') as party_name,
        COALESCE(c.gstin, p.gstin, '') as party_gstin,
        'Sales / Output'::text as nature,
        ROUND(COALESCE(co.total_subtotal, 0), 2) as taxable_amount,
        ROUND(COALESCE(co.cgst, 0), 2) as cgst_amount,
        ROUND(COALESCE(co.sgst, 0), 2) as sgst_amount,
        ROUND(COALESCE(co.igst, 0), 2) as igst_amount,
        ROUND(COALESCE(co.grand_total, 0), 2) as invoice_total,
        COALESCE(co.payment_status, 'UNPAID') as payment_status
      FROM customer_orders co
      LEFT JOIN "Customer" c ON c.id = co.customer_id
      LEFT JOIN parties p ON p.id = co.customer_id
      WHERE co.deleted_at IS NULL AND co.type IN ('Sales Order', 'Invoice')

      UNION ALL

      -- Raw Material Purchase Orders / Supplier Invoices
      SELECT
        'PURCHASE_ORDER'::text as invoice_source,
        po.id as invoice_id,
        COALESCE(po.supplier_invoice_no, po."referenceNo") as invoice_no,
        COALESCE(po.supplier_invoice_date::date, po."createdAt"::date) as invoice_date,
        COALESCE(s.name, p.name, 'Supplier') as party_name,
        COALESCE(s.gstin, p.gstin, '') as party_gstin,
        'Purchase / Input'::text as nature,
        ROUND(COALESCE(po.subtotal, 0), 2) as taxable_amount,
        ROUND(COALESCE(po.cgst, 0), 2) as cgst_amount,
        ROUND(COALESCE(po.sgst, 0), 2) as sgst_amount,
        ROUND(COALESCE(po.igst, 0), 2) as igst_amount,
        ROUND(COALESCE(po.grand_total, 0), 2) as invoice_total,
        COALESCE(po."paymentStatus", 'UNPAID') as payment_status
      FROM "RawMaterialPO" po
      LEFT JOIN "Supplier" s ON s.id = po."supplierId"
      LEFT JOIN parties p ON p.id = po."supplierId"
      WHERE po."deletedAt" IS NULL

      UNION ALL

      -- Asset A/P Invoices
      SELECT
        'ASSET_AP_INVOICE'::text as invoice_source,
        ai.id as invoice_id,
        COALESCE(ai.vendor_invoice_no, ai.invoice_no) as invoice_no,
        ai.vendor_invoice_date::date as invoice_date,
        ai.vendor_name as party_name,
        COALESCE(ai.vendor_gstin, '') as party_gstin,
        'Asset Purchase / Input'::text as nature,
        ROUND(COALESCE(ai.taxable_amount, 0), 2) as taxable_amount,
        ROUND(COALESCE(ai.total_cgst, 0), 2) as cgst_amount,
        ROUND(COALESCE(ai.total_sgst, 0), 2) as sgst_amount,
        ROUND(COALESCE(ai.total_igst, 0), 2) as igst_amount,
        ROUND(COALESCE(ai.invoice_total, 0), 2) as invoice_total,
        COALESCE(ai.status, 'Open') as payment_status
      FROM asset_ap_invoices ai

      UNION ALL

      -- Operating / Supplier Expenses with GST
      SELECT
        'EXPENSE'::text as invoice_source,
        e.id as invoice_id,
        COALESCE(e."invoiceNo", e."expenseNumber", e.id) as invoice_no,
        COALESCE(e."invoiceDate"::date, e.date::date) as invoice_date,
        COALESCE(e."supplierName", e.title, e.category) as party_name,
        COALESCE(e."supplierGstin", '') as party_gstin,
        'Expense / Input'::text as nature,
        ROUND(COALESCE(e."taxableAmount", e.amount, 0), 2) as taxable_amount,
        ROUND(COALESCE(e."cgstAmount", 0), 2) as cgst_amount,
        ROUND(COALESCE(e."sgstAmount", 0), 2) as sgst_amount,
        ROUND(COALESCE(e."igstAmount", 0), 2) as igst_amount,
        ROUND(COALESCE(e."totalAmount", e.amount, 0), 2) as invoice_total,
        COALESCE(e."paymentStatus", 'PAID') as payment_status
      FROM "Expense" e

      UNION ALL

      -- Sales Returns (Credit Notes)
      SELECT
        'SALES_RETURN'::text as invoice_source,
        sr.id as invoice_id,
        sr.return_no as invoice_no,
        sr.created_at::date as invoice_date,
        COALESCE(co.customer_name, 'Customer Return') as party_name,
        ''::text as party_gstin,
        'Credit Note'::text as nature,
        ROUND(COALESCE(sr.refund_amount, 0), 2) as taxable_amount,
        0::decimal as cgst_amount,
        0::decimal as sgst_amount,
        0::decimal as igst_amount,
        ROUND(COALESCE(sr.refund_amount, 0), 2) as invoice_total,
        sr.status as payment_status
      FROM sales_returns sr
      LEFT JOIN customer_orders co ON co.id = sr.invoice_id

      UNION ALL

      -- Purchase Returns (Debit Notes)
      SELECT
        'PURCHASE_RETURN'::text as invoice_source,
        pr.id as invoice_id,
        COALESCE(pr."debitNoteNumber", pr."referenceNo") as invoice_no,
        pr."returnDate"::date as invoice_date,
        COALESCE(s.name, 'Supplier Return') as party_name,
        COALESCE(s.gstin, '') as party_gstin,
        'Debit Note'::text as nature,
        0::decimal as taxable_amount,
        0::decimal as cgst_amount,
        0::decimal as sgst_amount,
        0::decimal as igst_amount,
        0::decimal as invoice_total,
        pr.status as payment_status
      FROM "PurchaseReturn" pr
      LEFT JOIN "RawMaterialPO" po ON po.id = pr."poId"
      LEFT JOIN "Supplier" s ON s.id = po."supplierId"

      UNION ALL

      -- Imported GSTR-2B Entries
      SELECT
        'GSTR2B'::text as invoice_source,
        g2.id::text as invoice_id,
        g2.invoice_no,
        g2.invoice_date,
        g2.supplier_name as party_name,
        g2.supplier_gstin as party_gstin,
        'GSTR-2B Portal'::text as nature,
        g2.taxable_amount,
        g2.cgst_amount,
        g2.sgst_amount,
        g2.igst_amount,
        g2.invoice_value as invoice_total,
        g2.itc_availability as payment_status
      FROM bank_gstr2b_entries g2
      WHERE g2.company_id = $1
    )
    SELECT
      *,
      EXISTS (
        SELECT 1 FROM bank_gstr2b_entries gb
        WHERE gb.company_id = $1
          AND UPPER(gb.invoice_no) = UPPER(erp_inv.invoice_no)
          AND (erp_inv.party_gstin = '' OR UPPER(gb.supplier_gstin) = UPPER(erp_inv.party_gstin))
      ) as in_gstr2b
    FROM erp_inv
    WHERE ($2::boolean = false OR invoice_no ILIKE $3 OR party_name ILIKE $3 OR party_gstin ILIKE $3)
      AND ($4::date IS NULL OR invoice_date >= $4::date)
      AND ($5::date IS NULL OR invoice_date <= $5::date)
    ORDER BY invoice_date DESC NULLS LAST, invoice_no ASC
    LIMIT 250;
  `, companyId, hasSearch, like, from || null, to || null);

  return rows.map((r) => ({
    ...r,
    invoice_date: r.invoice_date ? String(r.invoice_date).slice(0, 10) : '',
    taxable_amount: Number(r.taxable_amount || 0),
    cgst_amount: Number(r.cgst_amount || 0),
    sgst_amount: Number(r.sgst_amount || 0),
    igst_amount: Number(r.igst_amount || 0),
    invoice_total: Number(r.invoice_total || 0),
    in_gstr2b: Boolean(r.in_gstr2b)
  }));
}

/**
 * GET /erp-invoices
 */
async function searchErpInvoices(req, res) {
  try {
    const companyId = await resolveCompanyId(req);
    const { search = '', from = null, to = null } = req.query;
    const rows = await fetchUnifiedErpInvoices(companyId, { search, from, to });
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[bankStatement.searchErpInvoices]', err.message);
    return res.status(500).json({ success: false, error: 'Failed to search ERP invoices.' });
  }
}

/**
 * POST /gstr2b/import
 */
async function importGstr2b(req, res) {
  try {
    const companyId = await resolveCompanyId(req);
    const { entries = [] } = req.body || {};
    let parsedEntries = Array.isArray(entries) ? entries : [];

    if (req.file) {
      const grid = parseFileBufferToGrid(req.file.buffer, req.file.originalname || 'gstr2b.xlsx');
      if (grid.length > 1) {
        const header = grid[0].map((h) => String(h || '').toLowerCase().replace(/[^a-z0-9]/g, ''));
        const idxGstin = header.findIndex((h) => h.includes('gstin'));
        const idxName = header.findIndex((h) => h.includes('supplier') || h.includes('name') || h.includes('trade'));
        const idxInv = header.findIndex((h) => h.includes('invoiceno') || h === 'invno' || h.includes('invoicenumber'));
        const idxDate = header.findIndex((h) => h.includes('date'));
        const idxTaxable = header.findIndex((h) => h.includes('taxable'));
        const idxCgst = header.findIndex((h) => h.includes('cgst'));
        const idxSgst = header.findIndex((h) => h.includes('sgst'));
        const idxIgst = header.findIndex((h) => h.includes('igst'));
        const idxVal = header.findIndex((h) => h.includes('value') || h.includes('total'));

        parsedEntries = [];
        for (let i = 1; i < grid.length; i++) {
          const row = grid[i];
          const gstin = idxGstin >= 0 ? String(row[idxGstin] || '').trim().toUpperCase() : '';
          const invNo = idxInv >= 0 ? String(row[idxInv] || '').trim() : '';
          if (!gstin || !invNo) continue;
          const dtRes = idxDate >= 0 ? parseStatementDate(row[idxDate]) : { ok: false, iso: null };
          parsedEntries.push({
            supplierGstin: gstin,
            supplierName: idxName >= 0 ? String(row[idxName] || '').trim() : '',
            invoiceNo: invNo,
            invoiceDate: dtRes.ok ? dtRes.iso : null,
            taxableAmount: idxTaxable >= 0 ? parseAmountToPaise(row[idxTaxable]).decimalStr : '0.00',
            cgstAmount: idxCgst >= 0 ? parseAmountToPaise(row[idxCgst]).decimalStr : '0.00',
            sgstAmount: idxSgst >= 0 ? parseAmountToPaise(row[idxSgst]).decimalStr : '0.00',
            igstAmount: idxIgst >= 0 ? parseAmountToPaise(row[idxIgst]).decimalStr : '0.00',
            invoiceValue: idxVal >= 0 ? parseAmountToPaise(row[idxVal]).decimalStr : '0.00'
          });
        }
      }
    }

    if (parsedEntries.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid GSTR-2B rows found to import.' });
    }

    const userId = String(req.user?.id || 'SYSTEM');
    const userName = String(req.user?.name || req.user?.email || 'User');

    await prisma.$transaction(async (tx) => {
      for (const e of parsedEntries) {
        const dtRes = e.invoiceDate ? parseStatementDate(e.invoiceDate) : { ok: false, iso: null };
        const fy = dtRes.ok ? getMonthAndFY(dtRes.iso).finYear : (e.finYear || '');

        await tx.$executeRawUnsafe(`
          INSERT INTO bank_gstr2b_entries (
            company_id, fin_year, return_period, supplier_gstin, supplier_name, invoice_no, invoice_date,
            taxable_amount, cgst_amount, sgst_amount, igst_amount, invoice_value, itc_availability, ims_status, uploaded_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8::decimal, $9::decimal, $10::decimal, $11::decimal, $12::decimal, $13, $14, $15)
          ON CONFLICT (company_id, supplier_gstin, invoice_no) DO UPDATE SET
            taxable_amount = EXCLUDED.taxable_amount,
            cgst_amount = EXCLUDED.cgst_amount,
            sgst_amount = EXCLUDED.sgst_amount,
            igst_amount = EXCLUDED.igst_amount,
            invoice_value = EXCLUDED.invoice_value,
            itc_availability = EXCLUDED.itc_availability,
            ims_status = EXCLUDED.ims_status,
            uploaded_at = now();
        `,
        companyId,
        fy,
        String(e.returnPeriod || ''),
        String(e.supplierGstin || '').trim().toUpperCase(),
        String(e.supplierName || '').trim(),
        String(e.invoiceNo || '').trim(),
        dtRes.ok ? dtRes.iso : null,
        parseAmountToPaise(e.taxableAmount).decimalStr,
        parseAmountToPaise(e.cgstAmount).decimalStr,
        parseAmountToPaise(e.sgstAmount).decimalStr,
        parseAmountToPaise(e.igstAmount).decimalStr,
        parseAmountToPaise(e.invoiceValue).decimalStr,
        String(e.itcAvailability || 'Yes'),
        String(e.imsStatus || 'Pending'),
        userId
        );
      }

      await tx.$executeRawUnsafe(`
        INSERT INTO bank_audit_log (
          company_id, action, entity_type, after_data, changed_by, changed_by_name
        ) VALUES ($1, 'GSTR2B_IMPORT', 'bank_gstr2b_entries', $2::jsonb, $3, $4);
      `, companyId, JSON.stringify({ importedRows: parsedEntries.length }), userId, userName);
    });

    return res.json({ success: true, importedCount: parsedEntries.length });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message || 'Failed to import GSTR-2B.' });
  }
}

/**
 * GET /export/transactions (Step 7: Export all filtered rows + 12 original columns + Account + Total row)
 */
async function exportTransactionsExcel(req, res) {
  try {
    const companyId = await resolveCompanyId(req);
    const { whereSql, params } = buildTransactionFilterWhere(companyId, req.query);

    const rows = await prisma.$queryRawUnsafe(`
      SELECT
        a.account_name,
        a.account_number,
        t.txn_date::text as txn_date,
        t.value_date::text as value_date,
        t.description,
        t.ref_no,
        t.branch_code,
        t.debit::text as debit,
        t.credit::text as credit,
        t.balance::text as balance,
        t.remarks,
        t.txn_month,
        t.fin_year,
        t.txn_type
      FROM bank_txn t
      JOIN bank_statement_accounts a ON a.id = t.bank_account_id
      WHERE ${whereSql}
      ORDER BY t.txn_date ASC, t.sort_order ASC, t.created_at ASC;
    `, ...params);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Manufacturing ERP';
    const ws = wb.addWorksheet('Bank Transactions');

    ws.columns = [
      { header: 'Account', key: 'account', width: 28 },
      { header: 'Txn Date', key: 'txnDate', width: 14 },
      { header: 'Value Date', key: 'valueDate', width: 14 },
      { header: 'Description', key: 'description', width: 42 },
      { header: 'Ref No./Cheque No.', key: 'refNo', width: 26 },
      { header: 'Branch Code', key: 'branchCode', width: 14 },
      { header: 'Debit', key: 'debit', width: 16 },
      { header: 'Credit', key: 'credit', width: 16 },
      { header: 'Balance', key: 'balance', width: 18 },
      { header: 'Remarks', key: 'remarks', width: 26 },
      { header: 'Month', key: 'month', width: 12 },
      { header: 'Year', key: 'year', width: 10 },
      { header: 'Type', key: 'type', width: 14 }
    ];

    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111A36' } };

    let totalDebitPaise = 0;
    let totalCreditPaise = 0;

    for (const r of rows) {
      const drP = parseAmountToPaise(r.debit).paise;
      const crP = parseAmountToPaise(r.credit).paise;
      const balP = r.balance !== null ? parseAmountToPaise(r.balance, { allowNegative: true }).paise : null;
      totalDebitPaise += drP;
      totalCreditPaise += crP;

      const added = ws.addRow({
        account: sanitizeSpreadsheetCell(`${r.account_name}${r.account_number ? ` (${r.account_number})` : ''}`),
        txnDate: formatDisplayDate(String(r.txn_date).slice(0, 10)),
        valueDate: r.value_date ? formatDisplayDate(String(r.value_date).slice(0, 10)) : '',
        description: sanitizeSpreadsheetCell(r.description),
        refNo: sanitizeSpreadsheetCell(String(r.ref_no || '')),
        branchCode: sanitizeSpreadsheetCell(String(r.branch_code || '')),
        debit: drP > 0 ? paiseToNumber(drP) : null,
        credit: crP > 0 ? paiseToNumber(crP) : null,
        balance: balP !== null ? paiseToNumber(balP) : null,
        remarks: sanitizeSpreadsheetCell(r.remarks),
        month: sanitizeSpreadsheetCell(r.txn_month),
        year: sanitizeSpreadsheetCell(r.fin_year),
        type: sanitizeSpreadsheetCell(r.txn_type)
      });

      // Keep Account & Ref columns strictly text
      added.getCell('refNo').numFmt = '@';
      added.getCell('branchCode').numFmt = '@';
      added.getCell('account').numFmt = '@';
      added.getCell('debit').numFmt = '#,##,##0.00';
      added.getCell('credit').numFmt = '#,##,##0.00';
      added.getCell('balance').numFmt = '#,##,##0.00';
    }

    const totalRow = ws.addRow({
      account: 'TOTAL',
      debit: paiseToNumber(totalDebitPaise),
      credit: paiseToNumber(totalCreditPaise)
    });
    totalRow.font = { bold: true };
    totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F6FA' } };
    totalRow.getCell('debit').numFmt = '#,##,##0.00';
    totalRow.getCell('credit').numFmt = '#,##,##0.00';

    const buffer = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="bank-transactions_${new Date().toISOString().slice(0, 10)}.xlsx"`);
    return res.send(Buffer.from(buffer));
  } catch (err) {
    console.error('[bankStatement.exportTransactionsExcel]', err.message);
    return res.status(500).json({ success: false, error: 'Failed to export bank transactions.' });
  }
}

/**
 * GET /export/gst (Step 7: 6-Sheet GST Working Paper Excel export)
 */
async function exportGstExcel(req, res) {
  try {
    const companyId = await resolveCompanyId(req);
    const { finYear = 'ALL', accountId = 'ALL' } = req.query;

    const wp = await computeGstWorkingPaper(companyId, { finYear, accountId, pendingOnly: false });

    // Resolve FY date bounds for ERP Invoice Register filtering
    let fyFrom = null;
    let fyTo = null;
    if (finYear && finYear !== 'ALL' && /^\d{2}-\d{2}$/.test(finYear)) {
      const startYr = 2000 + parseInt(finYear.slice(0, 2), 10);
      fyFrom = `${startYr}-04-01`;
      fyTo = `${startYr + 1}-03-31`;
    }
    const invoiceRegister = await fetchUnifiedErpInvoices(companyId, { from: fyFrom, to: fyTo });

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Manufacturing ERP';

    const addBanner = (ws, sheetTitle) => {
      const r1 = ws.addRow([`Working paper - not a GST return | ${sheetTitle} | FY: ${finYear} | Generated: ${new Date().toISOString().slice(0, 10)}`]);
      r1.font = { bold: true, color: { argb: 'FF8A5300' } };
      r1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
    };

    const styleHeader = (row) => {
      row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111A36' } };
    };

    // Sheet 1: Monthly Summary
    const s1 = wb.addWorksheet('Monthly Summary');
    addBanner(s1, 'Monthly Summary');
    styleHeader(s1.addRow(['Month', 'Financial Year', 'Entries', 'Credit', 'Debit', 'Sales Receipts', 'ITC Docs Complete', 'ITC Docs Pending', 'Needs Review']));
    for (const m of wp.monthlySummary) {
      const row = s1.addRow([
        sanitizeSpreadsheetCell(m.month),
        sanitizeSpreadsheetCell(m.finYear),
        m.entries,
        m.credit,
        m.debit,
        m.salesReceipts,
        m.itcComplete,
        m.itcPending,
        m.needsReviewCount
      ]);
      [4, 5, 6, 7, 8].forEach((c) => { row.getCell(c).numFmt = '#,##,##0.00'; });
    }
    s1.columns.forEach((col) => { col.width = 18; });

    // Sheet 2: All Entries
    const s2 = wb.addWorksheet('All Entries');
    addBanner(s2, 'All Entries');
    styleHeader(s2.addRow([
      'Account', 'Txn Date', 'Description', 'Party', 'UTR', 'Ref No', 'Debit', 'Credit',
      'Treatment', 'Invoice No', 'Invoice Date', 'GSTIN', 'HSN/SAC', 'Taxable', 'CGST', 'SGST', 'IGST', 'GSTR-2B', 'IMS Status'
    ]));
    for (const e of wp.allEntries) {
      const row = s2.addRow([
        sanitizeSpreadsheetCell(e.account_name),
        e.txn_date_display,
        sanitizeSpreadsheetCell(e.description),
        sanitizeSpreadsheetCell(e.party_name),
        sanitizeSpreadsheetCell(e.utr),
        sanitizeSpreadsheetCell(e.ref_no),
        e.debit || 0,
        e.credit || 0,
        sanitizeSpreadsheetCell(e.treatment),
        sanitizeSpreadsheetCell(e.invoice_no),
        e.invoice_date ? formatDisplayDate(e.invoice_date) : '',
        sanitizeSpreadsheetCell(e.gstin),
        sanitizeSpreadsheetCell(e.hsn_sac),
        e.taxable_amount || 0,
        e.cgst_amount || 0,
        e.sgst_amount || 0,
        e.igst_amount || 0,
        sanitizeSpreadsheetCell(e.found_in_gstr2b),
        sanitizeSpreadsheetCell(e.ims_status)
      ]);
      row.getCell(5).numFmt = '@';
      row.getCell(6).numFmt = '@';
      [7, 8, 14, 15, 16, 17].forEach((c) => { row.getCell(c).numFmt = '#,##,##0.00'; });
    }
    s2.columns.forEach((col, i) => { col.width = i === 2 ? 38 : 16; });

    // Sheet 3: ITC Register (one line per invoice, tax counted once)
    const s3 = wb.addWorksheet('ITC Register');
    addBanner(s3, 'ITC Register (Unique Invoice Level - Tax Counted Once)');
    styleHeader(s3.addRow([
      'Source', 'Invoice No', 'Invoice Date', 'Party Name', 'GSTIN', 'HSN/SAC',
      'Taxable', 'CGST', 'SGST', 'IGST', 'Total Tax', 'Invoice Total', 'Allocated Paid', 'Payments Count', 'GSTR-2B', 'Docs Complete', 'UTR / Refs'
    ]));
    for (const inv of wp.itcRegister) {
      const row = s3.addRow([
        sanitizeSpreadsheetCell(inv.invoice_source),
        sanitizeSpreadsheetCell(inv.invoice_no),
        inv.invoice_date ? formatDisplayDate(inv.invoice_date) : '',
        sanitizeSpreadsheetCell(inv.party_name),
        sanitizeSpreadsheetCell(inv.gstin),
        sanitizeSpreadsheetCell(inv.hsn_sac),
        inv.taxable || 0,
        inv.cgst || 0,
        inv.sgst || 0,
        inv.igst || 0,
        inv.total_tax || 0,
        inv.invoice_total || 0,
        inv.allocated_total || 0,
        inv.payments_count || 1,
        sanitizeSpreadsheetCell(inv.found_in_gstr2b),
        inv.docs_complete ? 'Yes' : 'No',
        sanitizeSpreadsheetCell((inv.txn_refs || []).join(', '))
      ]);
      row.getCell(2).numFmt = '@';
      [7, 8, 9, 10, 11, 12, 13].forEach((c) => { row.getCell(c).numFmt = '#,##,##0.00'; });
    }
    s3.columns.forEach((col) => { col.width = 18; });

    // Sheet 4: Sales Receipts
    const s4 = wb.addWorksheet('Sales Receipts');
    addBanner(s4, 'Sales Receipts');
    styleHeader(s4.addRow(['Account', 'Txn Date', 'Party', 'UTR', 'Credit', 'Invoice No', 'GSTIN', 'Taxable', 'CGST', 'SGST', 'IGST', 'Notes']));
    for (const e of wp.allEntries.filter((x) => x.is_reviewed && x.treatment === 'Sales receipt')) {
      const row = s4.addRow([
        sanitizeSpreadsheetCell(e.account_name),
        e.txn_date_display,
        sanitizeSpreadsheetCell(e.party_name),
        sanitizeSpreadsheetCell(e.utr),
        e.credit || 0,
        sanitizeSpreadsheetCell(e.invoice_no),
        sanitizeSpreadsheetCell(e.gstin),
        e.taxable_amount || 0,
        e.cgst_amount || 0,
        e.sgst_amount || 0,
        e.igst_amount || 0,
        sanitizeSpreadsheetCell(e.notes)
      ]);
      row.getCell(4).numFmt = '@';
      [5, 8, 9, 10, 11].forEach((c) => { row.getCell(c).numFmt = '#,##,##0.00'; });
    }
    s4.columns.forEach((col) => { col.width = 18; });

    // Sheet 5: Pending
    const s5 = wb.addWorksheet('Pending');
    addBanner(s5, 'Pending Review or Pending Docs');
    styleHeader(s5.addRow(['Account', 'Txn Date', 'Description', 'Remarks', 'Debit', 'Credit', 'Treatment', 'Suggested Type', 'Status Note']));
    for (const e of wp.allEntries.filter((x) => x.needs_review || x.docs_pending)) {
      const row = s5.addRow([
        sanitizeSpreadsheetCell(e.account_name),
        e.txn_date_display,
        sanitizeSpreadsheetCell(e.description),
        sanitizeSpreadsheetCell(e.remarks),
        e.debit || 0,
        e.credit || 0,
        sanitizeSpreadsheetCell(e.treatment),
        sanitizeSpreadsheetCell(e.suggested_treatment),
        e.needs_review ? 'Needs Review' : 'Docs Pending'
      ]);
      [5, 6].forEach((c) => { row.getCell(c).numFmt = '#,##,##0.00'; });
    }
    s5.columns.forEach((col, i) => { col.width = i === 2 ? 38 : 18; });

    // Sheet 6: Invoice Register (ERP Sales, Purchases, Credit and Debit Notes)
    const s6 = wb.addWorksheet('Invoice Register');
    addBanner(s6, 'ERP Invoice Register (Sales, Purchases, Expenses, Credit/Debit Notes)');
    styleHeader(s6.addRow([
      'Source', 'Nature', 'Invoice No', 'Date', 'Party Name', 'GSTIN',
      'Taxable', 'CGST', 'SGST', 'IGST', 'Invoice Total', 'Payment Status', 'In GSTR-2B'
    ]));
    for (const inv of invoiceRegister) {
      const row = s6.addRow([
        sanitizeSpreadsheetCell(inv.invoice_source),
        sanitizeSpreadsheetCell(inv.nature),
        sanitizeSpreadsheetCell(inv.invoice_no),
        inv.invoice_date ? formatDisplayDate(inv.invoice_date) : '',
        sanitizeSpreadsheetCell(inv.party_name),
        sanitizeSpreadsheetCell(inv.party_gstin),
        inv.taxable_amount || 0,
        inv.cgst_amount || 0,
        inv.sgst_amount || 0,
        inv.igst_amount || 0,
        inv.invoice_total || 0,
        sanitizeSpreadsheetCell(inv.payment_status),
        inv.in_gstr2b ? 'Yes' : 'No'
      ]);
      row.getCell(3).numFmt = '@';
      [7, 8, 9, 10, 11].forEach((c) => { row.getCell(c).numFmt = '#,##,##0.00'; });
    }
    s6.columns.forEach((col) => { col.width = 18; });

    const buffer = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="gst-working-paper_${finYear}_${new Date().toISOString().slice(0, 10)}.xlsx"`);
    return res.send(Buffer.from(buffer));
  } catch (err) {
    console.error('[bankStatement.exportGstExcel]', err.message);
    return res.status(500).json({ success: false, error: 'Failed to export GST working paper.' });
  }
}

module.exports = {
  requirePermission,
  resolveCompanyId,
  resolveUserPermissions,
  getPermissions,
  getAccounts,
  createAccount,
  updateAccount,
  reorderAccounts,
  moveAccountTransactions,
  deleteAccount,
  previewUpload,
  recheckPreview,
  commitBatch,
  listTransactions,
  updateTransaction,
  deleteTransaction,
  getAuditLogs,
  getGstReview,
  updateGstReview,
  searchErpInvoices,
  importGstr2b,
  exportTransactionsExcel,
  exportGstExcel
};
