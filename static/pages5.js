/* ============ Pages: Notifications · Social Listening · Content Ideas ============ */
"use strict";

/* ============================================================ NOTIFICATIONS */
ROUTES.notifications = {
  title: "Notifications",
  subtitle: "Everything that happened across your workspace.",
  async render(page) {
    refreshCurrentList = () => {};
    page.innerHTML = `
      <div class="page-head">
        <div class="tabs" id="ntf-tabs"></div>
        <span class="spacer"></span>
        <button class="btn sm" id="ntf-read">${icon("check", 14)} Mark all read</button>
      </div>
      <div class="card" id="ntf-list" style="padding:8px 16px">${skeletonTable(6)}</div>`;
    document.getElementById("ntf-read").onclick = async () => {
      await api("/api/notifications/read", { method: "POST" }).catch(() => {});
      setBellDot(0);
      toast("All notifications marked as read", { type: "info" });
      load();
    };
    let filter = "all";
    function drawTabs(items) {
      const types = { all: "All", post: "Posts", ai: "AI", account: "Accounts", campaign: "Campaigns", milestone: "Milestones" };
      const tabs = document.getElementById("ntf-tabs");
      if (!tabs) return;
      tabs.innerHTML = Object.entries(types).map(([k, label]) => {
        const n = k === "all" ? items.length : items.filter(i => i.type === k).length;
        return `<button class="tab ${filter === k ? "active" : ""}" data-t="${k}">${label}<span class="n">${n}</span></button>`;
      }).join("");
      tabs.querySelectorAll("[data-t]").forEach(b => b.onclick = () => { filter = b.dataset.t; draw(); });
    }
    function draw(items, lastSeen) {
      const list = document.getElementById("ntf-list");
      if (!list) return;
      const shown = (filter === "all" ? items : items.filter(i => i.type === filter));
      if (!shown.length) {
        list.innerHTML = emptyState({ icon: "bell", title: "Nothing here", message: "Notifications of this type will show up here as your workspace hums along." });
        return;
      }
      list.innerHTML = shown.map(n => {
        const unread = !lastSeen || n.created_at > lastSeen;
        return `
        <div class="list-item" style="${unread ? "background:rgba(59,130,246,.05);border-radius:10px;padding-left:10px;padding-right:10px" : ""}">
          <span class="li-ico" style="background:rgba(59,130,246,.12);color:#93c5fd">${icon(ACT_ICO[n.type] || "zap", 16)}</span>
          <div class="li-main"><b style="white-space:normal;font-weight:${unread ? 700 : 500}">${esc(n.message)}</b></div>
          <div class="li-side">
            ${unread ? `<span class="badge purple" style="margin-bottom:4px">new</span><br>` : ""}
            <span style="font-size:11px;color:var(--faint)">${timeAgo(n.created_at)}</span>
          </div>
        </div>`;
      }).join("");
    }
    try {
      const d = await api("/api/notifications");
      drawTabs(d.items);
      draw(d.items, d.last_seen);
    } catch (e) { toast(e.message, { type: "error" }); }
  },
};

/* ============================================================ SOCIAL LISTENING */
ROUTES.listening = {
  title: "Social Listening",
  subtitle: "Track keywords and see what the web is saying.",
  async render(page) {
    refreshCurrentList = () => ROUTES.listening.render(document.getElementById("page"));
    page.innerHTML = `
      <div class="page-head">
        <span class="muted" id="kw-summary"></span>
        <span class="spacer"></span>
        <button class="btn primary sm" id="kw-add" data-perm="create">${icon("plus", 14)} Track a keyword</button>
      </div>
      <div id="kw-grid">${skeletonCards(3, 220)}</div>`;
    document.getElementById("kw-add").onclick = () => openKeywordModal();
    let kws;
    try { kws = await api("/api/keywords"); } catch (e) { toast(e.message, { type: "error" }); return; }
    renderKeywords(kws);
  },
};

function sentimentBar(s) {
  return `<div style="display:flex;height:8px;border-radius:99px;overflow:hidden;background:var(--bg-soft)">
    <div style="width:${s.positive}%;background:var(--green)"></div>
    <div style="width:${s.neutral}%;background:#6b7284"></div>
    <div style="width:${s.negative}%;background:var(--red)"></div>
  </div>`;
}

