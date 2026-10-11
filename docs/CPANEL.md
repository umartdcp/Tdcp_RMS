# Deploy ServeX RMS on cPanel

This app is **Node.js + MySQL**. cPanel must have **Setup Node.js App** and a **MySQL** database.

## 1. Build on your PC

From the project folder:

```
npm run pack:cpanel
```

This builds the React UI into `server/public` and copies `server/schema.sql`.

## 2. Create the database in cPanel

1. Open **MySQL Databases**.
2. Create a database and a user, then add the user to the database with all privileges.
3. Note host (usually `127.0.0.1` or `localhost`), port `3306`, database name, user, password.

Connection string:

```
mysql://USER:PASSWORD@127.0.0.1:3306/DATABASE_NAME
```

If the password has special characters, URL-encode them.

## 3. Upload files

Upload the **`server`** folder to your home directory, for example:

```
/home/YOURUSER/servex/
```

It must include:

- `app.js`
- `package.json`
- `src/`
- `public/` (the built UI)
- `schema.sql`
- `uploads/` (writable)

Do **not** upload `node_modules`. cPanel will install packages.

## 4. Create the Node.js app

In cPanel → **Setup Node.js App**:

| Field | Value |
| --- | --- |
| Node.js version | 18 or 20 |
| Application mode | Production |
| Application root | `servex` (the folder you uploaded) |
| Application URL | your domain or subdomain |
| Application startup file | `app.js` |

Click **Create**, then **Run NPM Install**.

## 5. Environment variables

In the Node.js app **Environment variables** (or `server/.env`):

```
NODE_ENV=production
JWT_SECRET=a-long-random-secret
DATABASE_URL=mysql://USER:PASSWORD@127.0.0.1:3306/DATABASE_NAME
DATABASE_SSL=false
SEED_ADMIN_PASSWORD=choose-a-strong-password
```

Set `DATABASE_SSL=true` only if your host requires SSL for MySQL.

Save, then **Restart** the app.

## 6. First login

On an empty database the app creates schema and demo organizations.

- Super Admin: `superadmin@rms.local` / `SEED_ADMIN_PASSWORD` (or `admin123` if you did not set it)
- Login URL: `https://your-domain/login/servex`

Change that password immediately.

## 7. Check it is live

Open `https://your-domain/api/health` — you should see `{"ok":true,"service":"RMS API"}`.

If the site is a blank page, `public/index.html` is missing — run `npm run pack:cpanel` again and re-upload `public/`.

If the app fails to start, open the Node.js **stderr** log. Typical causes:

- Wrong `DATABASE_URL`
- MySQL is not reachable with that user, or the user has no privileges on the database
- `JWT_SECRET` still set to a placeholder
- Startup file is not `app.js`

## 8. Uploads

Resort photos are stored in `server/uploads`. That folder must be writable by the app user.

## Notes

- Point the domain at the Node.js app, not only `public_html` static files.
- This is not a PHP app. Do not place it only in `public_html` without the Node.js selector.
- After UI changes on your PC, run `npm run pack:cpanel` and upload the new `public/` folder, then restart the app.
