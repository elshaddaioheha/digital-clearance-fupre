# Federal University of Petroleum Resources, Effurun (FUPRE)
## Digital Student Clearance System (DSCS) — Technical Implementation Analysis

---

### 1. Executive Summary & Problem Domain
The student clearance process is one of the most critical administrative workflows in Nigerian universities. Historically, the Federal University of Petroleum Resources, Effurun (FUPRE) utilized a manual paper-based clearance system. Graduating students had to physically carry paper forms across various units of the campus (Library, Bursary, Academic Department, Student Affairs, Sports Council, Health Centre, Security, etc.) to collect stamps and signatures.

This manual approach suffered from:
- **High latency**: Delays stretching across weeks, causing students to miss national NYSC mobilization deadlines.
- **Dependency on physical presence**: Onerous for students who had already relocated from Warri/Effurun.
- **Zero visibility**: Lack of real-time tracking for students or registry staff.
- **Security risks**: Potential for physical document loss or signature forgery.

The **FUPRE Digital Student Clearance System (DSCS)** is a centralized, role-based web application that digitizes, manages, and audits this entire workflow. It replaces physical foot traffic with asynchronous document review, automated state machine transitions, and cryptographically verifiable audit logs.

---

### 2. High-Level System Architecture & Design System
The application is structured as a modern, unified three-tier architecture:

- **Presentation Layer**: Next.js (React 19, TypeScript) styled with Tailwind CSS, utilizing a unified **FUPRE DSCS Design System**:
  - **Dual-Tier Fixed Header**: White FUPRE institutional header with logo, motto ("Excellence and Relevance"), and role portal indicator; paired with an interactive `#3482B9` brand navigation bar.
  - **Responsive Slide-Drawer Navigation**: Mobile-first overlay drawers with quick user profile access and seamless page switching.
  - **Bento-Grid Statistics Widgets**: Dynamic 3- and 4-column stat cards with count displays, hover scale animations, and action links.
  - **Standardized UI Components**: Unified status pill badges (`Cleared`, `Under Review`, `Rejected`, `Action Pending`), search/filter bars, and backdrop-blurred modal dialogs (`bg-black/50 backdrop-blur-xs`).
- **Application Logic Layer**: Next.js App Router API routes handling business logic, state transitions, authentication middleware, and validation.
- **Data Persistence Layer**: Supabase PostgreSQL database managed via Prisma ORM for type-safe queries, relational integrity, and soft deletes.

```mermaid
graph TD
    A[Graduating Student] -->|Uploads Documents / Tracks Status| B(Next.js React Frontend)
    C[Departmental Staff] -->|Reviews Queue / Approves / Rejects| B
    D[System Administrator] -->|Configures Units / Audits / Overrides| B
    E[Academic Registrar] -->|Read-only Monitoring / Exports CSV| B
    
    B -->|API Requests| F[Next.js App Router API Routes]
    F -->|Type-safe queries| G[Prisma ORM Client]
    G -->|ACID Database Ops| H[(Supabase PostgreSQL)]
    F -->|Secure File Uploads| I[Supabase Storage]
    F -->|Transactional Email| J[Nodemailer / SMTP]
    F -->|Digital Certificate PDF| K[PDFKit Generation]
```

---

### 3. Core Domain Models & Database Schema
The system maps its entities using an ACID-compliant schema defined in Prisma.

- **User**: The base identity table containing basic credentials (email, hashed password, role: `STUDENT`, `STAFF`, `ADMIN`, `REGISTRAR`). Supports soft deletes (`deletedAt`).
- **Student**: Extends the `User` record with academic metadata (matric number, department, faculty, level, graduation session, profile photo).
- **Staff**: Extends the `User` record to track departmental reviewer assignments.
- **ClearingUnit**: Represents a university office that signs off on clearances (Library, Bursary, etc.). Configurable with a sequential `sortOrder`.
- **StaffUnitAssignment**: A junction table mapping staff to their designated clearing unit.
- **ClearanceRequest**: Tracks a student's clearance status for a specific clearing unit.
- **Document**: Stores file names, storage URLs, and SHA-256 checksums of student uploads.
- **AuditLog**: An append-only historical log of all critical system actions.
- **Notification**: Stores transactional message queues for in-app alert delivery.

---

### 4. Sequential Clearance Workflow State Machine
The system models a student's clearance journey as a finite-state machine. Each clearance unit transitions through specific states:

```
[NOT_SUBMITTED] ──(Student Uploads Docs)──> [PENDING_REVIEW]
      ▲                                            │
      │                                            ▼
      └──(Student Resubmits Docs) <──[REJECTED] ◄─ [UNDER_REVIEW]
                                                   │
                                                   ▼
                                               [APPROVED]
```

