# Posture Clinic Portal

Private staff portal for Dr. Ekhtiari's clinic app (patients, SOAP notes, invoices, calendar).

This repo is **separate** from the public marketing website.

## Login

Staff sign in at **`login.html`** using the same **Flowra / Clerk** system as [flowra.ca/account.html](https://flowra.ca/account.html).

- Email + password through Clerk
- Google sign-in through Clerk
- Session token stored locally as `posturePortalToken`
- Only approved staff can enter the app

### Configure access

Edit `auth-config.js`:

```javascript
staffEmails: ["ardeshir@drekhtiari.com"]
```

For production, add this backend endpoint on Flowra API:

```
GET /api/clinic/posture/access
Authorization: Bearer <posturePortalToken>
→ { "allowed": true }
```

Once that endpoint exists, the portal uses server-side access control instead of the email allowlist fallback.

## Build the clinic app

1. Double-click **`Copy-App.cmd`**
2. It migrates `app.html` from `../Posture Clinic Website/app.html` if present
3. Otherwise it builds from `../Posture Clinic/PostureClinic.html`

Then open **`login.html`**, sign in, and use the portal.

## Clerk redirect URLs

In the Clerk dashboard, allow these redirect URLs for your portal host:

- `https://YOUR-PORTAL-HOST/login.html`
- `https://YOUR-PORTAL-HOST/sso-callback.html`
- `https://YOUR-PORTAL-HOST/app.html`

For local testing with `Preview Website.cmd`:

- `http://localhost:8080/login.html`
- `http://localhost:8080/sso-callback.html`
- `http://localhost:8080/app.html`

## Publish

1. Create a **private** GitHub repo, e.g. `posture-clinic-portal`
2. Update `auth-config.js` with your live portal URL if needed
3. Run **`Push-to-GitHub.cmd`**
4. Enable GitHub Pages only if you want a hosted portal (private repo Pages may require GitHub Pro)

Recommended: host under a controlled domain such as `https://flowra.ca/clinic/posture/` so auth and CORS stay aligned with Flowra.

## Public website

The public site repo should **not** contain `app.html` or the old password login.

Point its Staff Login link to this portal's `login.html`.

## Files

| File | Purpose |
|------|---------|
| `login.html` | Clerk / Flowra staff login |
| `sso-callback.html` | Google OAuth return handler |
| `auth.js` | Session + access checks |
| `auth-config.js` | API URLs + staff allowlist |
| `app.html` | Clinic management app |
| `portal-neumorph.css` | Portal styling |
| `Copy-App.cmd` | Build / migrate app |

## Local preview

Use the same approach as the public site:

```bat
python -m http.server 8080
```

Then open `http://localhost:8080/login.html`

FormSubmit is not used here. Clerk login requires HTTP, not `file://`.
