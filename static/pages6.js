/* ============ Page: Integrations ============ */
"use strict";

const INTEGRATION_META = {
  slack:    { name: "Slack",        color: "#4A154B", glyph: "S", desc: "Publish, approval and alert messages straight to your channels." },
  zapier:   { name: "Zapier",       color: "#FF4F00", glyph: "Z", desc: "Trigger 5,000+ apps when posts go live or mentions arrive." },
  canva:    { name: "Canva",        color: "#00C4CC", glyph: "C", desc: "Pull brand designs into your Media Library without leaving Lumina." },
  gdrive:   { name: "Google Drive", color: "#1FA463", glyph: "▲", desc: "Auto-sync folders of creative assets into your media library." },
  stripe:   { name: "Stripe",       color: "#635BFF", glyph: "S", desc: "Revenue events attributed to campaigns and posts." },
  shopify:  { name: "Shopify",      color: "#95BF47", glyph: "S", desc: "Product drops become shoppable posts with live inventory." },
};

ROUTES.integrations = {
  title: "Integrations",
  subtitle: "Plug Lumina into the rest of your stack.",
  async render(page) {
    refreshCurrentList = () => ROUTES.integrations.render(document.getElementById("page"));
    page.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
        ${icon("link", 16)} <b style="font-size:14px">Connected apps</b>
        <span class="faint" style="font-size:12px">— OAuth, toggles, and webhooks</span>
      </div>
      <div id="int-grid">${skeletonCards(3, 190)}</div>
      <div style="display:flex;align-items:center;gap:10px;margin:26px 0 12px">
        ${icon("zap", 16)} <b style="font-size:14px">Webhook activity</b>
        <span class="faint" style="font-size:12px">— the last 30 events delivered to your connections</span>
        <span style="flex:1"></span>
        <button class="btn sm" id="wh-refresh">${icon("refresh", 13)} Refresh</button>
      </div>
      <div class="card" id="wh-feed" style="padding:6px 4px">${skeletonTable(3)}</div>`;
    let connected;
    try { connected = await api("/api/integrations"); } catch (e) { toast(e.message, { type: "error" }); return; }
    renderIntegrations(connected);
    loadWebhookFeed();
    document.getElementById("wh-refresh").onclick = loadWebhookFeed;
  },
};

const WH_ICON = { "post.published": "send", "post.approved": "check", "test.ping": "zap", "mention.new": "comment" };
async function loadWebhookFeed() {
  const box = document.getElementById("wh-feed");
  if (!box) return;
  let events = [];
  try { events = await api("/api/webhook-events"); } catch (e) { box.innerHTML = `<div class="empty" style="padding:24px">${e.message}</div>`; return; }
  if (!events.length) {
    box.innerHTML = emptyState({ icon: "zap", title: "No events yet", message: "Publish or approve a post, or send a test event, and it will appear here." });
    return;
  }
  box.innerHTML = events.map(ev => `
    <div class="wh-row">
      <span class="wh-ic">${icon(WH_ICON[ev.event] || "zap", 14)}</span>
      <div style="flex:1;min-width:0">
        <b style="font-size:13px">${ev.event}</b>
        <span class="faint" style="font-size:12px"> → ${esc(INTEGRATION_META[ev.integration_key] ? INTEGRATION_META[ev.integration_key].name : ev.integration_key)}</span>
        <div class="faint" style="font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(ev.payload)}</div>
      </div>
      <span class="faint" style="font-size:11.5px;flex-shrink:0">${timeAgo(ev.created_at)}</span>
    </div>`).join("");
}

function renderIntegrations(connected) {
  const grid = document.getElementById("int-grid");
  if (!grid) return;
  const byKey = {};
  connected.forEach(c => { byKey[c.key] = c; });
  grid.innerHTML = `<div class="grid cols-3">${Object.entries(INTEGRATION_META).map(([key, meta]) => {
    const c = byKey[key];
    return `
    <div class="card fade-in" data-key="${key}" style="display:flex;flex-direction:column">
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:12px">
        <span style="width:42px;height:42px;border-radius:12px;background:${meta.color};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:17px;flex-shrink:0">${meta.glyph}</span>
        <div style="flex:1;min-width:0"><b style="font-size:14.5px;display:block">${meta.name}</b>
          <span class="faint" style="font-size:11.5px">${c ? "Connected " + timeAgo(c.connected_at) : "Not connected"}</span></div>
        ${c ? (c.enabled ? `<span class="badge green"><span class="dot"></span>On</span>` : `<span class="badge gray">Off</span>`) : `<span class="badge gray">—</span>`}
      </div>
      <p class="muted" style="font-size:12.5px;line-height:1.55;flex:1">${meta.desc}</p>
      ${c ? `
        <div class="divider" style="margin:12px 0"></div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
          <input class="input" readonly value="https://hooks.lumina.app/h/${c.webhook_token}" style="font-size:11px;padding:6px 9px">
          <button class="icon-btn" data-act="copy" title="Copy webhook URL">${icon("copy", 14)}</button>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <label class="switch" title="${c.enabled ? "Disable" : "Enable"}"><input type="checkbox" data-toggle ${c.enabled ? "checked" : ""}><span class="track"></span></label>
          <button class="btn sm" data-act="test">${icon("send", 13)} Test event</button>
          <span style="flex:1"></span>
          <button class="icon-btn danger" data-act="del" title="Disconnect">${icon("trash", 14)}</button>
        </div>`
      : `
        <div class="divider" style="margin:12px 0"></div>
        <button class="btn primary block" data-act="connect">${icon("external", 14)} Connect ${meta.name}</button>`}
    </div>`;
  }).join("")}</div>
  <p class="faint mt-16" style="font-size:12px">Webhooks deliver post.published, post.approved and mention.new events as JSON. Connections are simulated locally in this build.</p>`;

  grid.querySelectorAll(".card[data-key]").forEach(card => {
    const key = card.dataset.key;
    const c = connected.find(x => x.key === key);
    const conn = card.querySelector('[data-act="connect"]');
    if (conn) conn.onclick = async () => {
      buttonLoading(conn, true, "Authorizing…");
      try {
        await api("/api/integrations", { method: "POST", body: { key } });
        toast(`${INTEGRATION_META[key].name} connected 🔌`);
        refreshCurrentList();
      } catch (e) { toast(e.message, { type: "error" }); buttonLoading(conn, false); }
    };
    const copy = card.querySelector('[data-act="copy"]');
    if (copy) copy.onclick = async () => {
      const url = card.querySelector("input").value;
      try { await navigator.clipboard.writeText(url); } catch (e) {}
      toast("Webhook URL copied");
    };
    const tgl = card.querySelector("[data-toggle]");
    if (tgl) tgl.onchange = async e => {
      const enabled = e.target.checked;
      try {
        await api(`/api/integrations/${c.id}`, { method: "PATCH", body: { enabled } });
        toast(`${INTEGRATION_META[key].name} ${enabled ? "enabled" : "disabled"}`, { type: "info" });
        refreshCurrentList();
      } catch (err) { toast(err.message, { type: "error" }); }
    };
    const test = card.querySelector('[data-act="test"]');
    if (test) test.onclick = async () => {
      buttonLoading(test, true, "Sending…");
      try {
        await api(`/api/integrations/${c.id}/test`, { method: "POST" });
        toast(`Test event delivered to ${INTEGRATION_META[key].name} ✓`);
      } catch (e) { toast(e.message, { type: "error" }); }
      buttonLoading(test, false);
    };
    const del = card.querySelector('[data-act="del"]');
    if (del) del.onclick = async () => {
      const ok = await confirmModal({ title: "Disconnect", message: `Disconnect ${INTEGRATION_META[key].name}? Its webhook stops receiving events immediately.`, confirmLabel: "Disconnect" });
      if (!ok) return;
      await api(`/api/integrations/${c.id}`, { method: "DELETE" });
      toast(`${INTEGRATION_META[key].name} disconnected`, { type: "info" });
      refreshCurrentList();
    };
  });
}

/* ============ Page: Experiments (A/B tests) ============ */
ROUTES.experiments = {
  title: "Experiments",
  subtitle: "Test post copy variants and let the data pick the winner.",
  async render(page) {
    refreshCurrentList = () => ROUTES.experiments.render(document.getElementById("page"));
    page.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap">
        <div id="ab-stats" style="display:flex;gap:10px;flex-wrap:wrap"></div>
        <span style="flex:1"></span>
        <button class="btn primary sm" id="ab-new" data-perm="create">${icon("flask", 14)} New experiment</button>
      </div>
      <div id="ab-list">${skeletonCards(2, 180)}</div>`;
    let tests = [];
    try { tests = await api("/api/ab"); } catch (e) { toast(e.message, { type: "error" }); return; }
    renderAbStats(tests);
    renderAbList(tests);
    document.getElementById("ab-new").onclick = () => openAbModal();
    applyRoleGuard();
  },
};

