(function () {
  var CLINIC_NAME = "Posture Clinic";
  var params = new URLSearchParams(location.search);
  var returnUrl = params.get("return") || "patient-intake.html";
  var docKey = document.body.getAttribute("data-consent-doc") || "consent";
  var back = document.getElementById("backToForm");
  var acceptBtn = document.getElementById("acceptBtn");
  var declineBtn = document.getElementById("declineBtn");
  var actionHint = document.getElementById("consentActionHint");
  var statusBox = document.getElementById("consentStatus");
  var scrollEnd = document.getElementById("consentScrollEnd");
  var scrollPanel = document.getElementById("consentScrollPanel");
  var returnPath = returnUrl;

  try {
    var parsed = new URL(returnUrl, location.origin);
    if (parsed.origin === location.origin) {
      returnPath = parsed.pathname + parsed.search + parsed.hash;
      if (back) back.href = returnPath;
    } else if (back) {
      back.href = returnUrl;
    }
  } catch (e) {
    if (back) back.href = returnUrl;
  }

  if (!params.get("return") && document.referrer && document.referrer.indexOf(location.origin) === 0) {
    try {
      var ref = new URL(document.referrer);
      returnPath = ref.pathname + ref.search + ref.hash;
      if (back) back.href = returnPath;
    } catch (e2) {}
  }

  function consentScopeFromReturn(path) {
    try {
      var u = new URL(path, location.origin);
      var p = new URLSearchParams(u.search);
      p.delete("consent");
      p.delete("consentDoc");
      var qs = p.toString();
      return u.pathname + (qs ? "?" + qs : "");
    } catch (e) {
      return String(path).split("#")[0].split("?")[0];
    }
  }

  var scope = consentScopeFromReturn(returnPath);
  var storageKey = "postureIntakeConsent:" + docKey + ":" + scope;
  var canAccept = false;

  function describeDevice(ua) {
    ua = ua || navigator.userAgent || "";
    if (/iPhone/i.test(ua)) return "iPhone";
    if (/iPad/i.test(ua)) return "iPad";
    if (/Android/i.test(ua)) return /Mobile/i.test(ua) ? "Android phone" : "Android tablet";
    if (/Windows/i.test(ua)) return "Windows computer";
    if (/Macintosh|Mac OS X/i.test(ua)) return "Mac computer";
    if (/CrOS/i.test(ua)) return "Chromebook";
    if (/Linux/i.test(ua)) return "Linux computer";
    return "Web browser";
  }

  function setAcceptEnabled(enabled) {
    canAccept = enabled;
    if (acceptBtn) acceptBtn.disabled = !enabled;
    if (actionHint) {
      actionHint.textContent = enabled
        ? "You may now accept and return to the form."
        : "Scroll down and read the consent to the end, then accept.";
      actionHint.classList.toggle("consent-scroll-warn", !enabled);
      actionHint.classList.toggle("consent-scroll-ok", !!enabled);
    }
    if (statusBox) statusBox.hidden = enabled;
  }

  function goBack(flag) {
    var url = returnPath.split("#")[0];
    try {
      var u = new URL(url, location.origin);
      u.searchParams.delete("consent");
      u.searchParams.delete("consentDoc");
      u.searchParams.set("consent", flag);
      u.searchParams.set("consentDoc", docKey);
      u.hash = "consents";
      location.href = u.pathname + u.search + u.hash;
      return;
    } catch (e) {}
    var join = url.indexOf("?") >= 0 ? "&" : "?";
    location.href = url + join + "consent=" + encodeURIComponent(flag) + "&consentDoc=" + encodeURIComponent(docKey) + "#consents";
  }

  if (scrollEnd && scrollPanel && "IntersectionObserver" in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) setAcceptEnabled(true);
      });
    }, { root: scrollPanel, threshold: 0.85 });
    observer.observe(scrollEnd);
  } else if (scrollPanel) {
    scrollPanel.addEventListener("scroll", function () {
      if (scrollPanel.scrollTop + scrollPanel.clientHeight >= scrollPanel.scrollHeight - 16) {
        setAcceptEnabled(true);
      }
    });
  }

  if (acceptBtn) {
    acceptBtn.addEventListener("click", function () {
      if (!canAccept) {
        if (statusBox) statusBox.hidden = false;
        if (actionHint) {
          actionHint.textContent = "Scroll down and read the consent to the end, then accept.";
          actionHint.classList.add("consent-scroll-warn");
        }
        return;
      }
      try {
        sessionStorage.setItem(storageKey, JSON.stringify({
          status: "accepted",
          acceptedAt: new Date().toISOString(),
          document: docKey,
          clinic: CLINIC_NAME,
          device: describeDevice(),
          userAgent: navigator.userAgent || ""
        }));
      } catch (e) {}
      goBack("accepted");
    });
  }

  if (declineBtn) {
    declineBtn.addEventListener("click", function () {
      try {
        sessionStorage.setItem(storageKey, JSON.stringify({
          status: "declined",
          document: docKey,
          clinic: CLINIC_NAME
        }));
      } catch (e) {}
      goBack("declined");
    });
  }

  setAcceptEnabled(false);

  /* Auto-hide scrollbars: visible while scrolling, hidden shortly after */
  (function setupAutoHideScrollbars() {
    var timers = typeof WeakMap !== "undefined" ? new WeakMap() : null;
    var fallbackTimers = timers ? null : [];
    function clearTimer(el) {
      if (timers) {
        var prev = timers.get(el);
        if (prev) clearTimeout(prev);
        return;
      }
      for (var i = 0; i < fallbackTimers.length; i++) {
        if (fallbackTimers[i].el === el) {
          clearTimeout(fallbackTimers[i].id);
          fallbackTimers.splice(i, 1);
          break;
        }
      }
    }
    function setTimer(el, id) {
      if (timers) {
        timers.set(el, id);
        return;
      }
      fallbackTimers.push({ el: el, id: id });
    }
    document.addEventListener("scroll", function (e) {
      var el = e.target;
      if (el === document || el === document.documentElement || el === document.body) {
        el = document.documentElement;
      } else if (!(el && el.nodeType === 1)) {
        return;
      }
      el.classList.add("show-scrollbar");
      clearTimer(el);
      setTimer(el, setTimeout(function () {
        el.classList.remove("show-scrollbar");
      }, 900));
    }, true);
  })();
})();
