# Posture Clinic Portal — New Chat Handoff

Use this file when starting a **separate Cursor chat** for the private staff portal only.

Do **not** mix this with the public website repo (`../Posture Clinic Website/`).

This portal is **not** part of Flowra. Do not call Flowra APIs, host under flowra.ca, or share Flowra Clerk keys.

---

## Scope of the portal chat

**In scope:** `D:\Cursor\Posture Clinic Portal\`

- Clerk staff login (email + Google)
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
| `auth.js`, `auth-config.js` | Done — Clerk only (no Flowra API) |
| `sso-callback.html` | Done |
| `portal-theme.css`, `portal-neumorph.css` | Done |
| `Copy-App.cmd`, `Migrate-Portal.ps1` | Done — builds Clerk-gated `app.html` |
| `Push-to-GitHub.cmd`, `Preview Portal.cmd` | Done |
| `app.html` | Clerk-gated; run `.\Copy-App.cmd` if missing |
| GitHub private repo | `posture-clinic-portal` |
| Clerk publishable key | Paste into `auth-config.js` |
| Clerk redirect URLs | User must add portal host URLs |

---

## Staff access

Edit `auth-config.js`:

```javascript
clerkPublishableKey: "pk_live_..."
staffEmails: ["ardeshir@drekhtiari.com"]
```

Only listed emails can enter `app.html`.

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

## Auth flow

```
login.html → Clerk (publishable key in auth-config.js)
           → staffEmails allowlist
           → app.html
```

---

## Public website link (already configured)

`../Posture Clinic Website/portal-config.js`:

```javascript
window.POSTURE_PORTAL_URL = "https://vaghakhani.github.io/posture-clinic-portal/login.html";
```

Staff Login on the public site opens this URL in a new tab.

---

## Likely next tasks in portal chat

1. Paste Clerk publishable key into `auth-config.js`
2. Register Clerk redirect URLs
3. Test login with `ardeshir@drekhtiari.com`
4. Push private repo if needed
5. Host via GitHub Pages (Pro) or another private host — not Flowra

---

## Files map

| File | Purpose |
|------|---------|
| `login.html` | Staff login page |
| `login.js` | Form + Google button |
| `auth.js` | Clerk load, session, access check |
| `auth-config.js` | Clerk key + staff allowlist |
| `sso-callback.html` | OAuth return |
| `app.html` | Clinic app (generated) |
| `Copy-App.cmd` | Build/migrate app |
| `Migrate-Portal.ps1` | Replace password auth with Clerk |
| `Push-to-GitHub.cmd` | Git push helper |
