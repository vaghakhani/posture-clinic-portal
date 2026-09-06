(function () {
  var cfg = window.POSTURE_PORTAL_AUTH || {};
  var oauthIntentKey = "posturePortalOAuthIntent";
  var oauthErrorKey = "posturePortalOAuthError";
  var oauthProviderKey = "posturePortalOAuthProvider";
  var clerkState = { clerk: null, clerkLoadPromise: null };

  function getConfig() {
    return cfg;
  }

  function pageUrl(page) {
    var name = String(page || "").replace(/^\//, "");
    var dir = location.pathname.replace(/[^/]+$/, "");
    return location.origin + dir + name;
  }

  function getToken() {
    return localStorage.getItem(cfg.tokenKey || "posturePortalToken") || "";
  }

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem(cfg.userKey || "posturePortalUser") || "null");
    } catch (e) {
      return null;
    }
  }

  function persistSession(token, user) {
    if (token) localStorage.setItem(cfg.tokenKey, token);
    else localStorage.removeItem(cfg.tokenKey);
    if (user) localStorage.setItem(cfg.userKey, JSON.stringify(user));
    else localStorage.removeItem(cfg.userKey);
  }

  function clearSession() {
    persistSession("", null);
  }

  async function loadClerkScript(publishableKey) {
    if (window.Clerk) return;
    await new Promise(function (resolve, reject) {
      var existing = document.querySelector("script[data-posture-clerk-js]");
      if (existing) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }
      var script = document.createElement("script");
      script.async = true;
      script.crossOrigin = "anonymous";
      script.dataset.postureClerkJs = "true";
      script.dataset.clerkPublishableKey = publishableKey;
      script.src = "https://cdn.jsdelivr.net/npm/@clerk/clerk-js@5.125.12/dist/clerk.browser.js";
      script.addEventListener("load", resolve, { once: true });
      script.addEventListener("error", reject, { once: true });
      document.head.appendChild(script);
    });
  }

  async function getClerk() {
    if (clerkState.clerk) return clerkState.clerk;
    if (clerkState.clerkLoadPromise) return clerkState.clerkLoadPromise;
    clerkState.clerkLoadPromise = (async function () {
      var publishableKey = cfg.clerkPublishableKey;
      if (!publishableKey) {
        throw new Error("Add your Clerk publishable key to auth-config.js (Clerk Dashboard → API keys).");
      }
      await loadClerkScript(publishableKey);
      var clerk = window.Clerk;
      if (typeof clerk === "function") {
        clerk = new clerk(publishableKey);
        window.Clerk = clerk;
      }
      if (!clerk || !clerk.load) throw new Error("Clerk could not be loaded.");
      await clerk.load();
      clerkState.clerk = clerk;
      return clerk;
    })();
    return clerkState.clerkLoadPromise;
  }

  async function wait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  async function getActiveClerkSession(clerk) {
    for (var attempt = 0; attempt < 8; attempt += 1) {
      if (clerk.session) return clerk.session;
      var signIn = clerk.client && clerk.client.signIn;
      var signUp = clerk.client && clerk.client.signUp;
      var createdSessionId = (signIn && signIn.createdSessionId) || (signUp && signUp.createdSessionId);
      if (createdSessionId && clerk.setActive) await clerk.setActive({ session: createdSessionId }).catch(function () {});
      if (clerk.session) return clerk.session;
      var sessions = (clerk.client && clerk.client.sessions) || [];
      var session = sessions.find(function (item) { return item.status === "active"; }) || sessions[0];
      if (session && session.id && clerk.setActive) await clerk.setActive({ session: session.id }).catch(function () {});
      if (clerk.session) return clerk.session;
      if (session && session.getToken) return session;
      if (clerk.load) await clerk.load().catch(function () {});
      await wait(250);
    }
    return null;
  }

  function clerkUserEmail() {
    try {
      var clerkUser = window.Clerk && window.Clerk.user;
      var primary = clerkUser && clerkUser.primaryEmailAddress;
      var addresses = (clerkUser && clerkUser.emailAddresses) || [];
      return String(
        (primary && (primary.emailAddress || primary)) ||
        (addresses[0] && (addresses[0].emailAddress || addresses[0])) ||
        ""
      ).toLowerCase();
    } catch (e) {
      return "";
    }
  }

  function userEmail(user) {
    return String((user && (user.email || user.primaryEmailAddress)) || clerkUserEmail() || "").toLowerCase();
  }

  function sessionUser() {
    var clerkUser = window.Clerk && window.Clerk.user;
    return {
      id: (clerkUser && clerkUser.id) || "",
      email: clerkUserEmail()
    };
  }

  async function syncClerkSession() {
    var clerk = await getClerk();
    var session = await getActiveClerkSession(clerk);
    if (!session) return false;
    var token = await session.getToken();
    if (!token) return false;
    persistSession(token, sessionUser());
    return true;
  }

  async function verifyClinicAccess(user) {
    var allow = (cfg.staffEmails || []).map(function (email) { return String(email).toLowerCase(); });
    if (allow.indexOf(userEmail(user || getUser())) >= 0) return true;
    throw new Error("You do not have access to the Posture Clinic portal.");
  }

  async function completeClerkSignIn(attempt) {
    if (!attempt || attempt.status !== "complete" || !attempt.createdSessionId) {
      throw new Error("Could not complete sign-in. Please try again.");
    }
    var clerk = await getClerk();
    await clerk.setActive({ session: attempt.createdSessionId });
    if (!await syncClerkSession()) throw new Error("Could not open your portal session.");
    await verifyClinicAccess();
    return true;
  }

  async function signInWithEmail(email, password) {
    var clerk = await getClerk();
    await clerk.client.resetSignIn && clerk.client.resetSignIn();
    var attempt = await clerk.client.signIn.create({
      identifier: email,
      password: password
    });
    await completeClerkSignIn(attempt);
  }

  async function signInWithGoogle() {
    var clerk = await getClerk();
    await clerk.client.resetSignIn && clerk.client.resetSignIn();
    await clerk.client.resetSignUp && clerk.client.resetSignUp();
    sessionStorage.setItem(oauthIntentKey, "login");
    sessionStorage.setItem(oauthProviderKey, "Google");
    sessionStorage.removeItem(oauthErrorKey);
    await clerk.client.signIn.authenticateWithRedirect({
      strategy: "oauth_google",
      redirectUrl: pageUrl(cfg.ssoCallbackPage || "sso-callback.html"),
      redirectUrlComplete: pageUrl(cfg.appPage || "app.html")
    });
  }

  async function signOut() {
    clearSession();
    try {
      var clerk = await getClerk();
      await clerk.signOut && clerk.signOut({ redirectUrl: pageUrl(cfg.loginPage || "login.html") });
    } catch (e) {}
    location.href = cfg.loginPage || "login.html";
  }

  async function finishClerkRedirectIfPresent() {
    if (!location.search.includes("__clerk") && !location.hash.includes("__clerk")) return false;
    var clerk = await getClerk();
    var loginUrl = pageUrl(cfg.loginPage || "login.html");
    var appUrl = pageUrl(cfg.appPage || "app.html");
    await clerk.handleRedirectCallback({
      signInForceRedirectUrl: appUrl,
      signUpForceRedirectUrl: loginUrl,
      signInFallbackRedirectUrl: appUrl,
      signUpFallbackRedirectUrl: loginUrl,
      transferable: true
    });
    if (!await syncClerkSession()) throw new Error("Google sign-in finished, but the portal session could not be opened.");
    await verifyClinicAccess();
    location.replace(appUrl);
    return true;
  }

  async function completeOAuthReturn() {
    if (await finishClerkRedirectIfPresent()) return true;
    if (!await syncClerkSession()) {
      throw new Error("Google sign-in finished, but the portal session could not be opened.");
    }
    await verifyClinicAccess();
    location.replace(pageUrl(cfg.appPage || "app.html"));
    return true;
  }

  async function requireLoginPage() {
    if (location.search.includes("__clerk") || location.hash.includes("__clerk")) {
      await finishClerkRedirectIfPresent();
      return;
    }
    if (!getToken()) return;
    try {
      await verifyClinicAccess();
      location.replace(cfg.appPage || "app.html");
    } catch (e) {
      clearSession();
    }
  }

  async function requireAppAccess() {
    if (location.search.includes("__clerk") || location.hash.includes("__clerk")) {
      await finishClerkRedirectIfPresent();
      return false;
    }
    if (!getToken()) {
      location.replace(cfg.loginPage || "login.html");
      return false;
    }
    try {
      await verifyClinicAccess();
      return true;
    } catch (e) {
      clearSession();
      location.replace(cfg.loginPage || "login.html");
      return false;
    }
  }

  window.PosturePortalAuth = {
    getConfig: getConfig,
    getToken: getToken,
    getUser: getUser,
    pageUrl: pageUrl,
    signInWithEmail: signInWithEmail,
    signInWithGoogle: signInWithGoogle,
    signOut: signOut,
    requireLoginPage: requireLoginPage,
    requireAppAccess: requireAppAccess,
    finishClerkRedirectIfPresent: finishClerkRedirectIfPresent,
    completeOAuthReturn: completeOAuthReturn,
    verifyClinicAccess: verifyClinicAccess,
    syncClerkSession: syncClerkSession
  };
})();