#### Workflow & Sequential Logic
Clearances are processed **sequentially** based on the unit's `sortOrder` (HOD -> College -> Admissions -> Bursary -> Library -> Sports -> Health -> Security -> Student Affairs -> Exams & Records):
1. A student cannot submit documents for a unit if any preceding unit in the sort order is not yet `APPROVED`.
2. When all 10 clearing units reach `APPROVED`, the student's overall clearance status automatically updates to `FULLY_CLEARED`.
3. Only upon reaching `FULLY_CLEARED` is the student allowed to download their system-generated digital clearance certificate.

---

### 5. Security & Threat Modeling
- **Dual-Token Authentication (JWT + Refresh Tokens)**: Short-lived access tokens via headers; long-lived refresh tokens in HTTP-only cookies.
- **Granular Role-Based Access Control (RBAC)**: Enforces access restrictions for `STUDENT`, `STAFF`, `ADMIN`, and `REGISTRAR` roles.
- **Cryptographic File Integrity**: SHA-256 checksum verification for uploaded documents.
- **Append-Only Audit Security**: All administrative reviews and status overrides are logged immutably in `AuditLog`.

---

### 6. REST API Reference
All endpoints, except `/api/auth/register` and `/api/auth/login`, require a valid Bearer JWT.

| Method | Endpoint | Description | Roles | Payload Details |
| :--- | :--- | :--- | :--- | :--- |
| **POST** | `/api/auth/register` | Self-register graduating students | Public | `{ email, password, name, matricNumber, department, faculty, level, session }` |
| **POST** | `/api/auth/login` | Authenticate credentials; sets HTTP-only refresh cookie | Public | `{ email, password }` |
| **POST** | `/api/auth/refresh` | Rotate refresh token; returns new access token | All | Cookies: `refreshToken` |
| **GET** | `/api/students/me` | Fetch active student's academic profile | Student | Header: Bearer Access Token |
| **GET** | `/api/clearance/my-status` | Fetch full status matrix across all units | Student | Header: Bearer Access Token |
| **POST** | `/api/clearance/[unitId]/submit` | Upload documents and submit unit clearance | Student | Multipart Form: File data |
| **GET** | `/api/submissions/[unitId]/submissions` | View pending review queue for assigned unit | Staff | Header: Bearer Access Token |
| **PATCH** | `/api/submissions/[requestId]/approve` | Approve student's clearance request | Staff | Header: Bearer Access Token |
| **PATCH** | `/api/submissions/[requestId]/reject` | Reject request with mandatory feedback note | Staff | `{ rejectionNote }` |
| **GET** | `/api/admin/students` | List all students and summaries | Admin, Registrar | Header: Bearer Access Token |
| **POST** | `/api/admin/units` | Create or update clearing unit | Admin | `{ name, description, sortOrder }` |
| **POST** | `/api/admin/clearance/[requestId]/override` | Manually override clearance status | Admin | `{ status, justification }` |
| **GET** | `/api/admin/audit-logs` | Fetch system audit logs with filters | Admin | Query: `actorId`, `action`, `startDate`, `endDate` |
| **GET** | `/api/certificates/[studentId]` | Download cryptographically signed PDF certificate | Student, Admin | Returns streamable PDF document |

---

### 7. Step-by-Step Installation & Run Guide

#### Prerequisites:
- Node.js (20.x LTS or higher)
- PostgreSQL instance (or Supabase PostgreSQL database)

#### Step 1: Environment Configuration
Create a `.env` file in the root directory `dscs-backend` using `.env.example` as a template:
```env
DATABASE_URL="postgresql://username:password@host:port/database"
DIRECT_URL="postgresql://username:password@host:port/database"
JWT_ACCESS_SECRET="your-32-character-access-secret"
JWT_REFRESH_SECRET="your-32-character-refresh-secret"
SMTP_HOST="smtp.mailtrap.io"
SMTP_PORT="2525"
SMTP_USER="smtp-username"
SMTP_PASS="smtp-password"
SMTP_FROM="noreply@fupre.edu.ng"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

#### Step 2: Database Setup & Migration
Generate the Prisma client and apply migrations:
```bash
npx prisma generate
npx prisma db push
```

#### Step 3: Populate Database Seed Data
Seed the database with default clearing units, staff logins, student testing credentials, and administrator accounts:
```bash
npx prisma db seed
```

#### Step 4: Launch Development Server
```bash
npm run dev
```

---

### 8. Verification and Automated End-to-End Testing

The repository contains an automated integration runner for testing full end-to-end user flows across all 3 portals:

- **Full E2E User Flow Test Suite**:
  Run the automated test runner (spawns server and verifies all role endpoints):
  ```bash
  node test-runner.js
  ```
  Or run against an already running server on port 3000:
  ```bash
  node test-only.js
  ```
