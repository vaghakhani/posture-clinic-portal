# Posture Clinic Portal

Private staff portal for Dr. Ekhtiari's clinic app (patients, SOAP notes, invoices, calendar).

This repo is **separate** from the public marketing website.

## Login

Staff sign in at **`login.html`** with **Clerk** (email + password, or Google).

- Session token stored locally as `posturePortalToken`
- Only emails listed in `auth-config.js` can enter the app

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

## Build the clinic app

1. Double-click **`Copy-App.cmd`**
2. It migrates `app.html` from `../Posture Clinic Website/app.html` if present
3. Otherwise it builds from `../Posture Clinic/PostureClinic.html`

Then open **`login.html`**, sign in, and use the portal.

## Publish

1. Keep the GitHub repo **private** (`posture-clinic-portal`)
2. Run **`Push-to-GitHub.cmd`**
3. Enable GitHub Pages only if you want a hosted portal (private repo Pages may require GitHub Pro)

## Public website

The public site repo should **not** contain `app.html` or the old password login.

Point its Staff Login link to this portal's `login.html`.

## Files

| File | Purpose |
|------|---------|
| `login.html` | Clerk staff login |
| `sso-callback.html` | Google OAuth return handler |
| `auth.js` | Clerk session + access checks |
| `auth-config.js` | Clerk key + staff allowlist |
| `app.html` | Clinic management app |
| `portal-neumorph.css` | Portal styling |
| `Copy-App.cmd` | Build / migrate app |

## Local preview

```bat
python -m http.server 8080
```

Then open `http://localhost:8080/login.html`

Clerk login requires HTTP, not `file://`.
