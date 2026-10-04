(function () {
  var cfg = window.POSTURE_PORTAL_API || {};
  var SAVE_DEBOUNCE_MS = 500;
  var saveTimer = null;
  var pendingDb = null;
  var client = null;
  var publicClient = null;
  var initPromise = null;
  var syncStatus = "idle";
  var lastError = "";
  var statusListeners = [];

  function isOnline() {
    return !!cfg.onlineMode && !!cfg.supabaseUrl && !!cfg.supabaseAnonKey;
  }

  function needsConfig() {
    return !!cfg.onlineMode && (!cfg.supabaseUrl || !cfg.supabaseAnonKey);
  }

  function onStatusChange(fn) {
    statusListeners.push(fn);
    fn(syncStatus, lastError);
  }

  function setStatus(status, err) {
    syncStatus = status;
    if (err !== undefined) lastError = err || "";
    statusListeners.forEach(function (fn) { fn(syncStatus, lastError); });
    if (typeof window.updateStorageBadge === "function") window.updateStorageBadge();
  }

  async function loadSupabaseScript() {
    if (window.supabase && window.supabase.createClient) return;
    var urls = [
      "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/dist/umd/supabase.min.js",
      "https://unpkg.com/@supabase/supabase-js@2.57.4/dist/umd/supabase.min.js"
    ];
    var lastErr = null;
    for (var i = 0; i < urls.length; i++) {
      try {
        await new Promise(function (resolve, reject) {
          var existing = document.querySelector('script[data-posture-supabase-js="' + i + '"]');
          if (existing) {
            if (window.supabase && window.supabase.createClient) return resolve();
            existing.addEventListener("load", resolve, { once: true });
            existing.addEventListener("error", reject, { once: true });
            return;
          }
          var script = document.createElement("script");
          script.src = urls[i];
          script.dataset.postureSupabaseJs = String(i);
          script.addEventListener("load", resolve, { once: true });
          script.addEventListener("error", reject, { once: true });
          document.head.appendChild(script);
        });
        if (window.supabase && window.supabase.createClient) return;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("Could not load clinic connection library.");
  }

  async function getAccessToken() {
    if (!window.PosturePortalAuth || !window.PosturePortalAuth.getSupabaseToken) {
      throw new Error("Auth module not loaded.");
    }
    try {
      var token = await window.PosturePortalAuth.getSupabaseToken();
      if (!token) {
        throw new Error(
          'Could not get sign-in token for cloud sync. Activate Clerk’s Supabase integration (Clerk Dashboard → Setup → Supabase), add Clerk under Supabase Authentication → Sign In / Providers, then sign out and sign in again.'
        );
      }
      return token;
    } catch (e) {
      throw e;
    }
  }

  async function init() {
    if (!isOnline()) return null;
    if (client) return client;
    if (initPromise) return initPromise;
    initPromise = (async function () {
      await loadSupabaseScript();
      client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
        accessToken: getAccessToken
      });
      return client;
    })();
    return initPromise;
  }

  function isEmptySnapshot(data) {
    if (!data || typeof data !== "object") return true;
    if (Object.keys(data).length === 0) return true;
    return !Array.isArray(data.patients) && !data.clinic;
  }

  function patientNameKey(p) {
    return String(((p && p.first) || "") + " " + ((p && p.last) || "")).trim().toLowerCase();
  }

  function mergeById(local, cloud) {
    var out = Array.isArray(local) ? local.slice() : [];
    var ids = {};
    out.forEach(function (row) {
      if (row && row.id) ids[String(row.id)] = true;
    });
    (cloud || []).forEach(function (row) {
      if (!row || !row.id || ids[String(row.id)]) return;
      out.push(row);
      ids[String(row.id)] = true;
    });
    return out;
  }

  function uniqIds(a, b) {
    var seen = {};
    var out = [];
    function add(list) {
      (list || []).forEach(function (id) {
        if (!id) return;
        var k = String(id);
        if (seen[k]) return;
        seen[k] = true;
        out.push(k);
      });
    }
    add(a);
    add(b);
    return out;
  }

  function skipIdsFromDb(a, b) {
    var skip = {};
    uniqIds(
      [].concat((a && a.deletedPatientIds) || [], (a && a.deletedSubmissionIds) || []),
      [].concat((b && b.deletedPatientIds) || [], (b && b.deletedSubmissionIds) || [])
    ).forEach(function (id) { skip[id] = true; });
    return skip;
  }

  function mergePatientLists(local, cloud, skip) {
    skip = skip || {};
    var out = [];
    var ids = {};
    var names = {};
    function push(p) {
      if (!p) return;
      if (p.id && skip[String(p.id)]) return;
      if (p.sourceSubmissionId && skip[String(p.sourceSubmissionId)]) return;
      if (p.id && ids[String(p.id)]) return;
      var name = patientNameKey(p);
      if (name && names[name]) return;
      out.push(p);
      if (p.id) ids[String(p.id)] = true;
      if (name) names[name] = true;
    }
    (local || []).forEach(push);
    (cloud || []).forEach(push);
    return out;
  }

  function mergeClinicDatabases(local, cloud) {
    var a = local && typeof local === "object" ? local : {};
    var b = cloud && typeof cloud === "object" ? cloud : {};
    var skip = skipIdsFromDb(a, b);
    var out = Object.assign({}, b, a);
    out.deletedPatientIds = uniqIds(a.deletedPatientIds, b.deletedPatientIds);
    out.deletedSubmissionIds = uniqIds(a.deletedSubmissionIds, b.deletedSubmissionIds);
    out.patients = mergePatientLists(a.patients, b.patients, skip);
    out.visits = mergeById(a.visits, b.visits);
    out.invoices = mergeById(a.invoices, b.invoices);
    out.appointments = mergeById(a.appointments, b.appointments);
    out.histories = mergeById(a.histories, b.histories);
    out.exams = mergeById(a.exams, b.exams);
    out.clinic = Object.assign({}, b.clinic || {}, a.clinic || {});
    return out;
  }

  async function loadSnapshot() {
    if (!isOnline()) return null;
    setStatus("loading");
    try {
      await init();
      var snapshotId = cfg.snapshotId || "main";
      var res = await client
        .from("clinic_snapshot")
        .select("data, updated_at")
        .eq("id", snapshotId)
        .maybeSingle();
      if (res.error) throw new Error(res.error.message);
      if (!res.data || isEmptySnapshot(res.data.data)) {
        setStatus("synced");
        return null;
      }
      setStatus("synced");
      return res.data.data;
    } catch (e) {
      setStatus("error", e.message || String(e));
      throw e;
    }
  }

  async function fetchSnapshot() {
    if (!isOnline()) return null;
    await init();
    var snapshotId = cfg.snapshotId || "main";
    var res = await client
      .from("clinic_snapshot")
      .select("data, updated_at")
      .eq("id", snapshotId)
      .maybeSingle();
    if (res.error) throw new Error(res.error.message);
    if (!res.data || isEmptySnapshot(res.data.data)) return null;
    return res.data.data;
  }

  async function writeSnapshotRow(snapshotId, db) {
    var payload = {
      data: db,
      updated_at: new Date().toISOString()
    };
    try {
      var rpc = await client.rpc("save_clinic_snapshot", {
        snapshot_id: snapshotId,
        snapshot: db
      });
      if (!rpc.error) return;
    } catch (e) {}
    var updated = await client
      .from("clinic_snapshot")
      .update(payload)
      .eq("id", snapshotId)
      .select("id");
    if (!updated.error && updated.data && updated.data.length) return;
    var inserted = await client.from("clinic_snapshot").insert({
      id: snapshotId,
      data: db,
      updated_at: payload.updated_at
    });
    if (!inserted.error) return;
    throw new Error(
      (inserted.error && inserted.error.message) ||
      (updated.error && updated.error.message) ||
      "Could not save clinic data. In Supabase SQL editor run the clinic_snapshot policies in supabase/schema.sql."
    );
  }

  async function flushSave(opts) {
    opts = opts || {};
    if (!pendingDb || !isOnline()) return;
    var db = pendingDb;
    setStatus("syncing");
    try {
      await init();
      var snapshotId = cfg.snapshotId || "main";
      if (!opts.replace) {
        var latest = await client
          .from("clinic_snapshot")
          .select("data")
          .eq("id", snapshotId)
          .maybeSingle();
        var cloudDb = !latest.error && latest.data ? latest.data.data : null;
        if (cloudDb && typeof cloudDb === "object") {
          db = mergeClinicDatabases(db, cloudDb);
          pendingDb = db;
          emitRemoteDb(db);
        }
      }
      await writeSnapshotRow(snapshotId, db);
      setStatus("synced");
    } catch (e) {
      setStatus("error", e.message || String(e));
      throw e;
    }
  }

  async function saveSnapshot(db, immediate, opts) {
    if (!isOnline()) return;
    pendingDb = db;
    if (immediate) {
      clearTimeout(saveTimer);
      return flushSave(opts);
    }
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { flushSave(opts); }, SAVE_DEBOUNCE_MS);
  }

  function scheduleSave(db) {
    return saveSnapshot(db, false);
  }

  async function saveClinicBackup(payload) {
    payload = payload || {};
    await init();
    var stamp = payload.stamp || "";
    var kind = payload.kind || "database";
    var data = payload.data || {};
    var rpc = await client.rpc("save_clinic_backup", {
      backup_stamp: stamp,
      backup_kind: kind,
      backup_data: data
    });
    if (rpc.error) {
      throw new Error(rpc.error.message || "Could not save clinic backup. Run supabase/portal-backups.sql in the SQL editor.");
    }
    return rpc.data;
  }

  async function initPublic() {
    if (!isOnline()) throw new Error("Cloud storage is not configured.");
    await loadSupabaseScript();
    if (!publicClient) {
      publicClient = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    }
    return publicClient;
  }

  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function networkFail(e) {
    var msg = e && e.message ? e.message : String(e || "");
    if (/failed to fetch|networkerror|load failed/i.test(msg)) {
      return new Error("Failed to fetch — the browser could not reach Supabase. Check internet, confirm the project is not paused, and that the anon key in api-config.js is current.");
    }
    return e instanceof Error ? e : new Error(msg);
  }

  async function submitIntakeApplication(data) {
    try {
      await initPublic();
    } catch (e) {
      throw new Error("Failed to connect to the clinic database. " + (e && e.message ? e.message : "Failed to fetch"));
    }
    var id = (data && data.id) ? data.id : newId();
    var payload = Object.assign({}, data, { id: id });
    try {
      var rpc = await publicClient.rpc("submit_patient_intake", { patient: payload });
      if (!rpc.error) return rpc.data || id;
    } catch (e) {}
    var res;
    try {
      res = await publicClient.from("intake_submissions").insert({
        id: id,
        status: "pending",
        data: payload
      });
    } catch (e) {
      throw networkFail(e);
    }
    if (res.error) throw new Error(res.error.message);
    return id;
  }

  async function listIntakeSubmissions(status) {
    await init();
    try {
      var rpc = await client.rpc("list_intake_submissions");
      if (!rpc.error && Array.isArray(rpc.data)) {
        var rows = rpc.data;
        if (status) {
          var want = String(status).toLowerCase();
          rows = rows.filter(function (r) {
            return String((r && r.status) || "").toLowerCase() === want;
          });
        }
        rows.sort(function (a, b) {
          return String((b && (b.submitted_at || b.created_at)) || "").localeCompare(
            String((a && (a.submitted_at || a.created_at)) || "")
          );
        });
        return rows;
      }
    } catch (e) {}
    function base() {
      var query = client.from("intake_submissions").select("*");
      if (status) query = query.eq("status", status);
      return query;
    }
    var res = await base().order("submitted_at", { ascending: false });
    if (res.error && /submitted_at/i.test(res.error.message || "")) {
      res = await base().order("created_at", { ascending: false });
    }
    if (res.error && /created_at|submitted_at|order/i.test(res.error.message || "")) {
      res = await base();
    }
    if (res.error) throw new Error(res.error.message);
    return res.data || [];
  }

  async function updateIntakeSubmission(id, patch) {
    await init();
    var res = await client.from("intake_submissions").update(patch).eq("id", id);
    if (res.error) throw new Error(res.error.message);
  }

  var intakeChannel = null;
  var intakeListeners = [];
  var snapshotListeners = [];
  var remoteDbListeners = [];

  function onRemoteDb(fn) {
    if (typeof fn === "function") remoteDbListeners.push(fn);
  }

  function emitRemoteDb(db) {
    remoteDbListeners.forEach(function (fn) {
      try { fn(db); } catch (e) { console.warn("Remote DB listener failed", e); }
    });
  }

  function onIntakeSubmission(fn) {
    if (typeof fn === "function") intakeListeners.push(fn);
  }

  function onSnapshotChange(fn) {
    if (typeof fn === "function") snapshotListeners.push(fn);
  }

  async function subscribeIntakeSubmissions() {
    if (!isOnline()) return null;
    await init();
    if (intakeChannel) return intakeChannel;
    intakeChannel = client.channel("clinic-live-sync");
    intakeChannel.on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "intake_submissions"
    }, function (payload) {
      intakeListeners.forEach(function (fn) {
        try { fn(payload && payload.new ? payload.new : payload); }
        catch (e) { console.warn("Intake listener failed", e); }
      });
    });
    intakeChannel.on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "clinic_snapshot"
    }, function (payload) {
      var data = payload && payload.new && payload.new.data;
      snapshotListeners.forEach(function (fn) {
        try { fn(data || null); }
        catch (e) { console.warn("Snapshot listener failed", e); }
      });
    });
    intakeChannel.subscribe();
    return intakeChannel;
  }

  window.PostureClinicSync = {
    isOnline: isOnline,
    needsConfig: needsConfig,
    init: init,
    initPublic: initPublic,
    loadSnapshot: loadSnapshot,
    fetchSnapshot: fetchSnapshot,
    mergePatientLists: mergePatientLists,
    mergeClinicDatabases: mergeClinicDatabases,
    saveSnapshot: saveSnapshot,
    scheduleSave: scheduleSave,
    flushSave: flushSave,
    saveClinicBackup: saveClinicBackup,
    onRemoteDb: onRemoteDb,
    submitIntakeApplication: submitIntakeApplication,
    listIntakeSubmissions: listIntakeSubmissions,
    updateIntakeSubmission: updateIntakeSubmission,
    onIntakeSubmission: onIntakeSubmission,
    onSnapshotChange: onSnapshotChange,
    subscribeIntakeSubmissions: subscribeIntakeSubmissions,
    onStatusChange: onStatusChange,
    getStatus: function () { return { status: syncStatus, error: lastError }; }
  };
})();
