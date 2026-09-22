/* ============ Pages: Accounts · Campaigns · Analytics · Templates · Settings ============ */
"use strict";

/* ============================================================ ACCOUNTS */
ROUTES.accounts = {
  title: "Connected accounts",
  subtitle: "Your social profiles, linked to Lumina.",
  async render(page) {
    refreshCurrentList = () => ROUTES.accounts.render(document.getElementById("page"));
    page.innerHTML = `
      <div class="page-head">
        <span class="muted" id="accounts-count"></span>
        <span class="spacer"></span>
        <button class="btn primary sm" id="acc-new" data-perm="connect">${icon("plus", 14)} Connect account</button>
      </div>
      <div id="acc-grid">${skeletonCards(3, 190)}</div>`;
    document.getElementById("acc-new").onclick = () => openAccountModal();
    let accounts;
    try { accounts = await api("/api/accounts"); } catch (e) { toast(e.message, { type: "error" }); return; }
    renderAccounts(accounts);
  },
};

function renderAccounts(accounts) {
  const grid = document.getElementById("acc-grid");
  if (!grid) return;
  document.getElementById("accounts-count").textContent =
    `${accounts.filter(a => a.status === "connected").length} of ${accounts.length} accounts connected`;
  if (!accounts.length) {
    grid.innerHTML = `<div class="card">${emptyState({
      icon: "users", title: "No accounts connected",
      message: "Link Instagram, X, LinkedIn, TikTok and more to publish and measure everything from one place.",
      actionLabel: "Connect your first account", actionId: "acc-empty-new" })}</div>`;
    document.getElementById("acc-empty-new").onclick = () => openAccountModal();
    return;
  }
  grid.innerHTML = `<div class="grid cols-3">${accounts.map(a => {
    const pm = PLATFORMS[a.platform] || { name: a.platform, color: "#666" };
    const paused = a.status !== "connected";
    return `
    <div class="card account-card fade-in" data-id="${a.id}">
      <div class="account-head">
        <span class="a-ico" style="background:${pm.color}">${platIcon(a.platform, 18).replace(/<span[^>]*>|<\/span>/g, "")}</span>
        <div style="flex:1;min-width:0">
          <b>${esc(a.display_name || a.handle)}</b>
          <span>${esc(a.handle)} · ${pm.name}</span>
        </div>
        ${paused ? `<span class="badge yellow"><span class="dot"></span>Paused</span>` : `<span class="badge green"><span class="dot"></span>Live</span>`}
      </div>
      <div class="account-stats">
        <div><b>${fmtNum(a.followers)}</b><span>Followers</span></div>
        <div><b>${a.engagement}%</b><span>Engagement</span></div>
        <div><b>${timeAgo(a.connected_at).replace(" ago", "")}</b><span>Linked</span></div>
      </div>
      <div class="account-foot">
        <label class="switch" title="${paused ? "Resume publishing" : "Pause publishing"}">
          <input type="checkbox" data-toggle ${paused ? "" : "checked"}><span class="track"></span>
        </label>
        <div class="card-acts" style="display:flex;gap:5px">
          <button class="btn ghost sm" data-act="edit">${icon("edit", 13)} Edit</button>
          <button class="icon-btn danger" data-act="disc" title="Disconnect">${icon("logout", 15)}</button>
        </div>
      </div>
    </div>`;
  }).join("")}</div>`;

  grid.querySelectorAll(".account-card").forEach(card => {
    const a = accounts.find(x => x.id === Number(card.dataset.id));
    card.querySelector("[data-toggle]").onchange = async e => {
      const target = e.target.checked ? "connected" : "paused";
      const prev = a.status;
      a.status = target; // optimistic
      card.querySelector(".account-head .badge").outerHTML = target === "connected"
        ? `<span class="badge green"><span class="dot"></span>Live</span>`
        : `<span class="badge yellow"><span class="dot"></span>Paused</span>`;
      try {
        await api(`/api/accounts/${a.id}`, { method: "PATCH", body: { status: target } });
        toast(target === "connected" ? `${a.handle} resumed` : `${a.handle} paused`, { type: "info" });
      } catch (err) {
        a.status = prev; e.target.checked = prev === "connected";
        toast(err.message, { type: "error" });
      }
    };
    card.querySelector('[data-act="edit"]').onclick = () => openAccountModal(a);
    card.querySelector('[data-act="disc"]').onclick = async () => {
      const ok = await confirmModal({ title: "Disconnect account", message: `Disconnect ${a.handle} from Lumina? Scheduled posts for this platform will keep running on your other accounts.`, confirmLabel: "Disconnect" });
      if (!ok) return;
      card.style.transition = "opacity .2s, transform .2s"; card.style.opacity = "0"; card.style.transform = "scale(.97)";
      setTimeout(() => card.remove(), 180);
      const idx = accounts.indexOf(a); accounts.splice(idx, 1);
      document.getElementById("accounts-count").textContent = `${accounts.filter(x => x.status === "connected").length} of ${accounts.length} accounts connected`;
      toast("Account disconnected", { type: "info", action: { label: "Undo", onClick: async () => {
        try {
          const na = await api("/api/accounts", { method: "POST", body: { platform: a.platform, handle: a.handle, display_name: a.display_name } });
          accounts.splice(idx, 0, na); renderAccounts(accounts); toast("Reconnected");
        } catch (err) { toast("Couldn't reconnect", { type: "error" }); }
      }}});
      api(`/api/accounts/${a.id}`, { method: "DELETE" }).catch(() => { accounts.splice(idx, 0, a); renderAccounts(accounts); });
    };
  });
}

