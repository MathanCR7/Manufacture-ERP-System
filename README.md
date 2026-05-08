# 🏭 MANUFACTURE ERP SYSTEM

> **End-to-end manufacturing operations platform** — from raw material procurement through production, quality control, and stock management. Built for precision, traceability, and role-based accountability at every stage of the manufacturing lifecycle.

[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?style=flat-square&logo=node.js)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18%2B-61DAFB?style=flat-square&logo=react)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?style=flat-square&logo=postgresql)](https://postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=flat-square&logo=prisma)](https://prisma.io/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker)](https://docker.com/)
[![JWT](https://img.shields.io/badge/Auth-JWT-000000?style=flat-square&logo=jsonwebtokens)](https://jwt.io/)
[![License](https://img.shields.io/badge/License-Proprietary-red?style=flat-square)]()

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Technology Stack](#-technology-stack)
- [System Architecture](#-system-architecture)
- [User Roles & Permissions](#-user-roles--permissions)
- [Complete Workflow](#-complete-workflow)
- [Reference Number System](#-reference-number-system)
- [Database Schema](#-database-schema)
- [API Reference](#-api-reference)
- [Frontend Architecture](#-frontend-architecture)
- [Notification System](#-notification-system)
- [IP Restriction System](#-ip-restriction-system)
- [Dashboard & Reporting](#-dashboard--reporting)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Docker Deployment](#-docker-deployment)
- [Security](#-security)
- [Development Roadmap](#-development-roadmap)

---

## 🌐 Overview

The **Manufacture ERP System** is a role-based, full-stack web application engineered for manufacturing operations. It manages the complete product lifecycle — from raw material purchase orders, goods receipt, laboratory testing, production batching, quality control, all the way through to finished goods stock management.

Every action in the system is traceable. Every handoff between roles generates real-time notifications. Every mutation is captured in a tamper-evident audit log. The system enforces strict role-based access control (RBAC), optionally combined with IP-level login restrictions per user.

**Core Design Principles:**

- **Full Traceability** — Every raw material batch carries a unique, permanent ID tracked from purchase to production floor
- **Role Enforcement** — Each role sees only the modules they need; server-side guards block unauthorized actions
- **Audit Completeness** — Every create, update, and delete is logged with user identity, IP, timestamp, and value diff
- **Real-Time Handoffs** — Server-Sent Events (SSE) push instant notifications between departments at every critical stage
- **Low Infrastructure Cost** — Designed for a single VPS (~$5–$15/month) with Docker Compose; no external services required

---

## ✨ Key Features

| Feature | Description |
|---|---|
| **Role-Based Access Control** | 5 distinct roles — each with precisely scoped sidebar navigation, API guards, and UI restrictions |
| **Unique RM ID Registry** | 6-digit raw material IDs guaranteed never to be reused, even after deletion |
| **End-to-End Workflow** | Purchase Order → GRN → Lab Testing → Production → QC → Stock in a single, connected flow |
| **Real-Time Notifications** | SSE-powered instant alerts between roles at every workflow handoff |
| **IP-Level Login Restriction** | Bind any user account to a specific IP address — deny all other origins at middleware level |
| **Full Audit Log** | Every mutating API call writes to `audit_log` with old/new values, user identity, and IP |
| **Production QC with Expiry Dates** | Lab sets expiry date on QC-passed batches; stock view shows countdown with colour-coded urgency |
| **Traceability Timeline** | Single view showing the complete lifecycle of any raw material from PO to finished product |
| **CSV Export** | Audit logs and reports are exportable as CSV with date-range filtering |
| **Notes System** | Any role can post notes on any record; Supervisor notes are visually distinguished |
| **Dashboard Analytics** | Live metrics: today's batches, pending POs, lab queues, QC failures, expiry alerts |
| **User Session Tracking** | Login/logout times, duration, and IP logged per session for compliance reporting |

---

## 🛠 Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Frontend** | React 18 + Vite | Fastest dev server; hot reload; optimised production builds |
| **Routing** | React Router v6 | Nested protected routes; role-based redirect logic |
| **UI Library** | Tailwind CSS + shadcn/ui | Consistent, accessible component system; zero CSS conflicts |
| **Client State** | Zustand | Minimal boilerplate auth store; no Redux overhead |
| **Server State** | TanStack Query (React Query) | Auto-caching, background refetch, optimistic updates |
| **Backend** | Node.js 20 + Express.js | Async I/O ideal for ERP workloads; massive middleware ecosystem |
| **ORM** | Prisma ORM | Type-safe queries; auto-migrations; no raw SQL errors |
| **Database** | PostgreSQL 15 | ACID transactions; JSON columns; proven at scale |
| **Authentication** | JWT (HS256) | Stateless; no Redis required; IP-binding middleware layer |
| **Real-Time** | Server-Sent Events (SSE) | No Socket.io overhead; works through all proxies; native browser support |
| **Containerisation** | Docker + docker-compose | One-command deploy; reproducible environments; $5/month VPS viable |
| **Validation** | Zod | Runtime schema validation on every API input before DB touch |

---

## 🏗 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        MANUFACTURE ERP                          │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │  React   │  │  Zustand │  │ TanStack │  │  SSE Client  │   │
│  │  (Vite)  │  │  (Auth)  │  │  Query   │  │ (Real-Time)  │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬───────┘   │
│       └─────────────┴──────────────┴───────────────┘           │
│                            │ HTTPS                              │
│  ┌─────────────────────────▼───────────────────────────────┐   │
│  │                   nginx Reverse Proxy                   │   │
│  │          Static /assets → cache   /api → upstream       │   │
│  └─────────────────────────┬───────────────────────────────┘   │
│                            │                                    │
│  ┌─────────────────────────▼───────────────────────────────┐   │
│  │              Express.js API Server (Node 20)            │   │
│  │                                                         │   │
│  │  Middleware Pipeline:                                   │   │
│  │  authenticateToken → checkIP → authorizeRole →          │   │
│  │  rateLimiter → zod validate → route handler →           │   │
│  │  auditLogger                                            │   │
│  │                                                         │   │
│  │  Route Modules:                                         │   │
│  │  /auth  /users  /rm  /grn  /lab  /production            │   │
│  │  /notifications  /reports  /audit  /uom  /notes         │   │
│  └─────────────────────────┬───────────────────────────────┘   │
│                            │                                    │
│  ┌─────────────────────────▼───────────────────────────────┐   │
│  │                  Prisma ORM Layer                       │   │
│  └─────────────────────────┬───────────────────────────────┘   │
│                            │                                    │
│  ┌─────────────────────────▼───────────────────────────────┐   │
│  │               PostgreSQL 15 Database                    │   │
│  │           12 core tables · ACID transactions            │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Monorepo Layout

```
manufacture-erp/
├── server/
│   ├── src/
│   │   ├── routes/          # auth, rm, grn, lab, production, notifications, reports
│   │   ├── middleware/       # authenticateToken, checkIP, authorizeRole, auditLogger, rateLimiter
│   │   ├── utils/            # rmIdGenerator, notifier, csvExport, formatters
│   │   ├── prisma/           # schema.prisma, migrations/
│   │   └── app.js
│   ├── Dockerfile
│   └── package.json
├── client/
│   ├── src/
│   │   ├── pages/            # auth, dashboard, po, grn, lab, production, admin, traceability
│   │   ├── components/       # NotificationBell, RoleGuard, StatusBadge, NotePanel, AuditTimeline
│   │   ├── store/            # Zustand auth store
│   │   ├── api/              # Axios instance, TanStack Query hooks
│   │   └── App.jsx
│   ├── Dockerfile            # multi-stage: build → nginx
│   └── package.json
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env.example
└── README.md
```

---

## 👥 User Roles & Permissions

The system enforces five roles. Every sidebar item, API route, and UI action is guarded by role checks at both the frontend (render) and backend (middleware) levels.

| Role | Sidebar Access | Key Capabilities |
|---|---|---|
| **Main Master** | All 17 modules | Full CRUD across the entire system; User management; IP restriction; Audit log; Dashboard |
| **Purchase Accountant** | Dashboard, Purchase Orders, Expenses, Accounts, Notifications | Create/manage POs; Generate and rotate RM IDs; Delete pending POs |
| **Materials Receiver** | Dashboard, Purchase Orders (view), GRN, RM Stock, RM Wastage, Pending Lab Tests (view), Notifications | Create GRN; Enter final approved quantity; Log wastage |
| **Lab Assistant** | Dashboard, Pending RM Lab Tests, RM Lab Results, Production QC Queue, Product Stock (view), Notifications | Submit RM lab tests; Submit production QC; Set expiry dates |
| **Supervisor** | Dashboard, POs, GRN, Lab Results, Production, Stock (all read-only), Notifications | Read all records; Post notes on any record |

### Role–Permission Matrix

| Module / Action | Master | Accountant | Receiver | Lab Asst | Supervisor |
|---|---|---|---|---|---|
| Dashboard | **Full** | Read | Read | Read | Read |
| Purchase Orders — Create | **Full** | **Full** | — | — | — |
| Purchase Orders — Delete | **Full** | Own/Pending | — | — | — |
| GRN — Create | **Full** | — | **Full** | — | — |
| GRN — Final Qty Approve | **Full** | — | **Full** | — | — |
| Lab RM Test — Submit | **Full** | — | — | **Full** | — |
| Production Batch — Create | **Full** | — | — | — | — |
| Production QC — Submit | **Full** | — | — | **Full** | — |
| Product Stock — View | **Full** | — | — | Read | Read |
| User Management | **Full** | — | — | — | — |
| Audit Log | **Full** | — | — | — | — |
| Notes — Post | **Full** | **Full** | **Full** | **Full** | **Full** |

---

## 🔄 Complete Workflow

The system enforces a strict, sequential workflow. Each step gates the next — you cannot create a production batch from unapproved raw materials, and you cannot release finished goods to stock without a passed QC test.

### Step 1 — Purchase Order Creation
**Actor: Purchase Accountant**

1. Accountant opens Purchase Orders → Create New PO
2. System auto-generates a unique 6-digit RM ID (checked against `id_registry` — never reused)
3. Accountant fills: RM Name, Quantity, Amount, UOM, Expected Delivery Date
4. Click **Rotate ID** to get a different candidate ID without saving
5. On save: PO ref `PO-000001` is created with `status: PENDING`
6. PO immediately visible to Materials Receiver in their sidebar

### Step 2 — Goods Receipt (GRN)
**Actor: Materials Receiver**

1. Receiver sees all pending POs with expected delivery dates
2. Physical goods arrive → Receiver opens the PO, clicks **Create GRN**
3. Fills: Actual Received Qty, Amount, Health Condition (`Good / Moderate / Bad / Return`), Notes
4. Selects Confirmation Status: `Approved / Returned / Stock Hold / Other`
5. On submit: `GRN-000001` is created, PO status → `RECEIVED`
6. Lab Assistant receives **real-time SSE notification**: `RM #100034 arrived — Full Cream Milk 100kg — Health: Good`

### Step 3 — Raw Material Lab Testing
**Actor: Lab Assistant**

1. Lab Assistant sees badge count on **Pending RM Lab Tests** sidebar item
2. Opens queue, selects the RM, clicks **Test This RM**
3. Records parameters: Fat%, Protein%, Carbohydrates%, Moisture%, Acidity, SNF, plus custom key-value parameters
4. Selects decision: `Approved / Rejected / Need Re-sample` with mandatory notes
5. Test ref `LAB-RM-000001` is created
6. **If Approved**: Receiver notified → enter Final Approved Quantity
7. **If Rejected**: Receiver notified → RM must be returned to supplier
8. **If Need Re-sample**: Receiver notified → send another sample to lab

### Step 4 — Final Quantity Approval
**Actor: Materials Receiver**

1. Receiver gets notification: `RM #100034 approved — enter final quantity`
2. Opens GRN detail page, sees green **Lab Approved** banner
3. Enters Final Approved Quantity (actual usable quantity post lab test)
4. Clicks **Submit & Approve** → GRN record is **locked** (`lockedAt` timestamp set)
5. PO status → `APPROVED` — RM queued for production

### Step 5 — Production Batch
**Actor: Main Master / Production Team**

1. Opens Production Batches → Create Batch
2. Selects approved RM from dropdown (shows RM ID, Name, Final Approved Qty)
3. Enters Estimated Output Quantity
4. Batch `MP-000001` created with `status: IN_PROGRESS`
5. During production: record Actual RM Used + RM Remaining
6. On completion: enter Final Milk Remaining → batch → `COMPLETED`
7. Lab Assistant notified: `Batch MP-000001 complete — QC required`

### Step 6 — Production Quality Control
**Actor: Lab Assistant**

1. Lab sees badge on **Production QC Queue** sidebar
2. Opens batch, enters custom QC parameters (key-value format)
3. Selects decision: `QC Passed / QC Failed`
4. If **QC Passed**: must set Expiry Date (enforced — cannot save without it)
5. QC ref `QC-000001` created, batch → `QC_PASSED`
6. Master / Sales team notified: `New stock ready — Batch MP-000001 — 500 pcs — Expires: 15/06/2026`

### Step 7 — Expiry & Returns Handling

- **Expired on arrival**: Receiver sets Health = `Return` in GRN — tracked in RM Wastage
- **Failed lab test**: Lab sets `Rejected` — Receiver notified to return to supplier
- **Failed QC**: Batch flagged `QC_FAILED` — never added to stock
- **Product stock page**: Expiry countdown — 🔴 red `≤3 days`, 🟡 amber `≤7 days`, ✅ green `>7 days`
- **Expired finished goods**: tracked in Product Wastage module
- **Expired raw materials**: tracked in RM Wastage module

---

## 🔖 Reference Number System

Every document type in the system generates a formatted, sequential reference number for full traceability across all roles.

| Document | Format | Example | Description |
|---|---|---|---|
| Raw Material ID | `6-digit number` | `100034` | Unique RM identifier — never reused, permanent in registry |
| Purchase Order | `PO-000001` | `PO-000031` | Sequential, auto-generated on PO creation |
| Goods Receipt Note | `GRN-000001` | `GRN-000019` | Linked to PO + RM ID |
| RM Lab Test | `LAB-RM-000001` | `LAB-RM-000012` | Linked to RM ID + GRN |
| Production Batch | `MP-000001` | `MP-000013` | Sequential production run |
| Production QC | `QC-000001` | `QC-000008` | Linked to Production Batch |

### RM ID Generation Rules

- IDs are 6-digit strings: `100000` to `999999` (900,000 unique values)
- System queries `id_registry` for the candidate — any status including `DELETED` blocks reuse
- Retry loop: up to 10 attempts before throwing `Error('ID space exhausted')`
- `Rotate ID` generates a new candidate without saving to the database
- Deleted POs permanently retire their RM ID — it cannot be reassigned

---

## 🗄 Database Schema

The system uses **12 core PostgreSQL tables** managed entirely through Prisma ORM.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     users       │     │   id_registry   │     │  raw_material   │
│─────────────────│     │─────────────────│     │      _po        │
│ id (uuid)       │──┐  │ id (VARCHAR 6)  │◄────│─────────────────│
│ name            │  │  │ status (enum)   │     │ rm_id (FK)      │
│ email (unique)  │  │  │ created_by (FK) │     │ name            │
│ password_hash   │  └─►│                 │     │ quantity        │
│ role (enum)     │     └─────────────────┘     │ amount          │
│ ip_address      │                              │ uom_id (FK)     │
│ is_active       │     ┌─────────────────┐     │ expected_del.   │
└─────────────────┘     │      grn        │     │ status (enum)   │
                         │─────────────────│     │ locked_at       │
┌─────────────────┐     │ id (uuid)       │     └─────────────────┘
│  lab_rm_test    │     │ rm_id (FK)      │
│─────────────────│     │ received_qty    │     ┌─────────────────┐
│ id (uuid)       │     │ received_amt    │     │ production      │
│ rm_id (FK)      │     │ health_cond.    │     │    _batch       │
│ fat, protein    │     │ confirm_status  │     │─────────────────│
│ carbs, moisture │     │ final_appr_qty  │     │ id (uuid)       │
│ acidity, snf    │     │ locked_at       │     │ rm_id (FK)      │
│ custom_params   │     └─────────────────┘     │ estimated_qty   │
│ decision (enum) │                              │ actual_rm_used  │
│ notes           │     ┌─────────────────┐     │ rm_remaining    │
│ tested_by (FK)  │     │ lab_production  │     │ status (enum)   │
└─────────────────┘     │     _test       │     └─────────────────┘
                         │─────────────────│
┌─────────────────┐     │ id (uuid)       │     ┌─────────────────┐
│  notifications  │     │ batch_id (FK)   │     │   audit_log     │
│─────────────────│     │ qc_params (JSON)│     │─────────────────│
│ id (uuid)       │     │ decision (enum) │     │ user_id (FK)    │
│ type            │     │ expiry_date     │     │ action          │
│ recipient_role  │     │ notes           │     │ table_name      │
│ recipient_id    │     │ tested_by (FK)  │     │ record_id       │
│ message         │     └─────────────────┘     │ old_value (JSON)│
│ seen_at         │                              │ new_value (JSON)│
│ seen_by         │     ┌─────────────────┐     │ ip              │
└─────────────────┘     │      uom        │     │ created_at      │
                         │─────────────────│     └─────────────────┘
┌─────────────────┐     │ id (uuid)       │
│ user_session    │     │ name            │     ┌─────────────────┐
│     _log        │     │ abbreviation    │     │     notes       │
│─────────────────│     │ is_active       │     │─────────────────│
│ user_id (FK)    │     └─────────────────┘     │ user_id (FK)    │
│ login_at        │                              │ reference_table │
│ logout_at       │                              │ reference_id    │
│ ip              │                              │ note_text       │
│ duration_secs   │                              │ created_at      │
└─────────────────┘                              └─────────────────┘
```

### Enums

```prisma
enum Role {
  MAIN_MASTER
  SUPERVISOR
  PURCHASE_ACCOUNTANT
  MATERIALS_RECEIVER
  LAB_ASSISTANT
}

enum POStatus       { PENDING | RECEIVED | APPROVED | DELETED }
enum HealthCond.    { GOOD | MODERATE | BAD | RETURN }
enum ConfirmStatus  { APPROVED | RETURNED | STOCK_HOLD | OTHER }
enum LabDecision    { APPROVED | REJECTED | NEED_SAMPLE }
enum BatchStatus    { IN_PROGRESS | COMPLETED | QC_PASSED | QC_FAILED }
enum QCDecision     { QC_PASSED | QC_FAILED }
enum IDStatus       { ACTIVE | DELETED }
```

---

## 📡 API Reference

All routes are protected by `authenticateToken` middleware. Mutating routes additionally run `auditLogger`. All inputs are validated with Zod before any database operation.

### Authentication

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | Public | Login with email + password → returns JWT |
| `POST` | `/api/auth/logout` | Authenticated | Logs session end; updates `user_session_log` |

### Raw Material & Purchase Orders

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/rm/id/generate` | Accountant, Master | Generate a candidate RM ID (not saved) |
| `POST` | `/api/rm/id/rotate` | Accountant, Master | Generate a fresh candidate RM ID |
| `GET` | `/api/rm/po` | All roles | List all purchase orders |
| `GET` | `/api/rm/po/:id` | All roles | Single PO detail |
| `POST` | `/api/rm/po` | Accountant, Master | Create PO (saves RM ID to registry) |
| `DELETE` | `/api/rm/po/:id` | Accountant, Master | Delete PO (only if `PENDING`) |
| `GET` | `/api/rm/trace/:rmId` | All roles | Full lifecycle timeline for an RM ID |
| `GET` | `/api/uom` | All roles | List all active units of measurement |
| `POST` | `/api/uom` | Master only | Create a new UOM |

### Goods Receipt (GRN)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/grn` | All roles | List all GRNs |
| `GET` | `/api/grn/:id` | All roles | GRN detail with linked PO |
| `GET` | `/api/grn/pending-pos` | Receiver, Master | POs awaiting GRN creation |
| `POST` | `/api/grn` | Receiver, Master | Create GRN; notifies Lab Assistant |
| `PATCH` | `/api/grn/:id/final-qty` | Receiver, Master | Set final approved qty; locks the GRN |

### Lab Testing

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/lab/rm` | Lab, Master, Supervisor | All RM lab tests |
| `GET` | `/api/lab/rm/queue` | Lab, Master | GRNs awaiting lab testing |
| `GET` | `/api/lab/rm/:rmId` | Lab, Master | Lab result for a specific RM |
| `POST` | `/api/lab/rm` | Lab, Master | Submit RM lab test + decision |
| `GET` | `/api/lab/production` | Lab, Master | All production QC tests |
| `GET` | `/api/lab/production/queue` | Lab, Master | Batches awaiting QC |
| `POST` | `/api/lab/production` | Lab, Master | Submit production QC + expiry date |

### Production

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/production` | All roles | List all production batches |
| `GET` | `/api/production/:id` | All roles | Batch detail |
| `POST` | `/api/production` | Master | Create production batch |
| `PATCH` | `/api/production/:id/usage` | Master | Record actual RM used |
| `PATCH` | `/api/production/:id/complete` | Master | Mark batch complete; notifies Lab |

### Notifications

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/notifications/stream` | Authenticated | SSE stream for real-time notifications |
| `GET` | `/api/notifications/mine` | Authenticated | Last 50 notifications for current user |
| `PATCH` | `/api/notifications/:id/seen` | Authenticated | Mark notification as seen |
| `GET` | `/api/notifications/admin-audit` | Master only | All notifications with seen tracking |

### Reports & Admin

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/reports/dashboard` | Master | Live dashboard metrics |
| `GET` | `/api/reports/stock` | All roles | QC-passed batches with expiry data |
| `GET` | `/api/audit` | Master | Filterable audit log (cursor-paginated) |
| `GET` | `/api/audit/export` | Master | Audit log as downloadable CSV |
| `GET` | `/api/users` | Master | All users |
| `POST` | `/api/users` | Master | Create user |
| `PATCH` | `/api/users/:id` | Master | Edit user |
| `PATCH` | `/api/users/:id/ip` | Master | Set/clear IP restriction |
| `DELETE` | `/api/users/:id` | Master | Soft-delete user |
| `GET` | `/api/notes` | All roles | Notes for a record (`?referenceTable=&referenceId=`) |
| `POST` | `/api/notes` | All roles | Post a note on any record |

### Error Response Shape

All error responses follow a consistent structure:

```json
{
  "error": true,
  "code": "INVALID_STATUS",
  "message": "Cannot delete a PO that has already been received."
}
```

---

## 🖥 Frontend Architecture

### Route Map

```
/login                          → LoginPage (public)
/ (ProtectedRoute)
  /dashboard                    → DashboardPage
  /purchase-orders              → POListPage
  /purchase-orders/create       → CreatePOPage
  /purchase-orders/:id          → PODetailPage
  /grn                          → GRNListPage
  /grn/create                   → GRNEntryPage
  /grn/:id                      → GRNDetailPage
  /lab                          → LabQueuePage
  /lab/rm/:rmId/test            → LabTestFormPage
  /lab/rm/:rmId/result          → LabResultPage
  /lab/production               → ProductionQCQueuePage
  /lab/production/:id/test      → ProductionQCFormPage
  /production                   → ProductionListPage
  /production/create            → CreateBatchPage
  /production/:id               → BatchDetailPage
  /stock                        → StockPage
  /notifications                → NotificationsPage
  /trace/:rmId                  → RMTracePage
  /admin/users                  → UsersPage (Master only)
  /admin/users/create           → UserFormPage (Master only)
  /admin/audit                  → AuditLogPage (Master only)
  /admin/notifications          → NotificationAuditPage (Master only)
```

### Shared Components

| Component | Description |
|---|---|
| `NotificationBell` | Real-time bell icon with unread badge; SSE-driven; Popover dropdown |
| `RoleGuard` | HOC wrapping routes; server-side role mismatch → redirect to `/dashboard` |
| `StatusBadge` | Colour-coded status chips: `PENDING=amber`, `APPROVED=green`, `QC_FAILED=red`, etc. |
| `NotePanel` | Collapsible notes panel, attaches to any record via `referenceTable + referenceId` |
| `AuditTimeline` | Read-only sidebar showing the audit trail for the current record |
| `RMIDWidget` | Displays current 6-digit candidate ID with copy button and Rotate action |
| `AppShell` | Top navigation bar + role-aware sidebar + `NotificationBell` |
| `ProtectedRoute` | Checks Zustand auth store; redirects unauthenticated users to `/login` |

### Formatters (`/client/src/lib/formatters.js`)

```javascript
formatDate(iso)           → "15/06/2026"
formatDateTime(iso)       → "15/06/2026 14:30"
formatAmount(number)      → "₹1,23,456.00"
formatQty(number, uom)    → "100.00 kg"
timeAgo(iso)              → "3 minutes ago"
```

---

## 🔔 Notification System

All notifications are persisted to the `notifications` database table AND pushed in real-time via Server-Sent Events (SSE) to connected clients. Offline users receive their notifications on next login.

| Trigger Event | Notified Role | Message Content |
|---|---|---|
| GRN submitted | Lab Assistant | `RM #100034 arrived — Full Cream Milk 100kg — Health: Good` |
| Lab requests re-sample | Materials Receiver | `Lab requests re-sample for RM #100034 — please provide` |
| RM Lab Approved | Materials Receiver | `RM #100034 approved by Lab — enter final approved quantity` |
| RM Lab Rejected | Materials Receiver | `RM #100034 REJECTED by Lab — goods must be returned` |
| Production batch completed | Lab Assistant | `Batch #MP-000013 production complete — QC testing required` |
| Production QC passed | Main Master | `New stock ready: Batch #MP-000013 — 500 pcs — Expires: 15/06/2026` |
| Production QC failed | Main Master | `Batch #MP-000013 QC FAILED — batch flagged for review` |

**Seen Tracking:** Every notification records `seen_at` and `seen_by` when the recipient opens it. The Main Master's admin audit page shows which notifications were seen, by whom, and when.

---

## 🔒 IP Restriction System

The Main Master can bind any user account to a specific IPv4 address. When set, that user can only authenticate from that exact IP. This is enforced on every API request, not just at login.

```
Request arrives at API
       ↓
authenticateToken → extracts req.user from JWT
       ↓
checkIP middleware
  → user.ip_address == null?  → pass through (no restriction)
  → req.ip matches user.ip_address? → pass through
  → mismatch → 403 { error: true, code: "IP_BLOCKED" }
```

- IP stored in `users.ip_address` (nullable — `null` = no restriction)
- Admin UI shows each user's current IP assignment
- Admin can set, update, or clear IP per user at any time
- `user_session_log` captures the IP used at each login for monitoring

---

## 📊 Dashboard & Reporting

### Live Dashboard Metrics (Main Master)

| Metric | Description |
|---|---|
| Today's Batches | Count of production batches created today (UTC) |
| Pending Purchase Orders | POs with `status: PENDING` |
| Awaiting Lab Testing | GRNs with no `lab_rm_test` row |
| Awaiting Production QC | Batches with `status: COMPLETED` |
| Total Stock In Hand | Count + sum qty of `status: QC_PASSED` batches |
| QC Failures Today | `lab_production_test.decision = QC_FAILED` records today |
| Expiry Alerts | `QC_PASSED` batches expiring within 7 days, sorted by urgency |

Dashboard auto-refreshes every 60 seconds via TanStack Query `refetchInterval`.

### Expiry Colour Coding

| Days Until Expiry | Display |
|---|---|
| > 7 days | Green text — stock is fresh |
| 4–7 days | Amber text + badge `Expiring Soon` |
| ≤ 3 days | Red text + badge `URGENT` |
| Expired | Gray text + badge `Expired` |

### Audit Log Viewer

- Filter by user, date range, action type, and table name
- Cursor-based pagination (100 records per page)
- Each row: Timestamp · User · Action · Table · Record ID · IP · Value diff
- **CSV Export** with `Content-Disposition: attachment` for compliance archiving

### User Activity Reports

- Login/logout times per user from `user_session_log`
- Total session duration per day/week/month
- Action count per user (creates, approvals, rejections)

---

## 🚀 Getting Started

### Prerequisites

- Node.js ≥ 20
- Docker & Docker Compose
- Git

### Local Development Setup

```bash
# 1. Clone the repository
git clone https://github.com/your-org/manufacture-erp.git
cd manufacture-erp

# 2. Copy environment template
cp .env.example .env
# Edit .env with your values

# 3. Start the database
docker-compose up -d postgres

# 4. Install server dependencies and run migrations
cd server
npm install
npx prisma migrate dev --name init
npx prisma db seed       # optional: seeds default UOMs and admin user

# 5. Install client dependencies
cd ../client
npm install

# 6. Start both servers (in separate terminals)
# Terminal 1 — API server
cd server && npm run dev

# Terminal 2 — React dev server
cd client && npm run dev
```

The React app will be available at `http://localhost:5173` with the API proxied to `http://localhost:3000`.

### First Login

After seeding, log in with the default Master Admin credentials from your `.env` file. Immediately navigate to **User Management** to create role-specific users and optionally set IP restrictions.

---

## ⚙️ Environment Variables

### Server (`/server/.env`)

```env
# Database
DATABASE_URL=postgresql://erp_user:secret@localhost:5432/manufacture_erp

# JWT
ACCESS_TOKEN_SECRET=your-64-character-random-secret-here
ACCESS_TOKEN_EXPIRES=15m

# Server
PORT=3000
NODE_ENV=development

# CORS
FRONTEND_URL=http://localhost:5173

# Postgres (used by docker-compose)
POSTGRES_USER=erp_user
POSTGRES_PASSWORD=secret
POSTGRES_DB=manufacture_erp
```

### Client (`/client/.env`)

```env
VITE_API_BASE_URL=/api
```

---

## 🐳 Docker Deployment

### Development

```bash
docker-compose up --build
```

This starts PostgreSQL, the Node.js API server, and serves the React build via nginx.

### Production

```bash
# Build and start all services
docker-compose -f docker-compose.prod.yml up -d --build

# Run database migrations
docker-compose exec server npx prisma migrate deploy

# View logs
docker-compose logs -f server
```

### `docker-compose.prod.yml` Services

| Service | Image | Port | Details |
|---|---|---|---|
| `postgres` | `postgres:15-alpine` | Internal | Named volume `erp_pgdata`; healthcheck via `pg_isready` |
| `server` | `./server` (Node 20) | Internal | Runs migrations then starts app; depends on postgres health |
| `nginx` | `./client` (multi-stage) | `80:80` | Serves static build; proxies `/api` to server |

### Recommended VPS Sizing

| Provider | Spec | Cost | Notes |
|---|---|---|---|
| Hetzner CX22 | 2 vCPU, 4GB RAM | ~$5/month | Best value for EU |
| DigitalOcean Basic | 2 vCPU, 4GB RAM | ~$12/month | Good global CDN options |
| SSL | Let's Encrypt | FREE | Auto-renew with certbot |

---

## 🛡 Security

### Implemented Measures

| Layer | Measure |
|---|---|
| **Transport** | HTTPS enforced via nginx; HSTS header (`max-age=31536000`) |
| **Authentication** | JWT HS256; 15-minute access token expiry; algorithm explicitly verified |
| **IP Binding** | Per-user IP restriction enforced on every authenticated request |
| **Input Validation** | Zod schema validation on all API inputs; `.trim()` transform on all string fields |
| **Rate Limiting** | `/api/auth/login`: 10 req/15min per IP; General API: 200 req/15min per IP |
| **Headers** | `helmet()` middleware: `X-Frame-Options: DENY`, CSP headers, no-sniff |
| **CORS** | Restricted to `FRONTEND_URL` env variable only; explicit method list |
| **Audit Logging** | Every POST/PATCH/DELETE writes to `audit_log` with old/new values and IP |
| **Database** | Prisma ORM only — no raw SQL; parameterised queries prevent injection |
| **Passwords** | `bcrypt` with `saltRounds=12` |

### Security Checklist for Production

- [ ] Rotate `ACCESS_TOKEN_SECRET` to a 64-character random string
- [ ] Set `POSTGRES_PASSWORD` to a strong unique password
- [ ] Restrict `FRONTEND_URL` to your exact production domain
- [ ] Enable HTTPS and configure SSL certificate renewal
- [ ] Set IP restrictions for all high-privilege users (Master, Accountant)
- [ ] Review and disable default seed user after initial setup
- [ ] Enable Docker network isolation between services

---

## 🗺 Development Roadmap

### v1.0 — Core Manufacturing Module ✅
- [x] Role-based authentication with JWT + IP binding
- [x] Purchase Order management with RM ID registry
- [x] Goods Receipt Note (GRN) workflow
- [x] Raw Material lab testing with custom parameters
- [x] Production batch management
- [x] Production QC with expiry date management
- [x] Real-time SSE notification system
- [x] Admin dashboard with live metrics
- [x] Full audit log with CSV export
- [x] Notes system on all records
- [x] RM Traceability timeline view
- [x] Docker production deployment

### v1.5 — Advanced Features 🔄
- [ ] Distribution domain module
- [ ] Retail / Sales domain module
- [ ] File attachments on GRN and lab records (S3-compatible)
- [ ] Multi-factory support with factory-scoped data isolation
- [ ] Mobile-responsive PWA for on-floor staff
- [ ] Automated expiry SMS/email alerts
- [ ] Supplier management module
- [ ] Batch cost calculation and profitability reports

### v2.0 — Enterprise Features 📋
- [ ] Multi-tenancy support
- [ ] ERP integration API (SAP/Tally webhooks)
- [ ] Advanced analytics with Chart.js dashboards
- [ ] Barcode / QR code scanning for RM ID lookup
- [ ] Automated reorder point alerts
- [ ] Compliance report templates (FSSAI, ISO)

---

## 📄 License

This project is proprietary software. All rights reserved. Unauthorised copying, modification, distribution, or use of this software, in whole or in part, is strictly prohibited without explicit written permission from the project owner.

---

## 🤝 Contributing

Internal development only. Please follow the established code conventions:

- `async/await` throughout — no callback patterns
- Named exports — no default exports on utilities
- Functional React components — no class components
- All API inputs validated with Zod before touching the database
- Every new route must include `authenticateToken` and `auditLogger`
- Prisma is the **only** database access method — no raw SQL

---

<div align="center">
  <strong>MANUFACTURE ERP SYSTEM</strong><br>
  Built for precision manufacturing operations<br>
  React · Node.js · PostgreSQL · Docker
</div>