function renderKeywords(kws) {
  const grid = document.getElementById("kw-grid");
  if (!grid) return;
  const total = kws.reduce((s, k) => s + k.volume, 0);
  const sum = document.getElementById("kw-summary");
  if (sum) sum.textContent = kws.length ? `${kws.length} keyword${kws.length === 1 ? "" : "s"} · ${fmtNum(total)} mentions this week` : "";
  if (!kws.length) {
    grid.innerHTML = `<div class="card">${emptyState({
      icon: "search", title: "Nothing being tracked",
      message: "Track your brand, product or campaign keywords and Lumina scans public conversations, scores sentiment and surfaces mentions.",
      actionLabel: "Track your first keyword", actionId: "kw-empty-add" })}</div>`;
    document.getElementById("kw-empty-add").onclick = () => openKeywordModal();
    return;
  }
  grid.innerHTML = `<div class="grid cols-3">${kws.map(k => `
    <div class="card fade-in" data-id="${k.id}" style="opacity:${k.status === "paused" ? .6 : 1}">
      <div style="display:flex;align-items:center;gap:9px;margin-bottom:11px">
        <span class="li-ico" style="background:rgba(34,211,238,.12);color:var(--cyan);width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center">${icon("search", 15)}</span>
        <div style="flex:1;min-width:0"><b style="font-size:14px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">“${esc(k.keyword)}”</b>
        <span class="faint" style="font-size:11.5px">${k.status === "paused" ? "Paused" : "Listening live"}</span></div>
        ${k.status === "paused" ? `<span class="badge gray">Paused</span>` : `<span class="badge green"><span class="dot"></span>Live</span>`}
      </div>
      <div style="display:flex;align-items:flex-end;gap:14px;margin-bottom:11px">
        <div><b style="font-size:22px;font-weight:800;letter-spacing:-.03em">${fmtNum(k.volume)}</b><br><span class="faint" style="font-size:11px">mentions · 7d</span></div>
        <div style="flex:1">${sparkline(k.series, 150, 34, "#22d3ee")}</div>
      </div>
      <div style="margin-bottom:5px;display:flex;justify-content:space-between;font-size:11px;color:var(--faint)">
        <span>${k.sentiment.positive}% positive</span><span>${k.sentiment.neutral}% neutral</span><span>${k.sentiment.negative}% negative</span>
      </div>
      ${sentimentBar(k.sentiment)}
      <div class="kw-mentions" style="display:none;margin-top:13px;border-top:1px solid var(--border);padding-top:11px">
        ${k.mentions.map(m => `
          <div style="display:flex;gap:9px;padding:7px 0;border-bottom:1px solid var(--border)">
            ${platIcon(m.platform, 11)}
            <div style="flex:1;min-width:0">
              <div style="font-size:11.5px"><b>${esc(m.author)}</b> <span class="faint">· ${timeAgo(m.at)} · <span class="sent-badge sent-${m.sentiment}" style="padding:1px 6px">${m.sentiment}</span></span></div>
              <div class="muted" style="font-size:12px;line-height:1.5">${esc(m.text)}</div>
            </div>
          </div>`).join("")}
      </div>
      <div style="display:flex;gap:6px;margin-top:13px;align-items:center">
        <button class="btn ghost sm" data-act="expand">${icon("comment", 13)} Mentions (${k.mentions.length})</button>
        <span style="flex:1"></span>
        <button class="btn ghost sm" data-act="toggle">${k.status === "paused" ? icon("play", 12) + " Resume" : icon("pause", 12) + " Pause"}</button>
        <button class="icon-btn danger" data-act="del" title="Stop tracking">${icon("trash", 14)}</button>
      </div>
    </div>`).join("")}</div>`;
  grid.querySelectorAll(".card[data-id]").forEach(card => {
    const k = kws.find(x => x.id === Number(card.dataset.id));
    card.querySelector('[data-act="expand"]').onclick = () => {
      const box = card.querySelector(".kw-mentions");
      box.style.display = box.style.display === "none" ? "" : "none";
    };
    card.querySelector('[data-act="toggle"]').onclick = async () => {
      const target = k.status === "paused" ? "active" : "paused";
      k.status = target; // optimistic
      card.style.opacity = target === "paused" ? .6 : 1;
      try {
        await api(`/api/keywords/${k.id}`, { method: "PATCH", body: { status: target } });
        toast(target === "paused" ? `Paused listening for “${k.keyword}”` : `Resumed listening for “${k.keyword}”`, { type: "info" });
        refreshCurrentList();
      } catch (e) { toast(e.message, { type: "error" }); }
    };
    card.querySelector('[data-act="del"]').onclick = async () => {
      const ok = await confirmModal({ title: "Stop tracking", message: `Stop listening for “${k.keyword}”? Historical mentions will be removed.`, confirmLabel: "Stop tracking" });
      if (!ok) return;
      card.style.transition = "opacity .2s"; card.style.opacity = "0";
      setTimeout(() => card.remove(), 180);
      kws.splice(kws.indexOf(k), 1);
      toast("Keyword removed", { type: "info" });
      api(`/api/keywords/${k.id}`, { method: "DELETE" }).catch(() => refreshCurrentList());
    };
  });
}