function openAccountModal(account) {
  let sel = account ? account.platform : "";
  const m = openModal({
    title: account ? "Edit account" : "Connect an account",
    body: account ? `
      <div class="field"><label>Handle</label><input class="input" id="am-handle" value="${esc(account.handle)}"></div>
      <div class="field"><label>Display name</label><input class="input" id="am-name" value="${esc(account.display_name)}"></div>
      <div class="form-error" id="am-error"></div>` : `
      <div class="field"><label>Choose a platform</label>
        <div class="platform-picker" id="am-plats">
          ${Object.entries(PLATFORMS).map(([k, v]) => `<div class="pp" data-plat="${k}"><span style="width:34px;height:34px;border-radius:9px;background:${v.color};display:flex;align-items:center;justify-content:center;color:#fff">${platIcon(k, 16).replace(/<span[^>]*>|<\/span>/g, "")}</span>${v.name}</div>`).join("")}
        </div>
      </div>
      <div class="field"><label>Handle or page name</label><input class="input" id="am-handle" placeholder="@yourbrand"></div>
      <div class="form-error" id="am-error"></div>`,
    foot: `<button class="btn" data-cancel>Cancel</button><button class="btn primary" id="am-save">${account ? "Save" : icon("external", 14) + " Connect"}</button>`,
  });
  m.el.querySelector("[data-cancel]").onclick = m.close;
  if (!account) {
    m.el.querySelectorAll("#am-plats .pp").forEach(pp => pp.onclick = () => {
      m.el.querySelectorAll("#am-plats .pp").forEach(x => x.classList.remove("active"));
      pp.classList.add("active"); sel = pp.dataset.plat;
    });
  }
  m.el.querySelector("#am-save").onclick = async () => {
    const errEl = m.el.querySelector("#am-error");
    errEl.classList.remove("show");
    const btn = m.el.querySelector("#am-save");
    if (account) {
      buttonLoading(btn, true, "Saving…");
      try {
        await api(`/api/accounts/${account.id}`, { method: "PATCH", body: { handle: m.el.querySelector("#am-handle").value.trim(), display_name: m.el.querySelector("#am-name").value.trim() } });
        m.close(); toast("Account updated"); refreshCurrentList();
      } catch (e) { errEl.textContent = e.message; errEl.classList.add("show"); buttonLoading(btn, false); }
    } else {
      if (!sel) { errEl.textContent = "Pick a platform first."; errEl.classList.add("show"); return; }
      const handle = m.el.querySelector("#am-handle").value.trim();
      if (!handle) { errEl.textContent = "Enter your handle or page name."; errEl.classList.add("show"); return; }
      buttonLoading(btn, true, "Authorizing…");
      try {
        await api("/api/accounts", { method: "POST", body: { platform: sel, handle } });
        m.close(); toast(`${PLATFORMS[sel].name} connected 🎉`); refreshCurrentList();
      } catch (e) { errEl.textContent = e.message; errEl.classList.add("show"); buttonLoading(btn, false); }
    }
  };
}

/* ============================================================ CAMPAIGNS */
const GOALS = ["Awareness", "Engagement", "Conversions", "Leads", "Retention"];
const CAMP_COLORS = ["#3b82f6", "#22d3ee", "#f59e0b", "#fbbf24", "#34d399", "#60a5fa"];
const CAMP_STATUS = { active: ["green", "Active"], paused: ["yellow", "Paused"], draft: ["gray", "Draft"], completed: ["blue", "Completed"] };

