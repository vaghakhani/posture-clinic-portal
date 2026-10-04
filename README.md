# Posture Clinic Portal

Private staff portal for Dr. Ekhtiari's clinic app (patients, SOAP notes, invoices, calendar).

This repo is **separate** from the public marketing website.

## Architecture

- **Clerk** — staff login (email + password, or Google)
- **Supabase** — cloud database (single JSON snapshot per clinic)
- **No Flowra** — this portal does not use Flowra APIs or hosting

Clinic data is saved online in Supabase. All signed-in staff devices share the same records.

## One-time Supabase setup

1. Create a project at [supabase.com](https://supabase.com)
2. In **SQL Editor**, run [`supabase/schema.sql`](supabase/schema.sql)
3. In **Clerk Dashboard** → JWT templates → create template named **`supabase`** (see [Supabase + Clerk docs](https://supabase.com/docs/guides/auth/third-party/clerk))
4. In **Supabase Dashboard** → Authentication → Third-party auth → enable **Clerk** with your Clerk domain
5. Copy **Project URL** and **anon public key** into [`api-config.js`](api-config.js):

```javascript
supabaseUrl: "https://YOUR-PROJECT.supabase.co",
supabaseAnonKey: "eyJ..."
```

6. After you host the portal (see **Host the portal online** below), set the public base URL:

```javascript
portalPublicUrl: "https://YOUR-HOST/posture-clinic-portal"
```

Patient form links copied in **Applications** and **Settings** use this URL — not `localhost`.

6. Add staff emails to Supabase `staff_allowlist` (seed includes `ardeshir@drekhtiari.com`)

## Login

Staff sign in at **`login.html`** with Clerk.

- Session token stored locally as `posturePortalToken`
- Client pre-check: emails in `auth-config.js` `staffEmails`
- Server enforcement: Supabase RLS on `staff_allowlist`

### Configure Clerk

1. In the [Clerk Dashboard](https://dashboard.clerk.com), copy the **publishable key**
2. Paste it into `auth-config.js`:

```javascript
clerkPublishableKey: "pk_live_..."
```

3. Allow these redirect URLs in Clerk:

- `https://YOUR-PORTAL-HOST/login.html`
- `https://YOUR-PORTAL-HOST/sso-callback.html`
- `https://YOUR-PORTAL-HOST/app.html`

Local testing:

- `http://localhost:8080/login.html`
- `http://localhost:8080/sso-callback.html`
- `http://localhost:8080/app.html`

### Configure access

Edit `auth-config.js`:

```javascript
staffEmails: ["ardeshir@drekhtiari.com"]
```

Also add the same emails in Supabase `staff_allowlist`.

## Build the clinic app

1. Double-click **`Copy-App.cmd`**
2. It migrates `app.html` from `../Posture Clinic Website/app.html` if present
3. Otherwise it builds from `../Posture Clinic/PostureClinic.html`

Then open **`login.html`**, sign in, and use the portal.

## Fresh cloud start

Online mode starts with an **empty** cloud database. Existing browser `localStorage` or `PostureClinicData.json` files are **not** imported automatically. Use **Settings → Export Backup** from an old copy if you need to migrate data manually.

## Host the portal online (required for patient forms)

Supabase stores data in the cloud, but **HTML files must be hosted on the web** so doctors can send form links to patients.

1. Deploy the portal folder to a static host, for example:
   - **[Netlify](https://www.netlify.com)** — drag the `Posture Clinic Portal` folder onto Netlify Drop, or connect your GitHub repo
   - **[Cloudflare Pages](https://pages.cloudflare.com)** — connect repo, build command empty, output directory `/`
   - **GitHub Pages** — Settings → Pages (private repo Pages may require GitHub Pro)
2. Note your live URL, e.g. `https://posture-clinic.netlify.app` or `https://vaghakhani.github.io/posture-clinic-portal`
3. Set it in [`api-config.js`](api-config.js):

```javascript
portalPublicUrl: "https://posture-clinic.netlify.app"
```

4. In **Clerk Dashboard**, add redirect URLs for that host (`login.html`, `sso-callback.html`, `app.html`)
5. Staff can use either the hosted URL or localhost for daily work — **Copy link** always uses `portalPublicUrl`

Until `portalPublicUrl` is set, the portal shows a warning and copied links will not work for patients.

### Fix 404 on Netlify

If pages show **Page not found**, the wrong folder was uploaded. Netlify needs HTML files at the **root** of the dropped folder.

1. Double-click **`Deploy-to-Netlify.cmd`** or run **`.\Deploy-Netlify.ps1`** in PowerShell
2. A folder named **`netlify-deploy`** is built automatically
3. Drag **`netlify-deploy`** to Netlify, **or** use CLI deploy (below)

Test after deploy:

- `https://postureclinicportal.netlify.app/login.html`
- `https://postureclinicportal.netlify.app/patient-intake.html`

### Deploy from PowerShell (no drag and drop)

One-time setup:

```powershell
npm install -g netlify-cli
cd "D:\Cursor\Posture Clinic Portal"
netlify login
netlify link
```

When linking, choose site **`postureclinicportal`**.

Every deploy:

```powershell
cd "D:\Cursor\Posture Clinic Portal"
.\Deploy-Netlify.ps1
```

Optional: set `NETLIFY_AUTH_TOKEN` in your environment to skip browser login.

## Publish to GitHub

1. Keep the GitHub repo **private** (`posture-clinic-portal`)
2. Run **`Push-to-GitHub.cmd`**
3. Deploy from GitHub using Netlify/Cloudflare/Pages (see above)

## Public website

The public site repo should **not** contain `app.html` or the old password login.

Point its Staff Login link to this portal's `login.html`.

## Files

| File | Purpose |
|------|---------|
| `login.html` | Clerk staff login |
| `sso-callback.html` | Google OAuth return handler |
| `auth.js` | Clerk session + Supabase JWT + access checks |
| `auth-config.js` | Clerk key + staff allowlist |
| `api-config.js` | Supabase URL/key, online mode, **portalPublicUrl** for patient links |
| `patient-intake.html` | Public patient registration / clinical intake form |
| `chiropractic-consent.html` | Public consent document |
| `clinic-sync.js` | Load/save clinic data to Supabase |
| `supabase/schema.sql` | Database schema + RLS + seed |
| `app.html` | Clinic management app |
| `portal-neumorph.css` | Portal styling |
| `Copy-App.cmd` | Build / migrate app |

## Local preview

```bat
python -m http.server 8080
```

Then open `http://localhost:8080/login.html`

Clerk login and Supabase sync require HTTP, not `file://`.
