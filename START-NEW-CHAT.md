# Posture Clinic Portal — New Chat Handoff

Use this file when starting a **separate Cursor chat** for the private staff portal only.

Do **not** mix this with the public website repo (`../Posture Clinic Website/`).

---

## Scope of the portal chat

**In scope:** `D:\Cursor\Posture Clinic Portal\`

- Clerk / Flowra staff login
- `app.html` clinic management app
- Private GitHub repo `posture-clinic-portal`
- Clerk redirect URLs, staff access, portal hosting

**Out of scope:** public marketing site, contact form, articles, i18n

Public site lives in `../Posture Clinic Website/` and only links here via `portal-config.js`.

---

## Current state

| Item | Status |
|------|--------|
| `login.html`, `login.js` | Done — Clerk email + Google |
| `auth.js`, `auth-config.js` | Done — Flowra API at `https://flowra.ca` |
| `sso-callback.html` | Done |
| `portal-theme.css`, `portal-neumorph.css` | Done |
| `Copy-App.cmd`, `Migrate-Portal.ps1` | Done — builds Clerk-gated `app.html` |
| `Push-to-GitHub.cmd`, `Preview Portal.cmd` | Done |
| `app.html` | **Run `.\Copy-App.cmd` if missing** |
| GitHub private repo | User creates `posture-clinic-portal` |
| Clerk redirect URLs | User must add portal host URLs |
| Flowra API `GET /api/clinic/posture/access` | Not built — uses email allowlist fallback |

---

## Staff access

Edit `auth-config.js`:

```javascript
staffEmails: ["ardeshir@drekhtiari.com"]
```

Fallback: if API returns 404/501, only listed emails can enter `app.html`.

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
login.html → Clerk (oauth-config + clerk/session on flowra.ca)
           → verifyClinicAccess (API or staffEmails)
           → app.html
```

Reference implementation: `D:\Cursor\Flowra.ca\Website\account.js`

---

## Public website link (already configured)

`../Posture Clinic Website/portal-config.js`:

```javascript
window.POSTURE_PORTAL_URL = "https://vaghakhani.github.io/posture-clinic-portal/login.html";
```

Staff Login on the public site opens this URL in a new tab.

---

## Likely next tasks in portal chat

1. Confirm `.\Copy-App.cmd` produced `app.html` with Clerk gate (no `Posture8118` password)
2. Create private GitHub repo and push
3. Register Clerk redirect URLs
4. Test login with `ardeshir@drekhtiari.com`
5. Optional: implement Flowra backend `/api/clinic/posture/access`
6. Optional: host under `flowra.ca/clinic/posture/` instead of GitHub Pages

---

## Files map

| File | Purpose |
|------|---------|
| `login.html` | Staff login page |
| `login.js` | Form + Google button |
| `auth.js` | Clerk load, session sync, access check |
| `auth-config.js` | API URLs, token keys, staff allowlist |
| `sso-callback.html` | OAuth return |
| `app.html` | Clinic app (generated) |
| `Copy-App.cmd` | Build/migrate app |
| `Migrate-Portal.ps1` | Replace password auth with Clerk |
| `Push-to-GitHub.cmd` | Git push helper |