ROUTES.campaigns = {
  title: "Campaigns",
  subtitle: "Group posts into initiatives and track spend.",
  async render(page) {
    refreshCurrentList = () => ROUTES.campaigns.render(document.getElementById("page"));
    page.innerHTML = `
      <div class="page-head">
        <span class="muted" id="camp-count"></span>
        <span class="spacer"></span>
        <button class="btn primary sm" id="camp-new" data-perm="create">${icon("plus", 14)} New campaign</button>
      </div>
      <div id="camp-grid">${skeletonCards(3, 210)}</div>`;
    document.getElementById("camp-new").onclick = () => openCampaignModal();
    let camps;
    try { camps = await api("/api/campaigns"); } catch (e) { toast(e.message, { type: "error" }); return; }
    renderCampaigns(camps);
  },
};

function renderCampaigns(camps) {
  const grid = document.getElementById("camp-grid");
  if (!grid) return;
  const active = camps.filter(c => c.status === "active").length;
  document.getElementById("camp-count").textContent = `${camps.length} campaigns · ${active} active`;
  if (!camps.length) {
    grid.innerHTML = `<div class="card">${emptyState({
      icon: "target", title: "No campaigns yet",
      message: "Bundle related posts under a campaign to track budget, timing and performance together.",
      actionLabel: "Create a campaign", actionId: "camp-empty-new" })}</div>`;
    document.getElementById("camp-empty-new").onclick = () => openCampaignModal();
    return;
  }
  grid.innerHTML = `<div class="grid cols-3">${camps.map(c => {
    const [cls, label] = CAMP_STATUS[c.status] || CAMP_STATUS.draft;
    const pct = c.budget > 0 ? Math.min(100, (c.spent / c.budget) * 100) : 0;
    return `
    <div class="card campaign-card fade-in" style="--camp-color:${c.color}" data-id="${c.id}">
      <div class="c-top"><h4>${esc(c.name)}</h4><span class="badge ${cls}"><span class="dot"></span>${label}</span></div>
      <div class="goal">${icon("target", 12)} ${esc(c.goal)} · ${fmtDate(c.start_date)} → ${fmtDate(c.end_date)}</div>
      <div class="u-top" style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px">
        <span class="muted">Budget used</span><b>${fmtMoney(c.spent)} <span class="faint">/ ${fmtMoney(c.budget)}</span></b>
      </div>
      <div class="progress"><div class="bar" style="width:${pct}%"></div></div>
      <div class="c-meta"><span>${Math.round(pct)}% spent</span><span>${c.post_count} post${c.post_count === 1 ? "" : "s"}</span></div>
      <div class="c-foot">
        <span>${c.status === "active" ? icon("play", 12) + " Running" : c.status === "paused" ? icon("pause", 12) + " Paused" : icon("clock", 12) + " Standby"}</span>
        <div class="card-acts" style="display:flex;gap:4px">
          <button class="icon-btn" data-act="edit" title="Edit">${icon("edit", 15)}</button>
          <button class="icon-btn danger" data-act="del" title="Delete">${icon("trash", 15)}</button>
        </div>
      </div>
    </div>`;
  }).join("")}</div>`;
  grid.querySelectorAll(".campaign-card").forEach(card => {
    const c = camps.find(x => x.id === Number(card.dataset.id));
    card.querySelector('[data-act="edit"]').onclick = () => openCampaignModal(c);
    card.querySelector('[data-act="del"]').onclick = async () => {
      const ok = await confirmModal({ title: "Delete campaign", message: `Delete “${c.name}”? Its posts stay, but will no longer be grouped under this campaign.` });
      if (!ok) return;
      card.style.transition = "opacity .2s"; card.style.opacity = "0";
      setTimeout(() => card.remove(), 180);
      const idx = camps.indexOf(c); camps.splice(idx, 1);
      toast("Campaign deleted", { type: "info", action: { label: "Undo", onClick: async () => {
        try {
          const nc = await api("/api/campaigns", { method: "POST", body: c });
          camps.splice(idx, 0, nc); renderCampaigns(camps); toast("Campaign restored");
        } catch (e) { toast("Couldn't restore", { type: "error" }); }
      }}});
      api(`/api/campaigns/${c.id}`, { method: "DELETE" }).catch(() => { camps.splice(idx, 0, c); renderCampaigns(camps); });
    };
  });
}

