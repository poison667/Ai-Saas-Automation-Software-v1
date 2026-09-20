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
    page.innerHTML = `<div id="int-grid">${skeletonCards(3, 190)}</div>`;
    let connected;
    try { connected = await api("/api/integrations"); } catch (e) { toast(e.message, { type: "error" }); return; }
    renderIntegrations(connected);
  },
};

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
