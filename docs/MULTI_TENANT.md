# Multi-organization RMS

This application is a shared RMS platform. TDCP is one organization (tenant), not the hard-coded product identity.

## Database architecture

One MySQL database (`tdcp_rms` in development) with a shared schema.

**Global tables:** `organizations`, `sites`, `users`, `roles`, `permissions`, `role_permissions`, `organization_settings`, `audit_logs`

**Operational tables** (isolated with `organization_id` + `site_id`; `restaurant_id` is kept equal to `site_id` so existing POS queries keep working): `menu_categories`, `menu_items`, `dining_tables`, `orders`, `order_items`, `payments`, `customers`, `inventory_items`, `inventory_transactions`, `purchases`, `expenses`, `discounts`, `taxes`, `kitchen_orders`

`restaurants` is a **view** over `sites` joined to `organizations` (compatibility with dashboards and reports).

Do not create per-org physical tables such as `tdcp_patriata_orders`.

## Hierarchy

```
RMS PLATFORM
 ├── TDCP
 │    ├── PATRIATA
 │    ├── CHANGA_MANGA
 │    └── HIRAN_MINAR
 ├── MADINA
 │    └── MAIN_BRANCH
 └── KHABBA
      ├── LAHORE
      └── ISLAMABAD
```

## Authentication

- Login: `POST /api/auth/login` with email/username + password.
- Optional `organization_code` rejects users from a different tenant.
- JWT claims: `id`, `role`, `organization_id`, `site_id`, `restaurant_id`.
- Response includes `user`, `organization` (branding), `site`, `permissions`.
- Public branding: `GET /api/auth/branding/:code` (also `/api/public/branding/:code`).

Organization resolution today is a slug:

- `/login/tdcp`  (or `/tdcp/login`)
- `/login/madina`
- `/login/khabba`

The same branding fetch can later use a subdomain host instead of the path slug.

## Authorization / isolation

`attachTenant` (server) derives the site from the JWT. Super Admin and Organization Admin may switch among **allowed** sites; the server verifies the site belongs to their organization. Normal users cannot change `site_id` via query string.

All POS/order/menu/table/report queries filter by authenticated `restaurant_id`/`site_id`.

Roles: `super_admin`, `org_admin`, `manager`, `order_taker`, `cashier`, `kitchen`, `staff`.

## Development database rebuild

Configured URL in `server/.env`: `mysql://tdcp:tdcp123@127.0.0.1:3306/tdcp_rms`

This is treated as the local development database. The first start after this schema (when `organizations` is missing) drops old application tables and recreates them. To force a clean reset:

```bash
npm run db:reset --prefix server
```

SQL source: `database_reset.sql`

The reset **refuses** to run if `DATABASE_URL` is not localhost `tdcp_rms`.

## Seed logins (password: `admin123`)

| User | Email | Role | Org | Site |
| --- | --- | --- | --- | --- |
| Super Admin | superadmin@rms.local | super_admin | (all) | (switch) |
| TDCP Org Admin | admin@tdcp.gov.pk | org_admin | TDCP | all TDCP sites |
| Patriata | patriata_admin@tdcp.gov.pk | manager | TDCP | Patriata |
| Changa Manga | changa_admin@tdcp.gov.pk | manager | TDCP | Changa Manga |
| Hiran Minar | hiran_admin@tdcp.gov.pk | manager | TDCP | Hiran Minar |
| Madina | madina_admin@madina.local | manager | MADINA | Main Branch |
| Khabba Lahore | khabba_lahore_admin@khabba.local | manager | KHABBA | Lahore |
| Khabba Islamabad | khabba_islamabad_admin@khabba.local | manager | KHABBA | Islamabad |

## Add an organization

1. Sign in as Super Admin.
2. Open **Organizations**.
3. Set name, unique code, logo URL, primary/secondary colors, app name. Save.
4. Create sites under that organization (name + unique-per-org code).
5. Create an `org_admin` or site `manager` on **Users**.
6. Staff open `/login/{CODE}`.

## Add a site

Super Admin or Organization Admin: **Sites** (Restaurants page) or Organizations → Create site. Code must be unique within the organization (`UNIQUE(organization_id, site_code)`).

## Flutter note

This codebase is React (Vite) + Express, not Flutter. Branding lives in `client/src/lib/brandTheme.js`, session in `AuthContext` (`user`, `organization`, `site`, `permissions`).

## APIs

- `/api/auth/login`, `/api/auth/me`, `/api/auth/branding/:code`
- `/api/organizations`, `/api/organizations/:id`, `/api/organizations/:id/sites`
- `/api/sites`, `/api/sites/:id`
- `/api/platform/summary` (super admin)
- Existing `/api/menu`, `/api/tables`, `/api/orders`, `/api/payments`, `/api/reports`, `/api/users`

## Security rules

- Never trust frontend `organization_id` / `site_id` for data access.
- Super Admin is the only global role.
- Organization Admin sees only their organization.
- Site Manager sees only their site.
- Offline sync (`hqSync`) writes into the authenticated site’s `organization_id`/`site_id`; new sites attach to an existing organization, not a duplicate table.
