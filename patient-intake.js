(function () {
  var BODY_REGIONS = [
    "Head", "Neck", "Left Shoulder", "Right Shoulder", "Upper Back", "Mid Back", "Lower Back",
    "Left Elbow", "Right Elbow", "Left Wrist/Hand", "Right Wrist/Hand", "Left Hip", "Right Hip", "Sacrum/Tailbone",
    "Left Knee", "Right Knee", "Left Ankle/Foot", "Right Ankle/Foot", "Chest", "Abdomen"
  ];
  var pain = {};
  var params = new URLSearchParams(location.search);
  var formParam = (params.get("form") || "").toLowerCase();
  var isOsteopathy = formParam === "osteopathy" || formParam === "registration" || formParam === "non-chiro" || formParam === "non-chiropractic";
  var profileType = isOsteopathy ? "osteopathy" : "chiropractic";
  var primaryDoc = "treatment";
  var primaryConsentTitle = "Consent to Treatment";
  var primaryConsentFile = "treatment-consent.html";

  function formScopePath() {
    var p = new URLSearchParams(location.search);
    p.delete("consent");
    p.delete("consentDoc");
    var qs = p.toString();
    return location.pathname + (qs ? "?" + qs : "");
  }

  var formScope = formScopePath();
  var DRAFT_KEY = "postureIntakeDraft:" + formScope;
  var saveTimer = null;

  function $(id) { return document.getElementById(id); }

  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function showStatus(message, type) {
    var box = $("statusBox");
    box.hidden = false;
    box.className = "status " + type;
    box.textContent = message;
    try { box.scrollIntoView({ behavior: "smooth", block: "nearest" }); } catch (e) {}
  }

  function hideStatus() {
    var box = $("statusBox");
    box.hidden = true;
    box.textContent = "";
  }

  function val(id) {
    if (id === "insuranceHolderIsPatient") {
      var checked = document.querySelector('input[name="insuranceHolderIsPatient"]:checked');
      return checked ? String(checked.value || "").trim() : "yes";
    }
    var el = $(id);
    return el ? String(el.value || "").trim() : "";
  }

  function setVal(id, value) {
    if (id === "insuranceHolderIsPatient") {
      var v = value === "no" || value === false || value === "Someone else" ? "no" : "yes";
      var radio = document.querySelector('input[name="insuranceHolderIsPatient"][value="' + v + '"]');
      if (radio) radio.checked = true;
      return;
    }
    var el = $(id);
    if (el && value != null) el.value = value;
  }

  function consentStorageKey(doc) {
    return "postureIntakeConsent:" + doc + ":" + formScope;
  }

  function legacyConsentKey() {
    return "postureIntakeConsent:" + formScope;
  }

  function consentRecord(doc) {
    try {
      var raw = sessionStorage.getItem(consentStorageKey(doc));
      if (raw) return JSON.parse(raw);
      // migrate previous single-key consent for chiro forms
      if (doc === "chiropractic") {
        var legacy = sessionStorage.getItem(legacyConsentKey());
        if (legacy) return JSON.parse(legacy);
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  function isConsentAccepted(doc) {
    var rec = consentRecord(doc);
    return !!(rec && rec.status === "accepted");
  }

  function consentPageUrl() {
    var base = location.origin + formScope;
    if (window.portalConsentPageUrl) return window.portalConsentPageUrl(base, "treatment");
    return "treatment-consent.html?return=" + encodeURIComponent(base);
  }

  function fieldIds() {
    return [
      "first", "last", "dob", "sex", "phone", "email", "occupation", "address",
      "insurance", "policy", "group",
      "insuranceHolderIsPatient", "insuranceHolderName", "insuranceHolderDob", "insuranceHolderRel",
      "medicalHistory", "medications", "familyHistory"
    ];
  }

  function isoFromDisplay(text) {
    var m = String(text || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return "";
    var mm = ("0" + m[1]).slice(-2);
    var dd = ("0" + m[2]).slice(-2);
    var yyyy = m[3];
    var d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    if (d.getFullYear() !== Number(yyyy) || d.getMonth() !== Number(mm) - 1 || d.getDate() !== Number(dd)) return "";
    return yyyy + "-" + mm + "-" + dd;
  }

  function displayFromIso(iso) {
    var m = String(iso || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) {
      // already mm/dd/yyyy?
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(String(iso || "").trim())) return String(iso).trim();
      return "";
    }
    return m[2] + "/" + m[3] + "/" + m[1];
  }

  function dateValue(id) {
    var text = val(id);
    var iso = isoFromDisplay(text);
    if (iso) return iso;
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    return text;
  }

  var activeDateId = null;
  var dateView = {}; // id -> { year, month(0-11), mode: 'days'|'months'|'years' }
  var MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  function parseDateParts(id) {
    var iso = isoFromDisplay(val(id));
    if (iso) {
      var p = iso.split("-");
      return { year: Number(p[0]), month: Number(p[1]) - 1, day: Number(p[2]) };
    }
    var now = new Date();
    return { year: now.getFullYear(), month: now.getMonth(), day: 0 };
  }

  function closeAllDateDropdowns(exceptId) {
    document.querySelectorAll(".date-dropdown").forEach(function (dd) {
      var wrap = dd.closest(".date-entry");
      var id = wrap && wrap.getAttribute("data-date-id");
      if (exceptId && id === exceptId) return;
      dd.hidden = true;
    });
    if (!exceptId) activeDateId = null;
  }

  function renderDateDropdown(id) {
    var dd = $(id + "_dropdown");
    if (!dd) return;
    var state = dateView[id] || (dateView[id] = Object.assign({ mode: "days" }, parseDateParts(id)));
    var y = state.year;
    var m = state.month;
    var selectedIso = isoFromDisplay(val(id));
    var html = "";

    if (state.mode === "years") {
      var maxY = new Date().getFullYear() + 1;
      var minY = 1920;
      html += '<div class="date-dd-toolbar"><button type="button" class="date-dd-title" data-act="to-days">' + y + '</button></div>';
      html += '<div class="date-dd-years">';
      for (var yy = maxY; yy >= minY; yy--) {
        html += '<button type="button" class="date-dd-year' + (yy === y ? " is-on" : "") + '" data-year="' + yy + '">' + yy + "</button>";
      }
      html += "</div>";
    } else if (state.mode === "months") {
      html += '<div class="date-dd-toolbar"><button type="button" class="date-dd-title" data-act="to-years">' + y + '</button></div>';
      html += '<div class="date-dd-months">';
      MONTHS.forEach(function (name, idx) {
        html += '<button type="button" class="date-dd-month' + (idx === m ? " is-on" : "") + '" data-month="' + idx + '">' + name + "</button>";
      });
      html += "</div>";
    } else {
      html += '<div class="date-dd-toolbar">';
      html += '<button type="button" class="date-dd-nav" data-act="prev" aria-label="Previous month">&lsaquo;</button>';
      html += '<button type="button" class="date-dd-title" data-act="to-months">' + MONTHS[m] + " " + y + "</button>";
      html += '<button type="button" class="date-dd-nav" data-act="next" aria-label="Next month">&rsaquo;</button>';
      html += "</div>";
      html += '<div class="date-dd-weekdays"><span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span></div>';
      html += '<div class="date-dd-days">';
      var first = new Date(y, m, 1).getDay();
      var daysInMonth = new Date(y, m + 1, 0).getDate();
      var i;
      for (i = 0; i < first; i++) html += '<span class="date-dd-empty"></span>';
      for (var d = 1; d <= daysInMonth; d++) {
        var iso = y + "-" + ("0" + (m + 1)).slice(-2) + "-" + ("0" + d).slice(-2);
        html += '<button type="button" class="date-dd-day' + (iso === selectedIso ? " is-on" : "") + '" data-iso="' + iso + '">' + d + "</button>";
      }
      html += "</div>";
      html += '<div class="date-dd-foot"><button type="button" data-act="clear">Clear</button><button type="button" data-act="today">Today</button></div>';
    }
    dd.innerHTML = html;
  }

  function openDateDropdown(id) {
    var textEl = $(id);
    var dd = $(id + "_dropdown");
    if (!textEl || !dd) return;
    if (!dateView[id]) dateView[id] = Object.assign({ mode: "days" }, parseDateParts(id));
    else {
      var parts = parseDateParts(id);
      if (isoFromDisplay(val(id))) {
        dateView[id].year = parts.year;
        dateView[id].month = parts.month;
      }
    }
    closeAllCustomSelectMenus();
    closeAllDateDropdowns(id);
    activeDateId = id;
    dd.hidden = false;
    renderDateDropdown(id);
  }

  function setupDateFields() {
    ["dob", "insuranceHolderDob"].forEach(function (id) {
      var textEl = $(id);
      var dd = $(id + "_dropdown");
      var wrap = textEl && textEl.closest(".date-entry");
      if (!textEl || !dd || !wrap) return;

      if (/^\d{4}-\d{2}-\d{2}$/.test(textEl.value)) textEl.value = displayFromIso(textEl.value);

      function onType() {
        var raw = textEl.value.replace(/[^\d]/g, "").slice(0, 8);
        var out = raw;
        if (raw.length > 4) out = raw.slice(0, 2) + "/" + raw.slice(2, 4) + "/" + raw.slice(4);
        else if (raw.length > 2) out = raw.slice(0, 2) + "/" + raw.slice(2);
        textEl.value = out;
        var iso = isoFromDisplay(out);
        if (iso) {
          var p = iso.split("-");
          dateView[id] = { mode: "days", year: Number(p[0]), month: Number(p[1]) - 1, day: Number(p[2]) };
          if (!dd.hidden) renderDateDropdown(id);
        }
        scheduleSaveDraft();
      }

      textEl.addEventListener("focus", function () { openDateDropdown(id); });
      textEl.addEventListener("click", function () { openDateDropdown(id); });
      textEl.addEventListener("input", onType);
      textEl.addEventListener("keydown", function (e) {
        if (e.key === "Escape") closeAllDateDropdowns();
        if (e.key === "ArrowDown") { e.preventDefault(); openDateDropdown(id); }
      });

      dd.addEventListener("mousedown", function (e) {
        // Keep text focus so user can keep typing while using calendar
        e.preventDefault();
        e.stopPropagation();
      });

      dd.addEventListener("click", function (e) {
        e.stopPropagation();
        var btn = e.target.closest("button");
        if (!btn) return;
        var state = dateView[id] || (dateView[id] = Object.assign({ mode: "days" }, parseDateParts(id)));
        var act = btn.getAttribute("data-act");
        if (act === "prev") {
          state.month -= 1;
          if (state.month < 0) { state.month = 11; state.year -= 1; }
          state.mode = "days";
          renderDateDropdown(id);
          return;
        }
        if (act === "next") {
          state.month += 1;
          if (state.month > 11) { state.month = 0; state.year += 1; }
          state.mode = "days";
          renderDateDropdown(id);
          return;
        }
        if (act === "to-months") { state.mode = "months"; renderDateDropdown(id); return; }
        if (act === "to-years") { state.mode = "years"; renderDateDropdown(id); return; }
        if (act === "to-days") { state.mode = "days"; renderDateDropdown(id); return; }
        if (act === "clear") {
          textEl.value = "";
          scheduleSaveDraft();
          renderDateDropdown(id);
          return;
        }
        if (act === "today") {
          var t = new Date();
          var isoT = t.getFullYear() + "-" + ("0" + (t.getMonth() + 1)).slice(-2) + "-" + ("0" + t.getDate()).slice(-2);
          textEl.value = displayFromIso(isoT);
          dateView[id] = { mode: "days", year: t.getFullYear(), month: t.getMonth(), day: t.getDate() };
          scheduleSaveDraft();
          renderDateDropdown(id);
          return;
        }
        if (btn.hasAttribute("data-year")) {
          state.year = Number(btn.getAttribute("data-year"));
          state.mode = "months";
          renderDateDropdown(id);
          return;
        }
        if (btn.hasAttribute("data-month")) {
          state.month = Number(btn.getAttribute("data-month"));
          state.mode = "days";
          renderDateDropdown(id);
          return;
        }
        if (btn.hasAttribute("data-iso")) {
          textEl.value = displayFromIso(btn.getAttribute("data-iso"));
          scheduleSaveDraft();
          closeAllDateDropdowns();
        }
      });
    });

    document.querySelectorAll(".date-cal-btn").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var id = btn.getAttribute("data-date-for");
        var dd = $(id + "_dropdown");
        if (dd && !dd.hidden && activeDateId === id) closeAllDateDropdowns();
        else {
          openDateDropdown(id);
          var textEl = $(id);
          if (textEl) textEl.focus();
        }
      });
    });

    document.addEventListener("click", function (e) {
      if (clickPathContains(e, "date-entry") || clickPathContains(e, "date-dropdown")) return;
      closeAllDateDropdowns();
    });
  }

  function clickPathContains(e, className) {
    try {
      var path = e.composedPath ? e.composedPath() : [];
      for (var i = 0; i < path.length; i++) {
        var n = path[i];
        if (n && n.classList && n.classList.contains(className)) return true;
      }
    } catch (err) {}
    return !!(e.target && e.target.closest && e.target.closest("." + className));
  }

  function syncDatePair(id) {
    var textEl = $(id);
    if (!textEl) return;
    var iso = isoFromDisplay(textEl.value);
    if (iso) textEl.value = displayFromIso(iso);
  }

  function saveDraft() {
    var draft = {
      pain: pain,
      primaryConsentChecked: !!( $("primaryConsent") && $("primaryConsent").checked )
    };
    fieldIds().forEach(function (id) {
      if (id === "insuranceHolderIsPatient") {
        draft[id] = val(id);
        return;
      }
      var el = $(id);
      if (!el) return;
      draft[id] = (id === "dob" || id === "insuranceHolderDob") ? dateValue(id) : el.value;
    });
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch (e) {}
  }

  function scheduleSaveDraft() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveDraft, 250);
  }

  function restoreDraft() {
    var draft;
    try {
      draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "null");
    } catch (e) {
      draft = null;
    }
    if (!draft) return;

    fieldIds().forEach(function (id) {
      if (draft[id] == null) return;
      if (id === "dob" || id === "insuranceHolderDob") setVal(id, displayFromIso(draft[id]) || draft[id]);
      else setVal(id, draft[id]);
    });

    if (draft.pain && typeof draft.pain === "object") {
      pain = JSON.parse(JSON.stringify(draft.pain));
      restorePainUi();
    }
    updatePolicyHolderUi();
    syncDatePair("dob");
    syncDatePair("insuranceHolderDob");
  }

  function restorePainUi() {
    var wrap = $("painRegions");
    if (!wrap) return;
    wrap.querySelectorAll(".pain-item").forEach(function (item) {
      var region = item.getAttribute("data-region");
      if (region === "Other") {
        var otherInput = item.querySelector('input[type="text"]');
        var note = (pain.Other && pain.Other.note) ? String(pain.Other.note) : "";
        if (otherInput) otherInput.value = note;
        item.classList.toggle("on", !!note.trim());
        return;
      }
      var checked = !!pain[region];
      var input = item.querySelector('input[type="checkbox"]');
      if (input) input.checked = checked;
      item.classList.toggle("on", checked);
    });
  }

  function updatePolicyHolderUi() {
    var box = $("policyHolderFields");
    if (!box) return;
    box.hidden = val("insuranceHolderIsPatient") !== "no";
  }

  function setupPolicyHolderRadios() {
    document.querySelectorAll('input[name="insuranceHolderIsPatient"]').forEach(function (radio) {
      radio.addEventListener("change", function () {
        updatePolicyHolderUi();
        scheduleSaveDraft();
      });
    });
    updatePolicyHolderUi();
  }

  function setConsentAttention(on) {
    var hint = $("primaryConsentHint");
    if (hint) hint.classList.toggle("is-attention", !!on);
  }

  function updateConsentUi() {
    var box = $("primaryConsent");
    var row = $("primaryConsentRow");
    var hint = $("primaryConsentHint");
    if (!box) return;

    var accepted = isConsentAccepted(primaryDoc);
    // Keep checkbox looking normal (not greyed). Block checking in handlers until accepted.
    box.disabled = false;
    box.removeAttribute("disabled");
    if (row) {
      row.classList.toggle("is-ready", accepted);
      row.classList.toggle("is-locked", !accepted);
    }
    if (hint) {
      if (accepted) {
        hint.classList.remove("is-attention");
        hint.innerHTML = "Consent accepted. You may now check the box below.";
      } else if (!hint.classList.contains("is-attention")) {
        hint.innerHTML = 'Open the <b>' + primaryConsentTitle + '</b> link below, scroll to the bottom, click <b>Accept</b>, then return here to check this box.';
      }
    }
    if (accepted) setConsentAttention(false);

    var rec = consentRecord(primaryDoc);
    if (accepted && rec && rec.consentChecked) box.checked = true;
  }

  function warnConsentRequired() {
    var hint = $("primaryConsentHint");
    if (hint) {
      hint.innerHTML = 'Open the <b>' + primaryConsentTitle + '</b> link below, scroll to the bottom, click <b>Accept</b>, then return here to check this box.';
      hint.classList.add("is-attention");
    }
    hideStatus();
  }

  function setupConsentGate() {
    var link = $("primaryConsentLink");
    var hintTitle = $("consentHintTitle");
    if (hintTitle) hintTitle.textContent = primaryConsentTitle;
    if (link) {
      link.textContent = primaryConsentTitle;
      link.href = consentPageUrl();
      link.addEventListener("click", function () { saveDraft(); });
    }

    var row = $("primaryConsentRow");
    function gateClick(e) {
      if (e.target.closest(".consent-inline-link")) return;
      if (isConsentAccepted(primaryDoc)) return;
      e.preventDefault();
      e.stopPropagation();
      var boxEl = $("primaryConsent");
      if (boxEl) boxEl.checked = false;
      warnConsentRequired();
    }
    if (row) row.addEventListener("click", gateClick);

    var box = $("primaryConsent");
    if (box) {
      box.disabled = false;
      box.removeAttribute("disabled");
      box.addEventListener("click", function (e) {
        if (isConsentAccepted(primaryDoc)) return;
        e.preventDefault();
        e.stopPropagation();
        box.checked = false;
        warnConsentRequired();
      });
      box.addEventListener("keydown", function (e) {
        if (e.key !== " " && e.key !== "Enter") return;
        if (isConsentAccepted(primaryDoc)) return;
        e.preventDefault();
        box.checked = false;
        warnConsentRequired();
      });
      box.addEventListener("change", function () {
        if (!isConsentAccepted(primaryDoc)) {
          box.checked = false;
          warnConsentRequired();
          return;
        }
        setConsentAttention(false);
        saveDraft();
      });
    }
    updateConsentUi();
  }

  function scrollToConsentsIfNeeded() {
    var returning = location.hash === "#consents" || params.get("consent") === "accepted" || params.get("consent") === "declined";
    if (!returning) return;
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";

    function place() {
      var el = $("consents");
      if (!el) return;
      var top = el.getBoundingClientRect().top + (window.pageYOffset || document.documentElement.scrollTop) - 16;
      window.scrollTo(0, Math.max(0, top));
    }

    try {
      var draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "null");
      if (draft && isConsentAccepted(primaryDoc) && draft.primaryConsentChecked && $("primaryConsent")) {
        $("primaryConsent").checked = true;
      }
    } catch (e) {}
    updateConsentUi();
    place();
    requestAnimationFrame(place);
    setTimeout(function () {
      place();
      document.documentElement.classList.remove("returning-from-consent");
      try { history.replaceState(null, "", formScope + "#consents"); } catch (e2) {}
    }, 0);
  }

  function setupClinicPhone() {
    var link = $("clinicPhoneLink");
    if (!link) return;
    var phone = "647-835-8118";
    var isPhone = window.matchMedia("(hover: none), (pointer: coarse), (max-width: 720px)").matches;
    if (isPhone) {
      link.href = "tel:+16478358118";
      link.title = "Call clinic";
      return;
    }
    link.href = "#";
    link.title = "Click to copy phone number";
    link.addEventListener("click", function (e) {
      e.preventDefault();
      var done = function () {
        var prev = link.textContent;
        link.textContent = "Copied!";
        setTimeout(function () { link.textContent = prev; }, 1200);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(phone).then(done).catch(function () {
          window.prompt("Copy phone number:", phone);
        });
      } else {
        window.prompt("Copy phone number:", phone);
      }
    });
  }

  function syncCustomSelect(select) {
    var wrap = select.closest(".custom-select");
    if (!wrap) return;
    var trigger = wrap.querySelector(".custom-select-trigger");
    var menu = wrap.querySelector(".custom-select-menu");
    if (!trigger || !menu) return;
    var emptyLabel = select.getAttribute("data-placeholder") || "Select…";
    var opt = select.options[select.selectedIndex];
    var label = select.value && opt && opt.value ? opt.textContent : emptyLabel;
    trigger.textContent = label;
    trigger.classList.toggle("is-placeholder", !select.value);
    menu.querySelectorAll(".custom-select-option").forEach(function (item) {
      item.classList.toggle("is-selected", item.dataset.value === select.value);
    });
  }

  function resetCustomSelectMenu(menu) {
    if (!menu) return;
    menu.classList.remove("is-fixed", "open-up");
    menu.style.top = "";
    menu.style.bottom = "";
    menu.style.left = "";
    menu.style.width = "";
    menu.style.maxHeight = "";
  }

  function positionCustomSelectMenu(trigger, menu) {
    resetCustomSelectMenu(menu);
    var rect = trigger.getBoundingClientRect();
    var preferred = Math.min(220, menu.scrollHeight || 220);
    var spaceBelow = window.innerHeight - rect.bottom - 12;
    var spaceAbove = rect.top - 12;
    var openDown = spaceBelow >= 140 || spaceBelow >= spaceAbove;

    menu.classList.add("is-fixed");
    menu.style.width = Math.round(rect.width) + "px";
    menu.style.left = Math.round(rect.left) + "px";

    if (openDown) {
      menu.style.top = Math.round(rect.bottom + 6) + "px";
      menu.style.bottom = "auto";
      menu.style.maxHeight = Math.max(120, Math.min(preferred, spaceBelow)) + "px";
    } else {
      menu.classList.add("open-up");
      menu.style.bottom = Math.round(window.innerHeight - rect.top + 6) + "px";
      menu.style.top = "auto";
      menu.style.maxHeight = Math.max(120, Math.min(preferred, spaceAbove)) + "px";
    }
  }

  function closeAllCustomSelectMenus(exceptMenu) {
    document.querySelectorAll(".custom-select-menu").forEach(function (menu) {
      if (menu === exceptMenu) return;
      menu.hidden = true;
      resetCustomSelectMenu(menu);
      var wrap = menu.closest(".custom-select");
      var trigger = wrap && wrap.querySelector(".custom-select-trigger");
      if (trigger) trigger.setAttribute("aria-expanded", "false");
    });
  }

  function openCustomSelectMenu(trigger, menu) {
    closeAllDateDropdowns();
    closeAllCustomSelectMenus(menu);
    menu.hidden = false;
    positionCustomSelectMenu(trigger, menu);
    trigger.setAttribute("aria-expanded", "true");
  }

  function closeCustomSelectMenu(trigger, menu) {
    menu.hidden = true;
    resetCustomSelectMenu(menu);
    trigger.setAttribute("aria-expanded", "false");
  }

  function setupCustomSelects() {
    var form = $("patientIntakeForm");
    if (!form) return;
    form.querySelectorAll("select").forEach(function (select) {
      if (select.closest(".custom-select")) return;

      var wrap = document.createElement("div");
      wrap.className = "custom-select";
      select.parentNode.insertBefore(wrap, select);
      wrap.appendChild(select);
      select.classList.add("native-select");

      var trigger = document.createElement("button");
      trigger.type = "button";
      trigger.className = "custom-select-trigger";
      trigger.setAttribute("aria-haspopup", "listbox");
      trigger.setAttribute("aria-expanded", "false");

      var menu = document.createElement("div");
      menu.className = "custom-select-menu";
      menu.hidden = true;
      menu.setAttribute("role", "listbox");

      Array.prototype.forEach.call(select.options, function (opt) {
        if (!String(opt.value || "").trim()) return; // no blank row in the menu
        var item = document.createElement("button");
        item.type = "button";
        item.className = "custom-select-option";
        item.textContent = opt.textContent;
        item.dataset.value = opt.value;
        item.setAttribute("role", "option");
        item.addEventListener("click", function (e) {
          e.preventDefault();
          select.value = opt.value;
          select.dispatchEvent(new Event("change", { bubbles: true }));
          syncCustomSelect(select);
          closeCustomSelectMenu(trigger, menu);
          if (select.id === "insuranceHolderIsPatient") updatePolicyHolderUi();
          scheduleSaveDraft();
        });
        menu.appendChild(item);
      });

      trigger.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (menu.hidden) openCustomSelectMenu(trigger, menu);
        else closeCustomSelectMenu(trigger, menu);
      });

      select.addEventListener("change", function () {
        syncCustomSelect(select);
        if (select.id === "insuranceHolderIsPatient") updatePolicyHolderUi();
      });

      wrap.appendChild(trigger);
      wrap.appendChild(menu);
      syncCustomSelect(select);
    });

    document.addEventListener("mousedown", function (e) {
      var inSelect = clickPathContains(e, "custom-select") || clickPathContains(e, "custom-select-menu");
      var inDate = clickPathContains(e, "date-entry") || clickPathContains(e, "date-dropdown");
      if (!inSelect) closeAllCustomSelectMenus();
      if (!inDate) closeAllDateDropdowns();
    });
    // Wheel over an open dropdown scrolls the menu only — never the page (which would close it).
    document.addEventListener("wheel", function (e) {
      var menu = null;
      var t = e.target;
      if (t && t.closest) {
        menu = t.closest(".custom-select-menu");
        if (!menu || menu.hidden) {
          var wrap = t.closest(".custom-select");
          menu = wrap ? wrap.querySelector(".custom-select-menu:not([hidden])") : null;
        }
      }
      if (!menu || menu.hidden) {
        try {
          var under = document.elementFromPoint(e.clientX, e.clientY);
          if (under && under.closest) menu = under.closest(".custom-select-menu");
        } catch (err) {}
      }
      if (!menu || menu.hidden) return;
      e.preventDefault();
      e.stopPropagation();
      menu.scrollTop += e.deltaY;
    }, { passive: false, capture: true });
    // Capture scroll so page scroll closes menus — but ignore scrolling inside the open menu itself.
    window.addEventListener("scroll", function (e) {
      var t = e.target;
      if (t && t.nodeType === 1 && t.closest && t.closest(".custom-select-menu")) return;
      closeAllCustomSelectMenus();
    }, true);
    window.addEventListener("resize", function () { closeAllCustomSelectMenus(); });
  }

  function setupFormMode() {
    if (isOsteopathy) {
      $("formTitle").textContent = "Osteopathy Patient Intake Form";
      document.title = "Osteopathy Intake | Posture Clinic";
    } else {
      $("formTitle").textContent = "Chiropractic Patient Intake Form";
      document.title = "Chiropractic Intake | Posture Clinic";
    }
    if ($("panelIntro")) $("panelIntro").textContent = "Please complete your information before your visit.";
    if ($("clinicalOnly")) $("clinicalOnly").hidden = false;
    resetIfPageReloaded();
    renderPainRegions();
    setupCustomSelects();
    setupPolicyHolderRadios();
    restoreDraft();
    setupDateFields();
    setupClinicPhone();
    document.querySelectorAll("#patientIntakeForm select").forEach(syncCustomSelect);
    updatePolicyHolderUi();
    setupConsentGate();
    scrollToConsentsIfNeeded();
  }

  function renderPainRegions() {
    var wrap = $("painRegions");
    if (!wrap) return;
    wrap.innerHTML = BODY_REGIONS.map(function (region) {
      return '<label class="pain-item" data-region="' + region + '">' +
        '<input type="checkbox" />' +
        "<span>" + region + "</span>" +
        "</label>";
    }).join("") +
      '<label class="pain-item pain-item-other" data-region="Other">' +
        "<span>Other</span>" +
        '<input type="text" id="painOther" name="intake_painOther" maxlength="120" placeholder="Describe other area…" autocomplete="off" />' +
      "</label>";
    wrap.addEventListener("change", function (e) {
      var item = e.target.closest(".pain-item");
      if (!item || e.target.type !== "checkbox") return;
      var region = item.getAttribute("data-region");
      if (e.target.checked) pain[region] = { intensity: 5, type: "" };
      else delete pain[region];
      item.classList.toggle("on", e.target.checked);
      scheduleSaveDraft();
    });
    var otherInput = $("painOther");
    if (otherInput) {
      otherInput.addEventListener("input", function () {
        var note = String(otherInput.value || "").trim();
        var item = otherInput.closest(".pain-item");
        if (note) pain.Other = { intensity: 5, type: "", note: note };
        else delete pain.Other;
        if (item) item.classList.toggle("on", !!note);
        scheduleSaveDraft();
      });
    }
  }

  function collectData() {
    var primaryRec = consentRecord(primaryDoc);
    var holderIsPatient = val("insuranceHolderIsPatient") !== "no";
    var accepted = !!( $("primaryConsent") && $("primaryConsent").checked );
    var statement = "I have read the Consent to Treatment (Chiropractic, Osteopathy, and Acupuncture) and I consent to evaluation and treatment, and confirm the information above is accurate.";
    return {
      id: newId(),
      first: val("first"),
      last: val("last"),
      dob: dateValue("dob"),
      sex: val("sex"),
      phone: val("phone"),
      email: val("email"),
      occupation: val("occupation"),
      address: val("address"),
      insurance: val("insurance"),
      policy: val("policy"),
      group: val("group"),
      insuranceHolderIsPatient: holderIsPatient,
      insuranceHolderName: holderIsPatient ? "" : val("insuranceHolderName"),
      insuranceHolderDob: holderIsPatient ? "" : dateValue("insuranceHolderDob"),
      insuranceHolderRel: holderIsPatient ? "" : val("insuranceHolderRel"),
      chiefComplaint: "",
      medicalHistory: val("medicalHistory"),
      medications: val("medications"),
      familyHistory: val("familyHistory"),
      pain: JSON.parse(JSON.stringify(pain)),
      consent: accepted,
      consentAcceptedOnPage: isConsentAccepted(primaryDoc),
      consentAcceptedAt: primaryRec && primaryRec.acceptedAt ? primaryRec.acceptedAt : "",
      consentDevice: primaryRec && primaryRec.device ? primaryRec.device : "",
      consentUserAgent: primaryRec && primaryRec.userAgent ? primaryRec.userAgent : "",
      consentStatement: statement,
      consentDocument: primaryConsentFile,
      acupunctureConsent: accepted,
      acupunctureConsentAcceptedOnPage: isConsentAccepted(primaryDoc),
      acupunctureConsentAcceptedAt: primaryRec && primaryRec.acceptedAt ? primaryRec.acceptedAt : "",
      acupunctureConsentDevice: primaryRec && primaryRec.device ? primaryRec.device : "",
      acupunctureConsentStatement: statement,
      acupunctureConsentDocument: primaryConsentFile,
      osteopathyConsent: accepted,
      profileType: profileType,
      source: "patient-intake-form"
    };
  }

  function clearDraftAndConsent() {
    try {
      sessionStorage.removeItem(DRAFT_KEY);
      sessionStorage.removeItem(consentStorageKey(primaryDoc));
      sessionStorage.removeItem(consentStorageKey("treatment"));
      sessionStorage.removeItem(consentStorageKey("acupuncture"));
      sessionStorage.removeItem(legacyConsentKey());
    } catch (e) {}
  }

  function isPageReload() {
    try {
      var nav = performance.getEntriesByType && performance.getEntriesByType("navigation")[0];
      if (nav && nav.type) return nav.type === "reload";
    } catch (e) {}
    try {
      return !!(performance.navigation && performance.navigation.type === 1);
    } catch (e2) {}
    return false;
  }

  /** Refresh clears saved answers + consent. Leaving for the consent page and coming back still keeps the draft. */
  function resetIfPageReloaded() {
    if (!isPageReload()) return false;
    clearDraftAndConsent();
    pain = {};
    try {
      history.replaceState(null, "", formScope);
    } catch (e) {}
    params = new URLSearchParams(location.search);
    var form = $("patientIntakeForm");
    if (form) form.reset();
    var box = $("primaryConsent");
    if (box) box.checked = false;
    return true;
  }

  function friendlySubmitError(err) {
    var msg = (err && err.message) ? String(err.message) : String(err || "");
    if (/failed to fetch|networkerror|load failed|network request failed/i.test(msg)) {
      return "Could not reach the clinic server (network error). Check your internet connection and try again. If it keeps failing, the clinic may need to redeploy the form or check Supabase.";
    }
    return msg || "Could not submit your form. Please try again.";
  }

  async function handleSubmit(e) {
    e.preventDefault();
    hideStatus();
    if (val("company")) return;

    if (!val("first") && !val("last")) {
      showStatus("Please enter your first or last name.", "error");
      return;
    }
    if (!val("phone")) {
      showStatus("Please enter your phone number.", "error");
      return;
    }
    if (!isConsentAccepted(primaryDoc)) {
      warnConsentRequired();
      return;
    }
    if (!$("primaryConsent") || !$("primaryConsent").checked) {
      warnConsentRequired();
      return;
    }
    if (!window.PostureClinicSync || !PostureClinicSync.isOnline()) {
      showStatus("This form is not connected to the clinic yet. Please contact the clinic.", "error");
      return;
    }

    var btn = $("submitBtn");
    btn.disabled = true;
    btn.textContent = "Submitting…";
    try {
      await PostureClinicSync.submitIntakeApplication(collectData());
      clearDraftAndConsent();
      $("formWrap").hidden = true;
      $("successWrap").hidden = false;
      window.scrollTo(0, 0);
    } catch (err) {
      showStatus(friendlySubmitError(err), "error");
      btn.disabled = false;
      btn.textContent = "Submit";
    }
  }

  setupFormMode();
  $("patientIntakeForm").addEventListener("submit", handleSubmit);
  $("patientIntakeForm").addEventListener("input", scheduleSaveDraft);
  $("patientIntakeForm").addEventListener("change", scheduleSaveDraft);

  /* Auto-hide scrollbars: visible while scrolling, hidden shortly after */
  (function setupAutoHideScrollbars() {
    var timers = typeof WeakMap !== "undefined" ? new WeakMap() : null;
    document.addEventListener("scroll", function (e) {
      var el = e.target;
      if (el === document || el === document.documentElement || el === document.body) {
        el = document.documentElement;
      } else if (!(el && el.nodeType === 1)) {
        return;
      }
      el.classList.add("show-scrollbar");
      if (timers) {
        var prev = timers.get(el);
        if (prev) clearTimeout(prev);
        timers.set(el, setTimeout(function () {
          el.classList.remove("show-scrollbar");
        }, 900));
      }
    }, true);
  })();
})();
