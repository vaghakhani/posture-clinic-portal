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
    var first = String((clerkUser && clerkUser.firstName) || "").trim();
    var last = String((clerkUser && clerkUser.lastName) || "").trim();
    var full = String((clerkUser && clerkUser.fullName) || [first, last].filter(Boolean).join(" ")).trim();
    return {
      id: (clerkUser && clerkUser.id) || "",
      email: clerkUserEmail(),
      firstName: first,
      lastName: last,
      fullName: full,
      name: full
    };
  }

  function displayName(user) {
    try {
      var clerkUser = window.Clerk && window.Clerk.user;
      if (clerkUser) {
        var live = String(clerkUser.fullName || [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || "").trim();
        if (live) return live;
      }
    } catch (e) {}
    var u = user || getUser();
    if (!u) return "";
    return String(u.fullName || u.name || [u.firstName, u.lastName].filter(Boolean).join(" ") || "").trim();
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

  async function resumeExistingClerkSession() {
    if (!await syncClerkSession()) return false;
    await verifyClinicAccess();
    return true;
  }

  async function clearClerkAndLocalSession() {
    clearSession();
    try {
      var clerk = await getClerk();
      if (clerk.signOut) await clerk.signOut();
      else if (clerk.client && clerk.client.signOut) await clerk.client.signOut();
    } catch (e) {}
  }

  async function getSupabaseToken() {
    var clerk = await getClerk();
    var session = await getActiveClerkSession(clerk);
    if (!session) return "";
    var apiCfg = window.POSTURE_PORTAL_API || {};
    // Native Clerk↔Supabase integration uses the default session token.
    // Only use a named JWT template when clerkJwtTemplate is set explicitly.
    var template = apiCfg.clerkJwtTemplate || "";
    try {
      var token = template
        ? await session.getToken({ template: template })
        : await session.getToken();
      return token || "";
    } catch (e) {
      var msg = (e && (e.message || e.toString())) || "";
      console.warn("Clerk Supabase JWT failed", e);
      if (template && (/template|not found|jwt/i.test(msg) || !msg)) {
        throw new Error(
          'Clerk JWT template "' + template + '" is missing or misconfigured. Prefer the native Clerk↔Supabase integration (Dashboard → Setup → Supabase), or fix the template name in api-config.js.'
        );
      }
      throw e;
    }
  }

  async function verifyClinicAccess(user) {
    var allow = (cfg.staffEmails || []).map(function (email) { return String(email).toLowerCase(); });
    if (allow.indexOf(userEmail(user || getUser())) >= 0) return true;
    throw new Error("You do not have access to the Posture Clinic portal.");
  }

  function clerkErrorMessage(error) {
    if (!error) return "Sign-in failed. Please try again.";
    var first = error.errors && error.errors[0];
    if (first) {
      return first.longMessage || first.message || first.code || "Sign-in failed. Please try again.";
    }
    return error.message || "Sign-in failed. Please try again.";
  }

  function incompleteSignInMessage(attempt) {
    var status = attempt && attempt.status;
    if (status === "needs_client_trust") {
      return "Clerk wants an email verification code for this device. In Clerk go to Configure → User & authentication → Email, turn off Email verification code under Sign-in with email, or use Continue with Google.";
    }
    if (status === "needs_second_factor") {
      return "A second verification step is required. Use Continue with Google, or adjust MFA in Clerk.";
    }
    if (status === "needs_first_factor") {
      return "This account may not have a password yet. In Clerk open Users → ardeshir@drekhtiari.com → Set password, then try again.";
    }
    if (status === "needs_new_password") {
      return "This account must set a new password in Clerk before signing in.";
    }
    return "Could not complete sign-in (status: " + (status || "unknown") + ").";
  }

  async function completeClerkSignIn(attempt) {
    if (!attempt || attempt.status !== "complete" || !attempt.createdSessionId) {
      throw new Error(incompleteSignInMessage(attempt));
    }
    var clerk = await getClerk();
    await clerk.setActive({ session: attempt.createdSessionId });
    if (!await syncClerkSession()) throw new Error("Could not open your portal session.");
    await verifyClinicAccess();
    return true;
  }

  async function signInWithEmail(email, password) {
    var clerk = await getClerk();
    if (await resumeExistingClerkSession()) return true;
    await clerk.client.resetSignIn && clerk.client.resetSignIn();
    try {
      var attempt = await clerk.client.signIn.create({ identifier: email });
      if (attempt.status === "needs_first_factor") {
        attempt = await attempt.attemptFirstFactor({ strategy: "password", password: password });
      }
      await completeClerkSignIn(attempt);
    } catch (error) {
      var message = clerkErrorMessage(error);
      if (/already signed in/i.test(message)) {
        if (await resumeExistingClerkSession()) return true;
        await clearClerkAndLocalSession();
        throw new Error("Your browser had a stale sign-in. Please tap Sign in to Portal again.");
      }
      if (error.message && error.message.indexOf("Could not complete") === 0) throw error;
      if (error.message && error.message.indexOf("Clerk wants") === 0) throw error;
      if (error.message && error.message.indexOf("This account") === 0) throw error;
      throw new Error(message);
    }
  }

  async function signInWithGoogle() {
    var clerk = await getClerk();
    if (await resumeExistingClerkSession()) {
      location.href = cfg.appPage || "app.html";
      return;
    }
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
    await clearClerkAndLocalSession();
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
    try {
      if (await resumeExistingClerkSession()) {
        location.replace(cfg.appPage || "app.html");
        return;
      }
    } catch (e) {
      await clearClerkAndLocalSession();
    }
  }

  async function requireAppAccess() {
    if (location.search.includes("__clerk") || location.hash.includes("__clerk")) {
      await finishClerkRedirectIfPresent();
      return false;
    }
    if (!getToken()) {
      try {
        if (!await syncClerkSession()) {
          location.replace(cfg.loginPage || "login.html");
          return false;
        }
      } catch (e) {
        await clearClerkAndLocalSession();
        location.replace(cfg.loginPage || "login.html");
        return false;
      }
    }
    try {
      await verifyClinicAccess();
      return true;
    } catch (e) {
      await clearClerkAndLocalSession();
      location.replace(cfg.loginPage || "login.html");
      return false;
    }
  }

  window.PosturePortalAuth = {
    getConfig: getConfig,
    getToken: getToken,
    getUser: getUser,
    displayName: displayName,
    pageUrl: pageUrl,
    signInWithEmail: signInWithEmail,
    signInWithGoogle: signInWithGoogle,
    signOut: signOut,
    requireLoginPage: requireLoginPage,
    requireAppAccess: requireAppAccess,
    finishClerkRedirectIfPresent: finishClerkRedirectIfPresent,
    completeOAuthReturn: completeOAuthReturn,
    verifyClinicAccess: verifyClinicAccess,
    syncClerkSession: syncClerkSession,
    getSupabaseToken: getSupabaseToken
  };
})();
