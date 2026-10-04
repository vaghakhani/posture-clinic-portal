# Send form emails via Google Workspace

The portal can email patient form links **automatically** from `ardeshir@ekhtiari.com` using your **Google Workspace** account.

## Two options

| Option | Difficulty | Best for |
|--------|------------|----------|
| **A. Google Apps Script** (recommended) | Easy | One clinic, one Gmail/Workspace inbox |
| **B. Gmail API + Supabase Edge Function** | Advanced | Full control, audit logs, scale |

---

## Option A — Google Apps Script (recommended)

Uses your existing Workspace login. No separate mail server.

### Steps

1. Sign in to [Google Apps Script](https://script.google.com) as **ardeshir@ekhtiari.com**
2. **New project** → paste [`send-form-email.gs`](send-form-email.gs) → Save
3. **Project Settings** → **Script properties** → Add property:
   - Name: `PORTAL_SECRET`
   - Value: a long random password (e.g. 32+ characters)
4. Run **`testSend`** once → approve Gmail permissions → check your inbox
5. **Deploy** → **New deployment** → **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Copy the **Web app URL** (ends with `/exec`)
7. In [`api-config.js`](../api-config.js):

```javascript
gmailAppsScriptUrl: "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec",
gmailAppsScriptSecret: "same PORTAL_SECRET as step 3"
```

8. Redeploy the portal to Netlify

Staff click **Send email** in Applications → email goes out from your Workspace address (no manual Gmail Send).

### If send fails from the portal

- Confirm Web app is deployed as **Anyone**
- Re-run `testSend` in Apps Script
- Check **Executions** in Apps Script for errors
- Until fixed, the portal falls back to opening Gmail with a pre-filled message

---

## Option B — Gmail API (Google Cloud)

For direct API access (no Apps Script):

1. [Google Cloud Console](https://console.cloud.google.com) → new project
2. **APIs & Services** → Enable **Gmail API**
3. **OAuth consent screen** (Internal, for your Workspace org)
4. **Credentials** → OAuth client OR **Service account** with domain-wide delegation
5. Host a **Supabase Edge Function** that calls `users.messages.send`
6. Portal calls that function (keeps secrets off the browser)

This is more setup but is the long-term enterprise pattern. Ask if you want this built next.

---

## Important notes

- **Google Workspace includes Gmail** — you do not need a separate email API product
- **Apps Script is free** with Workspace (within Google quotas)
- The **From** address is the account that deploys the script (`ardeshir@ekhtiari.com`)
- Update clinic email in **Settings → Clinic Details** so replies go to the right address
