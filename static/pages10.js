/* ============ pages10: Services Studio — agency catalogue + proposal builder ============ */
"use strict";

let SVC_STATE = { items: [], filtered: [], selected: new Map(), platform: "", category: "", q: "" };

const CAT_COLORS = {
  Profile: "purple", Content: "cyan", Discovery: "cyan", Trends: "purple", Video: "gray",
  Media: "gray", Writing: "cyan", LIVE: "red", Collaboration: "purple", Monetization: "green",
  Advertising: "purple", Community: "cyan", Engagement: "cyan", Repurposing: "gray",
  "Owned channels": "green", Compliance: "red", Pricing: "green", Products: "green",
  Rights: "gray", Accessibility: "cyan", Risk: "red", Analytics: "gray", Local: "green", Commerce: "green",
};

function svcMoney(n) { return "$" + Math.round(n || 0).toLocaleString(); }

ROUTES.services = {
  title: "Services Studio",
  subtitle: "Everything a professional can sell for a social account — pick services, build a client proposal.",
  async render(page) {
    refreshCurrentList = () => ROUTES.services.render(document.getElementById("page"));
    page.innerHTML = `
      <div class="grid cols-4" id="sv-stats">${Array(4).fill('<div class="card"><div class="skel skel-line" style="width:50%"></div><div class="skel" style="height:26px;width:60%;margin-top:10px"></div></div>').join("")}</div>
      <div class="card" style="margin-top:14px">
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
          <input class="input" id="sv-q" placeholder="Search services…" style="max-width:240px">
          <select class="input" id="sv-plat" style="width:auto"><option value="">All platforms</option></select>
          <select class="input" id="sv-cat" style="width:auto"><option value="">All categories</option></select>
          <span style="flex:1"></span>
          <span class="muted" id="sv-count" style="font-size:12.5px"></span>
        </div>
      </div>
      <div class="card" style="margin-top:14px;padding:0;overflow:hidden">
        <div id="sv-table">${skeletonTable(8)}</div>
      </div>
      <div id="sv-bar" style="position:sticky;bottom:14px;display:none">
        <div class="card" style="display:flex;align-items:center;gap:12px;box-shadow:0 10px 30px rgba(0,0,0,.45);border-color:rgba(139,92,246,.5)">
          <b id="sv-bar-count" style="font-size:13.5px"></b>
          <span class="muted" style="font-size:12.5px">services selected</span>
          <span style="flex:1"></span>
          <button class="btn" id="sv-clear">Clear</button>
          <button class="btn primary" id="sv-build">${icon("file", 14)} Build client proposal</button>
        </div>
      </div>`;

    let data;
    try { data = await api("/api/services"); }
    catch (e) { toast(e.message, { type: "error" }); return; }
    SVC_STATE.items = data.items;

    const plat = document.getElementById("sv-plat");
    data.platforms.forEach(p => plat.insertAdjacentHTML("beforeend", `<option>${esc(p)}</option>`));
    const cat = document.getElementById("sv-cat");
    data.categories.forEach(c => cat.insertAdjacentHTML("beforeend", `<option>${esc(c)}</option>`));

    const stats = [
      { label: "Sellable services", value: data.items.length, ico: "briefcase", sub: "in the catalogue" },
      { label: "Platforms covered", value: data.platforms.length, ico: "globe", sub: "incl. cross-platform" },
      { label: "Service categories", value: data.categories.length, ico: "target", sub: "profile → monetization" },
      { label: "Selected", value: "0", ico: "check", sub: "pick any to propose", id: "sv-stat-sel" },
    ];
    document.getElementById("sv-stats").innerHTML = stats.map(st => `
      <div class="card stat-card fade-in">
        <div class="stat-top"><span class="stat-label">${icon(st.ico, 15)} ${st.label}</span></div>
        <div class="stat-value" style="font-size:24px" ${st.id ? `id="${st.id}"` : ""}>${st.value}</div>
        <div class="muted" style="font-size:12px;margin-top:3px">${st.sub}</div>
      </div>`).join("");

    document.getElementById("sv-q").oninput = e => { SVC_STATE.q = e.target.value.toLowerCase(); applySvcFilters(); };
    plat.onchange = e => { SVC_STATE.platform = e.target.value; applySvcFilters(); };
    cat.onchange = e => { SVC_STATE.category = e.target.value; applySvcFilters(); };
    document.getElementById("sv-clear").onclick = () => { SVC_STATE.selected.clear(); applySvcFilters(); };
    document.getElementById("sv-build").onclick = openProposalModal;
    applySvcFilters();
  },
};

