// Decision Bets — plain JS, no build step.
// Decisions are stored in Azure (via /api/decisions) when the API is reachable,
// and fall back to this browser's localStorage otherwise.

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

/* ------------------------------ storage ------------------------------ */

const LOCAL_KEY = "decision-bets-v2";
const LOCAL_USER_KEY = "decision-bets-user";

// A stable per-person id so decisions follow you across sessions on this browser.
function userId() {
  let id = localStorage.getItem(LOCAL_USER_KEY);
  if (!id) {
    id = (crypto.randomUUID?.() || String(Date.now() + Math.random())).replace(/-/g, "").slice(0, 24);
    localStorage.setItem(LOCAL_USER_KEY, id);
  }
  return id;
}

const local = {
  read: () => {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_KEY)) || [];
    } catch {
      return [];
    }
  },
  write: (items) => localStorage.setItem(LOCAL_KEY, JSON.stringify(items)),
};

const store = {
  cloud: false,

  async init() {
    try {
      const res = await fetch(`/api/decisions?user=${userId()}`, { signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        this.cloud = true;
        return await res.json();
      }
    } catch {
      /* offline or no API — fall through to local */
    }
    return local.read();
  },

  async list() {
    if (!this.cloud) return local.read();
    const res = await fetch(`/api/decisions?user=${userId()}`);
    if (!res.ok) throw new Error("Could not load decisions");
    return res.json();
  },

  async save(decision) {
    if (!this.cloud) {
      const items = local.read();
      items.unshift(decision);
      local.write(items);
      return decision;
    }
    const res = await fetch(`/api/decisions?user=${userId()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(decision),
    });
    if (!res.ok) throw new Error("Could not save decision");
    return res.json();
  },

  async update(id, patch) {
    if (!this.cloud) {
      const items = local.read().map((d) => (d.id === id ? { ...d, ...patch } : d));
      local.write(items);
      return;
    }
    const res = await fetch(`/api/decisions/${id}?user=${userId()}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error("Could not update decision");
  },

  async remove(id) {
    if (!this.cloud) {
      local.write(local.read().filter((d) => d.id !== id));
      return;
    }
    const res = await fetch(`/api/decisions/${id}?user=${userId()}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Could not delete decision");
  },
};

/* ------------------------------ the bet form ------------------------------ */

const rows = $("rows");

function addRow(name = "", worth = "", odds = "") {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input type="text" class="c-name" placeholder="Best case" value="${esc(name)}" /></td>
    <td><input type="number" class="c-worth" placeholder="50000" value="${esc(worth)}" /></td>
    <td><input type="number" class="c-odds" min="0" max="100" placeholder="30" value="${esc(odds)}" /></td>
    <td class="ev">0</td>
    <td><button class="x" title="Remove">&times;</button></td>`;
  rows.appendChild(tr);
  tr.querySelectorAll("input").forEach((i) => i.addEventListener("input", recalc));
  tr.querySelector(".x").addEventListener("click", () => {
    tr.remove();
    recalc();
  });
}

function recalc() {
  let odds = 0;
  let ev = 0;
  [...rows.rows].forEach((tr) => {
    const w = parseFloat(tr.querySelector(".c-worth").value) || 0;
    const o = parseFloat(tr.querySelector(".c-odds").value) || 0;
    const cell = w * (o / 100);
    tr.querySelector(".ev").textContent = round(cell);
    odds += o;
    ev += cell;
  });
  $("total-odds").textContent = `${round(odds)}%`;
  $("total-ev").textContent = round(ev);
  $("odds-warn").hidden = rows.rows.length === 0 || Math.abs(odds - 100) < 0.01;
  return { odds, ev };
}

// Trims trailing zeros so the readout stays compact.
const round = (n) => (Math.round(n * 100) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 });

$("add-row").addEventListener("click", () => addRow());

$("save").addEventListener("click", async () => {
  const title = $("title").value.trim();
  const outcomes = [...rows.rows]
    .map((tr) => ({
      name: tr.querySelector(".c-name").value.trim(),
      worth: parseFloat(tr.querySelector(".c-worth").value) || 0,
      odds: parseFloat(tr.querySelector(".c-odds").value) || 0,
    }))
    .filter((o) => o.name || o.worth || o.odds);

  if (!title) return alert("Give the decision a title first.");
  if (!outcomes.length) return alert("Add at least one possible outcome.");

  const { odds, ev } = recalc();
  const btn = $("save");
  btn.disabled = true;
  btn.textContent = "Saving…";
  try {
    await store.save({
      id: crypto.randomUUID?.() || String(Date.now()),
      title,
      outcomes,
      totalOdds: odds,
      ev,
      premortem: $("premortem").value.trim(),
      createdAt: new Date().toISOString(),
    });
    resetForm();
    await render();
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Save decision";
  }
});

function resetForm() {
  $("title").value = "";
  $("premortem").value = "";
  rows.innerHTML = "";
  seedRows();
  recalc();
}

function seedRows() {
  addRow("Best case");
  addRow("Base case");
  addRow("Worst case");
}

/* ------------------------------ decision list ------------------------------ */

async function render() {
  let items = [];
  try {
    items = await store.list();
  } catch (err) {
    $("empty").textContent = err.message;
    $("empty").hidden = false;
    return;
  }

  items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const list = $("list");
  list.innerHTML = "";
  $("empty").hidden = items.length > 0;

  for (const d of items) {
    const el = document.createElement("div");
    el.className = "item";
    const lines = (d.outcomes || [])
      .map((o) => `${o.name || "—"}: ${round(o.worth)} at ${o.odds}%`)
      .join("\n");

    el.innerHTML = `
      <h3>${esc(d.title)}</h3>
      <div class="meta">EV ${round(d.ev || 0)} · ${new Date(d.createdAt).toLocaleDateString()}</div>
      <div class="body">${esc(lines)}${d.premortem ? `\n\nPre-mortem: ${esc(d.premortem)}` : ""}</div>
      ${
        d.review
          ? `<div class="verdict">
               <strong>${d.review.dial}% skill / ${100 - d.review.dial}% luck</strong>
               ${d.review.outcome ? `<br>${esc(d.review.outcome)}` : ""}
               ${d.review.lesson ? `<br><em>Next time: ${esc(d.review.lesson)}</em>` : ""}
             </div>`
          : ""
      }
      <div class="actions">
        <button class="link js-review">${d.review ? "Edit review" : "Record outcome"}</button>
        <button class="link js-del">Delete</button>
      </div>`;

    el.querySelector(".js-review").addEventListener("click", () => openReview(d));
    el.querySelector(".js-del").addEventListener("click", async () => {
      if (!confirm(`Delete "${d.title}"?`)) return;
      await store.remove(d.id);
      await render();
    });
    list.appendChild(el);
  }
}

/* ------------------------------ outcome review ------------------------------ */

const dlg = $("review");
let reviewing = null;

function openReview(d) {
  reviewing = d;
  $("review-title").textContent = d.title;
  $("outcome").value = d.review?.outcome || "";
  $("lesson").value = d.review?.lesson || "";
  $("dial").value = d.review?.dial ?? 50;
  updateDial();
  dlg.showModal();
}

function updateDial() {
  const skill = Number($("dial").value);
  $("dial-read").textContent = `${100 - skill} / ${skill}`;
}
$("dial").addEventListener("input", updateDial);

$("review-cancel").addEventListener("click", () => dlg.close());

$("review-save").addEventListener("click", async () => {
  const patch = {
    review: {
      outcome: $("outcome").value.trim(),
      lesson: $("lesson").value.trim(),
      dial: Number($("dial").value),
      reviewedAt: new Date().toISOString(),
    },
  };
  try {
    await store.update(reviewing.id, patch);
    dlg.close();
    await render();
  } catch (err) {
    alert(err.message);
  }
});

/* ------------------------------ boot ------------------------------ */

(async function boot() {
  seedRows();
  recalc();
  await store.init();
  const badge = $("storage-badge");
  badge.textContent = store.cloud ? "☁ saved to Azure" : "saved on this device";
  badge.classList.toggle("cloud", store.cloud);
  await render();
})();
