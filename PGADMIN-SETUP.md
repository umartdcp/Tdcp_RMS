# MySQL Workbench — TDCP RMS database

The API uses MySQL 8. Create the database once, then start the server. The server creates the tables and seed logins the first time `tdcp_rms` is empty.

## 1) Connect in MySQL Workbench

1. Open **MySQL Workbench**.
2. Click your local instance (usually **Local instance MySQL80**), or create a connection:

| Field | Value |
| --- | --- |
| Connection name | Local MySQL |
| Hostname | `127.0.0.1` |
| Port | `3306` |
| Username | `root` |

3. Enter the **root** password you set when MySQL was installed.

## 2) Create the database and app user

1. **File → Open SQL Script**.
2. Choose `server/sql/01_create_database.sql`.
3. Execute it (lightning bolt).

That creates:

| Field | Value |
| --- | --- |
| Host | `127.0.0.1` |
| Port | `3306` |
| Database | `tdcp_rms` |
| Username | `tdcp` |
| Password | `tdcp123` |

The app connection string in `server/.env` is:

```
mysql://tdcp:tdcp123@127.0.0.1:3306/tdcp_rms
```

## 3) Optional: a saved connection for the app user

**Database → Manage Connections → New**:

| Field | Value |
| --- | --- |
| Connection name | TDCP RMS |
| Hostname | `127.0.0.1` |
| Port | `3306` |
| Username | `tdcp` |
| Default Schema | `tdcp_rms` |

Password: `tdcp123`.

## 4) Let the API build the tables

From the project folder:

```powershell
npm run db:init --prefix server
```

Or just start the app (`npm run dev`). On an empty database it applies `database_reset.sql` and seeds demo organizations.

Seed password is `admin123`. Super admin email: `superadmin@rms.local`.

## 5) See the data in Workbench

Connect as `tdcp`, select schema `tdcp_rms`, and refresh **Schemas**. Tables such as `organizations`, `sites`, `users`, and `orders` should be listed. `restaurants` is a view over `sites`.