function applySvcFilters() {
  const { items, platform, category, q } = SVC_STATE;
  SVC_STATE.filtered = items.filter(it =>
    (!platform || it.platform === platform) &&
    (!category || it.category === category) &&
    (!q || (it.service + " " + it.ai + " " + it.platform + " " + it.category).toLowerCase().includes(q)));
  renderSvcTable();
  updateSvcBar();
}

function renderSvcTable() {
  const box = document.getElementById("sv-table");
  const rows = SVC_STATE.filtered;
  document.getElementById("sv-count").textContent = `${rows.length} service${rows.length === 1 ? "" : "s"}`;
  if (!rows.length) {
    box.innerHTML = emptyState({ icon: "briefcase", title: "No services match", message: "Try a different platform, category or search term." });
    return;
  }
  box.innerHTML = `<table class="table"><thead><tr>
      <th style="width:36px"></th><th>Service</th><th>Platform</th><th>Category</th><th>Who does what</th><th>Type</th><th>Eligibility</th>
    </tr></thead><tbody>
    ${rows.map(it => {
      const sel = SVC_STATE.selected.has(it.id);
      return `<tr data-svc="${it.id}" style="${sel ? "background:rgba(139,92,246,.08)" : ""}">
        <td><input type="checkbox" data-check ${sel ? "checked" : ""} style="width:16px;height:16px;cursor:pointer"></td>
        <td><b>${esc(it.service)}</b><br><span class="faint" style="font-size:11px">AI: ${esc(it.ai)}</span></td>
        <td><span class="badge ${CAT_COLORS[it.category] || "gray"}" style="white-space:nowrap">${esc(it.platform)}</span></td>
        <td class="muted" style="font-size:12.5px">${esc(it.category)}</td>
        <td class="faint" style="font-size:11.5px;max-width:210px">${esc(it.human)}</td>
        <td><span class="badge ${it.ntp.startsWith("Native") ? "green" : it.ntp.includes("3P") ? "cyan" : "gray"}">${esc(it.ntp)}</span></td>
        <td class="faint" style="font-size:11.5px;max-width:150px">${esc(it.eligibility)}</td>
      </tr>`;
    }).join("")}
    </tbody></table>`;
  box.querySelectorAll("tr[data-svc]").forEach(tr => {
    const id = tr.dataset.svc;
    const cb = tr.querySelector("[data-check]");
    cb.onchange = () => {
      if (cb.checked) SVC_STATE.selected.set(id, { price: SVC_STATE.selected.get(id)?.price ?? "" });
      else SVC_STATE.selected.delete(id);
      tr.style.background = cb.checked ? "rgba(139,92,246,.08)" : "";
      updateSvcBar();
    };
  });
}

function updateSvcBar() {
  const n = SVC_STATE.selected.size;
  const bar = document.getElementById("sv-bar");
  const statSel = document.getElementById("sv-stat-sel");
  if (statSel) statSel.textContent = String(n);
  if (!bar) return;
  bar.style.display = n ? "block" : "none";
  const c = document.getElementById("sv-bar-count");
  if (c) c.textContent = String(n);
}

