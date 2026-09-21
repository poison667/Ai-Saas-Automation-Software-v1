/* ============ pages9: Revenue — deals pipeline, income tracking, rate card ============ */
"use strict";

const DEAL_TYPES = ["sponsorship", "affiliate", "product", "service", "other"];
const DEAL_STATUSES = ["lead", "negotiating", "won", "lost"];
const STATUS_BADGE = { lead: "gray", negotiating: "purple", won: "green", lost: "red" };

function fmtMoney(n) {
  return "$" + Math.round(n || 0).toLocaleString();
}

function revenueBars(months) {
  const w = 560, h = 150, pad = 24;
  const max = Math.max(...months.map(m => m.value), 100);
  const bw = (w - pad * 2) / months.length;
  const bars = months.map((m, i) => {
    const bh = Math.max(3, (m.value / max) * (h - 46));
    const x = pad + i * bw + bw * 0.18, y = h - 24 - bh;
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(bw * 0.64).toFixed(1)}" height="${bh.toFixed(1)}" rx="5"
        fill="${m.value ? "url(#revGrad)" : "var(--panel-3)"}">
        <title>${m.label}: ${fmtMoney(m.value)}</title></rect>
      <text x="${(x + bw * 0.32).toFixed(1)}" y="${h - 8}" text-anchor="middle" font-size="10.5" fill="var(--faint)">${m.label}</text>
      ${m.value ? `<text x="${(x + bw * 0.32).toFixed(1)}" y="${(y - 5).toFixed(1)}" text-anchor="middle" font-size="10" fill="var(--muted)">${fmtMoney(m.value)}</text>` : ""}`;
  }).join("");
  return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;display:block">
    <defs><linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#d946ef"/><stop offset="100%" stop-color="#8b5cf6"/></linearGradient></defs>
    ${bars}</svg>`;
}

ROUTES.revenue = {
  title: "Revenue",
  subtitle: "Track deals, income and what to charge brands.",
  async render(page) {
    refreshCurrentList = () => ROUTES.revenue.render(document.getElementById("page"));
    page.innerHTML = `
      <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap">
        <button class="btn primary" id="rv-new" data-perm="create">${icon("plus", 15)} Log a deal</button>
        <button class="btn" id="rv-ratecard">${icon("award", 15)} My rate card</button>
      </div>
      <div class="grid cols-4" id="rv-stats">${Array(4).fill('<div class="card"><div class="skel skel-line" style="width:50%"></div><div class="skel" style="height:26px;width:60%;margin-top:10px"></div></div>').join("")}</div>
      <div class="dash-layout">
        <div class="stack">
          <div class="card"><h3>Won revenue — last 6 months</h3><div id="rv-chart"><div class="skel skel-block" style="height:150px"></div></div></div>
          <div class="card" style="padding:0;overflow:hidden">
            <div style="padding:16px 16px 10px"><h3 style="margin:0">Deals & income</h3>
              <div class="card-sub">Everything from sponsorships to affiliate checks.</div></div>
            <div id="rv-deals">${skeletonTable(5)}</div>
          </div>
        </div>
        <div class="stack">
          <div class="card"><h3>Pipeline</h3><div class="card-sub">Open deals by stage</div><div id="rv-pipe"><div class="skel skel-block" style="height:120px"></div></div></div>
          <div class="card"><h3>${icon("award", 15)} Pricing snapshot</h3><div class="card-sub">From your rate card</div><div id="rv-snap"><div class="skel skel-block" style="height:140px"></div></div></div>
        </div>
      </div>`;
    document.getElementById("rv-new").onclick = () => openDealModal();
    document.getElementById("rv-ratecard").onclick = openRateCardModal;

    let deals, summary;
    try {
      [deals, summary] = await Promise.all([api("/api/deals"), api("/api/deals/summary")]);
    } catch (e) { toast(e.message, { type: "error" }); return; }
    renderRevenue(deals, summary);
    api("/api/rate-card").then(renderRateSnapshot).catch(() => {});
  },
};

function renderRevenue(deals, s) {
  const stats = [
    { label: "Won this month", value: fmtMoney(s.won_month), ico: "dollar", color: "#34d399", bg: "rgba(52,211,153,.12)", sub: `${fmtMoney(s.won_year)} year to date` },
    { label: "Pipeline value", value: fmtMoney(s.pipeline), ico: "briefcase", color: "#c4b5fd", bg: "rgba(139,92,246,.14)", sub: `${s.open} open deal${s.open === 1 ? "" : "s"}` },
    { label: "Win rate", value: s.win_rate + "%", ico: "award", color: "#93c5fd", bg: "rgba(96,165,250,.13)", sub: "won vs closed deals" },
    { label: "Avg deal size", value: fmtMoney(s.avg_deal), ico: "trendUp", color: "#fcd34d", bg: "rgba(251,191,36,.12)", sub: "across won deals" },
  ];
  document.getElementById("rv-stats").innerHTML = stats.map(st => `
    <div class="card stat-card fade-in">
      <div class="stat-top"><span class="stat-label">${icon(st.ico, 15)} ${st.label}</span></div>
      <div class="stat-value" style="font-size:24px">${st.value}</div>
      <div class="muted" style="font-size:12px;margin-top:3px">${st.sub}</div>
    </div>`).join("");

  document.getElementById("rv-chart").innerHTML = revenueBars(s.months);

  // pipeline
  const pipe = { lead: [], negotiating: [] };
  deals.filter(d => pipe[d.status]).forEach(d => pipe[d.status].push(d));
  document.getElementById("rv-pipe").innerHTML = ["lead", "negotiating"].map(k => `
    <div style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:5px">
        <span class="muted">${k === "lead" ? "Leads" : "Negotiating"}</span>
        <b>${fmtMoney(pipe[k].reduce((a, d) => a + d.amount, 0))} · ${pipe[k].length}</b>
      </div>
      <div class="progress"><div class="bar" style="width:${Math.min(100, pipe[k].reduce((a, d) => a + d.amount, 0) / Math.max(1, s.pipeline) * 100)}%;background:${k === "lead" ? "var(--border-strong)" : "var(--grad)"}"></div></div>
    </div>`).join("") +
    (s.pipeline === 0 ? `<p class="muted" style="font-size:12.5px">No open deals — log a lead to start the pipeline.</p>` : "");

  // deals table
  const box = document.getElementById("rv-deals");
  if (!deals.length) {
    box.innerHTML = emptyState({ icon: "dollar", title: "No deals yet", message: "Log your first sponsorship, affiliate check or product sale.", actionLabel: "Log a deal", actionId: "rv-empty-new" });
    const b = document.getElementById("rv-empty-new"); if (b) b.onclick = () => openDealModal();
    return;
  }
  box.innerHTML = `<table class="table"><thead><tr>
      <th>Brand / source</th><th>Type</th><th>Platform</th><th>Amount</th><th>Status</th><th>Date</th><th></th>
    </tr></thead><tbody>
    ${deals.map(d => `
      <tr data-deal="${d.id}">
        <td><b>${esc(d.brand)}</b>${d.notes ? `<br><span class="faint" style="font-size:11px">${esc(d.notes.slice(0, 60))}${d.notes.length > 60 ? "…" : ""}</span>` : ""}</td>
        <td><span class="badge ${d.type === "sponsorship" ? "purple" : d.type === "affiliate" ? "cyan" : "gray"}">${d.type}</span></td>
        <td>${platIcon(d.platform, 11)} ${PLATFORMS[d.platform]?.name || d.platform}</td>
        <td style="font-weight:700;color:${d.status === "won" ? "#34d399" : "var(--text)"}">${fmtMoney(d.amount)}</td>
        <td><select class="input" data-status style="padding:5px 8px;font-size:12px;width:auto">
          ${DEAL_STATUSES.map(st => `<option ${st === d.status ? "selected" : ""}>${st}</option>`).join("")}</select></td>
        <td class="faint" style="font-size:12px;white-space:nowrap">${d.deal_date}</td>
        <td style="text-align:right"><button class="icon-btn" data-edit title="Edit">${icon("edit", 14)}</button><button class="icon-btn danger" data-del title="Delete">${icon("trash", 14)}</button></td>
      </tr>`).join("")}
    </tbody></table>`;
  box.querySelectorAll("tr[data-deal]").forEach(tr => {
    const d = deals.find(x => x.id === +tr.dataset.deal);
    tr.querySelector("[data-status]").onchange = async e => {
      try {
        await api(`/api/deals/${d.id}`, { method: "PATCH", body: { status: e.target.value } });
        toast(e.target.value === "won" ? `Marked won — ${fmtMoney(d.amount)} in the bag 🎉` : `Deal moved to ${e.target.value}`, { type: e.target.value === "lost" ? "info" : "success" });
        refreshCurrentList();
      } catch (err) { toast(err.message, { type: "error" }); }
    };
    tr.querySelector("[data-edit]").onclick = () => openDealModal(d);
    tr.querySelector("[data-del]").onclick = async () => {
      const ok = await confirmModal({ title: "Delete deal", message: `Delete the ${d.brand} deal (${fmtMoney(d.amount)})?` });
      if (!ok) return;
      await api(`/api/deals/${d.id}`, { method: "DELETE" });
      toast("Deal deleted", { type: "info" });
      refreshCurrentList();
    };
  });
}

function renderRateSnapshot(rc) {
  const el = document.getElementById("rv-snap");
  if (!el) return;
  if (!rc.platforms.length) {
    el.innerHTML = `<p class="muted" style="font-size:12.5px">Connect an account and your rate card prices itself from real follower and engagement data.</p>`;
    return;
  }
  const top = rc.platforms[0];
  el.innerHTML = `
    <div style="font-size:12.5px" class="muted" >${fmtMoney(rc.followers ? rc.followers : 0)} followers · ${rc.engagement}% engagement · ×${rc.engagement_multiplier} engagement multiplier</div>
    <div style="display:flex;flex-direction:column;gap:7px;margin-top:10px">
      ${Object.entries(top.prices).map(([k, v]) => `
        <div style="display:flex;justify-content:space-between;font-size:12.5px;padding:6px 0;border-bottom:1px solid var(--border)">
          <span class="muted">${{ post: "Single post", story: "Story set", video: "Video / reel", bundle: "Monthly bundle" }[k]}</span><b>${fmtMoney(v)}</b>
        </div>`).join("")}
    </div>
    <p class="faint" style="font-size:11px;margin-top:10px">Top platform: ${PLATFORMS[top.platform]?.name || top.platform} (${top.handle})</p>`;
}

function openDealModal(deal) {
  const d = deal || {};
  const m = openModal({
    title: deal ? "Edit deal" : "Log a deal",
    body: `
      <div class="field"><label>Brand / source</label><input class="input" id="dl-brand" value="${esc(d.brand || "")}" placeholder="e.g. Brewline Coffee"></div>
      <div class="grid cols-2" style="gap:12px">
        <div class="field"><label>Type</label><select class="input" id="dl-type">
          ${DEAL_TYPES.map(t => `<option ${t === (d.type || "sponsorship") ? "selected" : ""}>${t}</option>`).join("")}</select></div>
        <div class="field"><label>Platform</label><select class="input" id="dl-plat">
          ${Object.entries(PLATFORMS).map(([k, v]) => `<option value="${k}" ${k === (d.platform || "instagram") ? "selected" : ""}>${v.name}</option>`).join("")}</select></div>
        <div class="field"><label>Amount ($)</label><input class="input" id="dl-amount" type="number" min="0" value="${d.amount || ""}" placeholder="450"></div>
        <div class="field"><label>Status</label><select class="input" id="dl-status">
          ${DEAL_STATUSES.map(st => `<option ${st === (d.status || "lead") ? "selected" : ""}>${st}</option>`).join("")}</select></div>
      </div>
      <div class="field"><label>Date</label><input class="input" id="dl-date" type="date" value="${d.deal_date || new Date().toISOString().slice(0, 10)}"></div>
      <div class="field"><label>Notes</label><textarea class="input" id="dl-notes" rows="2" placeholder="Deliverables, usage rights, contact…">${esc(d.notes || "")}</textarea></div>`,
    foot: `<button class="btn" data-close>Cancel</button><button class="btn primary" id="dl-save">${icon("check", 14)} ${deal ? "Save deal" : "Add deal"}</button>`,
  });
  m.el.querySelector("#dl-save").onclick = async () => {
    const body = {
      brand: m.el.querySelector("#dl-brand").value.trim(),
      type: m.el.querySelector("#dl-type").value,
      platform: m.el.querySelector("#dl-plat").value,
      amount: +m.el.querySelector("#dl-amount").value || 0,
      status: m.el.querySelector("#dl-status").value,
      deal_date: m.el.querySelector("#dl-date").value,
      notes: m.el.querySelector("#dl-notes").value.trim(),
    };
    if (!body.brand) { toast("Give the deal a brand or source", { type: "info" }); return; }
    buttonLoading(m.el.querySelector("#dl-save"), true);
    try {
      if (deal) await api(`/api/deals/${deal.id}`, { method: "PATCH", body });
      else await api("/api/deals", { method: "POST", body });
      m.close();
      toast(deal ? "Deal updated" : "Deal logged 💼");
      refreshCurrentList();
    } catch (e) { toast(e.message, { type: "error" }); buttonLoading(m.el.querySelector("#dl-save"), false); }
  };
}

/* ---------------- media kit studio ---------------- */

ROUTES.mediakit = {
  title: "Media Kit",
  subtitle: "Your one-page pitch to brands — built from live data.",
  async render(page) {
    refreshCurrentList = () => ROUTES.mediakit.render(document.getElementById("page"));
    page.innerHTML = `
      <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap">
        <button class="btn primary" id="mk-copy">${icon("copy", 15)} Copy as text</button>
        <button class="btn" id="mk-download">${icon("file", 15)} Download HTML</button>
      </div>
      <div id="mk-preview"><div class="card"><div class="skel skel-block" style="height:380px"></div></div></div>`;
    let mk, rc;
    try { [mk, rc] = await Promise.all([api("/api/media-kit"), api("/api/rate-card")]); }
    catch (e) { toast(e.message, { type: "error" }); return; }
    renderMediaKit(mk, rc);
    document.getElementById("mk-copy").onclick = () => copyText(mediaKitText(mk, rc), "Media kit");
    document.getElementById("mk-download").onclick = () => downloadMediaKit(mk, rc);
  },
};

function fmtK(n) {
  n = n || 0;
  return n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1000 ? (n / 1000).toFixed(1) + "K" : String(Math.round(n));
}

function mediaKitText(mk, rc) {
  let t = `${mk.workspace} — Media Kit\n`;
  t += `${mk.followers.toLocaleString()} total followers · ${mk.engagement}% engagement · ${fmtK(mk.reach30)} reach (30 days)\n\n`;
  t += "PLATFORMS\n";
  mk.platforms.forEach(p => t += `• ${PLATFORMS[p.platform]?.name || p.platform} — ${p.handle}: ${p.followers.toLocaleString()} followers, ${p.engagement}% engagement\n`);
  if (rc.platforms.length) {
    t += "\nRATES\n";
    rc.platforms.forEach(p => t += `${PLATFORMS[p.platform]?.name || p.platform}: post $${p.prices.post} · story $${p.prices.story} · video $${p.prices.video} · bundle $${p.prices.bundle}\n`);
    t += "\n" + rc.notes.map(n => "• " + n).join("\n") + "\n";
  }
  if (mk.brands_worked_with.length) t += `\nWORKED WITH\n${mk.brands_worked_with.join(" · ")}\n`;
  return t;
}

function renderMediaKit(mk, rc) {
  const el = document.getElementById("mk-preview");
  const stats = [
    ["Total followers", mk.followers.toLocaleString()], ["Engagement", mk.engagement + "%"],
    ["Reach · 30 days", fmtK(mk.reach30)], ["Audience growth", (mk.growth >= 0 ? "+" : "") + mk.growth + "%"],
  ];
  el.innerHTML = `
  <div class="card fade-in" style="max-width:760px;margin:0 auto;border-color:rgba(139,92,246,.4)">
    <div style="text-align:center;padding:10px 0 18px;border-bottom:1px solid var(--border)">
      <div style="width:64px;height:64px;border-radius:18px;background:var(--grad);display:inline-flex;align-items:center;justify-content:center;font-size:26px;font-weight:800;color:#fff">${esc(mk.workspace.charAt(0))}</div>
      <h2 style="margin:10px 0 2px" class="grad-text">${esc(mk.workspace)}</h2>
      <div class="faint" style="font-size:12.5px">Creator media kit · ${mk.platforms.length} platform${mk.platforms.length === 1 ? "" : "s"} · ${mk.deals_won} collaboration${mk.deals_won === 1 ? "" : "s"} completed</div>
    </div>
    <div class="grid cols-4" style="gap:10px;margin:18px 0">
      ${stats.map(([l, v]) => `<div class="card" style="margin:0;padding:12px;text-align:center"><div class="faint" style="font-size:10.5px">${l}</div><b style="font-size:17px">${v}</b></div>`).join("")}
    </div>
    ${mk.platforms.length ? `
    <h3 style="font-size:13px;letter-spacing:.4px;text-transform:uppercase" class="faint">Audience by platform</h3>
    <div style="display:flex;flex-direction:column;gap:8px;margin:10px 0 18px">
      ${mk.platforms.map(p => `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--panel-2);border:1px solid var(--border);border-radius:10px">
          ${platIcon(p.platform, 13)} <b style="font-size:13px">${esc(p.display_name || p.handle)}</b>
          <span class="faint" style="font-size:12px">${esc(p.handle)}</span><span style="flex:1"></span>
          <b style="font-size:13px">${p.followers.toLocaleString()}</b>
          <span class="badge cyan">${p.engagement}% eng</span>
        </div>`).join("")}
    </div>` : ""}
    ${rc.platforms.length ? `
    <h3 style="font-size:13px;letter-spacing:.4px;text-transform:uppercase" class="faint">Rates</h3>
    <div style="overflow-x:auto;margin:10px 0 18px">
      <table class="table" style="margin:0"><thead><tr><th>Platform</th><th>Post</th><th>Story set</th><th>Video</th><th>Bundle</th></tr></thead><tbody>
        ${rc.platforms.map(p => `<tr><td>${platIcon(p.platform, 11)} ${PLATFORMS[p.platform]?.name || p.platform}</td>
          <td><b>$${p.prices.post}</b></td><td>$${p.prices.story}</td><td>$${p.prices.video}</td><td>$${p.prices.bundle}</td></tr>`).join("")}
      </tbody></table>
    </div>` : ""}
    ${mk.brands_worked_with.length ? `
    <h3 style="font-size:13px;letter-spacing:.4px;text-transform:uppercase" class="faint">Brands worked with</h3>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
      ${mk.brands_worked_with.map(b => `<span class="badge purple">${esc(b)}</span>`).join("")}
    </div>` : ""}
    <p class="faint" style="font-size:11px;margin-top:18px">Generated by Lumina · figures update automatically from connected accounts</p>
  </div>`;
}

function downloadMediaKit(mk, rc) {
  const rows = rc.platforms.map(p => `
      <tr><td>${PLATFORMS[p.platform]?.name || p.platform}</td><td>$${p.prices.post}</td><td>$${p.prices.story}</td><td>$${p.prices.video}</td><td>$${p.prices.bundle}</td></tr>`).join("");
  const plats = mk.platforms.map(p => `
      <div class="row"><b>${PLATFORMS[p.platform]?.name || p.platform}</b> — ${p.handle} · ${p.followers.toLocaleString()} followers · ${p.engagement}% engagement</div>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(mk.workspace)} — Media Kit</title>
<style>body{font-family:Segoe UI,Arial,sans-serif;background:#0a0c12;color:#e8eaf2;max-width:720px;margin:32px auto;padding:0 20px}
h1{background:linear-gradient(90deg,#8b5cf6,#d946ef);-webkit-background-clip:text;background-clip:text;color:transparent;margin:8px 0 2px}
.sub{color:#9aa1b5;font-size:13px}.stats{display:flex;gap:12px;margin:22px 0;flex-wrap:wrap}
.stat{flex:1;min-width:140px;background:#11141d;border:1px solid #232736;border-radius:12px;padding:14px;text-align:center}
.stat b{font-size:20px;display:block}.stat span{color:#9aa1b5;font-size:11px}
h2{font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#9aa1b5;border-bottom:1px solid #232736;padding-bottom:6px}
table{width:100%;border-collapse:collapse;font-size:14px}td,th{padding:8px 10px;border-bottom:1px solid #232736;text-align:left}
.row{padding:6px 0;font-size:14px}.badges span{display:inline-block;background:#8b5cf622;border:1px solid #8b5cf666;color:#c4b5fd;border-radius:20px;padding:4px 12px;margin:4px 6px 0 0;font-size:12px}
.foot{color:#6b7280;font-size:11px;margin-top:26px}</style></head><body>
<h1>${esc(mk.workspace)}</h1>
<div class="sub">Creator media kit · ${mk.followers.toLocaleString()} followers · ${mk.engagement}% engagement · ${fmtK(mk.reach30)} reach in the last 30 days</div>
<div class="stats">
  <div class="stat"><b>${mk.followers.toLocaleString()}</b><span>Total followers</span></div>
  <div class="stat"><b>${mk.engagement}%</b><span>Engagement rate</span></div>
  <div class="stat"><b>${fmtK(mk.reach30)}</b><span>Reach · 30 days</span></div>
  <div class="stat"><b>${(mk.growth >= 0 ? "+" : "") + mk.growth}%</b><span>Audience growth</span></div>
</div>
<h2>Audience by platform</h2>${plats || "<div class='row'>No connected platforms yet.</div>"}
${rc.platforms.length ? `<h2>Rates</h2><table><tr><th>Platform</th><th>Post</th><th>Story set</th><th>Video</th><th>Bundle</th></tr>${rows}</table>
<p style="font-size:12px;color:#9aa1b5">${rc.notes.map(n => "• " + esc(n)).join("<br>")}</p>` : ""}
${mk.brands_worked_with.length ? `<h2>Brands worked with</h2><div class="badges">${mk.brands_worked_with.map(b => `<span>${esc(b)}</span>`).join("")}</div>` : ""}
<div class="foot">Generated by Lumina — figures update automatically from connected accounts.</div>
</body></html>`;
  const blob = new Blob([html], { type: "text/html" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${mk.workspace.replace(/[^\w-]+/g, "-").toLowerCase()}-media-kit.html`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast("Media kit downloaded — open it or attach it to your pitch");
}

async function openRateCardModal() {
  const m = openModal({
    title: "Your rate card",
    wide: true,
    body: `<div id="rc-body"><div class="thinking" style="padding:26px 0"><div class="t-line"><span class="spin"></span>Crunching your audience value…</div></div></div>`,
    foot: `<button class="btn" data-close>Close</button><button class="btn primary" id="rc-copy" disabled>${icon("copy", 14)} Copy as text</button>`,
  });
  let rc;
  try { rc = await api("/api/rate-card"); } catch (e) {
    m.el.querySelector("#rc-body").innerHTML = `<div class="empty">${esc(e.message)}</div>`; return;
  }
  const labels = { post: "Single post", story: "Story set", video: "Video / reel", bundle: "Monthly bundle" };
  let text = `${rc.workspace} — Rate Card\nAudience: ${rc.followers.toLocaleString()} followers · ${rc.engagement}% engagement\n\n`;
  rc.platforms.forEach(p => {
    text += `${(PLATFORMS[p.platform]?.name || p.platform)} (${p.handle})\n` +
      Object.entries(p.prices).map(([k, v]) => `  ${labels[k]}: $${v}`).join("\n") + "\n\n";
  });
  text += rc.notes.map(n => "• " + n).join("\n");
  m.el.querySelector("#rc-body").innerHTML = `
    <div class="card" style="margin:0;border-color:rgba(139,92,246,.45)">
      <div style="text-align:center;margin-bottom:14px">
        <b style="font-size:17px" class="grad-text">${esc(rc.workspace)}</b>
        <div class="faint" style="font-size:12px;margin-top:3px">${rc.followers.toLocaleString()} followers · ${rc.engagement}% engagement · value multiplier ×${rc.engagement_multiplier}</div>
      </div>
      ${rc.platforms.length ? rc.platforms.map(p => `
        <div style="margin-bottom:13px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">${platIcon(p.platform, 13)} <b style="font-size:13.5px">${PLATFORMS[p.platform]?.name || p.platform}</b> <span class="faint" style="font-size:12px">${esc(p.handle)} · ${p.followers.toLocaleString()} followers</span></div>
          <div class="grid cols-4" style="gap:8px">
            ${Object.entries(p.prices).map(([k, v]) => `
              <div class="card" style="margin:0;padding:10px;text-align:center">
                <div class="faint" style="font-size:10.5px">${labels[k]}</div>
                <b style="font-size:15px">${fmtMoney(v)}</b>
              </div>`).join("")}
          </div>
        </div>`).join("")
      : `<p class="muted" style="font-size:13px">Connect at least one account and your prices compute themselves from your real audience.</p>`}
      <div class="faint" style="font-size:11.5px">${rc.notes.map(n => "• " + esc(n)).join("<br>")}</div>
    </div>`;
  const cp = m.el.querySelector("#rc-copy");
  cp.disabled = false;
  cp.onclick = () => copyText(text, "Rate card");
}