function renderAbStats(tests) {
  const running = tests.filter(t => t.status === "running").length;
  const done = tests.filter(t => t.status === "completed").length;
  const bWins = tests.filter(t => t.winner === "B").length;
  document.getElementById("ab-stats").innerHTML = [
    ["flask", tests.length, "Total tests"],
    ["play", running, "Running"],
    ["check", done, "Completed"],
    ["trendUp", bWins, "Variant B wins"],
  ].map(([ic, n, l]) => `<div class="stat-mini">${icon(ic, 14)} <b>${n}</b> <span>${l}</span></div>`).join("");
}

function metricBar(label, val, max, winner) {
  const pct = max > 0 ? (val / max) * 100 : 0;
  return `<div style="display:flex;align-items:center;gap:10px;margin:5px 0">
    <span style="width:74px;font-size:11.5px;color:var(--muted)">${label}</span>
    <div class="progress" style="flex:1"><div class="bar" style="width:${pct}%;background:${winner ? "var(--green)" : "var(--grad)"}"></div></div>
    <b style="font-size:12.5px;min-width:44px;text-align:right">${val ? val.toFixed(2) + "%" : "—"}</b>
  </div>`;
}

function renderAbList(tests) {
  const box = document.getElementById("ab-list");
  if (!tests.length) {
    box.innerHTML = emptyState({ icon: "flask", title: "No experiments yet",
      message: "Pick a draft or scheduled post, write a challenger variant, and let engagement decide.",
      actionLabel: "Start an experiment", actionId: "ab-empty-new" });
    const b = document.getElementById("ab-empty-new");
    if (b) b.onclick = () => openAbModal();
    return;
  }
  box.innerHTML = tests.map(t => {
    const max = Math.max(t.metric_a || 0, t.metric_b || 0);
    return `
    <div class="card fade-in" style="margin-bottom:14px" data-ab="${t.id}">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <b style="font-size:14px">${icon("flask", 15)} A/B test #${t.id}</b>
        ${platRow(t.platforms || [], 12)}
        ${t.status === "running"
          ? `<span class="badge purple"><span class="dot"></span>Running since ${timeAgo(t.created_at)}</span>`
          : `<span class="badge green">Completed · Variant ${t.winner} won</span>`}
        <span style="flex:1"></span>
        ${t.status === "running"
          ? `<button class="btn sm primary" data-act="decide">${icon("zap", 13)} Decide winner</button>`
          : ""}
        <a class="btn sm" href="#/posts">${icon("eye", 13)} Post</a>
        <button class="icon-btn danger" data-act="del" title="Delete experiment">${icon("trash", 14)}</button>
      </div>
      <div class="grid cols-2" style="gap:14px;margin-top:13px">
        <div class="msg-bubble"><div class="mb-meta"><b>Variant A</b> ${t.winner === "A" ? `<span class="badge green">🏆 Winner</span>` : ""} <span class="faint">original</span></div>${esc(t.content_a)}</div>
        <div class="msg-bubble" style="border:1px solid rgba(34,211,238,.35)"><div class="mb-meta"><b>Variant B</b> ${t.winner === "B" ? `<span class="badge green">🏆 Winner${t.status === "completed" ? " — promoted to post" : ""}</span>` : ""} <span class="faint">challenger</span></div>${esc(t.content_b)}</div>
      </div>
      ${t.status === "completed"
        ? `<div style="margin-top:12px">${metricBar("Variant A", t.metric_a, max, t.winner === "A")}${metricBar("Variant B", t.metric_b, max, t.winner === "B")}
           <p class="faint" style="font-size:11.5px;margin-top:6px">Simulated engagement rate measured over the test window. Winner copy replaces the post content.</p></div>`
        : `<p class="faint" style="font-size:12px;margin-top:12px">${icon("clock", 13)} Audience split 50/50 — engagement metrics will appear once you decide the winner.</p>`}
    </div>`;
  }).join("");

  box.querySelectorAll("[data-ab]").forEach(card => {
    const t = tests.find(x => x.id === +card.dataset.ab);
    const decide = card.querySelector('[data-act="decide"]');
    if (decide) decide.onclick = async () => {
      buttonLoading(decide, true, "Measuring engagement…");
      try {
        const res = await api(`/api/ab/${t.id}/decide`, { method: "POST" });
        toast(`Variant ${res.winner} wins with ${Math.max(res.metric_a, res.metric_b).toFixed(2)}% engagement 🏆`);
        refreshCurrentList();
      } catch (e) { toast(e.message, { type: "error" }); buttonLoading(decide, false); }
    };
    card.querySelector('[data-act="del"]').onclick = async () => {
      const ok = await confirmModal({ title: "Delete experiment", message: "This removes the test and its metrics. The post itself is untouched." });
      if (!ok) return;
      await api(`/api/ab/${t.id}`, { method: "DELETE" });
      toast("Experiment deleted", { type: "info" });
      refreshCurrentList();
    };
  });
}