function openProposalModal() {
  const picked = [...SVC_STATE.selected.entries()].map(([id, v]) => {
    const it = SVC_STATE.items.find(x => x.id === id);
    return it ? { ...it, price: v.price || "" } : null;
  }).filter(Boolean);
  if (!picked.length) { toast("Select at least one service first", { type: "info" }); return; }
  const m = openModal({
    title: "Build client proposal",
    wide: true,
    body: `
      <div class="grid cols-2" style="gap:12px">
        <div class="field"><label>Client name</label><input class="input" id="pr-client" placeholder="e.g. Brewline Coffee"></div>
        <div class="field"><label>Currency symbol</label><select class="input" id="pr-cur">
          <option>$</option><option>€</option><option>£</option><option>₹</option></select></div>
      </div>
      <div class="card-sub" style="margin-bottom:6px">Set your own prices (leave blank for TBD). Prices are never invented for you.</div>
      <div style="display:flex;flex-direction:column;gap:8px;max-height:260px;overflow:auto;padding-right:4px">
        ${picked.map((p, i) => `
          <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--panel-2);border:1px solid var(--border);border-radius:10px">
            <span style="flex:1;font-size:13px"><b>${esc(p.service)}</b> <span class="faint">· ${esc(p.platform)}</span></span>
            <input class="input" data-price="${esc(p.id)}" type="number" min="0" placeholder="price" value="${esc(String(p.price))}" style="width:110px;padding:6px 8px;font-size:13px">
          </div>`).join("")}
      </div>
      <div class="field" style="margin-top:12px"><label>Notes (optional)</label><textarea class="input" id="pr-notes" rows="2" placeholder="Timeline, payment terms, anything the client should know…"></textarea></div>
      <div id="pr-result" style="display:none"></div>`,
    foot: `<button class="btn" data-close>Close</button><button class="btn primary" id="pr-go">${icon("file", 14)} Generate proposal</button>`,
  });
  m.el.querySelector("#pr-go").onclick = async () => {
    const client = m.el.querySelector("#pr-client").value.trim();
    if (!client) { toast("Give the proposal a client name", { type: "info" }); return; }
    const items = picked.map(p => ({ id: p.id, price: m.el.querySelector(`[data-price="${CSS.escape(p.id)}"]`)?.value ?? p.price }));
    const btn = m.el.querySelector("#pr-go");
    buttonLoading(btn, true);
    try {
      const res = await api("/api/proposal", { method: "POST", body: {
        client, currency: m.el.querySelector("#pr-cur").value,
        notes: m.el.querySelector("#pr-notes").value.trim(), items } });
      const box = m.el.querySelector("#pr-result");
      box.style.display = "block";
      box.innerHTML = `
        <div class="card" style="margin-top:14px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
            <b style="font-size:14px">Proposal ready — ${res.count} services${res.priced ? ` · total ${svcMoney(res.total)}` : ""}</b>
          </div>
          <pre style="white-space:pre-wrap;font-family:inherit;font-size:12.5px;line-height:1.65;background:var(--panel-2);border:1px solid var(--border);border-radius:10px;padding:14px;margin:0;max-height:300px;overflow:auto">${esc(res.text)}</pre>
          <div style="display:flex;gap:8px;margin-top:10px">
            <button class="btn sm primary" id="pr-copy">${icon("copy", 12)} Copy text</button>
            <button class="btn sm" id="pr-html">${icon("file", 12)} Download HTML</button>
          </div>
        </div>`;
      box.querySelector("#pr-copy").onclick = () => copyText(res.text, "Proposal");
      box.querySelector("#pr-html").onclick = () => downloadProposalHTML(res);
      btn.style.display = "none";
    } catch (e) { toast(e.message, { type: "error" }); buttonLoading(btn, false); }
  };
}

function downloadProposalHTML(res) {
  const rows = res.lines.map((l, i) => `
    <tr><td>${i + 1}</td><td><b>${esc(l.service)}</b><br><span class="sub">${esc(l.platform)} · ${esc(l.category)}</span></td>
    <td class="sub">AI: ${esc(l.ai)}<br>You deliver: ${esc(l.human)}<br>Eligibility: ${esc(l.eligibility)}</td>
    <td class="price">${l.price}</td></tr>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Proposal — ${esc(res.client)}</title>
<style>body{font-family:Segoe UI,Arial,sans-serif;background:#0a0c12;color:#e8eaf2;max-width:820px;margin:32px auto;padding:0 22px}
h1{background:linear-gradient(90deg,#8b5cf6,#d946ef);-webkit-background-clip:text;background-clip:text;color:transparent;margin:6px 0 2px}
.sub{color:#9aa1b5;font-size:12px}.head{margin-bottom:18px}
table{width:100%;border-collapse:collapse;font-size:13.5px}td,th{padding:10px;border-bottom:1px solid #232736;text-align:left;vertical-align:top}
th{color:#9aa1b5;font-size:11px;text-transform:uppercase;letter-spacing:.6px}.price{font-weight:700;white-space:nowrap}
.total{font-size:18px;font-weight:800;margin:16px 0;color:#34d399}.notes{color:#9aa1b5;font-size:13px;line-height:1.6}
ol{line-height:1.8;font-size:13.5px}.foot{color:#6b7280;font-size:11px;margin-top:26px}</style></head><body>
<div class="head"><h1>Service Proposal — ${esc(res.client)}</h1><div class="sub">${res.count} services${res.priced ? "" : " · pricing TBD"}</div></div>
<table><thead><tr><th>#</th><th>Service</th><th>Division of work</th><th>Price</th></tr></thead><tbody>${rows}</tbody></table>
${res.priced ? `<div class="total">Total: ${svcMoney(res.total)}${res.priced < res.count ? " (some items TBD)" : ""}</div>` : ""}
<h2 style="font-size:13px;letter-spacing:.8px;text-transform:uppercase;color:#9aa1b5">Process</h2>
<ol><li>Kickoff &amp; access</li><li>Audit &amp; strategy</li><li>Production &amp; approvals</li><li>Publish &amp; optimize</li><li>Report</li></ol>
<div class="foot">Generated with Lumina — AI Social Media Suite</div>
</body></html>`;
  const blob = new Blob([html], { type: "text/html" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `proposal-${res.client.replace(/[^\w-]+/g, "-").toLowerCase()}.html`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast("Proposal downloaded");
}
