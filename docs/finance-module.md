# Enterprise ERP Finance Module Documentation

## 1. Overview
The Finance Module provides a fully interlinked, immutable financial ledger system connecting:
- **Purchases (Raw Material POs)** & GRN Warehouse Receipts
- **Capital Assets POs** & Commissioning Milestones
- **Operating & Administrative Expenses**
- **Sales Orders & Customer Billings**
- **Quotations Pipeline** (Strictly excluded from liabilities/receivables until converted)
- **GST Input vs Output Tax Credit Reconciliation**
- **Cash & Bank Ledger** with running balances
- **Production Cockpit Integration** with payment status & advance visibility

Payment classification (`UNPAID`, `ADVANCE_PAID`, `PARTIALLY_PAID`, `PAID`, `OVERPAID`, `VOID`) is **always dynamically calculated** from `payments` and `payment_allocations` ledger entries, never manually entered or stored as mutable flags.

---

## 2. Core Database Schema & Views

### 2.1 Ledger Tables
1. **`parties`**: Unified counterparty master (Suppliers, Customers, Both) with GSTIN, State Code, credit days, and opening balances.
2. **`bank_accounts`**: Bank, Cash, and UPI accounts with running current balance.
3. **`payment_milestones`**: Capital asset project milestones (`asset_pos`).
4. **`payments`**: Immutable payment vouchers (`direction IN ('OUT', 'IN')`, `mode IN ('CASH', 'BANK', 'UPI', 'CHEQUE', 'NEFT', 'RTGS')`, `amount`, `is_reversed`, `reversed_of`).
5. **`payment_allocations`**: Double-entry allocation linking payment vouchers to documents (`PURCHASE_ORDER`, `ASSET_PO`, `EXPENSE`, `SALES_ORDER`, `SALES_INVOICE`) with `kind IN ('ADVANCE', 'AGAINST_BILL', 'MILESTONE')`.

### 2.2 SQL Views
- **`v_finance_documents`**: Unified polymorphic view joining all bills, POs, expenses, and sales orders with dynamic payment status, overdue status, days overdue, and aging bucket (`Current`, `0-30`, `31-60`, `61-90`, `90+`).
- **`v_quotation_pipeline`**: Active quotations pipeline without polluting balance sheets or receivables.
- **`v_party_ledger`**: Party statement of account with running balance.
- **`v_gst_register`**: Monthly statutory return register (Input Tax Credit vs Output Liability, Net Payable, Carry-forward ITC).
- **`v_cash_bank_book`**: Bank and cash book transactions with deposits and withdrawals.
- **`v_aging_payables` & `v_aging_receivables`**: Aging matrices across buckets.

---

## 3. Business & Status Rules

1. **₹1.00 Round-off Tolerance**:
   $$\text{balance} \le 1.00 \implies \text{PAID}$$
   *Example*: PO-000019 paid ₹16,157 against ₹16,158 is dynamically classified as `PAID`.
2. **Advance Classification**:
   When allocation is marked `ADVANCE` and fulfilment is `PENDING` or `PARTIAL`, status is classified as `ADVANCE_PAID`.
3. **Immutability & Reversals**:
   Payments are never deleted. Calling `POST /api/finance/payments/:id/reverse` marks the original payment reversed and posts a counter-reversal payment with negative allocations and restores bank balances.
4. **FIFO Auto-Allocation**:
   When entering a lump-sum payment, clicking Auto-Allocate applies funds to oldest open bills first. Any remaining balance is stored as an on-account advance (`doc_id = NULL`).
5. **Canonical UOM Invariance**:
   Quantities are converted to Base UOM ($1,000\text{ gm} = 1\text{ kg}$; $1,000\text{ ml} = 1\text{ L}$) to prevent inventory inflation.

---

## 4. API Endpoints (`/api/finance/*`)

| Endpoint | Method | Description |
|---|---|---|
| `/api/finance/dashboard` | `GET` | KPIs, monthly trend, aging buckets, attention queue |
| `/api/finance/documents` | `GET` | Unified documents list with multi-filtering and pagination |
| `/api/finance/documents/:type/:id` | `GET` | Full document detail with lines, tax breakdown, payments, lifecycle |
| `/api/finance/bank-accounts` | `GET` | List active bank and cash accounts |
| `/api/finance/payments` | `GET` | List payment vouchers |
| `/api/finance/payments` | `POST` | Record payment with multi-bill allocations or on-account advance |
| `/api/finance/payments/:id/reverse` | `POST` | Reverse payment voucher with audit logging |
| `/api/finance/payments/:id/reallocate`| `POST` | Reallocate unallocated advance to an open bill |
| `/api/finance/parties` | `GET` | List parties for dropdown selectors |
| `/api/finance/parties/:id/ledger` | `GET` | Statement of account with running balance |
| `/api/finance/aging` | `GET` | Aging report for payables or receivables |
| `/api/finance/gst` | `GET` | Monthly GSTR-3B tax return reconciliation |
| `/api/finance/cashbook` | `GET` | Cash and bank book transactions |
| `/api/finance/quotations` | `GET` | Quotations pipeline |
