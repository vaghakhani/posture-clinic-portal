# Posture Clinic Portal — New Chat Handoff

Use this file when starting a **separate Cursor chat** for the private staff portal only.

Do **not** mix this with the public website repo (`../Posture Clinic Website/`).

This portal is **not** part of Flowra. Do not call Flowra APIs, host under flowra.ca, or share Flowra Clerk keys.

---

## Scope of the portal chat

**In scope:** `D:\Cursor\Posture Clinic Portal\`

- Clerk staff login (email + Google)
- Supabase cloud storage (online mode)
- `app.html` clinic management app
- Private GitHub repo `posture-clinic-portal`
- Clerk redirect URLs, staff access, portal hosting

**Out of scope:** public marketing site, contact form, articles, i18n, Flowra

Public site lives in `../Posture Clinic Website/` and only links here via `portal-config.js`.

---

## Current state

| Item | Status |
|------|--------|
| `login.html`, `login.js` | Done — Clerk email + Google |
| `auth.js`, `auth-config.js` | Done — Clerk + staff allowlist |
| `api-config.js`, `clinic-sync.js` | Done — Supabase load/save |
| `supabase/schema.sql` | Done — RLS + staff allowlist seed |
| `sso-callback.html` | Done |
| `portal-theme.css`, `portal-neumorph.css` | Done |
| `Copy-App.cmd`, `Migrate-Portal.ps1` | Done — online mode scripts + copy |
| `Push-to-GitHub.cmd`, `Preview Portal.cmd` | Done |
| `app.html` | Online mode; run `.\Copy-App.cmd` if regenerated from website |
| GitHub private repo | `posture-clinic-portal` |
| Clerk publishable key | Paste into `auth-config.js` |
| Supabase URL + anon key | Paste into `api-config.js` |
| Clerk JWT template `supabase` | User must create in Clerk Dashboard |
| Clerk third-party auth in Supabase | User must enable in Supabase Dashboard |

---

## Architecture

```
login.html → Clerk (auth-config.js)
           → staffEmails pre-check (auth-config.js)
           → app.html → clinic-sync.js → Supabase (clinic_snapshot)
           → RLS via staff_allowlist + Clerk JWT
```

**Fresh cloud start** — no automatic import from old localStorage or JSON files.

---

## Staff access

Edit `auth-config.js`:

```javascript
clerkPublishableKey: "pk_live_..."
staffEmails: ["ardeshir@drekhtiari.com"]
```

Also add emails to Supabase `staff_allowlist` table (see `supabase/schema.sql`).

---

## Supabase setup (one time)

1. Create Supabase project
2. Run `supabase/schema.sql` in SQL Editor
3. Clerk Dashboard → JWT templates → create **`supabase`**
4. Supabase Dashboard → Authentication → Third-party auth → enable Clerk
5. Paste Project URL + anon key into `api-config.js`

---

## Commands (PowerShell)

```powershell
cd "D:\Cursor\Posture Clinic Portal"
.\Copy-App.cmd          # build/migrate app.html
.\Preview Portal.cmd    # http://localhost:8080/login.html
.\Push-to-GitHub.cmd    # push to private repo
```

---

## Clerk redirect URLs to register

Replace host if not using GitHub Pages:

- `https://vaghakhani.github.io/posture-clinic-portal/login.html`
- `https://vaghakhani.github.io/posture-clinic-portal/sso-callback.html`
- `https://vaghakhani.github.io/posture-clinic-portal/app.html`

Local testing:

- `http://localhost:8080/login.html`
- `http://localhost:8080/sso-callback.html`
- `http://localhost:8080/app.html`

---

## Public website link (already configured)

`../Posture Clinic Website/portal-config.js`:

```javascript
window.POSTURE_PORTAL_URL = "https://vaghakhani.github.io/posture-clinic-portal/login.html";
```

Staff Login on the public site opens this URL in a new tab.

---

## Likely next tasks in portal chat

1. Paste Supabase URL + anon key into `api-config.js`
2. Confirm Clerk JWT template `supabase` and Supabase Clerk integration
3. Test login + add patient + refresh + second device
4. Push private repo if needed
5. Host via GitHub Pages (Pro) or another private host — not Flowra

---

## Files map

| File | Purpose |
|------|---------|
| `login.html` | Staff login page |
| `login.js` | Form + Google button |
| `auth.js` | Clerk load, session, Supabase JWT, access check |
| `auth-config.js` | Clerk key + staff allowlist |
| `api-config.js` | Supabase config + online mode |
| `clinic-sync.js` | Cloud load/save + sync status |
| `supabase/schema.sql` | Postgres schema + RLS |
| `sso-callback.html` | OAuth return |
| `app.html` | Clinic app |
| `Copy-App.cmd` | Build/migrate app |
| `Migrate-Portal.ps1` | Replace password auth with Clerk + online mode |
| `Push-to-GitHub.cmd` | Git push helper |
