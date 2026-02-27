(function () {
  const $ = (id) => document.getElementById(id);

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

  // -------- helpers --------
  function showError(msg) {
    errorBox.textContent = msg || "";
    errorBox.hidden = !msg;
  }
  function showOk(msg) {
    okBox.textContent = msg || "";
    okBox.hidden = !msg;
  }
  function escapeHtml(s) {
    return (s || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[c]));
  }

  // Deterministic PRNG (xmur3 + mulberry32)
  function xmur3(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function() {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= h >>> 16) >>> 0;
    };
  }
  function mulberry32(a) {
    return function() {
      let t = (a += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function normalize(s){
    return (s || "").trim().replace(/\s+/g, " ");
  }

  // Main assignment pick:
  // 1) Variant row (1..30) from hash(FIO|GROUP) -> stable
  // 2) One link type (t1/t2/t3) randomly (stable)
  // 3) One plot type (АЖС/ФЖС/АФЖС) randomly (stable)
  // 4) One theory Q/A randomly (stable)
  function pickAssignment(fio, group) {
    const seedStr = `${fio}||${group}`.toLowerCase();
    const seed = xmur3(seedStr)();
    const rnd = mulberry32(seed);

    const variants = window.VARIANTS || [];
    if (!variants.length) return null;

    const variantIndex = Math.floor(rnd() * variants.length); // 0..29
    const v = variants[variantIndex];

    const taskKeys = ["t1","t2","t3"];
    const taskKey = taskKeys[Math.floor(rnd() * taskKeys.length)];
    const params = v[taskKey];

    const plots = window.PLOT_TYPES || ["АЖС","ФЖС","АФЖС"];
    const plotType = plots[Math.floor(rnd() * plots.length)];

    const qas = window.THEORY_QA || [];
    const qa = qas.length ? qas[Math.floor(rnd() * qas.length)] : {q:"",a:""};

    return { variantN: v.n, taskKey, params, plotType, qa };
  }

  function renderAssignment(fio, group, a) {
    const now = new Date();
    const isT2 = a.taskKey === "t2";

    const linkTitle = isT2
      ? "Екі инерциялық буын (K, T₁, T₂)"
      : "1-ретті апериодтық буын (K, T)";

    const p = a.params;
    const paramsText = isT2
      ? `K=${p.K}, T₁=${p.T1}, T₂=${p.T2}`
      : `K=${p.K}, T=${p.T}`;

    taskTitle.textContent = "Жеке тапсырма (№3 практикалық жұмыс)";
    badgeVariant.textContent = `Нұсқа: ${a.variantN}`;
    taskMeta.textContent = `${fio} · ${group} · ${now.toLocaleString()}`;

    const plotHint = a.plotType === "АЖС"
      ? "A(ω)=|W(jω)|=√(Re(ω)^2+Im(ω)^2) графигін салыңыз."
      : a.plotType === "ФЖС"
        ? "φ(ω)=arg W(jω)=atan2(Im(ω),Re(ω)) графигін салыңыз."
        : "Комплексті жазықтықта (Re(ω), Im(ω)) нүктелерінің траекториясын салыңыз (АФЖС).";

    taskBody.innerHTML = `
      <h3>1) Сізге түскен буын</h3>
      <p><b>${linkTitle}</b></p>
      <p><code>${escapeHtml(paramsText)}</code></p>

      <h3>2) Орындайтын тапсырма</h3>
      <p><b>${escapeHtml(a.plotType)}</b> салу (тек біреуін).</p>
      <p class="muted">${escapeHtml(plotHint)}</p>

      <h3>3) Қысқа теория</h3>
      <p><b>Сұрақ:</b> ${escapeHtml(a.qa.q)}</p>

      <div id="theoryAnswerBox" hidden style="margin-top:10px;">
        <p><b>Жауап:</b> ${escapeHtml(a.qa.a)}</p>
      </div>

      <div class="hint">
        Жауап тек жұмысты жібергеннен кейін ашылады.
      </div>

      <details style="margin-top:12px;">
        <summary><b>Қысқа алгоритм</b> (қалай бастау керек)</summary>
        <ol>
          <li>Беріліс функциясында <code>s=jω</code> ауыстыруын жасаңыз → <code>W(jω)</code>.</li>
          <li><code>W(jω)=Re(ω)+jIm(ω)</code> түріне келтіріңіз (бөлімді комплексті түйіндесіне көбейту көмектеседі).</li>
          <li>Таңдалған сипаттамаңызды (АЖС/ФЖС/АФЖС) салыңыз.</li>
          <li>MATLAB қолдансаңыз: Re, Im, A, φ есептеп график шығарыңыз (код/скрин тіркеңіз).</li>
        </ol>
      </details>
    `;

    taskCard.hidden = false;
    btnPrint.disabled = false;

    // enable submit if files chosen
    btnSubmit.disabled = !(filesInput.files && filesInput.files.length > 0);

    // store last to localStorage
    localStorage.setItem("TAU3_LAST", JSON.stringify({ fio, group, assignment: a }));
  }

  // -------- submit (Google Apps Script) --------
  function fileToBase64(file){
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const res = String(reader.result);
        const base64 = res.split(",")[1];
        resolve({
          name: file.name,
          mimeType: file.type || "application/octet-stream",
          base64
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  filesInput.addEventListener("change", () => {
    btnSubmit.disabled = !(filesInput.files && filesInput.files.length > 0);
  });

  btnSubmit.addEventListener("click", async () => {
    submitStatus.textContent = "";
    const fio = normalize(fioInput.value);
    const group = normalize(groupInput.value);
    if (!fio || fio.length < 5) return (submitStatus.textContent = "❌ ФИО толық енгізіңіз.");
    if (!group || group.length < 2) return (submitStatus.textContent = "❌ Топты енгізіңіз.");

    const last = JSON.parse(localStorage.getItem("TAU3_LAST") || "null");
    const a = last?.assignment || pickAssignment(fio, group);

    const files = Array.from(filesInput.files || []);
    if (!files.length) return (submitStatus.textContent = "❌ Файл таңдалмаған.");
    if (files.length > 6) return (submitStatus.textContent = "❌ Макс. 6 файл ғана.");

    // if no submit URL configured
    if (typeof SUBMIT_URL === "undefined" || !SUBMIT_URL) {
      submitStatus.textContent = "⚠️ Жіберу сервері бапталмаған (SUBMIT_URL бос). Файлдарды мұғалім көрсеткен арнаға жіберіңіз. " + (typeof TEACHER_CONTACT !== "undefined" ? TEACHER_CONTACT : "");
      return;
    }

    btnSubmit.disabled = true;
    submitStatus.textContent = "Жіберіліп жатыр...";

    try {
      const packed = [];
      for (const f of files) packed.push(await fileToBase64(f));

      const payload = {
        fio, group,
        variant: a.variantN,
        linkType: a.taskKey,
        plotType: a.plotType,
        theoryQ: a.qa?.q || "",
        files: packed
      };

await fetch(SUBMIT_URL, {
  method: "POST",
  mode: "no-cors",
  headers: { "Content-Type":"application/json" },
  body: JSON.stringify(payload)
});

// no-cors режимінде жауапты оқи алмаймыз, бірақ файлдар жіберіледі
submitStatus.textContent = "✅ Жіберілді. Рахмет!";
      const box = document.getElementById("theoryAnswerBox");
if (box) box.hidden = false;
    } catch (e) {
      submitStatus.textContent = "❌ Қате: " + (e.message || e);
      btnSubmit.disabled = false;
    }
  });

  // -------- events --------
  btnGet.addEventListener("click", () => {
    showError("");
    showOk("");

    const fio = normalize(fioInput.value);
    const group = normalize(groupInput.value);

    if (!fio || fio.length < 5) return showError("ФИО толық енгізіңіз.");
    if (!group || group.length < 2) return showError("Топты енгізіңіз.");

    const a = pickAssignment(fio, group);
    if (!a) return showError("Деректер табылмады (tasks.js).");

    renderAssignment(fio, group, a);
    showOk("Тапсырма бекітілді. Енді орындап, файл жүктеп жіберіңіз.");
  });

  btnPrint.addEventListener("click", () => window.print());

  // restore
  try {
    const last = JSON.parse(localStorage.getItem("TAU3_LAST") || "null");
    if (last?.fio) fioInput.value = last.fio;
    if (last?.group) groupInput.value = last.group;
    if (last?.assignment) {
      renderAssignment(last.fio, last.group, last.assignment);
      showOk("Алдыңғы тапсырмаңыз қайта ашылды (осы құрылғыда).");
    }
  } catch {}
})();