function openCampaignModal(camp) {
  const c = camp || { name: "", goal: "Awareness", status: "draft", budget: "", spent: "", start_date: "", end_date: "", color: "#3b82f6" };
  const m = openModal({
    title: camp ? "Edit campaign" : "New campaign",
    body: `
      <div class="field"><label>Campaign name</label><input class="input" id="cm-name" placeholder="e.g. Spring Product Launch" value="${esc(c.name)}"></div>
      <div class="grid cols-2">
        <div class="field"><label>Goal</label>
          <select class="input" id="cm-goal">${GOALS.map(g => `<option ${c.goal === g ? "selected" : ""}>${g}</option>`).join("")}</select>
        </div>
        <div class="field"><label>Status</label>
          <select class="input" id="cm-status">${Object.entries(CAMP_STATUS).map(([k, v]) => `<option value="${k}" ${c.status === k ? "selected" : ""}>${v[1]}</option>`).join("")}</select>
        </div>
      </div>
      <div class="grid cols-2">
        <div class="field"><label>Budget ($)</label><input class="input" id="cm-budget" type="number" min="0" value="${c.budget ?? ""}"></div>
        <div class="field"><label>Spent so far ($)</label><input class="input" id="cm-spent" type="number" min="0" value="${c.spent ?? ""}"></div>
      </div>
      <div class="grid cols-2">
        <div class="field"><label>Start date</label><input class="input" id="cm-start" type="date" value="${c.start_date || ""}"></div>
        <div class="field"><label>End date</label><input class="input" id="cm-end" type="date" value="${c.end_date || ""}"></div>
      </div>
      <div class="field"><label>Color</label>
        <div class="chip-row" id="cm-colors">${CAMP_COLORS.map(col => `<span class="chip ${c.color === col ? "active" : ""}" data-col="${col}" style="padding:7px 10px"><span style="width:14px;height:14px;border-radius:5px;background:${col};display:inline-block"></span></span>`).join("")}</div>
      </div>
      <div class="form-error" id="cm-error"></div>`,
    foot: `<button class="btn" data-cancel>Cancel</button><button class="btn primary" id="cm-save">${camp ? "Save changes" : "Create campaign"}</button>`,
  });
  let color = c.color;
  m.el.querySelectorAll("#cm-colors .chip").forEach(ch => ch.onclick = () => {
    m.el.querySelectorAll("#cm-colors .chip").forEach(x => x.classList.remove("active"));
    ch.classList.add("active"); color = ch.dataset.col;
  });
  m.el.querySelector("[data-cancel]").onclick = m.close;
  m.el.querySelector("#cm-save").onclick = async () => {
    const errEl = m.el.querySelector("#cm-error");
    const name = m.el.querySelector("#cm-name").value.trim();
    if (!name) { errEl.textContent = "Give the campaign a name."; errEl.classList.add("show"); return; }
    const btn = m.el.querySelector("#cm-save");
    buttonLoading(btn, true, "Saving…");
    const body = {
      name,
      goal: m.el.querySelector("#cm-goal").value,
      status: m.el.querySelector("#cm-status").value,
      budget: Number(m.el.querySelector("#cm-budget").value || 0),
      spent: Number(m.el.querySelector("#cm-spent").value || 0),
      start_date: m.el.querySelector("#cm-start").value || null,
      end_date: m.el.querySelector("#cm-end").value || null,
      color,
    };
    try {
      if (camp) await api(`/api/campaigns/${camp.id}`, { method: "PATCH", body });
      else await api("/api/campaigns", { method: "POST", body });
      m.close(); toast(camp ? "Campaign updated" : "Campaign created"); refreshCurrentList();
    } catch (e) { errEl.textContent = e.message; errEl.classList.add("show"); buttonLoading(btn, false); }
  };
}

/* ============================================================ ANALYTICS */
ROUTES.analytics = {
  title: "Analytics",
  subtitle: "Performance across every connected channel.",
  async render(page) {
    refreshCurrentList = () => {};
    page.innerHTML = `
      <div class="page-head">
        <div class="seg" id="an-range">
          <button data-r="7">7 days</button><button data-r="30" class="active">30 days</button><button data-r="90">90 days</button>
        </div>
        <span class="spacer"></span>
        <span class="muted" id="an-note"></span>
      </div>
      <div id="an-body">
        <div class="grid cols-4">${Array(4).fill('<div class="card"><div class="skel skel-line" style="width:55%"></div><div class="skel" style="height:28px;width:50%;margin-top:10px"></div></div>').join("")}</div>
        <div class="dash-layout">
          <div class="stack">
            <div class="card"><h3>Reach over time</h3><div class="card-sub" id="an-chart-sub"></div><div id="an-chart"><div class="skel skel-block" style="height:230px"></div></div></div>
            <div class="card"><h3>Engagement by platform</h3><div class="card-sub">Average engagement rate per channel</div><div id="an-bars"><div class="skel skel-block" style="height:150px"></div></div></div>
          </div>
          <div class="stack">
            <div class="card"><h3>Audience split</h3><div class="card-sub">Where your followers live</div><div id="an-donut"><div class="skel skel-block"></div></div></div>
            <div class="card"><h3>Channel detail</h3><div class="card-sub">Followers per account</div><div id="an-channels">${skeletonTable(4)}</div></div>
          </div>
        </div>
      </div>`;
    const load = async r => {
      document.querySelectorAll("#an-range button").forEach(b => b.classList.toggle("active", b.dataset.r === String(r)));
      try {
        const d = await api(`/api/analytics?range=${r}`);
        drawAnalytics(d);
      } catch (e) { toast(e.message, { type: "error" }); }
    };
    document.querySelectorAll("#an-range button").forEach(b => b.onclick = () => load(Number(b.dataset.r)));
    await load(30);
  },
};

