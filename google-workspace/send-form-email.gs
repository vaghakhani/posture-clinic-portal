/**
 * Posture Clinic Portal — send patient form links via Google Workspace Gmail
 *
 * SETUP
 * 1. script.google.com → sign in as ardeshir@ekhtiari.com
 * 2. Replace ALL code in the project with this file → Save
 * 3. Project Settings → Script properties → Add:
 *      PORTAL_SECRET = (same value as api-config.js gmailAppsScriptSecret)
 * 4. Run testSend → approve Gmail permissions → check inbox
 * 5. Deploy → New deployment → Web app
 *      Execute as: Me
 *      Who has access: Anyone
 * 6. Paste Web app URL into portal api-config.js → gmailAppsScriptUrl
 * 7. After any code change: Deploy → Manage deployments → Edit → New version
 */

var ALLOWED_ORIGINS = [
  'https://postureclinicportal.netlify.app',
  'http://localhost:8080'
];

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return json_({
    ok: true,
    service: 'Posture Clinic form email',
    from: Session.getActiveUser().getEmail(),
    note: 'Use POST from the staff portal to send patient form emails.'
  });
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return json_({ ok: false, error: 'Empty request body' });
    }

    var payload = JSON.parse(e.postData.contents);
    var secret = PropertiesService.getScriptProperties().getProperty('PORTAL_SECRET');

    if (!secret) {
      return json_({ ok: false, error: 'PORTAL_SECRET is not set in Script properties' });
    }
    if (String(payload.secret || '') !== String(secret)) {
      return json_({ ok: false, error: 'Unauthorized' });
    }

    if (payload.origin && ALLOWED_ORIGINS.indexOf(String(payload.origin)) === -1) {
      return json_({ ok: false, error: 'Origin not allowed' });
    }

    var to = String(payload.to || '').trim();
    var subject = String(payload.subject || '').trim();
    var body = String(payload.body || '');
    var htmlBody = String(payload.htmlBody || body || '');

    if (!to || !isValidEmail_(to)) {
      return json_({ ok: false, error: 'Invalid recipient email' });
    }
    if (!subject) {
      return json_({ ok: false, error: 'Missing subject' });
    }

    GmailApp.sendEmail(to, subject, body, {
      htmlBody: htmlBody,
      name: String(payload.fromName || 'Posture Clinic'),
      replyTo: String(payload.replyTo || Session.getActiveUser().getEmail())
    });

    return json_({ ok: true, to: to });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function isValidEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function testSend() {
  var secret = PropertiesService.getScriptProperties().getProperty('PORTAL_SECRET');
  if (!secret) {
    throw new Error('Add PORTAL_SECRET in Project Settings → Script properties first.');
  }

  var me = Session.getActiveUser().getEmail();
  GmailApp.sendEmail(
    me,
    'Posture Clinic — test form email',
    'If you received this, Gmail via Google Workspace is working.',
    {
      htmlBody: [
        '<div style="font-family:Arial,sans-serif">',
        '<h2 style="color:#1e40af">Posture Clinic</h2>',
        '<p>If you received this, <b>Gmail via Google Workspace</b> is working.</p>',
        '<p>You can now connect the staff portal Send email button.</p>',
        '</div>'
      ].join(''),
      name: 'Posture Clinic'
    }
  );
}

function testPost() {
  var secret = PropertiesService.getScriptProperties().getProperty('PORTAL_SECRET');
  if (!secret) {
    throw new Error('Add PORTAL_SECRET in Script properties first.');
  }

  var me = Session.getActiveUser().getEmail();
  var fakeEvent = {
    postData: {
      contents: JSON.stringify({
        secret: secret,
        origin: 'https://postureclinicportal.netlify.app',
        to: me,
        subject: 'Posture Clinic — POST test',
        body: 'Plain text test from testPost().',
        htmlBody: '<p><b>POST test</b> from Apps Script editor.</p>',
        fromName: 'Posture Clinic',
        replyTo: me
      })
    }
  };

  var result = doPost(fakeEvent);
  Logger.log(result.getContent());
}
