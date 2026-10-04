window.POSTURE_PORTAL_API = {
  onlineMode: true,
  supabaseUrl: "https://nqhkxvcockersjhrthiz.supabase.co",
  supabaseAnonKey: "sb_publishable_8Pm_fjrmseJ41od7FS-XDA_XDUgCU6b",
  snapshotId: "main",
  portalPublicUrl: "https://postureclinicportal.netlify.app",
  gmailAppsScriptUrl: "https://script.google.com/macros/s/AKfycbwYQbeMJFZLSBF0RJn8C-tCgOKdVVEgj_IUb4en2jJQ7vvVybtO9JNQQbqQNCfPG1Q43A/exec",
  gmailAppsScriptSecret: "JHFO*FjhvyfluG<JYgflyVUY^F^FKgckT6FcCUktckCGJHFYUvjhvjhv,jyg7u5u5786uyf"
};

window.getPortalPublicBase = function () {
  var cfg = window.POSTURE_PORTAL_API || {};
  var configured = String(cfg.portalPublicUrl || "").trim().replace(/\/+$/, "");
  if (configured) return configured;
  var dir = location.pathname.replace(/[^/]+$/, "");
  return (location.origin + dir).replace(/\/+$/, "");
};

window.portalPublicUrlConfigured = function () {
  return !!String((window.POSTURE_PORTAL_API || {}).portalPublicUrl || "").trim();
};

window.portalPatientIntakeUrl = function (type) {
  var base = window.getPortalPublicBase() + "/patient-intake.html";
  if (type === "osteopathy" || type === "non-chiropractic" || type === "registration") {
    return base + "?form=osteopathy";
  }
  return base;
};

window.portalConsentPageUrl = function (returnTo, doc) {
  var back = returnTo || (window.getPortalPublicBase() + "/patient-intake.html");
  var file = "treatment-consent.html";
  if (doc === "acupuncture") file = "acupuncture-consent.html";
  else if (doc === "osteopathy") file = "osteopathy-consent.html";
  else if (doc === "chiropractic") file = "chiropractic-consent.html";
  // Default / "treatment" uses the combined consent covering chiropractic, osteopathy, and acupuncture
  if (!doc || doc === "treatment") file = "treatment-consent.html";
  return window.getPortalPublicBase() + "/" + file + "?return=" + encodeURIComponent(back);
};

window.portalShareLinksReady = function () {
  var base = window.getPortalPublicBase();
  return !/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(base);
};
