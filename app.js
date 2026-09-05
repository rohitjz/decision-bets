// Decision Bets — vanilla JS, no dependencies, no build step.
// Everything persists to localStorage so it works as a static GitHub Pages site.

(() => {
  const STORAGE_KEY = "decision-bets-journal-v1";

  /* ---------------------------- Tabs ---------------------------- */
  const tabButtons = document.querySelectorAll(".tab-btn");
  const panels = document.querySelectorAll(".panel");
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabButtons.forEach((b) => b.classList.remove("active"));
      panels.forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.tab).classList.add("active");
    });
  });

  /* ---------------------------- Journal storage ---------------------------- */
  function loadJournal() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  }
  function saveJournal(entries) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }
  function addJournalEntry(entry) {
    const entries = loadJournal();
    entries.unshift({ ...entry, id: Date.now(), savedAt: new Date().toISOString() });
    saveJournal(entries);
    renderJournal();
  }

  function renderJournal() {
    const entries = loadJournal();
    const list = document.getElementById("journal-list");
    const empty = document.getElementById("journal-empty");
    list.innerHTML = "";
    empty.hidden = entries.length !== 0;

    entries.forEach((entry) => {
      const el = document.createElement("div");
      el.className = "journal-entry";
      const date = new Date(entry.savedAt).toLocaleString();
      let body = "";

      if (entry.type === "eva") {
        const rowsText = entry.rows
          .map((r) => `• ${r.name || "(unnamed)"} — payoff ${r.payoff}, prob ${r.prob}%, EV ${r.ev.toFixed(2)}`)
          .join("\n");
        body = `<pre>${escapeHtml(rowsText)}\n\nTotal EV: ${entry.totalEv.toFixed(2)} (total probability ${entry.totalProb}%)${
          entry.premortem ? `\n\nPre-mortem:\n${escapeHtml(entry.premortem)}` : ""
        }</pre>`;
      } else if (entry.type === "skillluck") {
        body = `<pre>Skill/Luck dial: ${entry.value}/100 (skill)\n\nSkill notes:\n${escapeHtml(entry.skillNotes || "-")}\n\nLuck notes:\n${escapeHtml(
          entry.luckNotes || "-"
        )}\n\nHonest mistake:\n${escapeHtml(entry.mistakeNotes || "-")}</pre>`;
      }

      el.innerHTML = `
        <span class="badge">${entry.type === "eva" ? "EVA Framework" : "Skill vs Luck Audit"}</span>
        <h4>${escapeHtml(entry.title || "(untitled)")}</h4>
        <div class="meta">Saved ${date}</div>
        ${body}
        <div class="entry-actions">
          <button class="btn danger delete-entry" data-id="${entry.id}">Delete</button>
        </div>
      `;
      list.appendChild(el);
    });

    list.querySelectorAll(".delete-entry").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.dataset.id);
        saveJournal(loadJournal().filter((e) => e.id !== id));
        renderJournal();
      });
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  document.getElementById("journal-clear").addEventListener("click", () => {
    if (confirm("Clear all saved journal entries? This cannot be undone.")) {
      saveJournal([]);
      renderJournal();
    }
  });

  /* ---------------------------- 1. EVA Framework ---------------------------- */
  const evaRows = document.getElementById("eva-rows");
  const evaTotalProb = document.getElementById("eva-total-prob");
  const evaTotalEv = document.getElementById("eva-total-ev");
  const evaProbWarning = document.getElementById("eva-prob-warning");

  function makeEvaRow(name = "", payoff = "", prob = "") {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="text" class="eva-name" placeholder="e.g. Great success" value="${escapeHtml(name)}" /></td>
      <td><input type="number" class="eva-payoff" placeholder="e.g. 50000 or -20000" value="${escapeHtml(payoff)}" /></td>
      <td><input type="number" class="eva-prob" min="0" max="100" placeholder="e.g. 30" value="${escapeHtml(prob)}" /></td>
      <td class="ev-cell eva-ev">0</td>
      <td><button class="icon-btn remove-row" title="Remove scenario">✕</button></td>
    `;
    evaRows.appendChild(tr);
    tr.querySelectorAll("input").forEach((inp) => inp.addEventListener("input", recalcEva));
    tr.querySelector(".remove-row").addEventListener("click", () => {
      tr.remove();
      recalcEva();
    });
  }

  function recalcEva() {
    let totalProb = 0;
    let totalEv = 0;
    evaRows.querySelectorAll("tr").forEach((tr) => {
      const payoff = parseFloat(tr.querySelector(".eva-payoff").value) || 0;
      const prob = parseFloat(tr.querySelector(".eva-prob").value) || 0;
      const ev = payoff * (prob / 100);
      tr.querySelector(".eva-ev").textContent = ev.toFixed(2);
      totalProb += prob;
      totalEv += ev;
    });
    evaTotalProb.textContent = `${totalProb}%`;
    evaTotalEv.textContent = totalEv.toFixed(2);
    evaProbWarning.hidden = evaRows.querySelectorAll("tr").length === 0 || Math.abs(totalProb - 100) < 0.01;
  }

  document.getElementById("eva-add-row").addEventListener("click", () => makeEvaRow());

  document.getElementById("eva-save").addEventListener("click", () => {
    const title = document.getElementById("eva-title").value.trim();
    const rows = [...evaRows.querySelectorAll("tr")].map((tr) => ({
      name: tr.querySelector(".eva-name").value.trim(),
      payoff: parseFloat(tr.querySelector(".eva-payoff").value) || 0,
      prob: parseFloat(tr.querySelector(".eva-prob").value) || 0,
      ev: parseFloat(tr.querySelector(".eva-ev").textContent) || 0,
    }));
    if (!title || rows.length === 0) {
      alert("Add a decision title and at least one scenario before saving.");
      return;
    }
    addJournalEntry({
      type: "eva",
      title,
      rows,
      totalProb: parseFloat(evaTotalProb.textContent) || 0,
      totalEv: parseFloat(evaTotalEv.textContent) || 0,
      premortem: document.getElementById("eva-premortem").value.trim(),
    });
    alert("Saved to your Decision Journal.");
  });

  // Seed with two starter rows so the table isn't empty on first load.
  makeEvaRow("Great success", "", "");
  makeEvaRow("Catastrophic failure", "", "");
  recalcEva();

  /* ---------------------------- 2. Known / Unknown ---------------------------- */
  function makeListAdder(inputId, buttonId, listId) {
    const input = document.getElementById(inputId);
    const button = document.getElementById(buttonId);
    const list = document.getElementById(listId);

    function addItem() {
      const value = input.value.trim();
      if (!value) return;
      const li = document.createElement("li");
      li.innerHTML = `<span></span><button class="icon-btn remove-item" title="Remove">✕</button>`;
      li.querySelector("span").textContent = value;
      li.querySelector(".remove-item").addEventListener("click", () => li.remove());
      list.appendChild(li);
      input.value = "";
      input.focus();
    }

    button.addEventListener("click", addItem);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") addItem();
    });
  }
  makeListAdder("known-input", "known-add", "known-list");
  makeListAdder("unknown-input", "unknown-add", "unknown-list");

  /* ---------------------------- 3. Belief Calibration ---------------------------- */
  const beliefRows = document.getElementById("belief-rows");

  document.getElementById("belief-add").addEventListener("click", () => {
    const beliefInput = document.getElementById("belief-input");
    const confInput = document.getElementById("belief-confidence");
    const belief = beliefInput.value.trim();
    const confidence = Math.max(0, Math.min(100, parseFloat(confInput.value) || 0));
    if (!belief) return;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(belief)}</td>
      <td>${confidence}%</td>
      <td><input type="text" placeholder="yes / no / how much" class="belief-bet" /></td>
      <td><input type="text" placeholder="What evidence backs this?" class="belief-evidence" /></td>
      <td><button class="icon-btn remove-row" title="Remove">✕</button></td>
    `;
    tr.querySelector(".remove-row").addEventListener("click", () => tr.remove());
    beliefRows.appendChild(tr);
    beliefInput.value = "";
    confInput.value = 70;
    beliefInput.focus();
  });

  /* ---------------------------- 4. Skill vs Luck Audit ---------------------------- */
  const slSlider = document.getElementById("sl-slider");
  const slReadout = document.getElementById("sl-readout");
  slSlider.addEventListener("input", () => {
    const skill = Number(slSlider.value);
    slReadout.textContent = `${100 - skill} luck / ${skill} skill`;
  });

  document.getElementById("sl-save").addEventListener("click", () => {
    const title = document.getElementById("sl-title").value.trim();
    if (!title) {
      alert("Describe the decision you're auditing before saving.");
      return;
    }
    addJournalEntry({
      type: "skillluck",
      title,
      value: Number(slSlider.value),
      skillNotes: document.getElementById("sl-skill-notes").value.trim(),
      luckNotes: document.getElementById("sl-luck-notes").value.trim(),
      mistakeNotes: document.getElementById("sl-mistake-notes").value.trim(),
    });
    alert("Saved to your Decision Journal.");
  });

  /* ---------------------------- init ---------------------------- */
  renderJournal();
})();