async function openAbModal() {
  let posts = [];
  try { posts = await api("/api/posts"); } catch (e) {}
  const eligible = posts.filter(p => ["draft", "scheduled"].includes(p.status));
  if (!eligible.length) {
    openModal({
      title: "New experiment",
      body: emptyState({ icon: "flask", title: "Nothing to test yet", message: "Experiments run on draft or scheduled posts. Create one first.", actionLabel: "Open Posts", actionId: "go-posts" }),
      foot: `<button class="btn" data-close>Close</button>`,
    }).el.querySelector("#go-posts").onclick = () => { document.querySelector('[data-close]').click(); location.hash = "#/posts"; };
    return;
  }
  const m = openModal({
    title: "New A/B experiment",
    wide: true,
    body: `
      <div class="field"><label>Post to test</label>
        <select class="input" id="ab-post">${eligible.map(p => `<option value="${p.id}">#${p.id} · ${esc(p.content.slice(0, 60))}…</option>`).join("")}</select>
      </div>
      <div class="field"><label>Variant A (current copy)</label>
        <div class="msg-bubble" id="ab-preview-a">${esc(eligible[0].content)}</div>
      </div>
      <div class="field"><label>Variant B — the challenger</label>
        <textarea class="input" id="ab-content-b" rows="5" placeholder="Rewrite the hook, change the CTA, try a different tone…"></textarea>
      </div>`,
    foot: `<button class="btn" data-cancel>Cancel</button><button class="btn primary" id="ab-go">${icon("flask", 14)} Launch experiment</button>`,
  });
  const sel = m.el.querySelector("#ab-post");
  sel.onchange = () => {
    const p = eligible.find(x => x.id === +sel.value);
    m.el.querySelector("#ab-preview-a").textContent = p.content;
  };
  m.el.querySelector("#ab-go").onclick = async e => {
    const content_b = m.el.querySelector("#ab-content-b").value.trim();
    if (!content_b) { toast("Write the challenger variant first", { type: "info" }); return; }
    buttonLoading(e.currentTarget, true, "Launching…");
    try {
      await api("/api/ab", { method: "POST", body: { post_id: +sel.value, content_b } });
      m.close();
      toast("Experiment launched — traffic split 50/50 🧪");
      refreshCurrentList();
    } catch (err) { toast(err.message, { type: "error" }); buttonLoading(e.currentTarget, false); }
  };
}
