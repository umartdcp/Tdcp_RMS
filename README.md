# TDCP Restaurant Management System

All project code is in this folder:

`C:\Users\HP 460 G11\Desktop\TDCP-RMS`

- `client/` — React + Vite + Tailwind UI
- `server/` — Express API + MySQL
- `PGADMIN-SETUP.md` — MySQL Workbench connection and database setup

## Run locally (Windows)

You need **Node.js** installed (`node -v` should print a version).

Open **PowerShell** in the project folder:

```powershell
cd "C:\Users\HP 460 G11\Desktop\TDCP-RMS"
npm install
npm run install:all
npm run dev
```

Then open:

- App: http://localhost:5173
- API health: http://localhost:5000/api/health

### Login

- Email: `admin@tdcp.gov.pk`
- Password: `admin123`

## Fly.io (staging / live)

Config files are in the project: `Dockerfile`, `fly.toml`.

```powershell
# 1. Install Fly CLI (once)
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"

# 2. New terminal, then login (browser khulega)
fly auth login

# 3. Project folder
cd "C:\Users\HP 460 G11\Desktop\TDCP-RMS"

# 4. App + Postgres (pehli dafa)
fly apps create tdcp-rms --name tdcp-rms
fly postgres create --name tdcp-rms-db --region bom --initial-cluster-size 1 --vm-size shared-cpu-1x --volume-size 1
fly postgres attach tdcp-rms-db --app tdcp-rms
fly secrets set JWT_SECRET="change-me-to-a-long-random-secret" --app tdcp-rms

# 5. Deploy
fly deploy
```

Live URL: `https://tdcp-rms.fly.dev`

If `tdcp-rms` name is taken, change `app` in `fly.toml` and `--name`.

## Tablets (Android) and desktop

This is a **web app**. After deploy, open the same URL on:

- **Windows / Mac desktop** in Chrome or Edge
- **Android tablet** in Chrome (landscape works best for POS)

On an Android tablet: Chrome menu → **Add to Home screen** / **Install app**. It opens full-screen like an app (PWA).

## Deploy on cPanel

This package is the full system: every organization, every resort, and every screen. The domain home lists a separate sign-in link for each organization. A new organization created later gets its own link automatically.

You need a host with **Setup Node.js App** (Node 18 or 20) and **MySQL**. Point the domain’s document root at the Node.js application URL cPanel creates.

### 1. Build the upload on your PC

```powershell
cd "D:\Dont Dell\Dont Dell\TDCP-RMS"
npm run pack:cpanel
```

Upload the `server` folder. Do not upload `server/node_modules` or `server/.env`.

The built site is inside `server/public`. Application root on cPanel is that `server` folder. Startup file is `app.js`.

### 2. Create MySQL in cPanel

MySQL Databases → create a database and a user, then add the user to the database with all privileges. cPanel prefixes both names, so copy the full names it shows.

### 3. Setup Node.js App

cPanel → **Setup Node.js App** → Create:

- Node.js version: **20**
- Application root: the uploaded `server` folder
- Application URL: your domain
- Application startup file: `app.js`

Add these environment variables, then **NPM Install** and **Restart**:

```
NODE_ENV=production
JWT_SECRET=a-long-random-secret-you-make-up
DATABASE_URL=mysql://CPANEL_DB_USER:PASSWORD@127.0.0.1:3306/CPANEL_DB_NAME
DATABASE_SSL=false
```

Leave `TDCP_ONLY` unset. If MySQL refuses the connection, set `DATABASE_SSL=true` and restart.

The first start creates every organization and its resorts. Each one has its own address:

- `https://your-domain/login/tdcp`
- `https://your-domain/login/madina`
- `https://your-domain/login/khabba`
- `https://your-domain/login/servex` for the platform admin

`https://your-domain/login` shows all of those links. Seeded passwords start as `admin123`. Change them after the site is up.

### 4. Check

- `https://your-domain/login` lists every organization
- `https://your-domain/api/health` returns `"db":"up"`

If the page is blank, `server/public/index.html` was not uploaded.


You can also start the two parts in **two** PowerShell windows:

```powershell
cd "C:\Users\HP 460 G11\Desktop\TDCP-RMS\server"
npm run dev
```

```powershell
cd "C:\Users\HP 460 G11\Desktop\TDCP-RMS\client"
npm run dev
```

## MySQL + Workbench

The app uses the `tdcp_rms` database. Workbench steps: **[PGADMIN-SETUP.md](./PGADMIN-SETUP.md)**

```
Host: 127.0.0.1
Port: 3306
Database: tdcp_rms
Username: tdcp
Password: tdcp123
```