function deltaBadge(v, { suffix = "%", invert = false } = {}) {
  if (v == null || isNaN(v)) return `<span class="stat-delta delta-flat">—</span>`;
  const good = invert ? v < 0 : v > 0;
  const flat = Math.abs(v) < 0.01;
  return `<span class="stat-delta ${flat ? "delta-flat" : good ? "delta-up" : "delta-down"}">${icon(flat ? "chevronRight" : v > 0 ? "trendUp" : "trendDown", 12)} ${flat ? "flat" : (v > 0 ? "+" : "") + v + suffix} vs prev.</span>`;
}

function drawAnalytics(d) {
  const s = d.summary, dl = d.deltas;
  const stats = [
    { label: "Total reach", value: fmtNum(s.reach), delta: dl.reach, ico: "eye", color: "#60a5fa", bg: "rgba(96,165,250,.13)" },
    { label: "Impressions", value: fmtNum(s.impressions), delta: null, ico: "globe", color: "#22d3ee", bg: "rgba(34,211,238,.12)" },
    { label: "Engagement rate", value: s.engagement + "%", delta: dl.engagement, suffix: "pt", ico: "heart", color: "#f59e0b", bg: "rgba(245,158,11,.13)" },
    { label: "Followers", value: fmtNum(s.followers), delta: dl.followers, suffix: "", ico: "users", color: "#93c5fd", bg: "rgba(59,130,246,.14)" },
  ];
  document.getElementById("an-body").querySelector(".grid").innerHTML = stats.map(st => `
    <div class="card stat-card fade-in">
      <div class="stat-top"><span class="stat-label"><span class="stat-ico" style="background:${st.bg};color:${st.color}">${icon(st.ico, 15)}</span> ${st.label}</span></div>
      <div class="stat-value">${st.value}</div>
      ${deltaBadge(st.delta, { suffix: st.suffix ?? "%" })}
    </div>`).join("");
  document.getElementById("an-note").textContent = `Last ${d.range} days`;
  document.getElementById("an-chart-sub").textContent = `${fmtNum(s.reach)} people reached · ${fmtNum(s.clicks)} link clicks`;
  renderAreaChart(document.getElementById("an-chart"),
    d.series.map(x => ({ label: new Date(x.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }), value: x.reach })),
    { label: "reach", color: "#60a5fa" });
  renderBars(document.getElementById("an-bars"),
    d.platforms.map(p => ({ label: PLATFORMS[p.platform]?.name || p.platform, value: p.engagement, color: PLATFORMS[p.platform]?.color || "#3b82f6" })),
    { fmt: v => v, suffix: "%" });
  renderDonut(document.getElementById("an-donut"),
    d.platforms.map(p => ({ platform: p.platform, value: p.followers, color: PLATFORMS[p.platform]?.color || "#666" })),
    { centerLabel: "followers" });
  document.getElementById("an-channels").innerHTML = d.platforms.length
    ? d.platforms.map(p => `
      <div class="list-item">
        ${platIcon(p.platform, 14)}
        <div class="li-main"><b>${esc(p.handle)}</b><span>${PLATFORMS[p.platform]?.name || p.platform}</span></div>
        <div class="li-side"><b style="font-size:13px">${fmtNum(p.followers)}</b><br><span style="font-size:11px;color:var(--faint)">${p.engagement}% eng.</span></div>
      </div>`).join("")
    : emptyState({ icon: "users", title: "No channels", message: "Connect an account to see channel analytics." });
}

/* ============================================================ TEMPLATES */
const TEMPLATE_CATS = ["General", "Conversion", "Education", "Social Proof", "Authenticity", "Community", "Gratitude"];