function openKeywordModal() {
  const m = openModal({
    title: "Track a keyword",
    body: `
      <div class="field"><label>Keyword or phrase</label>
        <input class="input" id="kw-input" placeholder="e.g. your brand name, product, campaign hashtag">
      </div>
      <p class="faint" style="font-size:12px">Lumina scans public posts across X, Instagram, LinkedIn, TikTok and Facebook, then scores sentiment and volume.</p>
      <div class="form-error" id="kw-error"></div>`,
    foot: `<button class="btn" data-cancel>Cancel</button><button class="btn primary" id="kw-go">${icon("search", 13)} Start listening</button>`,
  });
  m.el.querySelector("[data-cancel]").onclick = m.close;
  m.el.querySelector("#kw-go").onclick = async () => {
    const errEl = m.el.querySelector("#kw-error");
    errEl.classList.remove("show");
    const btn = m.el.querySelector("#kw-go");
    buttonLoading(btn, true, "Scanning the web…");
    try {
      await api("/api/keywords", { method: "POST", body: { keyword: m.el.querySelector("#kw-input").value } });
      m.close(); toast("Now listening — first mentions are in"); refreshCurrentList();
    } catch (e) { errEl.textContent = e.message; errEl.classList.add("show"); buttonLoading(btn, false); }
  };
}

/* ============================================================ CONTENT IDEAS */
ROUTES.ideas = {
  title: "Content Ideas",
  subtitle: "Never stare at a blank composer again.",
  async render(page) {
    refreshCurrentList = () => {};
    page.innerHTML = `
      <div class="page-head">
        <span class="muted" id="ideas-niche"></span>
        <span class="spacer"></span>
        <button class="btn sm" id="ideas-refresh">${icon("refresh", 14)} Shuffle ideas</button>
      </div>
      <div id="ideas-grid">${skeletonCards(3, 190)}</div>`;
    const load = async () => {
      const grid = document.getElementById("ideas-grid");
      grid.innerHTML = skeletonCards(6, 190);
      try {
        const d = await api("/api/ideas");
        document.getElementById("ideas-niche").textContent = `Tuned to your content about “${d.niche}”`;
        drawIdeas(d.ideas);
      } catch (e) { toast(e.message, { type: "error" }); }
    };
    document.getElementById("ideas-refresh").onclick = load;
    await load();
  },
};

function drawIdeas(ideas) {
  const grid = document.getElementById("ideas-grid");
  if (!grid) return;
  grid.innerHTML = `<div class="grid cols-3">${ideas.map((it, idx) => `
    <div class="card fade-in" style="animation-delay:${idx * 0.05}s;display:flex;flex-direction:column">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <span class="badge purple">${esc(it.category)}</span>
        ${platIcon(it.platform, 11)}
        <span style="flex:1"></span>
        <span class="faint" style="font-size:11px" title="AI hook score">🪝 ${it.hook_score}</span>
      </div>
      <h4 style="font-size:14.5px;margin-bottom:6px">${esc(it.title)}</h4>
      <p class="muted" style="font-size:12.5px;line-height:1.6;flex:1">${esc(it.text)}</p>
      <div class="progress" style="margin-top:12px"><div class="bar" style="width:${it.hook_score}%;background:var(--grad)"></div></div>
      <div style="display:flex;gap:8px;margin-top:13px">
        <button class="btn primary sm" data-act="draft" style="flex:1">${icon("file", 13)} Draft it</button>
        <button class="btn sm" data-act="gen">${icon("sparkles", 13)} Generate</button>
      </div>
    </div>`).join("")}</div>`;
  grid.querySelectorAll(".card").forEach((card, i) => {
    const it = ideas[i];
    card.querySelector('[data-act="draft"]').onclick = () => openPostModal(null, { content: it.title + ": " + it.text });
    card.querySelector('[data-act="gen"]').onclick = () => { location.hash = `#/generator?topic=${encodeURIComponent(it.title + " — " + it.text.slice(0, 60))}`; };
  });
}
