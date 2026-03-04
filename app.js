// app.js (FULL, fixed)
// Requires: config.js (SUBMIT_URL, TEACHER_CONTACT, DEADLINE_ISO, SESSION_MINUTES)
// Requires: tasks.js (window.VARIANTS, window.THEORY_QA, window.PLOT_TYPES)

(function () {
  const $ = (id) => document.getElementById(id);

  // -------- DOM refs --------
  const fioInput = $("fioInput");
  const groupInput = $("groupInput");
  const btnGet = $("btnGet");
  const btnPrint = $("btnPrint");
  const taskCard = $("taskCard");
  const taskTitle = $("taskTitle");
  const taskMeta = $("taskMeta");
  const badgeVariant = $("badgeVariant");
  const taskBody = $("taskBody");
  const errorBox = $("error");
  const okBox = $("ok");

  const filesInput = $("filesInput");
  const btnSubmit = $("btnSubmit");
  const submitStatus = $("submitStatus");

  const timerBox = $("timerBox");
  const timerText = $("timerText");
  const timerHint = $("timerHint");

  // -------- UI helpers --------
  function showError(msg) {
    if (!errorBox) return;
    errorBox.textContent = msg || "";
    errorBox.hidden = !msg;
  }
  function showOk(msg) {
    if (!okBox) return;
    okBox.textContent = msg || "";
    okBox.hidden = !msg;
  }
  function escapeHtml(s) {
    return (s || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[c]);
  }
  function normalize(s) {
    return (s || "").trim().replace(/\s+/g, " ");
  }

  // -------- Deterministic PRNG --------
  function xmur3(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= h >>> 16) >>> 0;
    };
  }
  function mulberry32(a) {
    return function () {
      let t = (a += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // -------- Deadline --------
  function parseDeadline() {
    try {
      if (typeof DEADLINE_ISO === "undefined" || !DEADLINE_ISO) return null;
      const d = new Date(DEADLINE_ISO);
      if (isNaN(d.getTime())) return null;
      return d;
    } catch {
      return null;
    }
  }
  function isDeadlinePassed() {
    const d = parseDeadline();
    if (!d) return false;
    return Date.now() > d.getTime();
  }
  function showClosedBanner() {
    const banner = document.getElementById("deadlineBanner");
    const txt = document.getElementById("deadlineText");
    const d = parseDeadline();
    if (!banner) return;
    if (!d) {
      banner.style.display = "none";
      return;
    }
    banner.style.display = "block";
    if (Date.now() > d.getTime()) {
      banner.style.borderColor = "rgba(255,107,107,.35)";
      if (txt) txt.textContent = "Дедлайн өтті: " + d.toLocaleString() + ". Тапсырма алу және жіберу жабық.";
    } else {
      banner.style.borderColor = "rgba(122,162,255,.18)";
      if (txt) txt.textContent = "Дедлайн: " + d.toLocaleString() + ". Осы уақытқа дейін жіберіңіз.";
    }
  }

  // -------- Session timer --------
  function getSessionKey(fio, group) {
    return "TAU3_SESSION_" + normalize(fio).toLowerCase() + "__" + normalize(group).toLowerCase();
  }
  function getSessionMinutes() {
    try {
      if (typeof SESSION_MINUTES === "undefined" || !SESSION_MINUTES) return 20;
      const m = Number(SESSION_MINUTES);
      return Number.isFinite(m) && m > 0 ? m : 20;
    } catch {
      return 20;
    }
  }
  function loadSession(fio, group) {
    try {
      const raw = localStorage.getItem(getSessionKey(fio, group));
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj || !obj.startMs) return null;
      return obj;
    } catch {
      return null;
    }
  }
  function saveSession(fio, group, obj) {
    try { localStorage.setItem(getSessionKey(fio, group), JSON.stringify(obj)); } catch {}
  }
  function remainingMsForSession(fio, group) {
    const s = loadSession(fio, group);
    if (!s) return null;
    const total = getSessionMinutes() * 60 * 1000;
    return (s.startMs + total) - Date.now();
  }

  let timerInterval = null;
  function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  }
  function formatMs(ms) {
    const t = Math.max(0, Math.floor(ms / 1000));
    const mm = String(Math.floor(t / 60)).padStart(2, "0");
    const ss = String(t % 60).padStart(2, "0");
    return mm + ":" + ss;
  }
  function lockDueToTimer() {
    if (btnSubmit) btnSubmit.disabled = true;
    if (filesInput) filesInput.disabled = true;
    if (submitStatus) submitStatus.textContent = "⛔ Уақыт аяқталды. Жіберу жабық.";
    if (timerHint) timerHint.textContent = "Уақыт аяқталды — жіберу мүмкін емес.";
  }
  function tickTimer(fio, group) {
    const left = remainingMsForSession(fio, group);
    if (left === null) {
      if (timerText) timerText.textContent = "--:--";
      return;
    }
    if (timerText) timerText.textContent = formatMs(left);
    if (left <= 0) {
      stopTimer();
      lockDueToTimer();
    }
  }

  // -------- Server (no CORS preflight: NO headers) --------
  async function registerStartOnServer(payload) {
    try {
      if (typeof SUBMIT_URL === "undefined" || !SUBMIT_URL) return;
      await fetch(SUBMIT_URL, {
        method: "POST",
        mode: "no-cors",
        body: JSON.stringify({ action: "start", ...payload })
      });
    } catch (e) {}
  }

  // -------- Assignment picking --------
  function pickAssignment(fio, group) {
    const seedStr = (normalize(fio) + "||" + normalize(group)).toLowerCase();
    const seed = xmur3(seedStr)();
    const rnd = mulberry32(seed);

    const variants = window.VARIANTS || [];
    if (!variants.length) return null;

    const variantIndex = Math.floor(rnd() * variants.length);
    const v = variants[variantIndex];

    const keys = ["t1", "t2", "t3"];
    const taskKey = keys[Math.floor(rnd() * keys.length)];
    const params = v[taskKey];

    const plots = window.PLOT_TYPES || ["АЖС", "ФЖС", "АФЖС"];
    const plotType = plots[Math.floor(rnd() * plots.length)];

    const qas = window.THEORY_QA || [];
    const qa = qas.length ? qas[Math.floor(rnd() * qas.length)] : { q: "", a: "" };

    return { variantN: v.n, taskKey, params, plotType, qa };
  }

  function renderAssignment(fio, group, a) {
    const now = new Date();
    const isT2 = a.taskKey === "t2";
    const isT3 = a.taskKey === "t3";

    let linkTitle = "";
    if (isT2) linkTitle = "Екі инерциялық буын (K, T₁, T₂) → W(s)=K/((T₁s+1)(T₂s+1))";
    else if (isT3) linkTitle = "Интегралдаушы буын (K, T) → W(s)=K/(s(Ts+1))";
    else linkTitle = "1-ретті апериодтық буын (K, T) → W(s)=K/(Ts+1)";

    const p = a.params;
    const paramsText = isT2 ? ("K=" + p.K + ", T₁=" + p.T1 + ", T₂=" + p.T2) : ("K=" + p.K + ", T=" + p.T);

    let plotHint = "";
    if (a.plotType === "АЖС") plotHint = "A(ω)=|W(jω)|=√(Re(ω)^2+Im(ω)^2) графигін салыңыз.";
    else if (a.plotType === "ФЖС") plotHint = "φ(ω)=arg W(jω)=atan2(Im(ω),Re(ω)) графигін салыңыз.";
    else plotHint = "Комплексті жазықтықта (Re(ω), Im(ω)) нүктелерінің траекториясын салыңыз (АФЖС).";

    if (taskTitle) taskTitle.textContent = "Жеке тапсырма (№3 практикалық жұмыс)";
    if (badgeVariant) badgeVariant.textContent = "Нұсқа: " + a.variantN;
    if (taskMeta) taskMeta.textContent = fio + " · " + group + " · " + now.toLocaleString();

    if (taskBody) {
      taskBody.innerHTML =
        '<h3>1) Сізге түскен буын</h3>' +
        '<p><b>' + escapeHtml(linkTitle) + '</b></p>' +
        '<p><code>' + escapeHtml(paramsText) + '</code></p>' +

        '<h3>2) Орындайтын тапсырма</h3>' +
        '<p><b>' + escapeHtml(a.plotType) + '</b> салу (тек біреуін).</p>' +
        '<p class="muted">' + escapeHtml(plotHint) + '</p>' +

        '<h3>3) Қысқа теория</h3>' +
        '<p><b>Сұрақ:</b> ' + escapeHtml(a.qa.q) + '</p>' +

        '<div id="theoryAnswerBox" hidden style="margin-top:10px;">' +
          '<p><b>Жауап:</b> ' + escapeHtml(a.qa.a) + '</p>' +
        '</div>' +

        '<div class="hint">Жауап тек жұмысты жібергеннен кейін ашылады.</div>' +
        '<div id="theoryUnlockedMsg" class="ok" hidden>✅ Жауап ашылды.</div>';
    }

    if (timerBox) timerBox.style.display = "block";
    if (taskCard) taskCard.hidden = false;
    if (btnPrint) btnPrint.disabled = false;

    if (btnSubmit) btnSubmit.disabled = !(filesInput && filesInput.files && filesInput.files.length > 0);
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const res = String(reader.result);
        const base64 = res.split(",")[1];
        resolve({ name: file.name, mimeType: file.type || "application/octet-stream", base64: base64 });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // -------- Events --------
  if (filesInput) {
    filesInput.addEventListener("change", () => {
      if (isDeadlinePassed()) { if (btnSubmit) btnSubmit.disabled = true; return; }
      const fio = normalize(fioInput?.value);
      const group = normalize(groupInput?.value);
      const left = (fio && group) ? remainingMsForSession(fio, group) : null;
      if (left !== null && left <= 0) { lockDueToTimer(); return; }
      if (btnSubmit) btnSubmit.disabled = !(filesInput.files && filesInput.files.length > 0);
    });
  }

  if (btnGet) {
    btnGet.addEventListener("click", () => {
      showError(""); showOk("");
      showClosedBanner();
      if (isDeadlinePassed()) { showError("⛔ Дедлайн өтті. Тапсырма алу жабық."); return; }

      const fio = normalize(fioInput?.value);
      const group = normalize(groupInput?.value);

      if (!fio || fio.length < 5) { showError("ФИО толық енгізіңіз."); return; }
      if (!group || group.length < 2) { showError("Топты енгізіңіз."); return; }

      const a = pickAssignment(fio, group);
      if (!a) { showError("Деректер табылмады (tasks.js)."); return; }

      renderAssignment(fio, group, a);

      const existing = loadSession(fio, group);
      if (!existing) {
        const startMs = Date.now();
        saveSession(fio, group, { startMs: startMs });
        registerStartOnServer({ fio: fio, group: group, startMs: startMs, minutes: getSessionMinutes() });
      }

      stopTimer();
      timerInterval = setInterval(() => tickTimer(fio, group), 1000);
      tickTimer(fio, group);

      const left = remainingMsForSession(fio, group);
      if (left !== null && left <= 0) lockDueToTimer();

      try { localStorage.setItem("TAU3_LAST", JSON.stringify({ fio: fio, group: group, assignment: a })); } catch {}

      showOk("Тапсырма бекітілді. Енді орындап, файл жүктеп жіберіңіз.");
    });
  }

  if (btnPrint) btnPrint.addEventListener("click", () => window.print());

  if (btnSubmit) {
    btnSubmit.addEventListener("click", async () => {
      if (!submitStatus) return;
      submitStatus.textContent = "";
      showClosedBanner();
      if (isDeadlinePassed()) { submitStatus.textContent = "⛔ Дедлайн өтті. Жіберу жабық."; return; }

      const fio = normalize(fioInput?.value);
      const group = normalize(groupInput?.value);

      if (!fio || fio.length < 5) { submitStatus.textContent = "❌ ФИО толық енгізіңіз."; return; }
      if (!group || group.length < 2) { submitStatus.textContent = "❌ Топты енгізіңіз."; return; }

      const left = remainingMsForSession(fio, group);
      if (left !== null && left <= 0) { lockDueToTimer(); return; }

      let last = null;
      try { last = JSON.parse(localStorage.getItem("TAU3_LAST") || "null"); } catch {}
      const a = last?.assignment || pickAssignment(fio, group);

      const files = Array.from(filesInput?.files || []);
      if (!files.length) { submitStatus.textContent = "❌ Файл таңдалмаған."; return; }
      if (files.length > 6) { submitStatus.textContent = "❌ Макс. 6 файл ғана."; return; }

      if (typeof SUBMIT_URL === "undefined" || !SUBMIT_URL) {
        submitStatus.textContent = "⚠️ Жіберу сервері бапталмаған (SUBMIT_URL бос). " +
          (typeof TEACHER_CONTACT !== "undefined" ? TEACHER_CONTACT : "");
        return;
      }

      btnSubmit.disabled = true;
      submitStatus.textContent = "Жіберіліп жатыр...";

      try {
        const packed = [];
        for (const f of files) packed.push(await fileToBase64(f));

        const session = loadSession(fio, group);
        const payload = {
          action: "submit",
          fio: fio, group: group,
          variant: a?.variantN ?? "",
          linkType: a?.taskKey ?? "",
          plotType: a?.plotType ?? "",
          theoryQ: a?.qa?.q || "",
          startMs: session?.startMs || null,
          minutes: getSessionMinutes(),
          files: packed
        };

        await fetch(SUBMIT_URL, {
          method: "POST",
          mode: "no-cors",
          body: JSON.stringify(payload)
        });

        submitStatus.textContent = "✅ Жіберілді. Рахмет!";

        const ans = document.getElementById("theoryAnswerBox");
        if (ans) ans.hidden = false;
        const msg = document.getElementById("theoryUnlockedMsg");
        if (msg) msg.hidden = false;

      } catch (e) {
        submitStatus.textContent = "❌ Қате: " + (e?.message || e);
        btnSubmit.disabled = false;
      }
    });
  }

  // -------- Init / Restore --------
  showClosedBanner();
  if (isDeadlinePassed()) {
    if (btnGet) btnGet.disabled = true;
    if (btnSubmit) btnSubmit.disabled = true;
  }

  try {
    const last = JSON.parse(localStorage.getItem("TAU3_LAST") || "null");
    if (last?.fio && fioInput) fioInput.value = last.fio;
    if (last?.group && groupInput) groupInput.value = last.group;

    if (last?.assignment) {
      renderAssignment(last.fio, last.group, last.assignment);

      stopTimer();
      timerInterval = setInterval(() => tickTimer(last.fio, last.group), 1000);
      tickTimer(last.fio, last.group);

      const left = remainingMsForSession(last.fio, last.group);
      if (left !== null && left <= 0) lockDueToTimer();

      showOk("Алдыңғы тапсырмаңыз қайта ашылды (осы құрылғыда).");
    }
  } catch {}
})(); 