ROUTES.templates = {
  title: "AI Templates",
  subtitle: "Reusable prompts that keep your content on-brand.",
  async render(page) {
    refreshCurrentList = () => ROUTES.templates.render(document.getElementById("page"));
    page.innerHTML = `
      <div class="page-head">
        <span class="muted" id="tpl-count"></span>
        <span class="spacer"></span>
        <button class="btn primary sm" id="tpl-new" data-perm="create">${icon("plus", 14)} New template</button>
      </div>
      <div id="tpl-grid">${skeletonCards(3, 200)}</div>`;
    document.getElementById("tpl-new").onclick = () => openTemplateModal();
    let tpls;
    try { tpls = await api("/api/templates"); } catch (e) { toast(e.message, { type: "error" }); return; }
    renderTemplates(tpls);
  },
};

function renderTemplates(tpls) {
  const grid = document.getElementById("tpl-grid");
  if (!grid) return;
  document.getElementById("tpl-count").textContent = `${tpls.length} template${tpls.length === 1 ? "" : "s"}`;
  if (!tpls.length) {
    grid.innerHTML = `<div class="card">${emptyState({
      icon: "bookmark", title: "No templates saved",
      message: "Save your favorite prompts as templates so anyone on the team can generate on-brand drafts in one click.",
      actionLabel: "Create a template", actionId: "tpl-empty-new" })}</div>`;
    document.getElementById("tpl-empty-new").onclick = () => openTemplateModal();
    return;
  }
  grid.innerHTML = `<div class="grid cols-3">${tpls.map(t => `
    <div class="card template-card fade-in" data-id="${t.id}">
      <div class="t-cat"><span class="badge purple">${esc(t.category)}</span></div>
      <h4>${esc(t.name)}</h4>
      <div class="t-desc">${esc(t.description || "No description")}</div>
      <div class="t-prompt">${esc(t.prompt)}</div>
      <div class="t-foot">
        <button class="btn primary sm" data-act="use">${icon("sparkles", 13)} Use</button>
        <button class="btn sm" data-act="edit">${icon("edit", 13)} Edit</button>
        <button class="icon-btn danger" data-act="del" title="Delete">${icon("trash", 15)}</button>
      </div>
    </div>`).join("")}</div>`;
  grid.querySelectorAll(".template-card").forEach(card => {
    const t = tpls.find(x => x.id === Number(card.dataset.id));
    card.querySelector('[data-act="use"]').onclick = () => { location.hash = `#/generator?topic=${encodeURIComponent(t.name)}`; };
    card.querySelector('[data-act="edit"]').onclick = () => openTemplateModal(t);
    card.querySelector('[data-act="del"]').onclick = async () => {
      const ok = await confirmModal({ title: "Delete template", message: `Delete “${t.name}”? This can't be undone.` });
      if (!ok) return;
      card.style.transition = "opacity .2s"; card.style.opacity = "0";
      setTimeout(() => card.remove(), 180);
      tpls.splice(tpls.indexOf(t), 1);
      toast("Template deleted", { type: "info" });
      api(`/api/templates/${t.id}`, { method: "DELETE" }).catch(() => { toast("Delete failed", { type: "error" }); refreshCurrentList(); });
    };
  });
}

function openTemplateModal(tpl) {
  const t = tpl || { name: "", category: "General", description: "", prompt: "" };
  const m = openModal({
    title: tpl ? "Edit template" : "New AI template",
    body: `
      <div class="field"><label>Name</label><input class="input" id="tm-name" placeholder="e.g. Weekly Tips Carousel" value="${esc(t.name)}"></div>
      <div class="grid cols-2">
        <div class="field"><label>Category</label>
          <select class="input" id="tm-cat">${TEMPLATE_CATS.map(c => `<option ${t.category === c ? "selected" : ""}>${c}</option>`).join("")}</select>
        </div>
        <div class="field"><label>Short description</label><input class="input" id="tm-desc" value="${esc(t.description)}" placeholder="What is this for?"></div>
      </div>
      <div class="field"><label>Prompt</label>
        <textarea class="input" id="tm-prompt" rows="5" placeholder="Write a post about {topic} that…">{esc(t.prompt)}</textarea>
        <div class="char-count">Tip: use <b>{topic}</b> as a placeholder</div>
      </div>
      <div class="form-error" id="tm-error"></div>`,
    foot: `<button class="btn" data-cancel>Cancel</button><button class="btn primary" id="tm-save">${tpl ? "Save changes" : "Create template"}</button>`,
  });
  m.el.querySelector("[data-cancel]").onclick = m.close;
  m.el.querySelector("#tm-save").onclick = async () => {
    const errEl = m.el.querySelector("#tm-error");
    const body = {
      name: m.el.querySelector("#tm-name").value.trim(),
      category: m.el.querySelector("#tm-cat").value,
      description: m.el.querySelector("#tm-desc").value.trim(),
      prompt: m.el.querySelector("#tm-prompt").value.trim(),
    };
    if (!body.name || !body.prompt) { errEl.textContent = "A name and a prompt are required."; errEl.classList.add("show"); return; }
    const btn = m.el.querySelector("#tm-save");
    buttonLoading(btn, true, "Saving…");
    try {
      if (tpl) await api(`/api/templates/${tpl.id}`, { method: "PATCH", body });
      else await api("/api/templates", { method: "POST", body });
      m.close(); toast(tpl ? "Template updated" : "Template created"); refreshCurrentList();
    } catch (e) { errEl.textContent = e.message; errEl.classList.add("show"); buttonLoading(btn, false); }
  };
}

