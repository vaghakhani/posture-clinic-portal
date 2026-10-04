(function () {
  var PAGE_W = 612;
  var PAGE_H = 792;
  var M = 48;
  var CONTENT_W = PAGE_W - M * 2;
  var BRAND = [30, 64, 175];
  var MUTED = [100, 116, 139];
  var LINE = [226, 232, 240];

  function patientName(p) {
    if (!p) return "Unknown";
    return ((p.first || "") + " " + (p.last || "")).trim() || "Unknown";
  }

  function safeFilePart(s) {
    return String(s || "document").replace(/[^\w\-]+/g, "_").replace(/_+/g, "_").slice(0, 48);
  }

  function loadJsPdf() {
    if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector("script[data-posture-jspdf]");
      if (existing) {
        existing.addEventListener("load", function () { resolve(window.jspdf.jsPDF); }, { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }
      var script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js";
      script.dataset.postureJspdf = "true";
      script.onload = function () { resolve(window.jspdf.jsPDF); };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function fitImageBox(naturalW, naturalH, maxW, maxH) {
    if (!naturalW || !naturalH) return { w: maxW, h: maxH };
    var scale = Math.min(maxW / naturalW, maxH / naturalH);
    return { w: naturalW * scale, h: naturalH * scale };
  }

  function imageFormat(dataUrl) {
    if (!dataUrl) return "PNG";
    if (String(dataUrl).indexOf("image/jpeg") >= 0 || String(dataUrl).indexOf("image/jpg") >= 0) return "JPEG";
    return "PNG";
  }

  function measureImage(dataUrl) {
    return new Promise(function (resolve) {
      if (!dataUrl) {
        resolve(null);
        return;
      }
      var img = new Image();
      img.onload = function () {
        resolve({
          dataUrl: dataUrl,
          width: img.naturalWidth || img.width || 0,
          height: img.naturalHeight || img.height || 0
        });
      };
      img.onerror = function () {
        resolve({ dataUrl: dataUrl, width: 0, height: 0 });
      };
      img.src = dataUrl;
    });
  }

  function loadImageDataUrl(url) {
    if (!url) return Promise.resolve(null);
    if (String(url).indexOf("data:") === 0) return Promise.resolve(url);
    return fetch(url)
      .then(function (response) {
        if (!response.ok) throw new Error("image fetch failed");
        return response.blob();
      })
      .then(function (blob) {
        return new Promise(function (resolve) {
          var reader = new FileReader();
          reader.onload = function () { resolve(reader.result); };
          reader.onerror = function () { resolve(null); };
          reader.readAsDataURL(blob);
        });
      })
      .catch(function () {
        return new Promise(function (resolve) {
          var img = new Image();
          img.onload = function () {
            try {
              var canvas = document.createElement("canvas");
              canvas.width = img.naturalWidth || img.width;
              canvas.height = img.naturalHeight || img.height;
              canvas.getContext("2d").drawImage(img, 0, 0);
              resolve(canvas.toDataURL("image/png"));
            } catch (e) {
              resolve(null);
            }
          };
          img.onerror = function () { resolve(null); };
          img.src = url;
        });
      });
  }

  function loadImageAsset(url) {
    return loadImageDataUrl(url).then(measureImage);
  }

  function painAreasText(pain) {
    var keys = Object.keys(pain || {});
    if (!keys.length) return "No areas marked.";
    return keys.map(function (k) {
      var item = pain[k] || {};
      var line = k + " — " + (item.intensity != null ? item.intensity : "?") + "/10";
      if (item.type) line += ", " + item.type;
      return line;
    }).join("\n");
  }

  function ensureSpace(doc, y, needed, state) {
    if (y + needed <= PAGE_H - M) return y;
    doc.addPage();
    state.page += 1;
    return M;
  }

  function drawLine(doc, y) {
    doc.setDrawColor.apply(doc, LINE);
    doc.setLineWidth(0.75);
    doc.line(M, y, PAGE_W - M, y);
    return y + 14;
  }

  function drawMetaRow(doc, label, value, x, y, width) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor.apply(doc, MUTED);
    doc.text(String(label).toUpperCase(), x, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    var lines = doc.splitTextToSize(String(value || "—"), width);
    doc.text(lines, x, y + 11);
    return y + 11 + lines.length * 12 + 6;
  }

  function drawSection(doc, title, body, y, state) {
    var text = String(body || "").trim() || "—";
    var lines = doc.splitTextToSize(text, CONTENT_W - 16);
    var boxH = Math.max(28, lines.length * 12 + 16);
    y = ensureSpace(doc, y, boxH + 28, state);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor.apply(doc, BRAND);
    doc.text(title, M, y);
    y += 14;

    doc.setDrawColor.apply(doc, LINE);
    doc.setFillColor(251, 253, 255);
    doc.roundedRect(M, y, CONTENT_W, boxH, 4, 4, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(lines, M + 8, y + 14);
    return y + boxH + 18;
  }

  function composeBodyChartImage(chartAsset, pain, hotspots) {
    pain = pain || {};
    hotspots = hotspots || [];
    if (!chartAsset || !chartAsset.dataUrl) return Promise.resolve(chartAsset);

    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        var w = chartAsset.width || img.naturalWidth || img.width;
        var h = chartAsset.height || img.naturalHeight || img.height;
        var canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);

        hotspots.forEach(function (spot) {
          if (!pain[spot.label]) return;
          var cx = (spot.x / 100) * w;
          var cy = (spot.y / 100) * h;
          var rx = ((spot.w || 8) / 100) * w / 2;
          var ry = ((spot.h || 8) / 100) * h / 2;
          ctx.save();
          ctx.beginPath();
          ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(239, 68, 68, 0.5)";
          ctx.fill();
          ctx.lineWidth = Math.max(2, w * 0.004);
          ctx.strokeStyle = "#b91c1c";
          ctx.stroke();
          ctx.restore();
        });

        resolve({
          dataUrl: canvas.toDataURL("image/png"),
          width: w,
          height: h
        });
      };
      img.onerror = function () { resolve(chartAsset); };
      img.src = chartAsset.dataUrl;
    });
  }

  async function buildSoapDoc(opts) {
    var jsPDF = await loadJsPdf();
    var visit = opts.visit || {};
    var patient = opts.patient || {};
    var clinic = opts.clinic || {};
    var logoUrl = opts.logoUrl || "";
    var bodyChartUrl = opts.bodyChartUrl || "";
    var servicesText = opts.servicesText || "";
    var logoAsset = await loadImageAsset(logoUrl);
    var chartAsset = await loadImageAsset(bodyChartUrl);
    if (chartAsset) {
      chartAsset = await composeBodyChartImage(chartAsset, visit.pain, opts.bodyChartHotspots || []);
    }
    var sigAsset = await loadImageAsset(clinic.signature || "");

    var doc = new jsPDF({ unit: "pt", format: "letter", compress: true });
    var state = { page: 1 };
    var y = M;
    var contact = [clinic.address, clinic.phone, clinic.email].filter(Boolean).join(" | ");
    var printed = new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    var logoSize = logoAsset ? fitImageBox(logoAsset.width, logoAsset.height, 56, 56) : null;

    if (logoAsset && logoAsset.dataUrl) {
      doc.addImage(logoAsset.dataUrl, imageFormat(logoAsset.dataUrl), M, y, logoSize.w, logoSize.h);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor.apply(doc, BRAND);
    doc.text(String(clinic.name || "Posture Clinic"), M + (logoAsset ? 68 : 0), y + 18);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    doc.text(resolveProviderName(opts, clinic), M + (logoAsset ? 68 : 0), y + 34);
    if (contact) {
      var contactLines = doc.splitTextToSize(contact, 250);
      doc.setFontSize(9);
      doc.setTextColor.apply(doc, MUTED);
      doc.text(contactLines, M + (logoAsset ? 68 : 0), y + 48);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(17, 24, 39);
    doc.text("SOAP NOTE", PAGE_W - M, y + 12, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor.apply(doc, MUTED);
    doc.text("Printed: " + printed, PAGE_W - M, y + 28, { align: "right" });
    doc.text("Visit date: " + String(visit.date || "—"), PAGE_W - M, y + 40, { align: "right" });
    doc.text("Patient: " + patientName(patient), PAGE_W - M, y + 52, { align: "right" });

    y = Math.max(y + (logoAsset ? 72 : 56), y + 64);
    y = drawLine(doc, y);

    var colW = (CONTENT_W - 12) / 2;
    var leftY = drawMetaRow(doc, "Patient", patientName(patient), M, y, colW);
    var rightY = drawMetaRow(doc, "Date of birth", patient.dob || "—", M + colW + 12, y, colW);
    y = Math.max(leftY, rightY);
    leftY = drawMetaRow(doc, "Phone", patient.phone || "—", M, y, colW);
    rightY = drawMetaRow(doc, "Email", patient.email || "—", M + colW + 12, y, colW);
    y = Math.max(leftY, rightY);
    y = drawMetaRow(doc, "Address", patient.address || "—", M, y, CONTENT_W) + 2;
    y = drawLine(doc, y);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor.apply(doc, BRAND);
    doc.text("Pain diagram", M, y);
    y += 14;

    if (chartAsset && chartAsset.dataUrl) {
      var chartMaxH = 220;
      var chartSize = fitImageBox(chartAsset.width, chartAsset.height, CONTENT_W, chartMaxH);
      y = ensureSpace(doc, y, chartSize.h + 12, state);
      var chartX = M + (CONTENT_W - chartSize.w) / 2;
      doc.addImage(chartAsset.dataUrl, imageFormat(chartAsset.dataUrl), chartX, y, chartSize.w, chartSize.h, undefined, "FAST");
      y += chartSize.h + 12;
    }

    y = drawSection(doc, "Areas of pain", painAreasText(visit.pain), y, state);
    var subjectiveBody = String(visit.subjective || "").trim();
    var trendLines = [
      visit.subjectivePain ? ("Pain: " + visit.subjectivePain) : "",
      visit.subjectiveRom ? ("ROM: " + visit.subjectiveRom) : "",
      visit.subjectiveStiffness ? ("Stiffness and Tightness: " + visit.subjectiveStiffness) : ""
    ].filter(Boolean);
    if (trendLines.length) {
      subjectiveBody = (subjectiveBody ? subjectiveBody + "\n\n" : "") + trendLines.join("\n");
    }
    y = drawSection(doc, "S — Subjective", subjectiveBody, y, state);
    y = drawSection(doc, "O — Objective", visit.objective, y, state);
    y = drawSection(doc, "A — Assessment", visit.assessment, y, state);
    y = drawSection(doc, "Services provided", servicesText, y, state);
    y = drawSection(doc, "P — Plan", visit.plan, y, state);

    y = ensureSpace(doc, y, 90, state);
    if (sigAsset && sigAsset.dataUrl) {
      var sigSize = fitImageBox(sigAsset.width, sigAsset.height, 180, 48);
      var sigX = PAGE_W - M - sigSize.w;
      doc.addImage(sigAsset.dataUrl, imageFormat(sigAsset.dataUrl), sigX, y, sigSize.w, sigSize.h, undefined, "FAST");
      y += Math.max(sigSize.h + 4, 52);
    } else {
      y += 24;
      doc.setDrawColor(17, 24, 39);
      doc.line(PAGE_W - M - 180, y, PAGE_W - M, y);
      y += 8;
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    doc.text("Provider signature — " + resolveProviderName(opts, clinic), PAGE_W - M, y + 8, { align: "right" });

    var footerY = PAGE_H - 28;
    doc.setFontSize(8);
    doc.setTextColor.apply(doc, MUTED);
    doc.text(String(clinic.name || "Posture Clinic") + " · Formal SOAP note · Page " + state.page, PAGE_W / 2, footerY, { align: "center" });

    var filename = "SOAP_" + safeFilePart(patientName(patient)) + "_" + safeFilePart(visit.date || "note") + ".pdf";
    return { doc: doc, filename: filename };
  }

  function drawSectionTitle(doc, title, y, state) {
    y = ensureSpace(doc, y, 24, state);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor.apply(doc, BRAND);
    doc.text(String(title), M, y);
    return y + 16;
  }

  function drawParagraph(doc, text, y, state) {
    var lines = doc.splitTextToSize(String(text || "—"), CONTENT_W);
    y = ensureSpace(doc, y, lines.length * 12 + 8, state);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(lines, M, y);
    return y + lines.length * 12 + 10;
  }

  function drawLetterheadBlock(doc, opts) {
    var clinic = opts.clinic || {};
    var logoAsset = opts.logoAsset;
    var title = opts.title || "DOCUMENT";
    var rightLines = opts.rightLines || [];
    var y = M;
    var contact = [clinic.address, clinic.phone, clinic.email].filter(Boolean).join(" | ");
    var logoSize = logoAsset ? fitImageBox(logoAsset.width, logoAsset.height, 56, 56) : null;

    if (logoAsset && logoAsset.dataUrl) {
      doc.addImage(logoAsset.dataUrl, imageFormat(logoAsset.dataUrl), M, y, logoSize.w, logoSize.h);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor.apply(doc, BRAND);
    doc.text(String(clinic.name || "Posture Clinic"), M + (logoAsset ? 68 : 0), y + 18);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    doc.text(resolveProviderName(opts, clinic), M + (logoAsset ? 68 : 0), y + 34);
    if (contact) {
      var contactLines = doc.splitTextToSize(contact, 250);
      doc.setFontSize(9);
      doc.setTextColor.apply(doc, MUTED);
      doc.text(contactLines, M + (logoAsset ? 68 : 0), y + 48);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(17, 24, 39);
    doc.text(title, PAGE_W - M, y + 12, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor.apply(doc, MUTED);
    rightLines.forEach(function (line, idx) {
      doc.text(String(line), PAGE_W - M, y + 28 + idx * 12, { align: "right" });
    });

    y = Math.max(y + (logoAsset ? 72 : 56), y + 64);
    return drawLine(doc, y);
  }

  function drawChartFooter(doc, state, label) {
    var footerY = PAGE_H - 28;
    doc.setFontSize(8);
    doc.setTextColor.apply(doc, MUTED);
    doc.text(String(label || "Patient chart") + " · Page " + state.page, PAGE_W / 2, footerY, { align: "center" });
  }

  async function buildPatientChartDoc(opts) {
    var jsPDF = await loadJsPdf();
    var patient = opts.patient || {};
    var clinic = opts.clinic || {};
    var visits = opts.visits || [];
    var invoices = opts.invoices || [];
    var stats = opts.stats || {};
    var logoAsset = await loadImageAsset(opts.logoUrl || "");
    var chartAsset = await loadImageAsset(opts.bodyChartUrl || "");
    if (chartAsset) {
      chartAsset = await composeBodyChartImage(chartAsset, patient.pain, opts.bodyChartHotspots || []);
    }

    var doc = new jsPDF({ unit: "pt", format: "letter", compress: true });
    var state = { page: 1 };
    var printed = new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    var y = drawLetterheadBlock(doc, {
      clinic: clinic,
      logoAsset: logoAsset,
      providerName: opts.providerName,
      title: "PATIENT CHART",
      rightLines: [
        "Printed: " + printed,
        "Patient: " + patientName(patient),
        "DOB: " + String(patient.dob || "—")
      ]
    });

    var summary =
      "SOAP visits: " + String(stats.visitCount != null ? stats.visitCount : visits.length) +
      "   History notes: " + String(stats.historyCount != null ? stats.historyCount : (opts.histories || []).length) +
      "   Exams: " + String(stats.examCount != null ? stats.examCount : (opts.exams || []).length) +
      "   Services billed: " + String(stats.servicesBilled != null ? stats.servicesBilled : "0") +
      "   Total billed: " + String(stats.totalBilled || "—") +
      "   Total paid: " + String(stats.totalPaid || "—") +
      "   Outstanding: " + String(stats.outstanding || "—") + "\n" +
      "Last visit: " + String(stats.lastVisit || "—") +
      "   Next appointment: " + String(stats.nextAppt || "—") +
      "   Pain areas: " + String(stats.painAreas != null ? stats.painAreas : Object.keys(patient.pain || {}).length);
    y = drawSectionTitle(doc, "Summary", y, state);
    y = drawParagraph(doc, summary, y, state);

    var colW = (CONTENT_W - 12) / 2;
    y = drawSectionTitle(doc, "Patient Information", y, state);
    var leftY = drawMetaRow(doc, "Name", patientName(patient), M, y, colW);
    var rightY = drawMetaRow(doc, "Profile type", opts.profileType || "—", M + colW + 12, y, colW);
    y = Math.max(leftY, rightY);
    leftY = drawMetaRow(doc, "Date of birth", patient.dob || "—", M, y, colW);
    rightY = drawMetaRow(doc, "Sex", patient.sex || "—", M + colW + 12, y, colW);
    y = Math.max(leftY, rightY);
    leftY = drawMetaRow(doc, "Phone", patient.phone || "—", M, y, colW);
    rightY = drawMetaRow(doc, "Email", patient.email || "—", M + colW + 12, y, colW);
    y = Math.max(leftY, rightY);
    leftY = drawMetaRow(doc, "Occupation", patient.occupation || "—", M, y, colW);
    rightY = drawMetaRow(doc, "Address", patient.address || "—", M + colW + 12, y, colW);
    y = Math.max(leftY, rightY);
    var insurance = [patient.insurance, patient.policy, patient.group ? "Group " + patient.group : ""].filter(Boolean).join(" ");
    leftY = drawMetaRow(doc, "Insurance", insurance || "—", M, y, colW);
    var emergency = [patient.emergencyName, patient.emergencyRel ? "(" + patient.emergencyRel + ")" : "", patient.emergencyPhone].filter(Boolean).join(" ");
    rightY = drawMetaRow(doc, "Emergency contact", emergency || "—", M + colW + 12, y, colW);
    y = Math.max(leftY, rightY) + 4;

    var intakeText =
      "Complaint: " + String(patient.chiefComplaint || "—") + "\n" +
      "Pain since: " + String(patient.painOnset || "—") + "   Pain type: " + String(patient.painType || "—") +
      "   Pain level: " + String(patient.painLevel != null && patient.painLevel !== "" ? patient.painLevel + "/10" : "—") +
      "   Frequency: " + String(patient.painFreq || "—") + "\n" +
      "Medical history: " + String(patient.medicalHistory || "—") + "\n" +
      "Medications: " + String(patient.medications || "—") + "   Allergies: " + String(patient.allergies || "—") + "\n" +
      "Prior treatment: " + String(patient.priorTreatment || "—") + "\n" +
      "Smoker: " + String(patient.smoker || "—") + "   Exercise: " + String(patient.exercise || "—") +
      "   Pregnant: " + String(patient.pregnant || "—");
    y = drawSectionTitle(doc, "Intake Form Information", y, state);
    y = drawParagraph(doc, intakeText, y, state);

    y = drawSectionTitle(doc, "Consent Record", y, state);
    y = drawSection(doc, "Consent", opts.consentText || "Consent not on file.", y, state);

    if (Object.keys(patient.pain || {}).length) {
      y = drawSectionTitle(doc, "Pain Diagram", y, state);
      if (chartAsset && chartAsset.dataUrl) {
        var chartMaxH = 180;
        var chartSize = fitImageBox(chartAsset.width, chartAsset.height, CONTENT_W, chartMaxH);
        y = ensureSpace(doc, y, chartSize.h + 12, state);
        var chartX = M + (CONTENT_W - chartSize.w) / 2;
        doc.addImage(chartAsset.dataUrl, imageFormat(chartAsset.dataUrl), chartX, y, chartSize.w, chartSize.h, undefined, "FAST");
        y += chartSize.h + 12;
      }
      y = drawSection(doc, "Marked areas of pain", painAreasText(patient.pain), y, state);
    }

    y = drawSectionTitle(doc, "SOAP Notes (" + visits.length + ")", y, state);
    if (!visits.length) {
      y = drawParagraph(doc, "No SOAP notes yet.", y, state);
    } else {
      visits.forEach(function (visit) {
        var note =
          "Date: " + String(visit.date || "—") + "\n" +
          "S: " + String(visit.subjective || "—") +
          (visit.subjectivePain ? "\nPain: " + visit.subjectivePain : "") +
          (visit.subjectiveRom ? "\nROM: " + visit.subjectiveRom : "") +
          (visit.subjectiveStiffness ? "\nStiffness and Tightness: " + visit.subjectiveStiffness : "") + "\n" +
          "O: " + String(visit.objective || "—") + "\n" +
          "A: " + String(visit.assessment || "—") + "\n" +
          "Services: " + String(visit.services || "—") + "\n" +
          "P: " + String(visit.plan || "—");
        y = drawSection(doc, "Visit — " + String(visit.date || "Note"), note, y, state);
      });
    }

    var histories = opts.histories || [];
    y = drawSectionTitle(doc, "History Taking (" + histories.length + ")", y, state);
    if (!histories.length) {
      y = drawParagraph(doc, "No history notes yet.", y, state);
    } else {
      histories.forEach(function (hx) {
        var note =
          "Date: " + String(hx.date || "—") + "\n" +
          "Chief complaint: " + String(hx.chiefComplaint || "—") + "\n" +
          "HPI: " + String(hx.hpi || "—") + "\n" +
          "Onset: " + String(hx.onset || "—") + "\n" +
          "Past history: " + String(hx.pastHistory || "—") + "\n" +
          "Medications: " + String(hx.medications || "—") + "\n" +
          "Allergies: " + String(hx.allergies || "—") + "\n" +
          "Goals: " + String(hx.goals || "—");
        y = drawSection(doc, "History — " + String(hx.date || "Note"), note, y, state);
      });
    }

    var exams = opts.exams || [];
    y = drawSectionTitle(doc, "Physical Examination (" + exams.length + ")", y, state);
    if (!exams.length) {
      y = drawParagraph(doc, "No physical exams yet.", y, state);
    } else {
      exams.forEach(function (ex) {
        var note =
          "Date: " + String(ex.date || "—") + "\n" +
          "Observation: " + String(ex.observation || "—") + "\n" +
          "ROM: " + String(ex.rom || "—") + "\n" +
          "Orthopedic: " + String(ex.orthopedic || "—") + "\n" +
          "Neurological: " + String(ex.neurological || "—") + "\n" +
          "Impression: " + String(ex.impression || "—");
        y = drawSection(doc, "Exam — " + String(ex.date || "Note"), note, y, state);
      });
    }

    y = drawSectionTitle(doc, "Invoices (" + invoices.length + ")", y, state);
    if (!invoices.length) {
      y = drawParagraph(doc, "No invoices yet.", y, state);
    } else {
      var invoiceLines = invoices.map(function (inv) {
        return String(inv.number || "Invoice") + " — " + String(inv.date || "—") +
          " — Total " + String(inv.totalText || "—") +
          " · Paid " + String(inv.paidText || "—") +
          " · Outstanding " + String(inv.balanceText || "—") +
          " · " + String(inv.status || "—");
      }).join("\n");
      y = drawParagraph(doc, invoiceLines, y, state);
    }

    drawChartFooter(doc, state, String(clinic.name || "Posture Clinic") + " · Patient chart");

    var filename = "Chart_" + safeFilePart(patientName(patient)) + ".pdf";
    return { doc: doc, filename: filename };
  }

  function measureInfoBoxHeight(doc, lines, w) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    var h = 28;
    (lines || []).forEach(function (line) {
      var wrapped = doc.splitTextToSize(String(line || "—"), Math.max(40, w - 16));
      h += Math.max(1, wrapped.length) * 11 + 3;
    });
    return Math.max(h + 8, 72);
  }

  function drawInfoBox(doc, title, lines, x, y, w, h, opts) {
    opts = opts || {};
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.8);
    doc.roundedRect(x, y, w, h, 4, 4, "FD");
    doc.setFillColor(241, 245, 249);
    doc.rect(x, y, 4, h, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor.apply(doc, BRAND);
    doc.text(String(title).toUpperCase(), x + 14, y + 14);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(x + 12, y + 20, x + w - 10, y + 20);
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    var ty = y + 34;
    var maxY = y + h - 10;
    (lines || []).forEach(function (line, idx) {
      doc.setFont("helvetica", opts.boldFirst && idx === 0 ? "bold" : "normal");
      var wrapped = doc.splitTextToSize(String(line || "—"), Math.max(40, w - 28));
      wrapped.forEach(function (row) {
        if (ty > maxY) return;
        doc.text(row, x + 14, ty);
        ty += 11;
      });
      ty += 3;
    });
    return y + h + 10;
  }

  function resolveProviderName(opts, clinic) {
    return String((opts && opts.providerName) || (clinic && clinic.provider) || "Dr. Ardeshir Ekhtiari, DC");
  }

  function invoiceStatusStamp(status) {
    var s = String(status || "Unpaid").toLowerCase();
    if (s === "paid") return { text: "PAID", color: [22, 163, 74] };
    if (s.indexOf("partial") >= 0) return { text: "PARTIALLY PAID", color: [217, 119, 6] };
    return { text: "UNPAID", color: [220, 38, 38] };
  }

  function drawStatusStamp(doc, status, cx, cy) {
    var stamp = invoiceStatusStamp(status);
    doc.saveGraphicsState();
    try {
      if (doc.GState) doc.setGState(new doc.GState({ opacity: 0.42 }));
    } catch (e) {}
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor.apply(doc, stamp.color);
    doc.text(stamp.text, cx, cy, { align: "center", angle: 22 });
    doc.restoreGraphicsState();
  }

  function drawInvoiceItemsTable(doc, items, invoiceDate, y, state) {
    var cols = [
      { key: "date", label: "Date", w: 62 },
      { key: "code", label: "Code", w: 48 },
      { key: "desc", label: "Service Description", w: 0 },
      { key: "qty", label: "Qty", w: 36 },
      { key: "rate", label: "Rate", w: 58 },
      { key: "amt", label: "Amount", w: 62 }
    ];
    var fixed = cols.reduce(function (s, c) { return s + (c.w || 0); }, 0);
    cols[2].w = Math.max(140, CONTENT_W - fixed);
    var rowH = 18;
    y = ensureSpace(doc, y, rowH + 8, state);

    doc.setFillColor(219, 234, 254);
    doc.setDrawColor(191, 219, 254);
    doc.rect(M, y, CONTENT_W, rowH, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor.apply(doc, BRAND);
    var x = M;
    cols.forEach(function (c) {
      var labelX = (c.key === "qty" || c.key === "rate" || c.key === "amt") ? x + c.w - 4 : x + 4;
      var align = (c.key === "qty" || c.key === "rate" || c.key === "amt") ? "right" : "left";
      doc.text(c.label, labelX, y + 12, { align: align });
      x += c.w;
    });
    y += rowH;

    var rows = items.length ? items : [{ code: "", desc: "No line items", qty: "", price: "" }];
    rows.forEach(function (it, idx) {
      y = ensureSpace(doc, y, rowH + 2, state);
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(M, y, CONTENT_W, rowH, "F");
      }
      doc.setDrawColor(226, 232, 240);
      doc.line(M, y + rowH, PAGE_W - M, y + rowH);
      var amt = (Number(it.qty) || 0) * (Number(it.price) || 0);
      var values = [
        String(it.date || invoiceDate || "—"),
        String(it.code || "—"),
        String(it.desc || "Service"),
        String(it.qty == null || it.qty === "" ? "—" : it.qty),
        it.price === "" || it.price == null ? "—" : Number(it.price).toFixed(2),
        items.length ? amt.toFixed(2) : "—"
      ];
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      x = M;
      values.forEach(function (val, i) {
        var c = cols[i];
        var text = doc.splitTextToSize(val, c.w - 8)[0] || "—";
        if (i >= 3) doc.text(text, x + c.w - 4, y + 12, { align: "right" });
        else doc.text(text, x + 4, y + 12);
        x += c.w;
      });
      y += rowH;
    });
    return y + 12;
  }

  async function buildInvoiceDoc(opts) {
    var jsPDF = await loadJsPdf();
    var invoice = opts.invoice || {};
    var patient = opts.patient || {};
    var clinic = opts.clinic || {};
    var totals = opts.totals || {};
    var payments = opts.payments || [];
    var items = invoice.items || [];
    var insuranceLine = opts.insuranceLine || "";
    var defaultNotes = opts.defaultNotes || "Thank you for visiting Posture Clinic.";
    var logoAsset = await loadImageAsset(opts.logoUrl || "");
    var sigAsset = await loadImageAsset(clinic.signature || "");

    var doc = new jsPDF({ unit: "pt", format: "letter", compress: true });
    var state = { page: 1 };
    var y = M;
    var clinicName = String(clinic.name || "Posture Clinic");
    var providerName = resolveProviderName(opts, clinic);
    var logoSize = logoAsset ? fitImageBox(logoAsset.width, logoAsset.height, 64, 64) : null;
    var textLeft = M + (logoAsset ? logoSize.w + 14 : 0);

    if (logoAsset && logoAsset.dataUrl) {
      doc.addImage(logoAsset.dataUrl, imageFormat(logoAsset.dataUrl), M, y, logoSize.w, logoSize.h);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor.apply(doc, BRAND);
    doc.text(clinicName, textLeft, y + 22);
    if (providerName) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85);
      doc.text(providerName, textLeft, y + 38);
    }
    var contactBits = [clinic.address, clinic.phone, clinic.email].filter(Boolean).map(String);
    if (contactBits.length) {
      doc.setFontSize(8);
      doc.setTextColor.apply(doc, MUTED);
      var contactLines = doc.splitTextToSize(contactBits.join("  ·  "), CONTENT_W * 0.55);
      doc.text(contactLines, textLeft, y + (providerName ? 52 : 40));
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    doc.text("Invoice #  " + String(invoice.number || "—"), PAGE_W - M, y + 16, { align: "right" });
    doc.text("Date  " + String(invoice.date || "—"), PAGE_W - M, y + 30, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.setTextColor.apply(doc, BRAND);
    doc.text(String(invoice.status || "Unpaid").toUpperCase(), PAGE_W - M, y + 44, { align: "right" });

    y = Math.max(y + (logoAsset ? logoSize.h + 10 : 58), y + 62);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(1);
    doc.line(M, y, PAGE_W - M, y);
    y += 18;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(100, 116, 139);
    doc.text("INVOICE", PAGE_W / 2, y, { align: "center" });
    y += 16;

    var fromLines = [
      clinicName,
      providerName || "—",
      String(clinic.address || "—"),
      String(clinic.phone || "—"),
      String(clinic.email || "—")
    ].filter(function (line, idx, arr) {
      return line && (line !== "—" || arr.indexOf(line) === idx);
    });
    var billLines = [
      patientName(patient),
      String(patient.address || "—"),
      String(patient.phone || "—"),
      String(patient.email || "—")
    ];
    if (insuranceLine) billLines.push("Insurance: " + insuranceLine);

    var gap = 12;
    var boxW = (CONTENT_W - gap) / 2;
    var fromH = measureInfoBoxHeight(doc, fromLines, boxW);
    var billH = measureInfoBoxHeight(doc, billLines, boxW);
    var boxH = Math.max(fromH, billH);
    drawInfoBox(doc, "From", fromLines, M, y, boxW, boxH, { boldFirst: true });
    drawInfoBox(doc, "Bill To", billLines, M + boxW + gap, y, boxW, boxH);
    y += boxH + 12;

    var stripH = 36;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(M, y, CONTENT_W, stripH, 4, 4, "FD");
    var stripCols = [
      ["Patient DOB", String(patient.dob || "—")],
      ["Invoice #", String(invoice.number || "—")],
      ["Service Date", String(invoice.date || "—")],
      ["Balance Due", String(totals.balance || "—")]
    ];
    var stripW = CONTENT_W / stripCols.length;
    stripCols.forEach(function (col, i) {
      var cx = M + stripW * i + 10;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor.apply(doc, MUTED);
      doc.text(col[0].toUpperCase(), cx, y + 13);
      doc.setFont("helvetica", i === 3 ? "bold" : "normal");
      doc.setFontSize(10);
      doc.setTextColor.apply(doc, i === 3 ? BRAND : [15, 23, 42]);
      doc.text(col[1], cx, y + 27);
    });
    y += stripH + 14;

    y = drawInvoiceItemsTable(doc, items, invoice.date, y, state);

    var notes = String(invoice.notes || "").trim() || defaultNotes;
    var notesW = CONTENT_W * 0.56;
    var totalsW = CONTENT_W - notesW - 12;
    var notesInnerW = Math.max(40, notesW - 28);
    var notesLines = doc.splitTextToSize(notes, notesInnerW);
    var notesH = Math.max(118, notesLines.length * 12 + 44);
    var totRows = [
      ["Subtotal", String(totals.sub || "—")],
      ["Discount", "-" + String(totals.disc || "—")],
      ["Tax", String(totals.tax || "—")],
      ["Total", String(totals.total || "—")],
      ["Amount Paid", "-" + String(totals.paid || "—")],
      ["Amount Due", String(totals.balance || "—")]
    ];
    var totH = totRows.length * 18 + 16;
    var blockH = Math.max(totH, notesH);
    y = ensureSpace(doc, y, blockH + 20, state);

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(M, y, notesW, blockH, 4, 4, "FD");
    doc.setFillColor(241, 245, 249);
    doc.rect(M, y, 4, blockH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor.apply(doc, BRAND);
    doc.text("NOTES", M + 14, y + 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    doc.text(notesLines, M + 14, y + 30);

    var totalsX = M + notesW + 12;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(totalsX, y, totalsW, blockH, 4, 4, "FD");
    var ty = y + 18;
    totRows.forEach(function (row, idx) {
      var isGrand = idx === 3 || idx === 5;
      if (isGrand) {
        doc.setFillColor(239, 246, 255);
        doc.rect(totalsX + 1, ty - 11, totalsW - 2, 18, "F");
        doc.setFont("helvetica", "bold");
        doc.setTextColor.apply(doc, BRAND);
      } else {
        doc.setFont("helvetica", "normal");
        doc.setTextColor(51, 65, 85);
      }
      doc.setFontSize(9);
      doc.text(row[0], totalsX + 12, ty);
      doc.text(row[1], totalsX + totalsW - 12, ty, { align: "right" });
      ty += 18;
    });
    y += blockH + 18;

    if (payments.length) {
      y = drawSectionTitle(doc, "Payment History", y, state);
      var payLines = payments.map(function (p) {
        return String(p.date || "—") + "  " + String(p.amountText || "—") +
          "  " + String(p.method || "—") +
          (p.note ? "  Note: " + p.note : "");
      }).join("\n");
      y = drawParagraph(doc, payLines, y, state);
    }

    y = ensureSpace(doc, y, 110, state);
    var sigLineY = y + 56;
    var stampX = PAGE_W - M - 100;
    var stampY = sigLineY - 18;
    drawStatusStamp(doc, invoice.status, stampX, stampY);

    if (sigAsset && sigAsset.dataUrl) {
      var sigSize = fitImageBox(sigAsset.width, sigAsset.height, 180, 48);
      var sigX = PAGE_W - M - sigSize.w;
      doc.addImage(sigAsset.dataUrl, imageFormat(sigAsset.dataUrl), sigX, y, sigSize.w, sigSize.h, undefined, "FAST");
      y += Math.max(sigSize.h + 4, 52);
    } else {
      doc.setDrawColor(15, 23, 42);
      doc.line(PAGE_W - M - 200, sigLineY, PAGE_W - M, sigLineY);
      y = sigLineY + 8;
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    doc.text(providerName || "Provider", PAGE_W - M, y + 8, { align: "right" });

    drawChartFooter(doc, state, clinicName + " · Professional invoice");

    var filename = "Invoice_" + safeFilePart(invoice.number || "draft") + ".pdf";
    return { doc: doc, filename: filename };
  }

  function injectPdfPrintStyles() {
    if (document.getElementById("posturePdfPrintStyles")) return;
    var style = document.createElement("style");
    style.id = "posturePdfPrintStyles";
    style.textContent =
      ".pdf-print-overlay{position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:16px}" +
      ".pdf-print-modal{background:#fff;border-radius:12px;width:min(960px,100%);height:min(90vh,900px);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 48px rgba(0,0,0,.25)}" +
      ".pdf-print-head{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #e2e8f0;font:600 15px/1.4 system-ui,sans-serif;color:#0f172a}" +
      ".pdf-print-head .x{border:0;background:transparent;font-size:24px;line-height:1;cursor:pointer;color:#64748b;padding:0 4px}" +
      ".pdf-print-body{flex:1;overflow:auto;background:#525659;padding:16px}" +
      ".pdf-print-pages{display:flex;flex-direction:column;align-items:center;gap:16px;min-height:100%}" +
      ".pdf-print-page{display:block;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.35);max-width:100%;height:auto}" +
      ".pdf-print-loading{display:flex;align-items:center;justify-content:center;min-height:240px;color:#e2e8f0;font:500 14px/1.4 system-ui,sans-serif}" +
      ".pdf-print-foot{display:flex;gap:8px;justify-content:flex-end;padding:12px 16px;border-top:1px solid #e2e8f0}" +
      ".pdf-print-foot .btn{border:1px solid #cbd5e1;background:#fff;border-radius:8px;padding:8px 14px;font:500 14px/1 system-ui,sans-serif;cursor:pointer;color:#0f172a}" +
      ".pdf-print-foot .btn.primary{background:#1e40af;border-color:#1e40af;color:#fff}" +
      "@media print{html,body{height:auto!important;overflow:visible!important}" +
      "body>*:not(.posture-pdf-print-root){display:none!important}" +
      ".posture-pdf-print-root{display:block!important;position:static!important;width:100%!important;background:#fff!important}" +
      ".posture-pdf-print-sheet{page-break-after:always;break-after:page;display:flex;justify-content:center;align-items:flex-start;padding:0}" +
      ".posture-pdf-print-sheet:last-child{page-break-after:auto;break-after:auto}" +
      ".posture-pdf-print-sheet canvas{width:100%!important;max-width:7.5in;height:auto!important;display:block!important}}";
    document.head.appendChild(style);
  }

  function loadPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector("script[data-posture-pdfjs]");
      if (existing) {
        existing.addEventListener("load", function () { resolve(window.pdfjsLib); }, { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }
      var script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js";
      script.dataset.posturePdfjs = "true";
      script.onload = function () {
        if (!window.pdfjsLib) {
          reject(new Error("PDF.js failed to load"));
          return;
        }
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
        resolve(window.pdfjsLib);
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function renderPdfPages(doc, container) {
    var data = doc.output("arraybuffer");
    var body = container.parentElement;
    var maxWidth = Math.max((body && body.clientWidth) || 800, 320) - 32;
    return loadPdfJs().then(function (pdfjsLib) {
      return pdfjsLib.getDocument({ data: data }).promise;
    }).then(function (pdf) {
      container.innerHTML = "";
      var jobs = [];
      for (var pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        jobs.push((function (num) {
          return pdf.getPage(num).then(function (page) {
            var baseViewport = page.getViewport({ scale: 1 });
            var scale = Math.min(1.5, maxWidth / baseViewport.width);
            var viewport = page.getViewport({ scale: scale });
            var canvas = document.createElement("canvas");
            var ctx = canvas.getContext("2d");
            canvas.className = "pdf-print-page";
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            container.appendChild(canvas);
            return page.render({ canvasContext: ctx, viewport: viewport }).promise;
          });
        })(pageNum));
      }
      return Promise.all(jobs);
    });
  }

  function printPreviewPages(pagesEl, doc) {
    var canvases = pagesEl ? pagesEl.querySelectorAll("canvas") : [];
    if (!canvases.length) {
      printPdfDoc(doc);
      return;
    }

    var existing = document.getElementById("posturePdfPrintOnly");
    if (existing) existing.remove();

    var wrap = document.createElement("div");
    wrap.id = "posturePdfPrintOnly";
    wrap.className = "posture-pdf-print-root";
    canvases.forEach(function (canvas) {
      var sheet = document.createElement("div");
      sheet.className = "posture-pdf-print-sheet";
      var clone = document.createElement("canvas");
      clone.width = canvas.width;
      clone.height = canvas.height;
      clone.getContext("2d").drawImage(canvas, 0, 0);
      sheet.appendChild(clone);
      wrap.appendChild(sheet);
    });
    document.body.appendChild(wrap);

    var cleaned = false;
    function cleanup() {
      if (cleaned) return;
      cleaned = true;
      wrap.remove();
    }

    if ("onafterprint" in window) {
      window.addEventListener("afterprint", cleanup, { once: true });
    } else {
      setTimeout(cleanup, 120000);
    }

    window.print();
  }

  function printPdfViaFrame(url, onDone) {
    var existing = document.getElementById("posturePdfPrintLayer");
    if (existing) existing.remove();

    var layer = document.createElement("div");
    layer.id = "posturePdfPrintLayer";
    layer.style.cssText =
      "position:fixed;inset:0;z-index:100001;background:#fff;display:flex;flex-direction:column;";
    layer.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-bottom:1px solid #e2e8f0;font:600 14px/1.4 system-ui,sans-serif;color:#0f172a">' +
        '<span>Preparing print preview…</span>' +
        '<button type="button" id="posturePrintCancel" style="border:1px solid #cbd5e1;background:#fff;border-radius:8px;padding:6px 12px;cursor:pointer">Cancel</button>' +
      '</div>' +
      '<iframe id="posturePdfPrintFrame" title="PDF for printing" style="flex:1;width:100%;border:0;background:#fff"></iframe>';

    document.body.appendChild(layer);
    var frame = layer.querySelector("#posturePdfPrintFrame");
    var cancelled = false;

    function cleanup() {
      if (cancelled) return;
      cancelled = true;
      layer.remove();
      if (typeof onDone === "function") onDone();
    }

    layer.querySelector("#posturePrintCancel").addEventListener("click", cleanup);

    frame.onload = function () {
      setTimeout(function () {
        if (cancelled) return;
        try {
          var win = frame.contentWindow;
          if (win) {
            win.onafterprint = cleanup;
            win.focus();
            win.print();
            setTimeout(cleanup, 120000);
            return;
          }
        } catch (e) {}
        window.open(url, "_blank");
        cleanup();
      }, 700);
    };
    frame.onerror = cleanup;
    frame.src = url;
  }

  function printPdfDoc(doc) {
    var blob = doc.output("blob");
    var url = URL.createObjectURL(blob);
    printPdfViaFrame(url, function () {
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    });
  }

  function showPdfPrintPreview(doc, title) {
    injectPdfPrintStyles();
    return new Promise(function (resolve, reject) {
      var existing = document.getElementById("posturePdfPreview");
      if (existing) existing.remove();

      var overlay = document.createElement("div");
      overlay.id = "posturePdfPreview";
      overlay.className = "pdf-print-overlay";
      overlay.innerHTML =
        '<div class="pdf-print-modal" role="dialog" aria-modal="true" aria-label="PDF print preview">' +
          '<div class="pdf-print-head"><span>' + String(title || "Print preview").replace(/</g, "&lt;") + '</span><button type="button" class="x" data-action="close" aria-label="Close">&times;</button></div>' +
          '<div class="pdf-print-body"><div class="pdf-print-loading">Loading PDF preview…</div><div class="pdf-print-pages" hidden></div></div>' +
          '<div class="pdf-print-foot">' +
            '<button type="button" class="btn" data-action="close">Close</button>' +
            '<button type="button" class="btn primary" data-action="print" disabled>Print</button>' +
          '</div>' +
        '</div>';

      var pages = overlay.querySelector(".pdf-print-pages");
      var loading = overlay.querySelector(".pdf-print-loading");
      var printBtn = overlay.querySelector('[data-action="print"]');
      var closed = false;

      function closePreview() {
        if (closed) return;
        closed = true;
        overlay.remove();
        resolve();
      }

      overlay.querySelectorAll('[data-action="close"]').forEach(function (btn) {
        btn.addEventListener("click", closePreview);
      });
      overlay.addEventListener("click", function (e) {
        if (e.target === overlay) closePreview();
      });

      printBtn.addEventListener("click", function () {
        printPreviewPages(pages, doc);
      });

      document.body.appendChild(overlay);

      renderPdfPages(doc, pages).then(function () {
        loading.remove();
        pages.hidden = false;
        printBtn.disabled = false;
      }).catch(function (err) {
        loading.textContent = "Could not load PDF preview.";
        printBtn.disabled = false;
        printBtn.textContent = "Print anyway";
        console.error("PDF preview render failed", err);
      });
    });
  }

  async function downloadSoap(opts) {
    var built = await buildSoapDoc(opts);
    built.doc.save(built.filename);
    return built.filename;
  }

  async function printSoap(opts) {
    var built = await buildSoapDoc(opts);
    var title = "SOAP Note — " + patientName(opts.patient || {});
    await showPdfPrintPreview(built.doc, title);
    return built.filename;
  }

  async function buildClinicalNoteDoc(opts) {
    var jsPDF = await loadJsPdf();
    var record = opts.record || {};
    var patient = opts.patient || {};
    var clinic = opts.clinic || {};
    var sections = opts.sections || [];
    var logoAsset = await loadImageAsset(opts.logoUrl || "");
    var sigAsset = await loadImageAsset(clinic.signature || "");
    var title = String(opts.title || "CLINICAL NOTE");
    var printed = new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    var doc = new jsPDF({ unit: "pt", format: "letter", compress: true });
    var state = { page: 1 };
    var y = drawLetterheadBlock(doc, {
      clinic: clinic,
      logoAsset: logoAsset,
      providerName: opts.providerName,
      title: title,
      rightLines: [
        "Printed: " + printed,
        "Date: " + String(record.date || "—"),
        "Patient: " + patientName(patient)
      ]
    });

    var colW = (CONTENT_W - 12) / 2;
    var leftY = drawMetaRow(doc, "Patient", patientName(patient), M, y, colW);
    var rightY = drawMetaRow(doc, "Date of birth", patient.dob || "—", M + colW + 12, y, colW);
    y = Math.max(leftY, rightY);
    leftY = drawMetaRow(doc, "Phone", patient.phone || "—", M, y, colW);
    rightY = drawMetaRow(doc, "Email", patient.email || "—", M + colW + 12, y, colW);
    y = Math.max(leftY, rightY);
    y = drawMetaRow(doc, "Address", patient.address || "—", M, y, CONTENT_W) + 2;
    y = drawLine(doc, y);

    sections.forEach(function (section) {
      y = drawSection(doc, section.title || "Section", section.body, y, state);
    });

    y = ensureSpace(doc, y, 90, state);
    if (sigAsset && sigAsset.dataUrl) {
      var sigSize = fitImageBox(sigAsset.width, sigAsset.height, 180, 48);
      var sigX = PAGE_W - M - sigSize.w;
      doc.addImage(sigAsset.dataUrl, imageFormat(sigAsset.dataUrl), sigX, y, sigSize.w, sigSize.h, undefined, "FAST");
      y += Math.max(sigSize.h + 4, 52);
    } else {
      y += 24;
      doc.setDrawColor(17, 24, 39);
      doc.line(PAGE_W - M - 180, y, PAGE_W - M, y);
      y += 8;
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    doc.text("Provider signature — " + resolveProviderName(opts, clinic), PAGE_W - M, y + 8, { align: "right" });

    drawChartFooter(doc, state, String(clinic.name || "Posture Clinic") + " · " + String(opts.footerLabel || "Clinical note"));

    var filename =
      String(opts.filenamePrefix || "Note") + "_" +
      safeFilePart(patientName(patient)) + "_" +
      safeFilePart(record.date || "note") + ".pdf";
    return { doc: doc, filename: filename };
  }

  async function downloadClinicalNote(opts) {
    var built = await buildClinicalNoteDoc(opts);
    built.doc.save(built.filename);
    return built.filename;
  }

  async function printClinicalNote(opts) {
    var built = await buildClinicalNoteDoc(opts);
    var title = String(opts.title || "Clinical Note") + " — " + patientName(opts.patient || {});
    await showPdfPrintPreview(built.doc, title);
    return built.filename;
  }

  async function printPatientChart(opts) {
    var built = await buildPatientChartDoc(opts);
    var title = "Patient Chart — " + patientName(opts.patient || {});
    await showPdfPrintPreview(built.doc, title);
    return built.filename;
  }

  async function printInvoice(opts) {
    var built = await buildInvoiceDoc(opts);
    var title = "Invoice — " + String((opts.invoice && opts.invoice.number) || "Draft");
    await showPdfPrintPreview(built.doc, title);
    return built.filename;
  }

  async function downloadInvoice(opts) {
    var built = await buildInvoiceDoc(opts);
    built.doc.save(built.filename);
    return built.filename;
  }

  window.PosturePortalPdf = {
    buildSoapDoc: buildSoapDoc,
    buildClinicalNoteDoc: buildClinicalNoteDoc,
    buildPatientChartDoc: buildPatientChartDoc,
    buildInvoiceDoc: buildInvoiceDoc,
    downloadSoap: downloadSoap,
    printSoap: printSoap,
    downloadClinicalNote: downloadClinicalNote,
    printClinicalNote: printClinicalNote,
    printPatientChart: printPatientChart,
    printInvoice: printInvoice,
    downloadInvoice: downloadInvoice
  };
})();
