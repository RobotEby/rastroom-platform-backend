# Rastroom Platform Backend

Backend API for **Rastroom**, a production traceability platform for woodworking shops, furniture manufacturers and small factories that need to track orders, furniture items, parts, production steps, quality issues, attachments, documents and QR-code labels.

This service is built with **NestJS**, **Prisma** and **PostgreSQL**. It exposes a REST API used by the Rastroom frontend and provides authentication, multi-tenant data isolation, production workflow management, document generation, dashboard indicators, audit trails and staging/demo utilities.

---

## Table of Contents

- [Product Overview](#product-overview)
- [Main Capabilities](#main-capabilities)
- [Technology Stack](#technology-stack)
- [Architecture Overview](#architecture-overview)
- [Domain Model](#domain-model)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
- [Database and Prisma](#database-and-prisma)
- [Demo Seed](#demo-seed)
- [Running the API](#running-the-api)
- [API Documentation](#api-documentation)
- [Authentication](#authentication)
- [Roles and Permissions](#roles-and-permissions)
- [Important API Areas](#important-api-areas)
- [Health Checks](#health-checks)
- [Uploads](#uploads)
- [Scripts](#scripts)
- [Testing and Validation](#testing-and-validation)
- [Docker and Staging](#docker-and-staging)
- [Security Notes](#security-notes)
- [Troubleshooting](#troubleshooting)
- [Development Roadmap](#development-roadmap)

---

## Product Overview

Rastroom helps a factory track the full lifecycle of a piece of furniture from commercial order to shop-floor execution:

```text
Client
→ Order
→ Furniture
→ Part
→ QR Code
→ Production Process
→ Operator Execution
→ Quality / Defects
→ Checklist
→ Documents / Labels
→ Management Dashboard
```

The backend is responsible for enforcing the business rules behind this flow, including organization-level data isolation, user permissions, production state transitions, document snapshots and operational analytics.

---

## Main Capabilities

### Business Operations

- Client management.
- Order management with delivery dates and status tracking.
- Furniture registration inside orders.
- Part registration with dimensions, material, color, finish and process route.
- Production processes per part.
- Start and finish logs for process execution.
- Production board data for Kanban-style visualization.
- QR-code based part lookup.
- Shop-floor operator flow support.

### Quality and Traceability

- Defect reports by part.
- Defect severity and status tracking.
- Checklist templates and checklist runs.
- File uploads and attachments.
- Audit log for relevant operations.
- Internal notifications.
- Offline sync event tracking.

### Documents and Labels

- Part labels with QR code data.
- Order summaries.
- Technical sheets.
- Shipping receipts.
- Document snapshots that preserve important data at generation time.
- Hydration/fallback logic for labels generated before relationship fixes.

### SaaS / Multi-Tenant Foundation

- Organization model.
- Users scoped by organization.
- Clients, orders, furniture, parts, documents, defects and audit records scoped by organization.
- Role-based access policy endpoint.
- Staging configuration files.
- Demo seed and homologation check scripts.

---

## Technology Stack

| Area                | Technology                          |
| ------------------- | ----------------------------------- |
| Runtime             | Node.js                             |
| Framework           | NestJS                              |
| Language            | TypeScript                          |
| ORM                 | Prisma                              |
| Database            | PostgreSQL                          |
| Auth                | JWT access and refresh tokens       |
| Password Hashing    | Argon2                              |
| Validation          | class-validator / class-transformer |
| API Docs            | Swagger / OpenAPI                   |
| Security Middleware | Helmet, CORS, throttling            |
| Uploads             | Multer                              |
| Testing             | Jest                                |
| Containerization    | Docker / Docker Compose             |

---

## Architecture Overview

The backend follows a modular NestJS architecture:

```text
HTTP Request
  ↓
Controller
  ↓
DTO Validation / Guards
  ↓
Service
  ↓
Prisma Client
  ↓
PostgreSQL
```

Cross-cutting concerns include:

- JWT authentication guard.
- Current user extraction.
- Organization scoping.
- Centralized role/access policy.
- Validation pipes.
- Error formatting.
- Audit logging.
- Health checks.

High-level runtime architecture:

```text
Rastroom Frontend
      ↓ REST/JSON
NestJS Backend API
      ↓ Prisma ORM
PostgreSQL Database
      ↓
Uploads Directory / Staging Infrastructure
```

---

## Domain Model

The central business model is:

```text
Organization
  ├── Users
  ├── Clients
  │     └── Orders
  │           └── Furniture
  │                 └── Parts
  │                       ├── Processes
  │                       │     └── Execution Logs
  │                       ├── Defect Reports
  │                       ├── Attachments
  │                       ├── Checklist Runs
  │                       └── Documents
  ├── Process Templates
  ├── Checklist Templates
  ├── Notifications
  ├── Offline Sync Events
  └── Audit Logs
```

Important concepts:

- **Organization**: tenant boundary for SaaS-style isolation.
- **Client**: customer of the woodworking/furniture company.
- **Order**: commercial order associated with a client.
- **Furniture**: product or furniture item inside an order.
- **Part**: traceable physical piece, usually identified by a QR code.
- **Process**: production step assigned to a part.
- **Execution Log**: operator activity when starting/finishing a process.
- **Document**: generated operational document or label snapshot.
- **Defect Report**: quality issue tied to a part.
- **Checklist**: inspection or operational checklist execution.

---

## Project Structure

Typical structure:

```text
rastroom-platform-backend/
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── common/
│   ├── config/
│   ├── database/
│   └── modules/
│       ├── auth/
│       ├── users/
│       ├── clients/
│       ├── orders/
│       ├── furniture/
│       ├── parts/
│       ├── processes/
│       ├── platform/
│       ├── dashboard/
│       └── uploads/
├── scripts/
├── docs/
├── uploads/
├── test/
├── docker-compose.yml
├── docker-compose.staging.yml
├── Dockerfile
├── .env.example
├── .env.staging.example
└── package.json
```

### Main modules

| Module      | Responsibility                                                                             |
| ----------- | ------------------------------------------------------------------------------------------ |
| `auth`      | Login, token refresh and current user session.                                             |
| `users`     | User listing and management.                                                               |
| `clients`   | Client CRUD.                                                                               |
| `orders`    | Order CRUD and status tracking.                                                            |
| `furniture` | Furniture linked to orders.                                                                |
| `parts`     | Parts, QR lookup and production board data.                                                |
| `processes` | Start/finish production processes.                                                         |
| `platform`  | Workspace, documents, defects, checklists, audit, access policy and operational utilities. |
| `dashboard` | Management analytics and operational indicators.                                           |
| `uploads`   | File upload handling.                                                                      |

---

## Environment Variables

Create a local `.env` based on `.env.example`:

```env
NODE_ENV=development
PORT=8081

CORS_ORIGIN=http://localhost:8080,http://127.0.0.1:8080,http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174,http://localhost:4173,http://127.0.0.1:4173
DATABASE_URL=postgresql://rastroom:rastroom@localhost:5432/rastroom?schema=public

JWT_ACCESS_SECRET=change-me-access-secret
JWT_REFRESH_SECRET=change-me-refresh-secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

UPLOAD_DIR=uploads
MAX_UPLOAD_SIZE_MB=10
```

### Required variables

| Variable                 | Description                                                                             |
| ------------------------ | --------------------------------------------------------------------------------------- |
| `NODE_ENV`               | Runtime environment. Use `development` locally and `production` for staging/production. |
| `PORT`                   | API port. Local default is `8081`.                                                      |
| `CORS_ORIGIN`            | Comma-separated list of allowed frontend origins.                                       |
| `DATABASE_URL`           | PostgreSQL connection string used by Prisma.                                            |
| `JWT_ACCESS_SECRET`      | Secret used to sign short-lived access tokens.                                          |
| `JWT_REFRESH_SECRET`     | Secret used to sign refresh tokens.                                                     |
| `JWT_ACCESS_EXPIRES_IN`  | Access token expiration.                                                                |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token expiration.                                                               |
| `UPLOAD_DIR`             | Directory where uploaded files are stored.                                              |
| `MAX_UPLOAD_SIZE_MB`     | Maximum upload size in megabytes.                                                       |

### Secret generation

For staging or production, generate strong secrets:

```bash
openssl rand -base64 48
```

Do not reuse development secrets in staging or production.

---

## Getting Started

### Prerequisites

- Node.js 20+ recommended.
- npm 10+ recommended.
- PostgreSQL 14+.
- Docker and Docker Compose, optional but recommended for local database/staging workflows.

### Install dependencies

```bash
npm install
```

### Configure environment

```bash
cp .env.example .env
```

Edit `.env` and confirm:

```env
PORT=8081
DATABASE_URL=postgresql://rastroom:rastroom@localhost:5432/rastroom?schema=public
```

### Start PostgreSQL with Docker

```bash
docker compose up -d postgres
```

If your `docker-compose.yml` uses a different service name, adapt the command accordingly.

---

## Database and Prisma

Generate the Prisma client:

```bash
npx prisma generate
```

Validate the schema:

```bash
npx prisma validate
```

Run migrations in development:

```bash
npx prisma migrate dev
```

Run migrations in staging/production:

```bash
npx prisma migrate deploy
```

Open Prisma Studio:

```bash
npm run db:studio
```

---

## Demo Seed

The project includes a demo seed used for homologation and product demonstrations.

Run:

```bash
npm run seed:demo
```

The seed creates demo data such as:

- Organization.
- Admin user.
- Demo client.
- Demo order `PED-005`.
- Demo furniture `Armário quarto`.
- Demo part `P-000-1`.
- Process data.
- Label document data.
- Quality/defect data.
- Checklist data.

Default demo login:

```text
Email: admin@rastroom.local
Password: Rastroom@123
```

Validate the demo seed:

```bash
npm run demo:check
```

Run the homologation check:

```bash
npm run homologation:check
```

---

## Running the API

Development mode:

```bash
npm run dev
```

Production build:

```bash
npm run build
npm run start:prod
```

Local API base URL:

```text
http://localhost:8081
```

---

## API Documentation

Swagger/OpenAPI documentation is available at:

```text
http://localhost:8081/docs
```

Use this page to inspect endpoints, DTOs and request/response contracts.

---

## Authentication

The API uses JWT-based authentication.

Typical flow:

```text
POST /auth/login
→ returns access token and refresh token

GET /auth/me
→ returns the current authenticated user

POST /auth/refresh
→ refreshes the session
```

The frontend stores the authenticated session and sends the access token in API requests.

---

## Roles and Permissions

The platform uses role-based access policies. Current role concepts include:

| Role                              | Typical responsibility                  |
| --------------------------------- | --------------------------------------- |
| `owner`                           | Company owner, full access.             |
| `admin`                           | Administrative access.                  |
| `supervisor`                      | Production and operational supervision. |
| `engineer`                        | Technical/process-oriented access.      |
| `seller`                          | Commercial/order-oriented access.       |
| `maker` / `operator` / `operador` | Shop-floor operator access.             |
| `developer`                       | Technical/internal role.                |

Access policy endpoint:

```text
GET /platform/access-policy
```

The frontend uses this endpoint in the Security screen to display roles, permissions and suggested validation flows.

---

## Important API Areas

### Auth

```text
POST /auth/login
GET  /auth/me
POST /auth/refresh
```

### Clients

```text
GET    /clients
POST   /clients
GET    /clients/:id
PATCH  /clients/:id
DELETE /clients/:id
```

### Orders

```text
GET    /orders
POST   /orders
GET    /orders/:id
PATCH  /orders/:id
DELETE /orders/:id
```

### Furniture

```text
GET    /furniture
POST   /furniture
GET    /furniture/:id
PATCH  /furniture/:id
DELETE /furniture/:id
```

### Parts

```text
GET    /parts
POST   /parts
GET    /parts/:id
GET    /parts/by-code/:code
GET    /parts/production-board
PATCH  /parts/:id
DELETE /parts/:id
```

### Processes

```text
GET  /processes
GET  /processes/part/:id
POST /processes/:id/start
POST /processes/logs/:id/finish
```

### Platform / Operations

```text
GET   /platform/workspace
PATCH /platform/workspace
GET   /platform/access-policy
GET   /platform/audit
GET   /platform/notifications
GET   /platform/documents
POST  /platform/documents/generate
GET   /platform/defects
POST  /platform/defects
PATCH /platform/defects/:id
POST  /platform/checklists/run
GET   /platform/attachments
POST  /platform/attachments
GET   /platform/offline-sync
PATCH /platform/offline-sync/:id
```

### Dashboard

```text
GET /dashboard/management
```

### Uploads

```text
POST /uploads
```

---

## Health Checks

Basic health endpoint:

```bash
curl http://localhost:8081/health
```

Readiness endpoint with database validation:

```bash
curl http://localhost:8081/health/ready
```

These endpoints are useful for local debugging, Docker health checks and staging monitoring.

---

## Uploads

Uploaded files are stored in the configured `UPLOAD_DIR`, which defaults to:

```text
uploads/
```

Configuration:

```env
UPLOAD_DIR=uploads
MAX_UPLOAD_SIZE_MB=10
```

For production, consider external object storage such as S3-compatible storage instead of local disk.

---

## Scripts

| Script                       | Description                                                   |
| ---------------------------- | ------------------------------------------------------------- |
| `npm run dev`                | Starts NestJS in watch mode.                                  |
| `npm run build`              | Compiles the backend.                                         |
| `npm run start`              | Runs the compiled app.                                        |
| `npm run start:prod`         | Runs the compiled app in production style.                    |
| `npm run lint`               | Runs ESLint.                                                  |
| `npm test`                   | Runs Jest tests.                                              |
| `npm run test:e2e`           | Runs e2e tests.                                               |
| `npm run prisma:generate`    | Generates Prisma client.                                      |
| `npm run prisma:migrate`     | Runs development migrations.                                  |
| `npm run prisma:deploy`      | Applies migrations for staging/production.                    |
| `npm run prisma:seed`        | Runs Prisma seed.                                             |
| `npm run seed:demo`          | Runs demo seed.                                               |
| `npm run demo:check`         | Validates demo seed data.                                     |
| `npm run homologation:check` | Runs homologation checks.                                     |
| `npm run staging:check`      | Runs staging smoke checks.                                    |
| `npm run staging:demo`       | Deploy migrations, seed demo data and run homologation check. |
| `npm run release:check`      | Runs release validation checks.                               |

---

## Testing and Validation

Recommended local validation sequence:

```bash
npm install
npx prisma generate
npx prisma validate
npm run build
npm test
npm run dev
```

Recommended staging/demo validation:

```bash
npx prisma migrate deploy
npm run seed:demo
npm run demo:check
npm run homologation:check
npm run build
```

Manual flow to validate:

```text
Login
→ Dashboard
→ Clients
→ Orders
→ Furniture
→ Parts
→ Production Board
→ Operator Mode
→ Documents
→ Quality
→ Security
→ Homologation
```

---

## Docker and Staging

Local Docker Compose is available through:

```bash
docker compose up -d
```

Staging Compose file:

```bash
docker compose -f docker-compose.staging.yml up -d --build
```

Staging environment template:

```text
.env.staging.example
```

Staging documentation:

```text
docs/DEPLOY_STAGING.md
```

Release checklist:

```text
docs/RELEASE_CHECKLIST.md
```

Demo script:

```text
docs/DEMO_SCRIPT.md
```

Homologation documentation:

```text
docs/HOMOLOGACAO_FINAL.md
```

---

## Security Notes

Before using this project with real customers, review the following:

- Replace all development JWT secrets.
- Use HTTPS in staging/production.
- Restrict `CORS_ORIGIN` to known frontend domains.
- Review every endpoint for organization scoping.
- Ensure uploaded files cannot execute code.
- Move uploads to object storage for production.
- Run `npm audit` and address high-priority vulnerabilities.
- Add rate limits to sensitive endpoints.
- Use secure database credentials.
- Restrict database access by network.
- Add logs and monitoring.
- Add backup and restore routines.

---

## Troubleshooting

### CORS or NetworkError on login

Check if the backend is running:

```bash
curl http://localhost:8081/health
```

Check `.env`:

```env
PORT=8081
CORS_ORIGIN=http://localhost:8080,http://127.0.0.1:8080,http://localhost:5173,http://127.0.0.1:5173
```

Check frontend `.env`:

```env
VITE_API_URL=http://localhost:8081
```

### Prisma cannot connect

Check `DATABASE_URL`, database credentials and whether PostgreSQL is running.

```bash
docker compose ps
npx prisma validate
```

### `/parts?limit=200` or `/orders?limit=200` fails

The backend includes pagination normalization for query parameters. If this fails again, verify that the latest backend package is being executed and not an older extracted folder.

### New routes or frontend pages show old behavior

Stop and restart both backend and frontend dev servers. Vite and Nest watch mode may keep old compiled state after replacing many files.

---

## Development Roadmap

The MVP is in a demonstrable/homologation-ready state. Recommended next engineering improvements:

- Split the broad `platform` module into smaller modules such as documents, defects, checklists, audit and workspace.
- Add e2e tests for the full order-to-label flow.
- Generate frontend API types from OpenAPI.
- Improve observability with structured logs and request IDs.
- Add production-ready file storage.
- Add backup/restore documentation.
- Harden permissions endpoint by endpoint.
- Add CI pipeline for build, tests and migrations.

---

## License

This project is currently marked as private/unlicensed.
