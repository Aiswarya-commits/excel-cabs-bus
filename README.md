# Excel Cabs — Local Bus Booking & Management System

A passenger booking website **and** staff web app (installable PWA) for Excel Cabs local bus services. It is built from the SDD (*Local Bus Booking & Management System, v1.0*) and covers the full MVP scope plus extras.

## Features

**Passenger website (no login needed)**
- Search by From / To / Date, including **stop-to-stop search**: book Ramanagara → Mandya on a Bengaluru → Mysuru bus.
- Results have time-slot, AC/Non-AC and availability filters, sort options, and a quick date strip.
- **Live seat map** (2+2 / 2+1 layouts). Count-only booking for buses without seat numbers.
- Choose boarding and drop-off points. Collects passenger names, age, gender, mobile and notes.
- **Instant e-ticket** with a QR code, print/PDF, WhatsApp share, and a **UPI pay link** for the balance. Payment stays manual and no gateway is used.
- "My Booking" lookup by booking reference + mobile number.
- Installable as an app (PWA manifest + service worker) with an offline fallback page.

**Staff / admin dashboard** (`/admin`)
- Dashboard shows today's trips with occupancy, passengers, pending confirmations, fare value, collected and outstanding amounts, cash-in by method, and a 7-day trend.
- **Quick staff booking** for WhatsApp, phone or counter requests (built for under 2 minutes):
  - One-tap trip selection and duplicate-phone warning.
  - Returning-customer name auto-fill and seat auto-assignment.
  - Payment captured at booking time.
  - A ready-made WhatsApp confirmation message.
- Bookings: search and filter (ref, name, phone, date, status, payment, source) with pagination.
- Booking detail lets staff confirm, edit, cancel with refund, record **multiple/partial payments**, and **void** an entry without deleting it.
- The booking detail also has a "pay after travel" flag and a full **audit history**.
- Trips: schedule one trip or **repeat daily for up to 90 days**, change the bus, override capacity, and update status.
- **Trip manifest** shows totals, a board / no-show toggle per passenger, and a boarding-point filter, with **CSV export** and print.
- Buses, routes with ordered stops (boarding/drop flags, timings), and staff accounts with roles.
- Reports: trip-wise and payment collections for any date range, with CSV export.

**Roles (enforced on the server):** Admin (everything) · Staff (bookings, payments, trips, reports) · Trip staff (trips, manifests, boarding).

## Tech stack

| Layer | Tech |
|---|---|
| Web + API | Next.js 15 (App Router) + TypeScript. REST API at `/api/v1` |
| UI | Tailwind CSS |
| Database | PostgreSQL 16 |
| ORM / migrations | Drizzle ORM + drizzle-kit (pure TypeScript, no binary engines) |
| Validation | Zod (shared by API and forms) |
| Auth | JWT (jose) in httpOnly cookie for web, or `Authorization: Bearer` header for mobile apps. bcrypt password hashes |
| Deploy | Docker + docker-compose, Nginx reverse proxy |

> **Note on the SDD:** the SDD suggests NestJS + Prisma. This build uses Next.js API routes + Drizzle so it runs as a single deployable app. The REST API (`/api/v1/...`, Bearer tokens) is exactly what the future Android/iOS apps will call. The service layer in `src/server/` is framework-agnostic, so it can move into NestJS later if needed.

## Quick start (local) — zero setup

```bash
npm install
npm run dev          # http://localhost:3000
```

No database setup is needed. With no `DATABASE_URL`, the app uses a **built-in PostgreSQL (PGlite)** stored in `.data/`. On first start it creates the tables and loads demo data automatically. Delete the `.data` folder to reset.

**Using a real PostgreSQL** (production, or several people sharing data): put `DATABASE_URL="postgresql://postgres:PASSWORD@localhost:5432/excel_bus"` and a long `JWT_SECRET` in `.env`. Then run `npm run db:migrate` and, once only, `npm run db:seed` to load the demo data.

**Demo logins** (change or deactivate these before going live):

| Role | Email | Password |
|---|---|---|
| Admin | admin@excelcabs.com | Admin@123 |
| Staff | staff@excelcabs.com | Staff@123 |
| Trip staff | trip@excelcabs.com | Trip@123 |

## Production (Docker)