/* ============================================================ SETTINGS */
ROUTES.settings = {
  title: "Settings",
  subtitle: "Profile, preferences and workspace controls.",
  async render(page) {
    refreshCurrentList = () => {};
    const u = state.user;
    const prefs = u.prefs || {};
    page.innerHTML = `
      <div class="settings-grid">
        <div class="stack">
          <div class="card">
            <h3>Profile</h3>
            <div class="card-sub">How you appear across Lumina.</div>
            <div style="display:flex;gap:14px;align-items:center;margin-bottom:18px">
              <span class="avatar" style="background:${u.avatar_color};width:52px;height:52px;font-size:18px">${esc(initials(u.name))}</span>
              <div><b style="font-size:15px">${esc(u.name)}</b><div class="muted" style="font-size:12.5px">${esc(u.email)} · ${esc(u.plan)} plan</div></div>
            </div>
            <div class="field"><label>Full name</label><input class="input" id="set-name" value="${esc(u.name)}"></div>
            <div class="field"><label>Email</label><input class="input" id="set-email" type="email" value="${esc(u.email)}"></div>
            <div class="field"><label>Workspace name</label><input class="input" id="set-ws" value="${esc(u.workspace)}"></div>
            <div class="form-error" id="set-error"></div>
            <button class="btn primary" id="set-save">${icon("check", 14)} Save profile</button>
          </div>
          <div class="card">
            <h3>Notifications</h3>
            <div class="card-sub">Changes save instantly.</div>
            <div class="setting-row">
              <div class="s-main"><b>Weekly performance report</b><span>A summary of reach & engagement every Monday.</span></div>
              <label class="switch"><input type="checkbox" data-pref="weekly_report" ${prefs.weekly_report ? "checked" : ""}><span class="track"></span></label>
            </div>
            <div class="setting-row">
              <div class="s-main"><b>Post approvals</b><span>Get pinged when a scheduled post needs sign-off.</span></div>
              <label class="switch"><input type="checkbox" data-pref="post_approvals" ${prefs.post_approvals ? "checked" : ""}><span class="track"></span></label>
            </div>
            <div class="setting-row">
              <div class="s-main"><b>Product news</b><span>Occasional updates and new-feature announcements.</span></div>
              <label class="switch"><input type="checkbox" data-pref="product_news" ${prefs.product_news ? "checked" : ""}><span class="track"></span></label>
            </div>
          </div>
        </div>
        <div class="stack">
          <div class="card">
            <h3>Plan & usage</h3>
            <div class="card-sub">You're on the <b style="color:#93c5fd">${esc(u.plan)}</b> plan.</div>
            <div id="set-usage">${skeletonTable(2)}</div>
            <button class="btn block mt-16" id="set-upgrade">${icon("zap", 14)} Upgrade to Scale</button>
          </div>
          <div class="card">
            <h3>Export & backup</h3>
            <div class="card-sub">Your data is yours — take it anywhere, anytime.</div>
            <div style="display:flex;flex-direction:column;gap:10px">
              <button class="btn block" id="set-exp-ws">${icon("external", 14)} Download workspace backup (.json)</button>
              <button class="btn block" id="set-exp-an">${icon("chart", 14)} Export analytics (.csv)</button>
              <button class="btn block" id="set-exp-posts">${icon("inbox", 14)} Export posts (.csv)</button>
            </div>
          </div>
          <div class="card" style="border-color:rgba(248,113,113,.25)">
            <h3>Danger zone</h3>
            <div class="card-sub">Demo controls — perfect for exploring every state of the app.</div>
            <div style="display:flex;flex-direction:column;gap:10px">
              <button class="btn" id="set-reseed">${icon("refresh", 14)} Restore starter workspace</button>
              <button class="btn danger" id="set-clear">${icon("trash", 14)} Clear all workspace data</button>
            </div>
            <p class="faint" style="font-size:11.5px;margin-top:12px">“Restore starter” loads a small sample dataset. “Clear” wipes everything so you can see the empty states.</p>
          </div>
        </div>
      </div>`;

    document.getElementById("set-save").onclick = async () => {
      const errEl = document.getElementById("set-error");
      errEl.classList.remove("show");
      const btn = document.getElementById("set-save");
      buttonLoading(btn, true, "Saving…");
      try {
        state.user = await api("/api/me", { method: "PATCH", body: {
          name: document.getElementById("set-name").value,
          email: document.getElementById("set-email").value,
          workspace: document.getElementById("set-ws").value,
        }});
        toast("Profile saved");
        setTimeout(() => renderRoute(), 400);
      } catch (e) { errEl.textContent = e.message; errEl.classList.add("show"); buttonLoading(btn, false); }
    };

    page.querySelectorAll("[data-pref]").forEach(sw => sw.onchange = async () => {
      const key = sw.dataset.pref;
      const val = sw.checked;
      state.user.prefs[key] = val; // optimistic
      try { await api("/api/me", { method: "PATCH", body: { prefs: { [key]: val } } }); }
      catch (e) { sw.checked = !val; state.user.prefs[key] = !val; toast(e.message, { type: "error" }); }
    });

    document.getElementById("set-upgrade").onclick = () => toast("This is where billing would live in production 😉", { type: "info" });

    try {
      const [posts, accounts] = await Promise.all([api("/api/posts"), api("/api/accounts")]);
      const sched = posts.filter(p => p.status === "scheduled").length;
      const creditsLeft = u.credits_limit - u.ai_credits_used;
      document.getElementById("set-usage").innerHTML = `
        <div class="usage-bar">
          <div class="u-top"><span>AI credits</span><b>${u.ai_credits_used} / ${u.credits_limit}</b></div>
          <div class="progress"><div class="bar" style="width:${Math.min(100, (u.ai_credits_used / u.credits_limit) * 100)}%;background:var(--grad)"></div></div>
        </div>
        <div class="usage-bar">
          <div class="u-top"><span>Scheduled posts</span><b>${sched} / 30</b></div>
          <div class="progress"><div class="bar" style="width:${Math.min(100, (sched / 30) * 100)}%;background:var(--blue)"></div></div>
        </div>
        <div class="usage-bar">
          <div class="u-top"><span>Connected accounts</span><b>${accounts.filter(a => a.status === "connected").length} / 6</b></div>
          <div class="progress"><div class="bar" style="width:${Math.min(100, (accounts.filter(a => a.status === "connected").length / 6) * 100)}%;background:var(--green)"></div></div>
        </div>`;
    } catch (e) { document.getElementById("set-usage").innerHTML = `<p class="muted">Couldn't load usage.</p>`; }

    const reset = async (mode, msg) => {
      const ok = await confirmModal({ title: mode === "clear" ? "Clear all data?" : "Restore starter workspace?", message: msg, confirmLabel: mode === "clear" ? "Clear everything" : "Restore", danger: mode === "clear" });
      if (!ok) return;
      try {
        await api("/api/workspace/reset", { method: "POST", body: { mode } });
        toast(mode === "clear" ? "Workspace cleared — enjoy the empty states" : "Starter workspace restored");
        if (state.user) state.user.ai_credits_used = 0;
        setTimeout(() => { location.hash = "#/dashboard"; renderRoute(); }, 500);
      } catch (e) { toast(e.message, { type: "error" }); }
    };
    document.getElementById("set-reseed").onclick = () => reset("demo", "This replaces your current data with a small sample dataset (2 accounts, 1 draft, 30 days of analytics).");
    document.getElementById("set-clear").onclick = () => reset("clear", "This permanently deletes all accounts, posts, campaigns, templates and analytics in this workspace.");

    const wireExport = (id, path, name) => {
      document.getElementById(id).onclick = async e => {
        buttonLoading(e.currentTarget, true, "Preparing…");
        try { await downloadExport(path, name); toast("Download started"); }
        catch (err) { toast(err.message, { type: "error" }); }
        buttonLoading(e.currentTarget, false);
      };
    };
    ["set-exp-ws","set-exp-an","set-exp-posts"].forEach(id=>{const e=document.getElementById(id); if(e) e.dataset.perm="export";});
    wireExport("set-exp-ws", "/api/export/workspace", "lumina-backup.json");
    wireExport("set-exp-an", "/api/export/analytics.csv", "lumina-analytics.csv");
    wireExport("set-exp-posts", "/api/export/posts.csv", "lumina-posts.csv");
  },
};

/* ---------------- boot ---------------- */
boot();