```bash
echo "JWT_SECRET=$(openssl rand -base64 48)" >> .env
echo "POSTGRES_PASSWORD=$(openssl rand -hex 16)" >> .env
echo "NEXT_PUBLIC_APP_URL=https://bus.excelcabs.com" >> .env
docker compose up -d --build            # migrations run automatically on start
# First admin: run the seed once, then change passwords in /admin/staff
docker compose exec app npx tsx src/db/seed.ts
```

Then put `deploy/nginx.conf` in front with HTTPS (certbot) and schedule `deploy/backup.sh` daily. Health check: `GET /api/v1/health`.

⚠️ `db:seed` **wipes all data**. Run it only on a fresh database.

## Branding — make it exactly Excel Cabs

1. **Logo:** replace `public/logo.svg` with the official logo (or add `logo.png` and set `logo` in `src/lib/brand.ts`). Replace `public/icon.svg` and the `icon-*.png` files for the app icon.
2. **Colours:** edit the CSS variables at the top of `src/app/globals.css`. The primary colour is `--brand-600` (currently `#1976d2`, the excelcabs.com theme colour).
3. **Contact & policy:** set phone, WhatsApp, email, address, UPI ID, support hours, cancellation policy, booking cut-off, and whether online bookings auto-confirm in `src/lib/brand.ts`.
4. **Routes/buses/fares:** add real data through `/admin` (Buses → Routes → Trips). You can also edit `src/db/seed.ts`.

## Tests

```bash
npm run dev            # in one terminal (seeded DB)
npm test               # API + unit tests
```

These cover: RBAC, validation, passenger booking, seat conflicts, duplicate detection, and ticket-link security. They also include a **20-parallel-request race for the last 5 seats** (exactly 5 succeed), plus partial payments, voiding, cancellation with refund, and CSV export.

## How overbooking is prevented

Every booking runs in a DB transaction that first takes `SELECT … FROM trips WHERE id = ? FOR UPDATE`. Concurrent bookings for the same trip are therefore serialised, and capacity and seat checks always see committed data. Cancelled bookings never count toward capacity.

## API overview (`/api/v1`)

| Area | Endpoints |
|---|---|
| Auth | `POST auth/login` · `POST auth/refresh` · `POST auth/logout` · `GET auth/me` |
| Public | `GET places` · `GET trips/search?from&to&date` · `GET trips/:id` · `POST bookings` · `GET bookings/lookup?ref&phone` |
| Trips | `GET/POST trips` · `PATCH trips/:id` · `GET trips/:id/passengers[?format=csv]` |
| Bookings | `GET bookings` · `GET/PATCH bookings/:id` · `POST bookings/:id/cancel` · `GET bookings/check-duplicate` |
| Payments | `GET/POST bookings/:id/payments` · `POST payments/:id/void` |
| Boarding | `PATCH booking-passengers/:id/boarding` |
| Setup | `GET/POST buses`, `PATCH buses/:id` · `GET/POST routes`, `GET/PATCH routes/:id` · `GET/POST users`, `PATCH users/:id` |
| Reports | `GET reports/summary` · `GET reports/trips[?format=csv]` · `GET reports/collections[?format=csv]` · `GET audit` |

Errors always follow the shape `{ "error": { "code", "message", "details" } }`, with matching HTTP status codes (401, 403, 404, 409, 422, 429).

## Project structure

```
src/
  app/(site)/        passenger website (home, search, trip, ticket, manage)
  app/admin/         staff dashboard (login + all admin screens)
  app/api/v1/        REST API route handlers
  server/            business logic (bookings, trips, reports, audit)
  db/                schema.ts, migrations runner, seed
  lib/               brand config, money (integer paise), time (IST), auth, validation
  components/        UI kit, seat map, header/footer
drizzle/             SQL migrations
deploy/              nginx config, backup script
tests/               API + unit tests
```

## Before go-live checklist (SDD §17)
- Confirm the following with the operator:
  - Seat assignment vs count-only per bus.
  - Fares per trip.
  - Cancellation/refund rules (shown on the site from `brand.ts`).
  - Whether online bookings auto-confirm.
- Replace the demo data, logo and contact details. Change all demo passwords.
- Set up HTTPS, daily backups (and test a restore), and uptime monitoring on `/api/v1/health`.
